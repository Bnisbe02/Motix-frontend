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

export type AssetType =
  | 'media_plan'
  | 'delivery_log'
  | 'screenshot'
  | 'campaign_image'
  | 'other';

/** MOTIX detection event category, from the delivery mirror. */
export type DetectionEventType =
  | 'commercial'
  | 'sponsorship'
  | 'promotion'
  | 'organic_mention';

/** A parsed plan/log row is either a booked line or an aired line. */
export type RowKind = 'booked' | 'aired';

/** Paid vs bonus classification of a spot. Never inferred from detections. */
export type SpotClass = 'paid' | 'bonus' | 'unknown';

/** A JSON-serialisable metric value (scalar, list, or nested object). */
export type MetricValue = number | string | null | MetricValue[] | { [key: string]: MetricValue };
export type MediaMetrics = Record<string, MetricValue>;

/** One named placement row for podcast/streaming/display lines. */
export interface Placement {
  name: string;
  impressions: number | null;
}

/** One per-post reach row for a social line. */
export interface SocialPost {
  label: string;
  reach: number | null;
}

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
  /**
   * Type-dependent metrics. Scalars for figures (imps_booked, total_reach…)
   * and nested structures for state splits and placement/per-post lists.
   * Stored as jsonb. Numbers are stored as numbers, never formatted strings.
   */
  metrics: MediaMetrics;
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

// ------------------------------------------------------------
// Phase 2 — detections (from the delivery mirror), inclusions, plan rows
// ------------------------------------------------------------

/**
 * A MOTIX-observed detection, mapped from a `detections` mirror row into the
 * shape the report builder uses. `localTime`/`localDate`/`daypart` are
 * computed in the resolving station's IANA timezone.
 */
export interface PcrDetection {
  /** The mirror's unique key, as text. */
  id: string;
  /** UTC ISO timestamp from the mirror. */
  tsUtc: string;
  /** Resolved registry callsign, e.g. 'NOVA969'. */
  stationCallsign: string;
  brand: string;
  eventType: DetectionEventType | string;
  durationSec: number | null;
  confidence: number | null;
  confidenceTier: string | null;
  verified: boolean | null;
  /** Station-local 'HH:MM' (24h). */
  localTime: string;
  /** Station-local 'YYYY-MM-DD'. */
  localDate: string;
  /** Daypart name from the brand kit, or 'Unassigned'. */
  daypart: string;
}

/** Per-report include/exclude decision for a detection. */
export interface PcrDetectionInclusion {
  report_id: string;
  agency_id: string;
  detection_id: string;
  included: boolean;
  decided_by: string | null;
  decided_at: string;
}

/** A normalised row parsed from an imported plan (booked) or delivery log (aired). */
export interface PcrPlanRow {
  id: string;
  report_id: string;
  agency_id: string;
  asset_id: string;
  row_kind: RowKind;
  /** Resolved registry callsign, or null if the raw name did not resolve. */
  station_callsign: string | null;
  /** Exactly what the file said. */
  station_raw: string;
  /** Aired rows only: station-local time converted to UTC (ISO). */
  aired_at: string | null;
  /** Booked rows: the booked date 'YYYY-MM-DD'. */
  booked_date: string | null;
  daypart_raw: string | null;
  duration_sec: number | null;
  creative_code: string | null;
  spot_class: SpotClass | null;
  media_value: number | null;
  contract_ref: string | null;
  /**
   * Booked rows: the number of spots the plan line represents (from a total
   * or per-day column). Null for aired rows, where one row is one aired spot.
   */
  spots: number | null;
  /** The original row, untouched. */
  raw: Record<string, unknown>;
  created_at: string;
}

/** Insert payload for a plan row (no server-generated columns). */
export type PcrPlanRowInput = Omit<PcrPlanRow, 'id' | 'created_at'>;
