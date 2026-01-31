# RetireLens 2

**Income-first retirement planning engine for UK pensions**

> "Can I retire at age X with £Y net income, and how robust is that outcome?"

## Architecture

RetireLens 2 is a clean-sheet redesign with a clear separation between:

- **Engine** (`/engine`) - Pure calculation functions with no UI dependencies
- **UI** (`/ui`) - Mobile-first one-question-per-screen flow
- **Config** (`/config`) - UK tax, pension, and projection assumptions
- **Docs** (`/docs`) - Design documents and analysis

### Key Features

- ✅ **Deterministic projections** with transparent assumptions
- ✅ **Monte Carlo** deviation bands for robustness analysis
- ✅ **Plan A vs Plan B** isolated comparison with numeric deltas
- ✅ **UK-specific** tax calculations (Personal Allowance, PCLS, ISA)
- ✅ **User-configurable assumptions** with scenario presets
- ✅ **Age-based spending reductions** (go-go, slow-go, no-go phases)
- ✅ **Household modelling** foundation (single and couples)
- ✅ **Debug mode** with year-by-year tables (`?debug=1`)
- ✅ **100% private** - all calculations run in-browser

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm run test:all

# Run specific test suites
npm run test:engine    # Core engine tests
npm run test:modules   # New modules tests

# Start development server
npx http-server -p 8080

# Open in browser
open http://localhost:8080
```

## File Structure

```
/engine
  projections.js    # Core projection engine
  tax.js            # UK income tax calculations
  withdrawals.js    # PCLS, ISA vs pension sequencing
  monteCarlo.js     # Stochastic simulation
  assumptions.js    # User-configurable economic assumptions
  spendingPolicy.js # Age-based spending rules
  household.js      # Single vs couple modelling

/ui
  screens/          # One-question-per-screen flow
  components/       # Reusable UI components
  state.js          # Application state management

/config
  defaults.js       # UK tax thresholds, assumptions
  scenarios.js      # Scenario presets (conservative/moderate/optimistic)

/docs
  GAP_ANALYSIS.md       # RetireLens-1 vs 2 comparison
  DESIGN.md             # Data model and interfaces
  IMPLEMENTATION_PLAN.md # Phased delivery plan

/tests
  engine.test.js    # Core engine tests (26 tests)
  newModules.test.js # New module tests (34 tests)

index.html          # Thin shell with embedded app
```

## New Capabilities

### User-Configurable Assumptions

```javascript
import { createUserAssumptions, applyScenarioPreset } from './engine/assumptions.js';

// Custom assumptions
const assumptions = createUserAssumptions({
  growthRate: 0.03,     // 3% real return
  inflationRate: 0.025, // 2.5% inflation
  volatility: 0.18,     // 18% standard deviation
  feeRate: 0.006        // 0.6% annual fees
});

// Or use presets
const conservative = applyScenarioPreset('conservative');
const moderate = applyScenarioPreset('moderate');
const optimistic = applyScenarioPreset('optimistic');
```

### Age-Based Spending Reductions

```javascript
import { createSpendingRules, calculateSpendingAtAge } from './engine/spendingPolicy.js';

// Enable default reductions: -15% at 80, -25% at 90
const plan = createPlan({
  targetNetIncome: 30000,
  applyAgeBasedSpendingReductions: true,
  // ...
});

// Or custom rules
const customRules = createSpendingRules({
  baseSpending: 35000,
  ageAdjustments: [
    { fromAge: 75, reductionPercent: 10 },
    { fromAge: 85, reductionPercent: 20 }
  ],
  oneOffExpenses: [
    { age: 70, amount: 25000, description: 'New car' }
  ]
});
```

### Household Modelling (Foundation)

```javascript
import { createHousehold, calculateHouseholdStatePension } from './engine/household.js';

// Single household
const single = createHousehold({
  type: 'single',
  person1: { currentAge: 55, retirementAge: 65 }
});

// Couple with different ages
const couple = createHousehold({
  type: 'couple',
  person1: { name: 'Alice', currentAge: 55, retirementAge: 65 },
  person2: { name: 'Bob', currentAge: 52, retirementAge: 63 },
  survivorSpendingRatio: 0.65
});
```

## Model Defaults

- **Personal Allowance**: £12,570 (tapers above £100k)
- **PCLS (Tax-Free Cash)**: 25% of pension pot
- **State Pension Age**: 67 (configurable)
- **Real Return**: 4% after inflation (configurable)
- **Default Life Expectancy**: Age 90
- **Spending Reductions**: -15% at age 80, -25% at age 90 (opt-in)

## Debug Mode

Add `?debug=1` to URL for:
- Console logging with categories
- Year-by-year projection tables
- State hash tracking for drift detection
- Export function: `window.__RL_EXPORT_DEBUG_LOG__()`

## Inspired By

Best practices from RetireLens 1:
- Single source of truth (`buildProjection`)
- Deep cloning + Object.freeze for state isolation
- Seeded RNG (Mulberry32) for reproducible Monte Carlo
- Withdrawal rate sustainability indicator
- 100-iteration consistency testing

## License

MIT
