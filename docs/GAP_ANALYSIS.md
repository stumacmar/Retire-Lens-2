# RetireLens 2 - Forensic Gap Analysis

## Part 1: Structured Comparison

This document provides a **forensic gap analysis** comparing the current RetireLens-2 implementation against the capabilities required for a serious UK retirement planning tool, as described in the problem statement.

---

## 1. Economic Assumptions

### Current State (RetireLens-2)

| Feature | Status | Implementation |
|---------|--------|---------------|
| Real return rate | ✅ Fixed | `PROJECTION_DEFAULTS.defaultGrowthRate = 0.04` (4%) |
| Nominal vs real toggle | ❌ Missing | All calculations assume real returns |
| Inflation rate | ⚠️ Hardcoded | `inflationRate = 0.02` (not user-configurable) |
| Volatility | ⚠️ Hardcoded | `volatility = 0.15` (15% σ) |
| Asset mix selection | ❌ Missing | No asset allocation input |
| Fee rate | ⚠️ Hardcoded | `defaultFeeRate = 0.005` (0.5%) |
| Glidepath / de-risking | ❌ Missing | No age-based asset allocation |

### Why This Matters

- **User control**: Users cannot adjust assumptions to reflect their actual portfolio composition
- **Conservatism testing**: No way to test "what if markets are flat?" or "what if inflation is 4%?"
- **De-risking**: Standard advice to shift to bonds as approaching retirement is not modeled
- **Fee impact**: High-fee portfolios (1.5%+) have materially different outcomes

### Minimum Viable Implementation

1. **assumptions.js** module with user-configurable:
   - `growthRate` (real return, default 4%)
   - `inflationRate` (default 2%)
   - `volatility` (default 15%)
   - `feeRate` (default 0.5%)
   
2. **glidepath.js** module with:
   - Age-triggered de-risking rules
   - Equity percentage at retirement (default 60%)
   - Equity percentage at age 80 (default 30%)

---

## 2. Monte Carlo Modelling

### Current State (RetireLens-2)

| Feature | Status | Implementation |
|---------|--------|---------------|
| Simulation engine | ✅ Present | `runMonteCarlo()` in `monteCarlo.js` |
| Number of iterations | ✅ Configurable | Default 1000, option to override |
| Seeded RNG | ✅ Present | Mulberry32 PRNG for reproducibility |
| Success rate | ✅ Present | Binary: funds not depleted = success |
| Percentile outputs | ✅ Partial | p5/p10/p25/p50/p75/p90/p95 for final balance |
| Sequence-of-returns | ⚠️ Basic | Returns are i.i.d., no autocorrelation |
| Fan charts | ❌ Missing | No visualization of confidence bands |
| Depletion age histogram | ❌ Missing | No distribution of "when money runs out" |
| Anchored deterministic path | ❌ Missing | MC results not anchored to base case |

### Why This Matters

- **Fan charts** are essential for communicating uncertainty to users
- **Depletion histograms** answer "when might my money run out?" with a distribution
- **Sequence-of-returns risk** is the biggest risk in early retirement; i.i.d. underestimates this
- **Anchoring** helps users understand deviation from the deterministic baseline

### Minimum Viable Implementation

1. **Fan chart data** generation:
   - Track balance at each age across all simulations
   - Return p10/p50/p90 bands per year

2. **Depletion histogram**:
   - Array of depletion ages across simulations
   - Histogram bin counts for visualization

3. **Sequence-of-returns** (Phase 3+):
   - Optional autocorrelated return model
   - Or bootstrap from historical UK returns

---

## 3. Household / Couples Modelling

### Current State (RetireLens-2)

| Feature | Status | Implementation |
|---------|--------|---------------|
| Single person | ✅ Present | All calculations assume one person |
| Two people | ❌ Missing | No household concept |
| Different ages | ❌ Missing | Cannot model age gaps |
| Different retirement dates | ❌ Missing | Cannot model staggered retirement |
| Survivor logic | ❌ Missing | No "after first death" modelling |
| Combined spending | ❌ Missing | No joint spending target |
| Joint to single transition | ❌ Missing | No spending reduction on first death |

### Why This Matters

- **50%+ of retirement plans** involve couples
- **Age gaps** create complex income patterns (e.g., one State Pension starts years before the other)
- **Survivor needs** are typically lower (rule of thumb: 60-70% of joint spending)
- **Tax efficiency** requires coordinating withdrawals across two people's allowances

### Minimum Viable Implementation

1. **household.js** module with:
   - `householdType`: 'single' | 'couple'
   - `person1`: { age, retirementAge, statePensionAge, expectedStatePension }
   - `person2`: { age, retirementAge, statePensionAge, expectedStatePension } | null

2. **Spending rules**:
   - `jointSpendingTarget`: annual £ for couple
   - `survivorSpendingRatio`: default 0.65 (65% of joint)

3. **Projection logic**:
   - Track both State Pensions separately
   - Apply correct tax to each person's income
   - Handle transition when first person dies (use life expectancy or user input)

---

## 4. Income Sources & UK Tax Realism

### Current State (RetireLens-2)

| Feature | Status | Implementation |
|---------|--------|---------------|
| DC pension | ✅ Present | Single pension pot with growth + drawdown |
| DB pension | ❌ Missing | No final salary/CARE pension support |
| State Pension (one person) | ✅ Present | Single State Pension from specified age |
| State Pension (two people) | ❌ Missing | No second State Pension |
| ISA drawdown | ✅ Present | Tax-free ISA with withdrawal strategy |
| PCLS handling | ✅ Present | 25% tax-free at crystallisation |
| Personal Allowance | ✅ Present | £12,570 with taper |
| Two personal allowances | ❌ Missing | Single-person tax only |
| Basic tax optimisation | ⚠️ Partial | PA-first strategy, but no cross-person optimisation |
| Bridging pre-State Pension | ⚠️ Implicit | Not explicitly modelled as a strategy |

### Why This Matters

- **DB pensions** are still held by millions; ignoring them means incomplete planning
- **Tax optimisation** across a couple can save thousands per year
- **Bridging strategy** (heavy drawdown before State Pension, light after) is a key planning tool
- **Personal Allowance usage** for both partners should be coordinated

### Minimum Viable Implementation

1. **DB pension support**:
   - Input: annual DB income, start age, inflation linkage (CPI/fixed/none)
   - Add to projection as fixed income from specified age

2. **Dual State Pension**:
   - Two separate State Pension entries
   - Each with own start age and amount

3. **Tax-efficient withdrawal ordering**:
   - Compare "ISA first" vs "pension first" vs "optimal"
   - For couples: draw down lower earner's pension first to use PA

---

## 5. Lifecycle Spending Behaviour

### Current State (RetireLens-2)

| Feature | Status | Implementation |
|---------|--------|---------------|
| Flat spending | ✅ Present | Constant `targetNetIncome` throughout retirement |
| Age-based reduction | ❌ Missing | No spending decline at 80+ |
| One-off expenses | ❌ Missing | No special expenses (car, holiday, etc.) |
| Care cost shocks | ❌ Missing | No late-life care modelling |
| End-of-life reserve | ❌ Missing | No "leave £X behind" logic |

### Why This Matters

- **Research shows** spending naturally declines in later retirement ("go-go, slow-go, no-go" phases)
- **Not modelling this** leads to over-saving in early retirement
- **Care costs** can be catastrophic (£50k-100k+ per year) and need scenario testing
- **Bequest motives** are real; many want to leave something to family

### Minimum Viable Implementation

1. **spendingPolicy.js** module with:
   - `spendingAtAge(baseSpending, age, rules)` function
   - Default rule: -15% from age 80, -25% from age 90
   - User-configurable reduction ages and percentages

2. **One-off expenses**:
   - Array of `{ age, amount, description }`
   - Subtracted from wealth in that year

3. **End-of-life reserve**:
   - `minimumBequest` amount to preserve
   - Affects sustainability calculations

---

## 6. UX & Decision Support

### Current State (RetireLens-2)

| Feature | Status | Implementation |
|---------|--------|---------------|
| Scenario presets | ❌ Missing | No "Conservative / Moderate / Aggressive" buttons |
| Plan A / B / C | ⚠️ Partial | Plan A vs Plan B only |
| Explain-why-this-fails | ⚠️ Basic | Generic suggestion only |
| Confidence definition | ⚠️ Implicit | "Success rate" without clear explanation |
| Transparent assumptions | ✅ Present | Assumptions panel with expandable details |
| Debug mode | ✅ Present | Year-by-year tables via `?debug=1` |

### Why This Matters

- **Scenario presets** help users quickly explore different assumptions
- **Multiple scenarios** (A/B/C) let users compare "retire at 60 vs 65 vs part-time"
- **Explanations** build trust and help users understand why plans fail
- **Confidence definitions** must be defensible ("X% of simulations last to age Y")

### Minimum Viable Implementation

1. **scenarios.js** config with:
   - "Conservative": 3% growth, 2% inflation, 18% volatility
   - "Moderate": 4% growth, 2% inflation, 15% volatility
   - "Optimistic": 5% growth, 2% inflation, 12% volatility

2. **Three-plan comparison**:
   - Extend UI to support Plan C
   - Side-by-side summary cards

3. **Failure explanation**:
   - If funds deplete, show: "Your money may run out at age X because..."
   - List contributing factors (low savings, high spending, early retirement, etc.)

4. **Confidence explainer**:
   - Define clearly: "90% confidence = 9 out of 10 simulated market scenarios last until age Y"

---

## Summary: What RetireLens-2 Cannot Currently Do

| Capability | Impact |
|------------|--------|
| Model a couple | 50%+ of users excluded |
| Age-based spending reduction | Over-conservative results |
| DB pension income | Millions of UK workers have these |
| Fan charts | Key communication tool missing |
| Glidepath de-risking | Standard advice not modelled |
| User-configurable assumptions | Locked to single scenario |
| One-off expenses | Can't model big purchases |
| Care cost scenarios | Major risk not addressed |
| Tax optimisation for couples | Suboptimal withdrawal advice |
| Sequence-of-returns risk | Underestimates early retirement risk |

---

## Priority Order for Implementation

Based on impact and complexity:

### Phase 1 (High Impact, Low Complexity)
1. **assumptions.js** - User-configurable growth, inflation, fees
2. **spendingPolicy.js** - Age-based spending reduction
3. **Deterministic projection refactor** - Use assumptions module throughout

### Phase 2 (High Impact, Medium Complexity)
4. **household.js** - Single vs couple modelling
5. **Dual State Pension** - Two separate State Pensions
6. **Dual Personal Allowance** - Tax calculation for both partners

### Phase 3 (Medium Impact, Higher Complexity)
7. **Fan chart data** - Monte Carlo percentile bands per year
8. **Depletion histogram** - Distribution of depletion ages
9. **Confidence explainer** - Clear definition of success metrics

### Phase 4 (Future)
10. DB pension support
11. Glidepath de-risking
12. One-off expenses
13. Care cost scenarios
14. Sequence-of-returns modelling

---

*Document Version: 1.0*  
*Analysis Date: 2026-01-31*  
*Author: RetireLens Engineering Team*
