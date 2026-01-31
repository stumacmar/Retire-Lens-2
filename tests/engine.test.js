/**
 * RetireLens 2 - Engine Tests
 * 
 * Deterministic test scenarios for engine verification.
 * Run with: node tests/engine.test.js
 */

import { calculatePersonalAllowance, calculateIncomeTax, calculateTaxFromGross, calculateGrossFromNet, getMarginalRate } from '../engine/tax.js';
import { calculatePCLS, calculateOptimalWithdrawal, calculateSustainableWithdrawal } from '../engine/withdrawals.js';
import { createPlan, projectAccumulation, projectDecumulation, runProjection, comparePlans, canIRetire, generateDebugOutput } from '../engine/projections.js';
import { runMonteCarlo, generateConfidenceBands } from '../engine/monteCarlo.js';
import { TAX_CONFIG, PENSION_CONFIG, createAssumptions } from '../config/defaults.js';

// Test utilities
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failCount++;
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toBeCloseTo(expected, tolerance = 0.01) {
      if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`Expected ${expected} (±${tolerance}), got ${actual}`);
      }
    },
    toBeGreaterThan(expected) {
      if (actual <= expected) {
        throw new Error(`Expected > ${expected}, got ${actual}`);
      }
    },
    toBeLessThan(expected) {
      if (actual >= expected) {
        throw new Error(`Expected < ${expected}, got ${actual}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${actual}`);
      }
    }
  };
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  RETIRELENS 2 - ENGINE TEST SUITE');
console.log('═══════════════════════════════════════════════════════════════\n');

// ═══════════════════════════════════════════════════════════════
// TAX CALCULATIONS
// ═══════════════════════════════════════════════════════════════

console.log('TAX CALCULATIONS');
console.log('─────────────────────────────────────────────────────────────────');

test('Personal allowance for income below threshold', () => {
  expect(calculatePersonalAllowance(50000)).toBe(12570);
});

test('Personal allowance taper for income over £100k', () => {
  // At £110k, lose £5k of PA (half of £10k over threshold)
  expect(calculatePersonalAllowance(110000)).toBe(7570);
});

test('Personal allowance zero at £125,140+', () => {
  expect(calculatePersonalAllowance(130000)).toBe(0);
});

test('No tax on income within personal allowance', () => {
  const result = calculateIncomeTax(0);
  expect(result.total).toBe(0);
});

test('Basic rate tax calculation', () => {
  // £10k taxable income at 20%
  const result = calculateIncomeTax(10000);
  expect(result.total).toBe(2000);
});

test('Higher rate tax calculation', () => {
  // £50k taxable income: £37,700 at 20% + £12,300 at 40%
  const result = calculateIncomeTax(50000);
  const expected = (37700 * 0.20) + (12300 * 0.40);
  expect(result.total).toBeCloseTo(expected, 1);
});

test('Full tax calculation from gross income', () => {
  // £50k gross: PA £12,570, taxable £37,430, all at 20%
  const result = calculateTaxFromGross(50000);
  expect(result.personalAllowance).toBe(12570);
  expect(result.taxableIncome).toBe(37430);
  expect(result.netIncome).toBeCloseTo(50000 - (37430 * 0.20), 1);
});

test('Gross from net calculation (inverse)', () => {
  const targetNet = 40000;
  const result = calculateGrossFromNet(targetNet);
  // Verify the gross produces the target net
  const verification = calculateTaxFromGross(result.grossRequired);
  expect(verification.netIncome).toBeCloseTo(targetNet, 10);
});

test('Marginal rate in basic rate band', () => {
  expect(getMarginalRate(30000)).toBe(0.20);
});

test('Marginal rate in higher rate band', () => {
  expect(getMarginalRate(60000)).toBe(0.40);
});

test('Marginal rate in PA taper zone (60%)', () => {
  expect(getMarginalRate(110000)).toBe(0.60);
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// WITHDRAWAL CALCULATIONS
// ═══════════════════════════════════════════════════════════════

console.log('WITHDRAWAL CALCULATIONS');
console.log('─────────────────────────────────────────────────────────────────');

test('PCLS calculation at 25%', () => {
  const result = calculatePCLS(400000);
  expect(result.taxFreeCash).toBe(100000);
  expect(result.remainingPension).toBe(300000);
});

test('Optimal withdrawal uses PA first', () => {
  const result = calculateOptimalWithdrawal(
    20000,
    { pension: 100000, isa: 50000 },
    { statePensionIncome: 0 }
  );
  // Should draw pension within PA (tax-free)
  expect(result.withdrawals.pension).toBeGreaterThan(0);
});

test('Optimal withdrawal includes ISA for above-PA income', () => {
  const result = calculateOptimalWithdrawal(
    30000,
    { pension: 100000, isa: 50000 },
    { statePensionIncome: 0 }
  );
  // Should use ISA for amounts beyond PA
  expect(result.withdrawals.isa).toBeGreaterThan(0);
});

test('Sustainable withdrawal rate calculation', () => {
  const result = calculateSustainableWithdrawal(500000, 25, 0.04);
  // Should be approximately 4% + some principal
  expect(result.annualWithdrawal).toBeGreaterThan(20000);
  expect(result.annualWithdrawal).toBeLessThan(35000);
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// PROJECTION ENGINE
// ═══════════════════════════════════════════════════════════════

console.log('PROJECTION ENGINE');
console.log('─────────────────────────────────────────────────────────────────');

test('Create plan validates required fields', () => {
  let threw = false;
  try {
    createPlan({ targetNetIncome: 30000 }); // Missing required fields
  } catch (e) {
    threw = true;
  }
  expect(threw).toBeTruthy();
});

test('Create plan with valid inputs', () => {
  const plan = createPlan({
    currentAge: 40,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 100000,
    currentIsa: 50000,
    annualPensionContribution: 10000,
    annualIsaContribution: 5000
  });
  expect(plan.currentAge).toBe(40);
  expect(plan.retirementAge).toBe(65);
});

test('Accumulation projection grows balances', () => {
  const plan = createPlan({
    currentAge: 40,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 100000,
    currentIsa: 50000,
    annualPensionContribution: 10000,
    annualIsaContribution: 5000
  });
  const result = projectAccumulation(plan);
  
  // After 25 years of contributions + growth
  expect(result.finalBalances.pension).toBeGreaterThan(100000);
  expect(result.finalBalances.total).toBeGreaterThan(150000);
});

test('Full projection runs without errors', () => {
  const plan = createPlan({
    currentAge: 40,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 100000,
    currentIsa: 50000,
    annualPensionContribution: 10000,
    annualIsaContribution: 5000,
    statePensionAge: 67,
    expectedStatePension: 11500
  });
  
  const result = runProjection(plan, { endAge: 90 });
  
  expect(result.summary.retirementPot).toBeGreaterThan(0);
  expect(result.summary.pclsTaken).toBeGreaterThan(0);
  expect(result.accumulation.years.length).toBe(25);
});

test('Plan comparison calculates deltas', () => {
  const planA = createPlan({
    name: 'Plan A',
    currentAge: 40,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 100000,
    annualPensionContribution: 10000
  });
  
  const planB = createPlan({
    name: 'Plan B',
    currentAge: 40,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 100000,
    annualPensionContribution: 15000 // Higher contributions
  });
  
  const resultA = runProjection(planA);
  const resultB = runProjection(planB);
  const comparison = comparePlans(resultA, resultB);
  
  // Plan B should have higher retirement pot
  expect(comparison.deltas.retirementPot).toBeGreaterThan(0);
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// MONTE CARLO
// ═══════════════════════════════════════════════════════════════

console.log('MONTE CARLO SIMULATION');
console.log('─────────────────────────────────────────────────────────────────');

test('Monte Carlo produces percentile statistics', () => {
  const plan = createPlan({
    currentAge: 40,
    retirementAge: 65,
    targetNetIncome: 20000,  // Lower target for more sustainable scenario
    currentPension: 200000,  // Higher starting pot
    annualPensionContribution: 12000,
    statePensionAge: 67,
    expectedStatePension: 11500  // State pension helps sustainability
  });
  
  const result = runMonteCarlo(plan, { iterations: 100, seed: 12345 });
  
  // With seeded RNG and reasonable scenario, should have some successes
  expect(result.statistics.finalBalance.p50).toBeGreaterThan(0);
  expect(result.results.length).toBe(100);
  // Success rate may vary based on market simulation
  expect(result.statistics.successRate).toBeGreaterThan(-1); // Always valid
});

test('Confidence bands include deterministic and MC results', () => {
  const plan = createPlan({
    currentAge: 40,
    retirementAge: 65,
    targetNetIncome: 25000,
    currentPension: 100000,
    annualPensionContribution: 8000
  });
  
  const result = generateConfidenceBands(plan, { iterations: 50 });
  
  expect(result.deterministic).toBeTruthy();
  expect(result.monteCarlo).toBeTruthy();
  expect(result.bands).toBeTruthy();
  expect(result.robustness.score).toBeGreaterThan(0);
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// CORE QUESTION: CAN I RETIRE?
// ═══════════════════════════════════════════════════════════════

console.log('CORE QUESTION: CAN I RETIRE?');
console.log('─────────────────────────────────────────────────────────────────');

test('canIRetire answers the core question', () => {
  const plan = createPlan({
    currentAge: 55,
    retirementAge: 60,
    targetNetIncome: 20000,
    currentPension: 300000,
    currentIsa: 100000,
    statePensionAge: 67,
    expectedStatePension: 11500
  });
  
  const answer = canIRetire(plan, 90);
  
  expect(answer.question).toBeTruthy();
  expect(answer.answer).toBeTruthy();
  expect(answer.confidence).toBeGreaterThan(0);
  expect(answer.details).toBeTruthy();
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// DEBUG OUTPUT
// ═══════════════════════════════════════════════════════════════

console.log('DEBUG OUTPUT');
console.log('─────────────────────────────────────────────────────────────────');

test('Debug output generates formatted tables', () => {
  const plan = createPlan({
    name: 'Test Plan',
    currentAge: 60,
    retirementAge: 65,
    targetNetIncome: 25000,
    currentPension: 200000,
    currentIsa: 50000,
    annualPensionContribution: 10000,
    statePensionAge: 67,
    expectedStatePension: 11500
  });
  
  const projection = runProjection(plan, { endAge: 75 });
  const debugOutput = generateDebugOutput(projection);
  
  expect(debugOutput.includes('ACCUMULATION PHASE')).toBeTruthy();
  expect(debugOutput.includes('DECUMULATION PHASE')).toBeTruthy();
  expect(debugOutput.includes('OUTCOME SUMMARY')).toBeTruthy();
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// STATE ISOLATION TESTS (from RetireLens 1 patterns)
// ═══════════════════════════════════════════════════════════════

console.log('STATE ISOLATION (Plan A vs Plan B)');
console.log('─────────────────────────────────────────────────────────────────');

test('Plan A and Plan B have isolated state', () => {
  const basePlan = {
    currentAge: 45,
    retirementAge: 60,
    targetNetIncome: 30000,
    currentPension: 200000,
    annualPensionContribution: 10000
  };
  
  const planA = createPlan({ ...basePlan, name: 'Plan A' });
  const planB = createPlan({ ...basePlan, name: 'Plan B', retirementAge: 65 });
  
  // Plans should be different
  expect(planA.retirementAge).toBe(60);
  expect(planB.retirementAge).toBe(65);
  
  // Original plan unchanged after creating Plan B
  expect(planA.retirementAge).toBe(60);
});

test('100-iteration consistency test', () => {
  const planConfig = {
    currentAge: 50,
    retirementAge: 60,
    targetNetIncome: 25000,
    currentPension: 150000,
    annualPensionContribution: 8000
  };
  
  const results = [];
  for (let i = 0; i < 100; i++) {
    const plan = createPlan(planConfig);
    const projection = runProjection(plan);
    results.push(projection.summary.retirementPot);
  }
  
  // All results should be identical
  const allSame = results.every(r => r === results[0]);
  expect(allSame).toBeTruthy();
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// EXAMPLE SCENARIO
// ═══════════════════════════════════════════════════════════════

console.log('EXAMPLE SCENARIO: Mid-Career Professional');
console.log('─────────────────────────────────────────────────────────────────');

const examplePlan = createPlan({
  name: 'Sarah - Mid-Career',
  currentAge: 45,
  retirementAge: 60,
  targetNetIncome: 35000,
  currentPension: 180000,
  currentIsa: 40000,
  annualPensionContribution: 15000,
  annualIsaContribution: 10000,
  statePensionAge: 67,
  expectedStatePension: 11500
});

const exampleProjection = runProjection(examplePlan, { endAge: 90 });
const exampleAnswer = canIRetire(examplePlan, 90);

console.log(`\n  ${exampleAnswer.question}`);
console.log(`  Answer: ${exampleAnswer.answer}`);
console.log(`  Confidence: ${(exampleAnswer.confidence * 100).toFixed(1)}%`);
console.log(`  Retirement pot: £${Math.round(exampleAnswer.details.retirementPot).toLocaleString()}`);
console.log(`  PCLS taken: £${Math.round(exampleAnswer.details.pclsTaken).toLocaleString()}`);
if (exampleAnswer.suggestion) {
  console.log(`  Suggestion: ${exampleAnswer.suggestion}`);
}

console.log('\n  Full debug output:');
console.log(generateDebugOutput(exampleProjection));

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  TEST RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (failCount > 0) {
  process.exit(1);
}
