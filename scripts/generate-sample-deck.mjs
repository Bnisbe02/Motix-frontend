/*
  Generate the committed sample deck. Bundles the sample build helpers to
  CommonJS (so pptxgenjs can require('fs') when serialising), builds the shared
  "Brightwater Home Loans" PCR with every visual asset resolved, and writes
  docs/samples/Brightwater_Home_Loans_PCR.pptx and .pdf.

  Run: node scripts/generate-sample-deck.mjs
*/
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const outDir = mkdtempSync(join(tmpdir(), 'motix-sample-'));
const samplesDir = resolve('docs/samples');
mkdirSync(samplesDir, { recursive: true });

try {
  const entry = join(outDir, 'entry.cjs');
  await build({
    entryPoints: ['src/test/sample.build.ts'],
    outfile: entry,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    logLevel: 'error',
  });

  const require = createRequire(import.meta.url);
  const { buildPptxBytes, buildPdfBytes } = require(entry);

  const pptx = await buildPptxBytes();
  const pptxPath = join(samplesDir, 'Brightwater_Home_Loans_PCR.pptx');
  writeFileSync(pptxPath, pptx);
  console.log(`Wrote ${pptxPath} (${pptx.length} bytes)`);

  const pdf = await buildPdfBytes();
  const pdfPath = join(samplesDir, 'Brightwater_Home_Loans_PCR.pdf');
  writeFileSync(pdfPath, pdf);
  console.log(`Wrote ${pdfPath} (${pdf.length} bytes)`);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
