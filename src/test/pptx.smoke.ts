/*
  PPTX smoke entry for scripts/check-pptx-native.mjs. Builds a representative
  deck (broadcast table + charts, reconciliation, a media line, audience) and
  returns the serialised bytes. Not part of the app bundle.
*/
import { Station, PcrReport, PcrDetection, PcrPlanRow, PcrMediaLine, DEFAULT_DAYPARTS } from '../types/pcr';
import { buildReportModel } from '../lib/pcr/reportModel';
import { buildPptx } from '../lib/pcr/pptxGenerator';

const STATIONS: Station[] = [
  { callsign: 'NOVA969', display_name: 'Nova 96.9', market: 'Sydney', state: 'NSW', timezone: 'Australia/Sydney', network: 'Nova Entertainment', is_active: true, created_at: '' },
];

const report: PcrReport = {
  id: 'r1', agency_id: 'nova', created_by: 'u1', advertiser: 'Brightwater Home Loans',
  campaign_name: 'Spring 2026', date_from: '2026-09-15', date_to: '2026-09-16',
  station_callsigns: ['NOVA969'], objectives: null, status: 'draft', client_logo_path: null,
  narrative: null, created_at: '', updated_at: '',
};

const detections: PcrDetection[] = [
  { id: 'd1', tsUtc: '', stationCallsign: 'NOVA969', brand: 'Brightwater Home Loans', eventType: 'commercial', durationSec: 30, confidence: 0.9, confidenceTier: 'high', verified: true, localTime: '07:00', localDate: '2026-09-15', daypart: 'Breakfast' },
  { id: 'd2', tsUtc: '', stationCallsign: 'NOVA969', brand: 'Brightwater Home Loans', eventType: 'commercial', durationSec: 30, confidence: 0.9, confidenceTier: 'high', verified: true, localTime: '17:00', localDate: '2026-09-15', daypart: 'Drive' },
];

const planRow = (over: Partial<PcrPlanRow>): PcrPlanRow => ({
  id: Math.random().toString(36).slice(2), report_id: 'r1', agency_id: 'nova', asset_id: 'a1',
  row_kind: 'booked', station_callsign: 'NOVA969', station_raw: 'Nova 96.9', aired_at: null, booked_date: '2026-09-15',
  daypart_raw: 'Breakfast', duration_sec: 30, creative_code: 'BW30A', spot_class: 'paid', media_value: 100,
  contract_ref: 'BW-1', spots: null, raw: {}, created_at: '', ...over,
});
const planRows: PcrPlanRow[] = [
  planRow({ row_kind: 'booked', spots: 10, spot_class: 'paid', daypart_raw: 'Breakfast' }),
  planRow({ row_kind: 'aired', spot_class: 'paid', daypart_raw: 'Breakfast' }),
  planRow({ row_kind: 'aired', spot_class: 'bonus', daypart_raw: 'Drive', media_value: 0 }),
];

const mediaLines: PcrMediaLine[] = [
  { id: 'm1', report_id: 'r1', agency_id: 'nova', line_type: 'podcast', label: 'Nova Podcasts', metrics: { imps_booked: 1000, imps_delivered: 1200, top_placements: [{ name: 'Show A', impressions: 800 }, { name: 'Show B', impressions: 400 }] }, source: 'uploaded', source_note: 'Publisher report', sort_order: 0, created_at: '' },
  { id: 'm2', report_id: 'r1', agency_id: 'nova', line_type: 'audience', label: 'Survey', metrics: { reach_1plus: 500000, avg_frequency: 3.2, demo_label: 'P25-54' }, source: 'manual', source_note: 'GfK Survey 4 2026', sort_order: 1, created_at: '' },
];

export async function buildDeck(): Promise<Uint8Array> {
  const model = buildReportModel({ report, detections, inclusions: {}, planRows, mediaLines, brandKit: null, stations: STATIONS, dayparts: DEFAULT_DAYPARTS, sampleData: true });
  const pptx = await buildPptx(model, null, { narrative: { overview: 'Overview.', sections: { broadcast: 'b' } } });
  return (await pptx.write({ outputType: 'nodebuffer' })) as Uint8Array;
}
