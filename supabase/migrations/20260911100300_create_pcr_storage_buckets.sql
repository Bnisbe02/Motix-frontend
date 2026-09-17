/*
  # PCR Phase 1 — Storage buckets

  Two PRIVATE buckets:

    brand-assets   agency logos and cover images referenced by brand_kits
    pcr-assets     media plan workbooks, screenshots and campaign imagery
                   referenced by pcr_assets

  OBJECT PATH CONVENTION (enforced by the policies below)
  --------------------------------------------------------
  Every object key MUST start with the caller's agency id as its first
  folder segment:

      <agency_id>/<anything...>
      e.g.  nova/logo-light.png
            nova/logo_dark.svg
            nova/<report_id>/media-plan-v2.xlsx

  `storage.foldername(name)` splits the key into its folder segments, and
  `[1]` is the first one. The policies compare that segment to
  `get_agency_id()` (the JWT app_metadata.agency_id claim), so a user can
  only list, read, write or delete objects under their own agency prefix.
  Uploads to any other prefix are rejected by RLS. Files are served to the
  browser through short-lived signed URLs (see src/hooks/useBrandKit.ts),
  never public URLs.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('brand-assets', 'brand-assets', false),
  ('pcr-assets',   'pcr-assets',   false)
ON CONFLICT DO NOTHING;

-- storage.objects already has RLS enabled in every Supabase project.

DROP POLICY IF EXISTS "agency select pcr storage" ON storage.objects;
CREATE POLICY "agency select pcr storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('brand-assets', 'pcr-assets')
    AND (storage.foldername(name))[1] = public.get_agency_id()
  );

DROP POLICY IF EXISTS "agency insert pcr storage" ON storage.objects;
CREATE POLICY "agency insert pcr storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('brand-assets', 'pcr-assets')
    AND (storage.foldername(name))[1] = public.get_agency_id()
  );

DROP POLICY IF EXISTS "agency update pcr storage" ON storage.objects;
CREATE POLICY "agency update pcr storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('brand-assets', 'pcr-assets')
    AND (storage.foldername(name))[1] = public.get_agency_id()
  )
  WITH CHECK (
    bucket_id IN ('brand-assets', 'pcr-assets')
    AND (storage.foldername(name))[1] = public.get_agency_id()
  );

DROP POLICY IF EXISTS "agency delete pcr storage" ON storage.objects;
CREATE POLICY "agency delete pcr storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('brand-assets', 'pcr-assets')
    AND (storage.foldername(name))[1] = public.get_agency_id()
  );
