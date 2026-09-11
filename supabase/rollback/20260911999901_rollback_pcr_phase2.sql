/*
  # PCR Phase 2 — ROLLBACK (down migration)

  NOT part of the migrations folder and never run by `supabase db push`.
  Apply manually in the Supabase SQL editor only if Phase 2 has to be
  backed out (the merge commit is reverted for the code).

  Drops the two Phase 2 tables and restores the Phase 1 asset_type CHECK
  (without 'delivery_log'). Run BEFORE the Phase 1 rollback if backing out
  both, since these tables reference pcr_reports/pcr_assets.

  NOTE: restoring the asset_type CHECK will fail if any pcr_assets row still
  has asset_type = 'delivery_log'. Reclassify or delete those rows first.
*/

-- 1. Phase 2 tables (plan rows reference pcr_assets; both reference pcr_reports)
DROP TABLE IF EXISTS pcr_plan_rows;
DROP TABLE IF EXISTS pcr_detection_inclusions;

-- 1b. Drop the composite unique added to pcr_assets for the plan-row FK.
ALTER TABLE pcr_assets DROP CONSTRAINT IF EXISTS pcr_assets_id_report_id_key;

-- 2. Restore the Phase 1 asset_type CHECK (no 'delivery_log')
ALTER TABLE pcr_assets DROP CONSTRAINT IF EXISTS pcr_assets_asset_type_check;
ALTER TABLE pcr_assets
  ADD CONSTRAINT pcr_assets_asset_type_check
  CHECK (asset_type IN ('media_plan','screenshot','campaign_image','other'));
