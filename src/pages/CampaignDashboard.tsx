import { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ChevronLeft, Calendar, Radio, Settings, FileText } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import DashboardMetrics from '../components/DashboardMetrics';
import AdPlacementsWidget from '../components/AdPlacementsWidget';
import DaypartViolationsWidget from '../components/DaypartViolationsWidget';
import CompetitorAnalysisWidget from '../components/CompetitorAnalysisWidget';
import CampaignDeliveryWidget from '../components/CampaignDeliveryWidget';
import BugReportButton from '../components/BugReportButton';
import { MetricCardSkeleton, SkeletonBlock } from '../components/Skeleton';
import { getCampaignById } from '../data/campaigns';
import { useCampaignMetrics } from '../hooks/useCampaignMetrics';
import { useFeedStatus } from '../hooks/useFeedStatus';

export default function CampaignDashboard() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const campaign = campaignId ? getCampaignById(campaignId) : undefined;
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  if (!campaign) {
    return <Navigate to="/app/campaigns" replace />;
  }

  const metrics = useCampaignMetrics(campaign);
  const feedStatus = useFeedStatus();

  const startDate = new Date(campaign.startDate).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const endDate = new Date(campaign.endDate).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-7xl mx-auto pt-5 pb-12 px-4 sm:px-6 lg:px-8">
        <Link
          to="/app/campaigns"
          className="inline-flex items-center gap-1 text-body-sm text-gray-600 hover:text-[#4131e0] mb-5 interactive-base"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to campaigns
        </Link>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8 hover-lift">
          <div className="flex items-start justify-between mb-7">
            <div>
              <h1 className="text-heading-1 text-[#191715] mb-1.5">{campaign.campaignName}</h1>
              <p className="text-body-lg text-gray-600">{campaign.clientName}</p>
              <div className="flex items-center gap-5 mt-4 text-body-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {startDate} - {endDate}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Radio className="w-4 h-4" />
                  <span>{campaign.stationCount} stations</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={`/app/campaigns/${campaign.id}/settings`}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-body-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 interactive-base flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <Link
                to={`/app/campaigns/${campaign.id}/report`}
                className="px-4 py-2.5 border-2 border-[#4131e0] rounded-lg text-body-sm font-semibold text-[#4131e0] hover:bg-[#4131e0] hover:text-white interactive-base flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                View Reports
              </Link>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-5 mt-2">
            <p className="text-label text-gray-600 mb-3">Monitored Stations</p>
            <div className="flex flex-wrap gap-2">
              {campaign.stations.map((station) => (
                <span
                  key={station}
                  className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded-md text-body-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {station}
                </span>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <MetricCardSkeleton key={`metric-skeleton-${i}`} />
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mt-8">
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonBlock key={`widget-skeleton-${i}`} className="bg-white rounded-lg border border-gray-200 h-64 animate-pulse" />
              ))}
            </div>
          </>
        ) : (
          <>
            <DashboardMetrics campaign={campaign} />

            <div className="grid lg:grid-cols-2 gap-6 mt-8">
              <AdPlacementsWidget campaign={campaign} metrics={metrics} />
              <DaypartViolationsWidget campaign={campaign} violations={metrics.violations} />
              <CompetitorAnalysisWidget campaign={campaign} />
              <CampaignDeliveryWidget campaign={campaign} metrics={metrics} />
            </div>
          </>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-5 mt-10 flex items-center justify-between hover-glow">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  feedStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                }`}
              ></span>
              {feedStatus === 'connected' && (
                <span className="absolute w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
              )}
            </div>
            <span className="text-body-sm font-medium text-gray-700">Ingestion Status</span>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`text-label ${
                feedStatus === 'connected' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {feedStatus === 'connected' ? 'Live' : 'Feed disconnected'}
            </span>
          </div>
        </div>
      </main>

      <BugReportButton />
    </div>
  );
}
