import React, { useState } from 'react';
import { Radio, Target, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Campaign } from '../data/campaigns';
import { CampaignMetrics, useCampaignMetrics } from '../hooks/useCampaignMetrics';
import MetricDetailModal from './MetricDetailModal';

interface DashboardMetricsProps {
  campaign: Campaign;
}

interface MetricConfig {
  id: string;
  label: string;
  value: string;
  context: string;
  iconBgClass: string;
  iconColorClass: string;
  trendValue: string;
  isPositiveTrend: boolean;
  isAlert: boolean;
  icon: React.ReactNode;
}

function buildMetricConfigs(campaign: Campaign, metrics: CampaignMetrics): MetricConfig[] {
  return [
    {
      id: 'totalAds',
      label: 'Total Ads Aired',
      value: metrics.totalAds.toLocaleString(),
      context: `Across ${campaign.stationCount} stations • Last detected ${campaign.lastDetected}`,
      iconBgClass: 'bg-blue-50',
      iconColorClass: 'text-blue-600',
      trendValue: '+8.3%',
      isPositiveTrend: true,
      isAlert: false,
      icon: <Radio className="w-5 h-5" />,
    },
    {
      id: 'shareOfVoice',
      label: 'Share of Voice',
      value: `${metrics.shareOfVoice}%`,
      context:
        metrics.shareOfVoice >= 18 ? 'Above your target threshold' : 'Within target range',
      iconBgClass: 'bg-green-50',
      iconColorClass: 'text-green-600',
      trendValue: '+5.2%',
      isPositiveTrend: true,
      isAlert: false,
      icon: <Target className="w-5 h-5" />,
    },
    {
      id: 'complianceRate',
      label: 'Compliance Rate',
      value: `${metrics.complianceRate}%`,
      context:
        metrics.complianceRate >= 99
          ? 'All spots within contracted parameters'
          : metrics.complianceRate >= 97
            ? 'Minor variance - within tolerance'
            : `${metrics.violations.length} spots outside contracted parameters`,
      iconBgClass: metrics.complianceRate < 97 ? 'bg-yellow-50' : 'bg-green-50',
      iconColorClass: metrics.complianceRate < 97 ? 'text-yellow-600' : 'text-green-600',
      trendValue: metrics.complianceRate >= 97 ? '+2.1%' : '-3.2%',
      isPositiveTrend: metrics.complianceRate >= 97,
      isAlert: metrics.complianceRate < 97,
      icon:
        metrics.complianceRate < 97 ? (
          <AlertTriangle className="w-5 h-5" />
        ) : (
          <CheckCircle className="w-5 h-5" />
        ),
    },
    {
      id: 'messageFatigue',
      label: 'Message Fatigue Index',
      value: metrics.messageFatigue.toFixed(1),
      context:
        metrics.messageFatigue <= 3.5
          ? 'Within healthy range (0-3.5)'
          : 'Above healthy range - consider rotation',
      iconBgClass: metrics.messageFatigue <= 3.5 ? 'bg-purple-50' : 'bg-yellow-50',
      iconColorClass: metrics.messageFatigue <= 3.5 ? 'text-purple-600' : 'text-yellow-600',
      trendValue: metrics.messageFatigue <= 3.5 ? '-0.3' : '+0.8',
      isPositiveTrend: metrics.messageFatigue <= 3.5,
      isAlert: metrics.messageFatigue > 3.5,
      icon: <Target className="w-5 h-5" />,
    },
  ];
}

export default function DashboardMetrics({ campaign }: DashboardMetricsProps) {
  const metrics = useCampaignMetrics(campaign);
  const metricConfigs = buildMetricConfigs(campaign, metrics);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  const handleOpenMetric = (id: string): void => {
    setSelectedMetricId(id);
  };

  const handleCloseMetric = (): void => {
    setSelectedMetricId(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {metricConfigs.map((metric) => (
          <div
            key={metric.id}
            onClick={() => handleOpenMetric(metric.id)}
            className={`bg-white rounded-lg shadow-sm border p-6 hover-scale cursor-pointer text-left relative overflow-hidden ${
              metric.isAlert ? 'border-l-4 border-l-[#4131e0] border-gray-200' : 'border-gray-200'
            }`}
          >
          <div className={`absolute top-5 right-5 ${metric.iconColorClass}`}>
            {React.cloneElement(metric.icon as React.ReactElement, { className: 'w-5 h-5' })}
          </div>

          <p className="text-5xl font-black text-[#191715] leading-none tracking-tight">{metric.value}</p>
          <p className="text-label text-gray-500 mt-2">{metric.label}</p>
          <p className="text-body-sm text-gray-500 leading-relaxed mt-3">{metric.context}</p>

          <div className="mt-4">
            <div className={`inline-flex items-center gap-1.5 text-label px-2.5 py-1 rounded-full ${
              metric.isPositiveTrend
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {metric.isPositiveTrend ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{metric.trendValue}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
    {selectedMetricId && (
      <MetricDetailModal
        metric={metricConfigs.find((m) => m.id === selectedMetricId)!}
        onClose={handleCloseMetric}
      />
    )}
  </>
  );
}
