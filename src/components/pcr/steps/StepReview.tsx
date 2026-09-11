import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, Sparkles, FileDown, Download } from 'lucide-react';
import {
  PcrReport, PcrPlanRow, PcrMediaLine, PcrAsset, FigureSource, Narrative, DEFAULT_DAYPARTS,
} from '../../../types/pcr';
import type { PcrDetection } from '../../../types/pcr';
import { useStations } from '../../../hooks/useStations';
import { useBrandKit } from '../../../hooks/useBrandKit';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import { fetchDetections } from '../../../lib/pcrDetections';
import { listInclusions, listPlanRows, listMediaLines, listAssets, updateReport } from '../../../lib/pcrApi';
import { buildReportModel } from '../../../lib/pcr/reportModel';
import { generatePptx } from '../../../lib/pcr/pptxGenerator';
import { generatePdf } from '../../../lib/pcr/pdfExport';
import { coerceNarrative } from '../../../lib/pcr/narrative';
import { makeAssetResolver, sanitiseFilename, downloadBlob } from '../../../lib/pcr/exportAssets';

/*
  Step 5 — Review, narrative and export. Every figure carries a source chip.
  The user can draft a narrative (via the pcr-narrative Edge Function), edit
  every field, and generate a branded PPTX + PDF entirely client-side.
*/

interface StepReviewProps {
  report: PcrReport;
  onBack: () => void;
  onExported?: (updated: PcrReport) => void;
}

const SOURCE_LABEL: Record<FigureSource, string> = { motix_observed: 'MOTIX', uploaded: 'uploaded', manual: 'manual' };
const SOURCE_STYLE: Record<FigureSource, string> = {
  motix_observed: 'bg-[#4131e0]/10 text-[#4131e0]',
  uploaded: 'bg-blue-100 text-blue-700',
  manual: 'bg-gray-200 text-gray-700',
};

function SourceChip({ source }: { source: FigureSource }) {
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SOURCE_STYLE[source]}`}>{SOURCE_LABEL[source]}</span>;
}

interface Cell { station: string; daypart: string; booked: number; aired: number; motix: number }

function narrativeFromReport(report: PcrReport): Narrative {
  const n = report.narrative as Narrative | null;
  return {
    overview: typeof n?.overview === 'string' ? n.overview : '',
    sections: n?.sections && typeof n.sections === 'object' ? { ...n.sections } : {},
  };
}

export default function StepReview({ report, onBack, onExported }: StepReviewProps) {
  const { stations } = useStations();
  const { brandKit } = useBrandKit();
  const { addToast } = useToast();
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
  const [sampleData, setSampleData] = useState<boolean>(false);

  const [overview, setOverview] = useState<string>('');
  const [sections, setSections] = useState<Record<string, string>>({});
  const [isDrafting, setIsDrafting] = useState<boolean>(false);
  const [draftFailed, setDraftFailed] = useState<boolean>(false);
  const [isSavingNarrative, setIsSavingNarrative] = useState<boolean>(false);

  const [genState, setGenState] = useState<'idle' | 'pptx' | 'pdf' | 'done'>('idle');

  const load = useCallback(async (): Promise<void> => {
    if (stations.length === 0) return;
    setIsLoading(true);
    try {
      const [det, incl, rows, lines, assetRows] = await Promise.all([
        fetchDetections({
          advertiser: report.advertiser, dateFrom: report.date_from, dateTo: report.date_to,
          stationCallsigns: report.station_callsigns, stations, dayparts,
        }),
        listInclusions(report.id),
        listPlanRows(report.id),
        listMediaLines(report.id),
        listAssets(report.id),
      ]);
      setDetections(det.detections);
      setMirrorMissing(det.mirrorMissing);
      setSampleData(det.source === 'mock' && det.detections.length > 0);
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

  // Seed narrative editors from the saved report once.
  useEffect(() => {
    const n = narrativeFromReport(report);
    setOverview(n.overview);
    setSections(n.sections);
  }, [report.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const stationName = (callsign: string): string =>
    stations.find((s) => s.callsign === callsign)?.display_name ?? callsign;

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

  // The single computed model, reused by the tables, the narrative call and export.
  const model = useMemo(
    () =>
      buildReportModel({
        report, detections, inclusions: inclusionMap, planRows: activePlanRows,
        mediaLines, assets, brandKit, stations, dayparts, sampleData,
      }),
    [report, detections, inclusionMap, activePlanRows, mediaLines, assets, brandKit, stations, dayparts, sampleData]
  );

  const cells = useMemo(() => {
    const map = new Map<string, Cell>();
    const ensure = (station: string, daypart: string): Cell => {
      const key = `${station}|${daypart}`;
      let cell = map.get(key);
      if (!cell) { cell = { station, daypart, booked: 0, aired: 0, motix: 0 }; map.set(key, cell); }
      return cell;
    };
    for (const d of detections) {
      if (!(inclusionMap[d.id] ?? true)) continue;
      ensure(d.stationCallsign, d.daypart).motix += 1;
    }
    for (const r of activePlanRows) {
      const station = r.station_callsign ?? r.station_raw ?? '(unresolved)';
      const cell = ensure(station, r.daypart_raw ?? 'Unassigned');
      if (r.row_kind === 'booked') cell.booked += r.spots ?? 1;
      else cell.aired += 1;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.station === b.station ? a.daypart.localeCompare(b.daypart) : a.station.localeCompare(b.station)
    );
  }, [detections, inclusionMap, activePlanRows]);

  const hasBooked = activePlanRows.some((r) => r.row_kind === 'booked');
  const hasAired = activePlanRows.some((r) => r.row_kind === 'aired');

  // Section keys that need a narrative line, derived from the model.
  const sectionKeys = useMemo(() => {
    const keys: string[] = [];
    const b = model.broadcast;
    if (b.hasObserved || b.hasAired || b.hasBooked) keys.push('broadcast');
    if (model.reconciliation.length > 0) keys.push('reconciliation');
    for (const l of model.mediaLines) keys.push(l.lineType);
    if (model.audience) keys.push('audience');
    return Array.from(new Set(keys));
  }, [model]);

  const gaps = model.gaps;
  const gapMessages = useMemo(() => {
    const list: string[] = [];
    if (gaps.unresolvedStations.length) list.push(`Unresolved station names in imports: ${gaps.unresolvedStations.join(', ')}.`);
    if (gaps.unknownSpotClassRows) list.push(`${gaps.unknownSpotClassRows} imported row(s) have an unknown paid/bonus classification.`);
    if (gaps.mediaLinesMissingSource.length) list.push(`${gaps.mediaLinesMissingSource.length} media line(s) are missing a source note.`);
    if (gaps.excludedDetections) list.push(`${gaps.excludedDetections} MOTIX detection(s) excluded from this report.`);
    if (mirrorMissing) list.push('MOTIX broadcast figures are unavailable (mirror not synced yet).');
    if (sampleData) list.push('Broadcast figures are sample data (no live feed connected).');
    return list;
  }, [gaps, mirrorMissing, sampleData]);

  // ---- Narrative ----
  const handleDraft = async (): Promise<void> => {
    setIsDrafting(true);
    setDraftFailed(false);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pcr-narrative', {
        body: {
          model,
          tone_description: brandKit?.tone_description ?? '',
          tone_reference: brandKit?.tone_reference ?? '',
        },
      });
      const narrative = coerceNarrative(data);
      if (fnError || (narrative.overview === '' && Object.keys(narrative.sections).length === 0)) {
        setDraftFailed(true);
      } else {
        setOverview(narrative.overview);
        setSections((prev) => ({ ...prev, ...narrative.sections }));
        addToast('success', 'Draft narrative created. Edit anything before generating.');
      }
    } catch {
      setDraftFailed(true);
    } finally {
      setIsDrafting(false);
    }
  };

  const saveNarrative = async (): Promise<PcrReport | null> => {
    setIsSavingNarrative(true);
    try {
      const narrative: Narrative = { overview: overview.trim(), sections, editedAt: new Date().toISOString() };
      const updated = await updateReport(report.id, { narrative });
      addToast('success', 'Narrative saved.');
      return updated;
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save narrative');
      return null;
    } finally {
      setIsSavingNarrative(false);
    }
  };

  // ---- Generate / export ----
  const currentNarrative = (): Narrative => ({ overview: overview.trim(), sections, editedAt: new Date().toISOString() });
  const baseName = sanitiseFilename(`${report.advertiser}_${report.campaign_name}_PCR`);

  const handleGenerate = async (): Promise<void> => {
    setGenState('pptx');
    try {
      // Persist the edited narrative first so export uses the saved copy.
      await saveNarrative();
      const resolver = makeAssetResolver();
      const blob = await generatePptx(model, brandKit, { narrative: currentNarrative(), assetResolver: resolver });
      downloadBlob(blob, `${baseName}.pptx`);
      const updated = await updateReport(report.id, { status: 'exported' });
      onExported?.(updated);
      setGenState('done');
      addToast('success', 'PowerPoint generated and downloaded.');
    } catch (err) {
      setGenState('idle');
      addToast('error', err instanceof Error ? err.message : 'Generation failed');
    }
  };

  const handleDownloadPdf = async (): Promise<void> => {
    setGenState('pdf');
    try {
      const resolver = makeAssetResolver();
      const blob = await generatePdf(model, brandKit, { narrative: currentNarrative(), assetResolver: resolver });
      downloadBlob(blob, `${baseName}.pdf`);
      setGenState('done');
      addToast('success', 'PDF generated and downloaded.');
    } catch (err) {
      setGenState('idle');
      addToast('error', err instanceof Error ? err.message : 'PDF generation failed');
    }
  };

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
                      <td className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">{c.booked || '—'} {c.booked > 0 && <SourceChip source="uploaded" />}</span></td>
                    )}
                    {hasAired && (
                      <td className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">{c.aired || '—'} {c.aired > 0 && <SourceChip source="uploaded" />}</span></td>
                    )}
                    <td className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">{c.motix || '—'} {c.motix > 0 && <SourceChip source="motix_observed" />}</span></td>
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

      {/* Narrative */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Narrative</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleDraft()}
              disabled={isDrafting}
              className="text-sm text-[#4131e0] border border-[#4131e0] px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 hover:bg-[#4131e0]/5 disabled:opacity-50"
            >
              {isDrafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isDrafting ? 'Drafting…' : 'Draft narrative'}
            </button>
            <button
              onClick={() => void saveNarrative()}
              disabled={isSavingNarrative}
              className="text-sm text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Save narrative
            </button>
          </div>
        </div>
        {draftFailed && (
          <p className="text-xs text-gray-500 mb-2">Couldn't draft automatically — write the copy yourself below.</p>
        )}
        <label className="block text-xs font-medium text-gray-600 mb-1">Campaign overview</label>
        <textarea
          value={overview}
          onChange={(e) => setOverview(e.target.value)}
          rows={4}
          placeholder="A short overview of the campaign delivery. You can draft this or write it yourself."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
        />
        {sectionKeys.length > 0 && (
          <div className="space-y-2">
            {sectionKeys.map((key) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{key} summary</label>
                <input
                  type="text"
                  value={sections[key] ?? ''}
                  onChange={(e) => setSections((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={`One line about ${key}.`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Gaps */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">Gaps</h3>
        {gapMessages.length === 0 ? (
          <p className="text-sm text-green-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> No gaps detected.</p>
        ) : (
          <ul className="space-y-1">
            {gapMessages.map((g) => (
              <li key={g} className="text-sm text-amber-800 flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {g}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Generate / export */}
      <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t border-gray-100">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <div className="flex items-center gap-3">
          {genState === 'done' && (
            <span className="text-sm text-green-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Report exported</span>
          )}
          <button
            onClick={() => void handleDownloadPdf()}
            disabled={genState === 'pptx' || genState === 'pdf'}
            className="border border-[#4131e0] text-[#4131e0] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#4131e0]/5 disabled:opacity-50"
          >
            {genState === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Download PDF
          </button>
          <button
            onClick={() => void handleGenerate()}
            disabled={genState === 'pptx' || genState === 'pdf'}
            className="bg-[#4131e0] text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#4131e0]/90 disabled:opacity-50"
          >
            {genState === 'pptx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {genState === 'pptx' ? 'Generating…' : 'Generate PowerPoint'}
          </button>
        </div>
      </div>
    </div>
  );
}
