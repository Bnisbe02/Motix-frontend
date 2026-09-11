import PptxGenJS from 'pptxgenjs';
import { PcrReportModel, StationBlock, MediaLineBlock } from './reportModel';
import { BrandKit, Narrative, DEFAULT_BRAND_KIT } from '../../types/pcr';

/*
  Brand-driven PPTX generator. Framework-free (no React/Supabase) so it is
  unit-testable and later liftable into an Edge Function. Built from first
  principles off the brand kit — colours, fonts, logos, cover image — never
  from any supplied client deck. Every text frame, table and chart is a native
  editable PptxGenJS object, never an image of content. A slide is emitted only
  when its data exists.
*/

export type AssetResolver = (path: string) => Promise<string | null>;

export interface PptxOptions {
  narrative?: Narrative | null;
  /** Resolves a storage path to a data: URL (preferred) or signed URL. */
  assetResolver?: AssetResolver;
}

function hex(colour: string | undefined, fallback: string): string {
  const c = (colour ?? fallback).replace('#', '').trim();
  return /^[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : fallback.replace('#', '').toUpperCase();
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

/**
 * Build the PptxGenJS presentation object (does not serialise). Exposed for
 * tests that assert slide count / native objects.
 */
export async function buildPptx(
  model: PcrReportModel,
  brandKit: BrandKit | null,
  opts: PptxOptions = {}
): Promise<PptxGenJS> {
  const kit = brandKit ?? { ...DEFAULT_BRAND_KIT, id: '', agency_id: '', created_at: '', updated_at: '' };
  const primary = hex(kit.primary_colour, '#5B2C83');
  const secondary = hex(kit.secondary_colour, '#C8B8A6');
  const accent = hex(kit.accent_colour, '#E4002B');
  const onPrimary = hex(kit.text_on_primary, '#FFFFFF');
  const headingFont = kit.heading_font || 'Montserrat';
  const bodyFont = kit.body_font || 'Calibri';
  const narrative = opts.narrative ?? null;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in, 16:9
  pptx.defineSlideMaster({ title: 'MOTIX_PCR', background: { color: 'FFFFFF' } });

  const [coverUrl, logoLightUrl, logoDarkUrl] = await Promise.all([
    resolveImage(opts.assetResolver, kit.cover_image_path),
    resolveImage(opts.assetResolver, kit.logo_light_path),
    resolveImage(opts.assetResolver, kit.logo_dark_path),
  ]);

  // ---------------------------------------------------------
  // Slide 1 — Cover
  // ---------------------------------------------------------
  const cover = pptx.addSlide();
  if (coverUrl) {
    cover.background = imageProp(coverUrl);
    // Darkened band behind text for legibility over any image.
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 4.2, w: '100%', h: 3.3, fill: { color: primary, transparency: 15 } });
  } else {
    cover.background = { color: primary };
  }
  if (logoLightUrl) {
    cover.addImage({ ...imageProp(logoLightUrl), x: 0.6, y: 0.5, w: 2.2, h: 0.9, sizing: { type: 'contain', w: 2.2, h: 0.9 } });
  }
  cover.addShape(pptx.ShapeType.rect, { x: 0.6, y: 4.6, w: 1.6, h: 0.08, fill: { color: accent } });
  cover.addText(model.meta.campaign || 'Campaign', {
    x: 0.6, y: 4.75, w: 12, h: 1.1, fontFace: headingFont, fontSize: 40, bold: true, color: onPrimary,
  });
  cover.addText(
    `${model.meta.advertiser}  ·  ${model.meta.dateFrom} – ${model.meta.dateTo}`,
    { x: 0.6, y: 5.9, w: 12, h: 0.5, fontFace: bodyFont, fontSize: 16, color: onPrimary },
  );
  cover.addText('Post-Campaign Report · Verified by MOTIX', {
    x: 0.6, y: 6.9, w: 12, h: 0.4, fontFace: bodyFont, fontSize: 11, color: onPrimary, transparency: 25,
  });
  cover.addNotes(
    `Brand fonts: heading "${headingFont}", body "${bodyFont}". PowerPoint substitutes a similar font if these are not installed on the viewer's machine.`
  );

  // ---------------------------------------------------------
  // Slide 2 — Campaign overview (only if narrative provided)
  // ---------------------------------------------------------
  if (narrative && narrative.overview.trim() !== '') {
    const s = pptx.addSlide();
    addHeading(s, 'Campaign overview', { headingFont, primary, accent, pptx });
    s.addText(narrative.overview.trim(), {
      x: 0.6, y: 1.6, w: 12, h: 4.5, fontFace: bodyFont, fontSize: 18, color: '333333', valign: 'top', lineSpacingMultiple: 1.2,
    });
  }

  // ---------------------------------------------------------
  // Slide 3 — Broadcast delivery
  // ---------------------------------------------------------
  const b = model.broadcast;
  if (b.hasObserved || b.hasAired || b.hasBooked) {
    const s = pptx.addSlide();
    addHeading(s, 'Broadcast delivery', { headingFont, primary, accent, pptx });
    if (narrative?.sections?.broadcast) addCaption(s, narrative.sections.broadcast, bodyFont);

    // Native table of the network total by daypart.
    const cols: Array<{ key: 'observed' | 'aired' | 'booked'; label: string }> = [];
    if (b.hasObserved) cols.push({ key: 'observed', label: 'MOTIX observed' });
    if (b.hasAired) cols.push({ key: 'aired', label: 'Aired (log)' });
    if (b.hasBooked) cols.push({ key: 'booked', label: 'Booked (plan)' });

    const header = [cell('Daypart', { bold: true, color: onPrimary, fill: primary })].concat(
      cols.map((c) => cell(c.label, { bold: true, color: onPrimary, fill: primary, align: 'right' }))
    );
    const bodyRows = b.total.rows.map((r, i) => {
      const rowFill = i % 2 === 1 ? secondary + ':20' : 'FFFFFF';
      return [cell(r.daypart, { fill: rowFill })].concat(
        cols.map((c) => cell(fmt(r[c.key]), { align: 'right', fill: rowFill }))
      );
    });
    const totalRow = [cell('Total', { bold: true, fill: 'EEEEEE' })].concat(
      cols.map((c) => cell(fmt(b.total.totals[c.key]), { bold: true, align: 'right', fill: 'EEEEEE' }))
    );
    s.addTable([header, ...bodyRows, totalRow], {
      x: 0.6, y: 1.9, w: 6.0, fontFace: bodyFont, fontSize: 11, border: { type: 'solid', pt: 0.5, color: 'DDDDDD' }, valign: 'middle',
    });

    // Native grouped column chart of counts by daypart.
    const labels = b.total.rows.map((r) => r.daypart);
    const chartData = cols.map((c) => ({
      name: c.label,
      labels,
      values: b.total.rows.map((r) => r[c.key] ?? 0),
    }));
    s.addChart(pptx.ChartType.bar, chartData, {
      x: 6.9, y: 1.9, w: 5.9, h: 4.6, barDir: 'col', chartColors: [primary, accent, secondary],
      showLegend: true, legendPos: 'b', showTitle: false, catAxisLabelFontFace: bodyFont, valAxisLabelFontFace: bodyFont,
      catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
    });
  }

  // Paid vs bonus grouped columns, only where the plan/log classified spots.
  const classDayparts = b.total.rows.filter((r) => r.airedClass || r.bookedClass);
  const hasClass = classDayparts.some(
    (r) => (r.airedClass && r.airedClass.paid + r.airedClass.bonus > 0) || (r.bookedClass && r.bookedClass.paid + r.bookedClass.bonus > 0)
  );
  if (hasClass) {
    const s = pptx.addSlide();
    addHeading(s, 'Paid vs bonus', { headingFont, primary, accent, pptx });
    const labels = classDayparts.map((r) => r.daypart);
    const source = b.hasAired ? 'airedClass' : 'bookedClass';
    const paid = classDayparts.map((r) => r[source as 'airedClass']?.paid ?? 0);
    const bonus = classDayparts.map((r) => r[source as 'airedClass']?.bonus ?? 0);
    s.addChart(
      pptx.ChartType.bar,
      [
        { name: 'Paid', labels, values: paid },
        { name: 'Bonus', labels, values: bonus },
      ],
      { x: 0.6, y: 1.9, w: 12, h: 4.6, barDir: 'col', barGrouping: 'clustered', chartColors: [primary, secondary], showLegend: true, legendPos: 'b' }
    );
  }

  // ---------------------------------------------------------
  // Slide 4 — Booked vs delivered (reconciliation)
  // ---------------------------------------------------------
  if (model.reconciliation.length > 0) {
    const s = pptx.addSlide();
    addHeading(s, 'Booked vs delivered', { headingFont, primary, accent, pptx });
    const present: string[] = [];
    if (b.hasBooked) present.push('booked plan');
    if (b.hasAired) present.push('aired log');
    if (b.hasObserved) present.push('MOTIX observed');
    addCaption(s, `Sources present: ${present.join(', ')}.`, bodyFont);

    const header = [
      cell('Station', { bold: true, color: onPrimary, fill: primary }),
      cell('Booked', { bold: true, color: onPrimary, fill: primary, align: 'right' }),
      cell('Aired', { bold: true, color: onPrimary, fill: primary, align: 'right' }),
      cell('Observed', { bold: true, color: onPrimary, fill: primary, align: 'right' }),
      cell('Aired − Booked', { bold: true, color: onPrimary, fill: primary, align: 'right' }),
    ];
    const rows = model.reconciliation.map((r, i) => {
      const f = i % 2 === 1 ? secondary + ':20' : 'FFFFFF';
      return [
        cell(r.displayName, { fill: f }),
        cell(fmt(r.booked), { align: 'right', fill: f }),
        cell(fmt(r.aired), { align: 'right', fill: f }),
        cell(fmt(r.observed), { align: 'right', fill: f }),
        cell(r.airedVsBooked === null ? '—' : signed(r.airedVsBooked), { align: 'right', fill: f }),
      ];
    });
    s.addTable([header, ...rows], { x: 0.6, y: 2.1, w: 6.0, fontFace: bodyFont, fontSize: 11, border: { type: 'solid', pt: 0.5, color: 'DDDDDD' } });

    const labels = model.reconciliation.map((r) => r.displayName);
    const series: Array<{ name: string; labels: string[]; values: number[] }> = [];
    if (b.hasBooked) series.push({ name: 'Booked', labels, values: model.reconciliation.map((r) => r.booked ?? 0) });
    if (b.hasAired) series.push({ name: 'Aired', labels, values: model.reconciliation.map((r) => r.aired ?? 0) });
    if (b.hasObserved) series.push({ name: 'Observed', labels, values: model.reconciliation.map((r) => r.observed ?? 0) });
    s.addChart(pptx.ChartType.bar, series, {
      x: 6.9, y: 2.1, w: 5.9, h: 4.4, barDir: 'col', barGrouping: 'clustered', chartColors: [primary, accent, secondary], showLegend: true, legendPos: 'b',
    });
  }

  // ---------------------------------------------------------
  // Slide 5 — one per populated media line
  // ---------------------------------------------------------
  for (const line of model.mediaLines) {
    if (!hasAnyMetric(line)) continue;
    const s = pptx.addSlide();
    addHeading(s, `${capitalise(line.lineType)} — ${line.label}`, { headingFont, primary, accent, pptx });
    const sectionCopy = narrative?.sections?.[line.lineType] ?? narrative?.sections?.[line.label];
    if (sectionCopy) addCaption(s, sectionCopy, bodyFont);

    const metricRows = Object.entries(line.metrics);
    if (metricRows.length > 0) {
      const rows = [
        [cell('Metric', { bold: true, color: onPrimary, fill: primary }), cell('Value', { bold: true, color: onPrimary, fill: primary, align: 'right' })],
        ...metricRows.map(([k, v], i) => {
          const f = i % 2 === 1 ? secondary + ':20' : 'FFFFFF';
          return [cell(prettyKey(k), { fill: f }), cell(v.toLocaleString('en-AU'), { align: 'right', fill: f })];
        }),
      ];
      s.addTable(rows, { x: 0.6, y: 2.0, w: 5.4, fontFace: bodyFont, fontSize: 12, border: { type: 'solid', pt: 0.5, color: 'DDDDDD' } });
    }

    // Chart: placements or per-post breakdown.
    if (line.placements.length > 0) {
      s.addChart(pptx.ChartType.bar, [{ name: 'Impressions', labels: line.placements.map((p) => p.name), values: line.placements.map((p) => p.impressions) }], {
        x: 6.2, y: 2.0, w: 5.0, h: 4.2, barDir: 'bar', chartColors: [primary], showLegend: false,
      });
    } else if (line.perPost.length > 0) {
      s.addChart(pptx.ChartType.bar, [{ name: 'Reach', labels: line.perPost.map((p) => p.label), values: line.perPost.map((p) => p.reach) }], {
        x: 6.2, y: 2.0, w: 5.0, h: 4.2, barDir: 'bar', chartColors: [accent], showLegend: false,
      });
    }

    // Screenshot, if attached and resolvable.
    const shotUrl = await resolveImage(opts.assetResolver, line.screenshotPaths[0]);
    if (shotUrl) {
      s.addImage({ ...imageProp(shotUrl), x: 11.3, y: 2.0, w: 1.6, h: 1.6, sizing: { type: 'contain', w: 1.6, h: 1.6 } });
    }
  }

  // ---------------------------------------------------------
  // Slide 6 — Reach & frequency (only if an audience line exists)
  // ---------------------------------------------------------
  if (model.audience) {
    const a = model.audience;
    const s = pptx.addSlide();
    addHeading(s, 'Reach & frequency', { headingFont, primary, accent, pptx });
    if (narrative?.sections?.audience) addCaption(s, narrative.sections.audience, bodyFont);

    const cards: Array<{ label: string; key: string }> = [
      { label: 'Reach 1+', key: 'reach_1plus' },
      { label: 'Reach 3+', key: 'reach_3plus' },
      { label: 'Avg frequency', key: 'avg_frequency' },
      { label: 'Gross impacts', key: 'gross_impacts' },
    ];
    let cx = 0.6;
    for (const card of cards) {
      const val = a.metrics[card.key];
      if (val === undefined) continue;
      s.addShape(pptx.ShapeType.roundRect, { x: cx, y: 2.2, w: 2.9, h: 1.9, fill: { color: secondary, transparency: 70 }, line: { color: primary, width: 1 }, rectRadius: 0.08 });
      s.addText(val.toLocaleString('en-AU'), { x: cx, y: 2.5, w: 2.9, h: 0.9, align: 'center', fontFace: headingFont, fontSize: 30, bold: true, color: primary });
      s.addText(card.label, { x: cx, y: 3.4, w: 2.9, h: 0.5, align: 'center', fontFace: bodyFont, fontSize: 13, color: '555555' });
      cx += 3.1;
    }
    if (a.demoLabel) {
      s.addText(`Demographic: ${a.demoLabel}`, { x: 0.6, y: 4.4, w: 12, h: 0.4, fontFace: bodyFont, fontSize: 13, color: '333333' });
    }
    if (a.sourceNote) {
      s.addText(`Source: ${a.sourceNote}`, { x: 0.6, y: 6.7, w: 12, h: 0.4, fontFace: bodyFont, fontSize: 10, italic: true, color: '888888' });
    }
  }

  // ---------------------------------------------------------
  // Final — Thank you
  // ---------------------------------------------------------
  const end = pptx.addSlide();
  end.background = { color: primary };
  if (logoDarkUrl || logoLightUrl) {
    const u = logoLightUrl ?? logoDarkUrl!;
    end.addImage({ ...imageProp(u), x: 5.5, y: 2.2, w: 2.3, h: 1.0, sizing: { type: 'contain', w: 2.3, h: 1.0 } });
  }
  end.addText('Thank you', { x: 0, y: 3.4, w: '100%', h: 1, align: 'center', fontFace: headingFont, fontSize: 40, bold: true, color: onPrimary });
  end.addText('Verified by MOTIX', { x: 0, y: 4.5, w: '100%', h: 0.5, align: 'center', fontFace: bodyFont, fontSize: 14, color: onPrimary, transparency: 20 });

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

// ------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------

interface HeadingStyle {
  headingFont: string;
  primary: string;
  accent: string;
  pptx: PptxGenJS;
}

function addHeading(slide: PptxGenJS.Slide, title: string, style: HeadingStyle): void {
  slide.addText(title, { x: 0.6, y: 0.5, w: 12, h: 0.8, fontFace: style.headingFont, fontSize: 26, bold: true, color: style.primary });
  slide.addShape(style.pptx.ShapeType.rect, { x: 0.6, y: 1.35, w: 1.2, h: 0.06, fill: { color: style.accent } });
}

function addCaption(slide: PptxGenJS.Slide, text: string, bodyFont: string): void {
  slide.addText(text, { x: 0.6, y: 1.45, w: 12, h: 0.5, fontFace: bodyFont, fontSize: 12, italic: true, color: '666666' });
}

interface CellOpts {
  bold?: boolean;
  color?: string;
  fill?: string;
  align?: 'left' | 'right' | 'center';
}

function cell(text: string, o: CellOpts = {}): PptxGenJS.TableCell {
  const fill = o.fill
    ? o.fill.includes(':')
      ? { color: o.fill.split(':')[0], transparency: 100 - Number(o.fill.split(':')[1]) }
      : { color: o.fill }
    : undefined;
  return {
    text,
    options: { bold: o.bold, color: o.color ?? '333333', align: o.align ?? 'left', fill },
  };
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

function hasAnyMetric(line: MediaLineBlock): boolean {
  return Object.keys(line.metrics).length > 0 || line.placements.length > 0 || line.perPost.length > 0;
}

/** Re-export for callers that only need station block typing. */
export type { StationBlock };
