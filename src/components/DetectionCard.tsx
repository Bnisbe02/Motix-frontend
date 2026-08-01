import { useState } from 'react';
import { Radio, Clock, Fingerprint, Timer } from 'lucide-react';
import { DetectionResult } from '../types/chat';
import { formatToAEST } from '../utils/dateHelpers';
import { getConfidenceBadgeClasses, formatConfidence } from '../utils/confidenceStyles';

interface DetectionCardProps {
  detections: DetectionResult[];
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export default function DetectionCard({ detections }: DetectionCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const displayedDetections = isExpanded ? detections : detections.slice(0, 3);
  const hasMore = detections.length > 3;
  const remainingCount = detections.length - 3;

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 mt-3 overflow-hidden">
      <div className="px-4 py-2 bg-white border-b border-gray-200">
        <h4 className="text-xs font-semibold text-gray-700">
          {detections.length} detection{detections.length !== 1 ? 's' : ''} found
        </h4>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Time
                </div>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Radio className="w-3 h-3" />
                  Station
                </div>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Brand
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Fingerprint className="w-3 h-3" />
                  Creative
                </div>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  Duration
                </div>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Confidence
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedDetections.map((detection) => (
              <tr key={detection.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                  {formatToAEST(detection.ts_utc)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                  <div className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-gray-400" />
                    {detection.station}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                  {detection.brand}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 font-mono">
                  {detection.creative_id}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                  {formatDuration(detection.duration_sec)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${getConfidenceBadgeClasses(detection.confidence)}`}
                  >
                    {formatConfidence(detection.confidence)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && !isExpanded && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-[#4131e0] hover:text-[#3525b8] font-medium transition-colors"
          >
            Show {remainingCount} more
          </button>
        </div>
      )}

      {isExpanded && hasMore && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <button
            onClick={() => setIsExpanded(false)}
            className="text-xs text-[#4131e0] hover:text-[#3525b8] font-medium transition-colors"
          >
            Show less
          </button>
        </div>
      )}
    </div>
  );
}
