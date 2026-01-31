# RetireLens 2

**Income-first retirement planning engine for UK pensions**

> "Can I retire at age X with £Y net income, and how robust is that outcome?"

## Architecture

RetireLens 2 is a clean-sheet redesign with a clear separation between:

- **Engine** (`/engine`) - Pure calculation functions with no UI dependencies
- **UI** (`/ui`) - Mobile-first one-question-per-screen flow
- **Config** (`/config`) - UK tax, pension, and projection assumptions

### Key Features

- ✅ **Deterministic projections** with transparent assumptions
- ✅ **Monte Carlo** deviation bands for robustness analysis
- ✅ **Plan A vs Plan B** isolated comparison with numeric deltas
- ✅ **UK-specific** tax calculations (Personal Allowance, PCLS, ISA)
- ✅ **Debug mode** with year-by-year tables (`?debug=1`)
- ✅ **100% private** - all calculations run in-browser

## Quick Start

```bash
# Run tests
node tests/engine.test.js

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

/ui
  screens/          # One-question-per-screen flow
  components/       # Reusable UI components
  state.js          # Application state management

/config
  defaults.js       # UK tax thresholds, assumptions

/tests
  engine.test.js    # Deterministic test scenarios

index.html          # Thin shell with embedded app
```

## Model

- **Personal Allowance**: £12,570 (tapers above £100k)
- **PCLS (Tax-Free Cash)**: 25% of pension pot
- **State Pension Age**: 67 (configurable)
- **Real Return**: 4% after inflation (configurable)
- **Default Life Expectancy**: Age 90

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
