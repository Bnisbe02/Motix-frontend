/*
  Lightweight unit-test runner for PCR pure logic (same approach as Phase 1):
  bundle the .test.ts entry with esbuild, then run it under Node. No test
  framework. Each test file prints PASS/FAIL lines and exits non-zero on
  failure. esbuild ships as a transitive dependency of Vite.
*/
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TESTS = ['src/test/pcr.units.test.ts'];

const outDir = mkdtempSync(join(tmpdir(), 'motix-tests-'));
let failed = false;

try {
  for (const entry of TESTS) {
    const outfile = join(outDir, entry.replace(/[/.]/g, '_') + '.mjs');
    await build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node18',
      logLevel: 'error',
      // xlsx is bundled in; it is pure JS and runs under Node.
    });
    console.log(`\n=== ${entry} ===`);
    try {
      await import(pathToFileURL(outfile).href);
    } catch (err) {
      console.error(err);
      failed = true;
    }
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
