# RetireLens 2 -- Baseline Audit

## Test Status: 218/218 PASS

| Suite | Pass | Fail |
|---|---|---|
| engine.test.js | 26 | 0 |
| fixes-validation.test.js | 21 | 0 |
| consistency-audit.test.js | 39 | 0 |
| newModules.test.js | 60 | 0 |
| couples.test.js | 32 | 0 |
| householdPlan.test.js | 40 | 0 |

## Five Prior Calculation Errors: All Fixed and Tested

### Bug D: MC vol=0 diverged from deterministic
MC simulation lacked mid-year contribution growth and state pension real growth. Fixed. 3 test scenarios verify exact match.

### Bug E: Sequence-of-returns ordering inverted
"Good start" produced lower balances than "bad start". Sort direction fixed. 6 assertions verify ordering.

### Bug G: UK Tax PA and PCLS handling
PA calculation errors and PCLS not treated as 25% tax-free. Fixed. 5 tax correctness tests.

### Bug: createHousehold field name mismatch
Expected `age` but callers passed `currentAge`. Fixed with field name support.

### Bug: Post-depletion income and PCLS strategy
DB pension and state pension stopped after fund depletion. PCLS used simple 25% instead of strategy-aware calculation. Both fixed.

## Engine Assumptions (Hardcoded Defaults)

| Parameter | Value | Source |
|---|---|---|
| Personal Allowance | 12,570 | HMRC 2025/26 |
| PA taper starts | 100,000 | HMRC |
| Basic rate | 20% on 0-37,700 | HMRC |
| Higher rate | 40% on 37,700-125,140 | HMRC |
| Additional rate | 45% above 125,140 | HMRC |
| PCLS rate | 25% | HMRC |
| State pension age | 67 | DWP |
| Full SP weekly | 230.25 | DWP 2025/26 |
| SP real growth | 1% (triple lock premium) | Assumption |
| Default growth | 4% real | Moderate scenario |
| Default fee | 0.5% | Industry average |
| Default volatility | 15% | Assumption |
| MC iterations | 1000 | Performance tradeoff |
| Life expectancy | 90 | Planning horizon |
| Spending reduction 80+ | -25% | go-go/slow-go model |
| Spending reduction 90+ | -35% | go-go/slow-go model |
| Annual allowance | 60,000 | HMRC (NOT enforced) |
| MPAA | 10,000 | HMRC (NOT enforced) |
| ISA allowance | 20,000 | HMRC |
| Min pension age | 55 (57 from 2028) | HMRC (NOT enforced) |

## Scenario Presets

| | Conservative | Moderate | Optimistic |
|---|---|---|---|
| Growth rate | 3% | 4% | 7% |
| Volatility | 18% | 15% | 12% |
| Fee rate | 0.6% | 0.5% | 0% |
| Inflation | 2.5% | 2% | 2% |

## Couples Model

- Two personal allowances (25,140 combined)
- Tax band thresholds doubled (basic rate band to 75,400)
- Partner pension age offset: partner pensions start on user's timeline based on age difference
- Both persons can have DC + DB pensions
- Combined DC pots, contributions, and ISAs
- Crystallised vs uncrystallised tracking for PCLS

## Withdrawal Priority

1. State Pension + DB Pension (guaranteed, automatic)
2. DC Pension fills Personal Allowance (tax-free within PA)
3. DC Pension above PA (uses calculateGrossFromNet for accurate cross-band tax)
4. ISA only for remaining shortfall (preserves tax-free capital)
5. ISA paced across bridge years until state pension starts

## What Is NOT Modelled

### Critical gaps:
1. Annuity vs drawdown comparison
2. MPAA enforcement (stored but not applied)
3. Salary sacrifice mechanics
4. LSA (268,275) / LSDBA (1,073,100) caps on tax-free lump sums
5. IHT on pensions from April 2027
6. Property wealth / equity release
7. GIA (General Investment Account) with CGT

### Simplifications:
8. Couples tax uses doubled-threshold shortcut (not proper per-person split in main loop)
9. Annual allowance (60k) not enforced
10. No state pension deferral option
11. No DB commutation / transfer value
12. No marriage allowance transfer
13. No nominal (pre-inflation) view
14. Min pension age change to 57 in 2028 not enforced

## Current UI Flow

1. Household type (single/couple)
2. Age (+ partner age for couples)
3. Retirement age (+ partner)
4. Target income (PLSA benchmarks shown)
5. Pension pot (+ your DB + partner DC + partner DB)
6. Monthly contributions (+ partner)
7. ISA balance + annual contribution (+ partner)
8. State pension age + amount (+ partner)
9. Review screen (scenario selector, PCLS checkbox, advanced options)
10. Results (4 tabs: Income / Wealth / Risk / Detail)

## Results Page

- Hero: YES/LIKELY/AT RISK badge with "N out of 100" confidence
- Narrative summary in plain English
- "Consider" personalised advice bullets
- Income tab: Annual income by source chart + breakdown table
- Wealth tab: Pension and ISA balance chart
- Risk tab: MC fan chart + depletion histogram
- Detail tab: Year-by-year projection table (Start/Invested/Growth/Drawn/SP+DB/Tax/Net/End)

## Regulatory Gaps

- No FCA disclaimer
- No "not financial advice" warning
- No regulatory status statement
- No assumptions log exportable for IFA review
- No PDF report generation (jspdf dependency installed but not wired)
