import {
  PcrDetection,
  Daypart,
  DetectionEventType,
  AustralianState,
} from '../types/pcr';
import { assignDaypart, UNASSIGNED_DAYPART } from '../utils/dayparts';

/*
  Pure PCR metrics helpers — no Supabase, no network, all unit-tested.

  Kept out of pcrDetections.ts (which imports the Supabase client) so these
  can be imported by tests and by components without pulling in the client.
*/

// ------------------------------------------------------------
// Station-local time formatting
// ------------------------------------------------------------

export interface LocalStamp {
  localDate: string; // 'YYYY-MM-DD'
  localTime: string; // 'HH:MM' 24h
}

/**
 * Format a UTC ISO timestamp into a station-local date and time using the
 * given IANA timezone. Uses Intl only (no date library). Returns empty
 * strings if the timestamp is unparseable.
 */
export function formatInTimeZone(tsUtc: string, timeZone: string): LocalStamp {
  const date = new Date(tsUtc);
  if (Number.isNaN(date.getTime())) {
    return { localDate: '', localTime: '' };
  }
  let parts: Intl.DateTimeFormatPart[];
  try {
    const dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    parts = dtf.formatToParts(date);
  } catch {
    // Invalid timezone: fall back to UTC.
    const dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    parts = dtf.formatToParts(date);
  }
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  // hour12:false yields '24' for midnight in some engines; normalise to '00'.
  let hour = get('hour');
  if (hour === '24') hour = '00';
  const minute = get('minute');
  return {
    localDate: `${year}-${month}-${day}`,
    localTime: `${hour}:${minute}`,
  };
}

function tzPartsOf(instant: Date, timeZone: string): { y: number; mo: number; d: number; h: number; mi: number } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(instant);
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? '0');
  let h = get('hour');
  if (h === 24) h = 0;
  return { y: get('year'), mo: get('month'), d: get('day'), h, mi: get('minute') };
}

/**
 * Convert a wall-clock time expressed in `timeZone` to a UTC ISO string using
 * the standard offset trick (no date library). Handles DST for the instant.
 */
export function zonedWallTimeToUtcISO(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): string {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = target;
  try {
    // Iterate: re-derive the offset at the corrected instant, so a wall time
    // near a DST transition (where the offset at the initial guess differs
    // from the offset at the true instant) still resolves correctly. Two
    // passes converge for every non-ambiguous local time.
    for (let i = 0; i < 2; i += 1) {
      const v = tzPartsOf(new Date(utc), timeZone);
      const viewAsUtc = Date.UTC(v.y, v.mo - 1, v.d, v.h, v.mi, second);
      const error = viewAsUtc - target;
      if (error === 0) break;
      utc -= error;
    }
  } catch {
    return new Date(target).toISOString();
  }
  return new Date(utc).toISOString();
}

// ------------------------------------------------------------
// Raw detection row -> PcrDetection (pure)
// ------------------------------------------------------------

/** The column-name map shape (from pcrDetections DETECTION_COLUMNS). */
export interface DetectionColumnMap {
  id: string;
  tsUtc: string;
  station: string;
  brand: string;
  eventType: string;
  durationSec: string;
  confidence: string;
  confidenceTier: string;
  verified: string;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBoolOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 't' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 'f' || value === 0 || value === '0') return false;
  return null;
}

/**
 * Map a raw mirror row into a PcrDetection, given the column map, the resolved
 * registry callsign and the station's IANA timezone and the brand kit
 * dayparts. Pure: the caller does station resolution and passes the result in.
 */
export function mapDetectionRow(
  row: Record<string, unknown>,
  cols: DetectionColumnMap,
  stationCallsign: string,
  timeZone: string,
  dayparts: Daypart[]
): PcrDetection {
  const tsUtc = String(row[cols.tsUtc] ?? '');
  const { localDate, localTime } = formatInTimeZone(tsUtc, timeZone);
  return {
    id: String(row[cols.id] ?? ''),
    tsUtc,
    stationCallsign,
    brand: String(row[cols.brand] ?? ''),
    eventType: (row[cols.eventType] as DetectionEventType) ?? 'commercial',
    durationSec: toNumberOrNull(row[cols.durationSec]),
    confidence: toNumberOrNull(row[cols.confidence]),
    confidenceTier: row[cols.confidenceTier] != null ? String(row[cols.confidenceTier]) : null,
    verified: toBoolOrNull(row[cols.verified]),
    localTime,
    localDate,
    daypart: localTime ? assignDaypart(localTime, dayparts) : UNASSIGNED_DAYPART,
  };
}

// ------------------------------------------------------------
// Summarise (pure)
// ------------------------------------------------------------

export interface DetectionSummary {
  total: number;
  byStation: Record<string, number>;
  byDaypart: Record<string, number>;
  byEventType: Record<string, number>;
}

/**
 * Count included detections by station, daypart and event type.
 * `inclusions` maps detection id -> included; a detection absent from the map
 * defaults to included (the builder defaults new detections to included=true).
 */
export function summariseDetections(
  detections: PcrDetection[],
  inclusions: Record<string, boolean> = {}
): DetectionSummary {
  const summary: DetectionSummary = {
    total: 0,
    byStation: {},
    byDaypart: {},
    byEventType: {},
  };
  for (const d of detections) {
    const included = inclusions[d.id] ?? true;
    if (!included) continue;
    summary.total += 1;
    summary.byStation[d.stationCallsign] = (summary.byStation[d.stationCallsign] ?? 0) + 1;
    summary.byDaypart[d.daypart] = (summary.byDaypart[d.daypart] ?? 0) + 1;
    const et = String(d.eventType);
    summary.byEventType[et] = (summary.byEventType[et] ?? 0) + 1;
  }
  return summary;
}

// ------------------------------------------------------------
// State split validation (pure)
// ------------------------------------------------------------

export const STATE_SPLIT_KEYS: Array<AustralianState | 'Other'> = [
  'NSW',
  'VIC',
  'QLD',
  'SA',
  'WA',
  'Other',
];

export interface StateSplitValidation {
  sum: number;
  isValid: boolean;
  error: string | null;
}

/**
 * A state split must sum to 100 (percent). Empty/all-zero is treated as
 * "not provided" and is valid (optional). A small float tolerance is allowed.
 */
export function validateStateSplit(
  split: Partial<Record<AustralianState | 'Other', number>>
): StateSplitValidation {
  const values = STATE_SPLIT_KEYS.map((k) => {
    const v = split[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    return { sum: 0, isValid: true, error: null }; // not provided
  }
  if (values.some((v) => v < 0)) {
    return { sum, isValid: false, error: 'State percentages cannot be negative.' };
  }
  if (Math.abs(sum - 100) > 0.5) {
    return {
      sum,
      isValid: false,
      error: `State split must sum to 100% (currently ${sum.toFixed(1)}%).`,
    };
  }
  return { sum, isValid: true, error: null };
}
