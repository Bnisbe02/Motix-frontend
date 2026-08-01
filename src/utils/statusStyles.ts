import { CampaignStatus } from '../data/campaigns';

export function getStatusTextColor(status: CampaignStatus): string {
  switch (status) {
    case 'attention':
      return 'text-red-600';
    case 'review':
      return 'text-amber-600';
    case 'on-track':
      return 'text-green-600';
  }
}

export function getStatusBgColor(status: CampaignStatus): string {
  switch (status) {
    case 'attention':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'review':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'on-track':
      return 'bg-green-50 text-green-700 border-green-200';
  }
}

export function getStatusBorderColor(status: CampaignStatus): string {
  switch (status) {
    case 'attention':
      return 'border-red-300';
    case 'review':
      return 'border-amber-200';
    case 'on-track':
      return 'border-gray-200';
  }
}
