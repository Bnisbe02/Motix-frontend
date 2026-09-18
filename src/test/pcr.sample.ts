/*
  Shared, fully-invented sample PCR for "Brightwater Home Loans", used by both
  the sample-deck generator (scripts/generate-sample-deck.mjs) and the Phase 4
  visual-system XML check (scripts/check-pptx-phase4.mjs). No real brand, code,
  contract or value appears anywhere.

  It builds a populated PcrReportModel (broadcast across dayparts on two
  stations, a plan + delivery log so reconciliation renders, a streaming line,
  a podcast line and an audience line), a brand kit carrying every visual asset
  (logos, cover, texture, section heroes), a stub AssetResolver returning a
  tiny placeholder PNG for any path, a client-logo path, and a narrative whose
  OVERVIEW must appear and whose SECTION summaries must NOT appear on any data
  slide (the voice rule).
*/
import { Station, PcrReport, PcrDetection, PcrPlanRow, PcrMediaLine, BrandKit, Narrative, DEFAULT_DAYPARTS } from '../types/pcr';
import { buildReportModel, PcrReportModel } from '../lib/pcr/reportModel';
import type { AssetResolver } from '../lib/pcr/pptxGenerator';

/** Distinctive markers so the XML check can prove the voice rule. */
export const MARKERS = {
  overview: 'OVERVIEWMARKER',
  broadcast: 'BROADCASTPROSEMARKER',
  streaming: 'STREAMINGPROSEMARKER',
  audience: 'AUDIENCEPROSEMARKER',
} as const;

/** A 1×1 transparent PNG, embedded as a placeholder for every asset. */
export const PLACEHOLDER_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** A resolver that hands back the placeholder PNG for any non-empty path. */
export function sampleResolver(): AssetResolver {
  return async (path: string): Promise<string | null> => (path ? PLACEHOLDER_PNG : null);
}

const STATIONS: Station[] = [
  { callsign: 'NOVA969', display_name: 'Nova 96.9', market: 'Sydney', state: 'NSW', timezone: 'Australia/Sydney', network: 'Nova Entertainment', is_active: true, created_at: '' },
  { callsign: 'NOVA100', display_name: 'Nova 100', market: 'Melbourne', state: 'VIC', timezone: 'Australia/Melbourne', network: 'Nova Entertainment', is_active: true, created_at: '' },
];

const report: PcrReport = {
  id: 'sample', agency_id: 'brightwater', created_by: 'u1', advertiser: 'Brightwater Home Loans',
  campaign_name: 'Spring Rate Cut 2026', date_from: '2026-09-01', date_to: '2026-09-18',
  station_callsigns: ['NOVA969', 'NOVA100'], objectives: null, status: 'draft',
  client_logo_path: 'brightwater/sample/client-logo.png', narrative: null, created_at: '', updated_at: '',
};

const DAYPARTS = ['Breakfast', 'Morning', 'Afternoon', 'Drive'];

function detsFor(station: string, startId: number): PcrDetection[] {
  const out: PcrDetection[] = [];
  let id = startId;
  const counts: Record<string, number> = { Breakfast: 6, Morning: 3, Afternoon: 4, Drive: 5 };
  for (const dp of DAYPARTS) {
    for (let i = 0; i < counts[dp]; i += 1) {
      out.push({
        id: `d${id}`, tsUtc: '2026-09-05T00:00:00.000Z', stationCallsign: station,
        brand: 'Brightwater Home Loans', eventType: 'commercial', durationSec: 30, confidence: 0.92,
        confidenceTier: 'high', verified: true, localTime: '07:00', localDate: '2026-09-05', daypart: dp,
      });
      id += 1;
    }
  }
  return out;
}
const detections: PcrDetection[] = [...detsFor('NOVA969', 1), ...detsFor('NOVA100', 100)];

const planRow = (over: Partial<PcrPlanRow>): PcrPlanRow => ({
  id: Math.random().toString(36).slice(2), report_id: 'sample', agency_id: 'brightwater', asset_id: 'a1',
  row_kind: 'booked', station_callsign: 'NOVA969', station_raw: 'Nova 96.9', aired_at: null, booked_date: '2026-09-05',
  daypart_raw: 'Breakfast', duration_sec: 30, creative_code: 'BW30A', spot_class: 'paid', media_value: 100,
  contract_ref: 'BW-1', spots: null, raw: {}, created_at: '', ...over,
});

const planRows: PcrPlanRow[] = [];
for (const station of ['NOVA969', 'NOVA100']) {
  for (const dp of DAYPARTS) {
    planRows.push(planRow({ station_callsign: station, row_kind: 'booked', spot_class: 'paid', spots: 5, daypart_raw: dp }));
    planRows.push(planRow({ station_callsign: station, row_kind: 'booked', spot_class: 'bonus', spots: 2, daypart_raw: dp, media_value: 0 }));
    planRows.push(planRow({ station_callsign: station, row_kind: 'aired', spot_class: 'paid', spots: null, daypart_raw: dp }));
  }
}

const mediaLines: PcrMediaLine[] = [
  {
    id: 'ml-stream', report_id: 'sample', agency_id: 'brightwater', line_type: 'streaming',
    label: 'Nova Web & App Streaming',
    metrics: { imps_booked: 250000, imps_delivered: 268400, unique_users: 92000, completed_views: 241560, top_placements: [{ name: 'Live radio player', impressions: 160000 }, { name: 'Catch-up', impressions: 108400 }] },
    source: 'uploaded', source_note: 'Publisher ad-server export (Sep 2026)', sort_order: 0, created_at: '',
  },
  {
    id: 'ml-pod', report_id: 'sample', agency_id: 'brightwater', line_type: 'podcast',
    label: 'Nova Podcast Network',
    metrics: { imps_booked: 60000, imps_delivered: 64200, downloads: 58800, top_placements: [{ name: 'Kate, Tim & Joel', impressions: 36000 }, { name: 'Smallzy', impressions: 28200 }] },
    source: 'uploaded', source_note: 'Megaphone delivery report', sort_order: 1, created_at: '',
  },
  {
    id: 'ml-aud', report_id: 'sample', agency_id: 'brightwater', line_type: 'audience',
    label: 'Survey audience',
    metrics: { reach_1plus: 512000, reach_3plus: 288000, avg_frequency: 3.4, gross_impacts: 1740000, demo_label: 'P25-54' },
    source: 'manual', source_note: 'GfK Fusion Survey 4 2026', sort_order: 2, created_at: '',
  },
];

/** The brand kit carrying every Phase 4 visual asset (placeholder paths). */
export const sampleBrandKit: BrandKit = {
  id: 'bk1', agency_id: 'brightwater', name: 'Brightwater',
  primary_colour: '#123B63', secondary_colour: '#8FB8C9', accent_colour: '#E07A2F', text_on_primary: '#FFFFFF',
  heading_font: 'Poppins', body_font: 'Inter',
  logo_light_path: 'brightwater/logo_light.png',
  logo_dark_path: 'brightwater/logo_dark.png',
  cover_image_path: 'brightwater/cover_image.png',
  texture_image_path: 'brightwater/texture.png',
  section_images: {
    cover: 'brightwater/section-cover.png',
    broadcast: 'brightwater/section-broadcast.png',
    streaming: 'brightwater/section-streaming.png',
    podcast: 'brightwater/section-podcast.png',
    audience: 'brightwater/section-audience.png',
  },
  dayparts: DEFAULT_DAYPARTS,
  tone_description: null, tone_reference: null, created_at: '', updated_at: '',
};

/** Narrative: overview must appear; section summaries must NOT be drawn. */
export const sampleNarrative: Narrative = {
  overview: `${MARKERS.overview} Brightwater Home Loans ran across Nova breakfast and drive through September, with delivery verified by MOTIX against the booked plan and the station delivery log.`,
  sections: {
    broadcast: `${MARKERS.broadcast} broadcast prose that must never appear on a data slide.`,
    streaming: `${MARKERS.streaming} streaming prose that must never appear on a data slide.`,
    audience: `${MARKERS.audience} audience prose that must never appear on a data slide.`,
  },
};

export function buildSampleModel(): PcrReportModel {
  return buildReportModel({
    report, detections, inclusions: {}, planRows, mediaLines, brandKit: sampleBrandKit,
    stations: STATIONS, dayparts: DEFAULT_DAYPARTS, sampleData: true,
  });
}

export const sampleClientLogoPath = report.client_logo_path;
