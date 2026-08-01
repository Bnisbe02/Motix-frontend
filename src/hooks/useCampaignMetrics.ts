import { Campaign, CampaignStatus } from '../data/campaigns';

export interface Violation {
  id: string;
  station: string;
  message: string;
  time: string;
  severity: 'high' | 'medium';
}

export interface CampaignMetrics {
  totalAds: number;
  shareOfVoice: number;
  complianceRate: number;
  messageFatigue: number;
  contractedSpots: number;
  airedSpots: number;
  deliveryPercent: number;
  violations: Violation[];
}

export function useCampaignMetrics(campaign: Campaign): CampaignMetrics {
  const complianceRate =
    campaign.status === 'attention'
      ? 94.7
      : campaign.status === 'review'
        ? 97.2
        : 99.1;

  const shareOfVoice = parseFloat((15 + campaign.stationCount * 0.4).toFixed(1));

  const messageFatigue = parseFloat((1.2 + campaign.stationCount * 0.15).toFixed(1));

  const contractedSpots = campaign.stationCount * 28;

  const airedSpots = Math.round(contractedSpots * (complianceRate / 100));

  const deliveryPercent = Math.round((airedSpots / contractedSpots) * 100);

  const totalAds = airedSpots;

  let violations: Violation[] = [];

  if (campaign.status === 'on-track') {
    violations = [];
  } else if (campaign.status === 'review') {
    violations = [
      {
        id: campaign.stations[0],
        station: campaign.stations[0],
        message: 'Spot aired outside contracted Morning daypart',
        time: '9:45 AM',
        severity: 'medium',
      },
    ];
  } else if (campaign.status === 'attention') {
    violations = [
      {
        id: campaign.stations[0],
        station: campaign.stations[0],
        message: 'Spot aired outside contracted Drive daypart',
        time: '5:45 AM',
        severity: 'high',
      },
      {
        id: campaign.stations[1],
        station: campaign.stations[1],
        message: 'Spot aired outside contracted Breakfast daypart',
        time: '11:30 AM',
        severity: 'medium',
      },
    ];

    if (campaign.stations[2]) {
      violations.push({
        id: campaign.stations[2],
        station: campaign.stations[2],
        message: 'Spot aired outside contracted Morning daypart',
        time: '3:15 PM',
        severity: 'medium',
      });
    }
  }

  return {
    totalAds,
    shareOfVoice,
    complianceRate,
    messageFatigue,
    contractedSpots,
    airedSpots,
    deliveryPercent,
    violations,
  };
}
