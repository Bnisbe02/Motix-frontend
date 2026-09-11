/*
  # PCR Phase 2 — report builder tables

  Builds on the Phase 1 tables (20260911100*). Adds:

    1. 'delivery_log' to pcr_assets.asset_type CHECK — a network-supplied
       aired-post log is a distinct asset kind from a booked media plan.
    2. pcr_detection_inclusions: per-report include/exclude decision for each
       MOTIX-observed detection pulled from the delivery mirror. The mirror
       row is referenced by its own key stored as text (detection_id); the
       mirror itself is written by the OVH backend and is not touched here.
    3. pcr_plan_rows: normalised rows parsed from imported media plans
       (row_kind 'booked') and network delivery logs (row_kind 'aired'),
       each tied to the pcr_assets row it came from and keeping the original
       row in `raw`.

  Tenancy: every new table carries `agency_id text NOT NULL` and every RLS
  policy compares it to get_agency_id() (defined in
  20260315084349_20260315070000_add_agency_rls.sql), exactly as Phase 1.
*/

-- ============================================================
-- 1. Extend pcr_assets.asset_type with 'delivery_log'
-- ============================================================
-- The CHECK constraint is named automatically by Postgres as
-- pcr_assets_asset_type_check. Drop and recreate it with the new value.
ALTER TABLE pcr_assets DROP CONSTRAINT IF EXISTS pcr_assets_asset_type_check;
ALTER TABLE pcr_assets
  ADD CONSTRAINT pcr_assets_asset_type_check
  CHECK (asset_type IN ('media_plan','delivery_log','screenshot','campaign_image','other'));

-- ============================================================
-- 2. pcr_detection_inclusions
-- ============================================================
CREATE TABLE IF NOT EXISTS pcr_detection_inclusions (
  report_id     uuid NOT NULL,
  agency_id     text NOT NULL,
  detection_id  text NOT NULL,        -- the mirror's unique key, stored as text
  included      boolean NOT NULL DEFAULT true,
  decided_by    uuid REFERENCES auth.users(id),
  decided_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, detection_id),
  -- Composite FK (not the plain report_id FK in the spec): forces the child's
  -- agency_id to equal the parent report's, so a caller who knows another
  -- agency's report UUID cannot attach an inclusion to it. Matches the
  -- Phase 1 security fix; requires pcr_reports UNIQUE (id, agency_id).
  FOREIGN KEY (report_id, agency_id) REFERENCES pcr_reports(id, agency_id) ON DELETE CASCADE
);

ALTER TABLE pcr_detection_inclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency select pcr_detection_inclusions" ON pcr_detection_inclusions;
CREATE POLICY "agency select pcr_detection_inclusions"
  ON pcr_detection_inclusions FOR SELECT
  TO authenticated
  USING (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency insert pcr_detection_inclusions" ON pcr_detection_inclusions;
CREATE POLICY "agency insert pcr_detection_inclusions"
  ON pcr_detection_inclusions FOR INSERT
  TO authenticated
  WITH CHECK (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency update pcr_detection_inclusions" ON pcr_detection_inclusions;
CREATE POLICY "agency update pcr_detection_inclusions"
  ON pcr_detection_inclusions FOR UPDATE
  TO authenticated
  USING (agency_id = get_agency_id())
  WITH CHECK (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency delete pcr_detection_inclusions" ON pcr_detection_inclusions;
CREATE POLICY "agency delete pcr_detection_inclusions"
  ON pcr_detection_inclusions FOR DELETE
  TO authenticated
  USING (agency_id = get_agency_id());

-- ============================================================
-- 3. pcr_plan_rows
-- ============================================================
CREATE TABLE IF NOT EXISTS pcr_plan_rows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     uuid NOT NULL,
  agency_id     text NOT NULL,
  asset_id      uuid NOT NULL REFERENCES pcr_assets(id) ON DELETE CASCADE,
  row_kind      text NOT NULL CHECK (row_kind IN ('booked','aired')),
  station_callsign text,                 -- resolved against stations registry, null if unresolved
  station_raw   text NOT NULL,           -- exactly what the file said
  aired_at      timestamptz,             -- aired rows only, station-local time converted to UTC
  booked_date   date,                    -- booked rows
  daypart_raw   text,
  duration_sec  int,
  creative_code text,
  spot_class    text CHECK (spot_class IN ('paid','bonus','unknown')),
  media_value   numeric(12,2),
  contract_ref  text,
  raw           jsonb NOT NULL,          -- the original row, untouched
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Composite FK for the same tenancy guard as pcr_detection_inclusions.
  FOREIGN KEY (report_id, agency_id) REFERENCES pcr_reports(id, agency_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pcr_plan_rows_report ON pcr_plan_rows(report_id, row_kind);

ALTER TABLE pcr_plan_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency select pcr_plan_rows" ON pcr_plan_rows;
CREATE POLICY "agency select pcr_plan_rows"
  ON pcr_plan_rows FOR SELECT
  TO authenticated
  USING (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency insert pcr_plan_rows" ON pcr_plan_rows;
CREATE POLICY "agency insert pcr_plan_rows"
  ON pcr_plan_rows FOR INSERT
  TO authenticated
  WITH CHECK (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency update pcr_plan_rows" ON pcr_plan_rows;
CREATE POLICY "agency update pcr_plan_rows"
  ON pcr_plan_rows FOR UPDATE
  TO authenticated
  USING (agency_id = get_agency_id())
  WITH CHECK (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency delete pcr_plan_rows" ON pcr_plan_rows;
CREATE POLICY "agency delete pcr_plan_rows"
  ON pcr_plan_rows FOR DELETE
  TO authenticated
  USING (agency_id = get_agency_id());
