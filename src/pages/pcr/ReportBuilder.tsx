import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Check } from 'lucide-react';
import AppHeader from '../../components/AppHeader';
import { useAgency } from '../../hooks/useAgency';
import { useToast } from '../../contexts/ToastContext';
import { PcrReport } from '../../types/pcr';
import { getReport, createReport, updateReport } from '../../lib/pcrApi';
import StepCampaign, { CampaignDraft } from '../../components/pcr/steps/StepCampaign';
import StepDetections from '../../components/pcr/steps/StepDetections';
import StepPlans from '../../components/pcr/steps/StepPlans';
import MediaLineEditor from '../../components/pcr/MediaLineEditor';
import StepReview from '../../components/pcr/steps/StepReview';

/*
  ReportBuilder — five-step wizard at /app/reports/new and /app/reports/:id.
  A persistent left stepper; each step saves on Next. Steps 2-5 require a
  saved report, so a brand-new report starts on Step 1 and advances after
  the pcr_reports row is created.
*/

const STEPS = [
  { n: 1, label: 'Campaign' },
  { n: 2, label: 'MOTIX detections' },
  { n: 3, label: 'Plan and delivery log' },
  { n: 4, label: 'Other media' },
  { n: 5, label: 'Review' },
];

export default function ReportBuilder() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { agencyId, userId, isLoading: authLoading, error: agencyError } = useAgency();

  const isNew = !reportId || reportId === 'new';
  const [report, setReport] = useState<PcrReport | null>(null);
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(!isNew);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (isNew) {
      setReport(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const r = await getReport(reportId as string);
      if (!r) {
        setError('Report not found, or not visible to your agency.');
      } else {
        setReport(r);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }, [isNew, reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCampaignSubmit = async (draft: CampaignDraft): Promise<void> => {
    if (!agencyId || !userId) {
      addToast('error', agencyError ?? 'No agency assigned to this account.');
      return;
    }
    setSaving(true);
    try {
      if (report) {
        const updated = await updateReport(report.id, {
          advertiser: draft.advertiser.trim(),
          campaign_name: draft.campaign_name.trim(),
          date_from: draft.date_from,
          date_to: draft.date_to,
          station_callsigns: draft.station_callsigns,
          objectives: draft.objectives.trim() || null,
        });
        setReport(updated);
        addToast('success', 'Report saved.');
        setStep(2);
      } else {
        const created = await createReport({
          agency_id: agencyId,
          created_by: userId,
          advertiser: draft.advertiser.trim(),
          campaign_name: draft.campaign_name.trim(),
          date_from: draft.date_from,
          date_to: draft.date_to,
          station_callsigns: draft.station_callsigns,
          objectives: draft.objectives.trim() || null,
        });
        setReport(created);
        addToast('success', 'Report created.');
        setStep(2);
        navigate(`/app/reports/${created.id}`, { replace: true });
      }
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const handleAutosave = async (draft: CampaignDraft): Promise<void> => {
    if (!report) return;
    try {
      const updated = await updateReport(report.id, {
        advertiser: draft.advertiser.trim(),
        campaign_name: draft.campaign_name.trim(),
        date_from: draft.date_from,
        date_to: draft.date_to,
        station_callsigns: draft.station_callsigns,
        objectives: draft.objectives.trim() || null,
      });
      setReport(updated);
    } catch {
      /* silent autosave; explicit save surfaces errors */
    }
  };

  const canNavigate = (target: number): boolean => target === 1 || report !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button onClick={() => navigate('/app/reports')} className="text-sm text-gray-500 hover:text-gray-700 mb-2">
            ← All reports
          </button>
          <h1 className="text-2xl font-bold text-[#191715]">
            {report ? `${report.advertiser} — ${report.campaign_name}` : 'New report'}
          </h1>
        </div>

        {authLoading || isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#4131e0]" /> Loading…
          </div>
        ) : agencyError ? (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5" /> {agencyError}
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left stepper */}
            <nav className="lg:col-span-1">
              <ol className="space-y-1">
                {STEPS.map((s) => {
                  const active = s.n === step;
                  const done = report !== null && s.n < step;
                  const enabled = canNavigate(s.n);
                  return (
                    <li key={s.n}>
                      <button
                        onClick={() => enabled && setStep(s.n)}
                        disabled={!enabled}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          active
                            ? 'bg-[#4131e0] text-white'
                            : enabled
                              ? 'text-gray-700 hover:bg-gray-100'
                              : 'text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            active ? 'bg-white/20 text-white' : done ? 'bg-[#00d76f] text-white' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {done ? <Check className="w-3 h-3" /> : s.n}
                        </span>
                        {s.label}
                      </button>
                    </li>
                  );
                })}
              </ol>
              {!report && (
                <p className="text-xs text-gray-400 mt-3 px-3">
                  Create the report in step 1 to unlock the rest.
                </p>
              )}
            </nav>

            {/* Step body */}
            <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl p-5">
              {step === 1 && (
                <StepCampaign
                  report={report}
                  saving={saving}
                  onSubmit={(d) => void handleCampaignSubmit(d)}
                  onAutosave={(d) => void handleAutosave(d)}
                />
              )}
              {step === 2 && report && agencyId && (
                <StepDetections
                  report={report}
                  agencyId={agencyId}
                  userId={userId}
                  onBack={() => setStep(1)}
                  onNext={() => setStep(3)}
                />
              )}
              {step === 3 && report && (
                <StepPlans report={report} onBack={() => setStep(2)} onNext={() => setStep(4)} />
              )}
              {step === 4 && report && agencyId && (
                <div className="space-y-4">
                  <MediaLineEditor reportId={report.id} agencyId={agencyId} />
                  <div className="flex justify-between pt-2 border-t border-gray-100">
                    <button onClick={() => setStep(3)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
                    <button
                      onClick={() => setStep(5)}
                      className="bg-[#4131e0] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#4131e0]/90"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}
              {step === 5 && report && <StepReview report={report} onBack={() => setStep(4)} />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
