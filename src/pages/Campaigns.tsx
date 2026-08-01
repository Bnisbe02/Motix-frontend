import { useState, useMemo, useEffect } from 'react';
import { AlertCircle, Eye, CheckCircle2, Plus, Search } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import CampaignCard from '../components/CampaignCard';
import { CampaignCardSkeleton } from '../components/Skeleton';
import { campaigns, STATUS_ORDER, CampaignStatus } from '../data/campaigns';

type FilterOption = CampaignStatus | 'all';

export default function Campaigns() {
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showNewCampaignModal, setShowNewCampaignModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const statusCounts = useMemo(
    () => ({
      attention: campaigns.filter((c) => c.status === 'attention').length,
      review: campaigns.filter((c) => c.status === 'review').length,
      onTrack: campaigns.filter((c) => c.status === 'on-track').length,
    }),
    []
  );

  const filteredCampaigns = useMemo(() => {
    let result = campaigns;

    if (activeFilter !== 'all') {
      result = result.filter((c) => c.status === activeFilter);
    }

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery !== '') {
      const lowerQuery = trimmedQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.clientName.toLowerCase().includes(lowerQuery) ||
          c.campaignName.toLowerCase().includes(lowerQuery) ||
          c.stations.some((s) => s.toLowerCase().includes(lowerQuery))
      );
    }

    return result.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [activeFilter, searchQuery]);

  const handleFilterChange = (filter: FilterOption): void => {
    setActiveFilter(filter);
    setSearchQuery('');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchQuery(e.target.value);
  };

  const handleNewCampaign = (): void => {
    setShowNewCampaignModal(true);
  };

  const handleCloseModal = (): void => {
    setShowNewCampaignModal(false);
  };

  const handleClearFilters = (): void => {
    handleFilterChange('all');
  };

  const filterButtons: Array<{ value: FilterOption; label: string; icon?: typeof AlertCircle; count?: number; colorClass: string }> = [
    { value: 'all', label: 'All Campaigns', colorClass: 'bg-[#4131e0] text-white' },
    { value: 'attention', label: 'Attention Required', icon: AlertCircle, count: statusCounts.attention, colorClass: 'bg-red-600 text-white' },
    { value: 'review', label: 'Needs Review', icon: Eye, count: statusCounts.review, colorClass: 'bg-yellow-600 text-white' },
    { value: 'on-track', label: 'On Track', icon: CheckCircle2, count: statusCounts.onTrack, colorClass: 'bg-green-600 text-white' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#191715]">Campaign Control</h1>
            <p className="text-sm text-gray-600 mt-1">{campaigns.length} active campaigns</p>
          </div>
          <button
            onClick={handleNewCampaign}
            className="bg-[#4131e0] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#4131e0]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap mb-6">
          {filterButtons.map((button) => {
            const Icon = button.icon;
            const isActive = activeFilter === button.value;
            const inactiveClass = 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50';
            const badgeColor = button.value === 'attention' ? 'bg-red-100 text-red-700'
              : button.value === 'review' ? 'bg-amber-100 text-amber-700'
              : button.value === 'on-track' ? 'bg-green-100 text-green-700'
              : '';

            return (
              <button
                key={button.value}
                onClick={() => handleFilterChange(button.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isActive ? button.colorClass : inactiveClass
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {button.label}
                {button.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                      isActive ? 'bg-white/20 text-white' : badgeColor
                    }`}
                  >
                    {button.count}
                  </span>
                )}
              </button>
            );
          })}

          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search campaigns..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0] w-64"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <CampaignCardSkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No campaigns match your filters
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Try adjusting your search or filter criteria
            </p>
            {activeFilter !== 'all' && (
              <button
                onClick={handleClearFilters}
                className="text-sm text-[#4131e0] font-medium hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </main>

      {showNewCampaignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">New Campaign Setup</h2>
            <p className="text-gray-600 mb-6">
              Campaign onboarding is managed by the MOTIX team during the pilot phase. To add a new campaign, please contact us at{' '}
              <a href="mailto:beats@fibrecast.com.au" className="text-[#4131e0] hover:underline font-medium">
                beats@fibrecast.com.au
              </a>
              {' '}with your campaign details.
            </p>
            <button
              onClick={handleCloseModal}
              className="w-full bg-[#4131e0] text-white py-3 rounded-lg font-semibold hover:brightness-95 transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
