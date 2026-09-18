/*
  PCR Phase 4 pure-logic tests: the deckTheme tint/geometry helpers are pure
  and deterministic, KPI selection prefers the right keys, and the rebuilt PPTX
  generator emits the expected slide count for a populated model. The
  byte-level visual-system assertions (styled tables, KPI cards, dual logos,
  and the voice rule — no section prose on data slides) run in
  scripts/check-pptx-phase4.mjs, which serialises a real .pptx. Run via
  `npm run test`.
*/
import {
  deriveTheme,
  tint,
  shade,
  normaliseHex,
  panelSplit,
  contentRect,
  kpiRow,
  kpiStack,
  pickKpis,
  logoLockup,
  GEOM,
} from '../lib/pcr/deckTheme';
import { buildPptx } from '../lib/pcr/pptxGenerator';
import { buildSampleModel, sampleBrandKit, sampleNarrative } from './pcr.sample';

let failures = 0;
let count = 0;
function check(label: string, cond: boolean, detail = ''): void {
  count += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '  -> ' + detail : ''}`);
  if (!cond) failures += 1;
}
function eq<T>(label: string, actual: T, expected: T): void {
  check(label, JSON.stringify(actual) === JSON.stringify(expected), `got ${JSON.stringify(actual)}`);
}

// ------------------------------------------------------------
console.log('\n# deckTheme colour helpers (pure + deterministic)');
eq('normaliseHex strips # and uppercases', normaliseHex('#5b2c83', '000000'), '5B2C83');
eq('normaliseHex falls back on garbage', normaliseHex('nope', 'ABCDEF'), 'ABCDEF');
eq('tint accepts # or bare, same result', tint('#5B2C83', 0.5), tint('5B2C83', 0.5));
eq('tint amount 0 is the colour', tint('5B2C83', 0), '5B2C83');
eq('tint amount 1 is white', tint('5B2C83', 1), 'FFFFFF');
eq('shade amount 1 is black', shade('5B2C83', 1), '000000');
eq('tint is deterministic', tint('123B63', 0.78), tint('123B63', 0.78));
check('tint clamps out-of-range amount', tint('5B2C83', 5) === 'FFFFFF' && tint('5B2C83', -1) === '5B2C83');

console.log('\n# deriveTheme');
const t1 = deriveTheme(sampleBrandKit);
const t2 = deriveTheme(sampleBrandKit);
eq('deriveTheme is deterministic', JSON.stringify(t1), JSON.stringify(t2));
eq('primary comes from the kit', t1.colors.primary, '123B63');
eq('accent comes from the kit', t1.colors.accent, 'E07A2F');
eq('zebra is a light primary tint', t1.colors.zebra, tint('123B63', 0.9));
eq('total fill is a stronger primary tint', t1.colors.totalFill, tint('123B63', 0.78));
eq('heading font from the kit', t1.fonts.heading, 'Poppins');
const tNull = deriveTheme(null);
check('null kit yields the neutral default primary', tNull.colors.primary === '5B2C83');

console.log('\n# geometry helpers');
const split = panelSplit(t1, 'left');
eq('brand panel starts at x=0 on the left', split.brand.x, 0);
check('brand + data widths span the slide', Math.abs(split.brand.w + split.data.w - GEOM.slideW) < 1e-9, `${split.brand.w + split.data.w}`);
check('data panel is right of the brand panel', split.data.x === split.brand.w);
const splitR = panelSplit(t1, 'right');
check('right-side brand panel sits on the right', splitR.brand.x > splitR.data.x);
const content = contentRect(t1, split.data);
check('content rect is inside the data panel', content.x >= split.data.x && content.w <= split.data.w);
check('content rect leaves room for the footer', content.y + content.h <= GEOM.slideH - GEOM.footerH + 1e-9);

const row = kpiRow(t1, { x: 1, y: 2 }, 3);
eq('kpiRow lays out 3 cards', row.length, 3);
eq('kpiRow spaces cards by width + gap', row[1].x - row[0].x, GEOM.kpi.w + GEOM.kpi.gap);
check('kpiRow is deterministic', JSON.stringify(kpiRow(t1, { x: 1, y: 2 }, 3)) === JSON.stringify(row));
const stack = kpiStack(t1, { x: 1, y: 2 }, 2, 3);
check('kpiStack spaces cards vertically by height + gap', Math.abs(stack[1].y - stack[0].y - (GEOM.kpi.h + GEOM.kpi.gap)) < 1e-9);

console.log('\n# logo lockup');
const lockSolo = logoLockup({ x: 0, y: 0, w: 13.333, h: 1 }, false);
check('solo lockup has no client rect or divider', lockSolo.client === null && lockSolo.divider === null);
const lockDual = logoLockup({ x: 0, y: 0, w: 13.333, h: 1 }, true);
check('dual lockup has a client rect and a divider', lockDual.client !== null && lockDual.divider !== null);
check('dual lockup client sits right of network', (lockDual.client?.x ?? 0) > lockDual.network.x);

console.log('\n# KPI selection prefers the line type order');
const streamPick = pickKpis({ imps_delivered: 100, imps_booked: 90, foo: 1 }, 'streaming', 3);
check('streaming picks imps_booked and imps_delivered first', streamPick.usedKeys.has('imps_booked') && streamPick.usedKeys.has('imps_delivered'));
eq('streaming first card is impressions booked', streamPick.cards[0].label, 'Impressions booked');
const audPick = pickKpis({ gross_impacts: 5, reach_1plus: 10, avg_frequency: 3 }, 'audience', 3);
eq('audience first card is reach 1+', audPick.cards[0].label, 'Reach 1+');
const fallbackPick = pickKpis({ zzz: 1, aaa: 2 }, 'social', 3);
check('unknown line type still yields cards (fallback)', fallbackPick.cards.length === 2);

// ------------------------------------------------------------
console.log('\n# rebuilt PPTX generator slide count');
const model = buildSampleModel();
const deck = await buildPptx(model, sampleBrandKit, { narrative: sampleNarrative, clientLogoPath: 'x' });
// cover + overview + broadcast + paid-vs-bonus + reconciliation + streaming + podcast + audience + closing = 9
eq('populated sample deck has 9 slides', (deck as unknown as { slides: unknown[] }).slides.length, 9);
const deckNoNarrative = await buildPptx(model, sampleBrandKit, {});
eq('no overview slide without narrative (8)', (deckNoNarrative as unknown as { slides: unknown[] }).slides.length, 8);

// ------------------------------------------------------------
console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'} (${count} checks)`);
if (failures > 0) process.exit(1);
