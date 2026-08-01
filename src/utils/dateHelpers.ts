export function formatToAEST(ts_utc: string): string {
  const date = new Date(ts_utc);
  return date.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' AEST';
}

export function getDateRangePreset(
  preset: 'today' | 'last7days' | 'last30days'
): { from: string; to: string } {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  if (preset === 'today') {
    return { from: todayStr, to: todayStr };
  }

  if (preset === 'last7days') {
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    return { from: sevenDaysAgo.toISOString().split('T')[0], to: todayStr };
  }

  if (preset === 'last30days') {
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return { from: thirtyDaysAgo.toISOString().split('T')[0], to: todayStr };
  }

  return { from: todayStr, to: todayStr };
}

export function getCampaignDateRange(
  startDate: string,
  endDate: string
): { from: string; to: string } {
  return { from: startDate, to: endDate };
}
