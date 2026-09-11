import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, AlertTriangle, Lock, CheckCircle2 } from 'lucide-react';
import { PcrReport, PcrPlanRow, PcrMediaLine, PcrAsset, FigureSource, DEFAULT_DAYPARTS } from '../../../types/pcr';
import type { PcrDetection } from '../../../types/pcr';
import { useStations } from '../../../hooks/useStations';
import { useBrandKit } from '../../../hooks/useBrandKit';
import { fetchDetections } from '../../../lib/pcrDetections';
import { listInclusions, listPlanRows, listMediaLines, listAssets } from '../../../lib/pcrApi';

/*
  Step 5 — Review. Read-only. Every figure carries a source chip
  (motix_observed | uploaded | manual) and every gap is called out. The
  Generate button is present but disabled until Phase 3.
*/

interface StepReviewProps {
  report: PcrReport;
  onBack: () => void;
}

const SOURCE_LABEL: Record<FigureSource, string> = {
  motix_observed: 'MOTIX',
  uploaded: 'uploaded',
  manual: 'manual',
};
const SOURCE_STYLE: Record<FigureSource, string> = {
  motix_observed: 'bg-[#4131e0]/10 text-[#4131e0]',
  uploaded: 'bg-blue-100 text-blue-700',
  manual: 'bg-gray-200 text-gray-700',
};

function SourceChip({ source }: { source: FigureSource }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SOURCE_STYLE[source]}`}>
      {SOURCE_LABEL[source]}
    </span>
  );
}

interface Cell {
  station: string;
  daypart: string;
  booked: number;
  aired: number;
  motix: number;
}

export default function StepReview({ report, onBack }: StepReviewProps) {
  const { stations } = useStations();
  const { brandKit } = useBrandKit();
  const dayparts = brandKit?.dayparts ?? DEFAULT_DAYPARTS;
  const daypartsKey = JSON.stringify(dayparts);

  const [detections, setDetections] = useState<PcrDetection[]>([]);
  const [inclusionMap, setInclusionMap] = useState<Record<string, boolean>>({});
  const [planRows, setPlanRows] = useState<PcrPlanRow[]>([]);
  const [assets, setAssets] = useState<PcrAsset[]>([]);
  const [mediaLines, setMediaLines] = useState<PcrMediaLine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mirrorMissing, setMirrorMissing] = useState<boolean>(false);

  const load = useCallback(async (): Promise<void> => {
    if (stations.length === 0) return;
    setIsLoading(true);
    try {
      const [det, incl, rows, lines, assetRows] = await Promise.all([
        fetchDetections({
          advertiser: report.advertiser,
          dateFrom: report.date_from,
          dateTo: report.date_to,
          stationCallsigns: report.station_callsigns,
          stations,
          dayparts,
        }),
        listInclusions(report.id),
        listPlanRows(report.id),
        listMediaLines(report.id),
        listAssets(report.id),
      ]);
      setDetections(det.detections);
      setMirrorMissing(det.mirrorMissing);
      const map: Record<string, boolean> = {};
      for (const r of incl) map[r.detection_id] = r.included;
      setInclusionMap(map);
      setPlanRows(rows);
      setAssets(assetRows);
      setMediaLines(lines);
      setError(det.error && !det.mirrorMissing ? det.error : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build review');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id, stations, daypartsKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const stationName = (callsign: string): string =>
    stations.find((s) => s.callsign === callsign)?.display_name ?? callsign;

  // A re-import creates a new asset version; only the latest version of each
  // import kind is active, so Review counts rows from those assets only.
  const activeAssetIds = useMemo(() => {
    const latestByType: Record<string, PcrAsset> = {};
    for (const a of assets) {
      if (a.asset_type !== 'media_plan' && a.asset_type !== 'delivery_log') continue;
      const cur = latestByType[a.asset_type];
      if (!cur || a.version > cur.version) latestByType[a.asset_type] = a;
    }
    return new Set(Object.values(latestByType).map((a) => a.id));
  }, [assets]);

  const activePlanRows = useMemo(
    () => planRows.filter((r) => activeAssetIds.has(r.asset_id)),
    [planRows, activeAssetIds]
  );

  const cells = useMemo(() => {
    const map = new Map<string, Cell>();
    const keyOf = (station: string, daypart: string): string => `${station}|${daypart}`;
    const ensure = (station: string, daypart: string): Cell => {
      const key = keyOf(station, daypart);
      let cell = map.get(key);
      if (!cell) {
        cell = { station, daypart, booked: 0, aired: 0, motix: 0 };
        map.set(key, cell);
      }
      return cell;
    };
    for (const d of detections) {
      if (!(inclusionMap[d.id] ?? true)) continue;
      ensure(d.stationCallsign, d.daypart).motix += 1;
    }
    for (const r of activePlanRows) {
      const station = r.station_callsign ?? r.station_raw ?? '(unresolved)';
      const daypart = r.daypart_raw ?? 'Unassigned';
      const cell = ensure(station, daypart);
      // Booked lines carry a spot quantity; aired rows are one spot each.
      if (r.row_kind === 'booked') cell.booked += r.spots ?? 1;
      else cell.aired += 1;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.station === b.station ? a.daypart.localeCompare(b.daypart) : a.station.localeCompare(b.station)
    );
  }, [detections, inclusionMap, activePlanRows]);

  const hasBooked = activePlanRows.some((r) => r.row_kind === 'booked');
  const hasAired = activePlanRows.some((r) => r.row_kind === 'aired');

  const gaps = useMemo(() => {
    const list: string[] = [];
    const unresolved = Array.from(new Set(activePlanRows.filter((r) => !r.station_callsign).map((r) => r.station_raw)));
    if (unresolved.length > 0) list.push(`Unresolved station names in imports: ${unresolved.join(', ')}.`);
    const unknown = activePlanRows.filter((r) => r.spot_class === 'unknown').length;
    if (unknown > 0) list.push(`${unknown} imported row(s) have an unknown paid/bonus classification.`);
    const missingNotes = mediaLines.filter((l) => (l.source_note ?? '').trim() === '');
    if (missingNotes.length > 0) {
      list.push(`${missingNotes.length} media line(s) are missing a source note.`);
    }
    const excluded = detections.filter((d) => !(inclusionMap[d.id] ?? true)).length;
    if (excluded > 0) list.push(`${excluded} MOTIX detection(s) excluded from this report.`);
    if (mirrorMissing) list.push('MOTIX broadcast figures are unavailable (mirror not synced yet).');
    return list;
  }, [activePlanRows, mediaLines, detections, inclusionMap, mirrorMissing]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[#4131e0]" /> Building review…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      {/* Broadcast */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">Broadcast delivery</h3>
        {cells.length === 0 ? (
          <p className="text-sm text-gray-500">No broadcast figures from any source yet.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Station</th>
                  <th className="text-left px-3 py-2 font-medium">Daypart</th>
                  {hasBooked && <th className="text-right px-3 py-2 font-medium">Booked</th>}
                  {hasAired && <th className="text-right px-3 py-2 font-medium">Aired</th>}
                  <th className="text-right px-3 py-2 font-medium">MOTIX</th>
                </tr>
              </thead>
              <tbody>
                {cells.map((c) => (
                  <tr key={`${c.station}|${c.daypart}`} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{stationName(c.station)}</td>
                    <td className="px-3 py-2 text-gray-600">{c.daypart}</td>
                    {hasBooked && (
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex items-center gap-1">{c.booked || '—'} {c.booked > 0 && <SourceChip source="uploaded" />}</span>
                      </td>
                    )}
                    {hasAired && (
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex items-center gap-1">{c.aired || '—'} {c.aired > 0 && <SourceChip source="uploaded" />}</span>
                      </td>
                    )}
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center gap-1">{c.motix || '—'} {c.motix > 0 && <SourceChip source="motix_observed" />}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Off-broadcast media lines */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">Off-broadcast media</h3>
        {mediaLines.length === 0 ? (
          <p className="text-sm text-gray-500">No off-broadcast lines added.</p>
        ) : (
          <div className="space-y-1">
            {mediaLines.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-sm border border-gray-100 rounded px-3 py-2">
                <span className="text-xs uppercase tracking-wide text-gray-400 w-24">{l.line_type}</span>
                <span className="flex-1 text-gray-800">{l.label}</span>
                <SourceChip source={l.source} />
                {(l.source_note ?? '').trim() === '' ? (
                  <span className="text-[10px] text-amber-600">no source note</span>
                ) : (
                  <span className="text-[10px] text-gray-400 truncate max-w-[160px]">{l.source_note}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Gaps */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">Gaps</h3>
        {gaps.length === 0 ? (
          <p className="text-sm text-green-700 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> No gaps detected.
          </p>
        ) : (
          <ul className="space-y-1">
            {gaps.map((g) => (
              <li key={g} className="text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {g}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <span title="Available in Phase 3">
          <button
            disabled
            className="bg-gray-200 text-gray-500 px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 cursor-not-allowed"
          >
            <Lock className="w-4 h-4" /> Generate
          </button>
        </span>
      </div>
    </div>
  );
}
