import {
  PcrReport,
  PcrDetection,
  PcrPlanRow,
  PcrMediaLine,
  PcrAsset,
  BrandKit,
  Station,
  Daypart,
  FigureSource,
} from '../../types/pcr';

/*
  buildReportModel — the single source of computed truth for a PCR.

  Pure and framework-free (no React, no Supabase) so it is unit-testable and
  can later be lifted into an Edge Function. It does ALL arithmetic: the PPTX
  generator, the PDF export and the narrative function consume this model and
  never recompute. Every figure carries the source that produced it; a missing
  source is never inferred.
*/

// ------------------------------------------------------------
// Model shape
// ------------------------------------------------------------

export interface ReportModelMeta {
  advertiser: string;
  campaign: string;
  dateFrom: string;
  dateTo: string;
  /** Station display names, in the order the report selected them. */
  stations: string[];
  stationCallsigns: string[];
  generatedAt: string;
}

export interface PaidBonus {
  paid: number;
  bonus: number;
  unknown: number;
}

/** One daypart row within a station (or the network total) block. */
export interface DaypartRow {
  daypart: string;
  observed: number | null; // motix_observed
  aired: number | null; // uploaded delivery log
  booked: number | null; // uploaded plan
  /** Paid/bonus split, only where the plan/log supplied a classification. */
  airedClass: PaidBonus | null;
  bookedClass: PaidBonus | null;
}

export interface StationBlock {
  callsign: string;
  displayName: string;
  rows: DaypartRow[];
  totals: {
    observed: number | null;
    aired: number | null;
    booked: number | null;
  };
}

export interface ReconciliationRow {
  callsign: string;
  displayName: string;
  booked: number | null;
  aired: number | null;
  observed: number | null;
  /** aired - booked, when both present. */
  airedVsBooked: number | null;
  /** observed - aired, when both present. */
  observedVsAired: number | null;
}

export interface MediaLineBlock {
  id: string;
  lineType: PcrMediaLine['line_type'];
  label: string;
  source: FigureSource;
  sourceNote: string | null;
  /** Scalar metrics only (numbers), for tables/charts. */
  metrics: Record<string, number>;
  /** Optional named breakdowns for charts. */
  placements: Array<{ name: string; impressions: number }>;
  perPost: Array<{ label: string; reach: number }>;
  stateSplit: Array<{ state: string; percent: number }>;
  /** Storage paths of screenshots attached to this line (bucket pcr-assets). */
  screenshotPaths: string[];
}

export interface AudienceBlock {
  label: string;
  sourceNote: string | null;
  metrics: Record<string, number>;
  demoLabel: string | null;
}

export interface ReportModelGaps {
  unresolvedStations: string[];
  unknownSpotClassRows: number;
  excludedDetections: number;
  mediaLinesMissingSource: string[];
  /** True when broadcast figures came from the sample source, not a live feed. */
  sampleData: boolean;
}

export interface PcrReportModel {
  meta: ReportModelMeta;
  broadcast: {
    /** Daypart order used across all station tables. */
    dayparts: string[];
    stations: StationBlock[];
    total: StationBlock;
    hasObserved: boolean;
    hasAired: boolean;
    hasBooked: boolean;
  };
  reconciliation: ReconciliationRow[];
  mediaLines: MediaLineBlock[];
  audience: AudienceBlock | null;
  gaps: ReportModelGaps;
}

export interface BuildReportModelInputs {
  report: PcrReport;
  detections: PcrDetection[];
  /** detection id -> included; missing defaults to included. */
  inclusions: Record<string, boolean>;
  planRows: PcrPlanRow[];
  mediaLines: PcrMediaLine[];
  /** Report assets, used to attach screenshot paths to media lines. */
  assets?: PcrAsset[];
  brandKit: BrandKit | null;
  stations: Station[];
  dayparts: Daypart[];
  /** True if detections came from the mock source. */
  sampleData?: boolean;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const UNASSIGNED = 'Unassigned';

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function emptyPaidBonus(): PaidBonus {
  return { paid: 0, bonus: 0, unknown: 0 };
}

function addClass(target: PaidBonus, spotClass: string | null, quantity: number): void {
  if (spotClass === 'paid') target.paid += quantity;
  else if (spotClass === 'bonus') target.bonus += quantity;
  else target.unknown += quantity;
}

/** Only the latest asset version per import kind is active (matches Phase 2 Review). */
function activePlanRows(planRows: PcrPlanRow[]): PcrPlanRow[] {
  // Group by asset then take rows of the highest-version asset per row_kind.
  // Version is not on the plan row, so callers pass already-active rows in most
  // cases; here we approximate by keeping all rows (Phase 2 Review filters by
  // active asset before calling). To stay correct standalone, we keep every row
  // but the caller (StepReview) supplies active rows only.
  return planRows;
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

export function buildReportModel(inputs: BuildReportModelInputs): PcrReportModel {
  const { report, detections, inclusions, mediaLines, brandKit, stations, dayparts } = inputs;
  const planRows = activePlanRows(inputs.planRows);

  const nameByCallsign: Record<string, string> = {};
  for (const s of stations) nameByCallsign[s.callsign] = s.display_name;
  const displayName = (cs: string): string => nameByCallsign[cs] ?? cs;

  const daypartOrder = (brandKit?.dayparts ?? dayparts).map((d) => d.name);
  const orderIndex = (name: string): number => {
    const i = daypartOrder.indexOf(name);
    return i === -1 ? daypartOrder.length : i;
  };

  // Which stations appear: the report's selection, plus any plan-row station.
  const stationSet = new Set<string>(report.station_callsigns);
  for (const r of planRows) {
    if (r.station_callsign) stationSet.add(r.station_callsign);
  }
  const orderedStations = Array.from(stationSet);

  const includedDetections = detections.filter((d) => inclusions[d.id] ?? true);

  // ---- Broadcast: per-station daypart cells ----
  interface Cell {
    observed: number;
    aired: number;
    booked: number;
    airedClass: PaidBonus;
    bookedClass: PaidBonus;
    hasAired: boolean;
    hasBooked: boolean;
  }
  const makeCell = (): Cell => ({
    observed: 0,
    aired: 0,
    booked: 0,
    airedClass: emptyPaidBonus(),
    bookedClass: emptyPaidBonus(),
    hasAired: false,
    hasBooked: false,
  });

  // station -> daypart -> Cell
  const grid: Record<string, Record<string, Cell>> = {};
  const ensure = (station: string, daypart: string): Cell => {
    (grid[station] ??= {});
    return (grid[station][daypart] ??= makeCell());
  };

  let hasObserved = false;
  let hasAired = false;
  let hasBooked = false;

  for (const d of includedDetections) {
    hasObserved = true;
    ensure(d.stationCallsign, d.daypart || UNASSIGNED).observed += 1;
  }
  for (const r of planRows) {
    const station = r.station_callsign ?? r.station_raw ?? '(unresolved)';
    const daypart = r.daypart_raw ?? UNASSIGNED;
    const cell = ensure(station, daypart);
    if (r.row_kind === 'aired') {
      hasAired = true;
      cell.aired += 1;
      cell.hasAired = true;
      addClass(cell.airedClass, r.spot_class, 1);
    } else {
      hasBooked = true;
      const qty = r.spots ?? 1;
      cell.booked += qty;
      cell.hasBooked = true;
      addClass(cell.bookedClass, r.spot_class, qty);
    }
  }

  const allDayparts = new Set<string>();
  for (const station of Object.keys(grid)) {
    for (const dp of Object.keys(grid[station])) allDayparts.add(dp);
  }
  const daypartList = Array.from(allDayparts).sort((a, b) => orderIndex(a) - orderIndex(b));

  const buildBlock = (station: string): StationBlock => {
    const cells = grid[station] ?? {};
    const rows: DaypartRow[] = daypartList
      .filter((dp) => cells[dp])
      .map((dp) => {
        const c = cells[dp];
        return {
          daypart: dp,
          observed: hasObserved ? c.observed : null,
          aired: c.hasAired ? c.aired : null,
          booked: c.hasBooked ? c.booked : null,
          airedClass: c.hasAired ? c.airedClass : null,
          bookedClass: c.hasBooked ? c.bookedClass : null,
        };
      });
    const sum = (pick: (c: Cell) => number, present: (c: Cell) => boolean): number | null => {
      let anyPresent = false;
      let total = 0;
      for (const dp of Object.keys(cells)) {
        if (present(cells[dp])) {
          anyPresent = true;
          total += pick(cells[dp]);
        }
      }
      return anyPresent ? total : null;
    };
    return {
      callsign: station,
      displayName: displayName(station),
      rows,
      totals: {
        observed: hasObserved ? sum((c) => c.observed, () => true) : null,
        aired: sum((c) => c.aired, (c) => c.hasAired),
        booked: sum((c) => c.booked, (c) => c.hasBooked),
      },
    };
  };

  const stationBlocks = orderedStations
    .filter((s) => grid[s])
    .map(buildBlock)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Network total block: sum across stations per daypart.
  const totalCells: Record<string, Cell> = {};
  for (const station of Object.keys(grid)) {
    for (const [dp, c] of Object.entries(grid[station])) {
      const t = (totalCells[dp] ??= makeCell());
      t.observed += c.observed;
      t.aired += c.aired;
      t.booked += c.booked;
      t.hasAired = t.hasAired || c.hasAired;
      t.hasBooked = t.hasBooked || c.hasBooked;
      t.airedClass.paid += c.airedClass.paid;
      t.airedClass.bonus += c.airedClass.bonus;
      t.airedClass.unknown += c.airedClass.unknown;
      t.bookedClass.paid += c.bookedClass.paid;
      t.bookedClass.bonus += c.bookedClass.bonus;
      t.bookedClass.unknown += c.bookedClass.unknown;
    }
  }
  const totalBlock: StationBlock = {
    callsign: '__total__',
    displayName: 'All stations',
    rows: daypartList
      .filter((dp) => totalCells[dp])
      .map((dp) => {
        const c = totalCells[dp];
        return {
          daypart: dp,
          observed: hasObserved ? c.observed : null,
          aired: c.hasAired ? c.aired : null,
          booked: c.hasBooked ? c.booked : null,
          airedClass: c.hasAired ? c.airedClass : null,
          bookedClass: c.hasBooked ? c.bookedClass : null,
        };
      }),
    totals: {
      observed: hasObserved ? Object.values(totalCells).reduce((s, c) => s + c.observed, 0) : null,
      aired: hasAired ? Object.values(totalCells).reduce((s, c) => s + c.aired, 0) : null,
      booked: hasBooked ? Object.values(totalCells).reduce((s, c) => s + c.booked, 0) : null,
    },
  };

  // ---- Reconciliation: only where >=2 of the three exist per station ----
  const reconciliation: ReconciliationRow[] = stationBlocks
    .map((b) => {
      const present = [b.totals.observed, b.totals.aired, b.totals.booked].filter((v) => v !== null).length;
      if (present < 2) return null;
      const airedVsBooked =
        b.totals.aired !== null && b.totals.booked !== null ? b.totals.aired - b.totals.booked : null;
      const observedVsAired =
        b.totals.observed !== null && b.totals.aired !== null ? b.totals.observed - b.totals.aired : null;
      return {
        callsign: b.callsign,
        displayName: b.displayName,
        booked: b.totals.booked,
        aired: b.totals.aired,
        observed: b.totals.observed,
        airedVsBooked,
        observedVsAired,
      };
    })
    .filter((r): r is ReconciliationRow => r !== null);

  // ---- Media lines ----
  const scalarMetrics = (m: PcrMediaLine['metrics']): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(m ?? {})) {
      const n = num(v);
      if (n !== null && !['top_placements', 'per_post', 'state_split'].includes(k)) out[k] = n;
    }
    return out;
  };
  const asArray = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

  const audienceLines = mediaLines.filter((l) => l.line_type === 'audience');
  const nonAudience = mediaLines.filter((l) => l.line_type !== 'audience');

  const screenshotsByLine: Record<string, string[]> = {};
  for (const a of inputs.assets ?? []) {
    if (a.asset_type === 'screenshot' && a.media_line_id) {
      (screenshotsByLine[a.media_line_id] ??= []).push(a.storage_path);
    }
  }

  const mediaLineBlocks: MediaLineBlock[] = nonAudience.map((l) => {
    const placements = asArray(l.metrics?.top_placements)
      .map((p) => ({ name: String(p.name ?? ''), impressions: num(p.impressions) ?? 0 }))
      .filter((p) => p.name !== '');
    const perPost = asArray(l.metrics?.per_post)
      .map((p) => ({ label: String(p.label ?? ''), reach: num(p.reach) ?? 0 }))
      .filter((p) => p.label !== '');
    const splitObj = (l.metrics?.state_split ?? {}) as Record<string, unknown>;
    const stateSplit = Object.entries(splitObj)
      .map(([state, pct]) => ({ state, percent: num(pct) ?? 0 }))
      .filter((s) => s.percent !== 0);
    return {
      id: l.id,
      lineType: l.line_type,
      label: l.label,
      source: l.source,
      sourceNote: l.source_note,
      metrics: scalarMetrics(l.metrics),
      placements,
      perPost,
      stateSplit,
      screenshotPaths: screenshotsByLine[l.id] ?? [],
    };
  });

  const audience: AudienceBlock | null = audienceLines.length
    ? {
        label: audienceLines[0].label,
        sourceNote: audienceLines[0].source_note,
        metrics: scalarMetrics(audienceLines[0].metrics),
        demoLabel:
          typeof audienceLines[0].metrics?.demo_label === 'string'
            ? (audienceLines[0].metrics.demo_label as string)
            : null,
      }
    : null;

  // ---- Gaps ----
  const unresolvedStations = Array.from(
    new Set(planRows.filter((r) => !r.station_callsign).map((r) => r.station_raw))
  );
  const unknownSpotClassRows = planRows.filter((r) => r.spot_class === 'unknown').length;
  const excludedDetections = detections.filter((d) => !(inclusions[d.id] ?? true)).length;
  const mediaLinesMissingSource = mediaLines
    .filter((l) => (l.source_note ?? '').trim() === '')
    .map((l) => l.label || l.line_type);

  return {
    meta: {
      advertiser: report.advertiser,
      campaign: report.campaign_name,
      dateFrom: report.date_from,
      dateTo: report.date_to,
      stations: report.station_callsigns.map(displayName),
      stationCallsigns: report.station_callsigns,
      generatedAt: new Date().toISOString(),
    },
    broadcast: {
      dayparts: daypartList,
      stations: stationBlocks,
      total: totalBlock,
      hasObserved,
      hasAired,
      hasBooked,
    },
    reconciliation,
    mediaLines: mediaLineBlocks,
    audience,
    gaps: {
      unresolvedStations,
      unknownSpotClassRows,
      excludedDetections,
      mediaLinesMissingSource,
      sampleData: inputs.sampleData ?? false,
    },
  };
}
