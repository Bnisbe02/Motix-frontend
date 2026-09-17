/*
  # PCR Phase 3 — brand kit report voice

  Adds two nullable columns to brand_kits so the report narrative writer can
  match each agency's house voice:

    tone_description  a short description of the desired voice, e.g.
                      "warm, playful, confident, second person".
    tone_reference    optional reference copy (the agency's own past overview
                      paragraphs) used only to guide voice — never echoed
                      verbatim into generated output.

  Both nullable and additive; existing kits are unaffected and default to a
  neutral factual tone when blank. No RLS change (the Phase 1 brand_kits
  policies already cover all columns).
*/

ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS tone_description text;
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS tone_reference text;
