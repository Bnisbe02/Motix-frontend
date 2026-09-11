/*
  PCR pure-logic unit tests. Run with `npm run test` (see scripts/run-unit-tests.mjs),
  which bundles this file with esbuild and executes it under Node. No test
  framework dependency — a tiny assert harness, matching the Phase 1 approach.
*/
import { Station, Daypart, PcrDetection, DEFAULT_DAYPARTS } from '../types/pcr';
import { assignDaypart } from '../utils/dayparts';
import { buildStationIndex, resolveStation, normaliseStationKey } from '../lib/stationResolve';
import {
  summariseDetections,
  mapDetectionRow,
  validateStateSplit,
  formatInTimeZone,
  DetectionColumnMap,
} from '../lib/pcrMetrics';
import {
  autoMapColumns,
  inferSpotClass,
  detectSpotClassColumn,
  parseFlexibleDate,
  parseDurationSec,
  combineAiredTimestamp,
  normalisePlanRows,
  parseDelimitedText,
  AIRED_TARGETS,
  BOOKED_TARGETS,
  TabularData,
} from '../lib/tabularImport';

let failures = 0;
let count = 0;
function check(label: string, cond: boolean, detail = ''): void {
  count += 1;
  const status = cond ? 'PASS' : 'FAIL';
  console.log(`${status}  ${label}${detail ? '  -> ' + detail : ''}`);
  if (!cond) failures += 1;
}
function eq<T>(label: string, actual: T, expected: T): void {
  check(label, JSON.stringify(actual) === JSON.stringify(expected), `got ${JSON.stringify(actual)}`);
}

const DAYPARTS: Daypart[] = DEFAULT_DAYPARTS;

const STATIONS: Station[] = [
  { callsign: 'NOVA969', display_name: 'Nova 96.9', market: 'Sydney', state: 'NSW', timezone: 'Australia/Sydney', network: 'Nova Entertainment', is_active: true, created_at: '' },
  { callsign: 'NOVA100', display_name: 'Nova 100', market: 'Melbourne', state: 'VIC', timezone: 'Australia/Melbourne', network: 'Nova Entertainment', is_active: true, created_at: '' },
  { callsign: 'NOVA1069', display_name: 'Nova 106.9', market: 'Brisbane', state: 'QLD', timezone: 'Australia/Brisbane', network: 'Nova Entertainment', is_active: true, created_at: '' },
  { callsign: 'NOVA937', display_name: 'Nova 93.7', market: 'Perth', state: 'WA', timezone: 'Australia/Perth', network: 'Nova Entertainment', is_active: true, created_at: '' },
];

// ------------------------------------------------------------
console.log('\n# daypart assignment');
eq('00:00 -> Mid-Dawn', assignDaypart('00:00', DAYPARTS), 'Mid-Dawn');
eq('02:00 -> Mid-Dawn (across midnight)', assignDaypart('02:00', DAYPARTS), 'Mid-Dawn');
eq('05:29 -> Mid-Dawn', assignDaypart('05:29', DAYPARTS), 'Mid-Dawn');
eq('05:30 -> Breakfast (boundary)', assignDaypart('05:30', DAYPARTS), 'Breakfast');
eq('08:59 -> Breakfast', assignDaypart('08:59', DAYPARTS), 'Breakfast');
eq('09:00 -> Morning (boundary)', assignDaypart('09:00', DAYPARTS), 'Morning');
eq('23:30 -> Late Evening', assignDaypart('23:30', DAYPARTS), 'Late Evening');
eq('malformed -> Unassigned', assignDaypart('bad', DAYPARTS), 'Unassigned');

// ------------------------------------------------------------
console.log('\n# station resolution');
const idx = buildStationIndex(STATIONS);
eq('Nova 96.9 -> NOVA969', resolveStation('Nova 96.9', idx), 'NOVA969');
eq('NOVA969 -> NOVA969', resolveStation('NOVA969', idx), 'NOVA969');
eq('NOVA96.9 (Sydney) -> NOVA969', resolveStation('NOVA96.9 (Sydney)', idx), 'NOVA969');
eq('nova 100 -> NOVA100', resolveStation('nova 100', idx), 'NOVA100');
eq('Nova 106.9 -> NOVA1069', resolveStation('Nova 106.9', idx), 'NOVA1069');
eq('unknown -> null', resolveStation('Triple M Sydney', idx), null);
eq('normaliseStationKey drops punctuation', normaliseStationKey('NOVA96.9 (Sydney)'), 'nova969');

// ------------------------------------------------------------
console.log('\n# spot-class inference');
eq("explicit 'Paid' -> paid", inferSpotClass('Paid', 1250), 'paid');
eq("explicit 'BONUS' -> bonus", inferSpotClass('BONUS', 1250), 'bonus');
eq('media value 0 -> bonus', inferSpotClass(null, 0), 'bonus');
eq('positive value, no explicit -> unknown', inferSpotClass(null, 1250), 'unknown');
eq('null value, no explicit -> unknown', inferSpotClass('', null), 'unknown');

// ------------------------------------------------------------
console.log('\n# value parsing');
eq("parseFlexibleDate DD/MM/YYYY", parseFlexibleDate('15/09/2026'), '2026-09-15');
eq('parseFlexibleDate ISO', parseFlexibleDate('2026-09-15'), '2026-09-15');
eq('parseDurationSec MM:SS', parseDurationSec('00:30'), 30);
eq('parseDurationSec plain', parseDurationSec('30'), 30);

// ------------------------------------------------------------
console.log('\n# timezone conversion');
// Sydney AEST (+10, no DST mid-September): local 2026-09-15 07:30 -> 2026-09-14T21:30Z
eq(
  'combineAiredTimestamp Sydney local -> UTC',
  combineAiredTimestamp('15/09/2026', '07:30:00', 'Australia/Sydney'),
  '2026-09-14T21:30:00.000Z'
);
// Reverse: format that UTC instant back into Sydney local.
eq(
  'formatInTimeZone UTC -> Sydney local',
  formatInTimeZone('2026-09-14T21:30:00.000Z', 'Australia/Sydney'),
  { localDate: '2026-09-15', localTime: '07:30' }
);
// Perth is +8: local 2026-09-15 07:30 -> 2026-09-14T23:30Z
eq(
  'combineAiredTimestamp Perth local -> UTC',
  combineAiredTimestamp('15/09/2026', '07:30:00', 'Australia/Perth'),
  '2026-09-14T23:30:00.000Z'
);
// DST edge: Sydney springs forward 2026-10-04 02:00. 00:30 is still AEST +10.
eq(
  'combineAiredTimestamp Sydney pre-DST 00:30 -> UTC (+10)',
  combineAiredTimestamp('04/10/2026', '00:30:00', 'Australia/Sydney'),
  '2026-10-03T14:30:00.000Z'
);
// 03:30 on the same day is AEDT +11.
eq(
  'combineAiredTimestamp Sydney post-DST 03:30 -> UTC (+11)',
  combineAiredTimestamp('04/10/2026', '03:30:00', 'Australia/Sydney'),
  '2026-10-03T16:30:00.000Z'
);

// ------------------------------------------------------------
console.log('\n# detection mapping');
const COLS: DetectionColumnMap = {
  id: 'detection_id', tsUtc: 'ts_utc', station: 'station', brand: 'brand',
  eventType: 'commercial_event_type', durationSec: 'duration_sec', confidence: 'confidence',
  confidenceTier: 'confidence_tier', verified: 'verified',
};
const mapped = mapDetectionRow(
  { detection_id: 'd1', ts_utc: '2026-09-14T21:30:00.000Z', station: 'NOVA969', brand: 'Aussie Health Co', commercial_event_type: 'commercial', duration_sec: '30', confidence: '0.91', confidence_tier: 'high', verified: 'true' },
  COLS, 'NOVA969', 'Australia/Sydney', DAYPARTS
);
eq('mapDetectionRow local time', mapped.localTime, '07:30');
eq('mapDetectionRow daypart', mapped.daypart, 'Breakfast');
eq('mapDetectionRow duration numeric', mapped.durationSec, 30);
eq('mapDetectionRow verified bool', mapped.verified, true);

// ------------------------------------------------------------
console.log('\n# summarisation');
const dets: PcrDetection[] = [
  { id: 'a', tsUtc: '', stationCallsign: 'NOVA969', brand: 'X', eventType: 'commercial', durationSec: 30, confidence: 1, confidenceTier: 'high', verified: true, localTime: '07:00', localDate: '2026-09-15', daypart: 'Breakfast' },
  { id: 'b', tsUtc: '', stationCallsign: 'NOVA969', brand: 'X', eventType: 'commercial', durationSec: 30, confidence: 1, confidenceTier: 'high', verified: true, localTime: '10:00', localDate: '2026-09-15', daypart: 'Morning' },
  { id: 'c', tsUtc: '', stationCallsign: 'NOVA100', brand: 'X', eventType: 'sponsorship', durationSec: 15, confidence: 1, confidenceTier: 'med', verified: false, localTime: '17:00', localDate: '2026-09-15', daypart: 'Drive' },
];
const sumAll = summariseDetections(dets);
eq('summary total (default all included)', sumAll.total, 3);
eq('summary byStation', sumAll.byStation, { NOVA969: 2, NOVA100: 1 });
eq('summary byEventType', sumAll.byEventType, { commercial: 2, sponsorship: 1 });
const sumExcluded = summariseDetections(dets, { c: false });
eq('summary total with one excluded', sumExcluded.total, 2);
eq('summary byStation excludes NOVA100', sumExcluded.byStation, { NOVA969: 2 });

// ------------------------------------------------------------
console.log('\n# state split');
eq('valid split sums to 100', validateStateSplit({ NSW: 60, VIC: 40 }).isValid, true);
eq('empty split is valid (optional)', validateStateSplit({}).isValid, true);
eq('split not summing 100 invalid', validateStateSplit({ NSW: 60, VIC: 30 }).isValid, false);

// ------------------------------------------------------------
console.log('\n# LDV auto-map and normalisation');
const fs = await import('node:fs');
const path = await import('node:path');
// Run from the repo root via `npm test`; the bundled test lives in a temp dir,
// so resolve the fixture from the working directory, not import.meta.url.
const csvText = fs.readFileSync(path.join(process.cwd(), 'src/test/fixtures/ldv-sample.csv'), 'utf8');
const data: TabularData = parseDelimitedText(csvText);
eq('fixture parsed 10 rows', data.rows.length, 10);
const mapping = autoMapColumns(data.headers, AIRED_TARGETS);
check('auto-map station without help', mapping.station === 'Station', mapping.station ?? 'null');
check('auto-map aired date', mapping.airedDate === 'Aired Date', mapping.airedDate ?? 'null');
check('auto-map aired time', mapping.airedTime === 'Aired Time', mapping.airedTime ?? 'null');
check('auto-map daypart', mapping.daypart === 'Day Part', mapping.daypart ?? 'null');
check('auto-map duration to Aired Dur', mapping.duration === 'Aired Dur', mapping.duration ?? 'null');
check('auto-map Media as creative code', mapping.creativeCode === 'Media', mapping.creativeCode ?? 'null');
check('auto-map media value', mapping.mediaValue === 'Media Value', mapping.mediaValue ?? 'null');
check('auto-map contract', mapping.contract === 'Contract', mapping.contract ?? 'null');
const spotCol = detectSpotClassColumn(data);
eq('detect spot-class column (Position=Paid)', spotCol, 'Position');

const normalised = normalisePlanRows(data, mapping, 'aired', spotCol, {
  stationIndex: idx,
  timezoneForCallsign: (cs) => STATIONS.find((s) => s.callsign === cs)?.timezone,
});
eq('normalised 10 rows', normalised.length, 10);
eq('all rows classified paid', normalised.every((r) => r.spot_class === 'paid'), true);
eq('all rows resolved a station', normalised.every((r) => r.station_callsign !== null), true);
eq('first row resolves Nova 96.9 -> NOVA969', normalised[0].station_callsign, 'NOVA969');
eq('first row aired_at computed', typeof normalised[0].aired_at === 'string' && normalised[0].aired_at!.endsWith('Z'), true);
eq('first row duration 30s', normalised[0].duration_sec, 30);
eq('first row media value numeric', normalised[0].media_value, 1250);

// ------------------------------------------------------------
console.log('\n# booked normalisation preserves spot quantity');
const bookedData: TabularData = {
  headers: ['Station', 'Date', 'Total Spots', 'Media Value'],
  rows: [
    ['Nova 96.9', '15/09/2026', '30', '0'],
    ['Nova 100', '16/09/2026', '12', '500'],
  ],
};
const bookedMapping = autoMapColumns(bookedData.headers, BOOKED_TARGETS);
const bookedNorm = normalisePlanRows(bookedData, bookedMapping, 'booked', null, {
  stationIndex: idx,
  timezoneForCallsign: (cs) => STATIONS.find((s) => s.callsign === cs)?.timezone,
});
eq('booked row 1 keeps 30 spots', bookedNorm[0].spots, 30);
eq('booked row 2 keeps 12 spots', bookedNorm[1].spots, 12);
eq('booked row 1 booked_date parsed', bookedNorm[0].booked_date, '2026-09-15');
eq('booked row 1 zero media value -> bonus', bookedNorm[0].spot_class, 'bonus');
eq('aired rows carry null spots', normalised[0].spots, null);

// ------------------------------------------------------------
console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'} (${count} checks)`);
if (failures > 0) process.exit(1);
