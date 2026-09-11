import { jsPDF } from 'jspdf';
import { PcrReportModel } from './reportModel';
import { BrandKit, Narrative, DEFAULT_BRAND_KIT } from '../../types/pcr';
import { AssetResolver } from './pptxGenerator';

/*
  PDF export from the same PcrReportModel — a faithful, brand-styled static
  rendering of the same sections as the deck. jsPDF only (no plugin); tables
  are drawn with a small helper. Fonts fall back to the built-in Helvetica
  (brand fonts cannot be embedded without shipping font files), styled with
  the brand kit's colours. Framework-free.
*/

export interface PdfOptions {
  narrative?: Narrative | null;
  assetResolver?: AssetResolver;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function toRgb(colour: string | undefined, fallback: RGB): RGB {
  const c = (colour ?? '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return fallback;
  return { r: parseInt(c.slice(0, 2), 16), g: parseInt(c.slice(2, 4), 16), b: parseInt(c.slice(4, 6), 16) };
}

function fmt(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-AU');
}

async function resolveImage(resolver: AssetResolver | undefined, path: string | null | undefined): Promise<string | null> {
  if (!resolver || !path) return null;
  try {
    return await resolver(path);
  } catch {
    return null;
  }
}

export async function generatePdf(
  model: PcrReportModel,
  brandKit: BrandKit | null,
  opts: PdfOptions = {}
): Promise<Blob> {
  const kit = brandKit ?? { ...DEFAULT_BRAND_KIT, id: '', agency_id: '', created_at: '', updated_at: '' };
  const primary = toRgb(kit.primary_colour, { r: 91, g: 44, b: 131 });
  const accent = toRgb(kit.accent_colour, { r: 228, g: 0, b: 43 });
  const secondary = toRgb(kit.secondary_colour, { r: 200, g: 184, b: 166 });
  const narrative = opts.narrative ?? null;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const ensure = (h: number): void => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const heading = (text: string): void => {
    ensure(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(text, margin, y);
    doc.setDrawColor(accent.r, accent.g, accent.b);
    doc.setLineWidth(2);
    doc.line(margin, y + 5, margin + 40, y + 5);
    y += 26;
  };

  const paragraph = (text: string, size = 11): void => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(51, 51, 51);
    const lines = doc.splitTextToSize(text, pageW - margin * 2) as string[];
    for (const line of lines) {
      ensure(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    }
    y += 6;
  };

  const table = (headers: string[], rows: string[][], aligns: Array<'left' | 'right'> = []): void => {
    const cols = headers.length;
    const usableW = pageW - margin * 2;
    const colW = usableW / cols;
    const rowH = 18;
    const drawHeader = (): void => {
      doc.setFillColor(primary.r, primary.g, primary.b);
      doc.rect(margin, y, usableW, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      headers.forEach((h, i) => {
        const align = aligns[i] ?? 'left';
        const tx = align === 'right' ? margin + colW * (i + 1) - 4 : margin + colW * i + 4;
        doc.text(h, tx, y + 12, { align });
      });
      y += rowH;
    };
    ensure(rowH * 2);
    drawHeader();
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 51, 51);
    rows.forEach((row, ri) => {
      if (y + rowH > pageH - margin) {
        doc.addPage();
        y = margin;
        drawHeader();
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 51, 51);
      }
      if (ri % 2 === 1) {
        doc.setFillColor(secondary.r, secondary.g, secondary.b);
        doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 0.18 }));
        doc.rect(margin, y, usableW, rowH, 'F');
        doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 1 }));
      }
      doc.setFontSize(9);
      row.forEach((cellText, i) => {
        const align = aligns[i] ?? 'left';
        const tx = align === 'right' ? margin + colW * (i + 1) - 4 : margin + colW * i + 4;
        doc.text(String(cellText), tx, y + 12, { align });
      });
      y += rowH;
    });
    y += 10;
  };

  // ---- Cover ----
  const logo = await resolveImage(opts.assetResolver, kit.logo_dark_path ?? kit.logo_light_path);
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageW, 150, 'F');
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, 30, 90, 40, undefined, 'FAST');
    } catch {
      /* omit on failure */
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(toRgb(kit.text_on_primary, { r: 255, g: 255, b: 255 }).r, toRgb(kit.text_on_primary, { r: 255, g: 255, b: 255 }).g, toRgb(kit.text_on_primary, { r: 255, g: 255, b: 255 }).b);
  doc.text(model.meta.campaign || 'Campaign', margin, 100);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(`${model.meta.advertiser}  ·  ${model.meta.dateFrom} – ${model.meta.dateTo}`, margin, 122);
  y = 180;

  // ---- Overview ----
  if (narrative && narrative.overview.trim() !== '') {
    heading('Campaign overview');
    paragraph(narrative.overview.trim(), 12);
  }

  // ---- Broadcast ----
  const b = model.broadcast;
  if (b.hasObserved || b.hasAired || b.hasBooked) {
    heading('Broadcast delivery');
    if (narrative?.sections?.broadcast) paragraph(narrative.sections.broadcast);
    const cols: Array<{ key: 'observed' | 'aired' | 'booked'; label: string }> = [];
    if (b.hasObserved) cols.push({ key: 'observed', label: 'MOTIX observed' });
    if (b.hasAired) cols.push({ key: 'aired', label: 'Aired (log)' });
    if (b.hasBooked) cols.push({ key: 'booked', label: 'Booked (plan)' });
    const headers = ['Daypart', ...cols.map((c) => c.label)];
    const aligns: Array<'left' | 'right'> = ['left', ...cols.map(() => 'right' as const)];
    const rows = b.total.rows.map((r) => [r.daypart, ...cols.map((c) => fmt(r[c.key]))]);
    rows.push(['Total', ...cols.map((c) => fmt(b.total.totals[c.key]))]);
    table(headers, rows, aligns);
  }

  // ---- Reconciliation ----
  if (model.reconciliation.length > 0) {
    heading('Booked vs delivered');
    const present: string[] = [];
    if (b.hasBooked) present.push('booked plan');
    if (b.hasAired) present.push('aired log');
    if (b.hasObserved) present.push('MOTIX observed');
    paragraph(`Sources present: ${present.join(', ')}.`);
    table(
      ['Station', 'Booked', 'Aired', 'Observed', 'Aired − Booked'],
      model.reconciliation.map((r) => [
        r.displayName,
        fmt(r.booked),
        fmt(r.aired),
        fmt(r.observed),
        r.airedVsBooked === null ? '—' : (r.airedVsBooked > 0 ? '+' : '') + r.airedVsBooked.toLocaleString('en-AU'),
      ]),
      ['left', 'right', 'right', 'right', 'right']
    );
  }

  // ---- Media lines ----
  for (const line of model.mediaLines) {
    const entries = Object.entries(line.metrics);
    if (entries.length === 0 && line.placements.length === 0 && line.perPost.length === 0) continue;
    heading(`${line.lineType.charAt(0).toUpperCase()}${line.lineType.slice(1)} — ${line.label}`);
    const sectionCopy = narrative?.sections?.[line.lineType] ?? narrative?.sections?.[line.label];
    if (sectionCopy) paragraph(sectionCopy);
    if (entries.length > 0) {
      table(
        ['Metric', 'Value'],
        entries.map(([k, v]) => [k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), v.toLocaleString('en-AU')]),
        ['left', 'right']
      );
    }
    if (line.placements.length > 0) {
      table(['Placement', 'Impressions'], line.placements.map((p) => [p.name, p.impressions.toLocaleString('en-AU')]), ['left', 'right']);
    }
    if (line.perPost.length > 0) {
      table(['Post', 'Reach'], line.perPost.map((p) => [p.label, p.reach.toLocaleString('en-AU')]), ['left', 'right']);
    }
  }

  // ---- Audience ----
  if (model.audience) {
    heading('Reach & frequency');
    if (narrative?.sections?.audience) paragraph(narrative.sections.audience);
    const a = model.audience;
    const rows = Object.entries(a.metrics).map(([k, v]) => [
      k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      v.toLocaleString('en-AU'),
    ]);
    if (a.demoLabel) rows.push(['Demographic', a.demoLabel]);
    table(['Metric', 'Value'], rows, ['left', 'right']);
    if (a.sourceNote) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(136, 136, 136);
      ensure(14);
      doc.text(`Source: ${a.sourceNote}`, margin, y);
      y += 16;
    }
  }

  // ---- Gaps ----
  const g = model.gaps;
  const gapLines: string[] = [];
  if (g.unresolvedStations.length) gapLines.push(`Unresolved station names: ${g.unresolvedStations.join(', ')}.`);
  if (g.unknownSpotClassRows) gapLines.push(`${g.unknownSpotClassRows} imported row(s) with unknown paid/bonus class.`);
  if (g.excludedDetections) gapLines.push(`${g.excludedDetections} MOTIX detection(s) excluded.`);
  if (g.mediaLinesMissingSource.length) gapLines.push(`Media lines missing a source note: ${g.mediaLinesMissingSource.join(', ')}.`);
  if (g.sampleData) gapLines.push('Broadcast figures are sample data (no live feed connected).');
  if (gapLines.length) {
    heading('Notes and gaps');
    for (const l of gapLines) paragraph(`• ${l}`, 10);
  }

  return doc.output('blob');
}
