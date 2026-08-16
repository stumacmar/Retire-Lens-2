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
mono('E01 Stuart pension↑ → pots↑', P => setA(P, 'pension', P.partnerA.pension + 100000), 'pots', 1);
mono('E02 Carol  pension↑ → pots↑', P => setB(P, 'pension', P.partnerB.pension + 100000), 'pots', 1);
mono('E03 Stuart ISA↑ → pots↑', P => setA(P, 'isa', P.partnerA.isa + 50000), 'pots', 1);
mono('E04 Carol  ISA↑ → pots↑', P => setB(P, 'isa', P.partnerB.isa + 50000), 'pots', 1);
mono('E05 Stuart monthly↑ → pots↑', P => setA(P, 'monthlyPension', P.partnerA.monthlyPension + 1000), 'pots', 1);
mono('E06 Carol  monthly↑ → pots↑', P => setB(P, 'monthlyPension', P.partnerB.monthlyPension + 1000), 'pots', 1);
mono('E07 Stuart monthly ISA↑ → pots↑', P => setA(P, 'monthlyIsa', 500), 'pots', 1);
mono('E08 Carol  monthly ISA↑ → pots↑', P => setB(P, 'monthlyIsa', 500), 'pots', 1);
mono('E09 lower Stuart pension → pots↓', P => setA(P, 'pension', 100000), 'pots', -1);
mono('E10 lower Carol pots → pots↓', P => setB(P, 'pension', 10000), 'pots', -1);

// Defined-benefit pension — THE reported bug area, both partners + timing + indexation
mono('E11 Stuart DB set → lifetime guaranteed↑', P => setA(P, 'db', 12000), 'guarTotal', 1);
mono('E12 Carol  DB set → lifetime guaranteed↑', P => setB(P, 'db', 12000), 'guarTotal', 1);
mono('E13 Stuart DB set → endWealth↑ (less drawdown)', P => setA(P, 'db', 12000), 'end', 1);
mono('E14 Carol  DB↑ → endWealth↑', P => setB(P, 'db', P.partnerB.db + 8000), 'end', 1);
mono('E15 Stuart DB → guaranteed present in year one (start=retire)', P => { setA(P, 'db', 15000); setA(P, 'dbStartYear', P.retireYear); }, 'guar0', 1);
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
mono('E18 Stuart DB indexed → lifetime guaranteed higher than flat', P => { setA(P, 'db', 12000); setA(P, 'dbIndexed', true); }, 'guarTotal', 1);
mono('E19 Carol  DB indexed → lifetime guaranteed↑', P => { setB(P, 'dbIndexed', true); }, 'guarTotal', 1);
mono('E20 Stuart DB → year-one guaranteed income↑ (start=retire)', P => { setA(P, 'db', 20000); setA(P, 'dbStartYear', P.retireYear); }, 'guar0', 1);

// State Pension — both partners
mono('E21 Stuart State Pension↑ → guaranteed↑', P => setA(P, 'spAmount', P.partnerA.spAmount + 4000), 'guarTotal', 1);
mono('E22 Carol  State Pension↑ → guaranteed↑', P => setB(P, 'spAmount', P.partnerB.spAmount + 4000), 'guarTotal', 1);
mono('E23 Stuart SP age earlier (67→62) → lifetime guaranteed↑ (his SP is future)', P => { setA(P, 'spAge', 62); }, 'guarTotal', 1);
mono('E24 Stuart SP age later (67→70) → lifetime guaranteed↓', P => { setA(P, 'spAge', 70); }, 'guarTotal', -1);

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
mono('E48 both partners DB together → bigger guaranteed than one', P => { setA(P, 'db', 10000); setB(P, 'db', 10000); }, 'guarTotal', 1);
mono('E49 Stuart pension to 0 → pots↓', P => setA(P, 'pension', 0), 'pots', -1);
mono('E50 Carol ISA to 0 → pots↓', P => setB(P, 'isa', 0), 'pots', -1);

// Scottish income-tax region (2025/26 bands)
check('E51 Scotland: exact tax at 57,548 gross = 12,183.96',
  Math.abs(E.taxOn(57548, { ...base().tax, region: 'scotland' }) - 12183.96) < 1);
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
// Set a labelled MoneyField/NumField. Uses Playwright fill + blur with awaits
// between them, so React processes the input (setText) BEFORE the blur commits —
// synthetic input+blur in one tick would read stale state (MoneyField commits
// on blur). `which` picks the nth match (0=first partner, 1=second).
async function setField(label, value, which = 0) {
  const inp = p.locator(`label:has-text(${JSON.stringify(label)}) input`).nth(which);
  if (await inp.count() === 0) return false;
  await inp.fill(String(value));
  await wait(150);            // let React commit the controlled value
  await inp.blur();          // fires onBlur → commits to the plan
  await wait(200);
  return true;
}

// Drive onboarding, entering DB + ISA for BOTH partners.
// Clear once (not via addInitScript — that would wipe storage on every reload).
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' }); await wait(700);
await tap('Begin'); await wait(400);
// vision: set retire in 8 years + target
await p.$$eval('input[type=range]', els => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(els[0], '8'); els[0].dispatchEvent(new Event('input', { bubbles: true })); }); await wait(150);
await tap('£43k'); await wait(150);
await tap('Continue'); await wait(400);
await p.fill('input[placeholder=You]', 'Stuart').catch(() => {});
await acheck('U51 onboarding: name captured', async () => (await plan()).partnerA?.name === 'Stuart');
await setField('Workplace pension', 600000);
await acheck('U52 onboarding: Stuart pension captured', async () => (await plan()).partnerA?.pension === 600000);
await setField('Paying into your pension', 3000);
await acheck('U53 onboarding: Stuart monthly captured', async () => (await plan()).partnerA?.monthlyPension === 3000);
await setField('ISAs today', 47000);
await acheck('U54 onboarding: Stuart ISA captured', async () => (await plan()).partnerA?.isa === 47000);
await setField('final-salary (defined benefit) pension a year', 9000);
await acheck('U55 onboarding: Stuart DB amount captured', async () => (await plan()).partnerA?.db === 9000);
await acheck('U56 onboarding: Stuart DB start = retire year (the fix)', async () => { const P = await plan(); return P.partnerA.dbStartYear === P.retireYear; });
// Target the partner switch by name (a DB-indexation switch may precede it now).
await p.locator('[role=switch]:has-text("Planning with a partner")').click().catch(() => {}); await wait(300);
await p.fill('input[placeholder=Partner]', 'Carol').catch(() => {});
await acheck('U57 onboarding: partner name captured', async () => (await plan()).partnerB?.name === 'Carol');
await setField('Their workplace pension', 46000);
await acheck('U58 onboarding: Carol pension captured', async () => (await plan()).partnerB?.pension === 46000);
await setField('Their ISAs today', 46000);
await acheck('U59 onboarding: Carol ISA captured', async () => (await plan()).partnerB?.isa === 46000);
await setField('Their company / final-salary', 5000);
await acheck('U60 onboarding: Carol DB captured (the reported bug)', async () => (await plan()).partnerB?.db === 5000);
await acheck('U61 onboarding: Carol DB start = retire year', async () => { const P = await plan(); return P.partnerB.dbStartYear === P.retireYear; });
await tap('See my horizon'); await wait(900);
await acheck('U62 completes to Horizon with DB captured for both', async () => { const P = await plan(); return P.partnerA.db === 9000 && P.partnerB.db === 5000; });
await acheck('U63 answer renders after DB entry', async () => /spend about|gets tight/i.test(await p.$eval('h1', e => e.textContent).catch(() => '')));

// Confidence responds to the DB we entered (compare to DB=0 in the same UI)
await wait(700);
// Details: zero both DBs, confidence should drop (guaranteed income removed)
await tap('Details'); await wait(500); await tap('People'); await wait(400);
const accs = await p.$$('text=More — State Pension');
for (const a of accs) { await a.click().catch(() => {}); await wait(250); }
await acheck('U64 Details: Stuart DB start-year field appears when DB>0', async () => (await p.locator('text=…starts in (year)').count()) >= 1);
await acheck('U65 Details: DB indexation toggle appears when DB>0', async () => (await p.locator('text=…rises with inflation').count()) >= 1);
await setField('final-salary (defined benefit) pension a year', 0); // this hits Stuart's (first match)
await acheck('U66 Details: setting Stuart DB=0 updates plan', async () => (await plan()).partnerA?.db === 0);
// set Stuart DB start year via UI (re-enter DB first)
await setField('final-salary (defined benefit) pension a year', 11000);
await wait(300);
await acheck('U67 Details: re-entering Stuart DB updates plan', async () => (await plan()).partnerA?.db === 11000);
await setField('…starts in (year)', 2036);
await acheck('U68 Details: Stuart DB start-year editable → plan', async () => (await plan()).partnerA?.dbStartYear === 2036);
// indexation toggle
await p.evaluate(() => { const lab = [...document.querySelectorAll('[role=switch]')].find(s => /rises with inflation/i.test(s.textContent)); lab && lab.click(); }); await wait(300);
await acheck('U69 Details: Stuart DB indexation toggle → plan', async () => (await plan()).partnerA?.dbIndexed === true);
// State Pension + monthly ISA capture
await setField('State Pension a year', 11500);
await acheck('U70 Details: State Pension amount → plan', async () => (await plan()).partnerA?.spAmount === 11500);
await setField('Paying into ISAs monthly', 200);
await acheck('U71 Details: monthly ISA → plan', async () => (await plan()).partnerA?.monthlyIsa === 200);
// Already-accessed block (open the accordion, set both fields)
await tap('Already taken tax-free cash'); await wait(400);
await setField('Tax-free cash already taken', 165000);
await acheck('U72a Details: prior PCLS → plan', async () => (await plan()).partnerA?.pclsTaken === 165000);
await setField('Pension already accessed (crystallised)', 400000);
await acheck('U72b Details: crystallised amount → plan', async () => (await plan()).partnerA?.crystallised === 400000);
await setField('Tax-free cash already taken', 0);
await setField('Pension already accessed (crystallised)', 0);
// Advanced mode: scheme list aggregates into the plan
await p.locator('[role=switch]:has-text("Advanced")').click().catch(() => {}); await wait(350);
await acheck('U72c Details: advanced mode → plan', async () => (await plan()).advanced === true);
await tap('Add a scheme'); await wait(300);
await acheck('U72d first scheme seeds from the existing pot', async () => {
  const P = await plan(); return (P.partnerA.pots || []).length === 1 && P.partnerA.pots[0].value === P.partnerA.pension; });
await setField('Value', 250000);
await acheck('U72e scheme edit aggregates into the pension total', async () => (await plan()).partnerA?.pension === 250000);
await tap('Add a scheme'); await wait(300);
await setField('Value', 100000, 1);
await acheck('U72f two schemes sum into the pot (350k)', async () => (await plan()).partnerA?.pension === 350000);
await p.locator('[role=switch]:has-text("Advanced")').click().catch(() => {}); await wait(300);
// Structure tab: the preset wires up the whole architecture
await tap('Structure'); await wait(400);
await acheck('U72g Structure section opens', async () => (await p.locator('text=Plan structure').count()) > 0);
await tap('Set up the standard architecture'); await wait(600);
await acheck('U72h preset turns the architecture on', async () => (await plan()).architecture?.on === true);
await acheck('U72i preset uses a 7-year ladder', async () => (await plan()).architecture?.ladderYears === 7);
await acheck('U72j preset arms the written rules', async () => (await plan()).architecture?.rulesOn === true);
await p.locator('[role=switch]').first().click().catch(() => {}); await wait(400);
await acheck('U72k architecture can be switched back off', async () => (await plan()).architecture?.on === false);
await tap('People'); await wait(300);
// Carol side (second card of the same label) — proves BOTH partners' DB works
await setField('final-salary (defined benefit) pension a year', 7000, 1);
await acheck('U72 Details: Carol DB editable → plan (both partners work)', async () => (await plan()).partnerB?.db === 7000);

// core plan fields
await seg('Plan'); await wait(300);
await setField('Retire in year', 2033);
await acheck('U73 Details: retire year → plan', async () => (await plan()).retireYear === 2033);
await setField('Income you want each year', 55000);
await acheck('U74 Details: target → plan', async () => (await plan()).targetNet === 55000);
await setField('Plan through to age', 92);
await acheck('U75 Details: horizon age → plan', async () => (await plan()).horizonAge === 92);
// pcls + strategy segmented
await tap('All at once'); await wait(300);
await acheck('U76 Details: PCLS upfront → plan', async () => (await plan()).pclsMode === 'upfront');
await tap('ISAs'); await wait(300);
await acheck('U77 Details: strategy ISAs-first → plan', async () => (await plan()).strategy === 'isafirst');
// tax region segmented
await seg('Scotland');
await acheck('U77b Details: Scottish tax region → plan', async () => (await plan()).tax?.region === 'scotland');
await seg('England, Wales & NI');
await acheck('U77c Details: region back to rUK → plan', async () => (await plan()).tax?.region === 'ruk');
// Later: step-downs, inheritance, lens
await tap('Later'); await wait(400);
const p1before = (await plan()).phase1On;
await p.evaluate(() => { const s = [...document.querySelectorAll('[role=switch]')].find(x => /Ease spending/i.test(x.textContent)); s && s.click(); }); await wait(400);
await acheck('U78 Details: step-down toggle flips phase1On', async () => (await plan()).phase1On !== p1before);
await p.evaluate(() => { const s = [...document.querySelectorAll('[role=switch]')].find(x => /inheritance/i.test(x.textContent)); s && s.click(); }); await wait(300);
await acheck('U79 Details: inheritance toggle → plan', async () => (await plan()).inherit?.on === true);
await setField('Poor', 3.5);
await acheck('U80 Details: lens Poor rate → plan', async () => Math.abs((await plan()).growthBear - 0.035) < 1e-6);
await setField('Inflation', 2.5);
await acheck('U81 Details: inflation → plan', async () => Math.abs((await plan()).inflation - 0.025) < 1e-6);
// life event add + edit
await tap('Add a cost'); await wait(300);
await acheck('U82 Details: add a cost → cost event in plan', async () => ((await plan()).lifeEvents || []).some(e => e.kind === 'cost'));
await tap('Add a windfall'); await wait(300);
await acheck('U83 Details: add a windfall → income event in plan', async () => ((await plan()).lifeEvents || []).some(e => e.kind === 'income'));

// UI edits actually recompute the answer (end-to-end through the engine)
await p.keyboard.press('Escape'); await wait(500);
const hA = await p.$eval('h1', e => e.textContent).catch(() => '');
await p.$$eval('input[type=range]', els => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(els[1], '110000'); els[1].dispatchEvent(new Event('input', { bubbles: true })); els[1].dispatchEvent(new Event('change', { bubbles: true })); }); await wait(700);
const hB = await p.$eval('h1', e => e.textContent).catch(() => '');
await acheck('U84 spend slider recomputes the answer (UI→engine→UI)', async () => hA !== hB);
await acheck('U85 plan persists after edits', async () => { const P = await plan(); return P.partnerA.db === 11000 && P.partnerB.db === 7000; });

// Reload → captured DB survives (persistence of the fix)
await p.reload({ waitUntil: 'networkidle' }); await wait(800);
await acheck('U86 reload keeps Stuart DB + start year', async () => { const P = await plan(); return P.partnerA.db === 11000 && P.partnerA.dbStartYear === 2036; });
await acheck('U87 reload keeps Carol DB', async () => (await plan()).partnerB?.db === 7000);
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
check('U93 Stuart DB in captured plan raises guaranteed', metrics({ ...cp, growth: cp.growthBase }).guarTotal > metrics({ ...cp, growth: cp.growthBase, partnerA: { ...cp.partnerA, db: 0 } }).guarTotal);
check('U94 Carol DB in captured plan raises guaranteed', metrics({ ...cp, growth: cp.growthBase }).guarTotal > metrics({ ...cp, growth: cp.growthBase, partnerB: { ...cp.partnerB, db: 0 } }).guarTotal);
check('U95 later Stuart DB start reduces lifetime guaranteed vs at-retirement', (() => {
  const early = metrics({ ...cp, growth: cp.growthBase, partnerA: { ...cp.partnerA, dbStartYear: cp.retireYear } }).guarTotal;
  const late = metrics({ ...cp, growth: cp.growthBase, partnerA: { ...cp.partnerA, dbStartYear: cp.retireYear + 6 } }).guarTotal;
  return late < early - 1e-6;
})());
check('U96 indexed Stuart DB ≥ flat over the plan', metrics({ ...cp, growth: cp.growthBase }).guarTotal >= metrics({ ...cp, growth: cp.growthBase, partnerA: { ...cp.partnerA, dbIndexed: false } }).guarTotal);
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
