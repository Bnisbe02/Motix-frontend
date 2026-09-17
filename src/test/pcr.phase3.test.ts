/*
  PCR Phase 3 pure-logic tests: buildReportModel arithmetic, narrative parsing
  (fenced + malformed fallback), and the PPTX generator (valid non-empty deck,
  slide count matches populated sections). Run via `npm run test`.
*/
import { Station, PcrReport, PcrDetection, PcrPlanRow, PcrMediaLine, DEFAULT_DAYPARTS } from '../types/pcr';
import { buildReportModel } from '../lib/pcr/reportModel';
import { buildPptx } from '../lib/pcr/pptxGenerator';
import { parseNarrativeResponse, coerceNarrative } from '../lib/pcr/narrative';
import { generateMockDetections } from '../lib/pcrDetections.mock';

let failures = 0;
let count = 0;
function check(label: string, cond: boolean, detail = ''): void {
  count += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '  -> ' + detail : ''}`);
  if (!cond) failures += 1;
}
function eq<T>(label: string, actual: T, expected: T): void {
  check(label, JSON.stringify(actual) === JSON.stringify(expected), `got ${JSON.stringify(actual)}`);
}

const STATIONS: Station[] = [
  { callsign: 'NOVA969', display_name: 'Nova 96.9', market: 'Sydney', state: 'NSW', timezone: 'Australia/Sydney', network: 'Nova Entertainment', is_active: true, created_at: '' },
  { callsign: 'NOVA100', display_name: 'Nova 100', market: 'Melbourne', state: 'VIC', timezone: 'Australia/Melbourne', network: 'Nova Entertainment', is_active: true, created_at: '' },
  { callsign: 'NOVA1069', display_name: 'Nova 106.9', market: 'Brisbane', state: 'QLD', timezone: 'Australia/Brisbane', network: 'Nova Entertainment', is_active: true, created_at: '' },
  { callsign: 'NOVA919', display_name: 'Nova 91.9', market: 'Adelaide', state: 'SA', timezone: 'Australia/Adelaide', network: 'Nova Entertainment', is_active: true, created_at: '' },
  { callsign: 'NOVA937', display_name: 'Nova 93.7', market: 'Perth', state: 'WA', timezone: 'Australia/Perth', network: 'Nova Entertainment', is_active: true, created_at: '' },
  { callsign: '2QN_Deniliquin', display_name: '2QN 1521', market: 'Deniliquin', state: 'NSW', timezone: 'Australia/Sydney', network: null, is_active: true, created_at: '' },
];

const report: PcrReport = {
  id: 'r1', agency_id: 'nova', created_by: 'u1', advertiser: 'Brightwater Home Loans',
  campaign_name: 'Spring 2026', date_from: '2026-09-15', date_to: '2026-09-16',
  station_callsigns: ['NOVA969'], objectives: null, status: 'draft', client_logo_path: null,
  narrative: null, created_at: '', updated_at: '',
};

const det = (id: string, daypart: string): PcrDetection => ({
  id, tsUtc: '2026-09-15T00:00:00.000Z', stationCallsign: 'NOVA969', brand: 'Brightwater Home Loans',
  eventType: 'commercial', durationSec: 30, confidence: 0.9, confidenceTier: 'high', verified: true,
  localTime: '07:00', localDate: '2026-09-15', daypart,
});
const detections: PcrDetection[] = [det('d1', 'Breakfast'), det('d2', 'Breakfast'), det('d3', 'Drive')];
const inclusions = { d3: false };

const planRow = (over: Partial<PcrPlanRow>): PcrPlanRow => ({
  id: Math.random().toString(36).slice(2), report_id: 'r1', agency_id: 'nova', asset_id: 'a1',
  row_kind: 'booked', station_callsign: 'NOVA969', station_raw: 'Nova 96.9', aired_at: null, booked_date: '2026-09-15',
  daypart_raw: 'Breakfast', duration_sec: 30, creative_code: 'BW30A', spot_class: 'paid', media_value: 100,
  contract_ref: 'BW-1', spots: null, raw: {}, created_at: '', ...over,
});
const planRows: PcrPlanRow[] = [
  planRow({ row_kind: 'booked', spot_class: 'paid', spots: 10, daypart_raw: 'Breakfast' }),
  planRow({ row_kind: 'booked', spot_class: 'bonus', spots: 5, daypart_raw: 'Breakfast', media_value: 0 }),
  planRow({ row_kind: 'aired', spot_class: 'paid', spots: null, daypart_raw: 'Breakfast' }),
  planRow({ row_kind: 'aired', spot_class: 'unknown', spots: null, daypart_raw: 'Drive' }),
];

const mediaLines: PcrMediaLine[] = [
  { id: 'm1', report_id: 'r1', agency_id: 'nova', line_type: 'podcast', label: 'Nova Podcasts', metrics: { imps_booked: 1000, imps_delivered: 1200 }, source: 'uploaded', source_note: '', sort_order: 0, created_at: '' },
  { id: 'm2', report_id: 'r1', agency_id: 'nova', line_type: 'audience', label: 'Survey audience', metrics: { reach_1plus: 500000, avg_frequency: 3.2, demo_label: 'P25-54' }, source: 'manual', source_note: 'GfK Fusion Survey 4 2026', sort_order: 1, created_at: '' },
];

const model = buildReportModel({ report, detections, inclusions, planRows, mediaLines, brandKit: null, stations: STATIONS, dayparts: DEFAULT_DAYPARTS, sampleData: true });

// ------------------------------------------------------------
console.log('\n# buildReportModel arithmetic');
eq('observed total = 2 (one excluded)', model.broadcast.total.totals.observed, 2);
eq('booked total sums quantity = 15', model.broadcast.total.totals.booked, 15);
eq('aired total counts rows = 2', model.broadcast.total.totals.aired, 2);
const bfast = model.broadcast.total.rows.find((r) => r.daypart === 'Breakfast')!;
eq('Breakfast observed = 2', bfast.observed, 2);
eq('Breakfast booked = 15', bfast.booked, 15);
eq('Breakfast booked paid split = 10', bfast.bookedClass?.paid ?? null, 10);
eq('Breakfast booked bonus split = 5', bfast.bookedClass?.bonus ?? null, 5);
check('dayparts ordered Breakfast before Drive', model.broadcast.dayparts.indexOf('Breakfast') < model.broadcast.dayparts.indexOf('Drive'));

console.log('\n# reconciliation');
eq('one reconciliation row (>=2 sources)', model.reconciliation.length, 1);
eq('aired - booked variance = -13', model.reconciliation[0].airedVsBooked, -13);
eq('observed - aired variance = 0', model.reconciliation[0].observedVsAired, 0);

console.log('\n# media lines and audience');
eq('one non-audience media block', model.mediaLines.length, 1);
eq('podcast metrics preserved', model.mediaLines[0].metrics.imps_delivered, 1200);
check('audience block present', model.audience !== null);
eq('audience reach preserved', model.audience?.metrics.reach_1plus ?? null, 500000);
eq('audience demo label', model.audience?.demoLabel ?? null, 'P25-54');

console.log('\n# gaps');
eq('excluded detections = 1', model.gaps.excludedDetections, 1);
eq('unknown spot-class rows = 1', model.gaps.unknownSpotClassRows, 1);
check('missing source note lists the podcast', model.gaps.mediaLinesMissingSource.includes('Nova Podcasts'));
eq('sampleData flag carried', model.gaps.sampleData, true);

// ------------------------------------------------------------
console.log('\n# narrative parsing');
eq('plain JSON parses', parseNarrativeResponse('{"overview":"Hi","sections":{"broadcast":"x"}}').overview, 'Hi');
eq('fenced ```json response parses', parseNarrativeResponse('```json\n{"overview":"Fenced","sections":{}}\n```').overview, 'Fenced');
eq('fenced plain ``` parses', parseNarrativeResponse('```\n{"overview":"Plain","sections":{}}\n```').overview, 'Plain');
eq('prose-wrapped JSON extracted', parseNarrativeResponse('Sure! {"overview":"Wrapped","sections":{}} done').overview, 'Wrapped');
eq('malformed falls back to empty', parseNarrativeResponse('not json at all').overview, '');
eq('malformed sections empty', JSON.stringify(parseNarrativeResponse('garbage').sections), '{}');
eq('coerceNarrative object passthrough', coerceNarrative({ overview: 'O', sections: { a: 'b' } }).sections.a, 'b');
eq('coerceNarrative drops non-string section', JSON.stringify(coerceNarrative({ overview: 'O', sections: { a: 5 } }).sections), '{}');

// ------------------------------------------------------------
console.log('\n# mock detections determinism');
const mockParams = { advertiser: 'Brightwater Home Loans', dateFrom: '2026-09-01', dateTo: '2026-09-14', stationCallsigns: STATIONS.map((s) => s.callsign), stations: STATIONS, dayparts: DEFAULT_DAYPARTS };
const m1 = generateMockDetections(mockParams);
const m2 = generateMockDetections(mockParams);
check('mock produces a realistic volume (100-320)', m1.length >= 100 && m1.length <= 320, String(m1.length));
eq('mock is deterministic', JSON.stringify(m1) === JSON.stringify(m2), true);
eq('mock yields nothing for a different advertiser', generateMockDetections({ ...mockParams, advertiser: 'Someone Else' }).length, 0);
check('~85% high confidence tier', (() => { const hi = m1.filter((d) => d.confidenceTier === 'high').length / m1.length; return hi > 0.78 && hi < 0.92; })());

// ------------------------------------------------------------
console.log('\n# pptx generation');
const narrative = { overview: 'A factual overview.', sections: { broadcast: 'b', reconciliation: 'r', podcast: 'p', audience: 'a' } };
const pptx = await buildPptx(model, null, { narrative });
// cover + overview + broadcast + paid/bonus + reconciliation + podcast + audience + thank you = 8
eq('slide count matches populated sections (8)', (pptx as unknown as { slides: unknown[] }).slides.length, 8);

const pptxNoNarrative = await buildPptx(model, null, {});
eq('no overview slide without narrative (7)', (pptxNoNarrative as unknown as { slides: unknown[] }).slides.length, 7);
// The byte-level "valid non-empty .pptx" + native tables/charts assertion runs
// in scripts/check-pptx-native.mjs (serialising needs a CommonJS bundle where
// pptxgenjs can require('fs'); the ESM bundle used here cannot).

// ------------------------------------------------------------
console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'} (${count} checks)`);
if (failures > 0) process.exit(1);
