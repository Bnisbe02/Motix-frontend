# PCR Phase 1 — Data model, station registry, brand kit

Phase 1 lays the foundation for the Post-Campaign Report (PCR) generator.
It ships database tables, a shared station registry, a per-agency brand kit
with a settings page, and the `pptxgenjs` dependency. There is no report
builder and no PowerPoint output yet; those are Phases 2 and 3.

## What was added

| Area | Files |
| --- | --- |
| Migrations | `supabase/migrations/20260911100000_create_stations_registry.sql`<br>`supabase/migrations/20260911100100_create_brand_kits.sql`<br>`supabase/migrations/20260911100200_create_pcr_tables.sql`<br>`supabase/migrations/20260911100300_create_pcr_storage_buckets.sql` |
| Rollback | `supabase/rollback/20260911999900_rollback_pcr_phase1.sql` (manual only, not picked up by `db push`) |
| Types | `src/types/pcr.ts` |
| Hooks | `src/hooks/useBrandKit.ts`, `src/hooks/useStations.ts` |
| Validators | `src/utils/dayparts.ts` |
| UI | `src/pages/BrandKitSettings.tsx` at `/app/settings/brand`, nav entry in `AppHeader` |
| Dependency | `pptxgenjs@^3.12.0` (installed, not imported yet) |

## Deployment

Migrations are **not** applied on merge. After the PR lands, run the manual
**Supabase Deploy** GitHub Action (Actions tab → Supabase Deploy → Run
workflow). It runs `supabase db push`, which applies the four new files in
timestamp order.

## Tenancy model

Every agency-scoped table carries `agency_id text NOT NULL`. Every RLS policy
compares it to `get_agency_id()`, the existing SQL helper that reads the
`app_metadata.agency_id` claim from the caller's JWT (defined in
`20260315084349_20260315070000_add_agency_rls.sql`). A user with no claim
sees zero rows; a user cannot insert or update rows for another agency
because the `WITH CHECK` clause uses the same comparison.

The frontend reads the same claim through `useAuth()` →
`user.app_metadata.agency_id`. If it is missing, `useBrandKit` sets
`error = 'No agency assigned to this account'` and issues no queries.

## Tables

### `stations` (shared, read-only)

The pipeline's station identifiers, with the presentation name and IANA
timezone needed to bucket spots into dayparts per market.

| Column | Notes |
| --- | --- |
| `callsign` PK | Pipeline id, e.g. `NOVA969`, `2QN_Deniliquin` |
| `display_name` | e.g. `Nova 96.9` |
| `market`, `state` | e.g. `Sydney`, `NSW` |
| `timezone` | IANA, e.g. `Australia/Perth` |
| `network` | nullable, e.g. `Nova Entertainment` |
| `is_active` | default `true` |

Readable by every `authenticated` user. No client write policies; writes
come only from the service role (pipeline or SQL editor). Seeded with the
five Nova metro stations and 2QN Deniliquin.

### `brand_kits` (one per agency)

`agency_id` is `UNIQUE`, so the client upserts on it. Colours are hex
strings, fonts are PowerPoint font names, and the three `*_path` columns
are object keys in the `brand-assets` bucket. `dayparts` is a JSON array of
`{name, start, end}` with `HH:MM` times; the default is Nova's seven-window
schedule. `updated_at` is maintained by the reusable `set_updated_at()`
trigger function created in this migration.

### `pcr_reports`

One row per report: advertiser, campaign, date range (`CHECK date_to >=
date_from`), `station_callsigns text[]`, objectives, `status`
(`draft | generated | exported`), optional client logo path, and a
`narrative jsonb` column that Phase 3 will fill with model-drafted,
user-edited copy. `created_by` references `auth.users`. `(id, agency_id)` is unique so child
tables can reference both columns together.

### `pcr_media_lines`

Off-broadcast and supplied lines attached to a report (podcast, streaming,
social, integration, display, activation, audience, other). `metrics` is a
free-form JSON object such as `{"imps_booked":430005,"imps_delivered":557241}`.
The `source` column (`motix_observed | uploaded | manual`) and `source_note`
record provenance so every figure on a slide can be traced. Rows cascade on
report delete. The foreign key is composite, `(report_id, agency_id) →
pcr_reports(id, agency_id)`, so a row can never be attached to another
agency's report even if the caller knows its UUID.

### `pcr_assets`

Uploaded files for a report: media plan workbooks, screenshots, campaign
imagery. `storage_path` is an object key in the `pcr-assets` bucket.
`version` increments for media plans, which are never overwritten. An asset
can optionally point at a media line via `(media_line_id, report_id) →
pcr_media_lines(id, report_id)`, so the line must belong to the same
report; only `media_line_id` is nulled if the line is deleted. The same
composite `(report_id, agency_id)` guard as media lines applies. Rows
cascade on report delete.

## Storage buckets and the agency-id path convention

Two private buckets: `brand-assets` and `pcr-assets`. Policies on
`storage.objects` grant `authenticated` select/insert/update/delete only
when:

```sql
bucket_id IN ('brand-assets','pcr-assets')
AND (storage.foldername(name))[1] = get_agency_id()
```

So **every object key must start with the caller's agency id**:

```
nova/logo_light.png
nova/logo_dark.svg
nova/cover_image.jpg
nova/<report_id>/media-plan-v2.xlsx
```

An upload to any other prefix is rejected by RLS, and a user can only list
or sign URLs for objects under their own prefix. Files are served through
1-hour signed URLs (`useBrandKit.getAssetUrl`), never public URLs.

`useBrandKit.uploadAsset` writes `brand-assets/<agency_id>/<kind>.<ext>`
with `upsert: true`, where `kind` is `logo_light`, `logo_dark` or
`cover_image`. Accepted types are PNG, JPG and SVG up to 2 MB.

## Frontend

- `useStations()` fetches the registry once per page load and caches it in
  module scope. Returns `{ stations, byCallsign, isLoading, error }`.
- `useBrandKit()` returns `{ brandKit, isLoading, error, save, uploadAsset,
  removeAsset, getAssetUrl }`. `brandKit` is `null` until the first save;
  the page renders `DEFAULT_BRAND_KIT` in that case. Nothing throws to the
  caller; every mutation returns `{ success, error? }`.
- `/app/settings/brand` is a protected route. The left column edits name,
  four colours (picker + hex input kept in sync), heading/body fonts with a
  datalist, three asset drop zones, and a dayparts table with add, remove,
  reorder and reset. The right column shows a live 16:9 title slide and
  table slide. Save is disabled until the form is dirty and valid; an
  "Unsaved changes" pill shows while dirty.
- `src/utils/dayparts.ts` validates `HH:MM` (with `24:00` allowed as an
  end), end-after-start, and rejects any overlapping pair.

## Rollback

All changes are additive. Revert the merge commit to remove the code. For
the database, run `supabase/rollback/20260911999900_rollback_pcr_phase1.sql`
manually in the SQL editor. It drops `pcr_assets`, `pcr_media_lines`,
`pcr_reports`, `brand_kits`, `stations`, the four storage policies, and the
two buckets (objects first), in that order.

## What Phase 2 builds on this

- **Report builder** at `/app/reports/pcr/new`: creates a `pcr_reports` row,
  picks stations from `useStations()`, and pulls observed spots from
  `detections` for the chosen callsigns and date range.
- **Media plan upload** into `pcr-assets/<agency_id>/<report_id>/`, parsed
  into `pcr_media_lines` rows with `source = 'uploaded'`, versioned via
  `pcr_assets.version`.
- **Daypart bucketing** using the kit's `dayparts` and each station's
  `timezone` from the registry.
- **Phase 3** then drafts `pcr_reports.narrative` and renders the deck with
  `pptxgenjs`, reading colours, fonts and logos from the brand kit.
