import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { Loader2, AlertTriangle, Radio } from 'lucide-react';
import { PcrReport } from '../../../types/pcr';
import { useStations } from '../../../hooks/useStations';
import { useBrandKit } from '../../../hooks/useBrandKit';
import { DEFAULT_DAYPARTS } from '../../../types/pcr';
import { fetchDetections } from '../../../lib/pcrDetections';
import { summariseDetections } from '../../../lib/pcrMetrics';
import { listInclusions, upsertInclusions, InclusionInput } from '../../../lib/pcrApi';
import type { PcrDetection } from '../../../types/pcr';

/*
  Step 2 — MOTIX detections. Pulls observed detections for the report's
  advertiser / dates / stations from the mirror, groups by station then
  daypart, and lets the user include/exclude each. Decisions persist to
  pcr_detection_inclusions. Never invents rows; an empty/absent mirror shows
  an amber banner.
*/

interface StepDetectionsProps {
  report: PcrReport;
  agencyId: string;
  userId: string | null;
  onBack: () => void;
  onNext: () => void;
}

export default function StepDetections({ report, agencyId, userId, onBack, onNext }: StepDetectionsProps) {
  const { stations } = useStations();
  const { brandKit } = useBrandKit();
  const dayparts = brandKit?.dayparts ?? DEFAULT_DAYPARTS;

  const [detections, setDetections] = useState<PcrDetection[]>([]);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [inclusions, setInclusions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mirrorMissing, setMirrorMissing] = useState<boolean>(false);

  const load = useCallback(async (): Promise<void> => {
    if (stations.length === 0) return;
    setIsLoading(true);
    try {
      const [result, existing] = await Promise.all([
        fetchDetections({
          advertiser: report.advertiser,
          dateFrom: report.date_from,
          dateTo: report.date_to,
          stationCallsigns: report.station_callsigns,
          stations,
          dayparts,
        }),
        listInclusions(report.id),
      ]);
      setDetections(result.detections);
      setUnresolved(result.unresolvedStations);
      setError(result.error);
      setMirrorMissing(result.mirrorMissing);

      const existingMap: Record<string, boolean> = {};
      for (const row of existing) existingMap[row.detection_id] = row.included;
      const seeded: Record<string, boolean> = {};
      for (const d of result.detections) seeded[d.id] = existingMap[d.id] ?? true;
      setInclusions(seeded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load detections');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id, report.advertiser, report.date_from, report.date_to, stations]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (changed: Array<{ id: string; included: boolean }>): Promise<void> => {
      if (changed.length === 0) return;
      const rows: InclusionInput[] = changed.map((c) => ({
        report_id: report.id,
        agency_id: agencyId,
        detection_id: c.id,
        included: c.included,
        decided_by: userId,
      }));
      try {
        await upsertInclusions(rows);
      } catch {
        /* toast handled at a higher level if needed; keep UI responsive */
      }
    },
    [report.id, agencyId, userId]
  );

  const toggle = (id: string): void => {
    setInclusions((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) };
      void persist([{ id, included: next[id] }]);
      return next;
    });
  };

  const setGroup = (ids: string[], included: boolean): void => {
    setInclusions((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = included;
      void persist(ids.map((id) => ({ id, included })));
      return next;
    });
  };

  const summary = useMemo(() => summariseDetections(detections, inclusions), [detections, inclusions]);

  // Group by station callsign, then by daypart.
  const grouped = useMemo(() => {
    const byStation: Record<string, PcrDetection[]> = {};
    for (const d of detections) {
      (byStation[d.stationCallsign] ??= []).push(d);
    }
    return Object.entries(byStation).map(([callsign, rows]) => {
      const byDaypart: Record<string, PcrDetection[]> = {};
      for (const r of rows) (byDaypart[r.daypart] ??= []).push(r);
      return { callsign, rows, byDaypart };
    });
  }, [detections]);

  const stationName = (callsign: string): string =>
    stations.find((s) => s.callsign === callsign)?.display_name ?? callsign;

  const showBanner = !isLoading && (mirrorMissing || detections.length === 0 || unresolved.length > 0 || !!error);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#4131e0]" /> Loading MOTIX detections…
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="flex flex-wrap gap-3">
            <div className="px-3 py-2 rounded-lg bg-[#4131e0]/10 text-[#4131e0] text-sm font-semibold flex items-center gap-2">
              <Radio className="w-4 h-4" /> {summary.total} included
            </div>
            {Object.entries(summary.byEventType).map(([et, n]) => (
              <div key={et} className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm">
                {et}: {n}
              </div>
            ))}
            <div className="px-3 py-2 rounded-lg bg-gray-50 text-gray-500 text-sm">
              {detections.length} observed
            </div>
          </div>

          {showBanner && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                {mirrorMissing ? (
                  <p>
                    The MOTIX detections mirror is not available for this workspace yet. Broadcast
                    figures will populate once the backend sync is live.
                  </p>
                ) : detections.length === 0 ? (
                  <p>
                    No MOTIX detections found for this selection. Check the advertiser spelling and
                    station list. <strong>Not detected does not mean not aired.</strong>
                  </p>
                ) : null}
                {unresolved.length > 0 && (
                  <p className="mt-1">
                    Unrecognised station values in the mirror: {unresolved.join(', ')}. These rows are
                    shown but not grouped to a registry station.
                  </p>
                )}
                {error && !mirrorMissing && <p className="mt-1">{error}</p>}
              </div>
            </div>
          )}

          {/* Grouped tables */}
          {grouped.map((group) => {
            const groupIds = group.rows.map((r) => r.id);
            const includedCount = groupIds.filter((id) => inclusions[id] ?? true).length;
            return (
              <div key={group.callsign} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
                  <span className="text-sm font-semibold text-[#191715]">
                    {stationName(group.callsign)}{' '}
                    <span className="text-gray-400 font-normal">
                      ({includedCount}/{group.rows.length} included)
                    </span>
                  </span>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setGroup(groupIds, true)} className="text-[#4131e0] hover:underline">
                      Include all
                    </button>
                    <button onClick={() => setGroup(groupIds, false)} className="text-gray-500 hover:underline">
                      Exclude all
                    </button>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {Object.entries(group.byDaypart).map(([daypart, rows]) => (
                      <Fragment key={`${group.callsign}-${daypart}`}>
                        <tr className="bg-white">
                          <td colSpan={5} className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400">
                            {daypart}
                          </td>
                        </tr>
                        {rows.map((d) => {
                          const included = inclusions[d.id] ?? true;
                          return (
                            <tr key={d.id} className={`border-t border-gray-100 ${included ? '' : 'opacity-50'}`}>
                              <td className="px-4 py-1.5 w-10">
                                <input
                                  type="checkbox"
                                  checked={included}
                                  onChange={() => toggle(d.id)}
                                  aria-label={`Include detection ${d.id}`}
                                />
                              </td>
                              <td className="px-2 py-1.5 text-gray-700">{d.localDate} {d.localTime}</td>
                              <td className="px-2 py-1.5 text-gray-600">{String(d.eventType)}</td>
                              <td className="px-2 py-1.5 text-right text-gray-600">{d.durationSec ?? '—'}s</td>
                              <td className="px-2 py-1.5 text-gray-500">{d.confidenceTier ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <button
          onClick={onNext}
          className="bg-[#4131e0] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#4131e0]/90"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
