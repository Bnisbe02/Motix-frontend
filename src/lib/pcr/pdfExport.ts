import { jsPDF } from 'jspdf';
import { PcrReportModel } from './reportModel';
import { BrandKit, Narrative } from '../../types/pcr';
import { AssetResolver } from './pptxGenerator';
import { deriveTheme, toRgb, pickKpis, KpiCardInput } from './deckTheme';

/*
  PDF export from the same PcrReportModel — the Phase 4 visual system rendered
  with jsPDF only (no plugin). It is not pixel-identical to the PPTX but reads
  as the same designed deck: branded section-title bands (the "panels"),
  coloured table headers with zebra rows and a highlighted total row, KPI cards
  as styled blocks, and a dual-logo lockup on the cover and closing. Every
  colour comes from the shared deckTheme; brand fonts fall back to Helvetica
  since they cannot be embedded without shipping font files. Framework-free.

  Voice rule: only the narrative OVERVIEW is drawn (on its own section). No
  per-section narrative prose is rendered on any data section; data captions
  are neutral and factual.
*/

export interface PdfOptions {
  narrative?: Narrative | null;
  assetResolver?: AssetResolver;
  /** The report's client_logo_path, for the cover / closing dual-logo lockup. */
  clientLogoPath?: string | null;
}

type RGB = { r: number; g: number; b: number };

function fmt(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-AU');
}

function prettyKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  const theme = deriveTheme(brandKit);
  const primary = toRgb(theme.colors.primary);
  const accent = toRgb(theme.colors.accent);
  const onPrimary = toRgb(theme.colors.textOnPrimary);
  const zebra = toRgb(theme.colors.zebra);
  const totalFill = toRgb(theme.colors.totalFill);
  const cardFill = toRgb(theme.colors.cardFill);
  const text = toRgb(theme.colors.text);
  const muted = toRgb(theme.colors.muted);
  const border = toRgb(theme.colors.border);
  const narrative = opts.narrative ?? null;
  const sample = model.gaps.sampleData === true;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableW = pageW - margin * 2;
  let y = margin;

  // ---- Pre-resolve every image (never throws) ----
  const kit = brandKit;
  const sectionPaths = kit?.section_images ?? {};
  const sk = (k: string): string | undefined => sectionPaths[k];
  const [logoLight, logoDark, clientLogo, texture, secOverview, secBroadcast, secRecon, secStreaming, secPodcast, secSocial, secIntegration, secAudience, secClosing] =
    await Promise.all([
      resolveImage(opts.assetResolver, kit?.logo_light_path),
      resolveImage(opts.assetResolver, kit?.logo_dark_path),
      resolveImage(opts.assetResolver, opts.clientLogoPath),
      resolveImage(opts.assetResolver, kit?.texture_image_path),
      resolveImage(opts.assetResolver, sk('overview')),
      resolveImage(opts.assetResolver, sk('broadcast')),
      resolveImage(opts.assetResolver, sk('reconciliation')),
      resolveImage(opts.assetResolver, sk('streaming')),
      resolveImage(opts.assetResolver, sk('podcast')),
      resolveImage(opts.assetResolver, sk('social')),
      resolveImage(opts.assetResolver, sk('integration')),
      resolveImage(opts.assetResolver, sk('audience')),
      resolveImage(opts.assetResolver, sk('closing')),
    ]);
  const sectionImage: Record<string, string | null> = {
    overview: secOverview,
    broadcast: secBroadcast,
    reconciliation: secRecon,
    streaming: secStreaming,
    podcast: secPodcast,
    social: secSocial,
    integration: secIntegration,
    audience: secAudience,
    closing: secClosing,
  };
  const networkLogo = logoLight ?? logoDark;

  // ---- Low-level helpers ----
  const setFill = (c: RGB): void => {
    doc.setFillColor(c.r, c.g, c.b);
  };
  const setText = (c: RGB): void => {
    doc.setTextColor(c.r, c.g, c.b);
  };
  const setDraw = (c: RGB): void => {
    doc.setDrawColor(c.r, c.g, c.b);
  };

  const withOpacity = (opacity: number, draw: () => unknown): void => {
    const GState = (doc as unknown as { GState: new (o: object) => object }).GState;
    doc.setGState(new GState({ opacity }));
    draw();
    doc.setGState(new GState({ opacity: 1 }));
  };

  const ensure = (h: number): void => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  /** Contain-fit an image inside a box, centred. Omits on any failure. */
  const drawImageContain = (url: string, x: number, boxY: number, boxW: number, boxH: number): void => {
    try {
      const props = doc.getImageProperties(url);
      const scale = Math.min(boxW / props.width, boxH / props.height);
      const w = props.width * scale;
      const h = props.height * scale;
      doc.addImage(url, x + (boxW - w) / 2, boxY + (boxH - h) / 2, w, h, undefined, 'FAST');
    } catch {
      try {
        doc.addImage(url, x, boxY, boxW, boxH, undefined, 'FAST');
      } catch {
        /* omit on failure */
      }
    }
  };

  /** A branded section-title band (the "panel" analogue), full-bleed. */
  const sectionHeader = (title: string, sectionKey: string): void => {
    const bandH = 34;
    ensure(bandH + 10);
    const img = sectionImage[sectionKey] ?? texture ?? null;
    if (img) {
      try {
        doc.addImage(img, 0, y, pageW, bandH, undefined, 'FAST');
      } catch {
        /* fall through to solid fill */
      }
      withOpacity(0.82, () => {
        setFill(primary);
        doc.rect(0, y, pageW, bandH, 'F');
      });
    } else {
      setFill(primary);
      doc.rect(0, y, pageW, bandH, 'F');
    }
    // Accent tab on the left edge.
    setFill(accent);
    doc.rect(0, y, 6, bandH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    setText(onPrimary);
    doc.text(title, margin, y + 22);
    y += bandH + 12;
  };

  const caption = (t: string): void => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    setText(muted);
    const lines = doc.splitTextToSize(t, usableW) as string[];
    for (const line of lines) {
      ensure(13);
      doc.text(line, margin, y);
      y += 13;
    }
    y += 4;
  };

  const paragraph = (t: string, size = 12): void => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    setText(text);
    const lines = doc.splitTextToSize(t, usableW) as string[];
    for (const line of lines) {
      ensure(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    }
    y += 6;
  };

  /** Styled table: coloured header, zebra rows, optional highlighted total row. */
  const table = (
    headers: string[],
    rows: string[][],
    aligns: Array<'left' | 'right'> = [],
    opts2: { totalRowIndex?: number } = {}
  ): void => {
    const cols = headers.length;
    const colW = usableW / cols;
    const rowH = 18;
    const drawHeader = (): void => {
      setFill(primary);
      doc.rect(margin, y, usableW, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setText(onPrimary);
      headers.forEach((h, i) => {
        const align = aligns[i] ?? 'left';
        const tx = align === 'right' ? margin + colW * (i + 1) - 4 : margin + colW * i + 4;
        doc.text(h, tx, y + 12, { align });
      });
      y += rowH;
    };
    ensure(rowH * 2);
    drawHeader();
    rows.forEach((row, ri) => {
      if (y + rowH > pageH - margin) {
        doc.addPage();
        y = margin;
        drawHeader();
      }
      const isTotal = opts2.totalRowIndex === ri;
      if (isTotal) {
        setFill(totalFill);
        doc.rect(margin, y, usableW, rowH, 'F');
      } else if (ri % 2 === 1) {
        setFill(zebra);
        doc.rect(margin, y, usableW, rowH, 'F');
      }
      doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
      doc.setFontSize(9);
      setText(text);
      row.forEach((cellText, i) => {
        const align = aligns[i] ?? 'left';
        const tx = align === 'right' ? margin + colW * (i + 1) - 4 : margin + colW * i + 4;
        doc.text(String(cellText), tx, y + 12, { align });
      });
      y += rowH;
    });
    // Thin outer border.
    setDraw(border);
    doc.setLineWidth(0.5);
    y += 10;
  };

  /** A row of KPI cards (styled blocks). */
  const kpiCards = (cards: KpiCardInput[]): void => {
    if (cards.length === 0) return;
    const n = Math.min(cards.length, 3);
    const gap = 10;
    const cardW = (usableW - gap * (n - 1)) / n;
    const cardH = 58;
    ensure(cardH + 10);
    const rowY = y;
    for (let i = 0; i < n; i += 1) {
      const cx = margin + i * (cardW + gap);
      setFill(cardFill);
      doc.roundedRect(cx, rowY, cardW, cardH, 4, 4, 'F');
      setFill(accent);
      doc.rect(cx, rowY + 6, 4, cardH - 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      setText(primary);
      doc.text(cards[i].value, cx + 12, rowY + 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setText(text);
      const label = doc.splitTextToSize(cards[i].label, cardW - 16) as string[];
      doc.text(label[0] ?? cards[i].label, cx + 12, rowY + 46);
    }
    y = rowY + cardH + 14;
  };

  /** Dual-logo lockup on a primary band: white plate + network + client logos. */
  const dualLogo = (bandY: number): void => {
    if (!networkLogo && !clientLogo) return;
    const hasBoth = !!networkLogo && !!clientLogo;
    const plateH = 46;
    const logoBoxW = 130;
    const logoBoxH = 34;
    const gap = 24;
    const totalW = hasBoth ? logoBoxW * 2 + gap : logoBoxW;
    const plateW = totalW + 32;
    const px = (pageW - plateW) / 2;
    const plateY = bandY;
    setFill({ r: 255, g: 255, b: 255 });
    doc.roundedRect(px, plateY, plateW, plateH, 5, 5, 'F');
    const boxY = plateY + (plateH - logoBoxH) / 2;
    const only = networkLogo ?? clientLogo;
    if (!hasBoth && only) {
      drawImageContain(only, (pageW - logoBoxW) / 2, boxY, logoBoxW, logoBoxH);
      return;
    }
    const startX = px + 16;
    if (networkLogo) drawImageContain(networkLogo, startX, boxY, logoBoxW, logoBoxH);
    if (hasBoth) {
      setDraw(border);
      doc.setLineWidth(0.75);
      const dividerX = startX + logoBoxW + gap / 2;
      doc.line(dividerX, plateY + 10, dividerX, plateY + plateH - 10);
    }
    if (clientLogo) drawImageContain(clientLogo, startX + logoBoxW + gap, boxY, logoBoxW, logoBoxH);
  };

  // =========================================================
  // Cover
  // =========================================================
  const coverBandH = 200;
  setFill(primary);
  doc.rect(0, 0, pageW, coverBandH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  setText(onPrimary);
  doc.text(model.meta.campaign || 'Campaign', margin, 70);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text(`${model.meta.advertiser}  ·  ${model.meta.dateFrom} – ${model.meta.dateTo}`, margin, 94);
  doc.setFontSize(10);
  withOpacity(0.85, () => doc.text('Post-Campaign Report', margin, 112));

  if (sample) {
    setFill(accent);
    doc.rect(0, coverBandH, pageW, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setText({ r: 255, g: 255, b: 255 });
    doc.text('SAMPLE DATA — not live-verified', margin, coverBandH + 14);
  }

  // Dual-logo lockup sits inside the cover band.
  dualLogo(coverBandH - 60);
  y = coverBandH + (sample ? 40 : 24);

  // =========================================================
  // Overview (the only prose section)
  // =========================================================
  if (narrative && narrative.overview.trim() !== '') {
    sectionHeader('Campaign overview', 'overview');
    paragraph(narrative.overview.trim(), 12);
  }

  // =========================================================
  // Broadcast delivery
  // =========================================================
  const b = model.broadcast;
  if (b.hasObserved || b.hasAired || b.hasBooked) {
    sectionHeader('Broadcast delivery', 'broadcast');
    const cap = [model.meta.stations.join(' · ') || model.meta.advertiser, `${model.meta.dateFrom} – ${model.meta.dateTo}`].join('  ·  ');
    caption(sample ? `${cap}  ·  Sample data — no live feed connected.` : cap);
    const cols: Array<{ key: 'observed' | 'aired' | 'booked'; label: string }> = [];
    if (b.hasObserved) cols.push({ key: 'observed', label: 'MOTIX observed' });
    if (b.hasAired) cols.push({ key: 'aired', label: 'Aired (log)' });
    if (b.hasBooked) cols.push({ key: 'booked', label: 'Booked (plan)' });
    const headers = ['Daypart', ...cols.map((c) => c.label)];
    const aligns: Array<'left' | 'right'> = ['left', ...cols.map(() => 'right' as const)];
    const rows = b.total.rows.map((r) => [r.daypart, ...cols.map((c) => fmt(r[c.key]))]);
    rows.push(['Total', ...cols.map((c) => fmt(b.total.totals[c.key]))]);
    table(headers, rows, aligns, { totalRowIndex: rows.length - 1 });
  }

  // =========================================================
  // Paid vs bonus (themed table where classified)
  // =========================================================
  const paidOf = (r: (typeof b.total.rows)[number]): number => (r.airedClass?.paid ?? 0) + (r.bookedClass?.paid ?? 0);
  const bonusOf = (r: (typeof b.total.rows)[number]): number => (r.airedClass?.bonus ?? 0) + (r.bookedClass?.bonus ?? 0);
  const classDayparts = b.total.rows.filter((r) => paidOf(r) + bonusOf(r) > 0);
  if (classDayparts.length > 0) {
    sectionHeader('Paid vs bonus', 'broadcast');
    const rows = classDayparts.map((r) => [r.daypart, paidOf(r).toLocaleString('en-AU'), bonusOf(r).toLocaleString('en-AU')]);
    rows.push([
      'Total',
      classDayparts.reduce((s, r) => s + paidOf(r), 0).toLocaleString('en-AU'),
      classDayparts.reduce((s, r) => s + bonusOf(r), 0).toLocaleString('en-AU'),
    ]);
    table(['Daypart', 'Paid', 'Bonus'], rows, ['left', 'right', 'right'], { totalRowIndex: rows.length - 1 });
  }

  // =========================================================
  // Reconciliation
  // =========================================================
  if (model.reconciliation.length > 0) {
    sectionHeader('Booked vs delivered', 'reconciliation');
    const present: string[] = [];
    if (b.hasBooked) present.push('booked plan');
    if (b.hasAired) present.push('aired log');
    if (b.hasObserved) present.push('MOTIX observed');
    caption(`Sources present: ${present.join(', ')}.`);
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

  // =========================================================
  // Media lines
  // =========================================================
  for (const line of model.mediaLines) {
    const entries = Object.entries(line.metrics);
    if (entries.length === 0 && line.placements.length === 0 && line.perPost.length === 0 && line.stateSplit.length === 0) continue;
    const sectionKey = ['streaming', 'podcast', 'social', 'integration'].includes(line.lineType) ? line.lineType : 'overview';
    sectionHeader(`${capitalise(line.lineType)} — ${line.label}`, sectionKey);
    if (line.sourceNote) caption(`Source: ${line.sourceNote}`);

    const kpiLed = line.lineType === 'streaming' || line.lineType === 'podcast';
    let usedKeys = new Set<string>();
    if (kpiLed && entries.length > 0) {
      const picked = pickKpis(line.metrics, line.lineType, 3);
      usedKeys = picked.usedKeys;
      kpiCards(picked.cards);
    }
    const remaining = entries.filter(([k]) => !usedKeys.has(k));
    if (remaining.length > 0) {
      table(['Metric', 'Value'], remaining.map(([k, v]) => [prettyKey(k), v.toLocaleString('en-AU')]), ['left', 'right']);
    }
    if (line.placements.length > 0) {
      table(['Placement', 'Impressions'], line.placements.map((p) => [p.name, p.impressions.toLocaleString('en-AU')]), ['left', 'right']);
    }
    if (line.perPost.length > 0) {
      table(['Post', 'Reach'], line.perPost.map((p) => [p.label, p.reach.toLocaleString('en-AU')]), ['left', 'right']);
    }
    if (line.stateSplit.length > 0) {
      table(['State', '%'], line.stateSplit.map((s) => [s.state, `${s.percent}%`]), ['left', 'right']);
    }
  }

  // =========================================================
  // Audience (KPI-led)
  // =========================================================
  if (model.audience) {
    const a = model.audience;
    sectionHeader('Reach & frequency', 'audience');
    if (a.sourceNote) caption(`Source: ${a.sourceNote}`);
    const picked = pickKpis(a.metrics, 'audience', 3);
    kpiCards(picked.cards);
    const remaining = Object.entries(a.metrics).filter(([k]) => !picked.usedKeys.has(k));
    if (remaining.length > 0 || a.demoLabel) {
      const rows = remaining.map(([k, v]) => [prettyKey(k), v.toLocaleString('en-AU')]);
      if (a.demoLabel) rows.push(['Demographic', a.demoLabel]);
      table(['Metric', 'Value'], rows, ['left', 'right']);
    }
  }

  // =========================================================
  // Notes and gaps (factual, not narrative prose)
  // =========================================================
  const g = model.gaps;
  const gapLines: string[] = [];
  if (g.unresolvedStations.length) gapLines.push(`Unresolved station names: ${g.unresolvedStations.join(', ')}.`);
  if (g.unknownSpotClassRows) gapLines.push(`${g.unknownSpotClassRows} imported row(s) with unknown paid/bonus class.`);
  if (g.excludedDetections) gapLines.push(`${g.excludedDetections} MOTIX detection(s) excluded.`);
  if (g.mediaLinesMissingSource.length) gapLines.push(`Media lines missing a source note: ${g.mediaLinesMissingSource.join(', ')}.`);
  if (g.sampleData) gapLines.push('Broadcast figures are sample data (no live feed connected).');
  if (gapLines.length) {
    sectionHeader('Notes and gaps', 'overview');
    for (const l of gapLines) paragraph(`• ${l}`, 10);
  }

  // =========================================================
  // Closing
  // =========================================================
  doc.addPage();
  const closeImg = sectionImage['closing'] ?? texture ?? null;
  if (closeImg) {
    try {
      doc.addImage(closeImg, 0, 0, pageW, pageH, undefined, 'FAST');
    } catch {
      /* fall through */
    }
    withOpacity(0.85, () => {
      setFill(primary);
      doc.rect(0, 0, pageW, pageH, 'F');
    });
  } else {
    setFill(primary);
    doc.rect(0, 0, pageW, pageH, 'F');
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  setText(onPrimary);
  doc.text('Thank you', pageW / 2, pageH / 2 - 30, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  withOpacity(0.85, () => doc.text(sample ? 'Sample data — not live-verified' : 'Verified by MOTIX', pageW / 2, pageH / 2, { align: 'center' }));
  dualLogo(pageH / 2 + 30);

  return doc.output('blob');
}
