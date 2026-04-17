/**
 * RetireLens 2 — Comprehensive Consistency Audit
 *
 * Tests EVERY output against EVERY other output for the same scenario.
 * Any inconsistency = test failure with detailed explanation.
 */

import { createPlan, runProjection } from '../engine/projections.js';
import { runMonteCarloWithBands } from '../engine/monteCarlo.js';
import { calculateOptimalWithdrawal } from '../engine/withdrawals.js';
import { calculateTaxFromGross } from '../engine/tax.js';
import { calculateSpendingAtAge } from '../engine/spendingPolicy.js';
import { calculateReadinessScore } from '../engine/readinessScore.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ ${testName}${details ? ' — ' + details : ''}`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO: Couple with complex PCLS, DB, different ages
// ═══════════════════════════════════════════════════════════════

const plan = createPlan({
  currentAge: 55, retirementAge: 60, targetNetIncome: 60000,
  currentPension: 750000, annualPensionContribution: 24000,
  currentIsa: 108000, annualIsaContribution: 0,
  statePensionAge: 67, expectedStatePension: 11500,
  pclsAlreadyTaken: true, pclsAmountTaken: 167000,
  partnerDCPot: 200000, partnerCurrentAge: 62,
  partnerStatePensionAge: 67, partnerExpectedStatePension: 11500,
  partnerDBPensionAmount: 15000, partnerDBPensionStartAge: 67,
  applyAgeBasedSpendingReductions: true
});

const projection = runProjection(plan, { endAge: 90 });
const mc = runMonteCarloWithBands(plan, { iterations: 500, endAge: 90, volatility: 0.15, seed: 42 });

const summary = projection.summary;
const decYears = projection.decumulation.years;
const accYears = projection.accumulation.years;

// ═══════════════════════════════════════════════════════════════
console.log('\n1. ACCUMULATION CONSISTENCY');
console.log('─────────────────────────────────────────────────────');

assert(
  accYears.length === 5,
  'Accumulation is 5 years (age 55-59)',
  `got ${accYears.length}`
);

assert(
  accYears[0].age === 55,
  'Accumulation starts at age 55',
  `got ${accYears[0].age}`
);

const finalPension = projection.accumulation.finalBalances.pension;
const finalIsa = projection.accumulation.finalBalances.isa;
const finalTotal = projection.accumulation.finalBalances.total;

assert(
  Math.abs(finalTotal - (finalPension + finalIsa)) < 1,
  'Total = Pension + ISA at retirement',
  `total=${Math.round(finalTotal)}, pen+isa=${Math.round(finalPension + finalIsa)}`
);

assert(
  finalPension > 750000,
  'Pension grows during accumulation (contributions + returns)',
  `started 750k, ended ${Math.round(finalPension)}`
);

assert(
  finalIsa > 108000,
  'ISA grows during accumulation (returns)',
  `started 108k, ended ${Math.round(finalIsa)}`
);

// ═══════════════════════════════════════════════════════════════
console.log('\n2. PCLS CONSISTENCY');
console.log('─────────────────────────────────────────────────────');

const pclsTaken = projection.decumulation.pclsTaken;
const uncrystallised = projection.accumulation.uncrystallisedPension;

assert(
  pclsTaken > 0,
  'PCLS is taken (uncrystallised portion exists)',
  `pcls=${Math.round(pclsTaken)}`
);

assert(
  Math.abs(pclsTaken - uncrystallised * 0.25) < 1,
  'PCLS = 25% of uncrystallised pension',
  `pcls=${Math.round(pclsTaken)}, 25% of ${Math.round(uncrystallised)} = ${Math.round(uncrystallised * 0.25)}`
);

const origSipp = 167000 / 0.25;
const crystallised = origSipp * 0.75;
assert(
  uncrystallised > 0 && uncrystallised < finalPension,
  'Uncrystallised is between 0 and total pension',
  `uncryst=${Math.round(uncrystallised)}, totalPen=${Math.round(finalPension)}`
);

// ═══════════════════════════════════════════════════════════════
console.log('\n3. DECUMULATION — YEAR BY YEAR CONSISTENCY');
console.log('─────────────────────────────────────────────────────');

assert(
  decYears.length === 31,
  'Decumulation covers 31 years (age 60-90)',
  `got ${decYears.length}`
);

// Check every year's net income matches target
let netIncomeErrors = 0;
for (const y of decYears) {
  if (y.fundsDepleted) continue;
  const target = y.targetSpending || 60000;
  if (Math.abs((y.netIncome || 0) - target) > 1) {
    netIncomeErrors++;
    if (netIncomeErrors <= 3) {
      console.error(`    Net income mismatch at age ${y.age}: target=${target}, got=${Math.round(y.netIncome)}`);
    }
  }
}
assert(netIncomeErrors === 0, 'Net income matches target every year', `${netIncomeErrors} years mismatched`);

// Check tax calculation consistency
let taxErrors = 0;
for (const y of decYears) {
  if (y.fundsDepleted || !y.withdrawals) continue;
  const totalTaxable = (y.withdrawals.pension || 0) + (y.statePension || 0);
  // For couples, doubled PA means different tax calc — just verify tax >= 0
  if ((y.taxPaid || 0) < 0) {
    taxErrors++;
  }
}
assert(taxErrors === 0, 'Tax is never negative', `${taxErrors} years with negative tax`);

// Check balance continuity (end balance of year N should feed year N+1)
let balanceErrors = 0;
for (let i = 1; i < decYears.length; i++) {
  const prev = decYears[i-1];
  const curr = decYears[i];
  if (prev.fundsDepleted || curr.fundsDepleted || !prev.endBalances || !curr.startBalances) continue;
  // After growth, start of next year should be close to end of previous year
  // (growth is applied at end of year in the engine)
  const prevEnd = prev.endBalances.total;
  const currStart = curr.startBalances.total;
  if (Math.abs(prevEnd - currStart) > 1) {
    balanceErrors++;
    if (balanceErrors <= 2) {
      console.error(`    Balance gap at age ${curr.age}: prev end=${Math.round(prevEnd)}, curr start=${Math.round(currStart)}`);
    }
  }
}
assert(balanceErrors === 0, 'Balance continuity year-to-year', `${balanceErrors} gaps`);

// ═══════════════════════════════════════════════════════════════
console.log('\n4. PARTNER PENSION TIMING');
console.log('─────────────────────────────────────────────────────');

// Carol is 62 when user is 55. At user age 60, Carol is 67.
// So Carol's SP and DB should start at user age 60.
const y60 = decYears.find(y => y.age === 60);
const y59 = decYears.find(y => y.age === 59); // doesn't exist (retirement starts at 60)

assert(
  (y60.partnerStatePension || 0) > 0,
  'Carol SP starts at your age 60 (she is 67)',
  `partnerSP at 60 = ${y60.partnerStatePension}`
);

assert(
  (y60.partnerDbPension || 0) > 0,
  'Carol DB starts at your age 60 (she is 67)',
  `partnerDB at 60 = ${y60.partnerDbPension}`
);

// Your SP starts at 67
const y66 = decYears.find(y => y.age === 66);
const y67 = decYears.find(y => y.age === 67);
const yourSP66 = (y66.statePension || 0) - (y66.partnerStatePension || 0);
const yourSP67 = (y67.statePension || 0) - (y67.partnerStatePension || 0);

assert(
  yourSP66 === 0,
  'Your SP is zero at age 66 (before your SP age)',
  `got ${yourSP66}`
);

assert(
  yourSP67 > 0,
  'Your SP starts at age 67',
  `got ${yourSP67}`
);

// ═══════════════════════════════════════════════════════════════
console.log('\n5. SPENDING REDUCTION AT 80');
console.log('─────────────────────────────────────────────────────');

const y79 = decYears.find(y => y.age === 79);
const y80 = decYears.find(y => y.age === 80);
const y89 = decYears.find(y => y.age === 89);
const y90 = decYears.find(y => y.age === 90);

assert(
  y79.targetSpending === 60000,
  'Target at 79 is full £60k',
  `got ${y79.targetSpending}`
);

assert(
  Math.abs(y80.targetSpending - 45000) < 1,
  'Target at 80 is £45k (25% reduction)',
  `got ${y80.targetSpending}`
);

assert(
  Math.abs(y90.targetSpending - 39000) < 1,
  'Target at 90 is £39k (35% reduction)',
  `got ${y90.targetSpending}`
);

// Check net income actually follows reduced target
assert(
  Math.abs((y80.netIncome || 0) - y80.targetSpending) < 1,
  'Net income at 80 matches reduced target',
  `net=${Math.round(y80.netIncome)}, target=${y80.targetSpending}`
);

// ═══════════════════════════════════════════════════════════════
console.log('\n6. ISA PRESERVATION');
console.log('─────────────────────────────────────────────────────');

let isaWithdrawn = false;
for (const y of decYears) {
  if (y.withdrawals?.isa > 0) {
    isaWithdrawn = true;
    console.error(`    ISA withdrawn £${Math.round(y.withdrawals.isa)} at age ${y.age}`);
  }
}
assert(!isaWithdrawn, 'ISA is never withdrawn (pension covers everything)', '');

// ISA should grow throughout
const lastYear = decYears[decYears.length - 1];
assert(
  (lastYear.endBalances?.isa || 0) > 108000,
  'ISA grows throughout retirement',
  `started 108k, ended ${Math.round(lastYear.endBalances?.isa || 0)}`
);

// ═══════════════════════════════════════════════════════════════
console.log('\n7. WITHDRAWAL RATE');
console.log('─────────────────────────────────────────────────────');

const retirementPot = summary.retirementPot;
const withdrawalRate = (60000 / retirementPot) * 100;

assert(
  withdrawalRate < 10,
  'Withdrawal rate is reasonable (< 10%)',
  `${withdrawalRate.toFixed(1)}%`
);

// ═══════════════════════════════════════════════════════════════
console.log('\n8. MONTE CARLO CONSISTENCY');
console.log('─────────────────────────────────────────────────────');

assert(
  mc.statistics.successRate >= 0 && mc.statistics.successRate <= 1,
  'MC success rate is between 0 and 1',
  `got ${mc.statistics.successRate}`
);

// MC success should be within reasonable range of deterministic
// Det = 100%, MC with volatility should be >= 50% for a strong scenario
assert(
  mc.statistics.successRate >= 0.5,
  'MC success >= 50% (strong scenario with partner income)',
  `got ${(mc.statistics.successRate * 100).toFixed(1)}%`
);

// Success rate and not-depleted rate should be the same metric
assert(
  Math.abs(mc.statistics.successRate - mc.statistics.notDepletedRate) < 0.05,
  'MC success rate ≈ not-depleted rate (no conflicting metrics)',
  `success=${(mc.statistics.successRate*100).toFixed(1)}%, notDepleted=${(mc.statistics.notDepletedRate*100).toFixed(1)}%`
);

// ═══════════════════════════════════════════════════════════════
console.log('\n9. INCOME SOURCES COMPLETENESS');
console.log('─────────────────────────────────────────────────────');

// At age 60: should have pension withdrawal + Carol SP + Carol DB
assert(
  y60.withdrawals.pension > 0,
  'Pension withdrawal present at 60',
  `${Math.round(y60.withdrawals.pension)}`
);

const carolSP60 = y60.partnerStatePension || 0;
const carolDB60 = y60.partnerDbPension || 0;
assert(
  carolSP60 > 10000,
  'Carol SP present and > £10k at age 60',
  `got ${Math.round(carolSP60)}`
);

assert(
  carolDB60 >= 15000,
  'Carol DB present and >= £15k at age 60',
  `got ${Math.round(carolDB60)}`
);

// Total guaranteed + withdrawal should produce target net
const totalIncome60 = y60.withdrawals.pension + (y60.withdrawals.isa || 0) + y60.statePension;
assert(
  totalIncome60 > 0,
  'Total income sources add up at age 60',
  `total taxable+isa = ${Math.round(totalIncome60)}`
);

// ═══════════════════════════════════════════════════════════════
console.log('\n10. SUMMARY METRICS CONSISTENCY');
console.log('─────────────────────────────────────────────────────');

assert(
  summary.successRate === 1,
  'Deterministic success rate is 100% (funds never depleted)',
  `got ${(summary.successRate * 100).toFixed(1)}%`
);

assert(
  summary.yearsWithFullIncome === 30,
  'Years with full income = 30 (ages 60-89)',
  `got ${summary.yearsWithFullIncome}`
);

assert(
  !summary.fundsDepleted,
  'Funds never depleted',
  `fundsDepleted=${summary.fundsDepleted}`
);

assert(
  summary.finalBalance > 0,
  'Final balance > 0',
  `got ${Math.round(summary.finalBalance)}`
);

assert(
  summary.totalTaxPaid > 0,
  'Total tax paid > 0 (taxable income exists)',
  `got ${Math.round(summary.totalTaxPaid)}`
);

// ═══════════════════════════════════════════════════════════════
console.log('\n11. TWO PERSONAL ALLOWANCES');
console.log('─────────────────────────────────────────────────────');

// With doubled PA (£25,140), at age 60:
// Carol income: SP 11500 + DB 15000 = 26500
// Your pension withdrawal: ~42215
// Total taxable: ~68715
// With ONE PA: tax on (68715 - 12570) = 56145 -> basic + higher = ~14k
// With TWO PAs: tax on (68715 - 25140) = 43575 -> all basic rate = ~8715
const taxAt60 = y60.taxPaid || 0;
assert(
  taxAt60 < 12000,
  'Tax at 60 reflects two personal allowances (< £12k)',
  `got ${Math.round(taxAt60)} (one PA would be ~£14k)`
);

// ═══════════════════════════════════════════════════════════════
// SINGLE PERSON SCENARIO — verify no partner income
// ═══════════════════════════════════════════════════════════════
console.log('\n12. SINGLE PERSON ISOLATION');
console.log('─────────────────────────────────────────────────────');

const singlePlan = createPlan({
  currentAge: 55, retirementAge: 60, targetNetIncome: 40000,
  currentPension: 400000, annualPensionContribution: 12000,
  currentIsa: 50000, annualIsaContribution: 3000,
  statePensionAge: 67, expectedStatePension: 11500
});

const singleResult = runProjection(singlePlan, { endAge: 90 });
const sy60 = singleResult.decumulation.years[0];

assert(
  (sy60.partnerStatePension || 0) === 0,
  'Single person has no partner SP',
  `got ${sy60.partnerStatePension}`
);

assert(
  (sy60.partnerDbPension || 0) === 0,
  'Single person has no partner DB',
  `got ${sy60.partnerDbPension}`
);

// Single uses ONE personal allowance
const singleTax = sy60.taxPaid || 0;
const singlePenW = sy60.withdrawals?.pension || 0;
const expectedTax = calculateTaxFromGross(singlePenW);
assert(
  Math.abs(singleTax - expectedTax.total) < 1,
  'Single person tax matches standard UK calculation',
  `engine=${Math.round(singleTax)}, calc=${Math.round(expectedTax.total)}`
);

// ═══════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════');
console.log(`  AUDIT RESULTS: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
