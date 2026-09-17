import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useStations } from '../../../hooks/useStations';
import { PcrReport } from '../../../types/pcr';
import { fetchAdvertiserSuggestions } from '../../../lib/pcrDetections';

/*
  Step 1 — Campaign. Edits the pcr_reports fields. Advertiser has debounced
  suggestions from distinct mirror brand values; stations are a registry
  multi-select grouped by market.
*/

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
  /** Persist the draft. Builder creates (new) or updates, then advances. */
  onSubmit: (draft: CampaignDraft) => void;
  /** Silent autosave on blur (existing reports only). */
  onAutosave?: (draft: CampaignDraft) => void;
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

export default function StepCampaign({ report, saving, onSubmit, onAutosave }: StepCampaignProps) {
  const { stations, isLoading: stationsLoading } = useStations();
  const [draft, setDraft] = useState<CampaignDraft>(() => draftFromReport(report));
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

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
