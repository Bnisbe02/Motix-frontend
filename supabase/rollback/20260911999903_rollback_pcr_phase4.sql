/*
  # PCR Phase 4 — ROLLBACK (down migration)

  NOT part of the migrations folder and never run by `supabase db push`.
  Apply manually in the Supabase SQL editor only if Phase 4 has to be backed
  out (the merge commit is reverted for the code).

  Drops the two brand_kits visual columns added by 20260911160000. Additive
  phase, so this is the only schema change to undo.
*/

ALTER TABLE brand_kits DROP COLUMN IF EXISTS texture_image_path;
ALTER TABLE brand_kits DROP COLUMN IF EXISTS section_images;
