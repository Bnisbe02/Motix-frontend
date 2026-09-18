import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { useStations } from '../../../hooks/useStations';
import { PcrReport, PCR_ASSETS_BUCKET } from '../../../types/pcr';
import { fetchAdvertiserSuggestions } from '../../../lib/pcrDetections';
import { uploadClientLogo, removePcrAsset, createSignedUrl, updateReport } from '../../../lib/pcrApi';
import { useToast } from '../../../contexts/ToastContext';

/*
  Step 1 — Campaign. Edits the pcr_reports fields. Advertiser has debounced
  suggestions from distinct mirror brand values; stations are a registry
  multi-select grouped by market. A saved report can also carry an optional
  client logo, uploaded to pcr-assets and stored on client_logo_path for the
  cover / closing dual-logo lockup.
*/

const CLIENT_LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export interface CampaignDraft {
  advertiser: string;
  campaign_name: string;
  date_from: string;
  date_to: string;
  station_callsigns: string[];
  objectives: string;
}

interface StepCampaignProps {
  report: PcrReport | null;
  saving: boolean;
  /** The agency id, needed to build the client-logo storage path. */
  agencyId?: string | null;
  /** Persist the draft. Builder creates (new) or updates, then advances. */
  onSubmit: (draft: CampaignDraft) => void;
  /** Silent autosave on blur (existing reports only). */
  onAutosave?: (draft: CampaignDraft) => void;
  /** Propagate a report row change (e.g. the client logo path) to the builder. */
  onReportChange?: (report: PcrReport) => void;
}

/** Validate a client logo before upload. Returns an error message or null. */
function validateClientLogo(file: File): string | null {
  const dot = file.name.lastIndexOf('.');
  const ext = dot === -1 ? '' : file.name.slice(dot + 1).toLowerCase();
  const okType = ['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type);
  const okExt = ['png', 'jpg', 'jpeg', 'svg'].includes(ext);
  if (!okType && !okExt) return 'Only PNG, JPG or SVG files are accepted.';
  if (file.size > CLIENT_LOGO_MAX_BYTES) return 'File is too large. Maximum size is 2 MB.';
  return null;
}

function draftFromReport(report: PcrReport | null): CampaignDraft {
  return {
    advertiser: report?.advertiser ?? '',
    campaign_name: report?.campaign_name ?? '',
    date_from: report?.date_from ?? '',
    date_to: report?.date_to ?? '',
    station_callsigns: report?.station_callsigns ?? [],
    objectives: report?.objectives ?? '',
  };
}

export default function StepCampaign({ report, saving, agencyId, onSubmit, onAutosave, onReportChange }: StepCampaignProps) {
  const { stations, isLoading: stationsLoading } = useStations();
  const { addToast } = useToast();
  const [draft, setDraft] = useState<CampaignDraft>(() => draftFromReport(report));
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Client logo (optional). Only available once the report exists.
  const clientLogoInputRef = useRef<HTMLInputElement>(null);
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState<boolean>(false);
  const [logoDragging, setLogoDragging] = useState<boolean>(false);
  const clientLogoPath = report?.client_logo_path ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = clientLogoPath ? await createSignedUrl(clientLogoPath, PCR_ASSETS_BUCKET) : null;
      if (!cancelled) setClientLogoUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientLogoPath]);

  const handleClientLogoFile = async (file: File): Promise<void> => {
    if (!report || !agencyId) {
      addToast('error', 'Save the report first.');
      return;
    }
    const validationError = validateClientLogo(file);
    if (validationError) {
      addToast('error', validationError);
      return;
    }
    setLogoBusy(true);
    try {
      const path = await uploadClientLogo({ file, reportId: report.id, agencyId });
      const updated = await updateReport(report.id, { client_logo_path: path });
      onReportChange?.(updated);
      addToast('success', 'Client logo uploaded.');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setLogoBusy(false);
    }
  };

  const handleClientLogoRemove = async (): Promise<void> => {
    if (!report) return;
    setLogoBusy(true);
    try {
      // Clear the DB reference first, then best-effort delete the object.
      const updated = await updateReport(report.id, { client_logo_path: null });
      onReportChange?.(updated);
      if (clientLogoPath) await removePcrAsset(clientLogoPath);
      addToast('info', 'Client logo removed.');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to remove logo.');
    } finally {
      setLogoBusy(false);
    }
  };

  // Debounced advertiser suggestions from the mirror.
  useEffect(() => {
    const term = draft.advertiser.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      void fetchAdvertiserSuggestions(term, 20).then(setSuggestions);
    }, 300);
    return () => clearTimeout(handle);
  }, [draft.advertiser]);

  const stationsByMarket = useMemo(() => {
    const groups: Record<string, typeof stations> = {};
    for (const s of stations) {
      (groups[s.market] ??= []).push(s);
    }
    return groups;
  }, [stations]);

  const update = (patch: Partial<CampaignDraft>): void => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const toggleStation = (callsign: string): void => {
    setDraft((prev) => ({
      ...prev,
      station_callsigns: prev.station_callsigns.includes(callsign)
        ? prev.station_callsigns.filter((c) => c !== callsign)
        : [...prev.station_callsigns, callsign],
    }));
  };

  const validate = (): string[] => {
    const e: string[] = [];
    if (draft.advertiser.trim() === '') e.push('Advertiser is required.');
    if (draft.campaign_name.trim() === '') e.push('Campaign name is required.');
    if (!draft.date_from) e.push('Start date is required.');
    if (!draft.date_to) e.push('End date is required.');
    if (draft.date_from && draft.date_to && draft.date_to < draft.date_from) {
      e.push('End date must be on or after the start date.');
    }
    if (draft.station_callsigns.length === 0) e.push('Select at least one station.');
    return e;
  };

  const handleNext = (): void => {
    const e = validate();
    setErrors(e);
    if (e.length === 0) onSubmit(draft);
  };

  const autosave = (): void => {
    if (report && onAutosave && validate().length === 0) onAutosave(draft);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Advertiser</label>
          <input
            type="text"
            list="advertiser-suggestions"
            value={draft.advertiser}
            onChange={(e) => update({ advertiser: e.target.value })}
            onBlur={autosave}
            placeholder="e.g. Bunnings"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
          />
          <datalist id="advertiser-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <p className="text-xs text-gray-400 mt-1">Matched case-insensitively against MOTIX-observed brands.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Campaign name</label>
          <input
            type="text"
            value={draft.campaign_name}
            onChange={(e) => update({ campaign_name: e.target.value })}
            onBlur={autosave}
            placeholder="e.g. Spring Sale 2026"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
          <input
            type="date"
            value={draft.date_from}
            onChange={(e) => update({ date_from: e.target.value })}
            onBlur={autosave}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
          <input
            type="date"
            value={draft.date_to}
            onChange={(e) => update({ date_to: e.target.value })}
            onBlur={autosave}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Stations {draft.station_callsigns.length > 0 && <span className="text-gray-400">({draft.station_callsigns.length} selected)</span>}
        </label>
        {stationsLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading stations…
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(stationsByMarket).map(([market, group]) => (
              <div key={market}>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{market}</p>
                <div className="flex flex-wrap gap-2">
                  {group.map((s) => {
                    const selected = draft.station_callsigns.includes(s.callsign);
                    return (
                      <button
                        key={s.callsign}
                        type="button"
                        onClick={() => {
                          toggleStation(s.callsign);
                        }}
                        onBlur={autosave}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          selected
                            ? 'bg-[#4131e0] text-white border-[#4131e0]'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {s.display_name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Objectives (optional)</label>
        <textarea
          value={draft.objectives}
          onChange={(e) => update({ objectives: e.target.value })}
          onBlur={autosave}
          rows={3}
          placeholder="What was this campaign trying to achieve?"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
        />
      </div>

      {/* Client logo (optional) — needs a saved report to know where to store it. */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">Client logo (optional)</label>
          {clientLogoUrl && report && (
            <button
              type="button"
              onClick={() => void handleClientLogoRemove()}
              disabled={logoBusy}
              className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              Remove
            </button>
          )}
        </div>
        <div
          role="button"
          tabIndex={report ? 0 : -1}
          aria-disabled={!report}
          onClick={() => report && clientLogoInputRef.current?.click()}
          onKeyDown={(e) => {
            if (report && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              clientLogoInputRef.current?.click();
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setLogoDragging(false);
            if (!report) return;
            const file = e.dataTransfer.files?.[0];
            if (file) void handleClientLogoFile(file);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (report) setLogoDragging(true);
          }}
          onDragLeave={() => setLogoDragging(false)}
          className={`relative flex items-center justify-center h-28 max-w-sm rounded-lg border-2 border-dashed transition-colors ${
            !report
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              : logoDragging
                ? 'border-[#4131e0] bg-[#E6E7FF] cursor-pointer'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50 cursor-pointer'
          }`}
        >
          {logoBusy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-[#4131e0]" />
            </div>
          )}
          {clientLogoUrl ? (
            <img src={clientLogoUrl} alt="Client logo" className="max-h-24 max-w-[90%] object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-xs text-gray-500">
              <Upload className="w-5 h-5" />
              <span>Drop a file or click to browse</span>
              <span className="text-[10px] opacity-75">PNG, JPG or SVG, max 2 MB</span>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {report
            ? "Appears alongside your network logo on the cover and closing slides."
            : 'Save the report first, then a logo can be attached here.'}
        </p>
        <input
          ref={clientLogoInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleClientLogoFile(file);
            e.target.value = '';
          }}
          className="hidden"
        />
      </div>

      {errors.length > 0 && (
        <ul className="text-xs text-red-600 space-y-0.5 list-disc list-inside">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={saving}
          className="bg-[#4131e0] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#4131e0]/90 flex items-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {report ? 'Save and continue' : 'Create report and continue'}
        </button>
      </div>
    </div>
  );
}
