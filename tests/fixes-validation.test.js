/**
 * RetireLens 2 - Validation Tests for Bug Fixes
 * 
 * Tests verifying fixes for bugs A-G from the issue tracker:
 * D) Monte Carlo vol=0 must match deterministic exactly
 * E) Sequence-of-returns "good start" must beat "bad start"  
 * G) Tax: personal allowance and PCLS 25% tax-free handled correctly
 * 
 * Also validates the pension-types validation fix and createHousehold fix.
 */

import { createPlan, runProjection, comparePlans } from '../engine/projections.js';
import { runMonteCarloWithBands, illustrateSequenceOfReturns, runSingleSimulation, generateReturnSequence } from '../engine/monteCarlo.js';
import { calculateOptimalWithdrawal, calculatePCLS } from '../engine/withdrawals.js';
import { calculateTaxFromGross } from '../engine/tax.js';
import { createHousehold, createPerson } from '../engine/household.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ ${testName}${details ? ' - ' + details : ''}`);
    failed++;
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('  BUG FIX VALIDATION TESTS');
console.log('═══════════════════════════════════════════════════════════════');

// ═══════════════════════════════════════════════════════════════
// Bug D: Monte Carlo vol=0 must match deterministic exactly
// ═══════════════════════════════════════════════════════════════

console.log('\nBUG D: Monte Carlo vol=0 Invariant');
console.log('─────────────────────────────────────────────────────────────────');

// Test 1: Low-income scenario (no tax impact)
const plan1 = createPlan({
  currentAge: 60, retirementAge: 65, targetNetIncome: 10000,
  currentPension: 100000, currentIsa: 50000,
  annualPensionContribution: 5000, annualIsaContribution: 2000,
  expectedStatePension: 11500, statePensionAge: 67
});

const det1 = runProjection(plan1, { endAge: 90 });
const mc1 = runMonteCarloWithBands(plan1, { iterations: 10, endAge: 90, volatility: 0, seed: 42 });

assert(
  Math.abs(det1.summary.finalBalance - mc1.statistics.finalBalance.mean) < 1,
  'MC vol=0 matches deterministic (low-income, no tax)',
  `det=${Math.round(det1.summary.finalBalance)}, mc=${Math.round(mc1.statistics.finalBalance.mean)}`
);

// Test 2: Higher-income scenario (with tax)
const plan2 = createPlan({
  currentAge: 45, retirementAge: 65, targetNetIncome: 30000,
  currentPension: 200000, currentIsa: 50000,
  annualPensionContribution: 10000, annualIsaContribution: 5000,
  expectedStatePension: 11500, statePensionAge: 67
});

const det2 = runProjection(plan2, { endAge: 90 });
const mc2 = runMonteCarloWithBands(plan2, { iterations: 10, endAge: 90, volatility: 0, seed: 42 });

assert(
  Math.abs(det2.summary.finalBalance - mc2.statistics.finalBalance.mean) < 1,
  'MC vol=0 matches deterministic (higher-income, with tax)',
  `det=${Math.round(det2.summary.finalBalance)}, mc=${Math.round(mc2.statistics.finalBalance.mean)}`
);

// Test 3: Mid-career professional  
const plan3 = createPlan({
  currentAge: 45, retirementAge: 60, targetNetIncome: 35000,
  currentPension: 180000, currentIsa: 50000,
  annualPensionContribution: 15000, annualIsaContribution: 5000,
  expectedStatePension: 11500, statePensionAge: 67
});

const det3 = runProjection(plan3, { endAge: 90 });
const mc3 = runMonteCarloWithBands(plan3, { iterations: 10, endAge: 90, volatility: 0, seed: 42 });

assert(
  Math.abs(det3.summary.finalBalance - mc3.statistics.finalBalance.mean) < 1,
  'MC vol=0 matches deterministic (mid-career professional)',
  `det=${Math.round(det3.summary.finalBalance)}, mc=${Math.round(mc3.statistics.finalBalance.mean)}`
);

// Test 4: MC with vol>0 mean should be statistically close to deterministic
const mc4 = runMonteCarloWithBands(plan2, { iterations: 500, endAge: 90, volatility: 0.15, seed: 42 });
const tolerance = det2.summary.finalBalance * 0.20; // 20% tolerance for mean with vol
assert(
  Math.abs(det2.summary.finalBalance - mc4.statistics.finalBalance.mean) < tolerance,
  'MC vol>0 mean is within 20% of deterministic',
  `det=${Math.round(det2.summary.finalBalance)}, mc_mean=${Math.round(mc4.statistics.finalBalance.mean)}`
);

// Test 5: No absurd runaway - p90 should not exceed 10x the deterministic
assert(
  mc4.statistics.finalBalance.p90 < det2.summary.retirementPot * 10,
  'MC p90 is not absurdly high (no runaway)',
  `p90=${Math.round(mc4.statistics.finalBalance.p90)}, threshold=${Math.round(det2.summary.retirementPot * 10)}`
);

// ═══════════════════════════════════════════════════════════════
// Bug E: Sequence-of-returns ordering
// ═══════════════════════════════════════════════════════════════

console.log('\nBUG E: Sequence-of-Returns Ordering');
console.log('─────────────────────────────────────────────────────────────────');

const sorResult = illustrateSequenceOfReturns(plan2);

assert(
  sorResult.orderingCorrect,
  'Good start final balance >= bad start final balance',
  `good=${Math.round(sorResult.goodStart.finalBalance)}, bad=${Math.round(sorResult.badStart.finalBalance)}`
);

assert(
  sorResult.goodStart.finalBalance > sorResult.average.finalBalance,
  'Good start > average (with withdrawals)',
  `good=${Math.round(sorResult.goodStart.finalBalance)}, avg=${Math.round(sorResult.average.finalBalance)}`
);

assert(
  sorResult.badStart.finalBalance < sorResult.average.finalBalance,
  'Bad start < average (with withdrawals)',
  `bad=${Math.round(sorResult.badStart.finalBalance)}, avg=${Math.round(sorResult.average.finalBalance)}`
);

// Verify returns are the same set just reordered
const goodSorted = [...sorResult.goodStart.returns].sort((a, b) => a - b);
const badSorted = [...sorResult.badStart.returns].sort((a, b) => a - b);
const sameReturns = goodSorted.every((v, i) => Math.abs(v - badSorted[i]) < 1e-10);
assert(sameReturns, 'Good and bad start use the same returns in different order');

// Verify "good start" has highest returns first
assert(
  sorResult.goodStart.returns[0] >= sorResult.goodStart.returns[sorResult.goodStart.returns.length - 1],
  'Good start returns are sorted descending (high first)'
);

// Verify "bad start" has lowest returns first
assert(
  sorResult.badStart.returns[0] <= sorResult.badStart.returns[sorResult.badStart.returns.length - 1],
  'Bad start returns are sorted ascending (low first)'
);

// ═══════════════════════════════════════════════════════════════
// Bug G: UK Tax - Personal Allowance and PCLS
// ═══════════════════════════════════════════════════════════════

console.log('\nBUG G: UK Tax Correctness');
console.log('─────────────────────────────────────────────────────────────────');

// Personal allowance: no tax on income below £12,570
const taxPA = calculateTaxFromGross(12570);
assert(taxPA.total === 0, 'No tax on income at personal allowance (£12,570)');

// Basic rate: 20% on income £12,571-£50,270
const taxBasic = calculateTaxFromGross(30000);
assert(
  Math.abs(taxBasic.total - (30000 - 12570) * 0.20) < 1,
  'Basic rate tax correct on £30,000 income',
  `expected=${(30000 - 12570) * 0.20}, actual=${taxBasic.total}`
);

// Higher rate: 40% on income above £50,270
const taxHigher = calculateTaxFromGross(60000);
const expectedHigherTax = (50270 - 12570) * 0.20 + (60000 - 50270) * 0.40;
assert(
  Math.abs(taxHigher.total - expectedHigherTax) < 1,
  'Higher rate tax correct on £60,000 income',
  `expected=${expectedHigherTax}, actual=${taxHigher.total}`
);

// PCLS: 25% tax-free lump sum
const pcls = calculatePCLS(400000);
assert(pcls.taxFreeCash === 100000, 'PCLS is 25% of pension value');
assert(pcls.remainingPension === 300000, 'Remaining pension is 75% after PCLS');

// Optimal withdrawal uses pension before ISA (preserves ISA)
const withdrawal = calculateOptimalWithdrawal(20000, { pension: 200000, isa: 100000 }, {
  statePensionIncome: 0
});
assert(
  withdrawal.withdrawals.pension > 0,
  'Optimal withdrawal uses pension first to fill personal allowance'
);
assert(
  withdrawal.withdrawals.pension >= 12570,
  'Pension covers at least the personal allowance before ISA is touched'
);

// ═══════════════════════════════════════════════════════════════
// createHousehold fix validation
// ═══════════════════════════════════════════════════════════════

console.log('\ncreateHousehold Field Name Fix');
console.log('─────────────────────────────────────────────────────────────────');

// Should work with currentAge (not just age)
try {
  const household = createHousehold({
    person1: { currentAge: 45, retirementAge: 65 },
    person2: null
  });
  assert(true, 'createHousehold works with currentAge field');
} catch (e) {
  assert(false, 'createHousehold works with currentAge field', e.message);
}

// Should work with couples
try {
  const household = createHousehold({
    type: 'couple',
    person1: { currentAge: 45, retirementAge: 65 },
    person2: { currentAge: 42, retirementAge: 62 }
  });
  assert(household.type === 'couple', 'createHousehold creates couple household');
} catch (e) {
  assert(false, 'createHousehold creates couple household', e.message);
}

// ═══════════════════════════════════════════════════════════════
// Contribution periodicity sanity
// ═══════════════════════════════════════════════════════════════

console.log('\nContribution Periodicity Sanity');
console.log('─────────────────────────────────────────────────────────────────');

const planContrib = createPlan({
  currentAge: 50, retirementAge: 60, targetNetIncome: 20000,
  currentPension: 100000, currentIsa: 0,
  annualPensionContribution: 12000, annualIsaContribution: 0,
  expectedStatePension: 11500, statePensionAge: 67
});

const projContrib = runProjection(planContrib, { endAge: 60 });
// After 10 years of £12,000/yr contributions on £100,000 at ~3.5% net growth:
// Each year: balance * 1.035 + 12000
// Year 1: 100000*1.035 + 12000 = 115500
// Simple estimate: ~£248k (compound growth)
const retPot = projContrib.summary.retirementPot;
assert(
  retPot > 200000 && retPot < 350000,
  'Retirement pot is in reasonable range for £12k/yr contributions over 10 years',
  `actual=${Math.round(retPot)}`
);

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
}
