/**
 * RetireLens 4 test battery. Run with: node v4/tests.js
 * Part 1 asserts parity with the Marshall Retirement Model workbook.
 * Part 2 asserts engine invariants across a parameter grid.
 */
import { createEngine } from './engine.js';

const E = createEngine();
let pass = 0, fail = 0;
const failures = [];
function check(cond, label) {
  if (cond) pass++;
  else { fail++; if (failures.length < 20) failures.push(label); }
}
function near(a, b, tolPct, label) {
  const tol = Math.abs(b) * tolPct;
  check(Math.abs(a - b) <= tol, `${label}: got ${Math.round(a)}, workbook ${Math.round(b)}`);
}

console.log('RetireLens 4 tests');
console.log('==================');

// ── Part 1: workbook parity ───────────────────────────────────────────
const P = E.defaults();

// Accumulation sheet, base 7%: Stuart SIPP at Apr 2030 = 908,131
// (engine uses a year-by-year mid-year convention, tolerance 2%)
const accBase = E.accumulate(P, 0.07).atRetirement;
near(accBase.pensionA, 908131, 0.02, 'Stuart SIPP at 2030, base');
near(accBase.isaA, 61083, 0.02, 'Stuart ISA at 2030, base');
// The workbook adds one year of Carol's contribution then grows the lump.
// The engine contributes every year, which is what actually happens, so it
// lands about 8% higher. Documented divergence, wider tolerance.
near(accBase.pensionB, 60994, 0.09, 'Carol SASS at 2030, base (engine compounds contributions annually)');
near(accBase.isaB, 61790, 0.06, 'Carol ISA at 2030, base');

const accBear = E.accumulate(P, 0.04).atRetirement;
near(accBear.pensionA, 818893, 0.02, 'Stuart SIPP at 2030, bear');
const accBull = E.accumulate(P, 0.10).atRetirement;
near(accBull.pensionA, 1005093, 0.02, 'Stuart SIPP at 2030, bull');

// Mortgage at Apr 2030: 69000 minus 1000 x 48 months = 21000 remaining
near(accBase.mortgage, 21000, 0.001, 'Mortgage remaining at 2030');

// Tax Optimisation sheet single-person parity
near(E.taxOn(57548), 10451.2, 0.001, 'Tax on 57548 single person');
near(E.taxOn(77548), 18451.2, 0.001, 'Tax on 77548 single person');
near(E.taxOn(37548), 4995.6, 0.001, 'Tax on 37548 single person');

// Drawdown 2030: workbook merges the couple into one taxpayer and pays
// 11,432 of tax. The engine splits between partners so tax must be lower.
const dd = E.drawdown(P);
const y2030 = dd.rows[0];
check(y2030.year === 2030, 'first drawdown year is 2030');
check(y2030.shortfall < 1, 'target met in 2030');
// Documented divergences from the workbook, both improvements:
// 1. State pensions are today's money indexed from 2026, so Carol's SP in
//    2030 is 12548 x 1.02^4, and guaranteed income is 18,582 not 17,548.
const expectedGuaranteed = 5000 + 12548 * Math.pow(1.02, 4);
near(y2030.guaranteed, expectedGuaranteed, 0.001, 'guaranteed income 2030, SP indexed from 2026');
// 2. Tax is per partner. Compare like for like: the workbook pays 11,432 on
//    a single-taxpayer basis for its 2030 income. Push the same total income
//    through one person versus two and the split must never be worse.
{
  const totalGross = y2030.guaranteed + y2030.grossA + y2030.grossB;
  const mergedTax = E.taxOn(totalGross);
  check(y2030.tax <= mergedTax + 1,
    `per-partner tax ${Math.round(y2030.tax)} beats merged single-taxpayer ${Math.round(mergedTax)}`);
}

// Stuart state pension activates at 67
const y2037 = dd.rows.find(r => r.year === 2037);
check(y2037 && y2037.spA > 0, 'Stuart SP active by 2037');
const y2036 = dd.rows.find(r => r.year === 2036);
check(y2036 && (y2036.ageA >= P.partnerA.spAge) === (y2036.spA > 0), 'SP gate respects SP age');

// Every year meets target while wealth remains
for (const r of dd.rows) {
  check(!Number.isNaN(r.wealth), 'NaN wealth ' + r.year);
  if (r.shortfall > 1) check(r.wealth < 100, 'shortfall with wealth remaining ' + r.year);
}

// ── Part 2: engine invariants across a grid ──────────────────────────
// Tax function invariants
let prev = 0;
for (let g = 0; g <= 200000; g += 100) {
  const t = E.taxOn(g);
  check(t >= prev - 1e-9, 'tax monotonic at ' + g);
  check(E.personalAllowanceFor(g) >= 0, 'PA non-negative at ' + g);
  check(E.marginalRate(g) <= 0.601, 'marginal ceiling at ' + g);
  prev = t;
}
// grossForNet inverts taxOn
for (const base of [0, 12548, 17548, 40000]) {
  for (const net of [5000, 20000, 42452, 60000]) {
    const gross = E.grossForNet(net, base);
    const netOut = gross - (E.taxOn(base + gross) - E.taxOn(base));
    check(Math.abs(netOut - net) < 1, `grossForNet inverts at base ${base} net ${net}`);
  }
}

// Grid: growth x target x strategy x inflation x phase reductions
const growths = [0.04, 0.07, 0.10];
const targets = [40000, 60000, 80000];
const strategies = ['sippfirst', 'isafirst', 'blend'];
const inflations = [0, 0.02, 0.04];
let combos = 0;
for (const g of growths) for (const t of targets) for (const s of strategies) for (const inf of inflations) {
  const Q = E.defaults();
  Q.growth = g; Q.targetNet = t; Q.strategy = s; Q.inflation = inf;
  Q.phase1On = true; Q.phase1Age = 75; Q.phase1Cut = 0.1;
  const r = E.drawdown(Q);
  combos++;
  check(!Number.isNaN(r.lifetimeTax), `NaN tax ${g} ${t} ${s} ${inf}`);
  check(!Number.isNaN(r.endWealth), `NaN endWealth ${g} ${t} ${s} ${inf}`);
  for (const row of r.rows) {
    if (row.shortfall > 1) check(row.wealth < 100,
      `shortfall with funds: ${s} g${g} t${t} inf${inf} y${row.year}`);
    check(row.tax >= -1e-9, `negative tax ${row.year}`);
  }
  // Phase reduction really reduces the target after the phase age
  const before = r.rows.find(x => x.ageA === 74);
  const after = r.rows.find(x => x.ageA === 75);
  if (before && after && inf === 0) {
    check(after.target < before.target, `phase cut applies ${s} g${g} t${t}`);
  }
}
console.log('Grid: ' + combos + ' drawdown combinations checked.');

// Life events: a cost reduces end wealth, an invested inheritance raises it
{
  const base = E.drawdown(E.defaults()).endWealth;
  const qc = E.defaults();
  qc.lifeEvents = [{ year: 2032, label: 'New car', amount: 30000, kind: 'cost' }];
  check(E.drawdown(qc).endWealth < base, 'life event cost reduces end wealth');
  const qi = E.defaults();
  qi.lifeEvents = [{ year: 2035, label: 'Inheritance', amount: 100000, kind: 'income', invest: true }];
  check(E.drawdown(qi).endWealth > base, 'invested inheritance raises end wealth');
  const qs = E.defaults();
  qs.lifeEvents = [{ year: 2035, label: 'Inheritance', amount: 100000, kind: 'income', invest: false }];
  const spendIt = E.drawdown(qs).endWealth;
  const investIt = E.drawdown(qi).endWealth;
  check(investIt >= spendIt - 1, 'investing a windfall never ends poorer than holding it as cash');
}

// Spending plan: builder total drives the target when enabled
{
  const q = E.defaults();
  q.spendingPlanOn = true;
  const annual = E.spendingAnnual(q);
  check(Math.abs(annual - q.spending.reduce((s, r) => s + r.monthly, 0) * 12) < 0.01,
    'spending builder total is monthly x 12');
  const r = E.drawdown(q);
  check(!Number.isNaN(r.endWealth), 'spending plan drawdown runs clean');
}

// Estate: IHT never negative, pensions toggle matters after 2027
{
  const es = E.estate(E.defaults());
  check(es.iht >= 0, 'IHT non-negative');
  const q = E.defaults();
  q.iht.includePensions = false;
  const es2 = E.estate(q);
  check(es2.inScope <= es.inScope + 1, 'excluding pensions cannot raise estate in scope');
}

// Monte Carlo: deterministic under a fixed seed, probability in [0, 1]
{
  const a = E.runMonteCarlo(E.defaults(), 300, 7);
  const b = E.runMonteCarlo(E.defaults(), 300, 7);
  check(a.successProb === b.successProb, 'MC deterministic under fixed seed');
  check(a.successProb >= 0 && a.successProb <= 1, 'MC probability in range');
  check(a.confidenceAge >= 60, 'confidence age sane');
}

// Sensitivity grid runs and high withdrawal at low growth dies earliest
{
  const grid = E.sensitivityGrid(E.defaults(), [30000, 100000], [0.04, 0.10]);
  const low = grid.grid[0].cells[1].exhaustedAgeA;   // 30k at 10%
  const high = grid.grid[1].cells[0].exhaustedAgeA;  // 100k at 4%
  check(low === null || (high !== null && high <= low), 'sensitivity ordering sane');
}

// Engine assertions all pass
for (const a of E.runAssertions()) {
  check(a.pass, 'assertion: ' + a.name + ' got ' + a.got);
}

// ── Report ────────────────────────────────────────────────────────────
console.log('');
console.log('RESULT: ' + pass + ' passed, ' + fail + ' failed.');
if (failures.length) {
  console.log('First failures:');
  failures.forEach(f => console.log('  FAIL: ' + f));
  process.exit(1);
}
console.log('All parity checks and invariants held.');
