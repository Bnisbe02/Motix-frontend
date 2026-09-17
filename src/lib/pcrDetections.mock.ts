import { PcrDetection, Station, Daypart, DetectionEventType } from '../types/pcr';
import { assignDaypart } from '../utils/dayparts';
import { zonedWallTimeToUtcISO } from './pcrMetrics';

/*
  MOCK detection source — sample data only, NOT live.

  The real `detections` mirror does not exist yet (Phase 2 B0). This module
  fabricates realistic-looking detections so the whole PCR flow runs end to
  end for demos and tests. It is selected by VITE_PCR_DETECTION_SOURCE=mock
  (the default for now) and is dynamically imported by pcrDetections.ts, so it
  tree-shakes out of the production bundle when the flag is 'mirror'.

  EVERYTHING HERE IS INVENTED. No real brand, campaign, station data beyond
  the public registry callsigns, or client-supplied values appears. The
  advertiser is the fictional "Brightwater Home Loans". Output is deterministic
  (seeded RNG) so the same inputs always produce the same detections.
*/

/** The only advertiser the mock yields data for (case-insensitive substring). */
export const MOCK_ADVERTISER = 'Brightwater Home Loans';

// ------------------------------------------------------------
// Deterministic RNG (xmur3 seed -> mulberry32)
// ------------------------------------------------------------

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFor(seed: string): () => number {
  return mulberry32(xmur3(seed)());
}

// ------------------------------------------------------------
// Distributions
// ------------------------------------------------------------

// Daypart name -> relative weight (skew towards Breakfast and Drive).
const DAYPART_WEIGHTS: Record<string, number> = {
  Breakfast: 30,
  Drive: 25,
  Morning: 15,
  Afternoon: 12,
  Evening: 8,
  'Late Evening': 5,
  'Mid-Dawn': 5,
};

const EVENT_WEIGHTS: Array<[DetectionEventType, number]> = [
  ['commercial', 78],
  ['sponsorship', 10],
  ['promotion', 8],
  ['organic_mention', 4],
];

const DURATIONS = [15, 30, 30, 30, 45, 60]; // 30s most common

function weightedPick<T>(rng: number, entries: Array<[T, number]>): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng * total;
  for (const [value, w] of entries) {
    if (r < w) return value;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

function daypartWindow(name: string, dayparts: Daypart[]): { startMin: number; endMin: number } | null {
  const d = dayparts.find((x) => x.name === name);
  if (!d) return null;
  const toMin = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const startMin = toMin(d.start);
  const endMin = d.end === '24:00' ? 1440 : toMin(d.end);
  return endMin > startMin ? { startMin, endMin } : null;
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const cur = new Date(Date.UTC(fy, fm - 1, fd));
  const end = Date.UTC(ty, tm - 1, td);
  while (cur.getTime() <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export interface MockDetectionParams {
  advertiser: string;
  dateFrom: string;
  dateTo: string;
  stationCallsigns: string[];
  stations: Station[];
  dayparts: Daypart[];
}

/**
 * Produce deterministic sample detections (already mapped to PcrDetection) for
 * the requested advertiser / dates / stations. Yields data only when the
 * advertiser matches the fictional MOCK_ADVERTISER (case-insensitive), so the
 * builder's advertiser filter behaves realistically. Returns [] otherwise.
 *
 * Roughly 2 spots per station per day (≈180 across a two-week, six-station
 * campaign), skewed towards Breakfast and Drive, ~85% high-confidence.
 */
export function generateMockDetections(params: MockDetectionParams): PcrDetection[] {
  const { advertiser, dateFrom, dateTo, stationCallsigns, stations, dayparts } = params;

  if (!advertiser.trim().toLowerCase().includes('brightwater')) {
    return [];
  }
  if (!dateFrom || !dateTo || dateTo < dateFrom) return [];

  const tzByCallsign: Record<string, string> = {};
  const nameByCallsign: Record<string, string> = {};
  for (const s of stations) {
    tzByCallsign[s.callsign] = s.timezone;
    nameByCallsign[s.callsign] = s.display_name;
  }

  const daypartNames = Object.keys(DAYPART_WEIGHTS).filter((n) => daypartWindow(n, dayparts));
  const daypartEntries: Array<[string, number]> = daypartNames.map((n) => [n, DAYPART_WEIGHTS[n]]);

  const dates = eachDate(dateFrom, dateTo);
  const detections: PcrDetection[] = [];
  let counter = 0;

  for (const callsign of stationCallsigns) {
    const tz = tzByCallsign[callsign];
    if (!tz) continue; // unknown station: no mock rows
    for (const date of dates) {
      const dayRng = rngFor(`${callsign}|${date}|count`);
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      const isWeekend = dow === 0 || dow === 6;
      // 1-3 spots weekdays, 0-2 weekends.
      const roll = dayRng();
      const count = isWeekend
        ? roll < 0.4 ? 0 : roll < 0.8 ? 1 : 2
        : roll < 0.25 ? 1 : roll < 0.7 ? 2 : 3;

      for (let i = 0; i < count; i += 1) {
        const rng = rngFor(`${callsign}|${date}|${i}`);
        const daypartName = weightedPick(rng(), daypartEntries);
        const win = daypartWindow(daypartName, dayparts)!;
        const minute = win.startMin + Math.floor(rng() * (win.endMin - win.startMin));
        const hh = Math.floor(minute / 60);
        const mm = minute % 60;
        const localTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

        const [y, mo, d] = date.split('-').map(Number);
        const tsUtc = zonedWallTimeToUtcISO(y, mo, d, hh, mm, 0, tz);

        const eventType = weightedPick(rng(), EVENT_WEIGHTS);
        const duration = DURATIONS[Math.floor(rng() * DURATIONS.length)];
        const highTier = rng() < 0.85;
        const confidence = highTier
          ? 0.86 + rng() * 0.13 // 0.86-0.99
          : 0.5 + rng() * 0.34; // 0.50-0.84
        const tier = highTier ? 'high' : 'medium';
        const verified = tier === 'medium' && rng() < 0.4;

        counter += 1;
        detections.push({
          id: `mock-${callsign}-${date}-${i}-${counter}`,
          tsUtc,
          stationCallsign: callsign,
          brand: MOCK_ADVERTISER,
          eventType,
          durationSec: duration,
          confidence: Math.round(confidence * 100) / 100,
          confidenceTier: tier,
          verified,
          localTime,
          localDate: date,
          daypart: assignDaypart(localTime, dayparts),
        });
      }
    }
  }

  // Stable order by timestamp, matching the mirror path's ordering.
  detections.sort((a, b) => (a.tsUtc < b.tsUtc ? -1 : a.tsUtc > b.tsUtc ? 1 : 0));
  return detections;
}
