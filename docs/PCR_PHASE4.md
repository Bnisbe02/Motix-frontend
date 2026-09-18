# PCR Phase 4 — the visual system

Phase 4 turns the plain Phase 3 export into a designed deck. It is purely
additive: no arithmetic in `buildReportModel` changed, the detection source
flag is untouched, and the Edge Function is unchanged. The work is a theme
system, a split-panel deck composition, per-report and per-section imagery, and
a voice rule that keeps prose off the data slides.

Stacks on `origin/main` (phases 1–3, all merged). Migrations deploy only via
the manual **Supabase Deploy** GitHub Action after merge.

## The theme system — how a kit becomes a deck

`src/lib/pcr/deckTheme.ts` is a pure, framework/DOM-free module (it imports only
the `BrandKit` type). `deriveTheme(kit)` resolves a brand kit into a full
`DeckTheme`: colours, fonts and a slide geometry system. Both generators consume
it, so **neither `pptxGenerator.ts` nor `pdfExport.ts` hardcodes a hex or a
coordinate** — every colour and rect comes from the theme. No network's palette
is ever baked in; colours come from the kit as-is.

- **Colours.** `primary`, `secondary`, `accent`, `textOnPrimary` are taken from
  the kit. Two derived fills are computed with a deterministic hex-tint helper:
  `zebra = tint(primary, 0.9)` for alternating table rows and
  `totalFill = tint(primary, 0.78)` for the highlighted total row. `tint(hex, a)`
  mixes toward white, `shade(hex, a)` toward black; both are pure and unit-tested
  (`a=0` is the colour, `a=1` is white/black, out-of-range clamps).
- **Geometry.** `GEOM` holds the slide size (13.333×7.5in), margins, the panel
  split ratio, footer-band height, corner-logo box, KPI-card dimensions and the
  accent rule. Typed helpers turn those into concrete rects: `panelSplit(theme,
  side)` → the branded panel + data panel; `contentRect` → the padded content
  area above the footer; `kpiRow`/`kpiStack` → card positions; `logoLockup` →
  the dual-logo geometry.
- **Composed helpers.** `sectionTitle`, `panelFieldOp`, `panelScrimOp`,
  `footerBand`, `captionOp` and `kpiCard` return small, framework-free
  **DrawOp** descriptors (shape/text specs). `tableStyle(theme)` returns the
  header/zebra/total/border tokens for a native table. The generators render
  DrawOps into native PptxGenJS objects (or jsPDF primitives), so tables and
  charts stay **native and editable** — never images of content.

## The deck composition (split-panel master)

Content slides are a two-panel composition: a **branded field** (carrying the
large reversed-out white section title in the heading font) beside a **data
panel** (native table / chart / KPI cards on white). No data ever sits on bare
white. Every content slide carries one repeated frame: a footer band with the
campaign name and page number, and the small network logo in the data-panel
corner. A failed image resolve omits the image and falls back to the colour
field — it never crashes.

Slides, emitted only when their data exists:

1. **Cover** — full branded field + campaign name, advertiser + dates, and a
   dual-logo lockup (network + client) on a light plate. Sample-data banner
   styled into the frame.
2. **Campaign overview** — branded panel + the brand-voiced overview paragraph.
   The only prose slide.
3. **Broadcast delivery** — styled daypart table (primary header, zebra rows,
   highlighted total) + themed column chart. Neutral caption only.
4. **Paid vs bonus** — preserved themed grouped-column chart, where classified.
5. **Booked vs delivered** — styled reconciliation table + grouped chart; the
   caption names which sources are present.
6. **Streaming / Podcast** — lead with a KPI-card row (label, big value) built
   from the line's metrics, then a supporting table / chart / screenshot.
7. **Social / Integration / other** — themed metric / placement / state tables.
8. **Reach & frequency** — audience KPI cards + supporting table.
9. **Closing** — branded field, large "Thank you", dual-logo lockup repeated.

## The asset fallback chain

Each branded panel resolves its background in this order:

> **section image → texture → solid colour field (primary)**

`brand_kits` gains two columns (migration `20260911160000_brand_kit_visuals.sql`,
rollback `20260911999903_rollback_pcr_phase4.sql`):

- `texture_image_path` — one branded pattern drawn behind section titles when a
  section has no dedicated hero.
- `section_images` (jsonb) — a map of section key → object key for an optional
  hero per section. Section keys: `cover, overview, broadcast, reconciliation,
  streaming, podcast, social, integration, audience, closing`.

Both live in the private `brand-assets` bucket and, like every brand asset, the
path must start with the agency id so storage RLS passes. The **Brand kit**
settings page gains a "Deck imagery" section: a texture dropzone and a
collapsible "Section images (optional)" group with one dropzone per section.
Texture and section heroes allow up to 5 MB (logos/cover stay at 2 MB). Uploads
merge into `section_images` (one section never clobbers the others) and save
immediately; removal clears the DB reference first, then deletes the object.

## The client-logo-on-build flow

A client logo is per report, not per kit. Report builder **step 1 (Campaign)**
has a "Client logo (optional)" dropzone, disabled until the report is saved
(helper: *Save the report first*). On upload it goes to
`pcr-assets/<agency_id>/<report_id>/client-logo.<ext>` (fixed path, upsert; no
versioned `pcr_assets` row) via `uploadClientLogo` in `pcrApi.ts`, and the path
is saved to the already-existing `pcr_reports.client_logo_path` column. PNG /
JPG / SVG, 2 MB, preview + remove.

At export, `StepReview` passes `report.client_logo_path` through the new
`clientLogoPath` option on `PptxOptions` / `PdfOptions`. The generators resolve
it alongside the network logo for the cover and closing dual-logo lockup. If the
client logo is absent, the network logo is shown alone, centred — no empty box.

## The voice rule — overview only

Narrative honesty: the generators now render **only** `narrative.overview`, on
the overview slide. `narrative.sections.*` summaries are never drawn on any data
slide. Data-slide captions are neutral and factual only (station · dates, and a
sample-data note when the figures are mock). The same rule applies in
`pdfExport.ts`. The Edge Function is unchanged — the frontend simply stops
rendering section prose. The Phase 4 PPTX check (`scripts/check-pptx-phase4.mjs`)
proves this against the unzipped slide XML: the overview marker appears, and
every section-summary marker is absent from every slide.

## Testing & the sample deck

- `npm test` runs the pure-logic suites, including
  `src/test/pcr.phase4.test.ts`: the `deckTheme` tint/geometry/KPI helpers are
  pure and deterministic, and the rebuilt generator emits the expected slide
  count. All Phase 3 `buildReportModel` and narrative tests pass unchanged.
- `node scripts/check-pptx-native.mjs` — native tables/charts (unchanged).
- `node scripts/check-pptx-phase4.mjs` — serialises the Brightwater sample and
  asserts, via slide XML: 9 slides, embedded images (dual logos + section
  panels), styled tables (primary header fill, zebra fill, total-row fill and a
  "Total" label), KPI labels on the streaming/audience slides, and the voice
  rule (overview present, section prose absent).
- `node scripts/generate-sample-deck.mjs` writes the committed
  `docs/samples/Brightwater_Home_Loans_PCR.pptx` and `.pdf` from a fully-invented
  "Brightwater Home Loans" campaign (broadcast across dayparts on two stations,
  a plan + delivery log so reconciliation renders, a streaming line, a podcast
  line and an audience line). The `.pptx` embeds every visual asset. The `.pdf`
  renders the same designed system (branded panels, coloured tables, KPI cards,
  dual-logo lockup) but, because jsPDF's `addImage` is a browser API that hangs
  under Node, the **node-generated** sample PDF uses solid colour panels rather
  than embedded raster imagery. In the browser the same `generatePdf` embeds
  logos and section imagery normally.

## What remains before a full live multi-brand demo

Two items are still outstanding:

1. **Multi-brand per agency.** Today one `brand_kits` row exists per agency
   (unique on `agency_id`). Serving several brands under one agency needs a
   brand-selection model (multiple kits per agency and a per-report brand
   choice). The visual system already reads a `BrandKit` per generation, so this
   is a data-model + selection change, not a generator rewrite.
2. **OVH → Supabase live-detection sync.** As in Phase 3, broadcast figures run
   on sample data until the pipeline writes delivered detections into a Supabase
   `detections` mirror. Once that exists, set `VITE_PCR_DETECTION_SOURCE=mirror`
   and reconcile `DETECTION_COLUMNS` — a one-file change, no frontend rewrite.
