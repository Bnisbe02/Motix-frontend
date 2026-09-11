import { useState, useMemo, useCallback } from 'react';
import { X, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useStations } from '../../hooks/useStations';
import { useAgency } from '../../hooks/useAgency';
import { useToast } from '../../contexts/ToastContext';
import { RowKind, PcrPlanRowInput } from '../../types/pcr';
import { buildStationIndex } from '../../lib/stationResolve';
import {
  TabularData,
  WorkbookHandle,
  readWorkbookFile,
  parseDelimitedText,
  autoMapColumns,
  detectSpotClassColumn,
  normalisePlanRows,
  AIRED_TARGETS,
  BOOKED_TARGETS,
  MapTarget,
} from '../../lib/tabularImport';
import { uploadPcrAsset, insertPlanRows } from '../../lib/pcrApi';

/*
  PlanImporter — a modal wizard shared by Step 3 for both a booked media plan
  and an aired delivery log. Steps: upload -> (choose sheet) -> map columns ->
  preview 20 rows with resolved stations and spot class -> confirm. On confirm
  it uploads the file to pcr-assets as a new version and bulk-inserts the
  normalised rows into pcr_plan_rows.
*/

interface PlanImporterProps {
  isOpen: boolean;
  reportId: string;
  kind: RowKind;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'upload' | 'sheet' | 'map' | 'preview';

const KIND_LABEL: Record<RowKind, string> = {
  booked: 'media plan (booked spots)',
  aired: 'delivery log (aired posts)',
};

export default function PlanImporter({ isOpen, reportId, kind, onClose, onComplete }: PlanImporterProps) {
  const { stations } = useStations();
  const { agencyId } = useAgency();
  const { addToast } = useToast();

  const targets: MapTarget[] = kind === 'aired' ? AIRED_TARGETS : BOOKED_TARGETS;

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<WorkbookHandle | null>(null);
  const [sheetName, setSheetName] = useState<string>('');
  const [data, setData] = useState<TabularData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [spotClassHeader, setSpotClassHeader] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const stationIndex = useMemo(() => buildStationIndex(stations), [stations]);
  const tzForCallsign = useCallback(
    (callsign: string): string | undefined => stations.find((s) => s.callsign === callsign)?.timezone,
    [stations]
  );

  const reset = (): void => {
    setStep('upload');
    setFile(null);
    setWorkbook(null);
    setSheetName('');
    setData(null);
    setMapping({});
    setSpotClassHeader(null);
    setOverrides({});
    setIsBusy(false);
    setError(null);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const loadSheet = (handle: WorkbookHandle, name: string): void => {
    const sheet = handle.readSheet(name);
    if (sheet.headers.length === 0) {
      setError('That sheet has no readable header row.');
      return;
    }
    setData(sheet);
    const autoMapped = autoMapColumns(sheet.headers, targets);
    setMapping(autoMapped);
    setSpotClassHeader(detectSpotClassColumn(sheet));
    setError(null);
    setStep('map');
  };

  const handleFile = async (picked: File): Promise<void> => {
    setFile(picked);
    setError(null);
    setIsBusy(true);
    try {
      const isCsv = /\.csv$/i.test(picked.name) || picked.type === 'text/csv';
      let handle: WorkbookHandle;
      if (isCsv) {
        const text = await picked.text();
        const parsed = parseDelimitedText(text);
        handle = { sheetNames: ['CSV'], readSheet: () => parsed };
      } else {
        handle = await readWorkbookFile(picked);
      }
      setWorkbook(handle);
      if (handle.sheetNames.length > 1) {
        setSheetName(handle.sheetNames[0]);
        setStep('sheet');
      } else {
        setSheetName(handle.sheetNames[0]);
        loadSheet(handle, handle.sheetNames[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setIsBusy(false);
    }
  };

  const normalisedAll = useMemo(() => {
    if (!data) return [];
    return normalisePlanRows(data, mapping, kind, spotClassHeader, {
      stationIndex,
      timezoneForCallsign: tzForCallsign,
      stationOverrides: overrides,
    });
  }, [data, mapping, kind, spotClassHeader, stationIndex, tzForCallsign, overrides]);

  const unresolvedRawNames = useMemo(() => {
    const names = new Set<string>();
    for (const r of normalisedAll) {
      if (r.station_callsign === null && r.station_raw) names.add(r.station_raw);
    }
    return Array.from(names);
  }, [normalisedAll]);

  const handleConfirm = async (): Promise<void> => {
    if (!file || !agencyId) {
      setError('Missing file or agency.');
      return;
    }
    if (!mapping.station) {
      setError('Map the Station column before importing.');
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const asset = await uploadPcrAsset({
        file,
        reportId,
        agencyId,
        assetType: kind === 'booked' ? 'media_plan' : 'delivery_log',
      });
      const rows: PcrPlanRowInput[] = normalisedAll.map((r) => ({
        report_id: reportId,
        agency_id: agencyId,
        asset_id: asset.id,
        ...r,
      }));
      await insertPlanRows(rows);
      addToast('success', `Imported ${rows.length} ${kind} rows (v${asset.version}).`);
      reset();
      onComplete();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed.';
      setError(message);
      addToast('error', message);
    } finally {
      setIsBusy(false);
    }
  };

  if (!isOpen) return null;

  const preview = normalisedAll.slice(0, 20);
  const paidCount = normalisedAll.filter((r) => r.spot_class === 'paid').length;
  const unknownCount = normalisedAll.filter((r) => r.spot_class === 'unknown').length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 z-10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#191715]">Import {KIND_LABEL[kind]}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              CSV or Excel. Columns are auto-mapped; adjust anything that looks wrong.
            </p>
          </div>
          <button onClick={handleClose} aria-label="Close importer" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step: upload */}
          {step === 'upload' && (
            <label
              className={`flex flex-col items-center justify-center h-48 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                isBusy ? 'opacity-60' : 'border-gray-300 hover:border-[#4131e0]'
              }`}
            >
              {isBusy ? (
                <Loader2 className="w-6 h-6 animate-spin text-[#4131e0]" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-700">Drop a file or click to browse</span>
                  <span className="text-xs text-gray-400 mt-1">.csv, .xlsx, .xls</span>
                </>
              )}
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={isBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          )}

          {/* Step: choose sheet */}
          {step === 'sheet' && workbook && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Choose a sheet</label>
              <select
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
              >
                {workbook.sheetNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={() => setStep('upload')} className="text-sm text-gray-500 hover:text-gray-700">
                  ← Back
                </button>
                <button
                  onClick={() => workbook && loadSheet(workbook, sheetName)}
                  className="flex-1 bg-[#4131e0] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#4131e0]/90"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step: map columns */}
          {step === 'map' && data && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {targets.map((t) => (
                  <div key={t.key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t.label} {t.required && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={mapping[t.key] ?? ''}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [t.key]: e.target.value || null }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                    >
                      <option value="">— not mapped —</option>
                      {data.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Spot class column (paid/bonus)</label>
                  <select
                    value={spotClassHeader ?? ''}
                    onChange={(e) => setSpotClassHeader(e.target.value || null)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                  >
                    <option value="">— infer from media value —</option>
                    {data.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('upload')} className="text-sm text-gray-500 hover:text-gray-700">
                  ← Back
                </button>
                <button
                  onClick={() => (mapping.station ? setStep('preview') : setError('Map the Station column first.'))}
                  className="flex-1 bg-[#4131e0] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#4131e0]/90"
                >
                  Preview →
                </button>
              </div>
            </div>
          )}

          {/* Step: preview */}
          {step === 'preview' && data && (
            <div>
              <div className="flex flex-wrap gap-3 mb-3 text-xs">
                <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">{normalisedAll.length} rows</span>
                <span className="px-2 py-1 rounded bg-green-100 text-green-700">{paidCount} paid</span>
                {unknownCount > 0 && (
                  <span className="px-2 py-1 rounded bg-amber-100 text-amber-700">{unknownCount} unknown class</span>
                )}
                {unresolvedRawNames.length > 0 && (
                  <span className="px-2 py-1 rounded bg-red-100 text-red-700">
                    {unresolvedRawNames.length} unresolved station{unresolvedRawNames.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {unresolvedRawNames.length > 0 && (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-2">
                    Assign unrecognised station names (applies to all their rows):
                  </p>
                  <div className="space-y-2">
                    {unresolvedRawNames.map((raw) => (
                      <div key={raw} className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 flex-1 truncate">{raw || '(blank)'}</span>
                        <select
                          value={overrides[raw] ?? ''}
                          onChange={(e) =>
                            setOverrides((prev) => {
                              const next = { ...prev };
                              if (e.target.value) next[raw] = e.target.value;
                              else delete next[raw];
                              return next;
                            })
                          }
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
                        >
                          <option value="">— leave unresolved —</option>
                          {stations.map((s) => (
                            <option key={s.callsign} value={s.callsign}>
                              {s.display_name} ({s.callsign})
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium">Station</th>
                      <th className="text-left px-2 py-1.5 font-medium">{kind === 'aired' ? 'Aired (UTC)' : 'Booked date'}</th>
                      <th className="text-left px-2 py-1.5 font-medium">Daypart</th>
                      <th className="text-right px-2 py-1.5 font-medium">Dur</th>
                      <th className="text-left px-2 py-1.5 font-medium">Creative</th>
                      <th className="text-left px-2 py-1.5 font-medium">Class</th>
                      <th className="text-right px-2 py-1.5 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1">
                          {r.station_callsign ? (
                            <span className="text-gray-800">{r.station_callsign}</span>
                          ) : (
                            <span className="text-red-600" title={r.station_raw}>{r.station_raw || '(blank)'} ⚠</span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-gray-700">
                          {kind === 'aired' ? r.aired_at ?? '—' : r.booked_date ?? '—'}
                        </td>
                        <td className="px-2 py-1 text-gray-700">{r.daypart_raw ?? '—'}</td>
                        <td className="px-2 py-1 text-right text-gray-700">{r.duration_sec ?? '—'}</td>
                        <td className="px-2 py-1 text-gray-700">{r.creative_code ?? '—'}</td>
                        <td className="px-2 py-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              r.spot_class === 'paid'
                                ? 'bg-green-100 text-green-700'
                                : r.spot_class === 'bonus'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {r.spot_class}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-right text-gray-700">
                          {r.media_value === null ? '—' : r.media_value.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {normalisedAll.length > preview.length && (
                <p className="text-xs text-gray-400 mb-3">Showing first {preview.length} of {normalisedAll.length} rows.</p>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep('map')} className="text-sm text-gray-500 hover:text-gray-700" disabled={isBusy}>
                  ← Back
                </button>
                <button
                  onClick={() => void handleConfirm()}
                  disabled={isBusy || normalisedAll.length === 0}
                  className="flex-1 bg-[#4131e0] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#4131e0]/90 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isBusy ? 'Importing…' : `Import ${normalisedAll.length} rows`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
