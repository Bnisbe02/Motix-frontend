export const CONFIDENCE_THRESHOLDS = {
  high: 0.95,
  medium: 0.85,
} as const;

export function getConfidenceBadgeClasses(confidence: number): string {
  if (confidence >= CONFIDENCE_THRESHOLDS.high)
    return 'bg-green-100 text-green-800 border border-green-200';
  if (confidence >= CONFIDENCE_THRESHOLDS.medium)
    return 'bg-amber-100 text-amber-800 border border-amber-200';
  return 'bg-red-100 text-red-800 border border-red-200';
}

export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`;
}
