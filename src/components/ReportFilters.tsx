import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ReportFilters as FilterType } from '../types/report';
import { getDateRangePreset, getCampaignDateRange } from '../utils/dateHelpers';

interface ReportFiltersProps {
  initialFilters: FilterType;
  availableStations: string[];
  isLoading: boolean;
  onSubmit: (filters: FilterType) => void;
}

const DATE_PRESETS: Array<{
  label: string;
  preset: 'today' | 'last7days' | 'last30days' | 'campaign';
}> = [
  { label: 'Today', preset: 'today' },
  { label: 'Last 7 days', preset: 'last7days' },
  { label: 'Last 30 days', preset: 'last30days' },
];

export default function ReportFilters({
  initialFilters,
  availableStations,
  isLoading,
  onSubmit,
}: ReportFiltersProps) {
  const [brand, setBrand] = useState<string>(initialFilters.brand);
  const [station, setStation] = useState<string>(initialFilters.station);
  const [from, setFrom] = useState<string>(initialFilters.from);
  const [to, setTo] = useState<string>(initialFilters.to);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const showCampaignPreset = initialFilters.from !== '';

  const handlePresetClick = (preset: 'today' | 'last7days' | 'last30days' | 'campaign'): void => {
    if (preset === 'campaign') {
      const range = getCampaignDateRange(initialFilters.from, initialFilters.to);
      setFrom(range.from);
      setTo(range.to);
    } else {
      const range = getDateRangePreset(preset);
      setFrom(range.from);
      setTo(range.to);
    }
    setActivePreset(preset);
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    if (brand.trim() === '') {
      setValidationError('Brand is required');
      return;
    }

    if (from === '' || to === '') {
      setValidationError('Date range is required');
      return;
    }

    if (new Date(from) > new Date(to)) {
      setValidationError('From date must be before To date');
      return;
    }

    setValidationError(null);
    onSubmit({ brand, station, from, to });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
            Brand <span className="text-red-500">*</span>
          </label>
          <input
            id="brand"
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4131e0] text-sm"
            placeholder="Enter brand name"
          />
        </div>

        <div>
          <label htmlFor="station" className="block text-sm font-medium text-gray-700 mb-1">
            Station
          </label>
          <select
            id="station"
            value={station}
            onChange={(e) => setStation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4131e0] text-sm"
          >
            <option value="All Stations">All Stations</option>
            {availableStations.map((stationName) => (
              <option key={stationName} value={stationName}>
                {stationName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="from" className="block text-sm font-medium text-gray-700 mb-1">
            From
          </label>
          <input
            id="from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setActivePreset(null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4131e0] text-sm"
          />
        </div>

        <div>
          <label htmlFor="to" className="block text-sm font-medium text-gray-700 mb-1">
            To
          </label>
          <input
            id="to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setActivePreset(null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4131e0] text-sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Quick select:</span>
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.preset}
              type="button"
              onClick={() => handlePresetClick(preset.preset)}
              className={`text-sm border rounded-md px-3 py-1.5 transition-colors ${
                activePreset === preset.preset
                  ? 'bg-[#4131e0]/10 border-[#4131e0] text-[#4131e0]'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {preset.label}
            </button>
          ))}
          {showCampaignPreset && (
            <button
              type="button"
              onClick={() => handlePresetClick('campaign')}
              className={`text-sm border rounded-md px-3 py-1.5 transition-colors ${
                activePreset === 'campaign'
                  ? 'bg-[#4131e0]/10 border-[#4131e0] text-[#4131e0]'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Campaign Window
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="bg-[#4131e0] text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-[#3525b8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          Run Report
        </button>
      </div>

      {validationError && (
        <div className="text-sm text-red-600 mt-2">{validationError}</div>
      )}
    </form>
  );
}
