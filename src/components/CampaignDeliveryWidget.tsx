import { useState } from 'react';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Campaign } from '../data/campaigns';
import { CampaignMetrics } from '../hooks/useCampaignMetrics';
import { useToast } from '../contexts/ToastContext';
import BookingUploadModal, { ParsedBooking } from './BookingUploadModal';

interface CampaignDeliveryWidgetProps {
  campaign: Campaign;
  metrics: CampaignMetrics;
}

export interface BookingRow {
  station: string;
  startDate: string;
  endDate: string;
  totalSpots: number;
  flighting: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#191715] text-white text-xs px-3 py-2 rounded-lg shadow-xl border border-gray-700">
      <p className="font-semibold text-gray-300 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-[#00d76f] font-bold">
          {entry.value} {entry.name === 'count' ? 'spots' : entry.name}
        </p>
      ))}
    </div>
  );
}

function getDeliveryStatusMessage(complianceRate: number): string {
  if (complianceRate >= 99) return 'All spots delivered within contracted parameters';
  if (complianceRate >= 97) return 'Minor delivery variance - within acceptable tolerance';
  return 'Delivery below threshold - review recommended';
}

function getDeliveryStatusColor(complianceRate: number): string {
  if (complianceRate >= 99) return 'text-green-600';
  if (complianceRate >= 97) return 'text-amber-600';
  return 'text-red-600';
}

export default function CampaignDeliveryWidget({
  campaign,
  metrics,
}: CampaignDeliveryWidgetProps) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const { addToast } = useToast();

  const handleOpenModal = (): void => {
    setIsModalOpen(true);
  };

  const handleCloseModal = (): void => {
    setIsModalOpen(false);
  };

  const handleBookingsComplete = (parsedBookings: ParsedBooking[]): void => {
    const convertedBookings: BookingRow[] = parsedBookings.map((booking) => ({
      station: booking.station,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalSpots: booking.totalSpots,
      flighting: booking.flighting,
    }));
    setBookings(convertedBookings);
    addToast('success', `${parsedBookings.length} booking${parsedBookings.length !== 1 ? 's' : ''} imported successfully`);
  };

  const handleClearBookings = (): void => {
    setBookings([]);
  };

  const campaignStart = new Date(campaign.startDate);
  const campaignEnd = new Date(campaign.endDate);
  const today = new Date();
  const totalDays = Math.max(1, Math.round((campaignEnd.getTime() - campaignStart.getTime()) / 86400000));
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((today.getTime() - campaignStart.getTime()) / 86400000)));
  const dailyTarget = metrics.contractedSpots / totalDays;

  const pacingData = Array.from({ length: elapsedDays + 1 }, (_, i) => ({
    day: i,
    contracted: Math.round(dailyTarget * i),
    aired: i === elapsedDays
      ? metrics.airedSpots
      : Math.round((metrics.airedSpots / Math.max(elapsedDays, 1)) * i),
  }));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-heading-3 text-[#191715] mb-1">Campaign Delivery Status</h3>
        <p className="text-body-sm text-gray-600">Spot delivery vs. contracted schedule</p>
      </div>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">Campaign Pacing</p>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={pacingData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 6" stroke="#f5f5f5" />
            <XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} label={{ value: 'Days', position: 'insideBottomRight', offset: -4, fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="contracted" stroke="#E6E7FF" strokeWidth={2} dot={false} strokeDasharray="4 4" name="contracted" />
            <Line type="monotone" dataKey="aired" stroke="#4131e0" strokeWidth={2} dot={false} name="aired" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-[#4131e0]" />
            <span className="text-xs text-gray-500">Aired</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-[#E6E7FF] border border-gray-300" style={{ borderStyle: 'dashed' }} />
            <span className="text-xs text-gray-500">Contracted</span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Delivery Progress</span>
          <span className="text-sm font-bold text-[#191715]">{metrics.deliveryPercent}%</span>
        </div>
        <div className="relative w-full bg-gray-100 rounded-full h-4 overflow-hidden">
          <div
            className="bg-[#4131e0] h-full rounded-full transition-all duration-500"
            style={{ width: `${metrics.deliveryPercent}%` }}
          ></div>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>
            {metrics.airedSpots} aired of {metrics.contractedSpots} contracted
          </span>
          <span className={getDeliveryStatusColor(metrics.complianceRate)}>
            {getDeliveryStatusMessage(metrics.complianceRate)}
          </span>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-heading-4 text-[#191715]">Media Schedule Import</h4>
          {bookings.length > 0 && (
            <button
              onClick={handleClearBookings}
              className="text-xs text-gray-600 hover:text-red-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {bookings.length === 0 ? (
          <button
            onClick={handleOpenModal}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-[#4131e0] hover:bg-[#4131e0]/5 interactive-base transition-colors cursor-pointer flex flex-col items-center gap-3"
          >
            <Upload className="w-8 h-8 text-gray-400" />
            <div>
              <p className="text-body-sm font-medium text-gray-700">Import Campaign Schedule</p>
              <p className="text-label text-gray-400">CSV upload or manual entry</p>
            </div>
          </button>
        ) : (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-800 font-medium">
                  {bookings.length} booking{bookings.length !== 1 ? 's' : ''} imported
                </span>
              </div>
              <button
                onClick={handleOpenModal}
                className="text-sm text-[#4131e0] font-medium hover:underline cursor-pointer"
              >
                Update
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
              {bookings.map((booking, index) => (
                <div
                  key={`${booking.station}-${index}`}
                  className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-[#191715]">{booking.station}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{booking.totalSpots} spots</span>
                    <span>
                      {booking.startDate} - {booking.endDate}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <BookingUploadModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onComplete={handleBookingsComplete}
      />
    </div>
  );
}
