import { AlertTriangle, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { Campaign } from '../data/campaigns';
import { Violation } from '../hooks/useCampaignMetrics';

interface DaypartViolationsWidgetProps {
  campaign: Campaign;
  violations: Violation[];
}

const SEVERITY_STYLES: Record<'high' | 'medium', string> = {
  high: 'bg-red-50 border-red-200',
  medium: 'bg-amber-50 border-amber-200',
};

const SEVERITY_ICON_COLOR: Record<'high' | 'medium', string> = {
  high: 'text-red-600',
  medium: 'text-amber-500',
};

export default function DaypartViolationsWidget({
  campaign,
  violations,
}: DaypartViolationsWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-heading-3 text-[#191715]">Daypart Compliance Breaches</h3>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                violations.length > 0
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {violations.length > 0 ? `${violations.length} flagged` : 'All compliant'}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {campaign.clientName} • 2 resolved earlier today
          </p>
        </div>
      </div>

      {violations.length > 0 ? (
        <div className="space-y-3">
          {violations.map((violation) => (
            <div
              key={violation.id}
              className={`border rounded-lg p-4 ${SEVERITY_STYLES[violation.severity]}`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${SEVERITY_ICON_COLOR[violation.severity]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-[#191715]">
                      {violation.station}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Clock className="w-3 h-3" />
                      <span>{violation.time}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">{violation.message}</p>
                  <button className="text-sm text-[#00d76f] font-medium hover:underline flex items-center gap-1">
                    Review flagged plays
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h4 className="text-heading-4 text-[#191715] mb-1">
            All spots within contracted dayparts
          </h4>
          <p className="text-sm text-gray-500">No compliance issues detected for this campaign</p>
        </div>
      )}
    </div>
  );
}
