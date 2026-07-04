/**
 * RetireLens 4 test battery. Run with: node v4/tests.js
 * Part 1 asserts parity with the Marshall Retirement Model workbook.
 * Part 2 asserts engine invariants across a parameter grid.
 * Part 3 asserts regressions found by the adversarial audit stay fixed.
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
  check(Math.abs(a - b) <= tol, `${label}: got ${Math.round(a)}, expected ${Math.round(b)}`);
}

console.log('RetireLens 4 tests');
console.log('==================');

// ── Part 1: workbook parity ───────────────────────────────────────────
const P = E.defaults();

const accBase = E.accumulate(P, 0.07).atRetirement;
near(accBase.pensionA, 908131, 0.02, 'Stuart SIPP at 2030, base');
near(accBase.isaA, 61083, 0.02, 'Stuart ISA at 2030, base');
// The workbook adds one year of Carol's contribution then grows the lump;
// the engine contributes every year. Documented divergence, wider tolerance.
near(accBase.pensionB, 60994, 0.09, 'Carol SASS at 2030 (engine compounds contributions annually)');
near(accBase.isaB, 61790, 0.06, 'Carol ISA at 2030, base');
const accBear = E.accumulate(P, 0.04).atRetirement;
near(accBear.pensionA, 818893, 0.02, 'Stuart SIPP at 2030, bear');
const accBull = E.accumulate(P, 0.10).atRetirement;
near(accBull.pensionA, 1005093, 0.02, 'Stuart SIPP at 2030, bull');
near(accBase.mortgage, 21000, 0.001, 'Mortgage remaining at 2030');

near(E.taxOn(57548), 10451.2, 0.001, 'Tax on 57548 single person');
near(E.taxOn(77548), 18451.2, 0.001, 'Tax on 77548 single person');
near(E.taxOn(37548), 4995.6, 0.001, 'Tax on 37548 single person');

const dd = E.drawdown(P);
const y2030 = dd.rows[0];
check(y2030.year === 2030, 'first drawdown year is 2030');
check(y2030.shortfall < 1, 'target met in 2030');
const expectedGuaranteed = 5000 + 12548 * Math.pow(1.02, 4);
near(y2030.guaranteed, expectedGuaranteed, 0.001, 'guaranteed income 2030, SP indexed from 2026');

// ── Part 2: engine invariants ─────────────────────────────────────────
let prev = 0;
for (let g = 0; g <= 200000; g += 100) {
  const t = E.taxOn(g);
  check(t >= prev - 1e-9, 'tax monotonic at ' + g);
  check(E.personalAllowanceFor(g) >= 0, 'PA non-negative at ' + g);
  check(E.marginalRate(g) <= 0.601, 'marginal ceiling at ' + g);
  prev = t;
}
for (const base of [0, 12548, 17548, 40000]) {
  for (const net of [5000, 20000, 42452, 60000]) {
    const gross = E.grossForNet(net, base);
    const netOut = gross - (E.taxOn(base + gross) - E.taxOn(base));
    check(Math.abs(netOut - net) < 1, `grossForNet inverts at base ${base} net ${net}`);
  }
}

const growths = [0.04, 0.07, 0.10];
const targets = [40000, 60000, 80000];
const strategies = ['sippfirst', 'isafirst', 'pafirst'];
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
    // The allocator must never take a taxed pension draw from one partner
    // while the other still has unused personal allowance and pot remaining.
    // Guaranteed income above the allowance is taxed regardless and does not
    // count against the allocator.
    const gA = row.spA + row.dbA + row.grossA, gB = row.spB + row.dbB + row.grossB;
    const paFreeA = gA < Q.tax.personalAllowance - 1 && row.potA > 100;
    const paFreeB = gB < Q.tax.personalAllowance - 1 && row.potB > 100;
    if (row.grossB > 1 && row.marginalB > 0.01) check(!paFreeA, `taxed draw from B while A allowance free ${s} g${g} t${t} y${row.year}`);
    if (row.grossA > 1 && row.marginalA > 0.01) check(!paFreeB, `taxed draw from A while B allowance free ${s} g${g} t${t} y${row.year}`);
  }
  const before = r.rows.find(x => x.ageA === 74);
  const after = r.rows.find(x => x.ageA === 75);
  if (before && after && inf === 0) {
    check(after.target < before.target, `phase cut applies ${s} g${g} t${t}`);
  }
}
console.log('Grid: ' + combos + ' drawdown combinations checked.');

// ── Part 3: audit regressions ─────────────────────────────────────────

// 3.1 Allowance-first allocation: year one tax must beat both the merged
// single-person figure and the old serve-B-first figure of 9,951.
{
  const merged = E.taxOn(y2030.guaranteed + y2030.grossA + y2030.grossB);
  check(y2030.tax <= merged + 1, `per-partner ${Math.round(y2030.tax)} beats merged ${Math.round(merged)}`);
  // Stuart has no base income in 2030, so his allowance must be in use
  check(y2030.grossA >= 12000, 'Stuart allowance actually used in 2030, drew ' + Math.round(y2030.grossA));
  // Large need, no mortgage: the historical optimum for this need is 9,951
  // (both allowances used, remainder at 20%). Must not regress above it.
  const Qnm = E.defaults(); Qnm.mortgage = 0;
  const ynm = E.drawdown(Qnm).rows[0];
  check(ynm.tax <= 9951.5, `large-need optimum held: ${Math.round(ynm.tax)} <= 9951`);
  // Low need: everything should fit inside Stuart's free allowance, so the
  // only tax is on Carol's guaranteed income. The old serve-B-first order
  // paid 20% on this. This is the audit's key allocation regression.
  const Qlow = E.defaults(); Qlow.mortgage = 0; Qlow.targetNet = 30000;
  const ylow = E.drawdown(Qlow).rows[0];
  const carolBaseTax = E.taxOn(ylow.spB + ylow.dbB);
  // Optimal tax for this year: Carol's base tax, plus 20% on the grossed-up
  // net need beyond Stuart's free allowance (net x 0.25). The old
  // serve-B-first order paid 20% on the whole draw instead.
  const needLow = ylow.target - (ylow.guaranteed - carolBaseTax);
  const optimal = carolBaseTax + Math.max(0, needLow - 12570) * 0.25;
  check(Math.abs(ylow.tax - optimal) < 2,
    `low need at optimum: tax ${Math.round(ylow.tax)} vs optimal ${Math.round(optimal)}`);
  check(ylow.grossA >= 12570 - 1, 'Stuart free allowance fully used at low need');
}

// 3.2 Mortgage: paid from cash flow at nominal value until cleared, and
// absent from the spending builder.
{
  check(!E.defaults().spending.some(s => s.key === 'mortgage'), 'no mortgage line in spending builder');
  check(y2030.mortgagePay === 12000, '2030 pays 12000 of mortgage, got ' + y2030.mortgagePay);
  const y2031 = dd.rows[1];
  check(y2031.mortgagePay === 9000, '2031 pays the final 9000, got ' + y2031.mortgagePay);
  const y2032 = dd.rows[2];
  check(y2032.mortgagePay === 0 && y2032.mortgageLeft === 0, 'mortgage gone by 2032');
  const total = dd.rows.reduce((s, r) => s + r.mortgagePay, 0);
  check(Math.abs(total - 21000) < 1, 'total retirement mortgage payments equal the 2030 balance');
}

// 3.3 Life events and inheritance are today's money, indexed to the year.
{
  const Q = E.defaults();
  Q.lifeEvents = [{ year: 2050, label: 'New car', amount: 25000, kind: 'cost' }];
  const r = E.drawdown(Q).rows.find(x => x.year === 2050);
  near(r.eventCost, 25000 * Math.pow(1.02, 24), 0.001, '2050 event cost indexed');
  const Qi = E.defaults();
  Qi.inherit = { on: true, year: 2035, amount: 100000, invest: true };
  const ri = E.drawdown(Qi);
  const row35 = ri.rows.find(x => x.year === 2035);
  near(row35.eventInflow, 100000 * Math.pow(1.02, 9), 0.001, 'inheritance indexed to 2035');
  check(ri.endWealth > dd.endWealth, 'invested inheritance raises end wealth');
  const Qs = JSON.parse(JSON.stringify(Qi)); Qs.inherit.invest = false;
  check(E.drawdown(Qi).endWealth >= E.drawdown(Qs).endWealth - 1,
    'investing the inheritance never ends poorer');
}

// 3.4 Upfront PCLS proceeds keep compounding rather than sitting in cash.
{
  const Qu = E.defaults(); Qu.pclsMode = 'upfront';
  const Qn = E.defaults(); Qn.pclsMode = 'none';
  const ru = E.drawdown(Qu), rn = E.drawdown(Qn);
  // With compounding proceeds the upfront mode should not catastrophically
  // trail the no-PCLS mode (the old cash-at-zero bug cost hundreds of
  // thousands). Allow a modest gap for tax-ordering effects.
  check(ru.endWealth > rn.endWealth * 0.85,
    `upfront PCLS compounds: ${Math.round(ru.endWealth)} vs none ${Math.round(rn.endWealth)}`);
}

// 3.5 Strategies are genuinely distinct.
{
  const cmp = E.compareStrategies(E.defaults());
  const taxes = cmp.map(c => Math.round(c.lifetimeTax));
  check(new Set(taxes).size >= 2, 'strategies produce distinct lifetime tax: ' + taxes.join(','));
}

// 3.6 Monte Carlo mirrors the deterministic model: zero volatility with the
// mean equal to growth must succeed on every path when the plan survives.
{
  const Q = E.defaults(); Q.mcSd = 0; Q.mcMean = Q.growth;
  const mc = E.runMonteCarlo(Q, 50, 7);
  check(mc.successProb === 1, 'MC with zero volatility fully succeeds, got ' + mc.successProb);
  check(mc.confidenceAge === Q.horizonAge, 'confidence age is the horizon age when never below threshold, got ' + mc.confidenceAge);
  const a = E.runMonteCarlo(E.defaults(), 200, 7);
  const b = E.runMonteCarlo(E.defaults(), 200, 7);
  check(a.successProb === b.successProb, 'MC deterministic under fixed seed');
}

// 3.7 Estate: RNRB tapers away above 2m.
{
  const es = E.estate(E.defaults());
  check(es.inScope > 2000000 ? es.rnrb < es.rnrbFull : true, 'RNRB tapered for large estate');
  if (es.inScope > 2000000 + 2 * es.rnrbFull) {
    check(es.rnrb === 0, 'RNRB fully gone far above 2m');
  }
  const small = E.defaults();
  small.house = 200000; small.partnerA.pension = 50000; small.partnerB.pension = 10000;
  small.partnerA.isa = 10000; small.partnerB.isa = 10000; small.partnerA.monthlyPension = 0;
  const esSmall = E.estate(small);
  check(esSmall.rnrb === esSmall.rnrbFull || esSmall.inScope > 2000000, 'RNRB intact for small estate');
  check(es.iht >= 0, 'IHT non-negative');
}

// 3.8 Stress tests compare in today's money and include a single crash entry.
{
  const st = E.stressTests(E.defaults());
  const crash = st.tests.filter(t => t.label.indexOf('crash') >= 0);
  check(crash.length === 1, 'exactly one crash scenario');
  check(crash[0].delta < 0, 'crash reduces real end wealth');
  const infl4 = st.tests.find(t => t.label.indexOf('Inflation') >= 0);
  check(infl4.delta < 0, 'higher inflation reduces real end wealth');
}

// 3.9 Tornado and lifetime totals are coherent.
{
  const t = E.tornado(E.defaults());
  check(t.bars.length >= 5, 'tornado has bars');
  const growthBar = t.bars.find(b => b.label.indexOf('Growth') >= 0);
  check(growthBar.up > 0 && growthBar.down < 0, 'growth bar signs correct');
  const lt = E.lifetimeTotals(E.defaults());
  check(lt.spend > 0 && lt.tax > 0 && lt.growthInRetirement > 0, 'lifetime totals positive');
  check(lt.taxPer100Drawn > 0 && lt.taxPer100Drawn < 45, 'tax per 100 drawn sane: ' + lt.taxPer100Drawn.toFixed(1));
  near(lt.mortgage, 21000, 0.001, 'lifetime mortgage payments');
}

// 3.10 Spending builder drives the target when enabled; total excludes mortgage.
{
  const q = E.defaults();
  q.spendingPlanOn = true;
  const annual = E.spendingAnnual(q);
  check(Math.abs(annual - q.spending.reduce((s, r) => s + r.monthly, 0) * 12) < 0.01,
    'spending builder total is monthly x 12');
  const r = E.drawdown(q);
  check(!Number.isNaN(r.endWealth), 'spending plan drawdown runs clean');
}

// 3.11 Pre-retirement unfunded life event raises a warning.
{
  const q = E.defaults();
  q.lifeEvents = [{ year: 2027, label: 'Huge cost', amount: 500000, kind: 'cost' }];
  const acc = E.accumulate(q);
  check(acc.warnings.length > 0, 'unfunded pre-retirement event warns');
}

// ── Report ────────────────────────────────────────────────────────────
console.log('');
console.log('RESULT: ' + pass + ' passed, ' + fail + ' failed.');
if (failures.length) {
  console.log('First failures:');
  failures.forEach(f => console.log('  FAIL: ' + f));
  process.exit(1);
}
console.log('All parity checks, invariants and audit regressions held.');
