/*
  # PCR Phase 3 — ROLLBACK (down migration)

  NOT part of the migrations folder and never run by `supabase db push`.
  Apply manually in the Supabase SQL editor only if Phase 3 has to be backed
  out (the merge commit is reverted for the code, and the pcr-narrative Edge
  Function is removed by deleting its folder and the workflow deploy step).

  Drops the two brand_kits tone columns added by 20260911140000. Additive
  phase, so this is the only schema change to undo.
*/

ALTER TABLE brand_kits DROP COLUMN IF EXISTS tone_description;
ALTER TABLE brand_kits DROP COLUMN IF EXISTS tone_reference;
