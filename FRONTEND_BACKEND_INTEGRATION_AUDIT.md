# MOTIX Frontend / Backend Integration Audit

Date: 2026-08-01
Scope: `Motix-frontend` (React/Vite/Supabase, Bolt export) audited against the live
API surface of `ASR-NER-Core` (`api_server.py` + `modules/report_routes.py` +
`modules/report_queries.py`). `audio-core-next` was swept and exposes no
frontend-facing surface (correct: it is the capture VM per the two-VM split).
Method: static audit of both trees, first time both sides have been viewed together.

---

## 1. What the frontend actually is

The frontend has two real data planes and one demo shell. Distinguishing them is
the single most important fact in this audit.

### Data plane A: Supabase (real, wired, partly hollow)
- **Auth**: Google OAuth via Supabase (`useAuth.ts`, `ProtectedRoute`,
  `AuthCallback`), with a client-side email allowlist (`VITE_ALLOWED_EMAILS`).
- **Operational tables** (migrations exist): `contact_submissions`, `access_log`
  (login/logout/report-access audit trail), `data_requests`, `chat_usage`.
- **Edge Functions**: `chat` (Anthropic RAG over Supabase `detections` +
  `bookings`), `contact`, `data-request`.
- **Feed status** (`useFeedStatus.ts`): polls Supabase `detections` every 30s;
  badge shows "connected" if the newest row is under 15 minutes old.

**Hollow part:** no migration in this repo creates `detections` or `bookings`,
and nothing anywhere writes pipeline output to Supabase. Unless the production
Supabase project has these tables populated by a process outside both repos, the
feed badge permanently reads "disconnected" and the chat RAG always answers from
an empty context. The chat function is written to degrade gracefully when the
tables are missing, which confirms they were known to be absent.

### Data plane B: the OVH report API (real intent, dead wire)
`useSpotReport.ts` (used by `pages/Report.tsx`, the spot report screen) calls:

```
GET /api/spots/report?brand&station&from&to&page&pageSize      (JSON)
GET /api/spots/report/export/csv?...                            (CSV)
GET /api/spots/report/export/pdf?...                            (PDF)
Header: X-Client-Token: <VITE_CLIENT_TOKEN>
```

Expected response: `{ meta: {brand, station, from, to, page, pageSize, total},
items: [{ts_utc, station, brand, creative_id, duration_sec, confidence}] }`.

### Demo shell (not wired to anything)
- `src/data/campaigns.ts`: nine hardcoded campaigns (Toyota, Qantas, Woolworths...).
- `useCampaignMetrics.ts`: fabricates compliance, share of voice, violations
  from the hardcoded status field. Pure demo arithmetic.
- `BookingUploadModal.tsx`: full upload/map/review UX with no persistence call.
- Competitor analysis widgets: hardcoded competitor arrays.

Everything on the Campaigns/Overview dashboards is demo data. The only screen
built against real pipeline output is the spot Report page, plus the feed badge
and the chat assistant, and none of the three currently receives data.

---

## 2. What the backend actually serves

`api_server.py` mounts `modules/report_routes.py` on port 8090 (no CORS
middleware). Live surface:

| Endpoint | Purpose |
|---|---|
| `GET /reports/campaign` | Tiered campaign report (JSON): high tier + verified medium |
| `GET /reports/campaign/export?format=pdf\|csv` | Agency deliverable, one endpoint, format param |
| `GET /verification/queue` | Unverified paid medium-tier detections with `segment_text` |
| `POST /verification/{detection_id}` | One-shot approve/reject, records `verified_by` |
| `GET /health` | Liveness |

Auth: `X-API-Key` mapped to a username via `MOTIX_API_KEYS` ("key:user,...");
the username becomes `verified_by` on verification decisions. Unset = dev mode.

Params: `station` (callsign form, e.g. `2QN_Deniliquin`), `date_from`,
`date_to`, optional `advertiser`, `tier` (`high`|`medium`). No pagination.

Response: `{ station, period, generated_at, advertiser, tier,
summary: {total_spots, verified_spots, verification_pending},
spots: [{brand, commercial_event_type, start_datetime, duration_sec,
confidence, confidence_tier, verified}] }`.

Persistence is the backend's own PostgreSQL `detections` table
(`modules/db.py`), written by the worker after CEC. It is not Supabase.

---

## 3. The integration gaps, ranked

Nothing in the frontend's live-data path currently works against the backend as
built. The wire is dead at every layer of the contract:

| # | Gap | Detail |
|---|---|---|
| 1 | **Endpoint paths** | Frontend calls `/api/spots/report*`; backend serves `/reports/campaign*`. Zero overlap. Export is split into two frontend endpoints vs one backend endpoint with `format=`. |
| 2 | **Auth model, and a security flaw** | Frontend sends `X-Client-Token` from `VITE_CLIENT_TOKEN`. Anything `VITE_`-prefixed ships in the public browser bundle, so this is a shared static secret visible to anyone who views source. Backend expects `X-API-Key`, and maps keys to named users for the verification audit trail; a single shared browser token would destroy that attribution even if the header names matched. |
| 3 | **Two disconnected `detections` stores** | Feed badge and chat RAG read Supabase `detections`; the pipeline writes only its own Postgres `detections`. No sync exists in either repo, and no migration creates the Supabase table. Badge always "disconnected", chat always empty. |
| 4 | **Query params** | `brand/station/from/to/page/pageSize` vs `station/date_from/date_to/advertiser/tier`. Backend `station` is required; frontend allows all-stations queries. Backend has no pagination; frontend pages through results. Frontend never sends `tier`, the parameter that carries MOTIX's core delivery guarantee. |
| 5 | **Response shape** | `meta/items` with `ts_utc` and `creative_id` vs `summary/spots` with `start_datetime` and `commercial_event_type`. `creative_id` does not exist in the backend vocabulary at all until Phase 2 creative fingerprinting ships; the frontend type is ahead of the product. |
| 6 | **No route to the server** | Calls are relative (`/api/...`) with no Vite dev proxy, no Netlify/nginx redirect config in the repo, and no CORS middleware on the FastAPI app. In every environment the requests 404 against the frontend's own origin. |
| 7 | **Verification has an API but no UI** | The 0.5-0.85 human-verify queue is the mechanism that delivers the 100% precision promise, the backend endpoints are complete, and no frontend page consumes them. The delivery model's human step has no interface. |
| 8 | **Station identity** | Frontend uses display names ("KIIS 106.5", "Gold 104.3"); backend uses callsign identifiers ("2QN_Deniliquin", "2AY"). No shared station registry exists on either side. |

None of these is detection-critical: every gap sits downstream of CEC and the
verdict path, so closing them needs no golden-week canary. Invariants that do
bind: the tier guarantee (only high tier + verified medium ever reaches an
agency), append-only verification, and "billable" never leaving the server.

---

## 4. How the backend is best positioned: options

### Option A: frontend talks directly to FastAPI
Add CORS, align paths/params/shapes, verify Supabase JWTs in FastAPI instead of
static tokens. Supabase stays auth-and-audit only.
- Pro: one system of record, no sync.
- Con: every dashboard read hammers the pipeline database on the OVH VM; the
  feed badge and chat both need rework or new endpoints; CORS plus JWT
  verification in FastAPI is new surface Brent maintains alone; an API outage
  blanks the entire frontend.

### Option B: Supabase becomes the delivery mirror
Backend pushes **delivered** detections (high tier + verified medium only) into
Supabase `detections`; frontend reads Supabase under RLS. FastAPI becomes
internal-only.
- Pro: feed badge and chat RAG start working exactly as already written; RLS
  gives per-agency scoping for free later; reads never touch the pipeline DB.
- Con: exports and the verification queue must not go through the mirror
  (verification items are unverified medium tier and must never be readable by
  agency users), so FastAPI cannot actually become internal-only. Pure B is
  incomplete.

### Option C (recommended): Supabase read plane + FastAPI action plane
- **Reads** (dashboards, feed status, chat RAG, spot report listing): Supabase,
  fed by a small one-way delivery sync in the backend that upserts only
  delivered rows. The sync itself becomes the structural enforcement of the
  tier guarantee: unverified and low-tier rows physically never leave the OVH
  boundary, instead of being filtered per-query.
- **Actions and deliverables** (CSV/PDF export, verification approve/reject):
  FastAPI, authenticated by verifying the caller's Supabase JWT (drop
  `X-Client-Token` entirely; keep `X-API-Key` for machine/internal clients).
  The JWT's email becomes `verified_by`, preserving the audit trail per user.
- **Verification UI**: new frontend page against `/verification/queue` and
  `POST /verification/{id}`, admin-gated.

Why C: the frontend was already built around Supabase reads (badge, chat, RLS
migrations, access_log); C makes three dead features live with one sync job
instead of rewriting them. It removes the public static token. It keeps the
pipeline database private and load-isolated. And it is the smallest total
surface for a solo founder: one sync function plus one JWT dependency, versus
Option A's CORS + auth + pagination + new endpoints across the board.

Cost: OVH credits cover the compute; the real cost is roughly one focused
Claude Code session per phase below, plus Supabase free/Pro tier which is
already in use.

---

## 5. Sequenced plan (resumable, one phase per session)

**Phase 1 — make the wire live (backend + frontend, no schema work)**
1. Backend: add `CORSMiddleware` (allowlist the deployed frontend origins) and a
   Supabase JWT verifier as an alternative credential in `get_current_user`
   (verify signature against the Supabase JWT secret/JWKS; map email to user).
2. Frontend: rewrite `useSpotReport.ts` to call `GET {VITE_API_BASE_URL}/reports/campaign`
   and `/reports/campaign/export?format=csv|pdf`, sending
   `Authorization: Bearer <supabase access token>`; map `spots` to the table
   shape; drop `creative_id` from `SpotReportItem` until Phase 2 fingerprinting
   exists; client-side pagination over the returned spots is acceptable at
   current volumes.
3. Delete `VITE_CLIENT_TOKEN` from `.env.example`, README and code.
4. Validation: sign in, run a report for a station with known July data,
   download both exports; confirm a 401 when signed out.

**Phase 2 — delivery sync (backend)**
5. Supabase migration creating `detections` (`ts_utc, station, brand,
   commercial_event_type, duration_sec, confidence, confidence_tier, verified,
   detection_id` as unique key) with RLS: authenticated read-only, no
   client writes; plus `bookings` for the chat RAG.
6. Backend sync step (post-`insert_detections` hook or a 5-minute systemd
   timer): upsert rows where `is_billable` is true, via Supabase service-role
   key held only on the OVH VM. One direction, no deletes, no re-classification
   (invariant 1 untouched).
7. Validation: feed badge turns green within one poll of live capture; chat
   answers a "did Toyota air on 2AY yesterday" question from real rows.

**Phase 3 — verification UI (frontend)**
8. Admin-gated page against `/verification/queue`: segment text, approve/reject,
   one decision per item, JWT identity flowing to `verified_by`.
9. Validation: approve one medium-tier item, see it appear in the delivered
   report and in Supabase on the next sync.

**Phase 4 — retire the demo shell**
10. Replace `campaigns.ts` with a Supabase `campaigns`/`bookings` model fed by
    the booking upload (wire `BookingUploadModal` to persist), and compute
    `useCampaignMetrics` from real detections vs bookings. Introduce a shared
    station registry (callsign id + display name) used by both sides; this
    resolves gap 8 and the timezone-map onboarding hazard belongs to the same
    registry conversation.

---

## 6. Open questions for Brent

1. Does the production Supabase project already contain `detections`/`bookings`
   tables populated by some process outside these repos, or has the feed badge
   been red since launch? This determines whether Phase 2 is new build or
   reconciliation.
2. Where is the frontend actually deployed (Netlify per the chat function's CORS
   list?), and is there any reverse proxy already mapping `/api/*`?
3. Confirm the report API is `api_server.py` on the ASR VM at port 8090 and that
   `gill.py` as a separate repo no longer exists; the doctrine file map predates
   this tree.
4. Is `MOTIX_API_KEYS` set in production, or is the report API currently in dev
   mode (no auth)? If dev mode and the port is reachable, that needs closing
   this week regardless of any other decision.
