/*
  Phase 4 PPTX smoke entry for scripts/check-pptx-phase4.mjs. Builds the shared
  Brightwater sample deck WITH all visual assets resolved (via the placeholder
  resolver) and returns the serialised bytes for byte-level XML assertions.
  Not part of the app bundle.
*/
import { buildPptx } from '../lib/pcr/pptxGenerator';
import { buildSampleModel, sampleBrandKit, sampleNarrative, sampleResolver, sampleClientLogoPath } from './pcr.sample';

export async function buildPhase4Deck(): Promise<Uint8Array> {
  const model = buildSampleModel();
  const pptx = await buildPptx(model, sampleBrandKit, {
    narrative: sampleNarrative,
    assetResolver: sampleResolver(),
    clientLogoPath: sampleClientLogoPath,
  });
  return (await pptx.write({ outputType: 'nodebuffer' })) as Uint8Array;
}
