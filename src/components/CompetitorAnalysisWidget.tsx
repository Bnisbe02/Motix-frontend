import { BarChart3 } from 'lucide-react';
import { Campaign } from '../data/campaigns';

interface CompetitorAnalysisWidgetProps {
  campaign: Campaign;
}

export default function CompetitorAnalysisWidget({ campaign }: CompetitorAnalysisWidgetProps) {
  const hasCompetitors = campaign.competitors && campaign.competitors.length > 0;

  if (!hasCompetitors) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-heading-3 text-[#191715] mb-6">Competitor Analysis</h3>

        <div className="py-8 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h4 className="font-semibold text-[#191715] mb-1">No competitors configured</h4>
          <p className="text-sm text-gray-500 mt-1 mb-3 max-w-sm mx-auto">
            Add competitors in Campaign Settings to enable competitive share benchmarking.
          </p>
          <a
            href={`/app/campaigns/${campaign.id}/settings`}
            className="text-sm text-[#4131e0] hover:underline inline-block mt-3"
          >
            Configure competitors →
          </a>
        </div>
      </div>
    );
  }

  const totalSov = campaign.competitors.reduce((sum, c) => sum + c.shareOfVoice, 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-heading-3 text-[#191715] mb-6">Competitor Analysis</h3>

      <div className="space-y-4">
        {campaign.competitors.map((competitor) => (
          <div key={competitor.name}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">{competitor.name}</span>
              <div className="text-right">
                <span className="text-sm font-semibold text-[#191715]">{competitor.shareOfVoice}%</span>
                <span className="text-xs text-gray-500 ml-2">({competitor.spotCount} spots)</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-[#4131e0] h-2 rounded-full transition-all"
                style={{ width: `${(competitor.shareOfVoice / totalSov) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-5 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Share of voice calculated across {campaign.stations.join(', ')} during campaign flight dates
        </p>
      </div>
    </div>
  );
}
