/**
 * Someday · Horizon — 150 END-TO-END SCENARIOS.
 *
 *   npm run e2e150            (needs dist/: run `npm run build` first)
 *
 * One hundred and fifty different households are loaded into the real, built
 * app in a real browser, and what the home screen SAYS is checked against
 * what it SHOULD say. Each scenario is one test; it passes only if every one
 * of these holds:
 *
 *   A  the status in words is the one the rule gives for that plan
 *   B  the big figure is what the plan can pay in full (engine, by bisection)
 *   C  the label never contradicts the figure: "Not enough yet" or "Nearly
 *      enough" never sits beside money to spare, "On track" never beside a
 *      shortfall
 *   D  the gap sentence is the figure less the ask, to the pound shown
 *   E  the count of futures is the engine's, for the same seed
 *   F  the "Counts…" line is the plan's own pensions, savings and guaranteed
 *      income, added once
 *   G  NO DOUBLE COUNTING: the pots on the day of stopping match a compound-
 *      interest formula written here, not taken from the engine
 *   H  NOTHING FROM NOWHERE: the figure is no higher than a tax-free,
 *      perfectly smooth spend-down of those pots and guaranteed incomes could
 *      pay (again worked out here, independently of the engine)
 *   I  no error in the page or the console
 *   J  the same plan run in a second JavaScript engine (Node) supports the
 *      same figure to within 1%
 *   K  the canvas (100 stripes, one for each future, each painted for as
 *      long as that future pays) starts the year work stops, a lower stripe
 *      never runs further than a higher one, and the number of stripes that
 *      reach the right-hand edge is the futures count in the sentence
 *   L  (every fifth) the needle, moved with the keys to the last age and the
 *      first, reads the same counts
 *
 * In every fifth scenario the canvas's needle is also moved with the keys,
 * to the plan's last age and back to the year work stops, and must read the
 * same counts as the engine. The first fourteen scenarios are the owner's own plan and its near
 * neighbours; the rest are drawn from a seeded generator, so the run is the
 * same every time.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createEngine } from './src/engine/engine.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dir, 'dist');
const E = createEngine();
const N = 150, PARALLEL = 4;

// ── Scenarios ──────────────────────────────────────────────────────────
function mulberry32(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const F = E.freshStart(), D = E.defaults();
const STRUCT = { on: true, ladderYears: 7, refill: 'whenUp', refillMin: 0, equityReal: 0.05, equitySd: 0.16, goldReal: 0.01, goldSd: 0.14, goldPct: 0.15, giltReal: 0.015,
  rulesOn: true, longevityAge: 95, cutBelow: 0.90, cutBy: 0.10, raiseAbove: 1.25, raiseBy: 0.05, raiseLagYears: 2, floorMult: 0.75, capMult: 1.25,
  parachuteOn: true, parachuteBelow: 0.75, parachuteFrom: 80, parachuteFraction: 0.5 };
const stuart = { ...F.partnerA, name: 'Stuart', birthYear: 1970, pension: 570000, monthlyPension: 3200, isa: 48000, spAmount: 12548 };
const carol = { ...F.partnerB, ...D.partnerB };
const owner = (over = {}) => E.sanitisePlan({ ...F, approach: 'traditional', retireYear: 2030, targetNet: 60000, partnerA: stuart, partnerB: carol, ...over });
const named = [
  ['owner: Stuart and Carol, stop 60, £5,000 a month', owner()],
  ['owner without Carol\'s pots or annuity', owner({ partnerB: { ...F.partnerB, birthYear: 1963 } })],
  ['owner, just Stuart (single)', owner({ household: 'single' })],
  ['owner, asks exactly what the plan supports (£5,600)', owner({ targetNet: 67200 })],
  ['owner, asks £5,500 (thin margin)', owner({ targetNet: 66000 })],
  ['owner, asks £6,500 (short)', owner({ targetNet: 78000 })],
  ['owner, asks £4,000 (comfortable)', owner({ targetNet: 48000 })],
  ['owner, stop at 62', owner({ retireYear: 2032 })],
  ['owner, stop at 65', owner({ retireYear: 2035 })],
  ['owner on the de-risking structure', owner({ approach: 'derisking', architecture: { ...F.architecture, ...STRUCT } })],
  ['owner on the structure, asks £4,000', owner({ approach: 'derisking', targetNet: 48000, architecture: { ...F.architecture, ...STRUCT } })],
  ['the worked example as shipped (7% growth)', { ...D, approach: 'traditional' }],
  ['owner, Carol works on to 2033', owner({ partnerB: { ...carol, stopYear: 2033, income: 28000 } })],
  ['owner, Scotland', owner({ tax: { region: 'scotland' } })],
];
function generated(i) {
  const r = mulberry32(1000 + i), pick = (a) => a[Math.floor(r() * a.length)], between = (lo, hi, step = 1) => Math.round((lo + r() * (hi - lo)) / step) * step;
  const couple = r() < 0.7;
  const byA = between(1956, 1986), ageA = F.startYear - byA;
  const retAge = Math.max(ageA + 1, between(55, 70));
  const pot = () => pick([0, 20000, 60000, 120000, 250000, 400000, 600000, 900000, 1400000]);
  const A = { ...F.partnerA, name: 'You', birthYear: byA, pension: pot(), isa: pick([0, 0, 15000, 40000, 90000, 200000]), monthlyPension: ageA >= 66 ? 0 : pick([0, 100, 300, 600, 1200, 2500]),
    spAmount: pick([12548, 12548, 12548, 9800, 0]), db: r() < 0.2 ? between(3000, 20000, 500) : 0, dbIndexed: r() < 0.5 };
  A.dbStartYear = byA + retAge + between(0, 6);
  const byB = byA + between(-8, 8);
  const B = couple ? { ...F.partnerB, name: 'Partner', birthYear: byB, pension: pick([0, 0, 30000, 80000, 200000, 450000]), isa: pick([0, 0, 20000, 60000, 120000]), monthlyPension: pick([0, 0, 100, 400, 900]),
    spAmount: pick([12548, 12548, 8000, 0]), db: r() < 0.25 ? between(2000, 15000, 500) : 0, dbIndexed: r() < 0.5 } : { ...F.partnerB };
  if (couple) B.dbStartYear = byA + retAge + between(0, 6);
  const P = { ...F, approach: 'traditional', household: couple ? 'couple' : 'single', partnerA: A, partnerB: B, retireYear: byA + retAge,
    targetNet: between(18000, 90000, 1000), cash: pick([0, 0, 5000, 20000, 60000]), horizonAge: Math.max(retAge + 5, pick([85, 90, 90, 95, 100])),
    inflation: pick([0.02, 0.02, 0.025, 0.03]), fee: pick([0.002, 0.005, 0.005, 0.0075, 0.012]),
    phase1On: r() < 0.5, phase2On: r() < 0.3, pclsMode: pick(['phased', 'phased', 'upfront', 'none']), strategy: pick(['default', 'default', 'sippfirst', 'isafirst']),
    tax: { region: r() < 0.15 ? 'scotland' : 'ruk' }, survivorSpend: pick([0.75, 0.75, 0.6, 0.9]) };
  let Q = E.applyRiskPreset(P, pick(['cautious', 'balanced', 'balanced', 'adventurous']));
  Q.fee = P.fee;
  const kind = r();
  let tag = '';
  if (kind < 0.12) { Q = { ...Q, approach: 'derisking', architecture: { ...Q.architecture, ...STRUCT } }; tag = ' · structure'; }
  else if (kind < 0.2 && couple) { Q.partnerB = { ...Q.partnerB, deathAge: between(74, 88) }; tag = ' · survivor'; }
  else if (kind < 0.28 && couple && byB + 66 > Q.retireYear + 1) { Q.partnerB = { ...Q.partnerB, stopYear: Q.retireYear + between(1, 4), income: between(18000, 45000, 1000) }; tag = ' · partner works on'; }
  Q = E.sanitisePlan(Q);
  return [`${couple ? 'couple' : 'single'} ${F.startYear - Q.partnerA.birthYear}, stop ${Q.retireYear - Q.partnerA.birthYear}, asks £${Math.round(Q.targetNet / 12).toLocaleString('en-GB')}${tag}`, Q];
}
const scenarios = [...named, ...Array.from({ length: N - named.length }, (_, i) => generated(i))];

// ── What the screen should say (the rule, restated here) ───────────────
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtK = (v) => { const a = Math.abs(v); return a >= 1e6 ? '£' + (a / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'm' : a >= 1e3 ? '£' + Math.round(a / 1e3) + 'k' : '£' + Math.round(a); };
// This runs INSIDE the page, on the engine source served beside the app, so
// the expectation and the app share one JavaScript engine. (The same source
// gives answers up to about 0.4% apart in Chromium and in Node: see the
// cross-runtime check below.)
const expectInPage = async (P) => {
  if (!window.__E) window.__E = (await import('/__engine.js')).createEngine();
  const E = window.__E;
  const full = (dd) => dd.holds && dd.rows.every(x => x.spendMult == null || x.spendMult >= 0.999);
  const g = P.growthBase, Pg = { ...P, growth: g };
  const acc = E.accumulate(Pg, g), dd = E.drawdown(Pg, { growth: g, startPots: acc.atRetirement });
  const mc = E.runMonteCarlo(Pg, 2000, P.mcSeed || 42);
  let lo = 2000, hi = Math.max(250000, (P.targetNet || 0) * 3);
  for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; const Q = { ...Pg, spendingPlanOn: false, targetNet: mid }; const a = E.accumulate(Q, g);
    if (full(E.drawdown(Q, { growth: g, startPots: a.atRetirement }))) lo = mid; else hi = mid; }
  const capYear = Math.floor(lo / 100) * 100;
  const target = Math.round(P.targetNet / 12), isFull = full(dd), structured = !!(P.architecture && P.architecture.on);
  let sus = Math.round(capYear / 12 / 10) * 10;
  if (isFull && sus < target) sus = target;
  if (!isFull && sus >= target) sus = null;
  const pUse = structured ? mc.successProbWithCuts : mc.successProb;
  const key = isFull ? (pUse >= 0.8 ? 'on' : 'thin') : dd.holds ? 'trim' : (sus != null && sus / target >= 0.9 ? 'close' : 'not');
  const a = acc.atRetirement;
  return { key, sus, target, capYear, futures: Math.round(pUse * 100), futuresFull: Math.round(mc.successProb * 100), structured,
    pots: a.pensionA + a.pensionB + a.isaA + a.isaB + (a.cash || 0) + (a.gia || 0) };
};
/** The same supportable figure, worked out here in Node: only to measure how far two JavaScript engines drift apart. */
function capInNode(P) {
  const full = (dd) => dd.holds && dd.rows.every(x => x.spendMult == null || x.spendMult >= 0.999);
  const g = P.growthBase; let lo = 2000, hi = Math.max(250000, (P.targetNet || 0) * 3);
  for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; const Q = { ...P, growth: g, spendingPlanOn: false, targetNet: mid }; const a = E.accumulate(Q, g);
    if (full(E.drawdown(Q, { growth: g, startPots: a.atRetirement }))) lo = mid; else hi = mid; }
  return Math.floor(lo / 100) * 100;
}

// ── Independent arithmetic (nothing below calls the engine's projection) ──
/** Pots on the day of stopping, by the textbook future-value formula. */
function potsByFormula(P) {
  const yrs = P.retireYear - P.startYear, gn = P.growthBase - n(P.fee), single = P.household === 'single';
  const one = (w) => {
    const f = Math.pow(1 + gn, yrs), ann = Math.abs(gn) < 1e-9 ? yrs : (f - 1) / gn;
    const paid = (n(w.monthlyPension) * (w.contribGrossUp ? 1.25 : 1) + n(w.monthlyIsa)) * 12;
    return (n(w.pension) + n(w.isa)) * f + paid * ann * (1 + gn / 2);
  };
  return one(P.partnerA) + (single ? 0 : one(P.partnerB)) + n(P.cash) * Math.pow(1 + n(P.cashGrowth), yrs);
}
const formulaApplies = (P) => {
  const who = P.household === 'single' ? [P.partnerA] : [P.partnerA, P.partnerB];
  // Contributions stop at 75, and scheme lump sums or life events before stopping move money: keep to the plain case.
  return who.every(w => P.retireYear - w.birthYear <= 75 && !(w.dbSchemes || []).length) && !(P.lifeEvents || []).length && !(P.inherit && P.inherit.on);
};
/** The most a year that a tax-free, perfectly smooth spend-down could pay, in today's money. */
function ceilingYear(P) {
  const single = P.household === 'single', gn = P.growthBase - n(P.fee), rr = (1 + gn) / (1 + P.inflation) - 1;
  const younger = single ? P.partnerA.birthYear : Math.max(P.partnerA.birthYear, P.partnerB.birthYear);
  const end = younger + P.horizonAge, infl = (y) => Math.pow(1 + P.inflation, y - P.startYear);
  let pv = potsByFormula(P) / infl(P.retireYear), need = 0;
  const who = single ? [P.partnerA] : [P.partnerA, P.partnerB];
  for (let y = P.retireYear, t = 0; y <= end; y++, t++) {
    const disc = Math.pow(1 + rr, t);
    for (const w of who) {
      const age = y - w.birthYear;
      if (age >= E.spAgeOf(w)) pv += n(w.spAmount) / disc;                                 // State Pension, held in today's money
      if (n(w.db) > 0 && y >= w.dbStartYear) pv += (w.dbIndexed ? n(w.db) : n(w.db) / infl(y)) / disc;   // flat pensions lose value to inflation
    }
    const ageA = y - P.partnerA.birthYear;
    let cut = 0; if (P.phase1On && ageA >= P.phase1Age) cut = P.phase1Cut; if (P.phase2On && ageA >= P.phase2Age) cut = Math.max(cut, P.phase2Cut);
    need += (1 - cut) / disc;
  }
  return pv / need;
}
const ceilingApplies = (P) => formulaApplies(P) && !P.architecture?.on && ![P.partnerA, P.partnerB].some(w => n(w.deathAge) > 0 || n(w.stopYear) > P.retireYear);

// ── Serve dist and drive it ────────────────────────────────────────────
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('No dist/ — run `npm run build` first.'); process.exit(2); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let f = decodeURIComponent((req.url || '/').split('?')[0]); if (f === '/') f = '/index.html';
  // The engine source, for the in-page expectation only; the app itself never requests it.
  if (f === '/__engine.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(fs.readFileSync(path.join(__dir, 'src', 'engine', 'engine.js'))); return; }
  fs.readFile(path.join(DIST, f), (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); }); });
await new Promise(r => server.listen(0, r));
const URL = `http://localhost:${server.address().port}/`;
const findChrome = () => ['/opt/pw-browsers/chromium', process.env.CHROME_PATH].find(x => x && fs.existsSync(x) && fs.statSync(x).isFile());
const exe = findChrome();
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const GATE_HASH = fs.readFileSync(path.join(__dir, 'public', 'gate.js'), 'utf8').match(/var HASH = '([0-9a-f]{64})'/)[1];
const DISCLAIMER = (fs.readFileSync(path.join(__dir, 'src', 'config', 'product.ts'), 'utf8').match(/disclaimerVersion: '([^']+)'/) || [])[1];

async function readHome(page, plan) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([h, d, pl]) => { localStorage.clear(); localStorage.setItem('someday-gate-v1', h); localStorage.setItem('someday-disclaimer-v1', d); localStorage.setItem('horizon-plan-v1', pl); }, [GATE_HASH, DISCLAIMER, JSON.stringify(plan)]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-simple-home] [data-answer]')?.getAttribute('data-ready') === '1', null, { timeout: 60000 });
  await page.waitForTimeout(250);
  return page.evaluate(() => { const t = (s) => (document.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').trim();
    return { key: document.querySelector('[data-simple-home] [data-status]')?.getAttribute('data-status'), label: t('[data-simple-home] [data-status]'),
      figure: Number(t('[data-supports]').replace(/[£,]/g, '')), gap: t('[data-gap]'), futures: t('[data-futures]'), counts: t('[data-counts]'), note: t('[data-note]'),
      sun: (() => { const el = document.querySelector('[data-canvas]'); return !el ? null : { first: +el.getAttribute('data-first'), last: +el.getAttribute('data-last'), n: +el.getAttribute('data-years'),
        rings: [...el.querySelectorAll('[data-stripe]')].map(r => [+r.getAttribute('data-years'), +r.getAttribute('data-full-years')]), end: t('[data-canvas-end]') }; })() }; });
}

const results = new Array(N);
let next = 0;
async function worker() {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push('page: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/404|favicon/i.test(m.text())) errs.push('console: ' + m.text()); });
  for (;;) {
    const i = next++; if (i >= N) break;
    const [name, plan] = scenarios[i]; const fails = []; errs.length = 0;
    let x = null, ui = null;
    try {
      ui = await readHome(page, plan);
      x = await page.evaluate(expectInPage, plan);
      x.drift = Math.abs(capInNode(plan) - x.capYear) / Math.max(1, x.capYear);
      // A the status
      if (ui.key !== x.key) fails.push(`A status: shows "${ui.label}" (${ui.key}), rule gives ${x.key}`);
      // B the figure
      const want = x.sus ?? x.target;
      if (!(Math.abs(ui.figure - want) <= 10)) fails.push(`B figure: shows £${ui.figure}, engine supports £${want}`);
      // C coherence, from the words alone
      const spare = /to spare/.test(ui.gap), short = /more than that/.test(ui.gap);
      if ((ui.key === 'on' || ui.key === 'thin') && short) fails.push(`C "${ui.label}" beside a shortfall: ${ui.gap}`);
      if ((ui.key === 'close' || ui.key === 'not' || ui.key === 'trim') && spare) fails.push(`C "${ui.label}" beside money to spare: ${ui.gap}`);
      if (/Not (yet funded|enough yet)|Nearly enough/.test(ui.label) && ui.figure > x.target + 10 && x.sus != null) fails.push(`C "${ui.label}" while the figure £${ui.figure} exceeds the ask £${x.target}`);
      // D the gap arithmetic
      if (x.sus != null && Math.abs(x.sus - x.target) >= 25) {
        const shown = Number((ui.gap.match(/: £([\d,]+) a month/) || [])[1]?.replace(/,/g, ''));
        if (shown !== Math.abs(ui.figure - x.target)) fails.push(`D gap: says £${shown}, figure less ask is £${Math.abs(ui.figure - x.target)} (${ui.gap})`);
        if (!ui.gap.includes('£' + x.target.toLocaleString('en-GB'))) fails.push(`D gap does not state the ask £${x.target}: ${ui.gap}`);
      }
      // E the futures
      const shownF = Number((ui.futures.match(/(?:holds|lasts) in (\d+) of 100/) || [])[1]);
      if (shownF !== x.futures) fails.push(`E futures: shows ${shownF} of 100, engine gives ${x.futures}`);
      if (x.structured && x.futuresFull !== x.futures && !ui.futures.includes(`paid in full every year in ${x.futuresFull}`)) fails.push(`E structured plan does not state the paid-in-full share ${x.futuresFull}: ${ui.futures}`);
      if (!/not a guarantee/.test(ui.futures)) fails.push('E the caveat is missing');
      // K the canvas: the picture and the number are the same thing
      {
        const sun = ui.sun;
        if (!sun || sun.rings.length !== 100) fails.push(`K the canvas is missing or does not have 100 stripes (${sun ? sun.rings.length : 'none'})`);
        else {
          const yrs = sun.rings.map(r => r[0]), reach = yrs.filter(y => y === sun.n).length;
          if (sun.first !== plan.retireYear - plan.partnerA.birthYear) fails.push(`K the canvas starts at ${sun.first}, work stops at ${plan.retireYear - plan.partnerA.birthYear}`);
          if (sun.last !== sun.first + sun.n - 1) fails.push(`K the canvas ends at ${sun.last} after ${sun.n} years from ${sun.first}`);
          if (!yrs.every((y, i) => y >= 0 && y <= sun.n && (i === 0 || y <= yrs[i - 1]))) fails.push(`K a lower stripe runs further than a higher one: ${yrs.join(' ')}`);
          if (reach !== x.futures) fails.push(`K ${reach} stripes reach the right-hand edge, the sentence says ${x.futures}`);
          if (!sun.end.startsWith(`${x.futures} of 100 reach ${sun.last}`)) fails.push(`K the label beside the canvas reads "${sun.end}"`);
          if (x.structured && sun.rings.filter(r => r[1] === sun.n).length !== Math.min(x.futuresFull, x.futures)) fails.push(`K structured: ${sun.rings.filter(r => r[1] === sun.n).length} full-colour stripes reach the edge, paid in full is ${x.futuresFull}`);
        }
      }
      // F the counts line
      const single = plan.household === 'single', A = plan.partnerA, B = plan.partnerB;
      const pens = n(A.pension) + (single ? 0 : n(B.pension)), sav = n(A.isa) + (single ? 0 : n(B.isa)) + n(plan.cash), gua = n(A.spAmount) + n(A.db) + (single ? 0 : n(B.spAmount) + n(B.db));
      if (pens > 0 && !ui.counts.includes(`${fmtK(pens)} in pensions`)) fails.push(`F counts: pensions ${fmtK(pens)} not in "${ui.counts}"`);
      if (sav > 0 && !ui.counts.includes(`${fmtK(sav)} in ISAs and cash`)) fails.push(`F counts: savings ${fmtK(sav)} not in "${ui.counts}"`);
      if (gua > 0 && !ui.counts.includes(`${fmtK(gua)} a year guaranteed`)) fails.push(`F counts: guaranteed ${fmtK(gua)} not in "${ui.counts}"`);
      if (single && / and (your partner|Carol|Partner)\b/.test(ui.counts.split(':')[0])) fails.push(`F counts names a partner on a single plan: ${ui.counts}`);
      // G no double counting: pots on the day of stopping
      if (formulaApplies(plan)) {
        const eng = x.pots, mine = potsByFormula(plan);
        if (Math.abs(eng - mine) > Math.max(500, mine * 0.005)) fails.push(`G pots at stopping: engine £${Math.round(eng)}, compound-interest formula £${Math.round(mine)}`);
      }
      // H nothing from nowhere: the tax-free ceiling
      if (ceilingApplies(plan)) {
        const ceil = ceilingYear(plan);
        if (x.capYear > ceil * 1.01 + 300) fails.push(`H figure above what the money could ever pay: engine £${x.capYear} a year, tax-free ceiling £${Math.round(ceil)}`);
      }
      // J the same plan in a different JavaScript engine: the figure may move a little, never much
      if (x.drift > 0.01) fails.push(`J the figure differs by ${(x.drift * 100).toFixed(2)}% between Chromium and Node (limit 1%)`);
      // L the needle, moved with the keys, reads the engine's counts
      if (i % 5 === 0 && ui.sun) {
        await page.waitForTimeout(1800);                              // let the sun finish rising
        await page.focus('[data-canvas]'); await page.keyboard.press('End'); await page.waitForTimeout(80);
        const atEnd = await page.$eval('[data-canvas]', e => [+e.getAttribute('data-age'), e.getAttribute('aria-valuetext')]);
        await page.keyboard.press('Home'); await page.waitForTimeout(80);
        const atStart = await page.$eval('[data-canvas]', e => [+e.getAttribute('data-age'), e.getAttribute('aria-valuetext')]);
        const lastBar = ui.sun.rings.filter(r => r[0] > ui.sun.n - 1).length, firstBar = ui.sun.rings.filter(r => r[0] > 0).length;
        if (atEnd[0] !== ui.sun.last || !atEnd[1].startsWith(`Age ${ui.sun.last}: ${x.futures} of 100 futures still paying`)) fails.push(`L the needle at ${ui.sun.last} reads "${atEnd[1]}", the engine gives ${x.futures}`);
        if (atStart[0] !== ui.sun.first || !atStart[1].startsWith(`Age ${ui.sun.first}: ${firstBar} of 100`)) fails.push(`L the needle at ${ui.sun.first} reads "${atStart[1]}", the lines give ${firstBar}`);
        if (lastBar !== x.futures) fails.push(`L ${lastBar} lines run to the last year, the engine gives ${x.futures}`);
      }
      // I errors
      if (errs.length) fails.push('I ' + [...new Set(errs)].slice(0, 2).join(' | '));
    } catch (e) { fails.push('could not run: ' + String(e && e.message || e).split('\n')[0]); }
    results[i] = { name, fails, x, ui };
  }
  await ctx.close();
}
const t0 = Date.now();
await Promise.all(Array.from({ length: PARALLEL }, worker));
await b.close(); server.close();

// ── Report ─────────────────────────────────────────────────────────────
const passed = results.filter(r => !r.fails.length).length;
const by = {}; for (const r of results) if (r.x) by[r.x.key] = (by[r.x.key] || 0) + 1;
const LABEL = { on: 'On track', thin: 'Enough on average, not safe yet', trim: 'Enough, with a trim', close: 'Nearly enough', not: 'Not enough yet' };
if (process.argv.includes('-v') || process.env.E2E150_VERBOSE) {
  results.forEach((r, i) => console.log(`${String(i + 1).padStart(3, '0')} ${r.fails.length ? '✗' : '✓'} ${r.name}${r.x ? ` → ${LABEL[r.x.key]} · supports £${(r.x.sus ?? r.x.target).toLocaleString('en-GB')} · ${r.x.futures} of 100` : ''}`));
} else {
  results.slice(0, named.length).forEach((r, i) => console.log(`${String(i + 1).padStart(3, '0')} ${r.fails.length ? '✗' : '✓'} ${r.name}${r.x ? ` → ${LABEL[r.x.key]} · supports £${(r.x.sus ?? r.x.target).toLocaleString('en-GB')} · ${r.x.futures} of 100` : ''}`));
}
console.log(`\nStatuses across the ${N}: ` + Object.entries(by).map(([k, v]) => `${LABEL[k]} ${v}`).join(' · '));
const drifts = results.filter(r => r.x && r.x.drift != null).map(r => r.x.drift).sort((a, b) => a - b);
console.log(`Same plan, two JavaScript engines (Chromium and Node): figure identical in ${drifts.filter(d => d === 0).length} of ${drifts.length}; largest difference ${(drifts[drifts.length - 1] * 100).toFixed(2)}%`);
console.log(`Independent checks applied: pots formula ${scenarios.filter(s => formulaApplies(s[1])).length} of ${N} · tax-free ceiling ${scenarios.filter(s => ceilingApplies(s[1])).length} of ${N} · needle cross-check ${Math.ceil(N / 5)}`);
console.log(`\n═══ Horizon 150 END-TO-END SCENARIOS: ${passed}/${N} passed (${Math.round((Date.now() - t0) / 1000)} s) ═══`);
const bad = results.map((r, i) => [i, r]).filter(([, r]) => r.fails.length);
if (bad.length) console.log('\nFAILURES:\n' + bad.map(([i, r]) => `  ${String(i + 1).padStart(3, '0')} ${r.name}\n` + r.fails.map(f => '      ✗ ' + f).join('\n')).join('\n'));
if (process.env.E2E150_OUT) fs.writeFileSync(process.env.E2E150_OUT, JSON.stringify(results.map((r, i) => ({ n: i + 1, name: r.name, pass: !r.fails.length, fails: r.fails, status: r.x && LABEL[r.x.key], supports: r.x && (r.x.sus ?? r.x.target), ask: r.x && r.x.target, futures: r.x && r.x.futures })), null, 1));
process.exitCode = passed === N ? 0 : 1;
