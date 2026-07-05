/**
 * RetireLens 2 - 100 Scenario Stress Test
 *
 * Runs 100 diverse scenarios across the engine to find edge cases and bugs.
 * Tests: projections, tax, withdrawals, Monte Carlo, household, spending rules.
 */

import { createPlan, runProjection, comparePlans, canIRetire } from '../engine/projections.js';
import { runMonteCarlo, runMonteCarloWithBands, runSingleSimulation, generateReturnSequence } from '../engine/monteCarlo.js';
import { calculateOptimalWithdrawal, calculatePCLS, calculatePCLSStrategy, calculateSustainableWithdrawal } from '../engine/withdrawals.js';
import { calculateTaxFromGross, calculateGrossFromNet, computeUKTax, calculateCouplesTax, getMarginalRate } from '../engine/tax.js';
import { createHousehold, createPerson } from '../engine/household.js';
import { createHouseholdPlan, projectHousehold, validateHouseholdPlan } from '../engine/householdPlan.js';
import { createSpendingRules, calculateSpendingAtAge } from '../engine/spendingPolicy.js';
import { TAX_CONFIG, PENSION_CONFIG, createAssumptions } from '../config/defaults.js';

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passed++;
  } else {
    failed++;
    const msg = `FAIL: ${testName}${details ? ' - ' + details : ''}`;
    errors.push(msg);
    console.error(`  ✗ ${testName}${details ? ' - ' + details : ''}`);
  }
}

function isFiniteNumber(v) {
  return typeof v === 'number' && isFinite(v) && !isNaN(v);
}

function isNonNegative(v) {
  return isFiniteNumber(v) && v >= 0;
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('  100-SCENARIO STRESS TEST');
console.log('═══════════════════════════════════════════════════════════════\n');

// ─── CATEGORY 1: Projection engine across diverse inputs (40 scenarios) ───

console.log('CATEGORY 1: Projection Engine (40 scenarios)');
console.log('─────────────────────────────────────────────────────────────────');

const projectionScenarios = [
  { label: 'Young saver, low income', currentAge: 25, retirementAge: 65, targetNetIncome: 15000, currentPension: 5000, currentIsa: 1000, annualPensionContribution: 3000, annualIsaContribution: 1000, expectedStatePension: 11500 },
  { label: 'Young saver, high income', currentAge: 25, retirementAge: 60, targetNetIncome: 50000, currentPension: 20000, currentIsa: 10000, annualPensionContribution: 20000, annualIsaContribution: 10000, expectedStatePension: 11500 },
  { label: 'Mid-career moderate', currentAge: 40, retirementAge: 65, targetNetIncome: 25000, currentPension: 100000, currentIsa: 30000, annualPensionContribution: 8000, annualIsaContribution: 3000, expectedStatePension: 11500 },
  { label: 'Mid-career aggressive', currentAge: 40, retirementAge: 55, targetNetIncome: 40000, currentPension: 250000, currentIsa: 80000, annualPensionContribution: 20000, annualIsaContribution: 10000, expectedStatePension: 11500 },
  { label: 'Late starter', currentAge: 50, retirementAge: 68, targetNetIncome: 20000, currentPension: 50000, currentIsa: 5000, annualPensionContribution: 10000, annualIsaContribution: 2000, expectedStatePension: 11500 },
  { label: 'Near retirement', currentAge: 60, retirementAge: 65, targetNetIncome: 30000, currentPension: 400000, currentIsa: 50000, annualPensionContribution: 5000, annualIsaContribution: 2000, expectedStatePension: 11500 },
  { label: 'Already at retirement age', currentAge: 65, retirementAge: 66, targetNetIncome: 20000, currentPension: 300000, currentIsa: 40000, annualPensionContribution: 0, annualIsaContribution: 0, expectedStatePension: 11500 },
  { label: 'Minimal pension', currentAge: 55, retirementAge: 67, targetNetIncome: 12000, currentPension: 10000, currentIsa: 0, annualPensionContribution: 500, annualIsaContribution: 0, expectedStatePension: 11500 },
  { label: 'Large pension pot', currentAge: 50, retirementAge: 60, targetNetIncome: 60000, currentPension: 1000000, currentIsa: 200000, annualPensionContribution: 40000, annualIsaContribution: 20000, expectedStatePension: 11500 },
  { label: 'ISA only', currentAge: 45, retirementAge: 65, targetNetIncome: 15000, currentPension: 0, currentIsa: 100000, annualPensionContribution: 0, annualIsaContribution: 10000, expectedStatePension: 11500 },
  { label: 'Pension only', currentAge: 45, retirementAge: 65, targetNetIncome: 20000, currentPension: 150000, currentIsa: 0, annualPensionContribution: 10000, annualIsaContribution: 0, expectedStatePension: 11500 },
  { label: 'Zero contributions', currentAge: 55, retirementAge: 65, targetNetIncome: 15000, currentPension: 200000, currentIsa: 50000, annualPensionContribution: 0, annualIsaContribution: 0, expectedStatePension: 11500 },
  { label: 'Very early retirement', currentAge: 30, retirementAge: 45, targetNetIncome: 20000, currentPension: 100000, currentIsa: 100000, annualPensionContribution: 15000, annualIsaContribution: 15000, expectedStatePension: 11500 },
  { label: 'Very late retirement', currentAge: 60, retirementAge: 70, targetNetIncome: 25000, currentPension: 500000, currentIsa: 100000, annualPensionContribution: 10000, annualIsaContribution: 5000, expectedStatePension: 11500 },
  { label: 'No state pension', currentAge: 50, retirementAge: 65, targetNetIncome: 30000, currentPension: 300000, currentIsa: 50000, annualPensionContribution: 10000, annualIsaContribution: 5000, expectedStatePension: 0 },
  { label: 'Full state pension only', currentAge: 60, retirementAge: 67, targetNetIncome: 11500, currentPension: 0, currentIsa: 0, annualPensionContribution: 0, annualIsaContribution: 0, expectedStatePension: 11500 },
  { label: 'High target income', currentAge: 45, retirementAge: 60, targetNetIncome: 80000, currentPension: 500000, currentIsa: 200000, annualPensionContribution: 30000, annualIsaContribution: 15000, expectedStatePension: 11500 },
  { label: 'Low target income', currentAge: 55, retirementAge: 65, targetNetIncome: 5000, currentPension: 50000, currentIsa: 10000, annualPensionContribution: 2000, annualIsaContribution: 500, expectedStatePension: 11500 },
  { label: 'DB pension holder', currentAge: 50, retirementAge: 65, targetNetIncome: 25000, currentPension: 100000, currentIsa: 20000, annualPensionContribution: 5000, annualIsaContribution: 2000, expectedStatePension: 11500, hasDBPension: true, dbPensionAmount: 8000, dbPensionStartAge: 65 },
  { label: 'DB early start', currentAge: 50, retirementAge: 60, targetNetIncome: 30000, currentPension: 200000, currentIsa: 50000, annualPensionContribution: 10000, annualIsaContribution: 5000, expectedStatePension: 11500, hasDBPension: true, dbPensionAmount: 12000, dbPensionStartAge: 60 },
  { label: 'Scottish taxpayer', currentAge: 45, retirementAge: 65, targetNetIncome: 35000, currentPension: 200000, currentIsa: 50000, annualPensionContribution: 10000, annualIsaContribution: 5000, expectedStatePension: 11500, taxJurisdiction: 'scotland' },
  { label: 'PCLS phased strategy', currentAge: 55, retirementAge: 65, targetNetIncome: 25000, currentPension: 300000, currentIsa: 50000, annualPensionContribution: 5000, annualIsaContribution: 2000, expectedStatePension: 11500, pclsStrategy: 'phased' },
  { label: 'PCLS deferred strategy', currentAge: 55, retirementAge: 65, targetNetIncome: 25000, currentPension: 300000, currentIsa: 50000, annualPensionContribution: 5000, annualIsaContribution: 2000, expectedStatePension: 11500, pclsStrategy: 'deferred' },
  { label: 'PCLS none strategy', currentAge: 55, retirementAge: 65, targetNetIncome: 25000, currentPension: 300000, currentIsa: 50000, annualPensionContribution: 5000, annualIsaContribution: 2000, expectedStatePension: 11500, pclsStrategy: 'none' },
  { label: 'Age-based spending', currentAge: 50, retirementAge: 65, targetNetIncome: 30000, currentPension: 300000, currentIsa: 50000, annualPensionContribution: 10000, annualIsaContribution: 5000, expectedStatePension: 11500, applyAgeBasedSpendingReductions: true },
  { label: 'Minimum age gap', currentAge: 55, retirementAge: 56, targetNetIncome: 20000, currentPension: 200000, currentIsa: 30000, annualPensionContribution: 5000, annualIsaContribution: 2000, expectedStatePension: 11500 },
  { label: 'Age 18 start', currentAge: 18, retirementAge: 65, targetNetIncome: 20000, currentPension: 0, currentIsa: 0, annualPensionContribution: 2000, annualIsaContribution: 1000, expectedStatePension: 11500 },
  { label: 'Target equals state pension', currentAge: 55, retirementAge: 67, targetNetIncome: 11500, currentPension: 50000, currentIsa: 10000, annualPensionContribution: 3000, annualIsaContribution: 1000, expectedStatePension: 11500 },
  { label: 'Very high pension pot', currentAge: 55, retirementAge: 60, targetNetIncome: 50000, currentPension: 2000000, currentIsa: 500000, annualPensionContribution: 40000, annualIsaContribution: 20000, expectedStatePension: 11500 },
  { label: 'Penny amounts', currentAge: 45, retirementAge: 65, targetNetIncome: 100, currentPension: 500, currentIsa: 200, annualPensionContribution: 50, annualIsaContribution: 20, expectedStatePension: 100 },
  { label: 'Round numbers', currentAge: 40, retirementAge: 60, targetNetIncome: 30000, currentPension: 200000, currentIsa: 100000, annualPensionContribution: 10000, annualIsaContribution: 5000, expectedStatePension: 10000 },
  { label: 'State pension age 68', currentAge: 50, retirementAge: 65, targetNetIncome: 25000, currentPension: 250000, currentIsa: 50000, annualPensionContribution: 8000, annualIsaContribution: 3000, expectedStatePension: 11500, statePensionAge: 68 },
  { label: 'Equal pension and ISA', currentAge: 45, retirementAge: 65, targetNetIncome: 25000, currentPension: 150000, currentIsa: 150000, annualPensionContribution: 7500, annualIsaContribution: 7500, expectedStatePension: 11500 },
  { label: 'All in ISA high income', currentAge: 40, retirementAge: 60, targetNetIncome: 40000, currentPension: 0, currentIsa: 500000, annualPensionContribution: 0, annualIsaContribution: 20000, expectedStatePension: 11500 },
  { label: 'Endage 95', currentAge: 50, retirementAge: 65, targetNetIncome: 25000, currentPension: 200000, currentIsa: 50000, annualPensionContribution: 8000, annualIsaContribution: 3000, expectedStatePension: 11500 },
  { label: 'Endage 100', currentAge: 45, retirementAge: 60, targetNetIncome: 20000, currentPension: 300000, currentIsa: 100000, annualPensionContribution: 10000, annualIsaContribution: 5000, expectedStatePension: 11500 },
  { label: 'DB + Scottish + spending', currentAge: 50, retirementAge: 65, targetNetIncome: 30000, currentPension: 200000, currentIsa: 50000, annualPensionContribution: 10000, annualIsaContribution: 5000, expectedStatePension: 11500, hasDBPension: true, dbPensionAmount: 10000, dbPensionStartAge: 65, taxJurisdiction: 'scotland', applyAgeBasedSpendingReductions: true },
  { label: 'PCLS no reinvest', currentAge: 55, retirementAge: 65, targetNetIncome: 25000, currentPension: 300000, currentIsa: 50000, annualPensionContribution: 5000, annualIsaContribution: 2000, expectedStatePension: 11500, pclsReinvest: false },
  { label: 'Max contributions', currentAge: 35, retirementAge: 55, targetNetIncome: 40000, currentPension: 100000, currentIsa: 50000, annualPensionContribution: 60000, annualIsaContribution: 20000, expectedStatePension: 11500 },
  { label: 'Tiny target big pot', currentAge: 60, retirementAge: 65, targetNetIncome: 1000, currentPension: 500000, currentIsa: 200000, annualPensionContribution: 0, annualIsaContribution: 0, expectedStatePension: 11500 },
];

for (let i = 0; i < projectionScenarios.length; i++) {
  const s = projectionScenarios[i];
  const endAge = s.label.includes('Endage 95') ? 95 : s.label.includes('Endage 100') ? 100 : 90;
  try {
    const plan = createPlan({ statePensionAge: 67, ...s });
    const result = runProjection(plan, { endAge });

    assert(isFiniteNumber(result.summary.retirementPot), `[${i+1}] ${s.label}: retirementPot is finite`, `got ${result.summary.retirementPot}`);
    assert(isNonNegative(result.summary.retirementPot), `[${i+1}] ${s.label}: retirementPot >= 0`, `got ${result.summary.retirementPot}`);
    assert(isFiniteNumber(result.summary.totalNetIncome), `[${i+1}] ${s.label}: totalNetIncome is finite`, `got ${result.summary.totalNetIncome}`);
    assert(isNonNegative(result.summary.totalTaxPaid), `[${i+1}] ${s.label}: totalTaxPaid >= 0`, `got ${result.summary.totalTaxPaid}`);
    assert(isFiniteNumber(result.summary.finalBalance), `[${i+1}] ${s.label}: finalBalance is finite`, `got ${result.summary.finalBalance}`);
    assert(result.summary.successRate >= 0 && result.summary.successRate <= 1, `[${i+1}] ${s.label}: successRate in [0,1]`, `got ${result.summary.successRate}`);

    // Check no NaN in year-by-year data
    let hasNaN = false;
    for (const yr of result.decumulation.years) {
      if (!isFiniteNumber(yr.netIncome) || (!yr.fundsDepleted && !isFiniteNumber(yr.taxPaid))) {
        hasNaN = true;
        break;
      }
    }
    assert(!hasNaN, `[${i+1}] ${s.label}: no NaN in yearly data`);

  } catch (e) {
    assert(false, `[${i+1}] ${s.label}: no crash`, e.message);
  }
}

// ─── CATEGORY 2: Tax edge cases (20 scenarios) ───

console.log('\nCATEGORY 2: Tax Edge Cases (20 scenarios)');
console.log('─────────────────────────────────────────────────────────────────');

const taxScenarios = [
  { income: 0, label: 'Zero income' },
  { income: 1, label: '£1 income' },
  { income: 12570, label: 'Exactly at PA' },
  { income: 12571, label: '£1 above PA' },
  { income: 25000, label: 'Basic rate' },
  { income: 50270, label: 'Top of basic rate' },
  { income: 50271, label: '£1 into higher rate' },
  { income: 60000, label: 'Mid higher rate' },
  { income: 100000, label: 'At taper threshold' },
  { income: 100001, label: '£1 into taper zone' },
  { income: 110000, label: 'Mid taper zone' },
  { income: 125140, label: 'PA fully tapered' },
  { income: 125141, label: '£1 above full taper' },
  { income: 150000, label: 'Additional rate' },
  { income: 200000, label: 'High earner' },
  { income: 500000, label: 'Very high earner' },
  { income: 1000000, label: 'Millionaire income' },
  { income: 0.01, label: 'Penny income' },
  { income: 99999.99, label: 'Just below taper' },
  { income: 125139.99, label: 'Penny below full taper' },
];

for (let i = 0; i < taxScenarios.length; i++) {
  const s = taxScenarios[i];
  const idx = 41 + i;
  try {
    const result = calculateTaxFromGross(s.income);
    assert(isFiniteNumber(result.total), `[${idx}] Tax ${s.label}: tax is finite`, `got ${result.total}`);
    assert(isNonNegative(result.total), `[${idx}] Tax ${s.label}: tax >= 0`, `got ${result.total}`);
    assert(result.total <= s.income, `[${idx}] Tax ${s.label}: tax <= income`, `tax=${result.total}, income=${s.income}`);
    assert(isFiniteNumber(result.netIncome), `[${idx}] Tax ${s.label}: net is finite`, `got ${result.netIncome}`);
    assert(result.netIncome >= 0, `[${idx}] Tax ${s.label}: net >= 0`, `got ${result.netIncome}`);

    // Gross-from-net round trip
    if (s.income > 0) {
      const inverse = calculateGrossFromNet(result.netIncome);
      assert(Math.abs(inverse.grossRequired - s.income) < 1, `[${idx}] Tax ${s.label}: gross-net round trip`, `expected ${s.income}, got ${inverse.grossRequired}`);
    }
  } catch (e) {
    assert(false, `[${idx}] Tax ${s.label}: no crash`, e.message);
  }
}

// ─── CATEGORY 3: Withdrawal strategies (15 scenarios) ───

console.log('\nCATEGORY 3: Withdrawal Strategies (15 scenarios)');
console.log('─────────────────────────────────────────────────────────────────');

const withdrawalScenarios = [
  { target: 10000, pension: 200000, isa: 50000, sp: 0, label: 'Basic no SP' },
  { target: 10000, pension: 200000, isa: 50000, sp: 11500, label: 'With SP' },
  { target: 30000, pension: 200000, isa: 50000, sp: 11500, label: 'Higher target with SP' },
  { target: 50000, pension: 500000, isa: 100000, sp: 11500, label: 'High target' },
  { target: 5000, pension: 100000, isa: 50000, sp: 11500, label: 'Target below SP' },
  { target: 20000, pension: 0, isa: 100000, sp: 0, label: 'ISA only' },
  { target: 20000, pension: 100000, isa: 0, sp: 0, label: 'Pension only' },
  { target: 20000, pension: 100, isa: 100, sp: 0, label: 'Nearly depleted' },
  { target: 20000, pension: 0, isa: 0, sp: 11500, label: 'SP only, pots empty' },
  { target: 100000, pension: 50000, isa: 20000, sp: 11500, label: 'Target exceeds pot' },
  { target: 12570, pension: 200000, isa: 50000, sp: 0, label: 'Target at PA' },
  { target: 0, pension: 200000, isa: 50000, sp: 11500, label: 'Zero target' },
  { target: 1, pension: 200000, isa: 50000, sp: 0, label: '£1 target' },
  { target: 80000, pension: 1000000, isa: 500000, sp: 11500, label: 'Large balances high target' },
  { target: 20000, pension: 200000, isa: 50000, sp: 20000, label: 'SP exceeds target' },
];

for (let i = 0; i < withdrawalScenarios.length; i++) {
  const s = withdrawalScenarios[i];
  const idx = 61 + i;
  try {
    const result = calculateOptimalWithdrawal(s.target, { pension: s.pension, isa: s.isa }, { statePensionIncome: s.sp });
    assert(isFiniteNumber(result.netIncome), `[${idx}] Withdrawal ${s.label}: netIncome is finite`, `got ${result.netIncome}`);
    assert(isNonNegative(result.taxPaid), `[${idx}] Withdrawal ${s.label}: taxPaid >= 0`, `got ${result.taxPaid}`);
    assert(result.withdrawals.pension >= 0, `[${idx}] Withdrawal ${s.label}: pension withdrawal >= 0`, `got ${result.withdrawals.pension}`);
    assert(result.withdrawals.isa >= 0, `[${idx}] Withdrawal ${s.label}: isa withdrawal >= 0`, `got ${result.withdrawals.isa}`);
    assert(result.withdrawals.pension <= s.pension + 0.01, `[${idx}] Withdrawal ${s.label}: pension withdrawal <= balance`, `w=${result.withdrawals.pension}, bal=${s.pension}`);
    assert(result.withdrawals.isa <= s.isa + 0.01, `[${idx}] Withdrawal ${s.label}: isa withdrawal <= balance`, `w=${result.withdrawals.isa}, bal=${s.isa}`);
    assert(result.newBalances.pension >= -0.01, `[${idx}] Withdrawal ${s.label}: new pension >= 0`, `got ${result.newBalances.pension}`);
    assert(result.newBalances.isa >= -0.01, `[${idx}] Withdrawal ${s.label}: new isa >= 0`, `got ${result.newBalances.isa}`);
  } catch (e) {
    assert(false, `[${idx}] Withdrawal ${s.label}: no crash`, e.message);
  }
}

// ─── CATEGORY 4: Monte Carlo (10 scenarios) ───

console.log('\nCATEGORY 4: Monte Carlo (10 scenarios)');
console.log('─────────────────────────────────────────────────────────────────');

const mcScenarios = [
  { label: 'Low vol', volatility: 0.05, iterations: 20 },
  { label: 'Medium vol', volatility: 0.15, iterations: 20 },
  { label: 'High vol', volatility: 0.30, iterations: 20 },
  { label: 'Zero vol', volatility: 0, iterations: 5 },
  { label: 'Very high vol', volatility: 0.50, iterations: 10 },
  { label: 'Many iterations', volatility: 0.15, iterations: 100 },
  { label: 'Single iteration', volatility: 0.15, iterations: 1 },
  { label: 'Seeded reproducible', volatility: 0.15, iterations: 20, seed: 12345 },
  { label: 'Different seed', volatility: 0.15, iterations: 20, seed: 99999 },
  { label: 'Negative mean unlikely', volatility: 0.15, iterations: 20 },
];

const mcBasePlan = createPlan({
  currentAge: 50, retirementAge: 65, targetNetIncome: 25000,
  currentPension: 200000, currentIsa: 50000,
  annualPensionContribution: 8000, annualIsaContribution: 3000,
  expectedStatePension: 11500, statePensionAge: 67
});

for (let i = 0; i < mcScenarios.length; i++) {
  const s = mcScenarios[i];
  const idx = 76 + i;
  try {
    const result = runMonteCarlo(mcBasePlan, {
      iterations: s.iterations,
      volatility: s.volatility,
      endAge: 90,
      seed: s.seed || 42
    });
    assert(result.iterations === s.iterations, `[${idx}] MC ${s.label}: correct iteration count`);
    assert(isFiniteNumber(result.statistics.successRate), `[${idx}] MC ${s.label}: successRate is finite`, `got ${result.statistics.successRate}`);
    assert(result.statistics.successRate >= 0 && result.statistics.successRate <= 1, `[${idx}] MC ${s.label}: successRate in [0,1]`, `got ${result.statistics.successRate}`);
    assert(isFiniteNumber(result.statistics.finalBalance.p50), `[${idx}] MC ${s.label}: median balance is finite`, `got ${result.statistics.finalBalance.p50}`);
    assert(result.statistics.finalBalance.p10 <= result.statistics.finalBalance.p90, `[${idx}] MC ${s.label}: p10 <= p90`, `p10=${result.statistics.finalBalance.p10}, p90=${result.statistics.finalBalance.p90}`);
  } catch (e) {
    assert(false, `[${idx}] MC ${s.label}: no crash`, e.message);
  }
}

// ─── CATEGORY 5: Couples tax (5 scenarios) ───

console.log('\nCATEGORY 5: Couples Tax (5 scenarios)');
console.log('─────────────────────────────────────────────────────────────────');

const couplesTaxScenarios = [
  { p1: { statePension: 11500, pensionWithdrawal: 10000 }, p2: { statePension: 11500, dbPension: 5000 }, label: 'Both with income' },
  { p1: { statePension: 11500, pensionWithdrawal: 50000 }, p2: { statePension: 0, pensionWithdrawal: 0 }, label: 'One earner only' },
  { p1: { isaWithdrawal: 30000 }, p2: { isaWithdrawal: 30000 }, label: 'ISA only couple' },
  { p1: { statePension: 11500, pensionWithdrawal: 100000 }, p2: { statePension: 11500, pensionWithdrawal: 100000 }, label: 'High income couple' },
  { p1: { statePension: 11500, dbPension: 8000, pensionWithdrawal: 15000, isaWithdrawal: 5000 }, p2: { statePension: 11500, pensionWithdrawal: 10000, isaWithdrawal: 10000 }, label: 'Complex mix' },
];

for (let i = 0; i < couplesTaxScenarios.length; i++) {
  const s = couplesTaxScenarios[i];
  const idx = 86 + i;
  try {
    const result = calculateCouplesTax(s.p1, s.p2);
    assert(isFiniteNumber(result.household.totalTax), `[${idx}] Couples ${s.label}: totalTax is finite`, `got ${result.household.totalTax}`);
    assert(isNonNegative(result.household.totalTax), `[${idx}] Couples ${s.label}: totalTax >= 0`, `got ${result.household.totalTax}`);
    assert(isFiniteNumber(result.household.totalNetIncome), `[${idx}] Couples ${s.label}: totalNet is finite`, `got ${result.household.totalNetIncome}`);
    // Each person's tax should be calculated independently
    assert(result.person1 !== null, `[${idx}] Couples ${s.label}: person1 result exists`);
    assert(result.person2 !== null, `[${idx}] Couples ${s.label}: person2 result exists`);
    // Total should equal sum of parts
    const sumTax = result.person1.incomeTax + result.person2.incomeTax;
    assert(Math.abs(result.household.totalTax - sumTax) < 0.01, `[${idx}] Couples ${s.label}: total = sum of parts`, `total=${result.household.totalTax}, sum=${sumTax}`);
  } catch (e) {
    assert(false, `[${idx}] Couples ${s.label}: no crash`, e.message);
  }
}

// ─── CATEGORY 6: PCLS strategies (5 scenarios) ───

console.log('\nCATEGORY 6: PCLS Strategies (5 scenarios)');
console.log('─────────────────────────────────────────────────────────────────');

const pclsScenarios = [
  { pension: 400000, strategy: 'all_at_retirement', label: 'All at retirement' },
  { pension: 400000, strategy: 'phased', label: 'Phased over 5 years' },
  { pension: 400000, strategy: 'deferred', label: 'Deferred to SP age' },
  { pension: 400000, strategy: 'none', label: 'No PCLS' },
  { pension: 0, strategy: 'all_at_retirement', label: 'Zero pension' },
];

for (let i = 0; i < pclsScenarios.length; i++) {
  const s = pclsScenarios[i];
  const idx = 91 + i;
  try {
    const result = calculatePCLSStrategy(s.pension, { strategy: s.strategy, retirementAge: 65 });
    assert(isFiniteNumber(result.totalPCLS), `[${idx}] PCLS ${s.label}: totalPCLS is finite`, `got ${result.totalPCLS}`);
    assert(isNonNegative(result.totalPCLS), `[${idx}] PCLS ${s.label}: totalPCLS >= 0`, `got ${result.totalPCLS}`);
    if (s.strategy !== 'none' && s.pension > 0) {
      assert(result.totalPCLS <= s.pension * 0.25 + 0.01, `[${idx}] PCLS ${s.label}: PCLS <= 25%`, `got ${result.totalPCLS}`);
    }
    if (s.strategy === 'none' || s.pension === 0) {
      assert(result.totalPCLS === 0, `[${idx}] PCLS ${s.label}: no PCLS taken`, `got ${result.totalPCLS}`);
    }
  } catch (e) {
    assert(false, `[${idx}] PCLS ${s.label}: no crash`, e.message);
  }
}

// ─── CATEGORY 7: Spending rules (5 scenarios) ───

console.log('\nCATEGORY 7: Spending Rules (5 scenarios)');
console.log('─────────────────────────────────────────────────────────────────');

const spendingScenarios = [
  { base: 30000, age: 65, reductions: true, label: 'Pre-reduction age' },
  { base: 30000, age: 80, reductions: true, label: 'At go-go/slow-go boundary' },
  { base: 30000, age: 85, reductions: true, label: 'Mid slow-go' },
  { base: 30000, age: 95, reductions: true, label: 'No-go phase' },
  { base: 30000, age: 65, reductions: false, label: 'No reductions' },
];

for (let i = 0; i < spendingScenarios.length; i++) {
  const s = spendingScenarios[i];
  const idx = 96 + i;
  try {
    const rules = createSpendingRules({ baseSpending: s.base, applyDefaultReductions: s.reductions });
    const spending = calculateSpendingAtAge(s.base, s.age, { applyDefaultReductions: s.reductions });
    assert(isFiniteNumber(spending), `[${idx}] Spending ${s.label}: spending is finite`, `got ${spending}`);
    assert(spending > 0, `[${idx}] Spending ${s.label}: spending > 0`, `got ${spending}`);
    assert(spending <= s.base, `[${idx}] Spending ${s.label}: spending <= base`, `spending=${spending}, base=${s.base}`);
    if (!s.reductions) {
      assert(spending === s.base, `[${idx}] Spending ${s.label}: no reduction applied`, `got ${spending}`);
    }
  } catch (e) {
    assert(false, `[${idx}] Spending ${s.label}: no crash`, e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  STRESS TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');

if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(e => console.log(`  ${e}`));
}

if (failed > 0) {
  process.exit(1);
}
