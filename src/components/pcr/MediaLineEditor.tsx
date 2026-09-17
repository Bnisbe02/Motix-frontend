import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, Loader2, Paperclip, AlertCircle } from 'lucide-react';
import {
  MediaLineType,
  FigureSource,
  PcrMediaLine,
  MediaMetrics,
  Placement,
  SocialPost,
  AustralianState,
} from '../../types/pcr';
import {
  listMediaLines,
  saveMediaLine,
  deleteMediaLine,
  uploadPcrAsset,
  listAssets,
} from '../../lib/pcrApi';
import { validateStateSplit, STATE_SPLIT_KEYS } from '../../lib/pcrMetrics';
import { useToast } from '../../contexts/ToastContext';

/*
  MediaLineEditor — add/edit/remove off-broadcast and supplied media lines
  (pcr_media_lines). Each line's metrics form depends on its type. Numbers are
  stored as numbers. Screenshots upload into pcr-assets linked by media_line_id.
*/

interface MediaLineEditorProps {
  reportId: string;
  agencyId: string;
}

const LINE_TYPES: MediaLineType[] = [
  'podcast', 'streaming', 'social', 'integration', 'display', 'activation', 'audience', 'other',
];

interface NumField { key: string; label: string }

const NUMERIC_FIELDS: Partial<Record<MediaLineType, NumField[]>> = {
  podcast: [
    { key: 'imps_booked', label: 'Impressions booked' },
    { key: 'imps_delivered', label: 'Impressions delivered' },
    { key: 'unique_users', label: 'Unique users' },
    { key: 'frequency', label: 'Frequency' },
  ],
  streaming: [
    { key: 'imps_booked', label: 'Impressions booked' },
    { key: 'imps_delivered', label: 'Impressions delivered' },
    { key: 'unique_users', label: 'Unique users' },
    { key: 'frequency', label: 'Frequency' },
  ],
  display: [
    { key: 'imps_booked', label: 'Impressions booked' },
    { key: 'imps_delivered', label: 'Impressions delivered' },
    { key: 'unique_users', label: 'Unique users' },
    { key: 'frequency', label: 'Frequency' },
  ],
  social: [
    { key: 'total_reach', label: 'Total reach' },
    { key: 'total_posts', label: 'Total posts' },
  ],
  integration: [
    { key: 'committed', label: 'Committed count' },
    { key: 'delivered', label: 'Delivered count' },
  ],
  activation: [
    { key: 'committed', label: 'Committed count' },
    { key: 'delivered', label: 'Delivered count' },
  ],
  audience: [
    { key: 'reach_1plus', label: 'Reach 1+' },
    { key: 'reach_3plus', label: 'Reach 3+' },
    { key: 'avg_frequency', label: 'Avg frequency' },
    { key: 'gross_impacts', label: 'Gross impacts' },
  ],
};

const HAS_STATE_SPLIT: MediaLineType[] = ['podcast', 'streaming', 'display'];
const HAS_PLACEMENTS: MediaLineType[] = ['podcast', 'streaming', 'display'];

interface EditableLine {
  id?: string;
  line_type: MediaLineType;
  label: string;
  source: FigureSource;
  source_note: string;
  metrics: MediaMetrics;
  sort_order: number;
  dirty: boolean;
}

function emptyLine(sortOrder: number): EditableLine {
  return {
    line_type: 'podcast',
    label: '',
    source: 'uploaded',
    source_note: '',
    metrics: {},
    sort_order: sortOrder,
    dirty: true,
  };
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asPlacements(value: unknown): Placement[] {
  return Array.isArray(value) ? (value as Placement[]) : [];
}
function asPosts(value: unknown): SocialPost[] {
  return Array.isArray(value) ? (value as SocialPost[]) : [];
}
function asStateSplit(value: unknown): Partial<Record<AustralianState | 'Other', number>> {
  return value && typeof value === 'object' ? (value as Partial<Record<AustralianState | 'Other', number>>) : {};
}

export default function MediaLineEditor({ reportId, agencyId }: MediaLineEditorProps) {
  const { addToast } = useToast();
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [screenshotCounts, setScreenshotCounts] = useState<Record<string, number>>({});

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const [rows, assets] = await Promise.all([listMediaLines(reportId), listAssets(reportId)]);
      setLines(
        rows.map((r: PcrMediaLine) => ({
          id: r.id,
          line_type: r.line_type,
          label: r.label,
          source: r.source,
          source_note: r.source_note ?? '',
          metrics: r.metrics ?? {},
          sort_order: r.sort_order,
          dirty: false,
        }))
      );
      const counts: Record<string, number> = {};
      for (const a of assets) {
        if (a.asset_type === 'screenshot' && a.media_line_id) {
          counts[a.media_line_id] = (counts[a.media_line_id] ?? 0) + 1;
        }
      }
      setScreenshotCounts(counts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media lines');
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (index: number, patch: Partial<EditableLine>): void => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch, dirty: true } : l)));
  };
  const updateMetric = (index: number, key: string, value: unknown): void => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, metrics: { ...l.metrics, [key]: value as never }, dirty: true } : l))
    );
  };

  const addLine = (): void => {
    setLines((prev) => [...prev, emptyLine(prev.length)]);
  };

  const validateLine = (line: EditableLine): string | null => {
    if (line.label.trim() === '') return 'A label is required.';
    if (line.line_type === 'audience' && line.source_note.trim() === '') {
      return 'Audience lines require a source note (e.g. "GfK Fusion Survey 4 2025").';
    }
    if (HAS_STATE_SPLIT.includes(line.line_type)) {
      const v = validateStateSplit(asStateSplit(line.metrics.state_split));
      if (!v.isValid) return v.error ?? 'State split is invalid.';
    }
    return null;
  };

  const saveLine = async (index: number): Promise<void> => {
    const line = lines[index];
    const problem = validateLine(line);
    if (problem) {
      addToast('error', problem);
      return;
    }
    setSavingIndex(index);
    try {
      const saved = await saveMediaLine({
        id: line.id,
        report_id: reportId,
        agency_id: agencyId,
        line_type: line.line_type,
        label: line.label.trim(),
        metrics: line.metrics,
        source: line.source,
        source_note: line.source_note.trim() || null,
        sort_order: line.sort_order,
      });
      setLines((prev) => prev.map((l, i) => (i === index ? { ...l, id: saved.id, dirty: false } : l)));
      addToast('success', 'Media line saved.');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save media line');
    } finally {
      setSavingIndex(null);
    }
  };

  const removeLine = async (index: number): Promise<void> => {
    const line = lines[index];
    if (line.id) {
      try {
        await deleteMediaLine(line.id);
      } catch (err) {
        addToast('error', err instanceof Error ? err.message : 'Failed to delete media line');
        return;
      }
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadScreenshot = async (index: number, file: File): Promise<void> => {
    const line = lines[index];
    if (!line.id) {
      addToast('info', 'Save the line first, then attach a screenshot.');
      return;
    }
    try {
      await uploadPcrAsset({ file, reportId, agencyId, assetType: 'screenshot', mediaLineId: line.id });
      setScreenshotCounts((prev) => ({ ...prev, [line.id as string]: (prev[line.id as string] ?? 0) + 1 }));
      addToast('success', 'Screenshot attached.');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Screenshot upload failed');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-[#4131e0]" /> Loading media lines…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      {lines.length === 0 && (
        <p className="text-sm text-gray-500">
          No off-broadcast lines yet. Add podcast, streaming, social, integration, activation, display or audience lines.
        </p>
      )}

      {lines.map((line, index) => {
        const numFields = NUMERIC_FIELDS[line.line_type] ?? [];
        const stateSplit = asStateSplit(line.metrics.state_split);
        const splitValidation = validateStateSplit(stateSplit);
        const placements = asPlacements(line.metrics.top_placements);
        const posts = asPosts(line.metrics.per_post);
        return (
          <div key={line.id ?? `new-${index}`} className="border border-gray-200 rounded-xl p-4 bg-white">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <select
                value={line.line_type}
                onChange={(e) => update(index, { line_type: e.target.value as MediaLineType })}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
              >
                {LINE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="text"
                value={line.label}
                onChange={(e) => update(index, { label: e.target.value })}
                placeholder="Label (e.g. Nova Podcasts)"
                className="flex-1 min-w-[180px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
              />
              <select
                value={line.source}
                onChange={(e) => update(index, { source: e.target.value as FigureSource })}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4131e0]"
                title="Provenance of these figures"
              >
                <option value="uploaded">uploaded</option>
                <option value="manual">manual</option>
              </select>
              {line.dirty && <span className="text-xs text-amber-700">unsaved</span>}
              <button
                onClick={() => void saveLine(index)}
                disabled={savingIndex === index}
                className="ml-auto bg-[#4131e0] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-[#4131e0]/90 disabled:opacity-50"
              >
                {savingIndex === index ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
              <button
                onClick={() => void removeLine(index)}
                aria-label="Remove line"
                className="text-red-500 hover:bg-red-50 p-1.5 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Numeric metrics */}
            {numFields.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {numFields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-[11px] text-gray-500 mb-0.5">{f.label}</label>
                    <input
                      type="number"
                      value={(line.metrics[f.key] as number | undefined) ?? ''}
                      onChange={(e) => updateMetric(index, f.key, num(e.target.value))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Description for integration/activation */}
            {(line.line_type === 'integration' || line.line_type === 'activation') && (
              <div className="mb-3">
                <label className="block text-[11px] text-gray-500 mb-0.5">Description</label>
                <textarea
                  value={(line.metrics.description as string | undefined) ?? ''}
                  onChange={(e) => updateMetric(index, 'description', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
                />
              </div>
            )}

            {/* Demographic label for audience */}
            {line.line_type === 'audience' && (
              <div className="mb-3">
                <label className="block text-[11px] text-gray-500 mb-0.5">Demographic label (e.g. P18+)</label>
                <input
                  type="text"
                  value={(line.metrics.demo_label as string | undefined) ?? ''}
                  onChange={(e) => updateMetric(index, 'demo_label', e.target.value)}
                  className="w-full max-w-xs border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
                />
              </div>
            )}

            {/* State split */}
            {HAS_STATE_SPLIT.includes(line.line_type) && (
              <div className="mb-3">
                <label className="block text-[11px] text-gray-500 mb-1">
                  State split % (optional; must sum to 100 if used)
                </label>
                <div className="flex flex-wrap gap-2">
                  {STATE_SPLIT_KEYS.map((st) => (
                    <div key={st} className="flex items-center gap-1">
                      <span className="text-[11px] text-gray-500 w-8">{st}</span>
                      <input
                        type="number"
                        value={stateSplit[st] ?? ''}
                        onChange={(e) =>
                          updateMetric(index, 'state_split', { ...stateSplit, [st]: num(e.target.value) ?? 0 })
                        }
                        className="w-16 border border-gray-300 rounded px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
                      />
                    </div>
                  ))}
                </div>
                {!splitValidation.isValid && (
                  <p className="text-xs text-red-600 mt-1">{splitValidation.error}</p>
                )}
              </div>
            )}

            {/* Top placements */}
            {HAS_PLACEMENTS.includes(line.line_type) && (
              <RepeaterList
                title="Top placements"
                rows={placements.map((p) => ({ a: p.name, b: p.impressions }))}
                aLabel="Placement"
                bLabel="Impressions"
                onChange={(rows) =>
                  updateMetric(index, 'top_placements', rows.map((r) => ({ name: r.a, impressions: r.b })) as never)
                }
              />
            )}

            {/* Per-post reach for social */}
            {line.line_type === 'social' && (
              <RepeaterList
                title="Per-post reach"
                rows={posts.map((p) => ({ a: p.label, b: p.reach }))}
                aLabel="Post"
                bLabel="Reach"
                onChange={(rows) =>
                  updateMetric(index, 'per_post', rows.map((r) => ({ label: r.a, reach: r.b })) as never)
                }
              />
            )}

            {/* Source note + screenshot */}
            <div className="flex flex-wrap items-end gap-3 mt-2">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] text-gray-500 mb-0.5">
                  Source note {line.line_type === 'audience' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={line.source_note}
                  onChange={(e) => update(index, { source_note: e.target.value })}
                  placeholder="e.g. GfK Fusion Survey 4 2025"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
                />
              </div>
              <label className="flex items-center gap-1 text-xs text-[#4131e0] cursor-pointer hover:underline">
                <Paperclip className="w-3.5 h-3.5" />
                Attach screenshot
                {line.id && screenshotCounts[line.id] ? ` (${screenshotCounts[line.id]})` : ''}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadScreenshot(index, f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        );
      })}

      <button
        onClick={addLine}
        className="text-sm text-[#4131e0] hover:text-[#4131e0]/80 flex items-center gap-1 font-medium"
      >
        <Plus className="w-4 h-4" /> Add media line
      </button>
    </div>
  );
}

// ------------------------------------------------------------
// Small two-column repeater for placements / per-post lists
// ------------------------------------------------------------

interface RepeaterRow { a: string; b: number | null }

function RepeaterList({
  title,
  rows,
  aLabel,
  bLabel,
  onChange,
}: {
  title: string;
  rows: RepeaterRow[];
  aLabel: string;
  bLabel: string;
  onChange: (rows: RepeaterRow[]) => void;
}) {
  const setRow = (i: number, patch: Partial<RepeaterRow>): void => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  return (
    <div className="mb-3">
      <label className="block text-[11px] text-gray-500 mb-1">{title} (optional)</label>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={r.a}
              placeholder={aLabel}
              onChange={(e) => setRow(i, { a: e.target.value })}
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
            />
            <input
              type="number"
              value={r.b ?? ''}
              placeholder={bLabel}
              onChange={(e) => setRow(i, { b: e.target.value === '' ? null : Number(e.target.value) })}
              className="w-32 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#4131e0]"
            />
            <button
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              aria-label={`Remove ${aLabel}`}
              className="text-red-500 hover:bg-red-50 p-1 rounded"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange([...rows, { a: '', b: null }])}
        className="text-xs text-[#4131e0] hover:underline mt-1"
      >
        + Add {aLabel.toLowerCase()}
      </button>
    </div>
  );
}
