import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { SpotReportItem } from '../types/report';

interface ReportChartsProps {
  items: SpotReportItem[];
}

export default function ReportCharts({ items }: ReportChartsProps) {
  const spotsByStation = useMemo(() => {
    const stationCounts = new Map<string, number>();

    items.forEach((item) => {
      const count = stationCounts.get(item.station) || 0;
      stationCounts.set(item.station, count + 1);
    });

    return Array.from(stationCounts.entries())
      .map(([station, count]) => ({ station, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const spotsByHour = useMemo(() => {
    const hourCounts = new Map<number, number>();

    for (let i = 0; i < 24; i++) {
      hourCounts.set(i, 0);
    }

    items.forEach((item) => {
      const hour = new Date(item.ts_utc).getUTCHours();
      const count = hourCounts.get(hour) || 0;
      hourCounts.set(hour, count + 1);
    });

    return Array.from(hourCounts.entries())
      .map(([hour, count]) => ({
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        count,
      }))
      .sort((a, b) => a.hour - b.hour);
  }, [items]);

  const confidenceDistribution = useMemo(() => {
    const bands = {
      '85–94%': 0,
      '95–99%': 0,
      '99%+': 0,
    };

    items.forEach((item) => {
      if (item.confidence >= 0.99) {
        bands['99%+']++;
      } else if (item.confidence >= 0.95) {
        bands['95–99%']++;
      } else if (item.confidence >= 0.85) {
        bands['85–94%']++;
      }
    });

    return [
      { band: '85–94%', count: bands['85–94%'] },
      { band: '95–99%', count: bands['95–99%'] },
      { band: '99%+', count: bands['99%+'] },
    ];
  }, [items]);

  const getConfidenceBarColor = (band: string): string => {
    if (band === '99%+') return '#00d76f';
    if (band === '95–99%') return '#4131e0';
    return '#f59e0b';
  };

  return (
    <div>
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-heading-3 text-[#191715] mb-4">Verified Spots by Station</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={spotsByStation}>
            <CartesianGrid strokeDasharray="2 6" stroke="#f5f5f5" />
            <XAxis dataKey="station" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#4131e0" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-heading-3 text-[#191715] mb-4">Spots by Hour of Day (AEST)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={spotsByHour}>
            <CartesianGrid strokeDasharray="2 6" stroke="#f5f5f5" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line
              dataKey="count"
              stroke="#00d76f"
              strokeWidth={2}
              dot={{ r: 3, fill: '#00d76f' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-heading-3 text-[#191715] mb-4">
          Confidence Score Distribution
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={confidenceDistribution}>
            <CartesianGrid strokeDasharray="2 6" stroke="#f5f5f5" />
            <XAxis dataKey="band" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {confidenceDistribution.map((entry) => (
                <Cell key={entry.band} fill={getConfidenceBarColor(entry.band)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
