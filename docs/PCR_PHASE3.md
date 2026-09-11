# PCR Phase 3 — export generator and narrative

Phase 3 makes the Post-Campaign Report exportable. It adds a swappable mock
detection source so the whole flow runs without the OVH mirror, a pure
brand-driven PowerPoint and PDF generator, and a model-drafted, user-edited
narrative. No change to the pipeline, the OVH VMs, or detection logic.

Stacks on `feature/pcr-phase2` (PR not merged). Migrations and the new Edge
Function deploy only via the manual **Supabase Deploy** GitHub Action after
merge.

## Detection source flag — mock vs mirror

`src/lib/pcrDetections.ts` reads `VITE_PCR_DETECTION_SOURCE` (`'mock'` |
`'mirror'`, default `'mock'`) via `getDetectionSource()`.

- **mock** (default): `fetchDetections` dynamically imports
  `src/lib/pcrDetections.mock.ts` and returns deterministic sample detections
  for the fictional advertiser **Brightwater Home Loans**, honouring the
  advertiser / date / station filters. The dynamic import means the mock is a
  separate lazy chunk (`dist/assets/pcrDetections.mock-*.js`) that tree-shakes
  out of the main bundle; under `mirror` it is never loaded.
- **mirror**: runs the real Supabase query, unchanged from Phase 2
  (`DETECTION_COLUMNS`, pagination, station resolution, station-local
  dayparting). Until the OVH → Supabase sync exists, `mirror` returns the
  empty / "not available" state.

**Flipping mock → mirror:** set `VITE_PCR_DETECTION_SOURCE=mirror` in the
environment, then, when the mirror's real columns are known, correct
`DETECTION_COLUMNS` per `docs/PCR_PHASE2.md` Part B0. Nothing else changes.

Step 2 shows a neutral chip "Showing sample data (no live feed connected)"
whenever the source is mock and rows are present, so a demo never looks broken
but no one mistakes sample data for live data. The mock advertiser is the only
one that yields data, so any other advertiser shows the honest empty state.

## The `PcrReportModel` contract

`src/lib/pcr/reportModel.ts` exports `buildReportModel(inputs)`, a pure
function (no React, no Supabase) that does **all** arithmetic. The PPTX
generator, the PDF export and the narrative function consume it and never
recompute. Shape:

- `meta` — advertiser, campaign, date range, station display names, generatedAt.
- `broadcast` — per-station and network-total daypart tables. Each cell carries
  up to three source-tagged figures: `observed` (motix_observed), `aired`
  (uploaded delivery log), `booked` (uploaded plan). Paid/bonus split only
  where the plan/log supplied a classification. Booked sums the per-line spot
  quantity; aired counts rows.
- `reconciliation` — booked vs aired vs observed per station, with variances,
  **only** where at least two of the three exist. A missing figure is never
  inferred.
- `mediaLines` — normalised podcast/streaming/social/integration/display
  blocks (scalar metrics, plus placement / per-post / state-split breakdowns
  and screenshot paths). Numbers only.
- `audience` — reach/frequency block if an audience media line exists,
  carrying its `source_note`.
- `gaps` — unresolved stations, unknown spot-class rows, excluded detections,
  media lines missing a source note, and a `sampleData` flag.

## Generator slide rules

`src/lib/pcr/pptxGenerator.ts` — `generatePptx(model, brandKit, opts)` and the
test-friendly `buildPptx(...)`. Built from first principles off the brand kit
(colours, fonts, logos, cover image); it never replicates any supplied client
deck. Every text frame, table and chart is a **native, editable** PptxGenJS
object, never an image of content. A slide is emitted only when its data
exists:

1. **Cover** — cover image or primary-colour field, light logo, campaign name
   in heading font, advertiser + date range in body font, accent rule. Speaker
   note warns that PowerPoint substitutes the brand fonts if absent locally.
2. **Campaign overview** — the narrative overview paragraph (only if present).
3. **Broadcast delivery** — native table of counts by daypart (only the columns
   that have data) plus a native grouped column chart.
4. **Paid vs bonus** — native grouped columns, only where the plan/log
   classified spots.
5. **Booked vs delivered** — native table + chart of the reconciliation, with a
   caption naming which sources are present. Only if reconciliation rows exist.
6. **One slide per populated media line** — native metric table, a placements or
   per-post chart, and an attached screenshot (resolved from `pcr-assets`) if
   present. A media line with no metrics is skipped.
7. **Reach & frequency** — brand-styled metric cards with the `source_note`
   citation. Only if an audience line exists.
8. **Thank you** — brand-styled closing.

`assetResolver(path)` returns a signed or data URL for logos/images; a failed
resolve omits the image, never crashes. `src/lib/pcr/exportAssets.ts` builds a
resolver that signs the path, fetches, and downscales to a capped PNG data URL
so large logos/screenshots don't exhaust browser memory.

`src/lib/pcr/pdfExport.ts` — `generatePdf(model, brandKit, opts)` renders the
same sections to a brand-styled static PDF with jsPDF (one dependency; tables
drawn with a small helper, fonts fall back to Helvetica since brand fonts
cannot be embedded without shipping font files).

All generation is **client-side**; nothing is uploaded to a server. The
downloaded files are named `<advertiser>_<campaign>_PCR.pptx` / `.pdf`
(sanitised).

## Narrative function contract and safety

`supabase/functions/pcr-narrative/index.ts` mirrors the `chat` function's CORS,
JWT verification and `ALLOWED_EMAILS` gate, and reuses the existing Vault
`ANTHROPIC_API_KEY`. `verify_jwt = true` in `supabase/config.toml`.

- **Input:** `{ model: PcrReportModel, tone_description?, tone_reference? }`.
- **Output:** strict JSON `{ overview: string, sections: { [key]: string } }`.
- **Safety constraints in the system prompt:** write using ONLY the figures
  present in `model`; never state or imply sales, revenue, brand lift, recall,
  ROI or any outcome not in the data (delivery only); never invent numbers,
  dollar values, placements, stations or dates; match the supplied tone if
  given, else neutral and factual; British English. `tone_reference` guides
  voice only and is never echoed verbatim.
- **Defensive parsing:** strips code fences, tolerates surrounding prose,
  validates the shape, and on any failure returns the empty fallback
  `{ overview: "", sections: {} }` so the frontend degrades to manual copy
  rather than breaking. The same parser lives in `src/lib/pcr/narrative.ts`
  (`parseNarrativeResponse` / `coerceNarrative`) and is unit-tested.

The brand kit gains a "Report voice" section (`tone_description`,
`tone_reference`, migration `20260911140000_brand_kit_tone.sql`). The review
step's **Draft narrative** button calls the function with the built model and
the tone fields, populates editable fields, and saves the edited result to
`pcr_reports.narrative`. Generation uses the saved, edited narrative — never a
fresh un-reviewed call — and proceeds even with an empty overview.

## Fixture cleanup

The Phase 2 fixture was replaced with `src/test/fixtures/sample-delivery-log.csv`:
a fully invented delivery log for Brightwater Home Loans that preserves the
structural challenges — a combined date-time column (`Aired`), station names
needing fuzzy resolution (`Nova 96.9`, `NOVA969`, `NOVA96.9 (Sydney)`,
`nova 100`), and a paid/bonus `Position` column. The Playwright test builds a
two-sheet workbook from it to exercise sheet selection. No real brand, code,
contract number or value remains anywhere in the repo or tests.

## Testing

- `npm test` — 96 pure-logic checks: `buildReportModel` arithmetic (daypart
  totals, paid/bonus split, reconciliation variance, gaps), narrative parsing
  (fenced and malformed fallback), mock determinism, and PPTX slide count vs
  populated sections. `scripts/check-pptx-native.mjs` serialises a real .pptx
  (CommonJS bundle) and asserts native `<a:tbl>` tables and chart parts via the
  unzipped slide XML.
- Playwright end to end (`VITE_PCR_DETECTION_SOURCE=mock`, mocked Supabase and
  narrative function): create a report for Brightwater Home Loans, see sample
  detections with the chip, import the invented workbook, add podcast and
  audience lines, draft the narrative, Generate, and assert a valid .pptx
  downloads (native charts + table, correct slide count, status `exported`) and
  a `%PDF` file downloads. Kept in the session scratchpad (no Playwright dep).

## What remains for a live MOTIX-data demo

Everything above runs on sample data today. The one remaining backend task is
the **OVH → Supabase subscription sync**: a job on the pipeline side that writes
delivered detections into a Supabase `detections` table (the mirror that Phase
2 B0 found absent). Once that table exists and is populated, set
`VITE_PCR_DETECTION_SOURCE=mirror` and reconcile `DETECTION_COLUMNS` with its
real columns (a one-file change in `src/lib/pcrDetections.ts`). No frontend
rewrite is needed — the adapter seam, the model, the generator and the
narrative all already consume the same `PcrDetection` shape.
