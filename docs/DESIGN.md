# RetireLens 2 - Design Document

## Part 2: Design Before Code

This document defines the modular data model, interfaces between components, and clear definitions of success metrics.

---

## 1. Modular Data Model

### 1.1 Assumptions Model

```javascript
/**
 * User-configurable economic assumptions
 * All rates are annual decimals (0.04 = 4%)
 */
const Assumptions = {
  // Investment returns
  growthRate: 0.04,           // Real return after inflation (default 4%)
  inflationRate: 0.02,        // Long-term inflation assumption (default 2%)
  volatility: 0.15,           // Standard deviation for Monte Carlo (default 15%)
  feeRate: 0.005,             // Annual investment fees (default 0.5%)
  
  // Derived
  nominalGrowthRate: 0.06,    // growthRate + inflationRate
  netGrowthRate: 0.035,       // growthRate - feeRate
  
  // Scenario label
  scenario: 'moderate'        // 'conservative' | 'moderate' | 'optimistic' | 'custom'
};
```

### 1.2 Household Model

```javascript
/**
 * Household structure for single or couple modelling
 */
const Household = {
  type: 'single',             // 'single' | 'couple'
  
  // Primary person (always present)
  person1: {
    name: 'Person 1',
    currentAge: 45,
    retirementAge: 65,
    statePensionAge: 67,
    expectedStatePension: 11500,  // Annual State Pension
    lifeExpectancy: 90            // For projection end
  },
  
  // Secondary person (null if single)
  person2: null | {
    name: 'Person 2',
    currentAge: 43,
    retirementAge: 63,
    statePensionAge: 67,
    expectedStatePension: 11500,
    lifeExpectancy: 88
  }
};
```

### 1.3 Accounts Model

```javascript
/**
 * Financial accounts per person
 */
const Accounts = {
  // Per-person accounts
  person1: {
    dcPension: {
      currentValue: 200000,
      annualContribution: 15000,
      contributionEndAge: 65       // When contributions stop
    },
    isa: {
      currentValue: 50000,
      annualContribution: 10000,
      contributionEndAge: 65
    },
    dbPension: null | {           // Optional DB pension
      annualIncome: 8000,
      startAge: 65,
      inflationLinked: true       // CPI-linked or fixed
    }
  },
  
  // Person 2 accounts (null if single household)
  person2: null | {
    dcPension: { ... },
    isa: { ... },
    dbPension: null | { ... }
  }
};
```

### 1.4 Spending Rules Model

```javascript
/**
 * Lifecycle spending rules
 */
const SpendingRules = {
  // Base spending target (annual, net of tax)
  baseSpending: 35000,
  
  // Age-based adjustments
  ageAdjustments: [
    { fromAge: 80, reductionPercent: 15 },   // -15% from age 80
    { fromAge: 90, reductionPercent: 25 }    // -25% from age 90
  ],
  
  // One-off expenses (optional)
  oneOffExpenses: [
    { age: 70, amount: 25000, description: 'New car' },
    { age: 75, amount: 15000, description: 'Home repairs' }
  ],
  
  // Bequest motive (optional)
  minimumBequest: 0,            // Target amount to leave behind
  
  // Survivor spending (for couples)
  survivorSpendingRatio: 0.65   // 65% of joint spending after first death
};
```

---

## 2. Interface Definitions

### 2.1 Deterministic Engine Interface

```javascript
// engine/projections.js

/**
 * Create a projection configuration from user inputs
 * @param {Household} household - Household model
 * @param {Accounts} accounts - Accounts model
 * @param {SpendingRules} spending - Spending rules
 * @param {Assumptions} assumptions - Economic assumptions
 * @returns {ProjectionConfig} Immutable configuration object
 */
export function createProjectionConfig(household, accounts, spending, assumptions);

/**
 * Run deterministic projection
 * @param {ProjectionConfig} config - Configuration object
 * @param {object} options - { endAge?: number }
 * @returns {DeterministicResult}
 */
export function runDeterministicProjection(config, options);

/**
 * DeterministicResult structure
 */
interface DeterministicResult {
  config: ProjectionConfig;
  accumulation: {
    years: AccumulationYear[];
    finalBalances: { person1: Balances, person2?: Balances };
  };
  decumulation: {
    years: DecumulationYear[];
    fundsDepleted: boolean;
    depletionAge: number | null;
    finalBalances: Balances;
  };
  summary: {
    retirementPot: number;
    pclsTaken: number;
    yearsWithFullIncome: number;
    totalYearsInRetirement: number;
    successRate: number;          // 1.0 if funds never deplete, else fraction
    totalNetIncome: number;
    totalTaxPaid: number;
    finalBalance: number;
  };
}
```

### 2.2 Monte Carlo Engine Interface

```javascript
// engine/monteCarlo.js

/**
 * Run Monte Carlo simulation
 * @param {ProjectionConfig} config - Configuration object
 * @param {object} options - Monte Carlo options
 * @returns {MonteCarloResult}
 */
export function runMonteCarloSimulation(config, options);

/**
 * MonteCarloResult structure
 */
interface MonteCarloResult {
  iterations: number;
  seed: number | null;
  
  // Success/failure metrics
  successRate: number;              // Fraction of iterations with no depletion
  confidenceLevel: number;          // Equivalent percentile (e.g., 0.90 = 90%)
  
  // Final balance statistics
  finalBalance: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    mean: number;
  };
  
  // Depletion age distribution (only for failed iterations)
  depletionAges: {
    count: number;                  // How many iterations depleted
    earliest: number | null;
    median: number | null;
    latest: number | null;
    histogram: { age: number, count: number }[];
  };
  
  // Year-by-year percentile bands for fan charts
  yearlyBands: {
    age: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  }[];
  
  // Raw results (for detailed analysis)
  results: SimulationResult[];
}

/**
 * Generate fan chart data from Monte Carlo results
 * @param {MonteCarloResult} mcResult - Monte Carlo results
 * @returns {FanChartData}
 */
export function generateFanChartData(mcResult);
```

### 2.3 UI Component Interfaces

```javascript
// ui/components/assumptionsPanel.js

/**
 * Render assumptions configuration panel
 * @param {Assumptions} assumptions - Current assumptions
 * @param {function} onUpdate - Callback when assumptions change
 * @param {string} containerSelector - DOM selector
 */
export function renderAssumptionsEditor(assumptions, onUpdate, containerSelector);

// ui/components/monteCarloCharts.js

/**
 * Render fan chart visualization
 * @param {FanChartData} data - Fan chart data from Monte Carlo
 * @param {DeterministicResult} baseline - Deterministic baseline for comparison
 * @param {string} canvasSelector - Canvas element selector
 */
export function renderFanChart(data, baseline, canvasSelector);

/**
 * Render depletion age histogram
 * @param {DepletionAges} data - Depletion age distribution
 * @param {string} canvasSelector - Canvas element selector
 */
export function renderDepletionHistogram(data, canvasSelector);

// ui/components/confidenceExplainer.js

/**
 * Render confidence explanation panel
 * @param {MonteCarloResult} mcResult - Monte Carlo results
 * @param {DeterministicResult} detResult - Deterministic results
 * @param {string} containerSelector - DOM selector
 */
export function renderConfidenceExplainer(mcResult, detResult, containerSelector);
```

---

## 3. Success & Confidence Definitions

### 3.1 Definition of "Success"

For a **deterministic projection**, success is defined as:

> **Success**: The portfolio funds the target net income (adjusted for age) from retirement age until the specified end age (default: 90) without depletion.

Formally:
- Let `B(t)` = portfolio balance at age `t`
- Let `W(t)` = required withdrawal at age `t` (after tax, to meet spending)
- **Success** if `B(t) >= 0` for all `t` from retirement age to end age

For a **partial success** (funds deplete mid-retirement):
- Success Rate = (years funded) / (total retirement years)
- Example: Funding 25 of 30 years = 83.3% success rate

### 3.2 Definition of "Confidence %"

For a **Monte Carlo simulation**, confidence is defined as:

> **Confidence**: The percentage of simulated market scenarios in which the portfolio successfully funds retirement spending without depletion.

Formally:
- Run `N` simulations with random return sequences
- Let `S` = number of simulations where funds never deplete
- **Confidence = S / N × 100%**

#### Interpretation Guide

| Confidence | Interpretation |
|------------|---------------|
| ≥95% | Very robust - high probability of success |
| 85-94% | Robust - good probability, some market risk |
| 70-84% | Moderate - meaningful risk of shortfall |
| 50-69% | Uncertain - consider adjustments |
| <50% | High risk - plan likely needs changes |

### 3.3 User-Facing Explanation

The UI should present confidence as:

> "In **X out of 100** simulated market scenarios, your money lasts until age Y."

Or equivalently:

> "There is a **X%** probability that your retirement income is fully funded, based on historical market variability."

### 3.4 Important Caveats (to be displayed)

1. **Model limitations**: Assumes returns are normally distributed; real markets may have fat tails
2. **Sequence-of-returns**: Early retirement returns matter most; this is captured in Monte Carlo
3. **Not financial advice**: This tool provides projections, not guarantees
4. **Assumptions may change**: Tax rules, State Pension age, and inflation may differ from assumptions

---

## 4. Module File Structure

```
/engine
  assumptions.js          # createAssumptions(), applyScenarioPreset()
  spendingPolicy.js       # calculateSpendingAtAge(), applyOneOffExpenses()
  household.js            # createHousehold(), calculateHouseholdIncome()
  projections.js          # createProjectionConfig(), runDeterministicProjection()
  monteCarlo.js           # runMonteCarloSimulation(), generateFanChartData()
  taxUK.js               # calculateTaxForPerson(), calculateHouseholdTax()
  withdrawals.js          # calculateOptimalWithdrawal() (existing)

/ui
  components/
    assumptionsPanel.js   # Editable assumptions UI
    confidenceExplainer.js # Success/confidence explanation
    monteCarloCharts.js   # Fan charts, depletion histogram
    inputs.js             # Existing input components
  screens/
    forms.js              # Existing form handlers
    navigation.js         # Existing navigation
    results.js            # Enhanced results display

/config
  defaults.js             # Existing defaults
  scenarios.js            # Scenario presets (conservative, moderate, optimistic)
```

---

## 5. Backward Compatibility

### 5.1 Existing API Preservation

The existing `createPlan()` and `runProjection()` functions will continue to work:

```javascript
// Existing API (preserved)
const plan = createPlan({
  currentAge: 45,
  retirementAge: 65,
  targetNetIncome: 35000,
  currentPension: 200000,
  annualPensionContribution: 15000,
  // ...
});

const result = runProjection(plan);
```

Internally, `createPlan()` will construct:
- A single-person `Household`
- A single-person `Accounts` object
- Default `SpendingRules` (flat spending)
- Default `Assumptions`

### 5.2 Migration Path

New features will be opt-in:

```javascript
// New API (opt-in for new features)
const household = createHousehold({ type: 'couple', ... });
const accounts = createAccounts({ ... });
const spending = createSpendingRules({ ageAdjustments: [...] });
const assumptions = createAssumptions({ growthRate: 0.03 });

const config = createProjectionConfig(household, accounts, spending, assumptions);
const result = runDeterministicProjection(config);
```

---

*Document Version: 1.0*  
*Design Date: 2026-01-31*  
*Author: RetireLens Engineering Team*
