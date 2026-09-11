/*
  # PCR Phase 1 — Brand kits

  One brand kit per agency (network). Holds the colours, fonts, logo /
  cover-image storage paths and the daypart schedule used when a
  Post-Campaign Report is generated.

  Dayparts are network-specific (Nova's Breakfast is 05:30–09:00, other
  networks differ) so they live on the kit rather than on the station.

  Tenancy: `agency_id` is read from the JWT `app_metadata.agency_id` claim
  via `get_agency_id()` (see 20260315084349_20260315070000_add_agency_rls.sql).
  `agency_id` is UNIQUE so the client can upsert on it.

  Logo / cover paths are object keys in the private 'brand-assets' bucket
  and MUST start with the agency id (see
  20260911100300_create_pcr_storage_buckets.sql).
*/

-- Reusable trigger function: bump updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS brand_kits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id        text NOT NULL UNIQUE,
  name             text NOT NULL DEFAULT 'Default',
  primary_colour   text NOT NULL DEFAULT '#5B2C83',
  secondary_colour text NOT NULL DEFAULT '#C8B8A6',
  accent_colour    text NOT NULL DEFAULT '#E4002B',
  text_on_primary  text NOT NULL DEFAULT '#FFFFFF',
  heading_font     text NOT NULL DEFAULT 'Montserrat',
  body_font        text NOT NULL DEFAULT 'Calibri',
  logo_light_path  text,                    -- storage path in bucket 'brand-assets'
  logo_dark_path   text,
  cover_image_path text,
  dayparts         jsonb NOT NULL DEFAULT '[
    {"name":"Breakfast","start":"05:30","end":"09:00"},
    {"name":"Morning","start":"09:00","end":"12:00"},
    {"name":"Afternoon","start":"12:00","end":"16:00"},
    {"name":"Drive","start":"16:00","end":"20:00"},
    {"name":"Evening","start":"20:00","end":"22:00"},
    {"name":"Late Evening","start":"22:00","end":"24:00"},
    {"name":"Mid-Dawn","start":"00:00","end":"05:30"}
  ]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency select brand_kits" ON brand_kits;
CREATE POLICY "agency select brand_kits"
  ON brand_kits FOR SELECT
  TO authenticated
  USING (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency insert brand_kits" ON brand_kits;
CREATE POLICY "agency insert brand_kits"
  ON brand_kits FOR INSERT
  TO authenticated
  WITH CHECK (agency_id = get_agency_id());

DROP POLICY IF EXISTS "agency update brand_kits" ON brand_kits;
CREATE POLICY "agency update brand_kits"
  ON brand_kits FOR UPDATE
  TO authenticated
  USING (agency_id = get_agency_id())
  WITH CHECK (agency_id = get_agency_id());

-- No DELETE policy: a kit is never deleted by a client, only reset.

DROP TRIGGER IF EXISTS trg_brand_kits_set_updated_at ON brand_kits;
CREATE TRIGGER trg_brand_kits_set_updated_at
  BEFORE UPDATE ON brand_kits
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
