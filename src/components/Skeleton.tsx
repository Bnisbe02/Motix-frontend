export function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />;
}

export function CampaignCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-gray-200 p-6 flex items-center justify-between gap-4">
      <div className="flex-1 space-y-2">
        <SkeletonBlock className="h-5 w-48" />
        <SkeletonBlock className="h-4 w-36 mt-1" />
        <SkeletonBlock className="h-4 w-64 mt-3" />
      </div>
      <div className="hidden md:flex items-center gap-6">
        <SkeletonBlock className="h-4 w-20" />
        <SkeletonBlock className="h-3 w-16" />
        <SkeletonBlock className="h-4 w-4" />
      </div>
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative overflow-hidden">
      <SkeletonBlock className="absolute top-4 right-4 h-5 w-5" />
      <SkeletonBlock className="h-12 w-24 mt-2" />
      <SkeletonBlock className="h-3 w-32 mt-2" />
      <SkeletonBlock className="h-3 w-48 mt-3" />
      <SkeletonBlock className="h-5 w-20 mt-4 rounded-full" />
    </div>
  );
}

export function ReportRowSkeleton() {
  return (
    <tr>
      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-28" /></td>
      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-20" /></td>
      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-16" /></td>
      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-24" /></td>
      <td className="px-4 py-3"><SkeletonBlock className="h-4 w-12" /></td>
      <td className="px-4 py-3"><SkeletonBlock className="h-5 w-16 rounded-full" /></td>
    </tr>
  );
}
