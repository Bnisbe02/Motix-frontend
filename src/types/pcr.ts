/*
  Post-Campaign Report (PCR) domain types.

  These mirror the tables created in the 20260911* migrations exactly.
  Column names are snake_case to match the Supabase rows 1:1 so hooks can
  pass rows through without mapping.
*/

// ------------------------------------------------------------
// Union types (mirror the CHECK constraints)
// ------------------------------------------------------------

export type MediaLineType =
  | 'podcast'
  | 'streaming'
  | 'social'
  | 'integration'
  | 'display'
  | 'activation'
  | 'audience'
  | 'other';

export type AssetType = 'media_plan' | 'screenshot' | 'campaign_image' | 'other';

/** Provenance of a figure: observed by MOTIX, taken from an upload, or typed in. */
export type FigureSource = 'motix_observed' | 'uploaded' | 'manual';

export type ReportStatus = 'draft' | 'generated' | 'exported';

export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT';

// ------------------------------------------------------------
// stations
// ------------------------------------------------------------

export interface Station {
  /** Pipeline identifier, e.g. '2QN_Deniliquin', 'NOVA969'. */
  callsign: string;
  /** Presentation name, e.g. 'Nova 96.9'. */
  display_name: string;
  /** e.g. 'Sydney'. */
  market: string;
  state: AustralianState | string;
  /** IANA timezone, e.g. 'Australia/Sydney'. */
  timezone: string;
  /** e.g. 'Nova Entertainment'. */
  network: string | null;
  is_active: boolean;
  created_at: string;
}

// ------------------------------------------------------------
// brand_kits
// ------------------------------------------------------------

/** A daypart window. Times are 'HH:MM' 24h; '24:00' is allowed as an end. */
export interface Daypart {
  name: string;
  start: string;
  end: string;
}

export interface BrandKit {
  id: string;
  agency_id: string;
  name: string;
  primary_colour: string;
  secondary_colour: string;
  accent_colour: string;
  text_on_primary: string;
  heading_font: string;
  body_font: string;
  /** Object key in bucket 'brand-assets', e.g. 'nova/logo_light.png'. */
  logo_light_path: string | null;
  logo_dark_path: string | null;
  cover_image_path: string | null;
  dayparts: Daypart[];
  created_at: string;
  updated_at: string;
}

/** The user-editable subset of a brand kit (everything the settings form saves). */
export type BrandKitInput = Partial<
  Omit<BrandKit, 'id' | 'agency_id' | 'created_at' | 'updated_at'>
>;

export type BrandAssetKind = 'logo_light' | 'logo_dark' | 'cover_image';

// ------------------------------------------------------------
// pcr_reports
// ------------------------------------------------------------

export interface PcrReport {
  id: string;
  agency_id: string;
  created_by: string;
  advertiser: string;
  campaign_name: string;
  /** ISO date 'YYYY-MM-DD'. */
  date_from: string;
  date_to: string;
  station_callsigns: string[];
  objectives: string | null;
  status: ReportStatus;
  client_logo_path: string | null;
  /** Model-drafted, user-edited copy; filled in Phase 3. */
  narrative: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// pcr_media_lines
// ------------------------------------------------------------

export interface PcrMediaLine {
  id: string;
  report_id: string;
  agency_id: string;
  line_type: MediaLineType;
  /** e.g. 'Nova Podcasts', 'Ben Liam & Belle promo'. */
  label: string;
  /** e.g. { imps_booked: 430005, imps_delivered: 557241 }. */
  metrics: Record<string, number | string | null>;
  source: FigureSource;
  /** e.g. 'GfK Fusion Survey 4 2025'. */
  source_note: string | null;
  sort_order: number;
  created_at: string;
}

// ------------------------------------------------------------
// pcr_assets
// ------------------------------------------------------------

export interface PcrAsset {
  id: string;
  report_id: string;
  agency_id: string;
  asset_type: AssetType;
  /** Object key in bucket 'pcr-assets'. */
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  /** Media plans are versioned, never overwritten. */
  version: number;
  media_line_id: string | null;
  created_at: string;
}

// ------------------------------------------------------------
// Defaults (must match the migration column defaults)
// ------------------------------------------------------------

export const DEFAULT_DAYPARTS: Daypart[] = [
  { name: 'Breakfast', start: '05:30', end: '09:00' },
  { name: 'Morning', start: '09:00', end: '12:00' },
  { name: 'Afternoon', start: '12:00', end: '16:00' },
  { name: 'Drive', start: '16:00', end: '20:00' },
  { name: 'Evening', start: '20:00', end: '22:00' },
  { name: 'Late Evening', start: '22:00', end: '24:00' },
  { name: 'Mid-Dawn', start: '00:00', end: '05:30' },
];

export const DEFAULT_BRAND_KIT: Omit<BrandKit, 'id' | 'agency_id' | 'created_at' | 'updated_at'> = {
  name: 'Default',
  primary_colour: '#5B2C83',
  secondary_colour: '#C8B8A6',
  accent_colour: '#E4002B',
  text_on_primary: '#FFFFFF',
  heading_font: 'Montserrat',
  body_font: 'Calibri',
  logo_light_path: null,
  logo_dark_path: null,
  cover_image_path: null,
  dayparts: DEFAULT_DAYPARTS,
};

export const BRAND_ASSETS_BUCKET = 'brand-assets';
export const PCR_ASSETS_BUCKET = 'pcr-assets';
