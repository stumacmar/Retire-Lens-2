/**
 * Someday · Horizon — END-TO-END test (100 checks).
 *
 *   npm run e2e
 *
 * Unlike the UAT (which checks that controls exist and don't crash), this proves
 * DATA FLOWS: (1) the UI actually captures every input into the plan — both
 * partners, including the defined-benefit pension and its start year; and (2)
 * every input moves the engine's output in the right direction. Fails the
 * process on any mismatch, console error or page error.
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

let pass = 0, fail = 0; const fails = [];
const check = (n, cond) => { try { if (cond === false) throw new Error('false'); pass++; } catch (e) { fail++; fails.push(`✗ ${n}: ${e.message}`); } };
const acheck = async (n, fn) => { try { if ((await fn()) === false) throw new Error('false'); pass++; } catch (e) { fail++; fails.push(`✗ ${n}: ${e.message}`); } };

// ─────────── PART A · Engine input→output flow (deterministic) ───────────
function metrics(P) {
  const acc = E.accumulate(P, P.growth);
  const dd = E.drawdown(P, { growth: P.growth, startPots: acc.atRetirement });
  const a = acc.atRetirement;
  const guarTotal = dd.rows.reduce((s, r) => s + r.guaranteed, 0);
  return {
    pots: a.pensionA + a.pensionB + a.isaA + a.isaB,
    end: dd.endWealth,
    tax: dd.lifetimeTax,
    exhaust: dd.exhaustedAgeA == null ? 999 : dd.exhaustedAgeA,
    guar0: dd.rows[0].guaranteed,
    guarTotal,
  };
}
const base = () => { const P = E.defaults(); P.growth = P.growthBase; return P; };
// mono: mutate the plan, assert a metric moves the expected way vs baseline.
function mono(name, mutate, key, dir) {
  const b = metrics(base());
  const P = base(); mutate(P); const m = metrics(P);
  const ok = dir > 0 ? m[key] > b[key] + 1e-6 : dir < 0 ? m[key] < b[key] - 1e-6 : Math.abs(m[key] - b[key]) > 1e-6;
  check(name, ok);
}
const setA = (P, k, v) => { P.partnerA = { ...P.partnerA, [k]: v }; };
const setB = (P, k, v) => { P.partnerB = { ...P.partnerB, [k]: v }; };

// Accumulation — both partners, every pot input
mono('E01 Robin pension↑ → pots↑', P => setA(P, 'pension', P.partnerA.pension + 100000), 'pots', 1);
mono('E02 Jo  pension↑ → pots↑', P => setB(P, 'pension', P.partnerB.pension + 100000), 'pots', 1);
mono('E03 Robin ISA↑ → pots↑', P => setA(P, 'isa', P.partnerA.isa + 50000), 'pots', 1);
mono('E04 Jo  ISA↑ → pots↑', P => setB(P, 'isa', P.partnerB.isa + 50000), 'pots', 1);
mono('E05 Robin monthly↑ → pots↑', P => setA(P, 'monthlyPension', P.partnerA.monthlyPension + 1000), 'pots', 1);
mono('E06 Jo  monthly↑ → pots↑', P => setB(P, 'monthlyPension', P.partnerB.monthlyPension + 1000), 'pots', 1);
mono('E07 Robin monthly ISA↑ → pots↑', P => setA(P, 'monthlyIsa', 500), 'pots', 1);
mono('E08 Jo  monthly ISA↑ → pots↑', P => setB(P, 'monthlyIsa', 500), 'pots', 1);
mono('E09 lower Robin pension → pots↓', P => setA(P, 'pension', 100000), 'pots', -1);
mono('E10 lower Jo pots → pots↓', P => setB(P, 'pension', 10000), 'pots', -1);

// Defined-benefit pension — THE reported bug area, both partners + timing + indexation
mono('E11 Robin DB set → lifetime guaranteed↑', P => setA(P, 'db', 12000), 'guarTotal', 1);
mono('E12 Jo  DB set → lifetime guaranteed↑', P => setB(P, 'db', 12000), 'guarTotal', 1);
mono('E13 Robin DB set → endWealth↑ (less drawdown)', P => setA(P, 'db', 12000), 'end', 1);
mono('E14 Jo  DB↑ → endWealth↑', P => setB(P, 'db', P.partnerB.db + 8000), 'end', 1);
mono('E15 Robin DB → guaranteed present in year one (start=retire)', P => { setA(P, 'db', 15000); setA(P, 'dbStartYear', P.retireYear); }, 'guar0', 1);
// start-year timing genuinely matters (the fix): DB starting AFTER retirement gives NO year-one guaranteed
check('E16 DB start after retirement → no year-one DB (timing respected)', (() => {
  const P = base(); P.retireYear = 2035; P.partnerA = { ...P.partnerA, birthYear: 1970 };
  const g = metrics({ ...P, partnerA: { ...P.partnerA, db: 15000, dbStartYear: P.retireYear } }).guar0;
  const gLate = metrics({ ...P, partnerA: { ...P.partnerA, db: 15000, dbStartYear: 2045 } }).guar0;
  return gLate < g - 1e-6;
})());
check('E17 DB start at retirement vs 8yrs later → lifetime guaranteed differs (start year matters)', (() => {
  const P = base(); P.retireYear = 2035; P.partnerA = { ...P.partnerA, birthYear: 1972 };
  const atRet = metrics({ ...P, partnerA: { ...P.partnerA, db: 15000, dbStartYear: P.retireYear } }).guarTotal;
  const later = metrics({ ...P, partnerA: { ...P.partnerA, db: 15000, dbStartYear: P.retireYear + 8 } }).guarTotal;
  return atRet > later + 1; // starting later pays for fewer years
})());
mono('E18 Robin DB indexed → lifetime guaranteed higher than flat', P => { setA(P, 'db', 12000); setA(P, 'dbIndexed', true); }, 'guarTotal', 1);
mono('E19 Jo  DB indexed → lifetime guaranteed↑', P => { setB(P, 'dbIndexed', true); }, 'guarTotal', 1);
mono('E20 Robin DB → year-one guaranteed income↑ (start=retire)', P => { setA(P, 'db', 20000); setA(P, 'dbStartYear', P.retireYear); }, 'guar0', 1);

// State Pension — both partners
mono('E21 Robin State Pension↑ → guaranteed↑', P => setA(P, 'spAmount', P.partnerA.spAmount + 4000), 'guarTotal', 1);
mono('E22 Jo  State Pension↑ → guaranteed↑', P => setB(P, 'spAmount', P.partnerB.spAmount + 4000), 'guarTotal', 1);
mono('E23 Robin SP age earlier (67→62) → lifetime guaranteed↑ (his SP is future)', P => { setA(P, 'spAge', 62); }, 'guarTotal', 1);
mono('E24 Robin SP age later (67→70) → lifetime guaranteed↓', P => { setA(P, 'spAge', 70); }, 'guarTotal', -1);

// Spending / timing
mono('E25 target↑ → endWealth↓', P => { P.targetNet += 15000; }, 'end', -1);
mono('E26 target↓ → endWealth↑', P => { P.targetNet -= 15000; }, 'end', 1);
mono('E27 target↑ a lot → exhausts earlier', P => { P.targetNet += 40000; }, 'exhaust', -1);
mono('E28 retire +3 → endWealth↑', P => { P.retireYear += 3; }, 'end', 1);
mono('E29 retire -1 → endWealth↓', P => { P.retireYear -= 1; }, 'end', -1);
check('E30 plan to older age → more retirement years to fund', (() => {
  const rows = P => E.drawdown({ ...P, growth: P.growth }, {}).rows.length;
  const b = base(); const long = base(); long.horizonAge += 5;
  return rows(long) > rows(b);
})());

// Growth lens / inflation
mono('E31 growth↑ → endWealth↑', P => { P.growth += 0.02; }, 'end', 1);
mono('E32 growth↓ → endWealth↓', P => { P.growth -= 0.02; }, 'end', -1);
mono('E33 inflation↑ → endWealth↓', P => { P.inflation += 0.02; }, 'end', -1);
mono('E34 growth↑ → pots↑', P => { P.growth += 0.02; }, 'pots', 1);

// Step-downs, inheritance, events
mono('E35 step-down 1 on → endWealth↑', P => { P.phase1On = true; }, 'end', 1);
mono('E36 step-down 2 on → endWealth↑', P => { P.phase1On = true; P.phase2On = true; }, 'end', 1);
mono('E37 inheritance on → endWealth↑', P => { P.inherit = { ...P.inherit, on: true, amount: 100000, invest: true }; }, 'end', 1);
mono('E38 life-event cost → endWealth↓', P => { P.lifeEvents = [{ year: P.retireYear + 3, label: 'car', amount: 40000, kind: 'cost' }]; }, 'end', -1);
mono('E39 life-event windfall invested → endWealth↑', P => { P.lifeEvents = [{ year: P.retireYear + 3, label: 'gift', amount: 40000, kind: 'income', invest: true }]; }, 'end', 1);

// Tax levers
mono('E40 PCLS upfront vs none → lifetime tax differs', P => { P.pclsMode = 'upfront'; }, 'tax', 0);
mono('E41 PCLS phased vs none → lifetime tax differs', P => { P.pclsMode = 'phased'; }, 'tax', 0);
mono('E42 strategy ISA-first vs pension-first → tax differs', P => { P.strategy = 'isafirst'; }, 'tax', 0);
mono('E43 strategy allowances-first → tax differs', P => { P.strategy = 'pafirst'; }, 'tax', 0);

// Sanity: baseline plan lasts, engine self-assertions hold
check('E44 baseline plan produces pots > 0', metrics(base()).pots > 0);
check('E45 baseline endWealth is a finite number', Number.isFinite(metrics(base()).end));
check('E46 no NaN in baseline metrics', !Object.values(metrics(base())).some(v => Number.isNaN(v)));
check('E47 engine load-time assertions all pass', E.runAssertions().every(a => a.pass));
check('E47b a fresh start spends the Moderate living standard for two (Pensions UK 2026)', E.freshStart().targetNet === E.LIVING_STANDARDS.couple.moderate && E.LIVING_STANDARDS.couple.moderate === 45400);
{
  // A 41-year-old stopping at 42 on £70,000 a year with the pension locked
  // until 57 and £72,000 of ISA and cash: fifteen unpaid years. The pot never
  // "exhausts" (it cannot be touched), so "holds" must look at unpaid years.
  const F = E.freshStart();
  const Y = E.sanitisePlan({ ...F, retireYear: 2027, targetNet: 70000, cash: 24000,
    partnerA: { ...F.partnerA, birthYear: 1985, spAmount: 12548, pension: 570000, monthlyPension: 3200, isa: 48000 },
    partnerB: { ...F.partnerB, birthYear: 1985 } });
  const dy = E.drawdown(Y);
  check('E47d stopping at 42 with the pension locked until 57 does not hold', dy.holds === false && dy.runsShortAgeA === 43 && dy.shortfallTotalReal > 500000);
  check('E47e the stress tests agree the base case does not hold', E.stressTests(Y).baseHolds === false && E.stressTests(Y).summary.holds === 0);
  check('E47f a funded plan still holds', E.drawdown(E.sanitisePlan(E.example())).holds === true);
  // Seen on the live site: a 26-year-old stopping at 46 on £60,000 with the
  // pension locked until 57. Runs short at 48; almost no future pays in full.
  const Y26 = E.sanitisePlan({ ...F, retireYear: 2046, targetNet: 60000, cash: 24000,
    partnerA: { ...F.partnerA, birthYear: 2000, spAmount: 12548, pension: 570000, monthlyPension: 3200, isa: 48000 },
    partnerB: { ...F.partnerB, birthYear: 2000 } });
  const d26 = E.drawdown(Y26), m26 = E.runMonteCarlo(Y26, 200, 7);
  check('E47g a 26-year-old stopping at 46 runs short before 50 and the futures agree', d26.holds === false && d26.runsShortAgeA >= 47 && d26.runsShortAgeA <= 49 && m26.successProb < 0.05);
  check('E47h fresh plans grow at the FCA intermediate rate (5%), not 7%', E.freshStart().growthBase === 0.05 && E.freshStart().growthBear === 0.02 && E.freshStart().growthBull === 0.08);
  // The odds behind the age to plan for: a 41-year-old today has roughly a
  // one-in-seven chance of seeing 95 and half of them live past the mid-80s;
  // a couple's chance that one of them is still here is higher than either's.
  const o95 = E.lifeOdds({ ...Y, horizonAge: 95 }), o85 = E.lifeOdds({ ...Y, horizonAge: 85 });
  check('E47i life odds: 95 is less likely than 85, and the median is in the 80s', o95.a.reach > 0.05 && o95.a.reach < 0.3 && o85.a.reach > o95.a.reach && o95.a.median >= 80 && o95.a.median <= 89);
  check('E47j life odds: the couple beats either partner; a single plan has no partner', o95.either > o95.a.reach && o95.either > o95.b.reach && E.lifeOdds({ ...Y, household: 'single' }).b === null);
  // The futures are weighted by survival from the stop year (conditional on
  // getting there), so the odds from today can only be lower, never higher.
  check('E47k life odds: from today, never above the survival the futures are weighted by', (() => { const X = E.prepare(Y); const H = E.householdSurvival(X); const o = E.lifeOdds(Y); return o.endYear === X.endYear && o.either <= H.alive[X.endYear - Y.retireYear] + 1e-9 && o.either > 0.3; })());
}
check('E47c living standard of a spend: single Minimum, couple Comfortable', E.livingStandardOf({ ...E.freshStart(), household: 'single' }, 13900) === 'minimum' && E.livingStandardOf(E.freshStart(), 70000) === 'comfortable');
mono('E48 both partners DB together → bigger guaranteed than one', P => { setA(P, 'db', 10000); setB(P, 'db', 10000); }, 'guarTotal', 1);
mono('E49 Robin pension to 0 → pots↓', P => setA(P, 'pension', 0), 'pots', -1);
mono('E50 Jo ISA to 0 → pots↓', P => setB(P, 'isa', 0), 'pots', -1);

// Scottish income-tax region (2025/26 bands)
{ const P = base(); const lv = E.levers(P, { paths: 60 });
  check('E60 levers: stopping a year later does not reduce wealth at the horizon', lv.levers.find(l => l.id === 'later1').dEnd >= -1);
  check('E61 levers: ranked by confidence gain', lv.levers.every((l, i, a) => i === 0 || a[i - 1].dConf >= l.dConf - 1e-12));
  const st = E.stressTests(P);
  check('E62 stress: 2008-at-retirement path leaves less than base', st.tests.find(t => /2008/.test(t.label)).delta < 0);
  check('E63 stress: summary counts add up', st.summary.holds + st.summary.fails === st.summary.total); }
check('E51 Scotland: exact tax at 57,548 gross = 12,152.21 (2026/27 bands)',
  Math.abs(E.taxOn(57548, { ...base().tax, region: 'scotland' }) - 12152.21) < 1);
check('E52 Scotland: region flag leaves rUK maths untouched',
  Math.abs(E.taxOn(57548, base().tax) - 10451.2) < 1);
mono('E53 Scotland region changes lifetime tax (bands differ)',
  P => { P.tax = { ...P.tax, region: 'scotland' }; }, 'tax', 0);

// Already-accessed pensions (prior PCLS / crystallisation)
{
  const Pph = base(); Pph.pclsMode = 'phased';
  const t0 = E.drawdown(Pph).lifetimeTax;
  const P1 = base(); P1.pclsMode = 'phased';
  P1.partnerA = { ...P1.partnerA, pclsTaken: 165000, crystallised: 400000 };
  const t1 = E.drawdown(P1).lifetimeTax;
  check('E54 prior PCLS + crystallisation reduce the tax-free benefit (tax ↑)', t1 > t0 + 1);
  const tn = E.drawdown(base()).lifetimeTax;
  check('E55 partially-accessed phased still beats take-none (tax between)', t1 <= tn + 0.5);
}

// Plan architecture: ladder, rules, annuity, care, parachute
{
  const arch = (patch) => { const P = base(); P.architecture = { ...P.architecture, on: true, ...(patch || {}) }; return P; };
  const exh = (r) => r.exhaustedAgeA == null ? 999 : r.exhaustedAgeA;
  check('E58 architecture off leaves the projection untouched',
    Math.abs(E.drawdown({ ...base(), architecture: { ...base().architecture, on: false } }).endWealth
      - E.drawdown(base()).endWealth) < 0.01);
  const jpL = E.drawdown(arch({ stressPath: 'japan', rulesOn: false }));
  const jpN = E.drawdown(arch({ stressPath: 'japan', rulesOn: false, ladderYears: 0 }));
  check('E59 gilt ladder buys years through a Japan-style start', exh(jpL) > exh(jpN));
  const jpR = E.drawdown(arch({ stressPath: 'japan', rulesOn: true }));
  check('E60 written rules never shorten a stressed plan', exh(jpR) >= exh(jpL));
  check('E61 written rules trim spending when stressed', jpR.architecture.spendMultFinal < 1);
  const ann = E.drawdown(arch({ annuityOn: true, annuityYear: base().retireYear + 5, annuityAmount: 150000 }));
  const aRow = ann.rows.find(r => r.year === base().retireYear + 6);
  check('E62 annuity review creates guaranteed income', aRow && aRow.annuity > 1000);
  check('E63 care costs reduce wealth at the horizon',
    E.drawdown(arch({ careOn: true, careFromAge: 84, careAnnual: 45000, careYears: 4 })).endWealth
      < E.drawdown(arch()).endWealth);
  check('E64 house parachute fires only when off track',
    E.drawdown(arch({ stressPath: 'japan', parachuteOn: true, parachuteFrom: 75, parachuteBelow: 0.9 })).architecture.parachuteYear != null
      && E.drawdown(arch({ parachuteOn: true, parachuteBelow: 0.05 })).architecture.parachuteYear == null);
  const rows = E.drawdown(arch()).rows;
  check('E65 ladder + engine reconcile to investable wealth',
    rows.every(r => Math.abs((r.ladder + r.engine) - (r.potA + r.potB + r.isaA + r.isaB)) < 5));
  const mcOn = E.runMonteCarlo(arch(), 200, 11), mcOff = E.runMonteCarlo(base(), 200, 11);
  check('E66 architecture changes Monte Carlo outcomes', Math.abs(mcOn.successProb - mcOff.successProb) > 0.01);
  check('E67 Monte Carlo reports how hard the rules worked', mcOn.worstSpendMult <= 1 && mcOn.worstSpendMult >= 0.5);
}

// The worth-it verdict: judged on spending delivered, not on survival
{
  const P = base(); P.architecture = { ...P.architecture, on: true };
  const w = E.assessStructure(P, { paths: 150 });
  check('E68 verdict compares both plans through the same markets', w.paths === 150 && w.on && w.off);
  check('E69 certainty-equivalent spending is sane', w.on.ceSpend > 1000 && w.on.ceSpend < P.targetNet * 1.5);
  check('E70 a trimmed year counts as reduced spending', w.on.worstYearRatioP10 < 1);
  check('E71 verdict names which piece did the work', w.drivers.length === 2 && w.drivers[0].worth >= w.drivers[1].worth);
  check('E72 the legacy cost is reported, not hidden', typeof w.legacyDelta === 'number');
  const cautious = E.assessStructure({ ...P, architecture: { ...P.architecture, riskAversion: 8 } }, { paths: 150 });
  const relaxed = E.assessStructure({ ...P, architecture: { ...P.architecture, riskAversion: 2 } }, { paths: 150 });
  check('E73 higher risk aversion never raises the certainty equivalent', cautious.on.ceSpend <= relaxed.on.ceSpend + 1);
  check('E74 verdict is one of the four defined outcomes',
    ['clear', 'modest', 'marginal', 'against'].includes(w.verdict));
}

// The up-front choice records itself and drives the maths
{
  const P = base();
  check('E75 a fresh plan has no approach recorded yet', E.freshStart().approach == null);
  check('E76 approach does not disturb the projection',
    Math.abs(E.drawdown({ ...P, approach: 'derisking' }).endWealth - E.drawdown(P).endWealth) < 0.01);
}

// Protected / scheme-specific tax-free entitlements (blended rate)
{
  const sm = base(); sm.pclsMode = 'phased'; sm.targetNet = 40000;
  sm.partnerA = { ...sm.partnerA, pension: 200000, monthlyPension: 0 };
  sm.partnerB = { ...sm.partnerB, pension: 150000, monthlyPension: 0, db: 0 };
  const t25 = E.drawdown(sm).lifetimeTax;
  const t50 = E.drawdown({ ...sm,
    partnerA: { ...sm.partnerA, tfcRate: 0.5 }, partnerB: { ...sm.partnerB, tfcRate: 0.5 } }).lifetimeTax;
  check('E56 protected 50% TFC entitlement cuts lifetime tax vs 25%', t50 < t25 - 1);
  const t0 = E.drawdown({ ...sm,
    partnerA: { ...sm.partnerA, tfcRate: 0 }, partnerB: { ...sm.partnerB, tfcRate: 0 } }).lifetimeTax;
  check('E57 zero TFC entitlement == take-none tax', Math.abs(t0 - E.drawdown({ ...sm, pclsMode: 'none' }).lifetimeTax) < 1);
}

// ─────────── PART B · UI actually captures inputs into the plan ───────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent((req.url || '/').split('?')[0]); if (f === '/') f = '/index.html';
  fs.readFile(path.join(DIST, f), (e, d) => { if (e) { fs.readFile(path.join(DIST, 'index.html'), (e2, d2) => { res.writeHead(e2 ? 404 : 200, { 'content-type': 'text/html' }); res.end(d2 || ''); }); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => server.listen(0, r));
const URL = `http://localhost:${server.address().port}/`;
function chrome() { const c = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean); for (const x of c) if (fs.existsSync(x)) return x; return undefined; }
const ex = chrome();
const b = await chromium.launch(ex ? { executablePath: ex } : {});
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
// Existing checks were written against the island; the home now opens on the moon, so they pin the island
// (only where nothing is set). The moon home has its own block in the UAT, in its own page, with no pin.
await p.addInitScript(() => { try { if (!localStorage.getItem('someday-picture-v1')) localStorage.setItem('someday-picture-v1', 'island'); } catch { /* private mode */ } });
const ce = [], pe = [];
p.on('console', m => { if (m.type() === 'error' && !/404|favicon/i.test(m.text())) ce.push(m.text()); });
p.on('pageerror', e => pe.push(e.message));
const wait = ms => p.waitForTimeout(ms);
const plan = async () => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('horizon-plan-v1') || '{}'); } catch { return {}; } });
// Buttons-first: every tap target in the app is a button, so prefer the
// accessible-name match — prose (e.g. Coach copy) can never hijack a tap.
const tap = async t => {
  try { await p.getByRole('button', { name: t }).first().click({ timeout: 4000 }); return true; }
  catch { try { await p.locator(`text=${t}`).first().click({ timeout: 2000 }); return true; } catch { return false; } }
};
// Exact-name button (segmented tabs: 'Plan' would otherwise substring-match "Adjust your plan").
const seg = async t => { try { await p.getByRole('button', { name: t, exact: true }).first().click({ timeout: 4000 }); await wait(300); return true; } catch { return false; } };
// Controls that exist both on the Horizon and inside a sheet must be tapped
// where they are meant, never on the card behind it.
const tapInSheet = async t => {
  try { await p.locator('[role=dialog]').getByRole('button', { name: t }).first().click({ timeout: 4000 }); return true; }
  catch { return false; }
};
// Jump to a named page of the form carousel via its rail.
// The home's three steppers can each be typed: 'Stop work at' (an age),
// 'Take home' and 'You pay in' (a month). (The Horizon Dial, which once
// drove these checks, was retired in November 2026.)
const homeType = async (label, value) => {
  await p.getByRole('button', { name: new RegExp(`^${label}: .*Tap to type`) }).click({ timeout: 4000 });
  await p.fill(`input[aria-label="${label}, type a figure"]`, String(value)); await p.keyboard.press('Enter'); await wait(500);
};
const answerText = async () => p.$eval('[data-answer]', e => e.innerText).catch(() => '');
// Jump to a named page of the form carousel via its rail, and WAIT for that
// page to be the one on screen. A fixed sleep is a guess: a jump across five
// pages takes as long as the device needs, and CI is slower than this one.
const goPage = async t => {
  // A page most people need is on the rail. The rest are a layer down: the
  // rail's "More" lists them, and a row there opens the page.
  const hit = async (sel, want) => p.evaluate(([s, w]) => { const e = [...document.querySelectorAll(s)].find(x => (x.getAttribute('data-rail-title') ?? x.getAttribute('data-more-row')) === w); if (e) e.click(); return !!e; }, [sel, want]);
  if (!(await hit('[data-rail-title]', t))) {
    if (!(await hit('[data-rail-title]', 'More'))) return false;
    try { await p.waitForFunction(() => document.querySelector('[data-active]')?.getAttribute('data-title') === 'More', null, { timeout: 10000 }); } catch { return false; }
    await wait(200);
    if (!(await hit('[data-more-row]', t))) return false;
  }
  try {
    await p.waitForFunction(want => {
      const el = document.querySelector('[data-active]');
      return !!el && el.getAttribute('data-title') === want;
    }, t, { timeout: 10000 });
  } catch { return false; }
  await wait(200);
  return true;
};
// Set a labelled MoneyField/NumField. Uses Playwright fill + blur with awaits
// between them, so React processes the input (setText) BEFORE the blur commits —
// synthetic input+blur in one tick would read stale state (MoneyField commits
// on blur). `which` picks the nth match (0=first partner, 1=second).
// Every carousel page stays in the DOM, so a page-wide selector would happily
// type into the page you are NOT looking at (and did: Jo's figures landed
// on Robin). Prefer the active page; fall back to the document for the
// screens that are not a carousel.
async function setField(label, value, which = 0) {
  const sel = `label:has-text(${JSON.stringify(label)}) input`;
  const onPane = p.locator(`[data-active] ${sel}`);
  const inp = (await onPane.count()) > 0 ? onPane.nth(which) : p.locator(sel).nth(which);
  if (await inp.count() === 0) return false;
  await inp.fill(String(value));
  await wait(260);            // let React commit the controlled value before blur reads it
  await inp.blur();          // fires onBlur → commits to the plan
  await wait(200);
  return true;
}

// Drive onboarding, entering DB + ISA for BOTH partners.
// Clear once (not via addInitScript — that would wipe storage on every reload).
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
// Preview gate: unlock as a tester would (phrase hash from public/gate.js).
await p.evaluate(h => localStorage.setItem('someday-gate-v1', h), fs.readFileSync(path.join(__dir, 'public', 'gate.js'), 'utf8').match(/var HASH = '([0-9a-f]{64})'/)[1]);
// Run as a Plus customer so every input is reachable (pre-validated local record; no network).
await p.evaluate(() => localStorage.setItem('someday-licence-v1', JSON.stringify({ key: 'e2e-seeded-licence', instanceId: 'e2e', instanceName: 'E2E', status: 'active', expiresAt: null, activatedAt: Date.now(), validatedAt: Date.now() })));
await p.reload({ waitUntil: 'networkidle' }); await wait(700);
await acheck('U50a a new plan starts as one person', async () => (await plan()).household === 'single');
await tap('Begin'); await wait(900);
// The disclaimer is accepted once, then the home
await acheck('U60z disclaimer appears before the first horizon',
  async () => /calm place to think/i.test(await p.$eval('h1', e => e.textContent).catch(() => '')));
await tap('I understand'); await wait(800);
// No approach question (owner, 17 November 2026): the home follows the disclaimer.
await acheck('U60a no approach question: the home follows the disclaimer',
  async () => !/How should the money be run/i.test(await p.$eval('body', e => e.innerText)) && (await p.$('[data-simple-home]')) != null);
await acheck('U60b a fresh plan starts as one invested pot', async () => (await plan()).architecture?.on !== true);

// ── Details: every figure entered writes the real plan ──────────────────
// An empty plan lands on the home, which sends you to Details.
await tap('Add my details'); await wait(900);
await tapInSheet('A couple'); await wait(400);
await acheck('U51b Details: household becomes a couple', async () => (await plan()).household === 'couple');
await p.locator('[data-active] input[placeholder=You]').fill('Robin').catch(() => {}); await wait(250);
await acheck('U51 Details: name captured', async () => (await plan()).partnerA?.name === 'Robin');
await p.locator('[data-active] input[placeholder=Partner]').fill('Jo').catch(() => {}); await wait(250);
await acheck('U57 Details: partner name captured', async () => (await plan()).partnerB?.name === 'Jo');
const sy0 = (await plan()).startYear;
await goPage('Someday');
await setField('Retire in year', sy0 + 8);
await acheck('U51c Details: retire year captured', async () => (await plan()).retireYear === sy0 + 8);
await setField('Income you want each year', 43200);
await acheck('U51d Details: the income asked for becomes the yearly target', async () => (await plan()).targetNet === 43200);
await goPage('Robin’s pots');
await setField('Workplace pension today', 600000);
await acheck('U52 Details: Robin pension captured', async () => (await plan()).partnerA?.pension === 600000);
await setField('Paying into pension monthly', 3000);
await acheck('U53 Details: Robin monthly captured', async () => (await plan()).partnerA?.monthlyPension === 3000);
await setField('ISAs today', 45000);
await acheck('U54 Details: Robin ISA captured', async () => (await plan()).partnerA?.isa === 45000);
await goPage('Jo’s pots');
await setField('Workplace pension today', 45000);
await acheck('U58 Details: Jo pension captured', async () => (await plan()).partnerB?.pension === 45000);
await setField('ISAs today', 45000);
await acheck('U59 Details: Jo ISA captured', async () => (await plan()).partnerB?.isa === 45000);
await goPage('Robin’s guaranteed income');
await setField('final-salary pension a year', 9000);
await acheck('U55 Details: Robin DB amount captured', async () => (await plan()).partnerA?.db === 9000);
await acheck('U56 Details: Robin DB start = retire year (the fix)', async () => { const P = await plan(); return P.partnerA.dbStartYear === P.retireYear; });
await goPage('Jo’s guaranteed income');
await setField('State Pension a year', 12548);
await acheck('U56b Details: partner State Pension captured', async () => (await plan()).partnerB?.spAmount === 12548);
await setField('final-salary pension a year', 5000);
await acheck('U60 Details: Jo DB captured (the reported bug)', async () => (await plan()).partnerB?.db === 5000);
await acheck('U61 Details: Jo DB start = retire year', async () => { const P = await plan(); return P.partnerB.dbStartYear === P.retireYear; });
await acheck('U62 both DBs captured', async () => { const P = await plan(); return P.partnerA.db === 9000 && P.partnerB.db === 5000; });
await p.keyboard.press('Escape'); await wait(600);
await p.waitForFunction(() => document.querySelector('[data-answer]')?.getAttribute('data-ready') === '1', null, { timeout: 25000 }).catch(() => {});
await acheck('U63 the answer renders after DB entry', async () => /£[\d,]+/.test(await answerText()) && /a month/.test(await answerText()));
await acheck('U63b the home counts both of them, with the guaranteed income', async () => /^Counts Robin and Jo: .*£\d+k a year guaranteed/.test(await p.$eval('[data-counts]', e => e.innerText.replace(/\s+/g, ' '))));

// Confidence responds to the DB we entered (compare to DB=0 in the same UI)
await wait(700);
// Details: zero both DBs, confidence should drop (guaranteed income removed)
await tap('Details'); await wait(800);

// ── Robin's guaranteed income ──────────────────────────────────────────
await goPage('Robin’s guaranteed income');
await acheck('U64 Details: Robin DB start-year field appears when DB>0', async () => (await p.locator('text=…starts in (year)').count()) >= 1);
await acheck('U65 Details: DB indexation toggle appears when DB>0', async () => (await p.locator('text=…rises with inflation').count()) >= 1);
await setField('final-salary pension a year', 0);
await acheck('U66 Details: setting Robin DB=0 updates plan', async () => (await plan()).partnerA?.db === 0);
await setField('final-salary pension a year', 11000);
await acheck('U67 Details: re-entering Robin DB updates plan', async () => (await plan()).partnerA?.db === 11000);
await setField('…starts in (year)', 2036);
await acheck('U68 Details: Robin DB start-year editable → plan', async () => (await plan()).partnerA?.dbStartYear === 2036);
await p.locator('[role=dialog] [role=switch]:has-text("rises with inflation")').first().click().catch(() => {}); await wait(400);
await acheck('U69 Details: Robin DB indexation toggle → plan', async () => (await plan()).partnerA?.dbIndexed === true);
await setField('State Pension a year', 11500);
await acheck('U70 Details: State Pension amount → plan', async () => (await plan()).partnerA?.spAmount === 11500);

// Public-sector scheme tranche: added, captured, and it moves the engine
await p.locator('[role=dialog]').getByRole('button', { name: /Add an NHS/ }).first().click(); await wait(400);
await acheck('U72m scheme tranche added to Robin', async () => ((await plan()).partnerA?.dbSchemes || []).length === 1);
await setField('Pension a year on your latest statement', 14000);
await acheck('U72n scheme pension captured → plan', async () => (await plan()).partnerA?.dbSchemes?.[0]?.pension === 14000);
await p.locator('[role=dialog] select[aria-label="Pension scheme"]').first().selectOption('nhs1995'); await wait(400);
await acheck('U72o scheme choice captured (NHS 1995)', async () => (await plan()).partnerA?.dbSchemes?.[0]?.scheme === 'nhs1995');
await setField('Take it from age', 57);
await acheck('U72p take-age captured', async () => (await plan()).partnerA?.dbSchemes?.[0]?.takeAge === 57);
await acheck('U72q early reduction shown in the UI', async () => /years? early: about \d+% less/.test(await p.$eval('body', e => e.innerText)));
await p.locator('[role=dialog]').getByRole('button', { name: /^Maximum/ }).first().click(); await wait(400);
await acheck('U72r maximum lump sum captured (commutePct=1)', async () => (await plan()).partnerA?.dbSchemes?.[0]?.commutePct === 1);
await acheck('U72s tranche raises guaranteed income in the engine', async () => {
  const P = await plan(); const Q = { ...P, growth: P.growthBase };
  const with_ = metrics(Q).guarTotal; const without = metrics({ ...Q, partnerA: { ...Q.partnerA, dbSchemes: [] } }).guarTotal;
  return with_ > without + 1000; });
await acheck('U72t tranche at NPA pays the statement figure (engine)', async () => {
  const P = await plan(); const t = { ...P.partnerA.dbSchemes[0], takeAge: 60, commutePct: 0 };
  return Math.abs(E.trancheBenefits(P, P.partnerA, t).pension - 14000) < 0.01; });

// ── Robin's pots ───────────────────────────────────────────────────────
await goPage('Robin’s pots');
await setField('Paying into ISAs monthly', 200);
await acheck('U71 Details: monthly ISA → plan', async () => (await plan()).partnerA?.monthlyIsa === 200);
await tapInSheet('Already taken tax-free cash'); await wait(500);
await setField('Tax-free cash already taken', 165000);
await acheck('U72a Details: prior PCLS → plan', async () => (await plan()).partnerA?.pclsTaken === 165000);
await setField('Pension already accessed (crystallised)', 400000);
await acheck('U72b Details: crystallised amount → plan', async () => (await plan()).partnerA?.crystallised === 400000);
await setField('Tax-free cash already taken', 0);
await setField('Pension already accessed (crystallised)', 0);
// Advanced mode: scheme list aggregates into the plan
await p.locator('[role=dialog] [role=switch]:has-text("Advanced")').first().click().catch(() => {}); await wait(450);
await acheck('U72c Details: advanced mode → plan', async () => (await plan()).advanced === true);
await tapInSheet('Add a scheme'); await wait(450);
await acheck('U72d first scheme seeds from the existing pot', async () => {
  const P = await plan(); return (P.partnerA.pots || []).length === 1 && P.partnerA.pots[0].value === P.partnerA.pension; });
await setField('Value', 250000);
await acheck('U72e scheme edit aggregates into the pension total', async () => (await plan()).partnerA?.pension === 250000);
await tapInSheet('Add a scheme'); await wait(450);
await setField('Value', 100000, 1);
await acheck('U72f two schemes sum into the pot (350k)', async () => (await plan()).partnerA?.pension === 350000);
await p.locator('[role=dialog] [role=switch]:has-text("Advanced")').first().click().catch(() => {}); await wait(400);

// ── Structure ───────────────────────────────────────────────────────────
await goPage('Safe ladder');
await acheck('U72g the safe ladder page opens, marked optional', async () => (await p.locator('text=Safe ladder (optional)').count()) > 0);
const ladderSwitch = () => p.locator('[role=dialog] [role=switch]:has-text("Use a safe ladder")').first();
await ladderSwitch().click().catch(() => {}); await wait(700);
await acheck('U72h switching the ladder on turns the architecture on', async () => (await plan()).architecture?.on === true);
await acheck('U72i it starts from a 7-year ladder', async () => (await plan()).architecture?.ladderYears === 7);
await acheck('U72j it arms the written rules', async () => (await plan()).architecture?.rulesOn === true);
await acheck('U72j2 it records the approach', async () => (await plan()).approach === 'derisking');
await ladderSwitch().click().catch(() => {}); await wait(500);
await acheck('U72k the ladder can be switched back off', async () => (await plan()).architecture?.on === false && (await plan()).approach === 'traditional');

// ── Jo's own pages — proves BOTH partners work ───────────────────────
await goPage('Jo’s guaranteed income');
await setField('final-salary pension a year', 7000);
await acheck('U72 Details: Jo DB editable → plan (both partners work)', async () => (await plan()).partnerB?.db === 7000);

// ── The someday ─────────────────────────────────────────────────────────
await goPage('Someday');
await setField('Retire in year', 2033);
await acheck('U73 Details: retire year → plan', async () => (await plan()).retireYear === 2033);
await setField('Income you want each year', 55000);
await acheck('U74 Details: target → plan', async () => (await plan()).targetNet === 55000);
await p.locator('[data-active]').getByRole('button', { name: /^Moderate/ }).first().click({ timeout: 4000 }).catch(() => {});
await wait(500);
await acheck('U74b Details: tapping the Moderate living standard → plan (two people)', async () => (await plan()).targetNet === E.LIVING_STANDARDS.couple.moderate);
await setField('Income you want each year', 55000);
await acheck('U74c Details: the typed target wins again', async () => (await plan()).targetNet === 55000);
await setField('Plan through to age', 92);
await acheck('U75 Details: horizon age → plan', async () => (await plan()).horizonAge === 92);
await acheck('U75b Details: the plan age says what it means (half live past …, chance at 92)', async () => /Half of people aged \d+ today live past \d+\. The chance at least one of you is still here at 92 is about \d+%/.test(await p.locator('[data-active]').innerText()));

// ── Drawing and tax ─────────────────────────────────────────────────────
await goPage('Drawing');
await tapInSheet('All at once'); await wait(400);
await acheck('U76 Details: PCLS upfront → plan', async () => (await plan()).pclsMode === 'upfront');
await tapInSheet('ISAs'); await wait(400);
await acheck('U77 Details: strategy ISAs-first → plan', async () => (await plan()).strategy === 'isafirst');
await goPage('Tax');
await tapInSheet('Scotland'); await wait(400);
await acheck('U77b Details: Scottish tax region → plan', async () => (await plan()).tax?.region === 'scotland');
await tapInSheet('England, Wales & NI'); await wait(400);
await acheck('U77c Details: region back to rUK → plan', async () => (await plan()).tax?.region === 'ruk');

// ── Spending, the lens and life events ──────────────────────────────────
await goPage('Spending');
const p1before = (await plan()).phase1On;
await p.locator('[role=dialog] [role=switch]:has-text("Ease spending")').first().click().catch(() => {}); await wait(500);
await acheck('U78 Details: step-down toggle flips phase1On', async () => (await plan()).phase1On !== p1before);
await goPage('Growth rates');
await setField('Poor', 3.5);
await acheck('U80 Details: lens Poor rate → plan', async () => Math.abs((await plan()).growthBear - 0.035) < 1e-6);
await setField('Inflation', 2.5);
await acheck('U81 Details: inflation → plan', async () => Math.abs((await plan()).inflation - 0.025) < 1e-6);
await goPage('Life events');
await p.locator('[role=dialog] [role=switch]:has-text("inheritance")').first().click().catch(() => {}); await wait(400);
await acheck('U79 Details: inheritance toggle → plan', async () => (await plan()).inherit?.on === true);
await tapInSheet('Add a cost'); await wait(450);
await acheck('U82 Details: add a cost → cost event in plan', async () => ((await plan()).lifeEvents || []).some(e => e.kind === 'cost'));
await tapInSheet('Add a windfall'); await wait(450);
await acheck('U83 Details: add a windfall → income event in plan', async () => ((await plan()).lifeEvents || []).some(e => e.kind === 'income'));

// UI edits actually recompute the answer (end-to-end through the engine)
await p.keyboard.press('Escape'); await wait(500);
const hA = await answerText();
await homeType('Take home', 9500); await wait(900);
const hB = await answerText();
await acheck('U84 the take-home stepper recomputes the answer (UI→engine→UI)', async () => hA !== hB && (await plan()).targetNet === 114000);
await acheck('U85 plan persists after edits', async () => { const P = await plan(); return P.partnerA.db === 11000 && P.partnerB.db === 7000; });

// Reload → captured DB survives (persistence of the fix)
await p.reload({ waitUntil: 'networkidle' }); await wait(800);
await acheck('U86 reload keeps Robin DB + start year', async () => { const P = await plan(); return P.partnerA.db === 11000 && P.partnerA.dbStartYear === 2036; });
await acheck('U87 reload keeps Jo DB', async () => (await plan()).partnerB?.db === 7000);
await acheck('U88 reload keeps indexation flag', async () => (await plan()).partnerA?.dbIndexed === true);

// Confidence genuinely reflects DB: compare engine metric with the captured plan
const capturedPlan = await plan();
await acheck('U89 captured plan drives engine (guaranteed includes both DBs)', async () => {
  const P = { ...capturedPlan, growth: capturedPlan.growthBase };
  const m = metrics(P);
  const P0 = { ...P, partnerA: { ...P.partnerA, db: 0 }, partnerB: { ...P.partnerB, db: 0 } };
  return metrics(P).guarTotal > metrics(P0).guarTotal;
});
await acheck('U90 captured plan: no NaN in derived UI', async () => !/£NaN|NaN/.test(await p.$eval('body', e => e.innerText)));

// A few more end-to-end monotonicity via the captured plan through the engine
const cp = await plan();
const cm = k => metrics({ ...cp, growth: cp.growthBase, ...({}) })[k];
check('U91 captured pots > 0', metrics({ ...cp, growth: cp.growthBase }).pots > 0);
check('U92 captured endWealth finite', Number.isFinite(metrics({ ...cp, growth: cp.growthBase }).end));
check('U93 Robin DB in captured plan raises guaranteed', metrics({ ...cp, growth: cp.growthBase }).guarTotal > metrics({ ...cp, growth: cp.growthBase, partnerA: { ...cp.partnerA, db: 0 } }).guarTotal);
check('U94 Jo DB in captured plan raises guaranteed', metrics({ ...cp, growth: cp.growthBase }).guarTotal > metrics({ ...cp, growth: cp.growthBase, partnerB: { ...cp.partnerB, db: 0 } }).guarTotal);
check('U95 later Robin DB start reduces lifetime guaranteed vs at-retirement', (() => {
  const early = metrics({ ...cp, growth: cp.growthBase, partnerA: { ...cp.partnerA, dbStartYear: cp.retireYear } }).guarTotal;
  const late = metrics({ ...cp, growth: cp.growthBase, partnerA: { ...cp.partnerA, dbStartYear: cp.retireYear + 6 } }).guarTotal;
  return late < early - 1e-6;
})());
check('U96 indexed Robin DB ≥ flat over the plan', metrics({ ...cp, growth: cp.growthBase }).guarTotal >= metrics({ ...cp, growth: cp.growthBase, partnerA: { ...cp.partnerA, dbIndexed: false } }).guarTotal);
await acheck('U97 no console errors during e2e', () => ce.length === 0);
await acheck('U98 no page errors during e2e', () => pe.length === 0);
await acheck('U99 UI still interactive after full run (tab opens)', async () => { await tap('Explore'); await wait(500); return (await p.locator('[role=dialog]').count()) > 0; });
await acheck('U100 Explore reflects company pension when DB set', async () => /Company pension|income comes from/i.test(await p.$eval('body', e => e.innerText)));

console.log(`\n═══ Horizon END-TO-END: ${pass}/${pass + fail} passed ═══`);
if (fails.length) console.log('\nFAILURES:\n' + fails.map(f => '  ' + f).join('\n'));
if (ce.length) console.log('\nCONSOLE ERRORS:\n' + [...new Set(ce)].slice(0, 8).map(e => '  • ' + e).join('\n'));
if (pe.length) console.log('\nPAGE ERRORS:\n' + [...new Set(pe)].slice(0, 8).map(e => '  • ' + e).join('\n'));
await b.close(); server.close();
process.exitCode = (ce.length || pe.length || fail > 0) ? 1 : 0;
