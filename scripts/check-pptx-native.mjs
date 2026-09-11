/*
  Byte-level PPTX check (Part 4 validation): bundle a small entry to CommonJS
  (so pptxgenjs can require('fs') when serialising), build a deck from a
  representative model, write a real .pptx, then unzip and assert that the
  slides contain NATIVE table (<a:tbl>) and chart (graphicFrame + chart part)
  objects — i.e. editable objects, not images of content.
*/
import { build } from 'esbuild';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const outDir = mkdtempSync(join(tmpdir(), 'motix-pptx-'));
let failed = false;
const check = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failed = true;
};

try {
  const entry = join(outDir, 'entry.cjs');
  const pptxPath = join(outDir, 'out.pptx');

  // Bundle the smoke entry to CJS/node so require('fs') resolves natively.
  await build({
    entryPoints: ['src/test/pptx.smoke.ts'],
    outfile: entry,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    logLevel: 'error',
  });

  const require = createRequire(import.meta.url);
  const { buildDeck } = require(entry);
  const buffer = await buildDeck();
  writeFileSync(pptxPath, buffer);

  check('pptx written and non-empty (>3KB)', buffer.length > 3000);
  check('pptx is a ZIP (PK header)', buffer[0] === 0x50 && buffer[1] === 0x4b);

  const listing = execSync(`unzip -l "${pptxPath}"`, { encoding: 'utf8' });
  check('deck contains slide parts', /ppt\/slides\/slide1\.xml/.test(listing));
  check('deck contains a native chart part', /ppt\/charts\/chart\d+\.xml/.test(listing));

  // Concatenate all slide XML and assert a native table element is present.
  const slideNums = [...listing.matchAll(/ppt\/slides\/slide(\d+)\.xml/g)].map((m) => m[1]);
  let anyTable = false;
  for (const n of slideNums) {
    const xml = execSync(`unzip -p "${pptxPath}" ppt/slides/slide${n}.xml`, { encoding: 'utf8' });
    if (xml.includes('<a:tbl>')) anyTable = true;
    // A chart on a slide is referenced via a graphicFrame -> chart relationship.
  }
  check('a slide contains a native table (<a:tbl>)', anyTable);

  const relsAll = execSync(`unzip -p "${pptxPath}" 'ppt/slides/_rels/*.xml.rels' 2>/dev/null || true`, { encoding: 'utf8' });
  check('a slide references a chart relationship', /charts\/chart\d+\.xml/.test(relsAll));
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log(failed ? '\nPPTX NATIVE CHECK FAILED' : '\nPPTX NATIVE CHECK PASSED');
process.exit(failed ? 1 : 0);
