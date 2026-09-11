import { Station } from '../types/pcr';

/*
  Station resolution — pure, unit-tested.

  Import files and the detection mirror refer to stations by many spellings:
  'Nova 96.9', 'NOVA969', 'NOVA96.9 (Sydney)', 'nova 100'. This module
  normalises a raw name and matches it against the registry's `callsign` and
  `display_name`, so both the importer and the detection adapter resolve the
  same way. No network, no Supabase — the caller passes the station list in.
*/

/**
 * Normalise a station label for comparison: lowercase, strip a trailing
 * parenthetical market like '(Sydney)', drop everything except letters and
 * digits (so spaces, dots and punctuation are removed). 'Nova 96.9',
 * 'NOVA969' and 'NOVA96.9 (Sydney)' all collapse to 'nova969'.
 */
export function normaliseStationKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical market
    .replace(/[^a-z0-9]+/g, ''); // keep only alphanumerics
}

export interface StationResolveIndex {
  /** normalised key -> callsign */
  byKey: Record<string, string>;
}

/** Build a lookup index once from the registry, then resolve many names against it. */
export function buildStationIndex(stations: Station[]): StationResolveIndex {
  const byKey: Record<string, string> = {};
  for (const s of stations) {
    // display_name and callsign both map to the callsign.
    const displayKey = normaliseStationKey(s.display_name);
    const callsignKey = normaliseStationKey(s.callsign);
    if (displayKey) byKey[displayKey] = s.callsign;
    // callsign wins if the two collide, so set it last.
    if (callsignKey) byKey[callsignKey] = s.callsign;
  }
  return { byKey };
}

/**
 * Resolve a single raw station name to a registry callsign, or null if it does
 * not match. Matching is exact on the normalised key, then a containment
 * fallback (e.g. 'nova969sydney' contains the index key 'nova969').
 */
export function resolveStation(raw: string, index: StationResolveIndex): string | null {
  const key = normaliseStationKey(raw);
  if (!key) {
    return null;
  }
  const exact = index.byKey[key];
  if (exact) {
    return exact;
  }
  // Containment fallback: the file value carries extra text around a known key,
  // e.g. 'novafm969' or 'nova969sydneynsw'. Prefer the longest matching key so
  // 'nova100' is not shadowed by a shorter key.
  let best: string | null = null;
  let bestLen = 0;
  for (const indexKey of Object.keys(index.byKey)) {
    if (indexKey.length > bestLen && (key.includes(indexKey) || indexKey.includes(key))) {
      best = index.byKey[indexKey];
      bestLen = indexKey.length;
    }
  }
  return best;
}
