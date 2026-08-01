import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { getCampaignById } from '../data/campaigns';
import { useToast } from '../contexts/ToastContext';

interface FrequencyExpectation {
  minPerHour: number;
  maxPerHour: number;
}

interface DaypartExpectation {
  daypart: string;
  enabled: boolean;
}

interface AlertPreference {
  label: string;
  enabled: boolean;
  threshold: number;
}

interface CampaignExpectations {
  frequency: FrequencyExpectation;
  dayparts: DaypartExpectation[];
  alerts: AlertPreference[];
}

const defaultExpectations: CampaignExpectations = {
  frequency: { minPerHour: 1, maxPerHour: 4 },
  dayparts: [
    { daypart: 'Breakfast (6–9am)', enabled: true },
    { daypart: 'Morning (9am–12pm)', enabled: true },
    { daypart: 'Drive (4–7pm)', enabled: true },
    { daypart: 'Midday (12–2pm)', enabled: false },
    { daypart: 'Afternoon (2–4pm)', enabled: false },
    { daypart: 'Evening (7–10pm)', enabled: false },
    { daypart: 'Overnight', enabled: false },
  ],
  alerts: [
    { label: 'Daypart compliance breach', enabled: true, threshold: 1 },
    { label: 'Under-delivery warning', enabled: true, threshold: 90 },
    { label: 'Message fatigue alert', enabled: true, threshold: 4 },
    { label: 'New competitive activity detected', enabled: false, threshold: 0 },
  ],
};

export default function CampaignSettings() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const campaign = campaignId ? getCampaignById(campaignId) : undefined;
  const [expectations, setExpectations] = useState<CampaignExpectations>(defaultExpectations);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const { addToast } = useToast();

  if (!campaign) {
    return <Navigate to="/app/campaigns" replace />;
  }

  const handleFrequencyChange = (field: keyof FrequencyExpectation, value: string): void => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setExpectations((prev) => ({ ...prev, frequency: { ...prev.frequency, [field]: num } }));
    setHasChanges(true);
  };

  const handleDaypartToggle = (index: number): void => {
    setExpectations((prev) => ({
      ...prev,
      dayparts: prev.dayparts.map((d, i) => (i === index ? { ...d, enabled: !d.enabled } : d)),
    }));
    setHasChanges(true);
  };

  const handleAlertToggle = (index: number): void => {
    setExpectations((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a, i) => (i === index ? { ...a, enabled: !a.enabled } : a)),
    }));
    setHasChanges(true);
  };

  const handleAlertThreshold = (index: number, value: string): void => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setExpectations((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a, i) => (i === index ? { ...a, threshold: num } : a)),
    }));
    setHasChanges(true);
  };

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    setIsSaving(false);
    setHasChanges(false);
    addToast('success', 'Campaign settings saved. Changes will apply from the next monitoring cycle.');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-12">
        <Link
          to={`/app/campaigns/${campaign.id}`}
          className="inline-flex items-center gap-1 text-body-sm text-gray-600 hover:text-[#4131e0] mb-5 interactive-base"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to {campaign.campaignName}
        </Link>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200 px-8 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-heading-2 text-[#191715]">Campaign Settings</h1>
              <p className="text-body text-gray-600 mt-1.5">
                Configure expectations, dayparts, and alerts for this campaign
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="bg-[#4131e0] text-white px-5 py-2 rounded-lg text-body-sm font-semibold hover:brightness-95 interactive-base disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {hasChanges && (
            <div className="bg-amber-50 border-b border-amber-200 px-8 py-3">
              <p className="text-body-sm text-amber-800">You have unsaved changes.</p>
            </div>
          )}

          <div className="p-8 space-y-10">
            {/* Section 1: Frequency Expectations */}
            <section>
              <h2 className="text-heading-3 text-[#191715] mb-2">Frequency Expectations</h2>
              <p className="text-body-sm text-gray-600 mb-6">
                Set the expected spot frequency per station per hour. Detections outside this range will be flagged.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="minPerHour" className="text-label text-gray-600 mb-2 block">
                    Minimum spots/hour
                  </label>
                  <input
                    id="minPerHour"
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={expectations.frequency.minPerHour}
                    onChange={(e) => handleFrequencyChange('minPerHour', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                  />
                </div>
                <div>
                  <label htmlFor="maxPerHour" className="text-label text-gray-600 mb-2 block">
                    Maximum spots/hour
                  </label>
                  <input
                    id="maxPerHour"
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={expectations.frequency.maxPerHour}
                    onChange={(e) => handleFrequencyChange('maxPerHour', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                  />
                </div>
              </div>
            </section>

            <div className="border-t border-gray-200"></div>

            {/* Section 2: Daypart Expectations */}
            <section>
              <h2 className="text-heading-3 text-[#191715] mb-2">Daypart Expectations</h2>
              <p className="text-body-sm text-gray-600 mb-6">
                Enable the dayparts this campaign is booked to run in. Spots detected outside enabled dayparts will be flagged as violations.
              </p>
              <div className="space-y-3">
                {expectations.dayparts.map((daypart, index) => (
                  <div
                    key={daypart.daypart}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-body-sm text-[#191715]">{daypart.daypart}</span>
                    <button
                      onClick={() => handleDaypartToggle(index)}
                      className={`w-12 h-6 rounded-full transition-colors interactive-base relative ${
                        daypart.enabled ? 'bg-[#4131e0]' : 'bg-gray-200'
                      }`}
                      role="switch"
                      aria-checked={daypart.enabled}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          daypart.enabled ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <div className="border-t border-gray-200"></div>

            {/* Section 3: Alert Preferences */}
            <section>
              <h2 className="text-heading-3 text-[#191715] mb-2">Alert Preferences</h2>
              <p className="text-body-sm text-gray-600 mb-6">
                Configure which events trigger alerts. Threshold values vary by alert type.
              </p>
              <div className="space-y-4">
                {expectations.alerts.map((alert, index) => (
                  <div key={alert.label} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => handleAlertToggle(index)}
                        className={`w-12 h-6 rounded-full transition-colors interactive-base flex-shrink-0 relative ${
                          alert.enabled ? 'bg-[#4131e0]' : 'bg-gray-200'
                        }`}
                        role="switch"
                        aria-checked={alert.enabled}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            alert.enabled ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span
                        className={`text-body-sm ${alert.enabled ? 'text-[#191715]' : 'text-gray-400'}`}
                      >
                        {alert.label}
                      </span>
                    </div>
                    {alert.threshold > 0 && alert.enabled && (
                      <input
                        type="number"
                        value={alert.threshold}
                        onChange={(e) => handleAlertThreshold(index, e.target.value)}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-body-sm text-right focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>

            <div className="bg-[#E6E7FF] border border-[#4131e0]/20 rounded-lg p-5 mt-6">
              <p className="text-body-sm text-[#191715] font-medium mb-1">About these settings</p>
              <p className="text-body-sm text-gray-600">
                Settings are applied to the monitoring pipeline at the start of the next processing cycle. Changes typically take effect within 5 minutes. Contact beats@fibrecast.com.au for campaign configuration assistance.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
