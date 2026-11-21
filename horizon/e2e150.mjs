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
 * In every fifth scenario the island is also moved with the keys,
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
// 150 households is the CI gate. E2E_N=300 (npm run e2e300) adds 150 more: NHS and other public-sector scheme
// pensions, couples up to sixteen years apart, and combinations of the two (owner, 20 November 2026).
const N = Math.max(1, Math.round(Number(process.env.E2E_N) || 150)), BASE = 150, PARALLEL = 4;

// ── Scenarios ──────────────────────────────────────────────────────────
function mulberry32(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const F = E.freshStart(), D = E.defaults();
const STRUCT = { on: true, ladderYears: 7, refill: 'whenUp', refillMin: 0, equityReal: 0.05, equitySd: 0.16, goldReal: 0.01, goldSd: 0.14, goldPct: 0.15, giltReal: 0.015,
  rulesOn: true, longevityAge: 95, cutBelow: 0.90, cutBy: 0.10, raiseAbove: 1.25, raiseBy: 0.05, raiseLagYears: 2, floorMult: 0.75, capMult: 1.25,
  parachuteOn: true, parachuteBelow: 0.75, parachuteFrom: 80, parachuteFraction: 0.5 };
const robin = { ...F.partnerA, name: 'Robin', birthYear: 1970, pension: 570000, monthlyPension: 3200, isa: 48000, spAmount: 12548 };
const jo = { ...F.partnerB, ...D.partnerB };
const owner = (over = {}) => E.sanitisePlan({ ...F, approach: 'traditional', retireYear: 2030, targetNet: 60000, partnerA: robin, partnerB: jo, ...over });
const named = [
  ['owner: Robin and Jo, stop 60, £5,000 a month', owner()],
  ['owner without Jo\'s pots or annuity', owner({ partnerB: { ...F.partnerB, birthYear: 1963 } })],
  ['owner, just Robin (single)', owner({ household: 'single' })],
  ['owner, asks exactly what the plan supports (£5,600)', owner({ targetNet: 67200 })],
  ['owner, asks £5,500 (thin margin)', owner({ targetNet: 66000 })],
  ['owner, asks £6,500 (short)', owner({ targetNet: 78000 })],
  ['owner, asks £4,000 (comfortable)', owner({ targetNet: 48000 })],
  ['owner, stop at 62', owner({ retireYear: 2032 })],
  ['owner, stop at 65', owner({ retireYear: 2035 })],
  ['owner on the de-risking structure', owner({ approach: 'derisking', architecture: { ...F.architecture, ...STRUCT } })],
  ['owner on the structure, asks £4,000', owner({ approach: 'derisking', targetNet: 48000, architecture: { ...F.architecture, ...STRUCT } })],
  ['the reference workbook as shipped (7% growth)', { ...D, approach: 'traditional' }],
  ['owner, Jo works on to 2033', owner({ partnerB: { ...jo, stopYear: 2033, income: 28000 } })],
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
// ── The wider set: scheme pensions and couples of different ages ────────
// The published rules, restated here so the check below does not read them from the engine: normal pension age
// (a number, or State Pension age), the automatic lump sum as a multiple of the pension, and the reduction for
// each year taken early.
const SCHEME_RULES = {
  nhs1995: { npa: 60, lump: 3, early: 0.045 }, nhs2008: { npa: 65, lump: 0, early: 0.045 }, nhs2015: { npa: 'spa', lump: 0, early: 0.046 },
  tps60: { npa: 60, lump: 3, early: 0.045 }, tpsCare: { npa: 'spa', lump: 0, early: 0.045 },
  lgps80: { npa: 65, lump: 3, early: 0.045 }, lgpsCare: { npa: 'spa', lump: 0, early: 0.045 },
  csClassic: { npa: 60, lump: 3, early: 0.05 }, csAlpha: { npa: 'spa', lump: 0, early: 0.043 },
};
const NHS = ['nhs1995', 'nhs2008', 'nhs2015'], OTHER = ['tps60', 'tpsCare', 'lgps80', 'lgpsCare', 'csClassic', 'csAlpha'];
const tranche = (id, scheme, pension, takeAge) => ({ id, scheme, pension, takeAge });
const person = (base, name, birthYear, over) => ({ ...base, name, birthYear, spAmount: 12548, ...over });
const wideNamed = [
  ['NHS nurse 58, 1995 and 2015 sections, single, stops at 60', E.sanitisePlan({ ...F, approach: 'traditional', household: 'single', retireYear: 2028, targetNet: 30000,
    partnerA: person(F.partnerA, 'You', 1968, { spAge: 67, pension: 40000, isa: 30000, monthlyPension: 200, dbSchemes: [tranche('a1', 'nhs1995', 9000, 60), tranche('a2', 'nhs2015', 7000, 67)] }) })],
  ['NHS 2015 taken five years early at 62', E.sanitisePlan({ ...F, approach: 'traditional', household: 'single', retireYear: 2032, targetNet: 26000,
    partnerA: person(F.partnerA, 'You', 1970, { spAge: 67, pension: 90000, isa: 20000, dbSchemes: [tranche('a1', 'nhs2015', 16000, 62)] }) })],
  ['NHS 1995 lump sum arrives after stopping at 58', E.sanitisePlan({ ...F, approach: 'traditional', household: 'single', retireYear: 2030, targetNet: 28000,
    partnerA: person(F.partnerA, 'You', 1972, { spAge: 67, pension: 150000, isa: 60000, dbSchemes: [tranche('a1', 'nhs1995', 14000, 60)] }) })],
  ['NHS couple nine years apart: consultant 61 and nurse 52', E.sanitisePlan({ ...F, approach: 'traditional', household: 'couple', retireYear: 2028, targetNet: 60000,
    partnerA: person(F.partnerA, 'You', 1965, { spAge: 67, pension: 300000, isa: 80000, dbSchemes: [tranche('a1', 'nhs1995', 30000, 60), tranche('a2', 'nhs2015', 12000, 67)] }),
    partnerB: person(F.partnerB, 'Partner', 1974, { spAge: 67, pension: 60000, dbSchemes: [tranche('b1', 'nhs2015', 11000, 67)] }) })],
  ['couple fifteen years apart, the older stops at 66', E.sanitisePlan({ ...F, approach: 'traditional', household: 'couple', retireYear: 2028, targetNet: 42000,
    partnerA: person(F.partnerA, 'You', 1962, { spAge: 66, pension: 420000, isa: 90000 }), partnerB: person(F.partnerB, 'Partner', 1977, { spAge: 67, pension: 80000, isa: 20000 }) })],
  ['couple twelve years apart, the younger is the planner', E.sanitisePlan({ ...F, approach: 'traditional', household: 'couple', retireYear: 2034, targetNet: 48000,
    partnerA: person(F.partnerA, 'You', 1974, { spAge: 67, pension: 380000, isa: 50000, monthlyPension: 600 }), partnerB: person(F.partnerB, 'Partner', 1962, { spAge: 66, pension: 200000, isa: 60000 }) })],
  ['teacher and civil servant, six years apart', E.sanitisePlan({ ...F, approach: 'traditional', household: 'couple', retireYear: 2029, targetNet: 46000,
    partnerA: person(F.partnerA, 'You', 1967, { spAge: 67, pension: 70000, isa: 40000, dbSchemes: [tranche('a1', 'tps60', 15000, 60), tranche('a2', 'tpsCare', 6000, 67)] }),
    partnerB: person(F.partnerB, 'Partner', 1973, { spAge: 67, pension: 50000, dbSchemes: [tranche('b1', 'csAlpha', 9000, 67)] }) })],
  ['NHS couple on the safe ladder, eight years apart', E.sanitisePlan({ ...F, approach: 'derisking', household: 'couple', retireYear: 2030, targetNet: 50000, architecture: { ...F.architecture, ...STRUCT },
    partnerA: person(F.partnerA, 'You', 1968, { spAge: 67, pension: 350000, isa: 70000, dbSchemes: [tranche('a1', 'nhs2008', 10000, 65)] }),
    partnerB: person(F.partnerB, 'Partner', 1976, { spAge: 68, pension: 90000, isa: 30000, dbSchemes: [tranche('b1', 'nhs2015', 8000, 68)] }) })],
];
function wide(i) {
  const r = mulberry32(5000 + i), pick = (a) => a[Math.floor(r() * a.length)], between = (lo, hi, step = 1) => Math.round((lo + r() * (hi - lo)) / step) * step;
  const kind = i % 4;   // 0 NHS · 1 a wide age gap · 2 other public sector · 3 NHS and a wide gap together
  const couple = kind === 1 || kind === 3 || r() < 0.6;
  const byA = between(1958, 1980), ageA = F.startYear - byA, retAge = Math.max(ageA + 1, between(56, 68));
  const gap = kind === 1 || kind === 3 ? pick([-16, -13, -11, -9, 9, 11, 13, 16]) : between(-7, 7);
  const byB = byA + gap;
  const schemes = (who, prefix, list) => { const spAge = who.spAge, out = [], count = r() < 0.45 ? 2 : 1, used = new Set();
    for (let k = 0; k < count; k++) { const sc = pick(list.filter(x => !used.has(x))); used.add(sc); const rule = SCHEME_RULES[sc], npa = rule.npa === 'spa' ? spAge : rule.npa;
      out.push(tranche(prefix + (k + 1), sc, between(3000, 26000, 500), Math.max(57, npa - pick([0, 0, 0, 1, 3, 5])))); }
    return out; };
  const A = person(F.partnerA, 'You', byA, { spAge: pick([66, 67, 67, 68]), pension: pick([0, 20000, 60000, 150000, 300000, 500000]), isa: pick([0, 15000, 40000, 90000]),
    monthlyPension: ageA >= 66 ? 0 : pick([0, 100, 300, 600]), spAmount: pick([12548, 12548, 10200]) });
  const B = couple ? person(F.partnerB, 'Partner', byB, { spAge: pick([66, 67, 67, 68]), pension: pick([0, 30000, 80000, 200000]), isa: pick([0, 20000, 60000]), spAmount: pick([12548, 12548, 8000]) }) : { ...F.partnerB };
  if (kind === 0 || kind === 3) { A.dbSchemes = schemes(A, 'a', NHS); if (couple && r() < 0.45) B.dbSchemes = schemes(B, 'b', NHS); }
  if (kind === 2) { A.dbSchemes = schemes(A, 'a', OTHER); if (couple && r() < 0.4) B.dbSchemes = schemes(B, 'b', [...OTHER, ...NHS]); }
  const P = { ...F, approach: 'traditional', household: couple ? 'couple' : 'single', partnerA: A, partnerB: B, retireYear: byA + retAge,
    targetNet: between(20000, 80000, 1000), cash: pick([0, 0, 10000, 40000]), horizonAge: Math.max(retAge + 5, pick([88, 90, 92, 95, 100])),
    inflation: pick([0.02, 0.02, 0.025, 0.03]), fee: pick([0.002, 0.005, 0.0075]), phase1On: r() < 0.4, phase2On: r() < 0.25,
    pclsMode: pick(['phased', 'phased', 'upfront']), tax: { region: r() < 0.15 ? 'scotland' : 'ruk' }, survivorSpend: pick([0.75, 0.6, 0.9]) };
  let Q = E.applyRiskPreset(P, pick(['cautious', 'balanced', 'balanced', 'adventurous']));
  Q.fee = P.fee;
  const twist = r(); let tag = '';
  if (twist < 0.15) { Q = { ...Q, approach: 'derisking', architecture: { ...Q.architecture, ...STRUCT } }; tag = ' · safe ladder'; }
  else if (twist < 0.25 && couple) { const older = byB < byA ? 'partnerB' : 'partnerA'; Q[older] = { ...Q[older], deathAge: between(76, 88) }; tag = ' · the older dies first'; }
  Q = E.sanitisePlan(Q);
  const fam = (w) => [...new Set((w.dbSchemes || []).map(t => (NHS.includes(t.scheme) ? 'NHS' : 'scheme')))].join('+');
  const sA = fam(Q.partnerA), sB = couple ? fam(Q.partnerB) : '';
  return [`${couple ? `couple ${F.startYear - Q.partnerA.birthYear} and ${F.startYear - Q.partnerB.birthYear}` : `single ${F.startYear - Q.partnerA.birthYear}`}, stop ${Q.retireYear - Q.partnerA.birthYear}, asks £${Math.round(Q.targetNet / 12).toLocaleString('en-GB')}${sA ? ` · ${sA} pension` : ''}${sB ? ` · partner ${sB} pension` : ''}${tag}`, Q];
}
const scenarios = [...named, ...Array.from({ length: BASE - named.length }, (_, i) => generated(i)),
  ...(N > BASE ? [...wideNamed, ...Array.from({ length: Math.max(0, N - BASE - wideNamed.length), }, (_, i) => wide(i))] : [])].slice(0, N);
const namedCount = named.length;

// ── What the screen should say (the rule, restated here) ───────────────
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtK = (v) => { const a = Math.abs(v); return a >= 1e6 ? '£' + (a / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'm' : a >= 1e3 ? '£' + Math.round(a / 1e3) + 'k' : '£' + Math.round(a); };
// This runs INSIDE the page, on the engine source served beside the app, so
// the expectation and the app share one JavaScript engine. (The same source
// gives answers up to about 0.4% apart in Chromium and in Node: see the
// cross-runtime check below.)
const expectInPage = async (P) => {
  if (!window.__E) {
    // The engine source is fetched from the test's own server; with four pages working at once a fetch can fail, so it is tried three times.
    let m = null, err = null;
    for (let k = 0; k < 3 && !m; k++) { try { m = await import('/__engine.js' + (k ? '?try=' + k : '')); } catch (e) { err = e; await new Promise(r => setTimeout(r, 400)); } }
    if (!m) throw err;
    window.__E = m.createEngine();
  }
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
    lit: mc.perAgePaid.ages.map(r => r.q.filter(v => v >= 0.99).length).join(','),
    // The moon home: the day of stopping, each fifth birthday (each tenth on a long retirement) and the last year, with how many of 100 futures are still paying.
    moon: (() => { const held = mc.perAgeHeld.map(h => ({ age: h.age, n: Math.round((structured ? Math.max(h.full, h.rules) : h.full) * 100) })), n = held.length;
      const pick = e => held.filter((y, i) => i === 0 || i === n - 1 || (y.age % e === 0 && i >= 3 && i <= n - 4)), five = pick(5);
      return (five.length > 8 ? pick(10) : five).map(y => `${y.age}:${y.n}`).join(' '); })(),
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

// ── Scheme pensions, State Pension dates and the plan's end, by hand ────
/** What a scheme tranche pays a year and as a lump sum, in today's money, from the published rules restated above. */
function schemeByHand(who, t) {
  const rule = SCHEME_RULES[t.scheme]; if (!rule) return null;
  const npa = rule.npa === 'spa' ? who.spAge : rule.npa, minAge = who.birthYear + 55 >= 2028 ? 57 : 55;
  const takeAge = Math.max(minAge, Math.round(t.takeAge || npa));
  if (takeAge > npa) return null;                       // late-retirement factors are not restated here
  const pension = t.pension * Math.pow(1 - rule.early, npa - takeAge);
  return { takeYear: who.birthYear + takeAge, pension, lump: rule.lump * pension };
}
function wideChecks(plan) {
  const out = [], single = plan.household === 'single', g = plan.growthBase;
  const rows = E.drawdown({ ...plan, growth: g }).rows, f = (y) => Math.pow(1 + plan.inflation, y - plan.startYear);
  const last = rows[rows.length - 1], people = single ? [['A', plan.partnerA]] : [['A', plan.partnerA], ['B', plan.partnerB]];
  const diesAt = (w) => (n(w.deathAge) > 0 ? w.birthYear + n(w.deathAge) : Infinity);
  // M scheme pensions: the yearly amount once every tranche is in payment, and each lump sum in the year it is taken
  const lumps = {};
  for (const [k, w] of people) {
    const ts = (w.dbSchemes || []); if (!ts.length) continue;
    const hand = ts.map(t => schemeByHand(w, t)); if (hand.some(h => !h)) continue;
    const from = Math.max(plan.retireYear, ...hand.map(h => h.takeYear)), row = rows.find(x => x.year === from);
    if (row && from < diesAt(w)) {
      const shown = (k === 'A' ? row.dbA : row.dbB) / f(row.year), want = hand.reduce((a, h) => a + h.pension, 0) + (n(w.db) > 0 && from >= n(w.dbStartYear) ? n(w.db) : 0);
      if (Math.abs(shown - want) > Math.max(5, want * 0.005)) out.push(`M ${k}'s scheme pensions pay £${Math.round(shown)} a year from ${from}; the published rules give £${Math.round(want)}`);
    }
    for (const h of hand) if (h.lump > 0 && h.takeYear >= plan.retireYear && h.takeYear < diesAt(w)) lumps[h.takeYear] = (lumps[h.takeYear] || 0) + h.lump;
  }
  for (const [y, want] of Object.entries(lumps)) {
    const row = rows.find(x => x.year === +y); if (!row) continue;
    const shown = n(row.dbLump) / f(row.year);
    if (Math.abs(shown - want) > Math.max(5, want * 0.005)) out.push(`M the scheme lump sum in ${y} is £${Math.round(shown)}; three times the pension is £${Math.round(want)}`);
  }
  // N the State Pension starts in the year each person reaches the age on their plan
  for (const [k, w] of people) {
    if (!(n(w.spAmount) > 0) || !(n(w.spAge) > 0)) continue;
    const due = Math.max(plan.retireYear, w.birthYear + w.spAge), first = rows.find(x => (k === 'A' ? x.spA : x.spB) > 0);
    if (due <= last.year && due < diesAt(w)) { if (!first || first.year !== due) out.push(`N ${k}'s State Pension starts in ${first ? first.year : 'no year'}; age ${w.spAge} falls in ${due}`); }
    else if (first && due >= diesAt(w)) out.push(`N ${k}'s State Pension is paid from ${first.year}, after the death age on the plan`);
  }
  // O the plan runs until the last person's last year: the year they reach the plan age, or the death age set for them
  const end = Math.max(plan.retireYear, ...people.map(([, w]) => (n(w.deathAge) > 0 ? w.birthYear + n(w.deathAge) : w.birthYear + plan.horizonAge)));
  if (rows[0].year !== plan.retireYear || last.year !== end) out.push(`O the plan runs ${rows[0].year} to ${last.year}; it should run ${plan.retireYear} to ${end}`);
  // Q each partner's age on every row is the year less their birth year
  if (!rows.every(x => x.ageA === x.year - plan.partnerA.birthYear && (single || x.ageB === x.year - plan.partnerB.birthYear))) out.push('Q a row carries the wrong age for a partner');
  return out;
}
const hasScheme = (P) => [P.partnerA, P.partnerB].some(w => (w.dbSchemes || []).length);
const hasNhs = (P) => [P.partnerA, P.partnerB].some(w => (w.dbSchemes || []).some(t => NHS.includes(t.scheme)));
const ageGap = (P) => (P.household === 'single' ? 0 : Math.abs(P.partnerA.birthYear - P.partnerB.birthYear));

// E2E_DRY=1: the hand checks alone, in node, without a browser (seconds; for writing new scenarios).
if (process.env.E2E_DRY) {
  let bad = 0;
  scenarios.forEach(([name, plan], i) => { let f; try { f = wideChecks(plan); } catch (e) { f = ['could not run: ' + e.message]; } if (f.length) { bad++; console.log(`${String(i + 1).padStart(3, '0')} ✗ ${name}\n      ` + f.join('\n      ')); } });
  console.log(`${scenarios.length - bad}/${scenarios.length} households pass the hand checks · NHS ${scenarios.filter(x => hasNhs(x[1])).length} · any scheme ${scenarios.filter(x => hasScheme(x[1])).length} · nine or more years apart ${scenarios.filter(x => ageGap(x[1]) >= 9).length}`);
  process.exit(bad ? 1 : 0);
}

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
      sun: (() => { const el = document.querySelector('[data-island]'); return !el ? null : { first: +el.getAttribute('data-first'), last: +el.getAttribute('data-last'), n: +el.getAttribute('data-years'),
        counts: (el.getAttribute('data-full-counts') || '').split(',').filter(Boolean).map(Number), rules: (el.getAttribute('data-rules') || '').split(',').filter(Boolean).map(Number) }; })() }; });
}

const results = new Array(N);
let next = 0, moonChecked = 0;
async function worker() {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  // Existing checks were written against the island; the home now opens on the moon, so they pin the island
  // (only where nothing is set). The moon home has its own check (P), which unpins it for a sample.
  await page.addInitScript(() => { try { if (!localStorage.getItem('someday-picture-v1')) localStorage.setItem('someday-picture-v1', 'island'); } catch { /* private mode */ } });
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
      const spare = /to spare/.test(ui.gap), short = /short$/.test(ui.gap);
      if ((ui.key === 'on' || ui.key === 'thin') && short) fails.push(`C "${ui.label}" beside a shortfall: ${ui.gap}`);
      if ((ui.key === 'close' || ui.key === 'not' || ui.key === 'trim') && spare) fails.push(`C "${ui.label}" beside money to spare: ${ui.gap}`);
      if (/Not (yet funded|enough yet)|Nearly enough/.test(ui.label) && ui.figure > x.target + 10 && x.sus != null) fails.push(`C "${ui.label}" while the figure £${ui.figure} exceeds the ask £${x.target}`);
      // D the gap arithmetic
      if (x.sus != null && Math.abs(x.sus - x.target) >= 25) {
        const shown = Number((ui.gap.match(/^£([\d,]+) (to spare|short)$/) || [])[1]?.replace(/,/g, ''));
        if (shown !== Math.abs(ui.figure - x.target)) fails.push(`D gap: says £${shown}, figure less ask is £${Math.abs(ui.figure - x.target)} (${ui.gap})`);
        if (!ui.futures.includes('£' + x.target.toLocaleString('en-GB') + ' a month')) fails.push(`D the sentence does not name the ask £${x.target}: ${ui.futures}`);
      }
      // E the futures
      const shownF = Number((ui.futures.match(/^In (\d+) of 100 futures/) || [])[1]);
      if (shownF !== x.futures) fails.push(`E futures: shows ${shownF} of 100, engine gives ${x.futures}`);
      if (x.structured && x.futuresFull !== x.futures && !ui.futures.includes(`in ${x.futuresFull} it pays`)) fails.push(`E structured plan does not state the paid-in-full share ${x.futuresFull}: ${ui.futures}`);
      if (!/not a guarantee/.test(ui.futures)) fails.push('E the caveat is missing');
      // K the island: the picture and the number are the same thing
      {
        const sun = ui.sun;
        if (!sun || sun.counts.length !== sun.n) fails.push(`K the island is missing or has no count for some years (${sun ? sun.counts.length : 'none'})`);
        else {
          const use = x.structured ? sun.rules : sun.counts;
          if (sun.first !== plan.retireYear - plan.partnerA.birthYear) fails.push(`K the island starts at ${sun.first}, work stops at ${plan.retireYear - plan.partnerA.birthYear}`);
          if (sun.last !== sun.first + sun.n - 1) fails.push(`K the island ends at ${sun.last} after ${sun.n} years from ${sun.first}`);
          if (!use.every((c, i) => c >= 0 && c <= 100 && (i === 0 || c <= use[i - 1]))) fails.push(`K the count rises somewhere: ${use.join(' ')}`);
          if (use[sun.n - 1] !== x.futures) fails.push(`K the island ends on ${use[sun.n - 1]}, the sentence says ${x.futures}`);
          if (x.structured && sun.counts[sun.n - 1] !== Math.min(x.futuresFull, x.futures)) fails.push(`K structured: the island's paid-in-full count ends on ${sun.counts[sun.n - 1]}, paid in full is ${x.futuresFull}`);
        }
      }
      // F the counts line
      const single = plan.household === 'single', A = plan.partnerA, B = plan.partnerB;
      const pens = n(A.pension) + (single ? 0 : n(B.pension)), sav = n(A.isa) + (single ? 0 : n(B.isa)) + n(plan.cash), sch = (w) => (w.dbSchemes || []).reduce((a, t) => a + n(E.trancheBenefits(plan, w, t).pension), 0), gua = n(A.spAmount) + n(A.db) + sch(A) + (single ? 0 : n(B.spAmount) + n(B.db) + sch(B));
      if (pens > 0 && !ui.counts.includes(`${fmtK(pens)} in pensions`)) fails.push(`F counts: pensions ${fmtK(pens)} not in "${ui.counts}"`);
      if (sav > 0 && !ui.counts.includes(`${fmtK(sav)} in ISAs and cash`)) fails.push(`F counts: savings ${fmtK(sav)} not in "${ui.counts}"`);
      if (gua > 0 && !ui.counts.includes(`${fmtK(gua)} a year guaranteed`)) fails.push(`F counts: guaranteed ${fmtK(gua)} not in "${ui.counts}"`);
      if (single && / and (your partner|Jo|Partner)\b/.test(ui.counts.split(':')[0])) fails.push(`F counts names a partner on a single plan: ${ui.counts}`);
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
        await page.focus('[data-island] [role=slider]'); await page.keyboard.press('End'); await page.waitForTimeout(80);
        const atEnd = await page.$eval('[data-island]', e => [+e.getAttribute('data-age'), e.querySelector('[role=slider]').getAttribute('aria-valuetext')]);
        await page.keyboard.press('Home'); await page.waitForTimeout(80);
        const atStart = await page.$eval('[data-island]', e => [+e.getAttribute('data-age'), e.querySelector('[role=slider]').getAttribute('aria-valuetext')]);
        const lastBar = ui.sun.counts[ui.sun.n - 1], firstBar = ui.sun.counts[0];
        if (atEnd[0] !== ui.sun.last || !atEnd[1].startsWith(`Age ${ui.sun.last}: ${lastBar} of 100 futures still pay`)) fails.push(`L the island at ${ui.sun.last} reads "${atEnd[1]}", its own count is ${lastBar}`);
        if (atStart[0] !== ui.sun.first || !atStart[1].startsWith(`Age ${ui.sun.first}: ${firstBar} of 100`)) fails.push(`L the island at ${ui.sun.first} reads "${atStart[1]}", its own count is ${firstBar}`);
        if (lastBar !== x.futuresFull) fails.push(`L the island's paid-in-full count at the last age is ${lastBar}, the engine gives ${x.futuresFull}`);
      }
      // M N O Q scheme pensions, State Pension dates, the plan's end and the ages, by hand (every household)
      fails.push(...wideChecks(plan));
      // P the moon, which is what the home opens on: its count, its verdict and every year in its row are the engine's
      if (i % 10 === 0 || i >= BASE && i % 5 === 0) {
        const gl = await page.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); });
        if (gl) {
          await page.evaluate(() => localStorage.setItem('someday-picture-v1', 'moon'));
          await page.reload({ waitUntil: 'domcontentloaded' });
          const ok = await page.waitForFunction((want) => { const m = document.querySelector('[data-moon-home]'); return !!m && m.getAttribute('data-years') === want && m.getAttribute('data-drawn') === '1' && m.getAttribute('data-pending') === '0'; }, x.moon, { timeout: 60000 }).then(() => true, () => false);
          if (!ok) fails.push(`P the moon's years are "${await page.$eval('[data-moon-home]', e => e.getAttribute('data-years')).catch(() => 'not drawn')}", the engine counts "${x.moon}"`);
          else {
            const m = await page.evaluate(() => { const h = document.querySelector('[data-moon-home]'); return { count: Number(h.querySelector('[data-moon-count]').textContent), line: h.querySelector('[data-moon-line]').textContent, verdict: h.querySelector('[data-status]').textContent, rules: h.querySelector('[data-moon-rules]')?.textContent || '' }; });
            const want = m.count >= 80 ? 'Yes, on track' : m.count >= 60 ? 'Probably' : m.count >= 40 ? 'It could go either way' : m.count >= 20 ? 'Probably not' : 'Not as it stands';
            if (m.count !== x.futures) fails.push(`P the moon home shows ${m.count} times in 100, the engine gives ${x.futures}`);
            if (m.verdict !== want) fails.push(`P the moon home says "${m.verdict}" beside ${m.count}; the count alone decides the words: "${want}"`);
            if (!m.line.endsWith(`the money lasts until you are ${x.moon.split(' ').pop().split(':')[0]}`)) fails.push(`P the moon home's sentence is "${m.line}", the last year drawn is ${x.moon.split(' ').pop()}`);
            if (x.structured && x.futuresFull !== x.futures && !m.rules.includes(`${x.futuresFull} times in full`)) fails.push(`P structured plan: the moon home does not state the paid-in-full count ${x.futuresFull}: "${m.rules}"`);
            moonChecked++;
          }
          await page.evaluate(() => localStorage.setItem('someday-picture-v1', 'island'));
        }
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
const LABEL = { on: 'On track', thin: 'Enough in most futures, not all', trim: 'Enough, with a trim', close: 'Nearly enough', not: 'Not enough yet' };
if (process.argv.includes('-v') || process.env.E2E150_VERBOSE) {
  results.forEach((r, i) => console.log(`${String(i + 1).padStart(3, '0')} ${r.fails.length ? '✗' : '✓'} ${r.name}${r.x ? ` → ${LABEL[r.x.key]} · supports £${(r.x.sus ?? r.x.target).toLocaleString('en-GB')} · ${r.x.futures} of 100` : ''}`));
} else {
  results.slice(0, namedCount).forEach((r, i) => console.log(`${String(i + 1).padStart(3, '0')} ${r.fails.length ? '✗' : '✓'} ${r.name}${r.x ? ` → ${LABEL[r.x.key]} · supports £${(r.x.sus ?? r.x.target).toLocaleString('en-GB')} · ${r.x.futures} of 100` : ''}`));
}
console.log(`\nStatuses across the ${N}: ` + Object.entries(by).map(([k, v]) => `${LABEL[k]} ${v}`).join(' · '));
const drifts = results.filter(r => r.x && r.x.drift != null).map(r => r.x.drift).sort((a, b) => a - b);
console.log(`Same plan, two JavaScript engines (Chromium and Node): figure identical in ${drifts.filter(d => d === 0).length} of ${drifts.length}; largest difference ${(drifts[drifts.length - 1] * 100).toFixed(2)}%`);
console.log(`Independent checks applied: pots formula ${scenarios.filter(s => formulaApplies(s[1])).length} of ${N} · tax-free ceiling ${scenarios.filter(s => ceilingApplies(s[1])).length} of ${N} · needle cross-check ${Math.ceil(N / 5)} · the moon home ${moonChecked}`);
console.log(`Households: couples ${scenarios.filter(s => s[1].household !== 'single').length} · partners nine or more years apart ${scenarios.filter(s => ageGap(s[1]) >= 9).length} · NHS pensions ${scenarios.filter(s => hasNhs(s[1])).length} · any scheme pension ${scenarios.filter(s => hasScheme(s[1])).length} · safe ladder ${scenarios.filter(s => s[1].architecture?.on).length} · a death age set ${scenarios.filter(s => [s[1].partnerA, s[1].partnerB].some(w => n(w.deathAge) > 0)).length}`);
console.log(`\n═══ Horizon ${N} END-TO-END SCENARIOS: ${passed}/${N} passed (${Math.round((Date.now() - t0) / 1000)} s) ═══`);
const bad = results.map((r, i) => [i, r]).filter(([, r]) => r.fails.length);
if (bad.length) console.log('\nFAILURES:\n' + bad.map(([i, r]) => `  ${String(i + 1).padStart(3, '0')} ${r.name}\n` + r.fails.map(f => '      ✗ ' + f).join('\n')).join('\n'));
if (process.env.E2E150_OUT) fs.writeFileSync(process.env.E2E150_OUT, JSON.stringify(results.map((r, i) => ({ n: i + 1, name: r.name, pass: !r.fails.length, fails: r.fails, status: r.x && LABEL[r.x.key], supports: r.x && (r.x.sus ?? r.x.target), ask: r.x && r.x.target, futures: r.x && r.x.futures })), null, 1));
process.exitCode = passed === N ? 0 : 1;
