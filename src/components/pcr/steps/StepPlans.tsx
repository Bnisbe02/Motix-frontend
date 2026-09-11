import { useState, useEffect, useCallback } from 'react';
import { Loader2, FileSpreadsheet, Upload, AlertCircle } from 'lucide-react';
import { PcrReport, PcrAsset, PcrPlanRow, RowKind } from '../../../types/pcr';
import { listAssets, listPlanRows } from '../../../lib/pcrApi';
import PlanImporter from '../PlanImporter';

/*
  Step 3 — Plan and delivery log. Two importer cards (booked media plan,
  aired delivery log), each showing existing versioned imports with row
  counts and a re-import button that creates a new version.
*/

interface StepPlansProps {
  report: PcrReport;
  onBack: () => void;
  onNext: () => void;
}

interface CardConfig {
  kind: RowKind;
  title: string;
  blurb: string;
  assetType: PcrAsset['asset_type'];
}

const CARDS: CardConfig[] = [
  { kind: 'booked', title: 'Media plan (booked)', blurb: 'Booked spots from the plan workbook.', assetType: 'media_plan' },
  { kind: 'aired', title: 'Delivery log (aired)', blurb: 'Aired post-times from the network log.', assetType: 'delivery_log' },
];

export default function StepPlans({ report, onBack, onNext }: StepPlansProps) {
  const [assets, setAssets] = useState<PcrAsset[]>([]);
  const [planRows, setPlanRows] = useState<PcrPlanRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<RowKind | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const [a, r] = await Promise.all([listAssets(report.id), listPlanRows(report.id)]);
      setAssets(a);
      setPlanRows(r);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load imports');
    } finally {
      setIsLoading(false);
    }
  }, [report.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const rowsForAsset = (assetId: string): number => planRows.filter((r) => r.asset_id === assetId).length;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#4131e0]" /> Loading imports…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CARDS.map((card) => {
            const cardAssets = assets
              .filter((a) => a.asset_type === card.assetType)
              .sort((x, y) => y.version - x.version);
            return (
              <div key={card.kind} className="border border-gray-200 rounded-xl p-4 bg-white">
                <div className="flex items-start gap-2 mb-3">
                  <FileSpreadsheet className="w-5 h-5 text-[#4131e0] mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#191715]">{card.title}</h3>
                    <p className="text-xs text-gray-500">{card.blurb}</p>
                  </div>
                </div>

                {cardAssets.length === 0 ? (
                  <p className="text-xs text-gray-400 mb-3">No imports yet.</p>
                ) : (
                  <ul className="mb-3 space-y-1">
                    {cardAssets.map((a) => (
                      <li key={a.id} className="text-xs text-gray-600 flex items-center justify-between border border-gray-100 rounded px-2 py-1">
                        <span className="truncate">
                          v{a.version} · {a.original_name}
                        </span>
                        <span className="text-gray-400 flex-shrink-0 ml-2">{rowsForAsset(a.id)} rows</span>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  onClick={() => setImporting(card.kind)}
                  className="w-full border border-[#4131e0] text-[#4131e0] py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#4131e0]/5"
                >
                  <Upload className="w-4 h-4" />
                  {cardAssets.length === 0 ? 'Import' : 'Re-import (new version)'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400">
        This step is optional. Imports are versioned and never overwritten.
      </p>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <button
          onClick={onNext}
          className="bg-[#4131e0] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#4131e0]/90"
        >
          Continue
        </button>
      </div>

      <PlanImporter
        isOpen={importing !== null}
        reportId={report.id}
        kind={importing ?? 'booked'}
        onClose={() => setImporting(null)}
        onComplete={() => {
          setImporting(null);
          void load();
        }}
      />
    </div>
  );
}
