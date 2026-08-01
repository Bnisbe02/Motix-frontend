export type CampaignStatus = 'attention' | 'review' | 'on-track';

export interface Competitor {
  name: string;
  shareOfVoice: number;
  spotCount: number;
}

export interface Campaign {
  id: string;
  clientName: string;
  campaignName: string;
  status: CampaignStatus;
  keySignal: string;
  lastDetected: string;
  startDate: string;
  endDate: string;
  stationCount: number;
  stations: string[];
  competitors?: Competitor[];
}

export const campaigns: Campaign[] = [
  {
    id: 'GNSW-SUMMER-2026',
    clientName: 'Government NSW',
    campaignName: 'Summer Campaign 2025/26',
    status: 'attention',
    keySignal: '3 spots aired outside contracted dayparts',
    lastDetected: '14 mins ago',
    startDate: '2025-11-01',
    endDate: '2026-01-12',
    stationCount: 5,
    stations: ['KIIS 106.5', '2MMM', 'WSFM', '2GB', '2UE'],
  },
  {
    id: 'TOYOTA-Q4-2025',
    clientName: 'Toyota',
    campaignName: 'Holiday Season Q4 2025',
    status: 'attention',
    keySignal: '12 spots under-delivered this week',
    lastDetected: '8 mins ago',
    startDate: '2026-01-01',
    endDate: '2026-02-22',
    stationCount: 9,
    stations: [
      'KIIS 106.5',
      '2MMM',
      '3AW',
      'Gold 104.3',
      'Fox FM',
      'Triple M',
      'WSFM',
      '2GB',
      '2UE',
    ],
    competitors: [
      { name: 'Mazda', shareOfVoice: 28, spotCount: 312 },
      { name: 'Honda', shareOfVoice: 22, spotCount: 245 },
      { name: 'Nissan', shareOfVoice: 18, spotCount: 201 },
      { name: 'Hyundai', shareOfVoice: 15, spotCount: 167 },
    ],
  },
  {
    id: 'AUSPOST-DEC',
    clientName: 'Australia Post',
    campaignName: 'December Delivery',
    status: 'review',
    keySignal: 'High frequency detected on 3 stations',
    lastDetected: '3 mins ago',
    startDate: '2025-12-01',
    endDate: '2025-12-31',
    stationCount: 4,
    stations: ['KIIS 106.5', '2MMM', '3AW', 'Gold 104.3'],
  },
  {
    id: 'QANTAS-JAN',
    clientName: 'Qantas',
    campaignName: 'January Travel Push',
    status: 'review',
    keySignal: 'Creative rotation imbalance detected',
    lastDetected: '22 mins ago',
    startDate: '2026-01-01',
    endDate: '2026-01-12',
    stationCount: 7,
    stations: ['KIIS 106.5', '2MMM', '3AW', 'Gold 104.3', 'Fox FM', 'Triple M', 'WSFM'],
  },
  {
    id: 'WOOLWORTHS-XMAS',
    clientName: 'Woolworths',
    campaignName: 'Christmas 2025',
    status: 'on-track',
    keySignal: 'All scheduled spots aired as booked',
    lastDetected: '6 mins ago',
    startDate: '2025-09-20',
    endDate: '2025-12-25',
    stationCount: 10,
    stations: [
      'KIIS 106.5',
      '2MMM',
      '3AW',
      'Gold 104.3',
      'Fox FM',
      'Triple M',
      'WSFM',
      '2GB',
      '2UE',
      '2DAY',
    ],
  },
  {
    id: 'TELSTRA-JAN',
    clientName: 'Telstra',
    campaignName: 'January Activation 2026',
    status: 'on-track',
    keySignal: 'Delivery tracking to plan',
    lastDetected: '11 mins ago',
    startDate: '2026-01-01',
    endDate: '2026-01-12',
    stationCount: 5,
    stations: ['KIIS 106.5', '2MMM', '3AW', 'Gold 104.3', 'Fox FM'],
  },
  {
    id: 'CBA-RATES',
    clientName: 'Commonwealth Bank',
    campaignName: 'Rate Campaign',
    status: 'on-track',
    keySignal: 'Compliance verified across all markets',
    lastDetected: '4 mins ago',
    startDate: '2025-09-01',
    endDate: '2026-01-13',
    stationCount: 9,
    stations: [
      'KIIS 106.5',
      '2MMM',
      '3AW',
      'Gold 104.3',
      'Fox FM',
      'Triple M',
      'WSFM',
      '2GB',
      '2UE',
    ],
    competitors: [
      { name: 'NAB', shareOfVoice: 32, spotCount: 248 },
      { name: 'ANZ', shareOfVoice: 24, spotCount: 186 },
      { name: 'Westpac', shareOfVoice: 19, spotCount: 147 },
      { name: 'ING', shareOfVoice: 12, spotCount: 93 },
    ],
  },
  {
    id: 'VOLKSWAGEN-DEC',
    clientName: 'Volkswagen',
    campaignName: 'December Brand Campaign',
    status: 'review',
    keySignal: 'Delivery trending below target',
    lastDetected: '18 mins ago',
    startDate: '2025-12-01',
    endDate: '2025-12-31',
    stationCount: 6,
    stations: ['KIIS 106.5', '2MMM', '3AW', 'Gold 104.3', 'Fox FM', 'Triple M'],
  },
  {
    id: 'CBA-CAIRNS',
    clientName: 'Commonwealth Bank',
    campaignName: 'Cairns Regional Campaign',
    status: 'on-track',
    keySignal: 'Campaign delivering as expected',
    lastDetected: '2 mins ago',
    startDate: '2026-01-06',
    endDate: '2026-02-28',
    stationCount: 4,
    stations: ['STAR FM Cairns', '4CA Cairns', 'MMM Cairns', 'HIIT Cairns'],
  },
];

export function getCampaignById(id: string): Campaign | undefined {
  return campaigns.find((campaign) => campaign.id === id);
}

export const STATUS_ORDER: Record<CampaignStatus, number> = {
  attention: 0,
  review: 1,
  'on-track': 2,
};

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  attention: 'Attention Required',
  review: 'Needs Review',
  'on-track': 'On Track',
};
