import PptxGenJS from 'pptxgenjs';
import { PcrReportModel, StationBlock, MediaLineBlock, AudienceBlock } from './reportModel';
import { BrandKit, Narrative } from '../../types/pcr';
import {
  DeckTheme,
  DrawOp,
  Rect,
  deriveTheme,
  panelSplit,
  contentRect,
  panelFieldOp,
  panelScrimOp,
  sectionTitle,
  footerBand,
  cornerLogoRect,
  captionOp,
  tableStyle,
  TableStyle,
  kpiCard,
  kpiRow,
  pickKpis,
  logoLockup,
  tint,
  shade,
} from './deckTheme';

/*
  Brand-driven PPTX generator — the Phase 4 visual system.

  Framework/DOM-free (no React/Supabase) so it is unit-testable and later
  liftable into an Edge Function. Built entirely from the brand kit via
  deckTheme: NO colour or coordinate is hardcoded here — every hex and rect
  comes from the theme. No supplied client deck is ever replicated.

  Composition: content slides use a split-panel master — a branded field
  (section image → texture → solid primary, in that fallback order) carrying a
  large reversed-out section title, beside a data panel carrying native,
  editable tables / charts / KPI cards. No data ever sits on bare white; no
  narrative prose is drawn on a data slide (only the overview slide is prose).
  A repeated frame (footer band + page number + small corner logo) sits on
  every content slide. A failed image resolve omits the image and falls back to
  the solid colour field — it never crashes.
*/

export type AssetResolver = (path: string) => Promise<string | null>;

export interface PptxOptions {
  narrative?: Narrative | null;
  /** Resolves a storage path to a data: URL (preferred) or signed URL. */
  assetResolver?: AssetResolver;
  /** The report's client_logo_path, for the cover / closing dual-logo lockup. */
  clientLogoPath?: string | null;
}

async function resolveImage(
  resolver: AssetResolver | undefined,
  path: string | null | undefined
): Promise<string | null> {
  if (!resolver || !path) return null;
  try {
    return await resolver(path);
  } catch {
    return null;
  }
}

/** PptxGenJS image spec from a resolved URL: embed data URLs, link others. */
function imageProp(url: string): { data: string } | { path: string } {
  return url.startsWith('data:') ? { data: url } : { path: url };
}

function fmt(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-AU');
}

function signed(n: number): string {
  return n > 0 ? `+${n.toLocaleString('en-AU')}` : n.toLocaleString('en-AU');
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function prettyKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ------------------------------------------------------------
// Draw-op renderer (turns theme DrawOps into native PptxGenJS objects)
// ------------------------------------------------------------

function renderOp(slide: PptxGenJS.Slide, pptx: PptxGenJS, op: DrawOp): void {
  if (op.op === 'shape') {
    const shapeType = op.shape === 'roundRect' ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
    slide.addShape(shapeType, {
      x: op.rect.x,
      y: op.rect.y,
      w: op.rect.w,
      h: op.rect.h,
      fill: op.transparency !== undefined ? { color: op.fill, transparency: op.transparency } : { color: op.fill },
      ...(op.line ? { line: { color: op.line.color, width: op.line.width } } : {}),
      ...(op.rectRadius !== undefined ? { rectRadius: op.rectRadius } : {}),
    });
  } else {
    slide.addText(op.text, {
      x: op.rect.x,
      y: op.rect.y,
      w: op.rect.w,
      h: op.rect.h,
      fontFace: op.fontFace,
      fontSize: op.fontSize,
      color: op.color,
      bold: op.bold,
      italic: op.italic,
      align: op.align,
      valign: op.valign,
      transparency: op.transparency,
      lineSpacingMultiple: op.lineSpacingMultiple,
    });
  }
}

function renderOps(slide: PptxGenJS.Slide, pptx: PptxGenJS, ops: DrawOp[]): void {
  for (const op of ops) renderOp(slide, pptx, op);
}

// ------------------------------------------------------------
// Cell + table helpers (styled from the theme)
// ------------------------------------------------------------

interface CellOpts {
  bold?: boolean;
  color?: string;
  fill?: string;
  align?: 'left' | 'right' | 'center';
}

function cell(text: string, o: CellOpts = {}): PptxGenJS.TableCell {
  return {
    text,
    options: {
      bold: o.bold,
      color: o.color ?? '2A2A2A',
      align: o.align ?? 'left',
      fill: o.fill ? { color: o.fill } : undefined,
    },
  };
}

/** Header cell in the theme's header fill/colour. */
function headerCell(ts: TableStyle, text: string, align: 'left' | 'right' | 'center' = 'left'): PptxGenJS.TableCell {
  return cell(text, { bold: true, color: ts.headerColor, fill: ts.headerFill, align });
}

/** Body cell with zebra fill on odd rows. */
function bodyCell(ts: TableStyle, text: string, rowIndex: number, align: 'left' | 'right' | 'center' = 'left'): PptxGenJS.TableCell {
  return cell(text, { color: ts.bodyColor, fill: rowIndex % 2 === 1 ? ts.zebraFill : 'FFFFFF', align });
}

/** Total-row cell in the theme's total fill. */
function totalCell(ts: TableStyle, text: string, align: 'left' | 'right' | 'center' = 'left'): PptxGenJS.TableCell {
  return cell(text, { bold: true, color: ts.totalColor, fill: ts.totalFill, align });
}

function tableProps(ts: TableStyle, rect: Rect): PptxGenJS.TableProps {
  return {
    x: rect.x,
    y: rect.y,
    w: rect.w,
    fontFace: ts.fontFace,
    fontSize: ts.bodyFontSize,
    border: ts.border,
    valign: 'middle',
  };
}

// ------------------------------------------------------------
// The repeated content-slide frame
// ------------------------------------------------------------

interface Frame {
  campaign: string;
  cornerLogoUrl: string | null;
  textureUrl: string | null;
  sectionUrls: Record<string, string | null>;
}

interface ContentSlide {
  slide: PptxGenJS.Slide;
  /** The data panel content rect (padded, above the footer). */
  content: Rect;
  data: Rect;
}

/** Resolve the branded-panel image for a section: section image → texture → null. */
function panelImageFor(frame: Frame, sectionKey: string): string | null {
  return frame.sectionUrls[sectionKey] ?? frame.textureUrl ?? null;
}

/**
 * Add a split-panel content slide: branded field (image or solid) + reversed
 * section title on one side, the repeated footer/logo frame, and an empty data
 * panel returned for the caller to fill with native objects.
 */
function addContentSlide(
  pptx: PptxGenJS,
  theme: DeckTheme,
  frame: Frame,
  page: number,
  sectionKey: string,
  title: string
): ContentSlide {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  const { brand, data } = panelSplit(theme, 'left');

  const panelUrl = panelImageFor(frame, sectionKey);
  if (panelUrl) {
    slide.addImage({ ...imageProp(panelUrl), x: brand.x, y: brand.y, w: brand.w, h: brand.h, sizing: { type: 'cover', w: brand.w, h: brand.h } });
    renderOp(slide, pptx, panelScrimOp(theme, brand));
  } else {
    renderOp(slide, pptx, panelFieldOp(theme, brand));
  }
  renderOps(slide, pptx, sectionTitle(theme, brand, title));
  renderOps(slide, pptx, footerBand(theme, frame.campaign, `Page ${page}`));
  if (frame.cornerLogoUrl) {
    const r = cornerLogoRect(theme, data);
    slide.addImage({ ...imageProp(frame.cornerLogoUrl), x: r.x, y: r.y, w: r.w, h: r.h, sizing: { type: 'contain', w: r.w, h: r.h } });
  }

  return { slide, content: contentRect(theme, data), data };
}

// ------------------------------------------------------------
// Dual-logo lockup (cover + closing)
// ------------------------------------------------------------

function renderLockup(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  theme: DeckTheme,
  area: Rect,
  networkUrl: string | null,
  clientUrl: string | null
): void {
  if (!networkUrl && !clientUrl) return;
  const hasClient = !!clientUrl && !!networkUrl;
  const lockup = logoLockup(area, hasClient);
  // A light plate behind the lockup so both logos read on any branded field.
  const plate = hasClient
    ? { x: lockup.network.x - 0.35, y: lockup.network.y - 0.3, w: lockup.client!.x + lockup.client!.w - lockup.network.x + 0.7, h: lockup.network.h + 0.6 }
    : { x: lockup.network.x - 0.35, y: lockup.network.y - 0.3, w: lockup.network.w + 0.7, h: lockup.network.h + 0.6 };
  slide.addShape(pptx.ShapeType.roundRect, { x: plate.x, y: plate.y, w: plate.w, h: plate.h, fill: { color: 'FFFFFF' }, rectRadius: 0.08 });

  const only = networkUrl ?? clientUrl;
  if (!hasClient && only) {
    const r = lockup.network;
    slide.addImage({ ...imageProp(only), x: r.x, y: r.y, w: r.w, h: r.h, sizing: { type: 'contain', w: r.w, h: r.h } });
    return;
  }
  if (networkUrl) {
    const r = lockup.network;
    slide.addImage({ ...imageProp(networkUrl), x: r.x, y: r.y, w: r.w, h: r.h, sizing: { type: 'contain', w: r.w, h: r.h } });
  }
  if (clientUrl && lockup.client) {
    const r = lockup.client;
    slide.addImage({ ...imageProp(clientUrl), x: r.x, y: r.y, w: r.w, h: r.h, sizing: { type: 'contain', w: r.w, h: r.h } });
  }
  if (lockup.divider) {
    const d = lockup.divider;
    slide.addShape(pptx.ShapeType.rect, { x: d.x, y: d.y, w: d.w, h: d.h, fill: { color: tint(theme.colors.muted, 0.4) } });
  }
}

// ------------------------------------------------------------
// Slide builders
// ------------------------------------------------------------

function hasAnyMetric(line: MediaLineBlock): boolean {
  return (
    Object.keys(line.metrics).length > 0 ||
    line.placements.length > 0 ||
    line.perPost.length > 0 ||
    line.stateSplit.length > 0
  );
}

/**
 * Build the PptxGenJS presentation object (does not serialise). Exposed for
 * tests that assert slide count / native objects / styled tables.
 */
export async function buildPptx(
  model: PcrReportModel,
  brandKit: BrandKit | null,
  opts: PptxOptions = {}
): Promise<PptxGenJS> {
  const theme = deriveTheme(brandKit);
  const ts = tableStyle(theme);
  const narrative = opts.narrative ?? null;
  const sample = model.gaps.sampleData === true;
  const SAMPLE_NOTE = 'Sample data — no live feed connected.';
  const campaign = model.meta.campaign || 'Campaign';

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in, 16:9
  pptx.defineSlideMaster({ title: 'MOTIX_PCR', background: { color: 'FFFFFF' } });

  const kit = brandKit;
  // Resolve every image up front. Missing / failed resolves return null and the
  // deck falls back to a solid colour field — nothing throws.
  const sectionPaths = kit?.section_images ?? {};
  const sectionKeys = Object.keys(sectionPaths);
  const [logoLightUrl, logoDarkUrl, clientLogoUrl, textureUrl, coverLegacyUrl, ...sectionResolved] = await Promise.all([
    resolveImage(opts.assetResolver, kit?.logo_light_path),
    resolveImage(opts.assetResolver, kit?.logo_dark_path),
    resolveImage(opts.assetResolver, opts.clientLogoPath),
    resolveImage(opts.assetResolver, kit?.texture_image_path),
    resolveImage(opts.assetResolver, kit?.cover_image_path),
    ...sectionKeys.map((k) => resolveImage(opts.assetResolver, sectionPaths[k])),
  ]);
  const sectionUrls: Record<string, string | null> = {};
  sectionKeys.forEach((k, i) => {
    sectionUrls[k] = sectionResolved[i] ?? null;
  });

  const frame: Frame = {
    campaign,
    cornerLogoUrl: logoDarkUrl ?? logoLightUrl,
    textureUrl,
    sectionUrls,
  };

  let page = 0;

  // =========================================================
  // Slide 1 — Cover (full branded field + dual-logo lockup)
  // =========================================================
  {
    page += 1;
    const cover = pptx.addSlide();
    const coverUrl = sectionUrls['cover'] ?? coverLegacyUrl ?? textureUrl ?? null;
    if (coverUrl) {
      cover.background = imageProp(coverUrl);
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: theme.geom.slideW, h: theme.geom.slideH, fill: { color: shade(theme.colors.primary, 0.1), transparency: 45 } });
    } else {
      cover.background = { color: theme.colors.primary };
    }

    if (sample) {
      // Sample banner styled into the frame (a slim accent band, not a raw bar).
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: theme.geom.slideW, h: 0.42, fill: { color: theme.colors.accent } });
      cover.addText('SAMPLE DATA — not live-verified', { x: 0, y: 0, w: theme.geom.slideW, h: 0.42, align: 'center', valign: 'middle', fontFace: theme.fonts.body, fontSize: 12, bold: true, color: 'FFFFFF' });
    }

    const m = theme.geom.margin;
    cover.addShape(pptx.ShapeType.rect, { x: m, y: 3.7, w: theme.geom.rule.w, h: theme.geom.rule.h, fill: { color: theme.colors.accent } });
    cover.addText(campaign, { x: m, y: 3.9, w: theme.geom.slideW - m * 2, h: 1.2, fontFace: theme.fonts.heading, fontSize: 44, bold: true, color: theme.colors.textOnPrimary, valign: 'top' });
    cover.addText(`${model.meta.advertiser}  ·  ${model.meta.dateFrom} – ${model.meta.dateTo}`, { x: m, y: 5.1, w: theme.geom.slideW - m * 2, h: 0.5, fontFace: theme.fonts.body, fontSize: 18, color: theme.colors.textOnPrimary });
    cover.addText('Post-Campaign Report', { x: m, y: 5.6, w: theme.geom.slideW - m * 2, h: 0.4, fontFace: theme.fonts.body, fontSize: 12, color: theme.colors.textOnPrimary, transparency: 25 });

    // Dual-logo lockup at the bottom.
    renderLockup(cover, pptx, theme, { x: 0, y: 6.15, w: theme.geom.slideW, h: 1.1 }, logoLightUrl ?? logoDarkUrl, clientLogoUrl);

    cover.addNotes(`Brand fonts: heading "${theme.fonts.heading}", body "${theme.fonts.body}". PowerPoint substitutes a similar font if these are not installed on the viewer's machine.`);
  }

  // =========================================================
  // Slide 2 — Campaign overview (the ONLY prose slide)
  // =========================================================
  if (narrative && narrative.overview.trim() !== '') {
    page += 1;
    const { slide, content } = addContentSlide(pptx, theme, frame, page, 'overview', 'Campaign overview');
    slide.addText(narrative.overview.trim(), {
      x: content.x, y: content.y + 0.3, w: content.w, h: content.h - 0.5,
      fontFace: theme.fonts.body, fontSize: 18, color: theme.colors.text, valign: 'top', lineSpacingMultiple: 1.25,
    });
  }

  // =========================================================
  // Slide 3 — Broadcast delivery (styled table + column chart)
  // =========================================================
  const b = model.broadcast;
  if (b.hasObserved || b.hasAired || b.hasBooked) {
    page += 1;
    const { slide, content } = addContentSlide(pptx, theme, frame, page, 'broadcast', 'Broadcast delivery');

    const caption = [model.meta.stations.join(' · ') || model.meta.advertiser, `${model.meta.dateFrom} – ${model.meta.dateTo}`].join('  ·  ');
    renderOp(slide, pptx, captionOp(theme, { x: content.x, y: content.y, w: content.w, h: 0.35 }, sample ? `${caption}  ·  ${SAMPLE_NOTE}` : caption));

    const cols: Array<{ key: 'observed' | 'aired' | 'booked'; label: string }> = [];
    if (b.hasObserved) cols.push({ key: 'observed', label: 'MOTIX observed' });
    if (b.hasAired) cols.push({ key: 'aired', label: 'Aired (log)' });
    if (b.hasBooked) cols.push({ key: 'booked', label: 'Booked (plan)' });

    const header = [headerCell(ts, 'Daypart')].concat(cols.map((c) => headerCell(ts, c.label, 'right')));
    const bodyRows = b.total.rows.map((r, i) =>
      [bodyCell(ts, r.daypart, i)].concat(cols.map((c) => bodyCell(ts, fmt(r[c.key]), i, 'right')))
    );
    const totalRow = [totalCell(ts, 'Total')].concat(cols.map((c) => totalCell(ts, fmt(b.total.totals[c.key]), 'right')));

    const tableW = Math.min(4.0, content.w * 0.52);
    slide.addTable([header, ...bodyRows, totalRow], tableProps(ts, { x: content.x, y: content.y + 0.5, w: tableW, h: 0 }));

    const labels = b.total.rows.map((r) => r.daypart);
    const chartData = cols.map((c) => ({ name: c.label, labels, values: b.total.rows.map((r) => r[c.key] ?? 0) }));
    const chartX = content.x + tableW + 0.4;
    slide.addChart(pptx.ChartType.bar, chartData, {
      x: chartX, y: content.y + 0.5, w: content.x + content.w - chartX, h: content.h - 0.9,
      barDir: 'col', chartColors: [theme.colors.primary, theme.colors.accent, theme.colors.secondary],
      showLegend: true, legendPos: 'b', showTitle: false,
      catAxisLabelFontFace: theme.fonts.body, valAxisLabelFontFace: theme.fonts.body,
      catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
    });
  }

  // =========================================================
  // Slide — Paid vs bonus (preserved chart, only where classified)
  // =========================================================
  const paidOf = (r: (typeof b.total.rows)[number]): number => (r.airedClass?.paid ?? 0) + (r.bookedClass?.paid ?? 0);
  const bonusOf = (r: (typeof b.total.rows)[number]): number => (r.airedClass?.bonus ?? 0) + (r.bookedClass?.bonus ?? 0);
  const classDayparts = b.total.rows.filter((r) => paidOf(r) + bonusOf(r) > 0);
  if (classDayparts.length > 0) {
    page += 1;
    const { slide, content } = addContentSlide(pptx, theme, frame, page, 'broadcast', 'Paid vs bonus');
    const labels = classDayparts.map((r) => r.daypart);
    slide.addChart(
      pptx.ChartType.bar,
      [
        { name: 'Paid', labels, values: classDayparts.map(paidOf) },
        { name: 'Bonus', labels, values: classDayparts.map(bonusOf) },
      ],
      {
        x: content.x, y: content.y + 0.3, w: content.w, h: content.h - 0.6,
        barDir: 'col', barGrouping: 'clustered', chartColors: [theme.colors.primary, theme.colors.secondary],
        showLegend: true, legendPos: 'b',
        catAxisLabelFontFace: theme.fonts.body, valAxisLabelFontFace: theme.fonts.body,
      }
    );
  }

  // =========================================================
  // Slide — Booked vs delivered (reconciliation)
  // =========================================================
  if (model.reconciliation.length > 0) {
    page += 1;
    const { slide, content } = addContentSlide(pptx, theme, frame, page, 'reconciliation', 'Booked vs delivered');
    const present: string[] = [];
    if (b.hasBooked) present.push('booked plan');
    if (b.hasAired) present.push('aired log');
    if (b.hasObserved) present.push('MOTIX observed');
    renderOp(slide, pptx, captionOp(theme, { x: content.x, y: content.y, w: content.w, h: 0.35 }, `Sources present: ${present.join(', ')}.`));

    const header = [
      headerCell(ts, 'Station'),
      headerCell(ts, 'Booked', 'right'),
      headerCell(ts, 'Aired', 'right'),
      headerCell(ts, 'Observed', 'right'),
      headerCell(ts, 'Aired − Booked', 'right'),
    ];
    const rows = model.reconciliation.map((r, i) => [
      bodyCell(ts, r.displayName, i),
      bodyCell(ts, fmt(r.booked), i, 'right'),
      bodyCell(ts, fmt(r.aired), i, 'right'),
      bodyCell(ts, fmt(r.observed), i, 'right'),
      bodyCell(ts, r.airedVsBooked === null ? '—' : signed(r.airedVsBooked), i, 'right'),
    ]);
    const tableW = Math.min(4.4, content.w * 0.55);
    slide.addTable([header, ...rows], tableProps(ts, { x: content.x, y: content.y + 0.5, w: tableW, h: 0 }));

    const labels = model.reconciliation.map((r) => r.displayName);
    const series: Array<{ name: string; labels: string[]; values: number[] }> = [];
    if (b.hasBooked) series.push({ name: 'Booked', labels, values: model.reconciliation.map((r) => r.booked ?? 0) });
    if (b.hasAired) series.push({ name: 'Aired', labels, values: model.reconciliation.map((r) => r.aired ?? 0) });
    if (b.hasObserved) series.push({ name: 'Observed', labels, values: model.reconciliation.map((r) => r.observed ?? 0) });
    const chartX = content.x + tableW + 0.4;
    slide.addChart(pptx.ChartType.bar, series, {
      x: chartX, y: content.y + 0.5, w: content.x + content.w - chartX, h: content.h - 0.9,
      barDir: 'col', barGrouping: 'clustered', chartColors: [theme.colors.primary, theme.colors.accent, theme.colors.secondary],
      showLegend: true, legendPos: 'b', catAxisLabelFontFace: theme.fonts.body, valAxisLabelFontFace: theme.fonts.body,
    });
  }

  // =========================================================
  // Slides — one per populated media line
  // =========================================================
  for (const line of model.mediaLines) {
    if (!hasAnyMetric(line)) continue;
    page += 1;
    const sectionKey = ['streaming', 'podcast', 'social', 'integration'].includes(line.lineType) ? line.lineType : 'overview';
    const { slide, content } = addContentSlide(pptx, theme, frame, page, sectionKey, `${capitalise(line.lineType)} — ${line.label}`);

    if (line.sourceNote) {
      renderOp(slide, pptx, captionOp(theme, { x: content.x, y: content.y, w: content.w, h: 0.35 }, `Source: ${line.sourceNote}`));
    }

    const kpiLed = line.lineType === 'streaming' || line.lineType === 'podcast';
    let bodyTop = content.y + 0.5;
    let usedKeys = new Set<string>();

    if (kpiLed && Object.keys(line.metrics).length > 0) {
      const { cards, usedKeys: used } = pickKpis(line.metrics, line.lineType, 3);
      usedKeys = used;
      const rects = kpiRow(theme, { x: content.x, y: bodyTop }, cards.length);
      cards.forEach((c, i) => renderOps(slide, pptx, kpiCard(theme, rects[i], c)));
      bodyTop += theme.geom.kpi.h + 0.4;
    }

    // Supporting metric table (metrics not already shown as cards).
    const remaining = Object.entries(line.metrics).filter(([k]) => !usedKeys.has(k));
    const tableW = Math.min(4.0, content.w * 0.5);
    if (remaining.length > 0) {
      const rows = [
        [headerCell(ts, 'Metric'), headerCell(ts, 'Value', 'right')],
        ...remaining.map(([k, v], i) => [bodyCell(ts, prettyKey(k), i), bodyCell(ts, v.toLocaleString('en-AU'), i, 'right')]),
      ];
      slide.addTable(rows, tableProps(ts, { x: content.x, y: bodyTop, w: tableW, h: 0 }));
    }

    // Supporting chart: placements or per-post breakdown.
    const chartX = remaining.length > 0 ? content.x + tableW + 0.4 : content.x;
    const chartW = content.x + content.w - chartX;
    const chartH = content.y + content.h - bodyTop - 0.2;
    if (line.placements.length > 0) {
      slide.addChart(pptx.ChartType.bar, [{ name: 'Impressions', labels: line.placements.map((p) => p.name), values: line.placements.map((p) => p.impressions) }], {
        x: chartX, y: bodyTop, w: chartW, h: chartH, barDir: 'bar', chartColors: [theme.colors.primary], showLegend: false,
        catAxisLabelFontFace: theme.fonts.body, valAxisLabelFontFace: theme.fonts.body,
      });
    } else if (line.perPost.length > 0) {
      slide.addChart(pptx.ChartType.bar, [{ name: 'Reach', labels: line.perPost.map((p) => p.label), values: line.perPost.map((p) => p.reach) }], {
        x: chartX, y: bodyTop, w: chartW, h: chartH, barDir: 'bar', chartColors: [theme.colors.accent], showLegend: false,
        catAxisLabelFontFace: theme.fonts.body, valAxisLabelFontFace: theme.fonts.body,
      });
    } else if (line.stateSplit.length > 0) {
      const rows = [
        [headerCell(ts, 'State'), headerCell(ts, '%', 'right')],
        ...line.stateSplit.map((sp, i) => [bodyCell(ts, sp.state, i), bodyCell(ts, `${sp.percent}%`, i, 'right')]),
      ];
      slide.addTable(rows, tableProps(ts, { x: chartX, y: bodyTop, w: Math.min(3.0, chartW), h: 0 }));
    }

    // Screenshot, if attached and resolvable.
    const shotUrl = await resolveImage(opts.assetResolver, line.screenshotPaths[0]);
    if (shotUrl) {
      const sw = 1.7;
      const sh = 1.7;
      slide.addImage({ ...imageProp(shotUrl), x: content.x + content.w - sw, y: content.y + content.h - sh, w: sw, h: sh, sizing: { type: 'contain', w: sw, h: sh } });
    }
  }

  // =========================================================
  // Slide — Reach & frequency (audience: KPI-led)
  // =========================================================
  if (model.audience) {
    page += 1;
    const a: AudienceBlock = model.audience;
    const { slide, content } = addContentSlide(pptx, theme, frame, page, 'audience', 'Reach & frequency');
    if (a.sourceNote) {
      renderOp(slide, pptx, captionOp(theme, { x: content.x, y: content.y, w: content.w, h: 0.35 }, `Source: ${a.sourceNote}`));
    }

    const { cards, usedKeys } = pickKpis(a.metrics, 'audience', 3);
    let bodyTop = content.y + 0.5;
    if (cards.length > 0) {
      const rects = kpiRow(theme, { x: content.x, y: bodyTop }, cards.length);
      cards.forEach((c, i) => renderOps(slide, pptx, kpiCard(theme, rects[i], c)));
      bodyTop += theme.geom.kpi.h + 0.4;
    }

    const remaining = Object.entries(a.metrics).filter(([k]) => !usedKeys.has(k));
    if (remaining.length > 0 || a.demoLabel) {
      const rows: PptxGenJS.TableCell[][] = [[headerCell(ts, 'Metric'), headerCell(ts, 'Value', 'right')]];
      remaining.forEach(([k, v], i) => rows.push([bodyCell(ts, prettyKey(k), i), bodyCell(ts, v.toLocaleString('en-AU'), i, 'right')]));
      if (a.demoLabel) rows.push([bodyCell(ts, 'Demographic', rows.length), bodyCell(ts, a.demoLabel, rows.length, 'right')]);
      slide.addTable(rows, tableProps(ts, { x: content.x, y: bodyTop, w: Math.min(5.0, content.w), h: 0 }));
    }
  }

  // =========================================================
  // Final — Closing (branded field + dual-logo lockup)
  // =========================================================
  {
    const end = pptx.addSlide();
    const closeUrl = sectionUrls['closing'] ?? textureUrl ?? null;
    if (closeUrl) {
      end.background = imageProp(closeUrl);
      end.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: theme.geom.slideW, h: theme.geom.slideH, fill: { color: shade(theme.colors.primary, 0.1), transparency: 40 } });
    } else {
      end.background = { color: theme.colors.primary };
    }
    end.addText('Thank you', { x: 0, y: 2.5, w: theme.geom.slideW, h: 1.1, align: 'center', fontFace: theme.fonts.heading, fontSize: 44, bold: true, color: theme.colors.textOnPrimary });
    end.addText(sample ? 'Sample data — not live-verified' : 'Verified by MOTIX', { x: 0, y: 3.7, w: theme.geom.slideW, h: 0.5, align: 'center', fontFace: theme.fonts.body, fontSize: 14, color: theme.colors.textOnPrimary, transparency: 20 });
    renderLockup(end, pptx, theme, { x: 0, y: 4.7, w: theme.geom.slideW, h: 1.1 }, logoLightUrl ?? logoDarkUrl, clientLogoUrl);
  }

  return pptx;
}

/** Serialise the deck to a Blob for browser download. */
export async function generatePptx(
  model: PcrReportModel,
  brandKit: BrandKit | null,
  opts: PptxOptions = {}
): Promise<Blob> {
  const pptx = await buildPptx(model, brandKit, opts);
  const out = await pptx.write({ outputType: 'blob' });
  return out as Blob;
}

/** Re-export for callers that only need station block typing. */
export type { StationBlock };
