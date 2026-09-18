/*
  Build helpers for scripts/generate-sample-deck.mjs — serialise the shared
  Brightwater sample as a .pptx and a .pdf (both with every visual asset
  resolved via the placeholder resolver). Not part of the app bundle.
*/
import { buildPptx } from '../lib/pcr/pptxGenerator';
import { generatePdf } from '../lib/pcr/pdfExport';
import { buildSampleModel, sampleBrandKit, sampleNarrative, sampleResolver, sampleClientLogoPath } from './pcr.sample';

export async function buildPptxBytes(): Promise<Uint8Array> {
  const model = buildSampleModel();
  const pptx = await buildPptx(model, sampleBrandKit, {
    narrative: sampleNarrative,
    assetResolver: sampleResolver(),
    clientLogoPath: sampleClientLogoPath,
  });
  return (await pptx.write({ outputType: 'nodebuffer' })) as Uint8Array;
}

export async function buildPdfBytes(): Promise<Uint8Array> {
  const model = buildSampleModel();
  // NOTE: jsPDF's addImage hangs under Node (it is a browser API), so the
  // node-generated sample PDF omits the resolver and renders the branded panels
  // as solid colour fields. In the browser the PDF embeds logos and section
  // imagery normally — the same generatePdf, just with a working resolver.
  const blob = await generatePdf(model, sampleBrandKit, {
    narrative: sampleNarrative,
    clientLogoPath: sampleClientLogoPath,
  });
  return new Uint8Array(await blob.arrayBuffer());
}
