# RetireLens Pro - CHANGELOG

## v0.9.4 - Couples + Tax + PCLS Engine

Release Date: 2026-02-04

### Overview

RetireLens Pro introduces a real couples retirement model, credible per-person UK tax calculations, proper PCLS (Pension Commencement Lump Sum) handling, and critical bug fixes. This release maintains the existing fast, mobile-first UX while adding institutional-grade retirement planning capabilities.

### New Features

#### 1. Enhanced Couples Model
- **Person model extended** with full DC pension support (pot, monthly/annual contributions), DB pension support (annual amount, start age), and ISA support (balance, annual contributions)
- **Household timeline** shows phased income sources - different State Pension and DB pension start dates for each person
- **Per-person tax** - each person gets their own personal allowance (£12,570 each = £25,140 combined)
- **Partner input fields** on review screen for: age, retirement age, State Pension age/amount, DB pension amount/start age

#### 2. Credible UK Tax Engine
- `computeUKTax()` - comprehensive tax calculation for mixed retirement income
- `calculateCouplesTax()` - per-person tax calculation with household totals
- Handles taxable sources (State Pension, DB Pension, DC withdrawals) separately from tax-free sources (ISA, PCLS)
- Personal allowance taper for high earners (£100k+)
- Band breakdown showing Basic Rate (20%), Higher Rate (40%), Additional Rate (45%)
- NaN guards throughout to prevent £NaN display

#### 3. PCLS Strategy Options
- **ALL_AT_RETIREMENT** - Take full 25% at retirement (default)
- **PARTIAL** - Take less than 25% (user-specified percentage)
- **PHASED** - Spread PCLS over N years (default 5)
- **DEFERRED** - Delay until State Pension age
- **NONE** - Do not take any PCLS

#### 4. PCLS Destination Options
- **REINVEST_ISA** - Reinvest into ISA (subject to annual cap)
- **HOLD_CASH** - Hold as cash reserve
- **SPEND_OVER_YEARS** - Use as bridging bucket for spending

### Bug Fixes

#### Fixed: [object Object] display in benchmarks
- Added proper type checking in benchmark summary rendering
- Handles both string and structured object formats

#### Fixed: £NaN estate/currency values
- All `formatCurrency()` functions now guard against null, undefined, NaN, and non-numbers
- Returns "—" for invalid values instead of displaying £NaN
- Applied to: estimate.js, charts.js, monteCarloCharts.js, index.html

#### Fixed: PCLS appearing as income spike
- PCLS is now spread over 5 years in income charts as "PCLS Spending"
- PCLS is a balance transfer, not income - should not spike charts
- Income Sources Breakdown shows annual PCLS spending, not lump sum

#### Fixed: Auto-advance Next button redundancy
- Mode-select screen now auto-advances after selection
- Continue button hidden since selection triggers navigation

### Technical Changes

#### engine/household.js
- `createPerson()` extended with dcPot, dcMonthlyContrib, dcAnnualContrib, dbAnnual, dbStartAge, isaBalance, isaAnnualContrib
- `calculateHouseholdIncomeAtAge()` - comprehensive income by source and person
- `generateHouseholdTimeline()` - annual timeline with all income sources

#### engine/tax.js
- `computeUKTax()` - handles mixed retirement income sources
- `calculateCouplesTax()` - per-person calculation with household totals
- All NaN guards using safeNumber pattern

#### engine/withdrawals.js
- `PCLS_STRATEGIES` - ALL_AT_RETIREMENT, PARTIAL, PHASED, DEFERRED, NONE
- `PCLS_DESTINATIONS` - REINVEST_ISA, HOLD_CASH, SPEND_OVER_YEARS
- `calculatePCLSStrategy()` - generates spending schedules for each strategy

### Testing

#### New Unit Tests (tests/couples.test.js)
- 26 tests covering:
  - Tax function banding (8 tests)
  - Couples timeline phasing (7 tests)
  - PCLS strategy (11 tests)

#### New E2E Tests (e2e/couples.spec.js)
- Couples scenario with correct income phasing
- iPhone viewport no horizontal overflow
- Tax chart visibility
- PCLS no income spike

### Migration Notes

No breaking changes. Existing single-person mode continues to work. Couples features are opt-in via the "Planning as a couple" checkbox on the review screen.

### Primary Use Case Verified

**Household scenario tested:**
- Person A: age 55 now, retire at 60, DC pension pot £580,000, contributions £4,000/month
- Person B (wife): age 62 now, retire at 67
- Person B receives State Pension starting at HER SPA (67 = when Person A is 60)
- Person B has a DB pension that starts at 67

Both incomes correctly phased and visible in timeline.
