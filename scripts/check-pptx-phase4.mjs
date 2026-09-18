/*
  Phase 4 visual-system byte check. Bundles the phase-4 smoke entry to CommonJS
  (so pptxgenjs can require('fs') when serialising), builds the Brightwater
  sample deck with every asset resolved, writes a real .pptx, then unzips and
  asserts the visual system landed:
    - the expected slide count,
    - styled tables carry a header row (primary fill) AND a total row,
    - KPI cards appear on the streaming/podcast/audience slides,
    - a dual-logo lockup embeds images on the cover + closing,
    - the voice rule: the narrative OVERVIEW appears but NO section-summary
      prose is drawn on any slide.
*/
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const outDir = mkdtempSync(join(tmpdir(), 'motix-pptx4-'));
let failed = false;
const check = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failed = true;
};

try {
  const entry = join(outDir, 'entry.cjs');
  const pptxPath = join(outDir, 'out.pptx');

  await build({
    entryPoints: ['src/test/pptx.phase4.smoke.ts'],
    outfile: entry,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    logLevel: 'error',
  });

  const require = createRequire(import.meta.url);
  const { buildPhase4Deck } = require(entry);
  const buffer = await buildPhase4Deck();
  writeFileSync(pptxPath, buffer);

  check('pptx written and non-empty (>3KB)', buffer.length > 3000);
  check('pptx is a ZIP (PK header)', buffer[0] === 0x50 && buffer[1] === 0x4b);

  const listing = execSync(`unzip -l "${pptxPath}"`, { encoding: 'utf8' });
  const slideNums = [...listing.matchAll(/ppt\/slides\/slide(\d+)\.xml/g)].map((m) => m[1]);
  check('deck has 9 slides (cover, overview, broadcast, paid/bonus, reconciliation, streaming, podcast, audience, closing)', slideNums.length === 9);
  const mediaCount = [...listing.matchAll(/ppt\/media\/\S+\.(png|jpe?g)/gi)].length;
  check('deck embeds images (dual logos + section panels)', mediaCount >= 4);
  check('deck contains native chart parts', /ppt\/charts\/chart\d+\.xml/.test(listing));

  // Concatenate all slide XML for content assertions.
  let allSlideXml = '';
  const perSlideXml = {};
  for (const n of slideNums) {
    const xml = execSync(`unzip -p "${pptxPath}" ppt/slides/slide${n}.xml`, { encoding: 'utf8' });
    perSlideXml[n] = xml;
    allSlideXml += xml;
  }

  // Styled tables: a native table, the primary header fill, the total-row fill,
  // and a "Total" cell.
  check('a slide contains a native table (<a:tbl>)', allSlideXml.includes('<a:tbl>'));
  check('table header uses the primary fill (123B63)', /123B63/.test(allSlideXml));
  check('a table carries a total row (fill CBD4DD)', /CBD4DD/.test(allSlideXml));
  check('a table has a Total row label', /<a:t>Total<\/a:t>/.test(allSlideXml));
  check('zebra alt-row fill present (E7EBEF)', /E7EBEF/.test(allSlideXml));

  // KPI cards: the streaming/podcast/audience slides lead with big value cards.
  check('streaming KPI label present (Impressions delivered)', allSlideXml.includes('Impressions delivered'));
  check('audience KPI label present (Reach 1+)', allSlideXml.includes('Reach 1+'));

  // Voice rule: overview marker appears; section-summary markers never do.
  check('overview prose appears (OVERVIEWMARKER)', allSlideXml.includes('OVERVIEWMARKER'));
  check('no broadcast section prose on any slide (BROADCASTPROSEMARKER absent)', !allSlideXml.includes('BROADCASTPROSEMARKER'));
  check('no streaming section prose on any slide (STREAMINGPROSEMARKER absent)', !allSlideXml.includes('STREAMINGPROSEMARKER'));
  check('no audience section prose on any slide (AUDIENCEPROSEMARKER absent)', !allSlideXml.includes('AUDIENCEPROSEMARKER'));

  // Section titles reversed out on the branded panels.
  check('reversed section title "Broadcast delivery" present', allSlideXml.includes('Broadcast delivery'));
  check('closing "Thank you" present', allSlideXml.includes('Thank you'));
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log(failed ? '\nPPTX PHASE 4 CHECK FAILED' : '\nPPTX PHASE 4 CHECK PASSED');
process.exit(failed ? 1 : 0);
