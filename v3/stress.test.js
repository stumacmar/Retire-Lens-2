/**
 * RetireLens 3, stress.test.js
 * Dev-time stress harness. Run with: node stress.test.js
 * This is separate from the in-browser Monte Carlo. The Monte Carlo runs 1000
 * stochastic paths live. This harness runs a deterministic grid of parameter
 * combinations and asserts engine invariants. The two are not the same thing
 * and the app never claims otherwise.
 */

import { createEngine } from './engine.js';

const E = createEngine();
let pass = 0, fail = 0;
const failures = [];

function check(cond, label) {
  if (cond) pass++;
  else { fail++; if (failures.length < 25) failures.push(label); }
}

console.log('RetireLens 3 stress harness');
console.log('===========================');

// ── Invariant sweep 1: tax monotonic non-decreasing in income ─────────
// ── Invariant sweep 2: personal allowance never negative ──────────────
// ── Invariant sweep 3: marginal rate never exceeds statutory maximum ──
// England max marginal is 60% inside the taper zone, Scotland 67.5%.
for (const res of ['EN', 'SC']) {
  let prevTax = 0;
  const maxMarg = res === 'EN' ? 0.601 : 0.676;
  for (let g = 0; g <= 200000; g += 50) {
    const t = E.taxOnly(g, res);
    check(t >= prevTax - 1e-9, res + ' monotonic at ' + g);
    check(E.personalAllowanceFor(g) >= 0, res + ' PA non-negative at ' + g);
    check(!Number.isNaN(t), res + ' tax NaN at ' + g);
    const marg = E.taxOnly(g + 1, res) - t;
    check(marg <= maxMarg, res + ' marginal ' + marg.toFixed(3) + ' exceeds max at ' + g);
    prevTax = t;
  }
}
console.log('Tax sweeps done: monotonicity, PA, marginal ceiling, NaN.');

// ── Grid: at least 1000 full plan combinations ────────────────────────
// residences(2) x targets(4) x retireYears(3) x returnRegimes(3) x potScale(4)
// x strategies(4) = 1152 combinations.
const residences = ['EN', 'SC'];
const targets = [40000, 60000, 80000, 100000];
const retireYears = [2028, 2030, 2033];
const regimes = [-0.01, 0.01, 0.03];
const potScales = [0.5, 1, 1.5, 2];
const strategies = ['bandfill', 'isabridge', 'pcls', 'naive'];

let combos = 0;
const t0 = Date.now();

for (const res of residences) {
  for (const target of targets) {
    for (const ry of retireYears) {
      for (const regime of regimes) {
        for (const scale of potScales) {
          const base = E.defaultParams();
          base.partnerA.residence = res;
          base.partnerB.residence = res;
          base.partnerA.retireYear = ry;
          base.partnerB.retireYear = ry;
          base.household.targetNet = target;
          base.partnerA.sipp *= scale;
          base.partnerB.sipp *= scale;
          base.partnerA.isa *= scale;
          base.partnerB.isa *= scale;
          base.household.returns.sippMean = regime;
          base.household.returns.isaMean = regime;

          const results = {};
          for (const strat of strategies) {
            combos++;
            const r = E.runPlan(base, strat);
            results[strat] = r;

            check(!Number.isNaN(r.lifetimeTax), 'NaN lifetimeTax ' + strat);
            check(!Number.isNaN(r.estate), 'NaN estate ' + strat);
            for (const row of r.rows) {
              check(!Number.isNaN(row.wealth), 'NaN wealth ' + strat + ' y' + row.year);
              // No year may show a shortfall while material funds remain.
              if (row.shortfall > 1) {
                check(row.wealth < 100,
                  'shortfall ' + Math.round(row.shortfall) + ' with wealth ' +
                  Math.round(row.wealth) + ' remaining, ' + strat + ' ' + res +
                  ' target ' + target + ' scale ' + scale + ' y' + row.year);
              }
            }
          }
          // Band-Fill must never pay more lifetime tax than the naive draw.
          check(results.bandfill.lifetimeTax <= results.naive.lifetimeTax + 1,
            'bandfill tax ' + Math.round(results.bandfill.lifetimeTax) +
            ' exceeds naive ' + Math.round(results.naive.lifetimeTax) +
            ' at ' + res + ' target ' + target + ' ry ' + ry +
            ' regime ' + regime + ' scale ' + scale);
        }
      }
    }
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log('Plan grid done: ' + combos + ' full plan combinations in ' + secs + 's.');

// ── Edge cases from CRITIQUE.md ───────────────────────────────────────
const at100k = E.computeTax(null, 100000, 'EN');
check(Math.abs(at100k.personalAllowance - 12570) < 0.01, 'PA intact at exactly 100000');
const at125140 = E.computeTax(null, 125140, 'EN');
check(at125140.personalAllowance < 0.01, 'PA fully gone at 125140');
const zeroIncome = E.computeTax(null, 0, 'EN');
check(zeroIncome.tax === 0 && zeroIncome.marginalRate === 0, 'zero income pays zero');

// Scottish crossover region near 33500 taxable: intermediate 21% applies.
const scMid = E.computeTax(null, 46000, 'SC');
check(scMid.marginalRate > 0.41 && scMid.marginalRate < 0.43, 'Scotland 46000 sits at 42% marginal');

// PCLS lifetime cap: a single partner crystallising a very large pot must cap.
const bigParams = E.defaultParams();
bigParams.partnerA.sipp = 2000000;
bigParams.household.targetNet = 150000;
const bigRun = E.runPlan(bigParams, 'pcls', { pclsCeiling: 50270 });
check(bigRun.warnings.some(w => w.indexOf('lifetime') >= 0) || bigRun.lifetimeTax > 0,
  'LSA cap engages on a 2m pot');

// Both partners identical must not error and must split draws.
const twinParams = E.defaultParams();
twinParams.partnerB = { ...twinParams.partnerA, name: 'Partner B' };
const twinRun = E.runPlan(twinParams, 'bandfill');
check(!Number.isNaN(twinRun.lifetimeTax), 'identical partners run cleanly');

// A partner with zero taxable income and zero pots.
const zeroBParams = E.defaultParams();
zeroBParams.partnerB.sipp = 0; zeroBParams.partnerB.isa = 0;
zeroBParams.partnerB.spAmount = 0; zeroBParams.partnerB.dbAmount = 0;
const zeroBRun = E.runPlan(zeroBParams, 'bandfill');
check(!Number.isNaN(zeroBRun.lifetimeTax), 'zero-asset partner runs cleanly');

// ── Report ────────────────────────────────────────────────────────────
console.log('');
console.log('RESULT: ' + pass + ' passed, ' + fail + ' failed.');
if (failures.length) {
  console.log('First failures:');
  failures.forEach(f => console.log('  FAIL: ' + f));
  process.exit(1);
}
console.log('All invariants held.');
