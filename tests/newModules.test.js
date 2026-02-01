/**
 * RetireLens 2 - New Modules Tests
 * 
 * Tests for assumptions, spending policy, and household modules.
 * Run with: node tests/newModules.test.js
 */

import { 
  createUserAssumptions, 
  applyScenarioPreset, 
  validateAssumptions,
  getAssumptionsSummary,
  DEFAULT_ASSUMPTIONS,
  SCENARIO_PRESETS
} from '../engine/assumptions.js';

import {
  calculateSpendingAtAge,
  createSpendingRules,
  getOneOffExpensesAtAge,
  calculateYearlySpending,
  validateSpendingRules,
  DEFAULT_AGE_ADJUSTMENTS
} from '../engine/spendingPolicy.js';

import {
  createHousehold,
  createPerson,
  calculateHouseholdStatePension,
  getSurvivorStatus,
  calculateHouseholdSpending,
  getProjectionEndAge,
  validateHousehold
} from '../engine/household.js';

import { createPlan, runProjection } from '../engine/projections.js';

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
    },
    toThrow() {
      // actual should be a function
      let threw = false;
      try {
        actual();
      } catch (e) {
        threw = true;
      }
      if (!threw) {
        throw new Error('Expected function to throw');
      }
    },
    toContain(expected) {
      if (typeof actual === 'string') {
        if (!actual.includes(expected)) {
          throw new Error(`Expected "${actual}" to contain "${expected}"`);
        }
      } else if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new Error(`Expected array to contain ${expected}`);
        }
      } else {
        throw new Error('toContain only works with strings and arrays');
      }
    }
  };
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  RETIRELENS 2 - NEW MODULES TEST SUITE');
console.log('═══════════════════════════════════════════════════════════════\n');

// ═══════════════════════════════════════════════════════════════
// ASSUMPTIONS MODULE
// ═══════════════════════════════════════════════════════════════

console.log('ASSUMPTIONS MODULE');
console.log('─────────────────────────────────────────────────────────────────');

test('createUserAssumptions returns defaults when no overrides', () => {
  const assumptions = createUserAssumptions();
  expect(assumptions.growthRate).toBe(DEFAULT_ASSUMPTIONS.growthRate);
  expect(assumptions.volatility).toBe(DEFAULT_ASSUMPTIONS.volatility);
});

test('createUserAssumptions applies overrides', () => {
  const assumptions = createUserAssumptions({ growthRate: 0.05, feeRate: 0.01 });
  expect(assumptions.growthRate).toBe(0.05);
  expect(assumptions.feeRate).toBe(0.01);
});

test('createUserAssumptions calculates netGrowthRate', () => {
  const assumptions = createUserAssumptions({ growthRate: 0.04, feeRate: 0.005 });
  expect(assumptions.netGrowthRate).toBeCloseTo(0.035, 0.001);
});

test('applyScenarioPreset returns conservative values', () => {
  const assumptions = applyScenarioPreset('conservative');
  expect(assumptions.growthRate).toBe(SCENARIO_PRESETS.conservative.growthRate);
  expect(assumptions.volatility).toBe(SCENARIO_PRESETS.conservative.volatility);
  expect(assumptions.scenario).toBe('conservative');
});

test('applyScenarioPreset returns optimistic values', () => {
  const assumptions = applyScenarioPreset('optimistic');
  expect(assumptions.growthRate).toBe(SCENARIO_PRESETS.optimistic.growthRate);
  expect(assumptions.scenario).toBe('optimistic');
});

test('applyScenarioPreset throws for unknown scenario', () => {
  expect(() => applyScenarioPreset('unknown')).toThrow();
});

test('validateAssumptions returns valid for correct input', () => {
  const assumptions = createUserAssumptions();
  const result = validateAssumptions(assumptions);
  expect(result.valid).toBeTruthy();
  expect(result.errors.length).toBe(0);
});

test('getAssumptionsSummary formats values correctly', () => {
  const assumptions = createUserAssumptions();
  const summary = getAssumptionsSummary(assumptions);
  expect(summary.growthRate).toBe('4.0%');
  expect(summary.scenario).toBe('moderate');
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// SPENDING POLICY MODULE
// ═══════════════════════════════════════════════════════════════

console.log('SPENDING POLICY MODULE');
console.log('─────────────────────────────────────────────────────────────────');

test('calculateSpendingAtAge returns base spending before age 80', () => {
  const result = calculateSpendingAtAge(30000, 75);
  expect(result).toBe(30000);
});

test('calculateSpendingAtAge applies -15% reduction at age 80+', () => {
  const result = calculateSpendingAtAge(30000, 82);
  expect(result).toBeCloseTo(25500, 1); // 30000 * 0.85
});

test('calculateSpendingAtAge applies -25% reduction at age 90+', () => {
  const result = calculateSpendingAtAge(30000, 92);
  expect(result).toBeCloseTo(22500, 1); // 30000 * 0.75
});

test('calculateSpendingAtAge uses custom adjustments when provided', () => {
  const result = calculateSpendingAtAge(30000, 75, {
    ageAdjustments: [{ fromAge: 70, reductionPercent: 10 }]
  });
  expect(result).toBeCloseTo(27000, 1); // 30000 * 0.90
});

test('calculateSpendingAtAge applies no reductions when disabled', () => {
  const result = calculateSpendingAtAge(30000, 85, {
    applyDefaultReductions: false
  });
  expect(result).toBe(30000);
});

test('createSpendingRules creates valid configuration', () => {
  const rules = createSpendingRules({
    baseSpending: 35000,
    applyDefaultReductions: true
  });
  expect(rules.baseSpending).toBe(35000);
  expect(rules.applyDefaultReductions).toBeTruthy();
});

test('createSpendingRules handles one-off expenses', () => {
  const rules = createSpendingRules({
    baseSpending: 30000,
    oneOffExpenses: [
      { age: 70, amount: 25000, description: 'New car' }
    ]
  });
  expect(rules.oneOffExpenses.length).toBe(1);
  expect(rules.oneOffExpenses[0].amount).toBe(25000);
});

test('getOneOffExpensesAtAge returns correct total', () => {
  const rules = createSpendingRules({
    baseSpending: 30000,
    oneOffExpenses: [
      { age: 70, amount: 25000, description: 'Car' },
      { age: 70, amount: 5000, description: 'Holiday' }
    ]
  });
  const total = getOneOffExpensesAtAge(rules, 70);
  expect(total).toBe(30000);
});

test('getOneOffExpensesAtAge returns 0 for ages without expenses', () => {
  const rules = createSpendingRules({
    baseSpending: 30000,
    oneOffExpenses: [{ age: 70, amount: 25000 }]
  });
  const total = getOneOffExpensesAtAge(rules, 71);
  expect(total).toBe(0);
});

test('calculateYearlySpending combines regular and one-off', () => {
  const rules = createSpendingRules({
    baseSpending: 30000,
    applyDefaultReductions: false,
    oneOffExpenses: [{ age: 70, amount: 10000 }]
  });
  const result = calculateYearlySpending(rules, 70);
  expect(result.regular).toBe(30000);
  expect(result.oneOff).toBe(10000);
  expect(result.total).toBe(40000);
});

test('validateSpendingRules validates correctly', () => {
  const rules = createSpendingRules({ baseSpending: 30000 });
  const result = validateSpendingRules(rules);
  expect(result.valid).toBeTruthy();
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// HOUSEHOLD MODULE
// ═══════════════════════════════════════════════════════════════

console.log('HOUSEHOLD MODULE');
console.log('─────────────────────────────────────────────────────────────────');

test('createPerson creates valid person object', () => {
  const person = createPerson({ currentAge: 55, retirementAge: 65 });
  expect(person.currentAge).toBe(55);
  expect(person.retirementAge).toBe(65);
  expect(person.statePensionAge).toBe(67);
});

test('createPerson throws for invalid age', () => {
  expect(() => createPerson({ currentAge: 10 })).toThrow();
});

test('createHousehold creates single household', () => {
  const household = createHousehold({
    type: 'single',
    person1: { currentAge: 55, retirementAge: 65 }
  });
  expect(household.type).toBe('single');
  expect(household.person2).toBe(null);
});

test('createHousehold creates couple household', () => {
  const household = createHousehold({
    type: 'couple',
    person1: { name: 'Alice', currentAge: 55, retirementAge: 65 },
    person2: { name: 'Bob', currentAge: 52, retirementAge: 63 }
  });
  expect(household.type).toBe('couple');
  expect(household.person1.name).toBe('Alice');
  expect(household.person2.name).toBe('Bob');
});

test('createHousehold throws for couple without person2', () => {
  expect(() => createHousehold({
    type: 'couple',
    person1: { currentAge: 55, retirementAge: 65 }
  })).toThrow();
});

test('calculateHouseholdStatePension returns single State Pension', () => {
  const household = createHousehold({
    type: 'single',
    person1: { currentAge: 55, retirementAge: 65, statePensionAge: 67, expectedStatePension: 11500 }
  });
  
  // At age 66: no State Pension yet
  const result66 = calculateHouseholdStatePension(household, 66);
  expect(result66.person1StatePension).toBe(0);
  
  // At age 68: receiving State Pension
  const result68 = calculateHouseholdStatePension(household, 68);
  expect(result68.person1StatePension).toBe(11500);
  expect(result68.totalStatePension).toBe(11500);
});

test('calculateHouseholdStatePension handles couple with different ages', () => {
  const household = createHousehold({
    type: 'couple',
    person1: { currentAge: 68, statePensionAge: 67, expectedStatePension: 11500 },
    person2: { currentAge: 65, statePensionAge: 67, expectedStatePension: 9000 }
  });
  
  // Person1 is 68, Person2 is 65 - only person1 gets State Pension
  const result = calculateHouseholdStatePension(household, 68);
  expect(result.person1StatePension).toBe(11500);
  expect(result.person2StatePension).toBe(0);
  expect(result.totalStatePension).toBe(11500);
  
  // When Person1 is 70, Person2 is 67 - both get State Pension
  const resultLater = calculateHouseholdStatePension(household, 70);
  expect(resultLater.person1StatePension).toBe(11500);
  expect(resultLater.person2StatePension).toBe(9000);
  expect(resultLater.totalStatePension).toBe(20500);
});

test('getSurvivorStatus returns no survivor for single before death', () => {
  const household = createHousehold({
    type: 'single',
    person1: { currentAge: 55, retirementAge: 65, lifeExpectancy: 90 }
  });
  
  const result = getSurvivorStatus(household, 85);
  expect(result.isSurvivorYear).toBeFalsy();
});

test('getSurvivorStatus returns survivor for couple after first death', () => {
  const household = createHousehold({
    type: 'couple',
    person1: { currentAge: 55, retirementAge: 65, lifeExpectancy: 85 },
    person2: { currentAge: 52, retirementAge: 63, lifeExpectancy: 90 }
  });
  
  // When person1 is 86, they are past life expectancy
  const result = getSurvivorStatus(household, 86);
  expect(result.isSurvivorYear).toBeTruthy();
  expect(result.survivingPerson).toBe(2);
});

test('calculateHouseholdSpending applies survivor ratio', () => {
  const household = createHousehold({
    type: 'couple',
    person1: { currentAge: 55, retirementAge: 65, lifeExpectancy: 80 },
    person2: { currentAge: 52, retirementAge: 63, lifeExpectancy: 90 },
    survivorSpendingRatio: 0.65
  });
  
  // Before first death
  const spendingBefore = calculateHouseholdSpending(household, 50000, 79);
  expect(spendingBefore).toBe(50000);
  
  // After first death
  const spendingAfter = calculateHouseholdSpending(household, 50000, 82);
  expect(spendingAfter).toBeCloseTo(32500, 1); // 50000 * 0.65
});

test('validateHousehold returns valid for correct single household', () => {
  const household = createHousehold({
    type: 'single',
    person1: { currentAge: 55, retirementAge: 65 }
  });
  const result = validateHousehold(household);
  expect(result.valid).toBeTruthy();
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// INTEGRATION: PROJECTIONS WITH NEW MODULES
// ═══════════════════════════════════════════════════════════════

console.log('INTEGRATION: PROJECTIONS WITH SPENDING POLICY');
console.log('─────────────────────────────────────────────────────────────────');

test('createPlan with age-based spending reductions', () => {
  const plan = createPlan({
    currentAge: 55,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 300000,
    applyAgeBasedSpendingReductions: true
  });
  
  expect(plan.spendingRules).toBeTruthy();
  expect(plan.spendingRules.applyDefaultReductions).toBeTruthy();
});

test('runProjection applies age-based spending reductions', () => {
  const plan = createPlan({
    currentAge: 60,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 400000,
    currentIsa: 100000,
    statePensionAge: 67,
    expectedStatePension: 11500,
    applyAgeBasedSpendingReductions: true
  });
  
  const result = runProjection(plan, { endAge: 95 });
  
  // Check that spending reduces at age 80
  const year79 = result.decumulation.years.find(y => y.age === 79);
  const year82 = result.decumulation.years.find(y => y.age === 82);
  
  expect(year79.targetSpending).toBe(30000);
  expect(year82.targetSpending).toBeCloseTo(25500, 1); // 30000 * 0.85
  
  // Check that spending further reduces at age 90
  const year92 = result.decumulation.years.find(y => y.age === 92);
  expect(year92.targetSpending).toBeCloseTo(22500, 1); // 30000 * 0.75
});

test('runProjection with custom spending rules', () => {
  const customRules = createSpendingRules({
    baseSpending: 35000,
    ageAdjustments: [
      { fromAge: 75, reductionPercent: 10 },
      { fromAge: 85, reductionPercent: 20 }
    ]
  });
  
  const plan = createPlan({
    currentAge: 60,
    retirementAge: 65,
    targetNetIncome: 35000,
    currentPension: 500000,
    spendingRules: customRules
  });
  
  const result = runProjection(plan, { endAge: 90 });
  
  const year70 = result.decumulation.years.find(y => y.age === 70);
  const year76 = result.decumulation.years.find(y => y.age === 76);
  const year86 = result.decumulation.years.find(y => y.age === 86);
  
  expect(year70.targetSpending).toBe(35000);
  expect(year76.targetSpending).toBeCloseTo(31500, 1); // 35000 * 0.90
  expect(year86.targetSpending).toBeCloseTo(28000, 1); // 35000 * 0.80
});

test('backward compatibility: flat spending without reductions', () => {
  const plan = createPlan({
    currentAge: 55,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 300000
    // applyAgeBasedSpendingReductions is false by default
  });
  
  const result = runProjection(plan, { endAge: 95 });
  
  const year85 = result.decumulation.years.find(y => y.age === 85);
  expect(year85.targetSpending).toBe(30000); // No reduction
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// MONTE CARLO ENHANCEMENTS
// ═══════════════════════════════════════════════════════════════

console.log('MONTE CARLO ENHANCEMENTS (PHASE 3)');
console.log('─────────────────────────────────────────────────────────────────');

import {
  runMonteCarloWithBands,
  generateFanChartData,
  generateDepletionHistogram,
  getConfidenceInterpretation,
  runSingleSimulationWithTracking,
  generateReturnSequence
} from '../engine/monteCarlo.js';

test('runSingleSimulationWithTracking returns yearly balance data', () => {
// ENHANCED ASSUMPTIONS MODULE TESTS
// ═══════════════════════════════════════════════════════════════

console.log('ENHANCED ASSUMPTIONS MODULE');
console.log('─────────────────────────────────────────────────────────────────');

import { 
  getEffectiveReturn, 
  getEffectiveVolatility,
  realToNominal,
  nominalToReal,
  getDocumentedDefaults
} from '../engine/assumptions.js';

test('getEffectiveReturn returns single rate when phase-based disabled', () => {
  const assumptions = createUserAssumptions({ usePhaseBasedReturns: false });
  expect(getEffectiveReturn(assumptions, 'accumulation')).toBe(assumptions.netGrowthRate);
  expect(getEffectiveReturn(assumptions, 'decumulation')).toBe(assumptions.netGrowthRate);
});

test('getEffectiveReturn returns phase-based rates when enabled', () => {
  const assumptions = createUserAssumptions({ 
    usePhaseBasedReturns: true,
    preRetirementReturn: 0.05,
    postRetirementReturn: 0.03,
    feeRate: 0.005
  });
  expect(getEffectiveReturn(assumptions, 'accumulation')).toBeCloseTo(0.045, 0.001);
  expect(getEffectiveReturn(assumptions, 'decumulation')).toBeCloseTo(0.025, 0.001);
});

test('realToNominal converts correctly', () => {
  const real = 100000;
  const years = 10;
  const inflation = 0.02;
  const nominal = realToNominal(real, years, inflation);
  expect(nominal).toBeCloseTo(121899, 10);
});

test('nominalToReal converts correctly', () => {
  const nominal = 121899;
  const years = 10;
  const inflation = 0.02;
  const real = nominalToReal(nominal, years, inflation);
  expect(real).toBeCloseTo(100000, 10);
});

test('getDocumentedDefaults returns documented values', () => {
  const docs = getDocumentedDefaults();
  expect(docs.growthRate).toBeTruthy();
  expect(docs.growthRate.value).toBeTruthy();
  expect(docs.growthRate.rationale).toBeTruthy();
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// CARE COST SCENARIOS TESTS
// ═══════════════════════════════════════════════════════════════

console.log('CARE COST SCENARIOS');
console.log('─────────────────────────────────────────────────────────────────');

import { getCareCostsAtAge, CARE_COST_SCENARIOS, getCareScenarioOptions } from '../engine/spendingPolicy.js';

test('createSpendingRules handles care scenario preset', () => {
  const rules = createSpendingRules({
    baseSpending: 30000,
    careScenario: 'moderate'
  });
  expect(rules.careScenario).toBeTruthy();
  expect(rules.careScenario.annualCost).toBe(35000);
  expect(rules.careScenario.startAge).toBe(85);
  expect(rules.careScenario.duration).toBe(2);
});

test('createSpendingRules handles custom care scenario', () => {
  const rules = createSpendingRules({
    baseSpending: 30000,
    careScenario: {
      annualCost: 50000,
      startAge: 88,
      duration: 3
    }
  });
  expect(rules.careScenario.annualCost).toBe(50000);
  expect(rules.careScenario.startAge).toBe(88);
});

test('getCareCostsAtAge returns correct costs during care period', () => {
  const rules = createSpendingRules({
    baseSpending: 30000,
    careScenario: 'moderate'  // 85-87, £35k/year
  });
  
  expect(getCareCostsAtAge(rules, 84)).toBe(0);  // Before care
  expect(getCareCostsAtAge(rules, 85)).toBe(35000);  // During care
  expect(getCareCostsAtAge(rules, 86)).toBe(35000);  // During care
  expect(getCareCostsAtAge(rules, 87)).toBe(0);  // After care (endAge is exclusive)
});

test('calculateYearlySpending includes care costs', () => {
  const rules = createSpendingRules({
    baseSpending: 30000,
    applyDefaultReductions: false,
    careScenario: 'moderate'
  });
  
  const result = calculateYearlySpending(rules, 85);
  expect(result.regular).toBe(30000);
  expect(result.care).toBe(35000);
  expect(result.total).toBe(65000);
});

test('getCareScenarioOptions returns all scenarios', () => {
  const options = getCareScenarioOptions();
  expect(options.length).toBe(Object.keys(CARE_COST_SCENARIOS).length);
  expect(options.find(o => o.id === 'moderate')).toBeTruthy();
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// MONTE CARLO WITH BANDS TESTS
// ═══════════════════════════════════════════════════════════════

console.log('MONTE CARLO WITH FAN CHART DATA');
console.log('─────────────────────────────────────────────────────────────────');

import { runMonteCarloWithBands } from '../engine/monteCarlo.js';

test('runMonteCarloWithBands generates yearly percentile bands', () => {
  const plan = createPlan({
    currentAge: 55,
    retirementAge: 60,
    targetNetIncome: 25000,
    currentPension: 300000,
    currentIsa: 50000,
    currentPension: 250000,
    annualPensionContribution: 10000,
    statePensionAge: 67,
    expectedStatePension: 11500
  });
  
  const accReturns = generateReturnSequence(5, 0.04, 0.15, 12345);
  const decReturns = generateReturnSequence(20, 0.04, 0.15, 12346);
  
  const result = runSingleSimulationWithTracking(plan, accReturns, decReturns, 80);
  
  expect(result.yearlyData).toBeTruthy();
  expect(result.yearlyData.length).toBeGreaterThan(0);
  expect(result.finalResult).toBeTruthy();
  expect(result.finalResult.finalBalance).toBeGreaterThan(-1); // Always valid
});

test('runMonteCarloWithBands returns yearly percentile bands', () => {
  const plan = createPlan({
    currentAge: 55,
    retirementAge: 60,
    targetNetIncome: 20000,
    currentPension: 300000,
    currentIsa: 100000,
  const result = runMonteCarloWithBands(plan, { iterations: 50, endAge: 70, seed: 12345 });
  
  expect(result.yearlyBands).toBeTruthy();
  expect(result.yearlyBands.length).toBeGreaterThan(0);
  
  // Check band structure
  const band = result.yearlyBands[0];
  expect(band.age).toBeTruthy();
  expect(typeof band.p10).toBe('number');
  expect(typeof band.p50).toBe('number');
  expect(typeof band.p90).toBe('number');
  
  // p10 should be less than p90
  expect(band.p10).toBeLessThan(band.p90);
});

test('runMonteCarloWithBands includes depletion histogram when applicable', () => {
  // Create a scenario likely to have some depletions
  const plan = createPlan({
    currentAge: 60,
    retirementAge: 62,
    targetNetIncome: 50000,  // High spending
    currentPension: 200000,   // Moderate savings
    statePensionAge: 67,
    expectedStatePension: 11500
  });
  
  const result = runMonteCarloWithBands(plan, { iterations: 100, endAge: 90, seed: 54321 });
  
  // May or may not have depletions depending on random returns
  if (result.statistics.depletionAge) {
    expect(result.statistics.depletionAge.histogram).toBeTruthy();
    expect(Array.isArray(result.statistics.depletionAge.histogram)).toBeTruthy();
  }
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// CONFIDENCE EXPLAINER TESTS
// ═══════════════════════════════════════════════════════════════

console.log('CONFIDENCE EXPLAINER');
console.log('─────────────────────────────────────────────────────────────────');

import { generateConfidenceExplanation, getSuccessDefinition } from '../ui/components/confidenceExplainer.js';

test('generateConfidenceExplanation produces valid output', () => {
  const mockMcResult = {
    iterations: 1000,
    statistics: {
      successRate: 0.85,
      depletionAge: {
        count: 150,
        earliest: 78,
        median: 82,
        latest: 88
      }
    }
  };
  
  const explanation = generateConfidenceExplanation(mockMcResult, 90);
  
  expect(explanation.core.percentage).toBe('85');
  expect(explanation.core.successCount).toBe(850);
  expect(explanation.core.failureCount).toBe(150);
  expect(explanation.core.level.label).toBe('High');
  expect(explanation.caveats.length).toBeGreaterThan(0);
});

test('getSuccessDefinition returns clear definition', () => {
  const definition = getSuccessDefinition(90);
  expect(definition).toContain('90');
  expect(definition).toContain('Portfolio');
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// DB PENSION MODULE TESTS
// ═══════════════════════════════════════════════════════════════

console.log('DB PENSION MODULE');
console.log('─────────────────────────────────────────────────────────────────');

import { 
  createDBPension, 
  calculateDBIncomeAtAge, 
  calculateHouseholdDBIncome,
  validateDBPension,
  getDBPensionSummary,
  calculateDBLifetimeValue
} from '../engine/dbPension.js';

test('createDBPension creates valid configuration', () => {
  const db = createDBPension({
    name: 'Test DB',
    annualIncome: 15000,
    startAge: 65,
    inflationLinking: 'cpi'
  });
  
  expect(db.annualIncome).toBe(15000);
  expect(db.startAge).toBe(65);
  expect(db.inflationLinking).toBe('cpi');
  expect(db.survivorBenefit).toBeTruthy();
  expect(db.survivorRate).toBe(0.5);
});

test('createDBPension throws for invalid inputs', () => {
  expect(() => createDBPension({ annualIncome: -1000, startAge: 65 })).toThrow();
  expect(() => createDBPension({ annualIncome: 15000, startAge: 50 })).toThrow();
});

test('calculateDBIncomeAtAge returns 0 before start age', () => {
  const db = createDBPension({
    annualIncome: 15000,
    startAge: 65
  });
  
  expect(calculateDBIncomeAtAge(db, 60)).toBe(0);
  expect(calculateDBIncomeAtAge(db, 64)).toBe(0);
});

test('calculateDBIncomeAtAge returns income at start age', () => {
  const db = createDBPension({
    annualIncome: 15000,
    startAge: 65,
    inflationLinking: 'none'
  });
  
  expect(calculateDBIncomeAtAge(db, 65)).toBe(15000);
  expect(calculateDBIncomeAtAge(db, 70)).toBe(15000);  // Level pension
});

test('calculateDBIncomeAtAge applies CPI linking', () => {
  const db = createDBPension({
    annualIncome: 15000,
    startAge: 65,
    inflationLinking: 'cpi'
  });
  
  // At age 66, one year of 2% inflation
  const income66 = calculateDBIncomeAtAge(db, 66, 0.02);
  expect(income66).toBeCloseTo(15300, 1);  // 15000 * 1.02
  
  // At age 70, five years of 2% inflation
  const income70 = calculateDBIncomeAtAge(db, 70, 0.02);
  expect(income70).toBeCloseTo(16561.21, 1);  // 15000 * 1.02^5
});

test('calculateDBIncomeAtAge applies CPI cap', () => {
  const db = createDBPension({
    annualIncome: 15000,
    startAge: 65,
    inflationLinking: 'cpi',
    cpiCap: 0.025  // 2.5% cap
  });
  
  // With 5% inflation, should be capped at 2.5%
  const income66 = calculateDBIncomeAtAge(db, 66, 0.05);
  expect(income66).toBeCloseTo(15375, 1);  // 15000 * 1.025
});

test('calculateDBIncomeAtAge applies fixed increase', () => {
  const db = createDBPension({
    annualIncome: 15000,
    startAge: 65,
    inflationLinking: 'fixed',
    fixedIncreaseRate: 0.03  // 3% fixed
  });
  
  // At age 67, two years of 3% increase
  const income67 = calculateDBIncomeAtAge(db, 67, 0.02);
  expect(income67).toBeCloseTo(15913.50, 1);  // 15000 * 1.03^2 = 15913.50
});

test('calculateHouseholdDBIncome sums multiple pensions', () => {
  // Use 'none' inflation linking for precise test
  const db1 = createDBPension({ annualIncome: 10000, startAge: 65, inflationLinking: 'none' });
  const db2 = createDBPension({ annualIncome: 8000, startAge: 60, inflationLinking: 'none' });
  
  const result = calculateHouseholdDBIncome([db1, db2], null, 65);
  
  expect(result.person1Total).toBe(18000);  // Both pensions paying
  expect(result.householdTotal).toBe(18000);
});

test('calculateHouseholdDBIncome handles couple', () => {
  const person1DB = [createDBPension({ annualIncome: 12000, startAge: 65 })];
  const person2DB = [createDBPension({ annualIncome: 8000, startAge: 60 })];
  
  const result = calculateHouseholdDBIncome(person1DB, person2DB, 68, 65);
  
  expect(result.person1Total).toBeGreaterThan(12000);  // With CPI
  expect(result.person2Total).toBeGreaterThan(8000);   // With CPI
  expect(result.householdTotal).toBe(result.person1Total + result.person2Total);
});

test('validateDBPension returns valid for correct input', () => {
  const db = createDBPension({ annualIncome: 15000, startAge: 65 });
  const result = validateDBPension(db);
  expect(result.valid).toBeTruthy();
});

test('getDBPensionSummary returns formatted summary', () => {
  const db = createDBPension({
    name: 'Civil Service Pension',
    annualIncome: 20000,
    startAge: 65,
    inflationLinking: 'cpi',
    cpiCap: 0.025
  });
  
  const summary = getDBPensionSummary(db);
  expect(summary.name).toBe('Civil Service Pension');
  expect(summary.annualIncome).toContain('20,000');
  expect(summary.inflationLinking).toContain('capped');
});

test('calculateDBLifetimeValue computes total and present value', () => {
  const db = createDBPension({
    annualIncome: 15000,
    startAge: 65,
    inflationLinking: 'none'
  });
  
  const lifetime = calculateDBLifetimeValue(db, 65, 90);
  
  expect(lifetime.totalNominal).toBe(15000 * 26);  // 26 years (65-90 inclusive)
  expect(lifetime.presentValue).toBeLessThan(lifetime.totalNominal);  // Discounted
  expect(lifetime.years).toBe(26);
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
