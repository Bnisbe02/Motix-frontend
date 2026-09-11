/*
  # PCR Phase 1 — Post-Campaign Report tables

  Three agency-scoped tables that Phase 2 (report builder) and Phase 3
  (narrative + PowerPoint export) build on:

    pcr_reports      one row per report: advertiser, campaign, date range,
                     stations, status and (later) the narrative copy.
    pcr_media_lines  off-broadcast and supplied lines (podcast, streaming,
                     social, integration, audience...) with a `source`
                     provenance flag so every figure on a slide can be traced
                     to MOTIX observation, an upload, or manual entry.
    pcr_assets       uploaded files (media plan workbooks, screenshots,
                     campaign imagery). Media plans are versioned, never
                     overwritten. Objects live in the private 'pcr-assets'
                     bucket under '<agency_id>/...'.

  Tenancy: every table carries `agency_id text NOT NULL` and every policy
  compares it to `get_agency_id()`. Child rows carry their own agency_id
  (denormalised from the report) so policies never need a join.

  Requires `set_updated_at()` from 20260911100100_create_brand_kits.sql.
*/

-- ============================================================
-- pcr_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS pcr_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       text NOT NULL,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  advertiser      text NOT NULL,
  campaign_name   text NOT NULL,
  date_from       date NOT NULL,
  date_to         date NOT NULL,
  station_callsigns text[] NOT NULL DEFAULT '{}',
  objectives      text,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','generated','exported')),
  client_logo_path text,
  narrative       jsonb,                    -- model-drafted, user-edited copy; filled in Phase 3
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (date_to >= date_from)
);

-- ============================================================
-- pcr_media_lines
-- Off-broadcast and supplied lines: podcast, streaming, social,
-- integration, audience, plan
-- ============================================================
CREATE TABLE IF NOT EXISTS pcr_media_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid NOT NULL REFERENCES pcr_reports(id) ON DELETE CASCADE,
  agency_id       text NOT NULL,
  line_type       text NOT NULL CHECK (line_type IN ('podcast','streaming','social','integration','display','activation','audience','other')),
  label           text NOT NULL,            -- e.g. 'Nova Podcasts', 'Ben Liam & Belle promo'
  metrics         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {"imps_booked":430005,"imps_delivered":557241,...}
  source          text NOT NULL CHECK (source IN ('motix_observed','uploaded','manual')),
  source_note     text,                     -- e.g. 'GfK Fusion Survey 4 2025'
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- pcr_assets
-- Uploaded files: media plan workbooks, screenshots, campaign imagery
-- ============================================================
CREATE TABLE IF NOT EXISTS pcr_assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid NOT NULL REFERENCES pcr_reports(id) ON DELETE CASCADE,
  agency_id       text NOT NULL,
  asset_type      text NOT NULL CHECK (asset_type IN ('media_plan','screenshot','campaign_image','other')),
  storage_path    text NOT NULL,            -- bucket 'pcr-assets'
  original_name   text NOT NULL,
  mime_type       text,
  version         int NOT NULL DEFAULT 1,   -- media plans are versioned, never overwritten
  media_line_id   uuid REFERENCES pcr_media_lines(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pcr_reports_agency ON pcr_reports(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcr_media_lines_report ON pcr_media_lines(report_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pcr_assets_report ON pcr_assets(report_id);

-- ============================================================
-- Row Level Security — pcr_reports
-- ============================================================
ALTER TABLE pcr_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency select pcr_reports" ON pcr_reports;
CREATE POLICY "agency select pcr_reports"
  ON pcr_reports FOR SELECT
  TO authenticated
  USING (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency insert pcr_reports" ON pcr_reports;
CREATE POLICY "agency insert pcr_reports"
  ON pcr_reports FOR INSERT
  TO authenticated
  WITH CHECK (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency update pcr_reports" ON pcr_reports;
CREATE POLICY "agency update pcr_reports"
  ON pcr_reports FOR UPDATE
  TO authenticated
  USING (agency_id = get_agency_id())
  WITH CHECK (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency delete pcr_reports" ON pcr_reports;
CREATE POLICY "agency delete pcr_reports"
  ON pcr_reports FOR DELETE
  TO authenticated
  USING (agency_id = get_agency_id());

-- ============================================================
-- Row Level Security — pcr_media_lines
-- ============================================================
ALTER TABLE pcr_media_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency select pcr_media_lines" ON pcr_media_lines;
CREATE POLICY "agency select pcr_media_lines"
  ON pcr_media_lines FOR SELECT
  TO authenticated
  USING (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency insert pcr_media_lines" ON pcr_media_lines;
CREATE POLICY "agency insert pcr_media_lines"
  ON pcr_media_lines FOR INSERT
  TO authenticated
  WITH CHECK (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency update pcr_media_lines" ON pcr_media_lines;
CREATE POLICY "agency update pcr_media_lines"
  ON pcr_media_lines FOR UPDATE
  TO authenticated
  USING (agency_id = get_agency_id())
  WITH CHECK (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency delete pcr_media_lines" ON pcr_media_lines;
CREATE POLICY "agency delete pcr_media_lines"
  ON pcr_media_lines FOR DELETE
  TO authenticated
  USING (agency_id = get_agency_id());

-- ============================================================
-- Row Level Security — pcr_assets
-- ============================================================
ALTER TABLE pcr_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency select pcr_assets" ON pcr_assets;
CREATE POLICY "agency select pcr_assets"
  ON pcr_assets FOR SELECT
  TO authenticated
  USING (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency insert pcr_assets" ON pcr_assets;
CREATE POLICY "agency insert pcr_assets"
  ON pcr_assets FOR INSERT
  TO authenticated
  WITH CHECK (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency update pcr_assets" ON pcr_assets;
CREATE POLICY "agency update pcr_assets"
  ON pcr_assets FOR UPDATE
  TO authenticated
  USING (agency_id = get_agency_id())
  WITH CHECK (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency delete pcr_assets" ON pcr_assets;
CREATE POLICY "agency delete pcr_assets"
  ON pcr_assets FOR DELETE
  TO authenticated
  USING (agency_id = get_agency_id());

-- ============================================================
-- updated_at trigger
-- ============================================================
DROP TRIGGER IF EXISTS trg_pcr_reports_set_updated_at ON pcr_reports;
CREATE TRIGGER trg_pcr_reports_set_updated_at
  BEFORE UPDATE ON pcr_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
