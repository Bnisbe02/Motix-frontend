export type FeedStatus = 'connected' | 'disconnected' | 'checking';

interface FeedStatusBadgeProps {
  status: FeedStatus;
}

export default function FeedStatusBadge({ status }: FeedStatusBadgeProps) {
  const getDotColor = (): string => {
    switch (status) {
      case 'connected':
        return 'bg-[#00d76f]';
      case 'disconnected':
        return 'bg-red-500';
      case 'checking':
        return 'bg-yellow-400';
    }
  };

  const getStatusText = (): string => {
    switch (status) {
      case 'connected':
        return 'Live feed active';
      case 'disconnected':
        return 'Feed disconnected';
      case 'checking':
        return 'Checking feed...';
    }
  };

  const shouldPing = status === 'connected' || status === 'disconnected';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${getDotColor()}`}></div>
        {shouldPing && (
          <div className={`absolute inset-0 w-2 h-2 rounded-full ${getDotColor()} animate-ping`}></div>
        )}
      </div>
      <span className="text-xs font-medium text-gray-300">{getStatusText()}</span>
    </div>
  );
}
