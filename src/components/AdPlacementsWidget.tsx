import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Campaign } from '../data/campaigns';
import { CampaignMetrics } from '../hooks/useCampaignMetrics';

interface AdPlacementsWidgetProps {
  campaign: Campaign;
  metrics: CampaignMetrics;
}

interface PlacementRow {
  brand: string;
  ratePerDay: number;
  categorySharePercent: number;
  colorClass: string;
  lastDetected: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#191715] text-white text-xs px-3 py-2 rounded-lg shadow-xl border border-gray-700">
      <p className="font-semibold text-gray-300 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-[#00d76f] font-bold">
          {entry.value} {entry.name === 'count' ? 'spots' : entry.name}
        </p>
      ))}
    </div>
  );
}

export default function AdPlacementsWidget({ campaign, metrics }: AdPlacementsWidgetProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Daily');

  const placements: PlacementRow[] = [
    {
      brand: campaign.clientName,
      ratePerDay: parseFloat((metrics.airedSpots / 14).toFixed(1)),
      categorySharePercent: Math.min(Math.round(metrics.shareOfVoice), 45),
      colorClass: 'bg-[#4131e0]',
      lastDetected: campaign.lastDetected,
    },
    {
      brand: 'Market Average',
      ratePerDay: parseFloat(((metrics.airedSpots / 14) * 0.7).toFixed(1)),
      categorySharePercent: Math.max(20, 40 - Math.round(metrics.shareOfVoice / 2)),
      colorClass: 'bg-[#00d76f]',
      lastDetected: '5 mins ago',
    },
  ];

  const spotsByHour = Array.from({ length: 24 }, (_, hour) => {
    const isBreakfast = hour >= 6 && hour <= 9;
    const isDrive = hour >= 16 && hour <= 18;
    const isMorning = hour >= 9 && hour <= 12;
    const baseCount = Math.round(metrics.airedSpots / 14);
    const count = isBreakfast ? Math.round(baseCount * 0.35)
      : isDrive ? Math.round(baseCount * 0.3)
      : isMorning ? Math.round(baseCount * 0.2)
      : Math.round(baseCount * 0.05);
    return { hour, label: `${hour.toString().padStart(2, '0')}:00`, count };
  });

  const peakHourEntry = spotsByHour.reduce((a, b) => a.count > b.count ? a : b);
  const peakHourLabel = `${peakHourEntry.hour % 12 || 12} ${peakHourEntry.hour < 12 ? 'AM' : 'PM'}`;

  const totalPlacements = metrics.airedSpots;
  const avgPerDay = Math.round(metrics.airedSpots / 14);

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedPeriod(e.target.value);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-heading-3 text-[#191715]">Verified Spot Playout</h3>
        </div>
        <div className="relative">
          <select
            value={selectedPeriod}
            onChange={handlePeriodChange}
            className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0] cursor-pointer"
          >
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="px-6 pt-6">
        <div className="space-y-4 mb-6">
          {placements.map((placement) => (
            <div key={placement.brand}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-sm ${placement.colorClass}`}></div>
                  <span className="text-sm font-medium text-[#191715]">{placement.brand}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#191715]">
                    {placement.ratePerDay.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">ads/day</span>
                </div>
              </div>
              <div className="relative w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`${placement.colorClass} h-full rounded-full transition-all duration-500`}
                  style={{ width: `${placement.categorySharePercent}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">{placement.categorySharePercent}% share</span>
                <span className="text-xs text-gray-400">Last: {placement.lastDetected}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 mx-6"></div>

      <div className="px-6 pt-5 pb-4">
        <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">Spots by Hour of Day</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={spotsByHour} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 6" stroke="#f5f5f5" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={5} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {spotsByHour.map((entry) => (
                <Cell
                  key={entry.hour}
                  fill={(entry.hour >= 6 && entry.hour <= 9) || (entry.hour >= 16 && entry.hour <= 18)
                    ? '#4131e0'
                    : '#E6E7FF'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#4131e0]" />
            <span className="text-xs text-gray-500">Peak Hours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#E6E7FF]" />
            <span className="text-xs text-gray-500">Off-Peak</span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="grid grid-cols-3 gap-4 divide-x divide-gray-100">
          <div className="flex flex-col gap-0.5">
            <p className="text-2xl font-black text-[#191715]">{totalPlacements}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Total Placements</p>
          </div>
          <div className="flex flex-col gap-0.5 pl-4">
            <p className="text-2xl font-black text-[#191715]">{peakHourLabel}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Peak Hour</p>
          </div>
          <div className="flex flex-col gap-0.5 pl-4">
            <p className="text-2xl font-black text-[#191715]">{avgPerDay}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Avg per Day</p>
          </div>
        </div>
      </div>
    </div>
  );
}
