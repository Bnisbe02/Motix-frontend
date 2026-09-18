/*
  # PCR Phase 4 — brand kit visual system

  Adds the deck-imagery assets the Phase 4 visual system draws on. Both
  columns are additive and nullable / defaulted, so existing kits are
  unaffected and keep working with a solid-colour panel fallback.

    texture_image_path  object key in the private 'brand-assets' bucket for a
                        branded pattern/texture drawn behind section titles
                        when a section has no dedicated hero image. NULL falls
                        back to a solid primary-colour panel.
    section_images      map of section key -> object key in 'brand-assets' for
                        an optional hero image per deck section (cover,
                        overview, broadcast, reconciliation, streaming,
                        podcast, social, integration, audience, closing). A
                        section absent from the map falls back to the texture,
                        then to a solid colour panel.

  Like every other brand asset the paths MUST start with the agency id (the
  first path segment) so the storage RLS on 'brand-assets' passes. No RLS
  change here: the Phase 1 brand_kits policies already cover all columns.
*/

ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS texture_image_path text;
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS section_images jsonb NOT NULL DEFAULT '{}'::jsonb;
