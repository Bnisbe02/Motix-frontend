import * as XLSX from 'xlsx';
import { RowKind, SpotClass } from '../types/pcr';
import { StationResolveIndex, resolveStation } from './stationResolve';
import { zonedWallTimeToUtcISO } from './pcrMetrics';

/*
  Shared tabular import — CSV and XLSX parsing, header auto-mapping, station
  resolution, spot-class inference and aired-timestamp construction.

  Used by both the legacy BookingUploadModal (CSV bookings) and the new
  PlanImporter (booked plans and aired delivery logs). The pure functions
  here are unit-tested; only readWorkbookFile touches the File/ArrayBuffer API.
*/

export interface TabularData {
  headers: string[];
  rows: string[][];
}

// ------------------------------------------------------------
// Parsing
// ------------------------------------------------------------

/**
 * Parse delimited text (CSV/TSV) into headers + rows. Handles quoted fields
 * containing the delimiter and doubled quotes. Blank trailing lines dropped.
 */
export function parseDelimitedText(text: string, delimiter = ','): TabularData {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const pushField = (): void => {
    row.push(field);
    field = '';
  };
  const pushRow = (): void => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === '\n') {
      pushRow();
    } else if (ch === '\r') {
      // ignore; \n handles the row break
    } else {
      field += ch;
    }
  }
  // flush last field/row if any content
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim().length > 0));
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = nonEmpty[0].map((h) => h.trim());
  return { headers, rows: nonEmpty.slice(1) };
}

export interface WorkbookHandle {
  sheetNames: string[];
  readSheet: (sheetName: string) => TabularData;
}

/** Read an XLSX/XLS/CSV ArrayBuffer into a workbook handle with sheet access. */
export function readWorkbook(data: ArrayBuffer): WorkbookHandle {
  const wb = XLSX.read(data, { type: 'array' });
  return {
    sheetNames: wb.SheetNames,
    readSheet: (sheetName: string): TabularData => {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) return { headers: [], rows: [] };
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: false,
      });
      const stringMatrix = matrix.map((r) => (r as unknown[]).map((c) => String(c ?? '')));
      const nonEmpty = stringMatrix.filter((r) => r.some((c) => c.trim().length > 0));
      if (nonEmpty.length === 0) return { headers: [], rows: [] };
      return { headers: nonEmpty[0].map((h) => h.trim()), rows: nonEmpty.slice(1) };
    },
  };
}

/** Read a File (browser) into a workbook handle. */
export async function readWorkbookFile(file: File): Promise<WorkbookHandle> {
  const buffer = await file.arrayBuffer();
  return readWorkbook(buffer);
}

// ------------------------------------------------------------
// Header auto-mapping
// ------------------------------------------------------------

export interface MapTarget {
  key: string;
  label: string;
  required: boolean;
  /** Header synonyms, matched after normalisation. */
  synonyms: string[];
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Auto-map file headers to target keys. Exact normalised match wins; a
 * contains-match is the fallback. Each header maps to at most one target and
 * each target to at most one header.
 */
export function autoMapColumns(
  headers: string[],
  targets: MapTarget[]
): Record<string, string | null> {
  const normHeaders = headers.map((h) => ({ raw: h, norm: normaliseHeader(h) }));
  const used = new Set<string>();
  const mapping: Record<string, string | null> = {};

  // Pass 1: exact matches.
  for (const t of targets) {
    const syns = t.synonyms.map(normaliseHeader);
    const hit = normHeaders.find((h) => !used.has(h.raw) && syns.includes(h.norm));
    if (hit) {
      mapping[t.key] = hit.raw;
      used.add(hit.raw);
    } else {
      mapping[t.key] = null;
    }
  }
  // Pass 2: contains matches for still-unmapped targets.
  for (const t of targets) {
    if (mapping[t.key]) continue;
    const syns = t.synonyms.map(normaliseHeader);
    const hit = normHeaders.find(
      (h) => !used.has(h.raw) && syns.some((s) => h.norm.includes(s) || s.includes(h.norm))
    );
    if (hit) {
      mapping[t.key] = hit.raw;
      used.add(hit.raw);
    }
  }
  return mapping;
}

export const AIRED_TARGETS: MapTarget[] = [
  { key: 'station', label: 'Station', required: true, synonyms: ['station', 'stn'] },
  { key: 'airedDateTime', label: 'Aired date+time', required: false, synonyms: ['aireddatetime', 'datetime', 'airedtimestamp', 'timestamp'] },
  { key: 'airedDate', label: 'Aired date', required: false, synonyms: ['aireddate', 'airdate', 'date'] },
  { key: 'airedTime', label: 'Aired time', required: false, synonyms: ['airedtime', 'airtime', 'time'] },
  { key: 'daypart', label: 'Daypart', required: false, synonyms: ['daypart', 'part'] },
  { key: 'duration', label: 'Duration (sec)', required: false, synonyms: ['aireddur', 'duration', 'dur', 'length', 'airedduration', 'spotlength'] },
  { key: 'creativeCode', label: 'Creative code', required: false, synonyms: ['media', 'creative', 'creativecode', 'creativeid', 'cut', 'copy'] },
  { key: 'mediaValue', label: 'Media value', required: false, synonyms: ['mediavalue', 'value', 'cost', 'net', 'gross', 'rate', 'amount'] },
  { key: 'contract', label: 'Contract', required: false, synonyms: ['contract', 'contractref', 'contractnumber', 'contractno', 'bookingref'] },
];

export const BOOKED_TARGETS: MapTarget[] = [
  { key: 'station', label: 'Station', required: true, synonyms: ['station', 'stn'] },
  { key: 'bookedDate', label: 'Date', required: false, synonyms: ['bookeddate', 'date', 'airdate'] },
  { key: 'dateStart', label: 'Start date', required: false, synonyms: ['startdate', 'from', 'start'] },
  { key: 'dateEnd', label: 'End date', required: false, synonyms: ['enddate', 'to', 'end'] },
  { key: 'totalSpots', label: 'Total spots', required: false, synonyms: ['totalspots', 'spots', 'numberofspots', 'nospots', 'qty', 'quantity'] },
  { key: 'spotsPerDay', label: 'Spots per day', required: false, synonyms: ['spotsperday', 'perday', 'dailyspots'] },
  { key: 'daypart', label: 'Daypart', required: false, synonyms: ['daypart', 'part'] },
  { key: 'duration', label: 'Duration (sec)', required: false, synonyms: ['duration', 'dur', 'length', 'spotlength'] },
  { key: 'creativeCode', label: 'Creative code', required: false, synonyms: ['media', 'creative', 'creativecode', 'creativeid', 'cut', 'copy'] },
  { key: 'mediaValue', label: 'Media value', required: false, synonyms: ['mediavalue', 'value', 'cost', 'net', 'gross', 'rate', 'amount'] },
];

// ------------------------------------------------------------
// Spot-class detection and inference
// ------------------------------------------------------------

/**
 * Detect a spot-class column by scanning values: a column whose non-empty
 * values are all 'paid'/'bonus' (case-insensitive) is the spot-class column.
 * Returns the header name or null. This implements the rule "if a column
 * contains 'bonus'/'paid' use it" without relying on the header name.
 */
export function detectSpotClassColumn(data: TabularData): string | null {
  for (let c = 0; c < data.headers.length; c += 1) {
    let sawSignal = false;
    let allMatch = true;
    for (const row of data.rows) {
      const v = (row[c] ?? '').trim().toLowerCase();
      if (v === '') continue;
      if (v.includes('paid') || v.includes('bonus')) {
        sawSignal = true;
      } else {
        allMatch = false;
        break;
      }
    }
    if (sawSignal && allMatch) {
      return data.headers[c];
    }
  }
  return null;
}

/**
 * Classify a spot. Explicit 'paid'/'bonus' text wins; otherwise a zero media
 * value means bonus; anything else is unknown (never guess paid from a
 * positive value — that is surfaced for the user to confirm).
 */
export function inferSpotClass(explicitValue: string | null | undefined, mediaValue: number | null): SpotClass {
  if (explicitValue) {
    const v = explicitValue.toLowerCase();
    if (v.includes('bonus')) return 'bonus';
    if (v.includes('paid')) return 'paid';
  }
  if (mediaValue === 0) return 'bonus';
  return 'unknown';
}

// ------------------------------------------------------------
// Value parsing
// ------------------------------------------------------------

/** Parse a currency/number string like '$1,250.00' or '1250' into a number, or null. */
export function parseNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parse an integer of seconds; supports 'MM:SS' and 'HH:MM:SS' durations too. */
export function parseDurationSec(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === '') return null;
  if (s.includes(':')) {
    const parts = s.split(':').map((p) => Number(p));
    if (parts.some((p) => !Number.isFinite(p))) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }
  const n = parseNumber(s);
  return n === null ? null : Math.round(n);
}

/** Parse a date in DD/MM/YYYY, D/M/YYYY, YYYY-MM-DD or YYYY/MM/DD into 'YYYY-MM-DD', or null. */
export function parseFlexibleDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (s === '') return null;
  // ISO first
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // DD/MM/YYYY (Australian) or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    const [, d, mo, yRaw] = m;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

/** Parse a time 'HH:MM', 'HH:MM:SS', or 'H:MM AM/PM' into { h, m, s } 24h, or null. */
export function parseFlexibleTime(value: string | null | undefined): { h: number; m: number; s: number } | null {
  if (!value) return null;
  const s = String(value).trim();
  if (s === '') return null;
  const ampm = s.match(/(am|pm)\s*$/i);
  const core = s.replace(/\s*(am|pm)\s*$/i, '');
  const parts = core.split(':').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  let h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const sec = parts[2] ?? 0;
  if (ampm) {
    const pm = ampm[1].toLowerCase() === 'pm';
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m, s: sec };
}

// ------------------------------------------------------------
// Aired timestamp: local wall time in a station tz -> UTC ISO
// ------------------------------------------------------------

/**
 * Convert a station-local wall-clock (date + time interpreted in `timeZone`)
 * to a UTC ISO timestamp. Returns null if either part is unparseable. The
 * timezone maths lives in pcrMetrics (shared with the detection adapter).
 */
export function combineAiredTimestamp(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined,
  timeZone: string
): string | null {
  const date = parseFlexibleDate(dateStr);
  const time = parseFlexibleTime(timeStr);
  if (!date || !time) return null;
  const [y, mo, d] = date.split('-').map(Number);
  return zonedWallTimeToUtcISO(y, mo, d, time.h, time.m, time.s, timeZone);
}

// ------------------------------------------------------------
// Normalise a mapped file into plan rows (pure)
// ------------------------------------------------------------

/** A normalised plan row before agency/report/asset ids are attached. */
export interface NormalisedPlanRow {
  row_kind: RowKind;
  station_callsign: string | null;
  station_raw: string;
  aired_at: string | null;
  booked_date: string | null;
  daypart_raw: string | null;
  duration_sec: number | null;
  creative_code: string | null;
  spot_class: SpotClass | null;
  media_value: number | null;
  contract_ref: string | null;
  spots: number | null;
  raw: Record<string, unknown>;
}

export interface NormaliseContext {
  stationIndex: StationResolveIndex;
  /** Resolve a callsign to its IANA timezone; used for aired timestamps. */
  timezoneForCallsign: (callsign: string) => string | undefined;
  /** Manual overrides: raw station name -> chosen callsign. */
  stationOverrides?: Record<string, string>;
}

function cellByHeader(data: TabularData, row: string[], header: string | null): string {
  if (!header) return '';
  const idx = data.headers.indexOf(header);
  return idx === -1 ? '' : (row[idx] ?? '');
}

/**
 * Turn a mapped file into normalised plan rows. Station names resolve against
 * the registry (with manual overrides); unresolved rows keep
 * station_callsign = null and, for aired rows, a null aired_at.
 */
export function normalisePlanRows(
  data: TabularData,
  mapping: Record<string, string | null>,
  kind: RowKind,
  spotClassHeader: string | null,
  ctx: NormaliseContext
): NormalisedPlanRow[] {
  return data.rows
    .filter((row) => row.some((c) => c.trim().length > 0))
    .map((row) => {
      const rawObj: Record<string, unknown> = {};
      data.headers.forEach((h, i) => {
        rawObj[h] = row[i] ?? '';
      });

      const stationRaw = cellByHeader(data, row, mapping.station).trim();
      const override = ctx.stationOverrides?.[stationRaw];
      const callsign = override ?? resolveStation(stationRaw, ctx.stationIndex);

      const mediaValue = parseNumber(cellByHeader(data, row, mapping.mediaValue));
      const explicit = spotClassHeader ? cellByHeader(data, row, spotClassHeader) : null;
      const spotClass = inferSpotClass(explicit, mediaValue);

      let airedAt: string | null = null;
      let bookedDate: string | null = null;
      // Booked rows: preserve the spot quantity the line represents (total or
      // per-day column) so Review sums quantities, not one per file line.
      // Null for aired rows, where one row is one aired spot.
      const spots =
        kind === 'booked'
          ? parseNumber(cellByHeader(data, row, mapping.totalSpots)) ??
            parseNumber(cellByHeader(data, row, mapping.spotsPerDay))
          : null;

      if (kind === 'aired') {
        const tz = callsign ? ctx.timezoneForCallsign(callsign) : undefined;
        if (tz) {
          if (mapping.airedDateTime) {
            const dt = cellByHeader(data, row, mapping.airedDateTime);
            const [datePart, ...timeParts] = dt.trim().split(/[ T]/);
            airedAt = combineAiredTimestamp(datePart, timeParts.join(' '), tz);
          } else {
            airedAt = combineAiredTimestamp(
              cellByHeader(data, row, mapping.airedDate),
              cellByHeader(data, row, mapping.airedTime),
              tz
            );
          }
        }
      } else {
        bookedDate =
          parseFlexibleDate(cellByHeader(data, row, mapping.bookedDate)) ??
          parseFlexibleDate(cellByHeader(data, row, mapping.dateStart));
      }

      return {
        row_kind: kind,
        station_callsign: callsign,
        station_raw: stationRaw,
        aired_at: airedAt,
        booked_date: bookedDate,
        daypart_raw: mapping.daypart ? cellByHeader(data, row, mapping.daypart).trim() || null : null,
        duration_sec: parseDurationSec(cellByHeader(data, row, mapping.duration)),
        creative_code: mapping.creativeCode ? cellByHeader(data, row, mapping.creativeCode).trim() || null : null,
        spot_class: spotClass,
        media_value: mediaValue,
        contract_ref: mapping.contract ? cellByHeader(data, row, mapping.contract).trim() || null : null,
        spots: spots === null ? null : Math.round(spots),
        raw: rawObj,
      };
    });
}
