import { supabase } from './supabase';
import { PcrDetection, Station, Daypart } from '../types/pcr';
import {
  DetectionColumnMap,
  mapDetectionRow,
  zonedWallTimeToUtcISO,
} from './pcrMetrics';
import { buildStationIndex, resolveStation } from './stationResolve';

/*
  MOTIX detection adapter.

  This is the ONE file that knows the shape of the Supabase `detections`
  delivery mirror (populated by the OVH backend, delivered rows only). Every
  column name lives in DETECTION_COLUMNS so a schema correction is a one-file
  change.

  !!! TODO(mirror-schema) — UNVERIFIED ASSUMED SHAPE !!!
  As of Phase 2 the `detections` table does NOT exist in the pilot Supabase
  project (project kgvsfxtfylqgvlppavvb; public schema holds only access_log,
  chat_usage, contact_submissions, data_requests). The map below is the
  ASSUMED shape from the task brief, not verified against real rows. When the
  OVH -> Supabase sync creates and populates `detections`, re-run the Part B0
  discovery queries (see docs/PCR_PHASE2.md) and correct DETECTION_COLUMNS,
  the eventType values, and the station form (callsign vs display name) here.
*/
export const DETECTION_COLUMNS: DetectionColumnMap = {
  id: 'detection_id',
  tsUtc: 'ts_utc',
  station: 'station', // assumed callsign form, matching stations.callsign
  brand: 'brand',
  eventType: 'commercial_event_type', // 'commercial' | 'sponsorship' | 'promotion' | 'organic_mention'
  durationSec: 'duration_sec',
  confidence: 'confidence',
  confidenceTier: 'confidence_tier',
  verified: 'verified',
} as const;

export interface FetchDetectionsParams {
  advertiser: string;
  dateFrom: string; // 'YYYY-MM-DD'
  dateTo: string; // 'YYYY-MM-DD'
  stationCallsigns: string[];
  /** Registry rows (for timezones + station resolution). */
  stations: Station[];
  /** Brand kit dayparts, for daypart assignment. */
  dayparts: Daypart[];
}

export interface FetchDetectionsResult {
  detections: PcrDetection[];
  /** Mirror station values that did not resolve to a registry callsign. */
  unresolvedStations: string[];
  /** Non-null when the query failed or the mirror is absent. Never thrown. */
  error: string | null;
  /** True when the detections table itself is missing (mirror not yet synced). */
  mirrorMissing: boolean;
  /** Which source produced these rows, so the UI can label sample data. */
  source: DetectionSource;
}

export type DetectionSource = 'mock' | 'mirror';

/**
 * The active detection source. Defaults to 'mock' until the OVH -> Supabase
 * sync exists; flip VITE_PCR_DETECTION_SOURCE=mirror to use the real query.
 */
export function getDetectionSource(): DetectionSource {
  return import.meta.env.VITE_PCR_DETECTION_SOURCE === 'mirror' ? 'mirror' : 'mock';
}

/**
 * Compute the UTC window that covers the report's local dates across every
 * selected station timezone: the earliest local midnight of dateFrom and the
 * latest end-of-day of dateTo. Falls back to plain UTC bounds if no stations.
 */
function utcBounds(
  dateFrom: string,
  dateTo: string,
  timezones: string[]
): { minUtc: string; maxUtc: string } {
  const [fy, fm, fd] = dateFrom.split('-').map(Number);
  const [ty, tm, td] = dateTo.split('-').map(Number);
  if (timezones.length === 0) {
    return {
      minUtc: new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0)).toISOString(),
      maxUtc: new Date(Date.UTC(ty, tm - 1, td, 23, 59, 59)).toISOString(),
    };
  }
  let minUtc = Infinity;
  let maxUtc = -Infinity;
  for (const tz of timezones) {
    const start = new Date(zonedWallTimeToUtcISO(fy, fm, fd, 0, 0, 0, tz)).getTime();
    const end = new Date(zonedWallTimeToUtcISO(ty, tm, td, 23, 59, 59, tz)).getTime();
    if (start < minUtc) minUtc = start;
    if (end > maxUtc) maxUtc = end;
  }
  return { minUtc: new Date(minUtc).toISOString(), maxUtc: new Date(maxUtc).toISOString() };
}

function isMissingTableError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('does not exist') ||
    m.includes('could not find the table') ||
    m.includes('schema cache') ||
    m.includes('relation') ||
    m.includes('pgrst205')
  );
}

/**
 * Fetch MOTIX-observed detections for an advertiser / date range / station
 * set from the Supabase mirror, mapped into PcrDetection with station-local
 * time and daypart. Never throws — failures come back in `error`.
 */
export async function fetchDetections(
  params: FetchDetectionsParams
): Promise<FetchDetectionsResult> {
  const { advertiser, dateFrom, dateTo, stationCallsigns, stations, dayparts } = params;

  const source = getDetectionSource();
  const empty: FetchDetectionsResult = {
    detections: [],
    unresolvedStations: [],
    error: null,
    mirrorMissing: false,
    source,
  };

  const trimmed = advertiser.trim();
  if (trimmed === '' || stationCallsigns.length === 0) {
    return empty;
  }

  // Mock source: dynamically import so it tree-shakes out under 'mirror'.
  if (source === 'mock') {
    try {
      const { generateMockDetections } = await import('./pcrDetections.mock');
      const detections = generateMockDetections({
        advertiser: trimmed,
        dateFrom,
        dateTo,
        stationCallsigns,
        stations,
        dayparts,
      });
      return { detections, unresolvedStations: [], error: null, mirrorMissing: false, source };
    } catch (err) {
      return {
        detections: [],
        unresolvedStations: [],
        error: err instanceof Error ? err.message : 'Failed to load sample detections',
        mirrorMissing: false,
        source,
      };
    }
  }

  const index = buildStationIndex(stations);
  const tzByCallsign: Record<string, string> = {};
  for (const s of stations) tzByCallsign[s.callsign] = s.timezone;
  const selectedTimezones = stationCallsigns
    .map((cs) => tzByCallsign[cs])
    .filter((tz): tz is string => Boolean(tz));

  const { minUtc, maxUtc } = utcBounds(dateFrom, dateTo, selectedTimezones);

  const columns = Object.values(DETECTION_COLUMNS).join(',');
  const PAGE = 1000;

  try {
    // Page through the full result set rather than truncating at a fixed cap,
    // so long or many-station campaigns are never silently cut off.
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('detections')
        .select(columns)
        .ilike(DETECTION_COLUMNS.brand, `%${trimmed}%`)
        .gte(DETECTION_COLUMNS.tsUtc, minUtc)
        .lte(DETECTION_COLUMNS.tsUtc, maxUtc)
        .in(DETECTION_COLUMNS.station, stationCallsigns)
        .order(DETECTION_COLUMNS.tsUtc, { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) {
        const mirrorMissing = isMissingTableError(error.message);
        return {
          detections: [],
          unresolvedStations: [],
          error: mirrorMissing
            ? 'The MOTIX detections mirror is not available yet for this workspace.'
            : error.message,
          mirrorMissing,
          source,
        };
      }
      const page = (data ?? []) as unknown as Record<string, unknown>[];
      rows.push(...page);
      if (page.length < PAGE) break;
    }

    const unresolved = new Set<string>();
    const detections: PcrDetection[] = rows.map((row) => {
      const rawStation = String(row[DETECTION_COLUMNS.station] ?? '');
      const callsign = resolveStation(rawStation, index);
      if (!callsign) unresolved.add(rawStation);
      const tz = callsign ? tzByCallsign[callsign] ?? 'UTC' : 'UTC';
      return mapDetectionRow(row, DETECTION_COLUMNS, callsign ?? rawStation, tz, dayparts);
    });

    return {
      detections,
      unresolvedStations: Array.from(unresolved),
      error: null,
      mirrorMissing: false,
      source,
    };
  } catch (err) {
    return {
      detections: [],
      unresolvedStations: [],
      error: err instanceof Error ? err.message : 'Failed to load detections',
      mirrorMissing: false,
      source,
    };
  }
}

/**
 * Distinct advertiser (brand) suggestions from the mirror, for the Step 1
 * advertiser autocomplete. Returns [] on any error (including mirror absent).
 */
export async function fetchAdvertiserSuggestions(prefix: string, limit = 20): Promise<string[]> {
  const trimmed = prefix.trim();
  if (getDetectionSource() === 'mock') {
    const { MOCK_ADVERTISER } = await import('./pcrDetections.mock');
    return trimmed === '' || MOCK_ADVERTISER.toLowerCase().includes(trimmed.toLowerCase())
      ? [MOCK_ADVERTISER]
      : [];
  }
  try {
    let query = supabase
      .from('detections')
      .select(DETECTION_COLUMNS.brand)
      .limit(500);
    if (trimmed !== '') {
      query = query.ilike(DETECTION_COLUMNS.brand, `%${trimmed}%`);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    const seen = new Set<string>();
    for (const row of data as unknown as Record<string, unknown>[]) {
      const brand = String(row[DETECTION_COLUMNS.brand] ?? '').trim();
      if (brand) seen.add(brand);
      if (seen.size >= limit) break;
    }
    return Array.from(seen).slice(0, limit);
  } catch {
    return [];
  }
}
