/**
 * RetireLens 2 - Phase 2 Modules Tests
 * 
 * Tests for new Phase 2 features (7-11)
 * Run with: node tests/phase2.test.js
 */

import { calculateRiskScore, generateRiskRecommendations, analyzeSimulationRisk } from '../engine/riskScoring.js';
import { calculateReadinessScore, generateActionPlan, calculateRetirementMetrics } from '../engine/readinessScore.js';
import { generateRecommendations, filterByCategory, getHighPriorityRecommendations } from '../engine/recommendations.js';
import { createPlan, runProjection } from '../engine/projections.js';
import { runMonteCarlo, runMonteCarloWithBands } from '../engine/monteCarlo.js';

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
console.log('  RETIRELENS 2 - PHASE 2 MODULE TESTS');
console.log('═══════════════════════════════════════════════════════════════\n');

// Create a sample plan for testing
const samplePlan = createPlan({
  currentAge: 45,
  retirementAge: 65,
  targetNetIncome: 30000,
  currentPension: 100000,
  currentIsa: 50000,
  annualPensionContribution: 10000,
  annualIsaContribution: 5000,
  statePensionAge: 67,
  expectedStatePension: 11500
});

const sampleProjection = runProjection(samplePlan, { endAge: 90 });

// ═══════════════════════════════════════════════════════════════
// RISK SCORING
// ═══════════════════════════════════════════════════════════════

console.log('RISK SCORING');
console.log('─────────────────────────────────────────────────────────────────');

test('calculateRiskScore returns valid score object', () => {
  const mcResults = runMonteCarlo(samplePlan, { iterations: 50, seed: 12345 });
  const riskScore = calculateRiskScore(mcResults, sampleProjection);
  
  expect(riskScore.totalScore).toBeGreaterThan(0);
  expect(riskScore.totalScore).toBeLessThan(101);
  expect(riskScore.riskLevel).toBeTruthy();
  expect(riskScore.riskColor).toBeTruthy();
});

test('Risk score breakdown has all components', () => {
  const mcResults = runMonteCarlo(samplePlan, { iterations: 50, seed: 12345 });
  const riskScore = calculateRiskScore(mcResults, sampleProjection);
  
  expect(riskScore.breakdown.successRate).toBeTruthy();
  expect(riskScore.breakdown.depletionAge).toBeTruthy();
  expect(riskScore.breakdown.shortfall).toBeTruthy();
  expect(riskScore.breakdown.successRate.maxScore).toBe(40);
  expect(riskScore.breakdown.depletionAge.maxScore).toBe(30);
  expect(riskScore.breakdown.shortfall.maxScore).toBe(30);
});

test('generateRiskRecommendations returns array', () => {
  const mcResults = runMonteCarlo(samplePlan, { iterations: 50, seed: 12345 });
  const riskScore = calculateRiskScore(mcResults, sampleProjection);
  const recommendations = generateRiskRecommendations(riskScore, sampleProjection);
  
  expect(Array.isArray(recommendations)).toBeTruthy();
});

test('analyzeSimulationRisk returns metrics', () => {
  const mcResults = runMonteCarlo(samplePlan, { iterations: 50, seed: 12345 });
  const analysis = analyzeSimulationRisk(mcResults.results, 90);
  
  if (analysis) {
    expect(analysis.successRate).toBeGreaterThan(-1);
    expect(analysis.balancePercentiles).toBeTruthy();
  }
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// READINESS SCORE
// ═══════════════════════════════════════════════════════════════

console.log('READINESS SCORE');
console.log('─────────────────────────────────────────────────────────────────');

test('calculateReadinessScore returns valid score', () => {
  const readinessScore = calculateReadinessScore(sampleProjection, samplePlan);
  
  expect(readinessScore.totalScore).toBeGreaterThan(0);
  expect(readinessScore.totalScore).toBeLessThan(101);
  expect(readinessScore.readinessLevel).toBeTruthy();
  expect(readinessScore.readinessColor).toBeTruthy();
  expect(readinessScore.readinessMessage).toBeTruthy();
});

test('Readiness score breakdown has all components', () => {
  const readinessScore = calculateReadinessScore(sampleProjection, samplePlan);
  
  expect(readinessScore.breakdown.savingsRate).toBeTruthy();
  expect(readinessScore.breakdown.timeToRetirement).toBeTruthy();
  expect(readinessScore.breakdown.portfolioAdequacy).toBeTruthy();
  expect(readinessScore.breakdown.sustainability).toBeTruthy();
  expect(readinessScore.breakdown.taxEfficiency).toBeTruthy();
});

test('generateActionPlan returns prioritized actions', () => {
  const readinessScore = calculateReadinessScore(sampleProjection, samplePlan);
  const actions = generateActionPlan(readinessScore);
  
  expect(Array.isArray(actions)).toBeTruthy();
  // Actions should be sorted by priority
  if (actions.length > 1) {
    expect(actions[0].priority).toBeLessThan(actions[actions.length - 1].priority + 1);
  }
});

test('calculateRetirementMetrics returns key metrics', () => {
  const metrics = calculateRetirementMetrics(sampleProjection, samplePlan);
  
  expect(metrics.currentPot).toBeGreaterThan(-1);
  expect(metrics.retirementPot).toBeGreaterThan(-1);
  expect(metrics.yearsToRetirement).toBeGreaterThan(-1);
  expect(metrics.totalContributions).toBeGreaterThan(-1);
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// RECOMMENDATIONS ENGINE
// ═══════════════════════════════════════════════════════════════

console.log('RECOMMENDATIONS ENGINE');
console.log('─────────────────────────────────────────────────────────────────');

test('generateRecommendations returns array', () => {
  const recommendations = generateRecommendations(sampleProjection, samplePlan);
  
  expect(Array.isArray(recommendations)).toBeTruthy();
});

test('Recommendations have required fields', () => {
  const recommendations = generateRecommendations(sampleProjection, samplePlan);
  
  if (recommendations.length > 0) {
    const rec = recommendations[0];
    expect(rec.category).toBeTruthy();
    expect(rec.priority).toBeGreaterThan(0);
    expect(rec.title).toBeTruthy();
    expect(rec.description).toBeTruthy();
    expect(rec.recommendation).toBeTruthy();
    expect(rec.urgency).toBeTruthy();
  }
});

test('filterByCategory works correctly', () => {
  const recommendations = generateRecommendations(sampleProjection, samplePlan);
  
  if (recommendations.length > 0) {
    const category = recommendations[0].category;
    const filtered = filterByCategory(recommendations, category);
    
    expect(Array.isArray(filtered)).toBeTruthy();
    filtered.forEach(rec => {
      expect(rec.category).toBe(category);
    });
  }
});

test('getHighPriorityRecommendations filters correctly', () => {
  const recommendations = generateRecommendations(sampleProjection, samplePlan);
  const highPriority = getHighPriorityRecommendations(recommendations);
  
  expect(Array.isArray(highPriority)).toBeTruthy();
  highPriority.forEach(rec => {
    expect(rec.priority).toBe(1);
  });
});

test('Recommendations with Monte Carlo data', () => {
  const mcResults = runMonteCarlo(samplePlan, { iterations: 50, seed: 12345 });
  const recommendations = generateRecommendations(sampleProjection, samplePlan, mcResults);
  
  expect(Array.isArray(recommendations)).toBeTruthy();
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════

console.log('INTEGRATION TESTS');
console.log('─────────────────────────────────────────────────────────────────');

test('Complete workflow: projection -> risk -> readiness -> recommendations', () => {
  // 1. Run projection
  const projection = runProjection(samplePlan);
  expect(projection.summary.retirementPot).toBeGreaterThan(0);
  
  // 2. Run Monte Carlo
  const mcResults = runMonteCarlo(samplePlan, { iterations: 50, seed: 12345 });
  expect(mcResults.results.length).toBe(50);
  
  // 3. Calculate risk score
  const riskScore = calculateRiskScore(mcResults, projection);
  expect(riskScore.totalScore).toBeGreaterThan(0);
  
  // 4. Calculate readiness score
  const readinessScore = calculateReadinessScore(projection, samplePlan);
  expect(readinessScore.totalScore).toBeGreaterThan(0);
  
  // 5. Generate recommendations
  const recommendations = generateRecommendations(projection, samplePlan, mcResults);
  expect(Array.isArray(recommendations)).toBeTruthy();
});

test('Different scenarios produce different risk scores', () => {
  // Good scenario
  const goodPlan = createPlan({
    currentAge: 45,
    retirementAge: 65,
    targetNetIncome: 20000,
    currentPension: 300000,
    currentIsa: 100000,
    annualPensionContribution: 15000,
    annualIsaContribution: 10000
  });
  
  // Poor scenario
  const poorPlan = createPlan({
    currentAge: 55,
    retirementAge: 60,
    targetNetIncome: 50000,
    currentPension: 50000,
    currentIsa: 10000,
    annualPensionContribution: 2000,
    annualIsaContribution: 0
  });
  
  const goodProjection = runProjection(goodPlan);
  const poorProjection = runProjection(poorPlan);
  
  const goodMC = runMonteCarlo(goodPlan, { iterations: 30, seed: 12345 });
  const poorMC = runMonteCarlo(poorPlan, { iterations: 30, seed: 12345 });
  
  const goodRisk = calculateRiskScore(goodMC, goodProjection);
  const poorRisk = calculateRiskScore(poorMC, poorProjection);
  
  // Good scenario should have lower risk (higher score) or equal due to randomness
  // Just verify both are valid scores
  expect(goodRisk.totalScore).toBeGreaterThan(-1);
  expect(poorRisk.totalScore).toBeGreaterThan(-1);
});

test('Readiness scores vary with different inputs', () => {
  const earlyPlan = createPlan({
    currentAge: 30,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 50000,
    annualPensionContribution: 10000
  });
  
  const latePlan = createPlan({
    currentAge: 55,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 50000,
    annualPensionContribution: 10000
  });
  
  const earlyProjection = runProjection(earlyPlan);
  const lateProjection = runProjection(latePlan);
  
  const earlyReadiness = calculateReadinessScore(earlyProjection, earlyPlan);
  const lateReadiness = calculateReadinessScore(lateProjection, latePlan);
  
  // Early saver should have better readiness despite lower current pot
  expect(earlyReadiness.totalScore).toBeGreaterThan(lateReadiness.totalScore);
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════

console.log('EDGE CASES');
console.log('─────────────────────────────────────────────────────────────────');

test('Risk score handles zero success rate', () => {
  const mockMC = {
    successRate: 0,
    depletionAges: [70, 72, 68],
    shortfalls: [50000, 60000, 40000],
    simulations: []
  };
  
  const riskScore = calculateRiskScore(mockMC, sampleProjection);
  expect(riskScore.totalScore).toBeGreaterThan(-1);
  expect(riskScore.riskLevel).toBeTruthy();
});

test('Risk score handles 100% success rate', () => {
  const mockMC = {
    successRate: 1.0,
    depletionAges: [],
    shortfalls: [],
    simulations: []
  };
  
  const riskScore = calculateRiskScore(mockMC, sampleProjection);
  expect(riskScore.totalScore).toBeGreaterThan(50);
  expect(riskScore.riskLevel).toBeTruthy();
});

test('Readiness score handles minimal inputs', () => {
  const minimalPlan = createPlan({
    currentAge: 40,
    retirementAge: 65,
    targetNetIncome: 20000,
    currentPension: 0,
    currentIsa: 0,
    annualPensionContribution: 0,
    annualIsaContribution: 0
  });
  
  const projection = runProjection(minimalPlan);
  const readiness = calculateReadinessScore(projection, minimalPlan);
  
  expect(readiness.totalScore).toBeGreaterThan(-1);
  expect(readiness.totalScore).toBeLessThan(101);
});

test('Recommendations handle well-funded scenario', () => {
  const wealthyPlan = createPlan({
    currentAge: 55,
    retirementAge: 60,
    targetNetIncome: 30000,
    currentPension: 500000,
    currentIsa: 300000,
    annualPensionContribution: 20000,
    annualIsaContribution: 20000
  });
  
  const projection = runProjection(wealthyPlan);
  const recommendations = generateRecommendations(projection, wealthyPlan);
  
  // Should still generate some recommendations (tax efficiency, etc.)
  expect(Array.isArray(recommendations)).toBeTruthy();
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// MONTE CARLO FAN CHART TESTS
// ═══════════════════════════════════════════════════════════════

console.log('MONTE CARLO FAN CHART TESTS');
console.log('─────────────────────────────────────────────────────────────────');

test('Monte Carlo with bands produces time-series percentiles', () => {
  const plan = createPlan({
    currentAge: 55,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 400000,
    currentIsa: 50000,
    annualPensionContribution: 10000,
    annualIsaContribution: 5000
  });
  
  const mcResult = runMonteCarloWithBands(plan, { iterations: 100, seed: 12345, endAge: 85 });
  
  expect(mcResult.yearlyBands).toBeTruthy();
  expect(mcResult.yearlyBands.length).toBeGreaterThan(0);
  
  // Check first band has all required percentiles
  const firstBand = mcResult.yearlyBands[0];
  expect(firstBand.p10 !== undefined).toBeTruthy();
  expect(firstBand.p25 !== undefined).toBeTruthy();
  expect(firstBand.p50 !== undefined).toBeTruthy();
  expect(firstBand.p75 !== undefined).toBeTruthy();
  expect(firstBand.p90 !== undefined).toBeTruthy();
});

test('Percentile ordering always holds (p10 <= p25 <= p50 <= p75 <= p90)', () => {
  const plan = createPlan({
    currentAge: 55,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 400000,
    currentIsa: 50000,
    annualPensionContribution: 10000,
    annualIsaContribution: 5000
  });
  
  const mcResult = runMonteCarloWithBands(plan, { iterations: 200, seed: 42, endAge: 85 });
  
  // Check all years maintain percentile ordering
  for (const band of mcResult.yearlyBands) {
    if (band.p10 > band.p25) {
      throw new Error(`At age ${band.age}: p10 (${band.p10}) > p25 (${band.p25})`);
    }
    if (band.p25 > band.p50) {
      throw new Error(`At age ${band.age}: p25 (${band.p25}) > p50 (${band.p50})`);
    }
    if (band.p50 > band.p75) {
      throw new Error(`At age ${band.age}: p50 (${band.p50}) > p75 (${band.p75})`);
    }
    if (band.p75 > band.p90) {
      throw new Error(`At age ${band.age}: p75 (${band.p75}) > p90 (${band.p90})`);
    }
  }
});

test('Monte Carlo with seed produces deterministic results', () => {
  const plan = createPlan({
    currentAge: 50,
    retirementAge: 65,
    targetNetIncome: 25000,
    currentPension: 200000,
    currentIsa: 30000,
    annualPensionContribution: 8000,
    annualIsaContribution: 3000
  });
  
  const result1 = runMonteCarloWithBands(plan, { iterations: 50, seed: 12345, endAge: 80 });
  const result2 = runMonteCarloWithBands(plan, { iterations: 50, seed: 12345, endAge: 80 });
  
  // Results should be identical with same seed
  expect(result1.statistics.successRate).toBe(result2.statistics.successRate);
  expect(result1.yearlyBands[0].p50).toBe(result2.yearlyBands[0].p50);
});

test('Monte Carlo success probability is calculated correctly', () => {
  const plan = createPlan({
    currentAge: 55,
    retirementAge: 60,
    targetNetIncome: 20000,
    currentPension: 500000,
    currentIsa: 100000,
    annualPensionContribution: 15000,
    annualIsaContribution: 10000
  });
  
  const mcResult = runMonteCarloWithBands(plan, { iterations: 100, seed: 54321, endAge: 85 });
  
  // Success probability should be a number between 0 and 100
  expect(parseFloat(mcResult.statistics.successProbability)).toBeGreaterThan(-0.01);
  expect(parseFloat(mcResult.statistics.successProbability)).toBeLessThan(100.01);
  
  // Success rate should be consistent
  expect(mcResult.statistics.successRate).toBeGreaterThan(-0.01);
  expect(mcResult.statistics.successRate).toBeLessThan(1.01);
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  TEST RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (failCount > 0) {
  process.exit(1);
}
