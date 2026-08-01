import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface MetricDetailModalProps {
  metric: {
    id: string;
    value: string;
    label: string;
    context: string;
    isAlert: boolean;
    isPositiveTrend: boolean;
    trendValue: string;
  };
  onClose: () => void;
}

function getBenchmarkText(metricId: string): string {
  switch (metricId) {
    case 'totalAds':
      return 'Industry benchmark is 3–8 spots per station per day for a metro campaign. High volume can indicate bonus spots or scheduling errors worth reviewing.';
    case 'shareOfVoice':
      return 'A healthy SOV for a category leader is 25–40%. Below 20% may indicate under-delivery or strong competitive pressure.';
    case 'complianceRate':
      return 'Industry expectation is 97%+ compliance. Below 95% typically triggers a makegood discussion with the network.';
    case 'messageFatigue':
      return 'Healthy range is 1.0–3.5 spots per hour per station. Above 4.0 risks listener fatigue and diminishing creative impact.';
    default:
      return 'No benchmark reference available for this metric.';
  }
}

export default function MetricDetailModal({ metric, onClose }: MetricDetailModalProps) {
  const handleBackdropClick = (): void => {
    onClose();
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
  };

  const handleCloseClick = (): void => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="max-w-lg w-full bg-white rounded-xl shadow-2xl"
        onClick={handleContentClick}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-heading-3 text-[#191715]">{metric.label}</h2>
          <button
            onClick={handleCloseClick}
            className="text-gray-400 hover:text-gray-600 interactive-base"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Section 1: Current Value */}
          <div>
            <p className="text-5xl font-black text-[#191715] leading-none mb-3">
              {metric.value}
            </p>
            <div
              className={`inline-flex items-center gap-1.5 text-label px-2.5 py-1 rounded-full ${
                metric.isPositiveTrend
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              <span>{metric.trendValue}</span>
            </div>
          </div>

          {/* Section 2: What This Means */}
          <div>
            <h3 className="text-label text-gray-500 mb-2">WHAT THIS MEANS</h3>
            <p className="text-body-sm text-gray-700 leading-relaxed">
              {metric.context}
            </p>
            {metric.isAlert && (
              <div className="mt-4 bg-[#E6E7FF] border border-[#4131e0]/20 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#4131e0] flex-shrink-0 mt-0.5" />
                <p className="text-body-sm text-[#191715]">
                  This metric is outside expected range and has been flagged for review.
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Benchmark Reference */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-label text-gray-500 mb-2">BENCHMARK REFERENCE</h3>
            <p className="text-body-sm text-gray-700 leading-relaxed">
              {getBenchmarkText(metric.id)}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 border-t border-gray-100 pt-4 mt-6">
          <p className="text-body-sm text-gray-500">
            Configure expectations in Campaign Settings
          </p>
        </div>
      </div>
    </div>
  );
}
