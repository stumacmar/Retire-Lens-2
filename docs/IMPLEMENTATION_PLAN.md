# RetireLens 2 - Incremental Implementation Plan

## Part 3: Phased Delivery

This document outlines the phased delivery plan for implementing the identified gaps, ensuring each phase is independently shippable while preserving existing functionality.

---

## Phase 1: Assumptions & Spending Policy

### Objectives
- User-configurable economic assumptions
- Age-based spending reduction
- Deterministic projection driven by new assumptions module

### Deliverables

#### 1.1 New File: `/engine/assumptions.js`

```javascript
/**
 * Creates user-configurable assumptions object
 * 
 * @param {object} overrides - User-specified values
 * @returns {object} Complete assumptions object
 */
export function createUserAssumptions(overrides = {}) {
  const defaults = {
    growthRate: 0.04,
    inflationRate: 0.02,
    volatility: 0.15,
    feeRate: 0.005,
    scenario: 'moderate'
  };
  
  return Object.freeze({
    ...defaults,
    ...overrides,
    netGrowthRate: (overrides.growthRate || defaults.growthRate) - (overrides.feeRate || defaults.feeRate)
  });
}

/**
 * Apply scenario preset
 * 
 * @param {string} scenario - 'conservative' | 'moderate' | 'optimistic'
 * @returns {object} Assumptions for that scenario
 */
export function applyScenarioPreset(scenario) {
  const presets = {
    conservative: { growthRate: 0.03, volatility: 0.18, feeRate: 0.005 },
    moderate: { growthRate: 0.04, volatility: 0.15, feeRate: 0.005 },
    optimistic: { growthRate: 0.05, volatility: 0.12, feeRate: 0.004 }
  };
  
  return createUserAssumptions({ ...presets[scenario], scenario });
}
```

#### 1.2 New File: `/engine/spendingPolicy.js`

```javascript
/**
 * Calculate spending at a given age, with age-based reductions
 * 
 * @param {number} baseSpending - Target annual spending
 * @param {number} age - Current age
 * @param {object[]} ageAdjustments - Array of { fromAge, reductionPercent }
 * @returns {number} Adjusted spending for that age
 */
export function calculateSpendingAtAge(baseSpending, age, ageAdjustments = []) {
  // Default: -15% at 80, -25% at 90
  const adjustments = ageAdjustments.length > 0 ? ageAdjustments : [
    { fromAge: 80, reductionPercent: 15 },
    { fromAge: 90, reductionPercent: 25 }
  ];
  
  let totalReduction = 0;
  for (const adj of adjustments) {
    if (age >= adj.fromAge) {
      totalReduction = Math.max(totalReduction, adj.reductionPercent);
    }
  }
  
  return baseSpending * (1 - totalReduction / 100);
}

/**
 * Create spending rules configuration
 */
export function createSpendingRules(options = {}) {
  return Object.freeze({
    baseSpending: options.baseSpending || 30000,
    ageAdjustments: options.ageAdjustments || [],
    applyDefaultReductions: options.applyDefaultReductions !== false,
    oneOffExpenses: options.oneOffExpenses || [],
    minimumBequest: options.minimumBequest || 0
  });
}
```

#### 1.3 Modifications to `/engine/projections.js`

- Add optional `spendingRules` parameter to `projectDecumulation()`
- Use `calculateSpendingAtAge()` instead of fixed `targetNetIncome`
- Keep backward compatibility: if no rules provided, use flat spending

#### 1.4 New File: `/config/scenarios.js`

```javascript
export const SCENARIO_PRESETS = {
  conservative: {
    name: 'Conservative',
    description: 'Lower growth, higher volatility',
    assumptions: { growthRate: 0.03, volatility: 0.18, feeRate: 0.005 }
  },
  moderate: {
    name: 'Moderate',
    description: 'Balanced assumptions',
    assumptions: { growthRate: 0.04, volatility: 0.15, feeRate: 0.005 }
  },
  optimistic: {
    name: 'Optimistic',
    description: 'Higher growth, lower volatility',
    assumptions: { growthRate: 0.05, volatility: 0.12, feeRate: 0.004 }
  }
};
```

### Tests for Phase 1

```javascript
// tests/assumptions.test.js
test('createUserAssumptions applies overrides', () => { ... });
test('applyScenarioPreset returns conservative values', () => { ... });

// tests/spendingPolicy.test.js
test('calculateSpendingAtAge applies default reductions', () => {
  expect(calculateSpendingAtAge(30000, 75)).toBe(30000);
  expect(calculateSpendingAtAge(30000, 82)).toBe(25500); // -15%
  expect(calculateSpendingAtAge(30000, 92)).toBe(22500); // -25%
});
```

### Acceptance Criteria

- [ ] Assumptions can be overridden per-plan
- [ ] Spending automatically reduces at age 80 and 90 (configurable)
- [ ] Existing tests continue to pass
- [ ] Debug output shows adjusted spending at each age

---

## Phase 2: Household & Couples Model

### Objectives
- Single vs couple household modelling
- Dual State Pension logic
- Shared spending target with survivor adjustment

### Deliverables

#### 2.1 New File: `/engine/household.js`

```javascript
/**
 * Create household configuration
 */
export function createHousehold(options) {
  const type = options.type || 'single';
  
  const person1 = {
    name: options.person1?.name || 'Person 1',
    currentAge: options.person1?.currentAge || options.currentAge,
    retirementAge: options.person1?.retirementAge || options.retirementAge,
    statePensionAge: options.person1?.statePensionAge || 67,
    expectedStatePension: options.person1?.expectedStatePension || 11500,
    lifeExpectancy: options.person1?.lifeExpectancy || 90
  };
  
  const person2 = type === 'couple' ? {
    name: options.person2?.name || 'Person 2',
    currentAge: options.person2?.currentAge,
    retirementAge: options.person2?.retirementAge,
    statePensionAge: options.person2?.statePensionAge || 67,
    expectedStatePension: options.person2?.expectedStatePension || 11500,
    lifeExpectancy: options.person2?.lifeExpectancy || 88
  } : null;
  
  return Object.freeze({ type, person1, person2 });
}

/**
 * Calculate household income at a given year
 * Includes State Pension from both partners based on age
 */
export function calculateHouseholdIncome(household, year, startYear) {
  const yearsElapsed = year - startYear;
  const age1 = household.person1.currentAge + yearsElapsed;
  
  let statePension = 0;
  
  // Person 1 State Pension
  if (age1 >= household.person1.statePensionAge) {
    statePension += household.person1.expectedStatePension;
  }
  
  // Person 2 State Pension (if couple)
  if (household.type === 'couple' && household.person2) {
    const age2 = household.person2.currentAge + yearsElapsed;
    if (age2 >= household.person2.statePensionAge) {
      statePension += household.person2.expectedStatePension;
    }
  }
  
  return { statePension };
}
```

#### 2.2 Modifications to `/engine/taxUK.js` (renamed from `tax.js`)

- Add `calculateHouseholdTax()` function
- Optimise withdrawals across two Personal Allowances
- Track tax separately for each person

#### 2.3 Modifications to `/engine/projections.js`

- Accept `Household` object instead of single-person inputs
- Track State Pension start for both partners
- Apply survivor spending ratio when one partner's life expectancy is reached

### Tests for Phase 2

```javascript
// tests/household.test.js
test('createHousehold creates single household', () => { ... });
test('createHousehold creates couple household', () => { ... });
test('calculateHouseholdIncome sums both State Pensions', () => {
  const household = createHousehold({
    type: 'couple',
    person1: { currentAge: 68, statePensionAge: 67, expectedStatePension: 11500 },
    person2: { currentAge: 65, statePensionAge: 67, expectedStatePension: 9000 }
  });
  
  // At start: only person1 gets State Pension
  expect(calculateHouseholdIncome(household, 2025, 2025).statePension).toBe(11500);
  
  // After 2 years: both get State Pension
  expect(calculateHouseholdIncome(household, 2027, 2025).statePension).toBe(20500);
});
```

### Acceptance Criteria

- [ ] Couples can be modelled with different ages
- [ ] Both State Pensions start at correct ages
- [ ] Tax optimisation uses both Personal Allowances
- [ ] Survivor spending ratio applies after first death
- [ ] Existing single-person tests continue to pass

---

## Phase 3: Monte Carlo Enhancements

### Objectives
- Fan chart data generation (p10/p50/p90 bands per year)
- Depletion age histogram
- Clear confidence explanation

### Deliverables

#### 3.1 Modifications to `/engine/monteCarlo.js`

```javascript
/**
 * Run Monte Carlo with year-by-year tracking for fan charts
 */
export function runMonteCarloWithBands(config, options = {}) {
  const { iterations = 1000, endAge = 90 } = options;
  
  // Track balances at each age across all iterations
  const yearlyBalances = {};  // { age: [balance1, balance2, ...] }
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const { yearlyData, finalResult } = runSingleSimulationWithTracking(config, options);
    
    // Store balance at each age
    for (const { age, balance } of yearlyData) {
      yearlyBalances[age] = yearlyBalances[age] || [];
      yearlyBalances[age].push(balance);
    }
    
    results.push(finalResult);
  }
  
  // Calculate percentile bands per year
  const yearlyBands = Object.entries(yearlyBalances).map(([age, balances]) => {
    balances.sort((a, b) => a - b);
    return {
      age: parseInt(age),
      p10: percentile(balances, 10),
      p25: percentile(balances, 25),
      p50: percentile(balances, 50),
      p75: percentile(balances, 75),
      p90: percentile(balances, 90)
    };
  });
  
  // Calculate depletion age histogram
  const depletionAges = results
    .filter(r => r.fundsDepleted)
    .map(r => r.depletionAge);
  
  return {
    iterations,
    successRate: results.filter(r => !r.fundsDepleted).length / iterations,
    yearlyBands,
    depletionAges: generateHistogram(depletionAges),
    // ... existing statistics
  };
}
```

#### 3.2 New File: `/ui/components/monteCarloCharts.js`

```javascript
/**
 * Render fan chart showing confidence bands
 */
export function renderFanChart(yearlyBands, deterministicData, canvasSelector) {
  // Use Chart.js to render:
  // - Filled area for p10-p90 range (light)
  // - Filled area for p25-p75 range (medium)
  // - Line for p50 (median)
  // - Dashed line for deterministic baseline
}

/**
 * Render depletion age histogram
 */
export function renderDepletionHistogram(depletionAges, canvasSelector) {
  // Bar chart showing distribution of "when money runs out"
}
```

#### 3.3 New File: `/ui/components/confidenceExplainer.js`

```javascript
/**
 * Render confidence explanation panel
 */
export function renderConfidenceExplainer(mcResult, containerSelector) {
  const successRate = mcResult.successRate;
  const successes = Math.round(successRate * 100);
  
  const html = `
    <div class="confidence-explainer">
      <h3>Understanding Your Confidence Score</h3>
      <p>
        <strong>${successes}%</strong> of simulated market scenarios result in 
        your money lasting until your target age.
      </p>
      <p>
        This means: in <strong>${successes} out of 100</strong> market simulations,
        your retirement income was fully funded.
      </p>
      ${getInterpretation(successRate)}
    </div>
  `;
}
```

### Tests for Phase 3

```javascript
// tests/monteCarlo.test.js
test('runMonteCarloWithBands returns yearly percentile bands', () => {
  const result = runMonteCarloWithBands(testConfig, { iterations: 100 });
  
  expect(result.yearlyBands).toBeDefined();
  expect(result.yearlyBands.length).toBeGreaterThan(0);
  expect(result.yearlyBands[0]).toHaveProperty('p10');
  expect(result.yearlyBands[0]).toHaveProperty('p50');
  expect(result.yearlyBands[0]).toHaveProperty('p90');
});

test('depletion histogram is generated correctly', () => {
  const result = runMonteCarloWithBands(testConfigWithDepletion, { iterations: 100 });
  
  if (result.depletionAges.count > 0) {
    expect(result.depletionAges.histogram).toBeDefined();
  }
});
```

### Acceptance Criteria

- [ ] Fan chart data available for visualization
- [ ] Depletion histogram shows when funds might run out
- [ ] Confidence is clearly explained in user-friendly terms
- [ ] Performance acceptable (1000 iterations < 2 seconds)

---

## Implementation Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 | 1 week | None |
| Phase 2 | 2 weeks | Phase 1 (for assumptions integration) |
| Phase 3 | 1 week | Phase 1, Phase 2 |

---

## Risk Mitigation

### Performance
- Monte Carlo iterations may be slow for complex households
- Mitigation: Use Web Workers for background computation

### Backward Compatibility
- Existing plans must continue to work
- Mitigation: All new parameters are optional with sensible defaults

### Mobile Usability
- New features must not break mobile experience
- Mitigation: Test on mobile after each phase; keep inputs simple

---

*Document Version: 1.0*  
*Plan Date: 2026-01-31*  
*Author: RetireLens Engineering Team*
