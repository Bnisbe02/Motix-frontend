import { BrandKit, DEFAULT_BRAND_KIT } from '../../types/pcr';

/*
  deckTheme — the single source of visual truth for the PCR deck.

  Pure and framework/DOM-free (it only imports the BrandKit type). It turns a
  brand kit into a fully-resolved theme: colours (with deterministic tints for
  zebra rows and the total-row highlight), fonts, and a slide geometry system
  (the split-panel master, footer band, KPI cards, logo lockups). Every colour
  and coordinate the generators draw comes from here, so neither pptxGenerator
  nor pdfExport hardcodes a hex or a coordinate inline. Colours come from the
  kit as-is — no network's palette is ever baked in.

  Colours are 6-digit hex WITHOUT a leading '#', matching what PptxGenJS wants;
  toRgb() is provided for jsPDF which wants channel numbers.
*/

// ------------------------------------------------------------
// Colour helpers (pure, deterministic)
// ------------------------------------------------------------

/** Normalise a possibly-#-prefixed colour to a 6-digit uppercase hex, else fallback. */
export function normaliseHex(colour: string | undefined | null, fallback: string): string {
  const c = (colour ?? '').replace('#', '').trim();
  const fb = fallback.replace('#', '').toUpperCase();
  return /^[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : fb;
}

interface Channels {
  r: number;
  g: number;
  b: number;
}

function toChannels(hex: string): Channels {
  const c = normaliseHex(hex, '000000');
  return { r: parseInt(c.slice(0, 2), 16), g: parseInt(c.slice(2, 4), 16), b: parseInt(c.slice(4, 6), 16) };
}

function toHex(ch: Channels): string {
  const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
  const h = (n: number): string => clamp(n).toString(16).padStart(2, '0');
  return (h(ch.r) + h(ch.g) + h(ch.b)).toUpperCase();
}

/**
 * Mix a colour toward white by `amount` in [0,1]. amount=0 is the colour,
 * amount=1 is white. Deterministic — the same inputs always give the same hex.
 */
export function tint(hex: string, amount: number): string {
  const a = Math.max(0, Math.min(1, amount));
  const c = toChannels(hex);
  return toHex({ r: c.r + (255 - c.r) * a, g: c.g + (255 - c.g) * a, b: c.b + (255 - c.b) * a });
}

/**
 * Mix a colour toward black by `amount` in [0,1]. amount=0 is the colour,
 * amount=1 is black. Deterministic.
 */
export function shade(hex: string, amount: number): string {
  const a = Math.max(0, Math.min(1, amount));
  const c = toChannels(hex);
  return toHex({ r: c.r * (1 - a), g: c.g * (1 - a), b: c.b * (1 - a) });
}

/** Channel numbers (0–255) for jsPDF, from a possibly-#-prefixed hex. */
export function toRgb(hex: string): Channels {
  return toChannels(hex);
}

/** Relative luminance (0–1); used to pick readable text over a fill. */
export function luminance(hex: string): number {
  const c = toChannels(hex);
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

/** Return a readable text colour (near-black or near-white) for a background. */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.55 ? '1A1A1A' : 'FFFFFF';
}

// ------------------------------------------------------------
// Geometry
// ------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Slide + layout constants, all in inches (PptxGenJS LAYOUT_WIDE = 13.333×7.5). */
export const GEOM = {
  slideW: 13.333,
  slideH: 7.5,
  margin: 0.5,
  /** Fraction of the slide width taken by the branded panel on a content slide. */
  panelRatio: 0.4,
  /** Inner padding inside the data panel. */
  dataPad: 0.55,
  /** Inner padding inside the branded panel (for the reversed-out title). */
  brandPad: 0.6,
  /** Footer band. */
  footerH: 0.42,
  /** Small network logo in a slide corner. */
  cornerLogo: { w: 1.1, h: 0.5 },
  /** KPI card dimensions and the gap between cards (up to 3 fit the data panel). */
  kpi: { w: 2.05, h: 1.45, gap: 0.25 },
  /** Accent rule under a section title. */
  rule: { w: 1.3, h: 0.07 },
} as const;

// ------------------------------------------------------------
// Theme
// ------------------------------------------------------------

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  textOnPrimary: string;
  /** Dark neutral for body text on white. */
  text: string;
  /** Muted grey for captions / sources. */
  muted: string;
  /** Light primary tint for zebra (alternating) table rows. */
  zebra: string;
  /** Highlight fill for the total row. */
  totalFill: string;
  /** Thin table border colour. */
  border: string;
  /** Panel field colour when no image (solid primary field). */
  panelField: string;
  /** Light neutral card fill. */
  cardFill: string;
}

export interface DeckTheme {
  colors: ThemeColors;
  fonts: { heading: string; body: string };
  geom: typeof GEOM;
}

/** Derive the full deck theme from a brand kit (null → the neutral default kit). */
export function deriveTheme(kit: BrandKit | null): DeckTheme {
  const source = kit ?? DEFAULT_BRAND_KIT;
  const primary = normaliseHex(source.primary_colour, '#5B2C83');
  const secondary = normaliseHex(source.secondary_colour, '#C8B8A6');
  const accent = normaliseHex(source.accent_colour, '#E4002B');
  const textOnPrimary = normaliseHex(source.text_on_primary, '#FFFFFF');

  return {
    colors: {
      primary,
      secondary,
      accent,
      textOnPrimary,
      text: '2A2A2A',
      muted: '7A7A7A',
      // Zebra: a very light primary tint so rows read as banded but stay quiet.
      zebra: tint(primary, 0.9),
      // Total row: a stronger primary tint that clearly highlights the summary.
      totalFill: tint(primary, 0.78),
      border: 'DDDDDD',
      panelField: primary,
      cardFill: tint(primary, 0.94),
    },
    fonts: {
      heading: source.heading_font || 'Montserrat',
      body: source.body_font || 'Calibri',
    },
    geom: GEOM,
  };
}

// ------------------------------------------------------------
// Split-panel geometry
// ------------------------------------------------------------

export interface PanelSplit {
  /** The full-bleed branded field (image or solid colour). */
  brand: Rect;
  /** The data panel (tables / charts / KPI cards on white). */
  data: Rect;
}

/**
 * Two full-height rects: a branded panel on the given side and the data panel
 * filling the rest. `side` is which side the BRANDED panel sits on.
 */
export function panelSplit(theme: DeckTheme, side: 'left' | 'right'): PanelSplit {
  const { slideW, slideH, panelRatio } = theme.geom;
  const brandW = slideW * panelRatio;
  if (side === 'left') {
    return {
      brand: { x: 0, y: 0, w: brandW, h: slideH },
      data: { x: brandW, y: 0, w: slideW - brandW, h: slideH },
    };
  }
  return {
    brand: { x: slideW - brandW, y: 0, w: brandW, h: slideH },
    data: { x: 0, y: 0, w: slideW - brandW, h: slideH },
  };
}

/** The padded content rect inside a panel, leaving room for the footer band. */
export function contentRect(theme: DeckTheme, panel: Rect): Rect {
  const pad = theme.geom.dataPad;
  const footer = theme.geom.footerH;
  return {
    x: panel.x + pad,
    y: panel.y + pad,
    w: panel.w - pad * 2,
    h: panel.h - pad - footer,
  };
}

// ------------------------------------------------------------
// Draw ops — a tiny, framework-free description of shapes/text the generators
// render. Keeps every coordinate and colour in this module.
// ------------------------------------------------------------

export interface DrawShape {
  op: 'shape';
  shape: 'rect' | 'roundRect';
  rect: Rect;
  fill: string;
  transparency?: number;
  line?: { color: string; width: number };
  rectRadius?: number;
}

export interface DrawText {
  op: 'text';
  text: string;
  rect: Rect;
  fontFace: string;
  fontSize: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  transparency?: number;
  lineSpacingMultiple?: number;
}

export type DrawOp = DrawShape | DrawText;

// ------------------------------------------------------------
// Branded panel + section title
// ------------------------------------------------------------

/** Solid colour fallback fill for a branded panel (used when no image resolves). */
export function panelFieldOp(theme: DeckTheme, brand: Rect): DrawShape {
  return { op: 'shape', shape: 'rect', rect: brand, fill: theme.colors.panelField };
}

/**
 * A translucent scrim over a branded panel IMAGE so the reversed-out title
 * stays legible over any photo. Omit when the panel is a solid field.
 */
export function panelScrimOp(theme: DeckTheme, brand: Rect): DrawShape {
  return { op: 'shape', shape: 'rect', rect: brand, fill: shade(theme.colors.primary, 0.15), transparency: 40 };
}

/**
 * The large reversed-out section title (heading font, text-on-primary) plus an
 * accent rule, positioned near the bottom of the branded panel.
 */
export function sectionTitle(theme: DeckTheme, brand: Rect, text: string): DrawOp[] {
  const pad = theme.geom.brandPad;
  const ruleY = brand.y + brand.h - 2.3;
  return [
    {
      op: 'shape',
      shape: 'rect',
      rect: { x: brand.x + pad, y: ruleY, w: theme.geom.rule.w, h: theme.geom.rule.h },
      fill: theme.colors.accent,
    },
    {
      op: 'text',
      text,
      rect: { x: brand.x + pad, y: ruleY + 0.2, w: brand.w - pad * 2, h: 1.8 },
      fontFace: theme.fonts.heading,
      fontSize: 32,
      color: theme.colors.textOnPrimary,
      bold: true,
      align: 'left',
      valign: 'top',
    },
  ];
}

// ------------------------------------------------------------
// Footer band (repeated frame on every content slide)
// ------------------------------------------------------------

/**
 * The footer band: a thin tinted bar carrying the campaign name (left) and the
 * page label (right). The small corner network logo is added by the generator
 * (it is an image, resolved at render time).
 */
export function footerBand(theme: DeckTheme, campaign: string, pageText: string): DrawOp[] {
  const { slideW, slideH, footerH, margin } = theme.geom;
  const y = slideH - footerH;
  return [
    { op: 'shape', shape: 'rect', rect: { x: 0, y, w: slideW, h: footerH }, fill: theme.colors.zebra },
    {
      op: 'text',
      text: campaign,
      rect: { x: margin, y, w: slideW * 0.6, h: footerH },
      fontFace: theme.fonts.body,
      fontSize: 9,
      color: theme.colors.muted,
      align: 'left',
      valign: 'middle',
    },
    {
      op: 'text',
      text: pageText,
      rect: { x: slideW * 0.55 - margin, y, w: slideW * 0.45, h: footerH },
      fontFace: theme.fonts.body,
      fontSize: 9,
      color: theme.colors.muted,
      align: 'right',
      valign: 'middle',
    },
  ];
}

/** Rect for the small network logo in the top corner of the data panel. */
export function cornerLogoRect(theme: DeckTheme, data: Rect): Rect {
  const { cornerLogo, dataPad } = theme.geom;
  return {
    x: data.x + data.w - cornerLogo.w - dataPad,
    y: data.y + dataPad * 0.6,
    w: cornerLogo.w,
    h: cornerLogo.h,
  };
}

// ------------------------------------------------------------
// Caption (neutral factual line under content)
// ------------------------------------------------------------

export function captionOp(theme: DeckTheme, rect: Rect, text: string): DrawText {
  return {
    op: 'text',
    text,
    rect,
    fontFace: theme.fonts.body,
    fontSize: 11,
    color: theme.colors.muted,
    italic: true,
    align: 'left',
    valign: 'top',
  };
}

// ------------------------------------------------------------
// Table style
// ------------------------------------------------------------

export interface TableStyle {
  headerFill: string;
  headerColor: string;
  zebraFill: string;
  bodyColor: string;
  totalFill: string;
  totalColor: string;
  border: { type: 'solid'; pt: number; color: string };
  fontFace: string;
  headerFontSize: number;
  bodyFontSize: number;
}

/** All tokens needed to style a native PptxGenJS table from the theme. */
export function tableStyle(theme: DeckTheme): TableStyle {
  return {
    headerFill: theme.colors.primary,
    headerColor: theme.colors.textOnPrimary,
    zebraFill: theme.colors.zebra,
    bodyColor: theme.colors.text,
    totalFill: theme.colors.totalFill,
    totalColor: readableOn(theme.colors.totalFill),
    border: { type: 'solid', pt: 0.5, color: theme.colors.border },
    fontFace: theme.fonts.body,
    headerFontSize: 11,
    bodyFontSize: 11,
  };
}

// ------------------------------------------------------------
// KPI cards
// ------------------------------------------------------------

export interface KpiCardInput {
  label: string;
  value: string;
  note?: string;
}

/** Left-edge x positions for `count` KPI cards laid out from `origin`. */
export function kpiRow(theme: DeckTheme, origin: { x: number; y: number }, count: number): Rect[] {
  const { w, h, gap } = theme.geom.kpi;
  const rects: Rect[] = [];
  for (let i = 0; i < count; i += 1) {
    rects.push({ x: origin.x + i * (w + gap), y: origin.y, w, h });
  }
  return rects;
}

/** Rects for a vertical stack of `count` KPI cards from `origin`. */
export function kpiStack(theme: DeckTheme, origin: { x: number; y: number }, count: number, width: number): Rect[] {
  const { h, gap } = theme.geom.kpi;
  const rects: Rect[] = [];
  for (let i = 0; i < count; i += 1) {
    rects.push({ x: origin.x, y: origin.y + i * (h + gap), w: width, h });
  }
  return rects;
}

/**
 * Draw ops for one KPI card at `rect`: a tinted rounded panel with an accent
 * left edge, the big value (heading font, primary), the label, and an optional
 * note line.
 */
export function kpiCard(theme: DeckTheme, rect: Rect, input: KpiCardInput): DrawOp[] {
  const ops: DrawOp[] = [
    {
      op: 'shape',
      shape: 'roundRect',
      rect,
      fill: theme.colors.cardFill,
      line: { color: theme.colors.border, width: 1 },
      rectRadius: 0.06,
    },
    // Accent bar down the left edge of the card.
    {
      op: 'shape',
      shape: 'rect',
      rect: { x: rect.x, y: rect.y + 0.12, w: 0.08, h: rect.h - 0.24 },
      fill: theme.colors.accent,
    },
    {
      op: 'text',
      text: input.value,
      rect: { x: rect.x + 0.25, y: rect.y + 0.18, w: rect.w - 0.35, h: rect.h * 0.5 },
      fontFace: theme.fonts.heading,
      fontSize: 26,
      color: theme.colors.primary,
      bold: true,
      align: 'left',
      valign: 'middle',
    },
    {
      op: 'text',
      text: input.label,
      rect: { x: rect.x + 0.25, y: rect.y + rect.h * 0.62, w: rect.w - 0.35, h: rect.h * 0.24 },
      fontFace: theme.fonts.body,
      fontSize: 11,
      color: theme.colors.text,
      align: 'left',
      valign: 'top',
    },
  ];
  if (input.note && input.note.trim() !== '') {
    ops.push({
      op: 'text',
      text: input.note,
      rect: { x: rect.x + 0.25, y: rect.y + rect.h * 0.83, w: rect.w - 0.35, h: rect.h * 0.16 },
      fontFace: theme.fonts.body,
      fontSize: 8,
      color: theme.colors.muted,
      align: 'left',
      valign: 'top',
    });
  }
  return ops;
}

// ------------------------------------------------------------
// KPI metric selection (shared by the PPTX and PDF generators)
// ------------------------------------------------------------

/** Ordered preferred KPI metrics per line type: [key, display label]. */
export const KPI_PREFERENCE: Record<string, Array<{ key: string; label: string }>> = {
  streaming: [
    { key: 'imps_booked', label: 'Impressions booked' },
    { key: 'imps_delivered', label: 'Impressions delivered' },
    { key: 'unique_users', label: 'Unique users' },
    { key: 'completed_views', label: 'Completed views' },
  ],
  podcast: [
    { key: 'imps_booked', label: 'Impressions booked' },
    { key: 'imps_delivered', label: 'Impressions delivered' },
    { key: 'downloads', label: 'Downloads' },
    { key: 'unique_users', label: 'Unique listeners' },
  ],
  audience: [
    { key: 'reach_1plus', label: 'Reach 1+' },
    { key: 'reach_3plus', label: 'Reach 3+' },
    { key: 'avg_frequency', label: 'Avg frequency' },
    { key: 'gross_impacts', label: 'Gross impacts' },
  ],
};

function prettyKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Pick up to `max` KPI cards for a metric bag, preferring the line type's
 * ordered keys and falling back to any remaining metrics so the row is never
 * empty. Returns the cards and the set of metric keys they consumed.
 */
export function pickKpis(
  metrics: Record<string, number>,
  lineType: string,
  max = 3
): { cards: KpiCardInput[]; usedKeys: Set<string> } {
  const usedKeys = new Set<string>();
  const cards: KpiCardInput[] = [];
  const preferred = KPI_PREFERENCE[lineType] ?? [];
  for (const p of preferred) {
    if (cards.length >= max) break;
    if (metrics[p.key] !== undefined) {
      cards.push({ label: p.label, value: metrics[p.key].toLocaleString('en-AU') });
      usedKeys.add(p.key);
    }
  }
  if (cards.length < max) {
    for (const [k, v] of Object.entries(metrics)) {
      if (cards.length >= max) break;
      if (usedKeys.has(k)) continue;
      cards.push({ label: prettyKey(k), value: v.toLocaleString('en-AU') });
      usedKeys.add(k);
    }
  }
  return { cards, usedKeys };
}

// ------------------------------------------------------------
// Dual-logo lockup (cover + closing)
// ------------------------------------------------------------

export interface LogoLockup {
  /** Rect for the network logo. */
  network: Rect;
  /** Rect for the client logo (null when there is no client logo). */
  client: Rect | null;
  /** Thin divider between the two logos (null when the client logo is absent). */
  divider: Rect | null;
}

/**
 * A balanced two-logo lockup centred within `area`. With a client logo the two
 * sit side by side around a divider; without one the network logo is centred
 * alone (no empty box).
 */
export function logoLockup(area: Rect, hasClient: boolean): LogoLockup {
  const logoW = 2.4;
  const logoH = 1.0;
  const cy = area.y + (area.h - logoH) / 2;
  if (!hasClient) {
    return {
      network: { x: area.x + (area.w - logoW) / 2, y: cy, w: logoW, h: logoH },
      client: null,
      divider: null,
    };
  }
  const gap = 0.5;
  const totalW = logoW * 2 + gap;
  const startX = area.x + (area.w - totalW) / 2;
  return {
    network: { x: startX, y: cy, w: logoW, h: logoH },
    client: { x: startX + logoW + gap, y: cy, w: logoW, h: logoH },
    divider: { x: startX + logoW + gap / 2 - 0.005, y: cy + 0.1, w: 0.01, h: logoH - 0.2 },
  };
}
