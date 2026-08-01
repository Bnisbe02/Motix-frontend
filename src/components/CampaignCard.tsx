import { Link } from 'react-router-dom';
import { AlertCircle, Eye, CheckCircle2, ChevronRight, Radio } from 'lucide-react';
import { Campaign, CampaignStatus, STATUS_LABELS } from '../data/campaigns';
import { getStatusTextColor, getStatusBgColor, getStatusBorderColor } from '../utils/statusStyles';

interface CampaignCardProps {
  campaign: Campaign;
}

const STATUS_ICONS: Record<CampaignStatus, React.ReactNode> = {
  attention: <AlertCircle className="w-4 h-4 text-red-600" />,
  review: <Eye className="w-4 h-4 text-amber-600" />,
  'on-track': <CheckCircle2 className="w-4 h-4 text-green-600" />,
};

const STATUS_BORDER_COLORS: Record<CampaignStatus, string> = {
  attention: 'border-l-4 border-l-red-500',
  review: 'border-l-4 border-l-amber-400',
  'on-track': 'border-l-4 border-l-[#00d76f]',
};

export default function CampaignCard({ campaign }: CampaignCardProps) {
  return (
    <Link
      to={`/app/campaigns/${campaign.id}`}
      className={`group bg-white rounded-lg border border-gray-200 ${STATUS_BORDER_COLORS[campaign.status]} p-6 hover-lift cursor-pointer flex items-center justify-between gap-4`}
    >
      <div className="flex-1">
        <div className="text-heading-4 text-[#191715]">{campaign.clientName}</div>
        <div className="text-body-sm text-gray-500 mt-1">{campaign.campaignName}</div>
        <div className={`text-body-sm mt-3 font-medium ${getStatusTextColor(campaign.status)}`}>
          {campaign.keySignal}
        </div>
      </div>

      <div className="flex items-center gap-6 flex-shrink-0">
        <div className="hidden md:flex items-center gap-2">
          <Radio className="w-4 h-4 text-gray-400" />
          <span className="text-body-sm text-gray-600">
            {campaign.stationCount} stations
          </span>
        </div>

        <div className="hidden md:block text-label text-gray-400">{campaign.lastDetected}</div>

        <ChevronRight className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  );
}
