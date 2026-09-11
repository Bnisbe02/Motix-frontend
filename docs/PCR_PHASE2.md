# PCR Phase 2 — Report builder

Phase 2 adds the Post-Campaign Report builder on top of the Phase 1 data
model. It lets a user create a report, pull MOTIX-observed detections from the
Supabase delivery mirror and confirm which belong to the campaign, import a
booked media plan and/or an aired delivery log, add off-broadcast media lines,
and see a review that tags every figure with its source. No PowerPoint or
narrative generation — that is Phase 3.

Stacks on branch `feature/pcr-phase1` (PR not yet merged). Migrations deploy
only via the manual **Supabase Deploy** GitHub Action after merge.

## Part B0 findings — live mirror discovery

Queried read-only against the pilot project `kgvsfxtfylqgvlppavvb`
(Postgres 17, ap-northeast-1) on 2026-09-11.

| Question | Finding |
| --- | --- |
| Does a `detections` mirror exist? | **No.** `public` holds only `access_log`, `chat_usage`, `contact_submissions`, `data_requests`. No `detections`, `bookings`, or any spot/airing/mirror table in any non-system schema. |
| Row count / date span / station values / event types | **Not available** — the table does not exist, so none could be sampled. |
| Do station identifiers match the Phase 1 registry? | **Unverifiable** — no detection rows to compare. The registry itself is also not deployed (Phase 1 migrations are unmerged). |
| Does the pilot user's `agency_id` claim return rows? | **No** — there is no `detections` table to return rows from. The RLS helper `get_agency_id()` **is** deployed (from `20260315084349`), so the tenancy plumbing is ready. |
| Applied migrations | The twelve `20260315*` migrations only. No `20260911*` (Phase 1) yet. |

### Consequence for this phase

The detection adapter is built against the **assumed** column shape from the
task brief, not verified rows. `src/lib/pcrDetections.ts` carries a loud
`TODO(mirror-schema)` at the top and `fetchDetections` degrades gracefully:
when the table is absent Supabase returns a "relation does not exist" style
error, which the adapter reports as `mirrorMissing: true` and the builder
renders as an amber banner ("the MOTIX detections mirror is not available yet")
rather than an error or invented rows.

**When the OVH → Supabase sync creates and populates `detections`:** re-run the
discovery queries below, then correct `DETECTION_COLUMNS`, the `eventType`
values, and the station form (callsign vs display name) in
`src/lib/pcrDetections.ts` — a one-file change.

```sql
-- 1. columns
select column_name, data_type from information_schema.columns
where table_name = 'detections' order by ordinal_position;
-- 2. volume + span (substitute the real timestamp column)
select count(*), min(ts_utc), max(ts_utc) from detections;
-- 3. station values (callsign vs display name?)
select station, count(*) from detections group by 1 order by 2 desc limit 30;
-- 4. event types
select distinct commercial_event_type from detections;
-- 5. brand spellings
select brand, count(*) from detections group by 1 order by 2 desc limit 30;
-- 6. agency scoping
select column_name from information_schema.columns
where table_name='detections' and column_name='agency_id';
```

## Part A — migration

`supabase/migrations/20260911120000_pcr_phase2.sql`:

1. Extends `pcr_assets.asset_type` with `'delivery_log'` (a network-supplied
   aired log is distinct from a booked media plan).
2. `pcr_detection_inclusions` — per-report include/exclude decision for each
   mirror detection (`detection_id` stored as text). PK `(report_id,
   detection_id)`.
3. `pcr_plan_rows` — normalised rows from imported plans (`row_kind='booked'`)
   and delivery logs (`row_kind='aired'`), each tied to its `pcr_assets` row,
   keeping the original row in `raw jsonb`.

Both new tables are agency-scoped (`agency_id text NOT NULL`, RLS
select/insert/update/delete on `agency_id = get_agency_id()`). Each carries a
composite `FOREIGN KEY (report_id, agency_id) REFERENCES pcr_reports(id,
agency_id)` — the same tenancy guard Phase 1 adopted after review, so a caller
who knows another agency's report UUID cannot attach child rows to it. This is
stricter than the plain `report_id` FK in the brief; it relies on the Phase 1
`pcr_reports UNIQUE (id, agency_id)`.

Rollback: `supabase/rollback/20260911999901_rollback_pcr_phase2.sql` drops the
two tables and restores the previous `asset_type` CHECK. Run it before the
Phase 1 rollback if backing out both.

## Part B — detection adapter contract

`src/lib/pcrDetections.ts` is the only file that knows the mirror's shape.

- `DETECTION_COLUMNS` — the column-name map (assumed; see B0).
- `fetchDetections({ advertiser, dateFrom, dateTo, stationCallsigns, stations,
  dayparts })` → `{ detections, unresolvedStations, error, mirrorMissing }`.
  Queries `detections` with a case-insensitive `ilike` on brand, `ts_utc`
  between the UTC window that covers the report's local dates across every
  selected station timezone, and `station in (...)`. Maps each row into
  `PcrDetection` with station-local `localTime`/`localDate` (computed with
  `Intl`, no date library) and a `daypart` assigned from the brand kit
  dayparts. `unresolvedStations` lists mirror station values not in the
  registry. Never throws.
- `fetchAdvertiserSuggestions(prefix, limit)` → distinct brand values for the
  Step 1 autocomplete. Returns `[]` on any error.

Pure helpers used by the adapter live in `src/lib/pcrMetrics.ts`
(`mapDetectionRow`, `summariseDetections`, `formatInTimeZone`,
`zonedWallTimeToUtcISO`, `validateStateSplit`) and `src/utils/dayparts.ts`
(`assignDaypart`). These import no Supabase client and are unit-tested.

## Part C — importer column targets

`src/lib/tabularImport.ts` parses CSV (robust quoted-field parser) and XLSX
(SheetJS, with sheet selection when a workbook has more than one sheet), auto-
maps headers, resolves stations, infers spot class and builds aired timestamps.

Auto-map targets (matched by normalised header, exact then contains):

- **Aired** (`AIRED_TARGETS`): station, aired date, aired time (or a combined
  datetime), daypart, duration, creative code (**`Media` maps here**), media
  value, contract.
- **Booked** (`BOOKED_TARGETS`): station, date or start/end, total or per-day
  spots, daypart, duration, creative code, media value.

The LDV layout `Advertiser, Station, Contract, Aired Date, Aired Time, Day
Part, Aired Dur, Position, Media, Media Value` auto-maps with no manual step.

**Spot class**: a column whose values are all `paid`/`bonus` is detected and
used (`detectSpotClassColumn`); otherwise a zero media value means `bonus` and
anything else is `unknown` (never guessed `paid` from a positive value —
surfaced in review). Dollar values and paid/bonus classification come only from
imported or manual data, never from detections.

**Aired timestamps**: date + time are interpreted in the resolved station's
timezone and stored as UTC. If the station is unresolved, `aired_at` is left
null and the raw values are kept.

## Station resolution rules

`src/lib/stationResolve.ts`, pure and unit-tested. A raw name is normalised
(lowercased, a trailing parenthetical market like `(Sydney)` dropped, all non-
alphanumerics removed) and matched against each registry station's
`display_name` and `callsign`. Exact normalised match wins; a longest-key
containment match is the fallback. Examples that all resolve to `NOVA969`:
`Nova 96.9`, `NOVA969`, `NOVA96.9 (Sydney)`; `nova 100` resolves to `NOVA100`.
Unresolved rows keep `station_callsign = null`, are flagged in the importer
preview, and can be assigned per raw name from a dropdown (the choice applies
to all rows with that name).

## Part D — pages and routes

- `/app/reports` — `ReportsList`: the agency's reports.
- `/app/reports/new` and `/app/reports/:reportId` — `ReportBuilder`: a five-
  step wizard (Campaign · MOTIX detections · Plan and delivery log · Other
  media · Review) with a persistent left stepper. Steps 2–5 unlock once the
  report row exists. Step 1 saves on Next (and autosaves on blur for existing
  reports); later steps persist as you go.
- Nav: "Reports" added to `AppHeader`; the existing spot report entry
  (`/app/report`) relabelled "Spot report". All routes are protected.

## Testing

- `npm test` — 56 pure-logic unit checks (`scripts/run-unit-tests.mjs` bundles
  `src/test/pcr.units.test.ts` with esbuild and runs it under Node): daypart
  assignment across midnight, station resolution, spot-class inference,
  timezone conversion, detection mapping, summarisation, state-split
  validation, and LDV auto-map/normalisation against
  `src/test/fixtures/ldv-sample.csv`.
- Migration applied on top of Phase 1 on local Postgres 17, twice, with RLS
  isolation and cascade checks for both new tables.
- A Playwright walk-through of the whole builder against a mocked Supabase
  (create → toggle detections → import the LDV workbook → add a media line →
  review) — kept in the session scratchpad, not committed (no Playwright dep).

## What Phase 3 builds on this

- Draft `pcr_reports.narrative` from the confirmed detections, imported rows
  and media lines, for the user to edit.
- Render the deck with `pptxgenjs`, reading colours, fonts and logos from the
  brand kit and every figure's source tag from this phase.
- Wire the Step 5 **Generate** button (currently disabled, "Available in
  Phase 3").
