import { supabase } from './supabase';
import {
  PcrReport,
  PcrDetectionInclusion,
  PcrPlanRow,
  PcrPlanRowInput,
  PcrAsset,
  PcrMediaLine,
  AssetType,
  RowKind,
  MediaMetrics,
  PCR_ASSETS_BUCKET,
} from '../types/pcr';

/*
  PCR data access. Thin wrappers over Supabase for reports and their children.
  Reads rely on RLS for agency isolation; writes set agency_id explicitly so
  the WITH CHECK policies pass. Functions throw on error with a readable
  message; callers (hooks, pages) catch and surface via the toast pattern.
*/

const SIGNED_URL_TTL = 60 * 60; // 1 hour

function orThrow<T>(data: T | null, error: { message: string } | null, context: string): T {
  if (error) throw new Error(`${context}: ${error.message}`);
  return data as T;
}

// ------------------------------------------------------------
// Reports
// ------------------------------------------------------------

export async function listReports(): Promise<PcrReport[]> {
  const { data, error } = await supabase
    .from('pcr_reports')
    .select('*')
    .order('updated_at', { ascending: false });
  return orThrow(data, error, 'Failed to load reports') ?? [];
}

export async function getReport(id: string): Promise<PcrReport | null> {
  const { data, error } = await supabase.from('pcr_reports').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Failed to load report: ${error.message}`);
  return (data as PcrReport | null) ?? null;
}

export interface CreateReportInput {
  agency_id: string;
  created_by: string;
  advertiser: string;
  campaign_name: string;
  date_from: string;
  date_to: string;
  station_callsigns: string[];
  objectives: string | null;
}

export async function createReport(input: CreateReportInput): Promise<PcrReport> {
  const { data, error } = await supabase.from('pcr_reports').insert(input).select('*').single();
  return orThrow(data, error, 'Failed to create report');
}

export async function updateReport(id: string, patch: Partial<PcrReport>): Promise<PcrReport> {
  const { data, error } = await supabase
    .from('pcr_reports')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  return orThrow(data, error, 'Failed to save report');
}

// ------------------------------------------------------------
// Detection inclusions
// ------------------------------------------------------------

export async function listInclusions(reportId: string): Promise<PcrDetectionInclusion[]> {
  const { data, error } = await supabase
    .from('pcr_detection_inclusions')
    .select('*')
    .eq('report_id', reportId);
  return orThrow(data, error, 'Failed to load inclusions') ?? [];
}

export interface InclusionInput {
  report_id: string;
  agency_id: string;
  detection_id: string;
  included: boolean;
  decided_by: string | null;
}

/** Upsert inclusion decisions on the (report_id, detection_id) primary key. */
export async function upsertInclusions(rows: InclusionInput[]): Promise<void> {
  if (rows.length === 0) return;
  const withTimestamp = rows.map((r) => ({ ...r, decided_at: new Date().toISOString() }));
  const { error } = await supabase
    .from('pcr_detection_inclusions')
    .upsert(withTimestamp, { onConflict: 'report_id,detection_id' });
  if (error) throw new Error(`Failed to save inclusions: ${error.message}`);
}

// ------------------------------------------------------------
// Plan rows
// ------------------------------------------------------------

export async function listPlanRows(reportId: string): Promise<PcrPlanRow[]> {
  const { data, error } = await supabase
    .from('pcr_plan_rows')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });
  return orThrow(data, error, 'Failed to load plan rows') ?? [];
}

export async function insertPlanRows(rows: PcrPlanRowInput[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('pcr_plan_rows').insert(rows);
  if (error) throw new Error(`Failed to save plan rows: ${error.message}`);
}

// ------------------------------------------------------------
// Assets
// ------------------------------------------------------------

export async function listAssets(reportId: string): Promise<PcrAsset[]> {
  const { data, error } = await supabase
    .from('pcr_assets')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });
  return orThrow(data, error, 'Failed to load assets') ?? [];
}

/** Next version number for a given asset type on a report (1-based). */
export async function nextAssetVersion(reportId: string, assetType: AssetType): Promise<number> {
  const { data, error } = await supabase
    .from('pcr_assets')
    .select('version')
    .eq('report_id', reportId)
    .eq('asset_type', assetType)
    .order('version', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Failed to read asset versions: ${error.message}`);
  const rows = (data ?? []) as Array<{ version: number }>;
  return rows.length > 0 ? rows[0].version + 1 : 1;
}

function sanitiseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export interface UploadPcrAssetInput {
  file: File;
  reportId: string;
  agencyId: string;
  assetType: AssetType;
  mediaLineId?: string | null;
  /** Explicit version; if omitted, computed as max existing + 1. */
  version?: number;
}

/**
 * Upload a file to pcr-assets/<agency_id>/<report_id>/<version>-<name> (never
 * overwriting an existing version) and record a pcr_assets row. Returns the row.
 */
export async function uploadPcrAsset(input: UploadPcrAssetInput): Promise<PcrAsset> {
  const { file, reportId, agencyId, assetType, mediaLineId = null } = input;
  const version = input.version ?? (await nextAssetVersion(reportId, assetType));
  const path = `${agencyId}/${reportId}/${version}-${sanitiseName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(PCR_ASSETS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data, error } = await supabase
    .from('pcr_assets')
    .insert({
      report_id: reportId,
      agency_id: agencyId,
      asset_type: assetType,
      storage_path: path,
      original_name: file.name,
      mime_type: file.type || null,
      version,
      media_line_id: mediaLineId,
    })
    .select('*')
    .single();
  return orThrow(data, error, 'Failed to record asset');
}

export async function createSignedUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(PCR_ASSETS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Media lines
// ------------------------------------------------------------

export async function listMediaLines(reportId: string): Promise<PcrMediaLine[]> {
  const { data, error } = await supabase
    .from('pcr_media_lines')
    .select('*')
    .eq('report_id', reportId)
    .order('sort_order', { ascending: true });
  return orThrow(data, error, 'Failed to load media lines') ?? [];
}

export interface MediaLineInput {
  id?: string;
  report_id: string;
  agency_id: string;
  line_type: PcrMediaLine['line_type'];
  label: string;
  metrics: MediaMetrics;
  source: PcrMediaLine['source'];
  source_note: string | null;
  sort_order: number;
}

export async function saveMediaLine(line: MediaLineInput): Promise<PcrMediaLine> {
  const { data, error } = await supabase
    .from('pcr_media_lines')
    .upsert(line)
    .select('*')
    .single();
  return orThrow(data, error, 'Failed to save media line');
}

export async function deleteMediaLine(id: string): Promise<void> {
  const { error } = await supabase.from('pcr_media_lines').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete media line: ${error.message}`);
}

// ------------------------------------------------------------
// Convenience: group plan rows by kind
// ------------------------------------------------------------

export function planRowsByKind(rows: PcrPlanRow[], kind: RowKind): PcrPlanRow[] {
  return rows.filter((r) => r.row_kind === kind);
}
