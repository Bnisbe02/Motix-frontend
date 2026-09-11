/*
  # PCR Phase 1 — ROLLBACK (down migration)

  NOT part of the migrations folder and never run by `supabase db push`.
  Apply manually in the Supabase SQL editor only if Phase 1 has to be
  backed out after the merge commit is reverted.

  Order matters: children before parents, policies before buckets.
  Bucket rows cannot be deleted while objects remain, so objects are
  removed first. `set_updated_at()` is left in place because it is
  generic and harmless; drop it manually if nothing else uses it.
*/

-- 1. PCR tables (pcr_assets → pcr_media_lines → pcr_reports)
DROP TABLE IF EXISTS pcr_assets;
DROP TABLE IF EXISTS pcr_media_lines;
DROP TABLE IF EXISTS pcr_reports;

-- 2. Brand kits
DROP TABLE IF EXISTS brand_kits;

-- 3. Station registry
DROP TABLE IF EXISTS stations;

-- 4. Storage policies
DROP POLICY IF EXISTS "agency select pcr storage" ON storage.objects;
DROP POLICY IF EXISTS "agency insert pcr storage" ON storage.objects;
DROP POLICY IF EXISTS "agency update pcr storage" ON storage.objects;
DROP POLICY IF EXISTS "agency delete pcr storage" ON storage.objects;

-- 5. Storage buckets (objects first, then the bucket rows)
DELETE FROM storage.objects WHERE bucket_id IN ('brand-assets', 'pcr-assets');
DELETE FROM storage.buckets WHERE id IN ('brand-assets', 'pcr-assets');

-- Indexes trg_* and idx_* are dropped implicitly with their tables.
