# Someday · Horizon — model specification

**Engine version:** 2026.11.14 (`ENGINE_VERSION` in `horizon/src/engine/engine.js`)
**Plan schema:** 2 (`SCHEMA_VERSION`)
**Tax rules:** UK 2026/27, in force from 6 April 2026, read on 14 November 2026 (`TAX_RULES`)

This is the canonical contract for the live engine. Every number on the screen,
in the decision map, in the stress tests, in the levers and in the PDF report
is produced by the functions named here, from the same inputs, under the same
conventions. There are no hand-coded approximations in the interface. When the
engine changes, this file and `ENGINE_VERSION` change with it, in the same
commit.

The audit of 14 November 2026 asked for this document (P0, "one canonical
model contract"). The evidence that the engine follows it is in
[VALIDATION.md](VALIDATION.md).

---

## 1. Units, money and time

| Convention | Rule |
|---|---|
| **Currency** | Pounds sterling. Inputs are whole pounds; the engine works in floating point and rounds only for display. |
| **Money basis of inputs** | **Today's money** for everything a person types: pots, contributions, the spending target, State Pension amounts, scheme pensions, life events, the inheritance assumption. |
| **Money basis of the simulation** | **Nominal.** Each year's spending target, State Pension, indexed scheme pension and life event is multiplied by `inflFactor(P, year) = (1 + inflation)^(year − startYear)`. Tax thresholds are frozen to April 2031 and then also indexed (see §4). |
| **Money basis of outputs** | **Today's money** unless labelled. Any nominal figure shown is deflated by the same `inflFactor`. The report, the dial, the decision map and Explore all deflate; the year-by-year table shows both. |
| **Year** | A plan year is a calendar year `y`. Ages are `y − birthYear`. The plan starts in `startYear` (the current year) and stops work in `retireYear`. |
| **Timing within a year** | Draws, guaranteed income and tax are booked at the **start** of the year; growth is applied to what remains at the **end** of the year; contributions and invested windfalls arrive **mid-year** and earn half a year's growth (`× (1 + g/2)`). Cash earns its own fixed rate (`cashGrowth`). |
| **Returns** | Nominal, **net of the annual charge**: every return applied to pensions, ISAs and the general account is `rate − fee`. The three "lens" rates (`growthBear`, `growthBase`, `growthBull`) are nominal, before the charge. |
| **Inflation** | One rate (`inflation`), applied to spending, State Pensions, indexed scheme pensions, life events and (from 2031) tax thresholds. It is separate from returns: real return = nominal return − inflation, never assumed. |
| **Horizon** | The plan runs to `planEndYear(P)`: the year the **younger** partner reaches `horizonAge`, or a later chosen death year. Nobody is removed at the horizon; the horizon is a choice, never a prediction. |

## 2. People and ownership

Everything is owned by a person. The household is `partnerA` and, for a couple,
`partnerB`; `household: 'single'` removes partner B entirely (`normalisePlan`
marks them `absent`, so they own nothing, earn nothing and are never taxed).

Per person: `birthYear`, `pension` (all defined-contribution pots, one figure),
`isa`, `monthlyPension`, `monthlyIsa`, `spAmount` and `spAge` (State Pension),
`db` and `dbStartYear` (one simple scheme pension) and `dbSchemes[]` (public
sector tranches with their own rules), `pclsTaken`, `crystallised`, `tfcRate`
(protected tax-free entitlement), `income` and `stopYear` (a partner who keeps
working), `deathAge` (the survivor phase), `pensionAccessAge` (a protected
minimum pension age), `dbSurvivorPct`. Household-level: `cash`, `house`,
`lifeEvents`, `inherit`, `targetNet` or a spending plan, the spending shape
(`phase1`, `phase2`), `strategy` (withdrawal order), `pclsMode`, `survivorSpend`,
the growth lens rates, `fee`, `inflation`, `mcSd`, `mcSeed`, `equityShare`,
`tax.region` and `tax.indexation`, and the optional `architecture` overlay.

**Household totals never replace person-level tax.** Each person is taxed on
their own income with their own allowance and bands (§4). Pension draws are
allocated across the couple by marginal rate (§6).

## 3. The two phases and the one routine

### 3.1 Accumulation (`accumulate`)
From `startYear` to the year before `retireYear`. Each year, per person: pots
grow at the net return; contributions (`monthlyPension × 12`, grossed up for
basic-rate relief when `contribGrossUp` is set) and ISA contributions arrive
mid-year; contributions stop at 75. Cash grows at `cashGrowth`. Pre-retirement
life events are paid from cash, then ISA A, then ISA B (a remainder is a
warning, never a silent draw on a pension). A scheme lump sum that falls before
retirement lands in cash, tax-free within the lump sum allowance and taxed at
40% above it.

### 3.2 Retirement (`runPath`, through `drawdown` and `runMonteCarlo`)
From `retireYear` to `planEndYear`. **One function, `runPath(X, acc, ret,
want)`, runs every year of every retirement**, whether the returns are a
constant (the plan), a named historic sequence (a stress test) or random (the
Monte Carlo). Only the return provider `ret(i, year)` differs. Per year, in
this order:

1. **Deaths.** A partner is in the plan until the end of the year they reach
   their `deathAge`. On the next year the estate passes to the survivor: ISAs
   and cash stay in the household; a pension inherited from a death before 75
   is held tax-free (like an ISA), after 75 it joins the survivor's taxable pot.
2. **ISA feeding.** Money parked in the general account moves into each
   living partner's ISA up to the ISA allowance.
3. **Still working.** A partner with `stopYear` later than the household's
   earns `income` (taxed), keeps contributing, and cannot draw their pension.
4. **Pension access.** A pension can be drawn only from normal minimum pension
   age (`nmpaFor`: 55, or 57 for those born on or after 6 April 1973 from
   April 2028; a `pensionAccessAge` overrides), and never by a partner who is
   still working or no longer alive.
5. **Guaranteed income**, per person, nominal: scheme pensions (with the
   survivor share to the other partner after a death), State Pension from
   `spAgeOf` (law by birth year unless overridden), annuity income, earned
   income from life events, taxable pay. Tax on this base is computed per
   person.
6. **Lump sums.** Scheme lump sums first, then any **upfront** tax-free cash,
   so the lump sum allowance is used in the order the money arrives; the
   excess over the allowance is taxed as income on top of the base.
7. **The year's need.** `target = spendingAnnual × inflFactor × phaseFactor
   × survivorFactor × spendMult`, plus event costs and any care block, less
   event income. Guaranteed income beyond the need is **banked into cash,
   never lost**.
8. **Funding (`fundYear`).** Cash first, then the general account, then ISAs
   for anything the chosen order says comes before pensions; pensions are
   drawn gross-for-net through `grossForNet`, with phased tax-free cash
   (`pclsMode: 'phased'`, 25% of each draw from the uncrystallised part while
   the lump sum allowance lasts) and allocation across the couple by marginal
   rate (§6). What cannot be served is a **shortfall**.
9. **Tax**, per person, on base plus gross pension draw (§4). `netIncome` is
   recorded; `lifetimeTax` nominal and real.
10. **Growth** at the year's net return on pensions, ISAs and the general
    account; cash at its own rate; mid-year money (contributions, invested
    windfalls) earns half a year.
11. **Rules** (architecture only): the funded ratio is measured and the
    spending multiplier cut or raised within its floor and cap; the house
    parachute may release once.
12. **Record.** A row per year with every component (see `rows` in `runPath`).

### 3.3 What "holds" means (the success definition)
A plan **holds** if, in **every** modelled year to the horizon, the full
planned spending was paid. `drawdown` returns:

* `shortfallYear` — the first year the need could not be served in full
  (whether because the pots were empty or because they could not be touched
  before pension age);
* `exhaustedYear` — the first year wealth fell below £100 while short;
* `runsShortYear` / `runsShortAgeA` — the earlier of the two;
* `holds` — `runsShortYear == null`.

Every "lasts to" in the interface, the decision map, the guardrails, the
stress tests and the levers reads `holds` / `runsShortAgeA`, never
`exhaustedAgeA` alone. "Assets remain" and "the plan was funded" are different
statements; the product uses the second.

In the Monte Carlo, `successProb` is the share of paths that **paid the full
planned spending in every year** (a year delivered below 99% of plan counts as
a failure, however much is left). `successProbWithCuts` is the share that
stayed solvent after the written rules trimmed spending. `successLifetime`
weights each path by the chance the household is still here (§8).

## 4. Income tax (`taxOn`, `taxFor`)

* Computed **per person** on non-savings income: State Pension, scheme
  pensions, annuity, earnings, taxable pay and gross pension draws.
  Tax-free cash, ISA draws, cash and the general account are not income.
* **Personal allowance** £12,570, tapered £1 per £2 of income over £100,000,
  nil at £125,140.
* **England, Wales, NI**: band edges in **taxable** income: 20% to £37,700,
  40% to £125,140, 45% above. The taper moves the allowance, not the edges,
  which is what creates the 60% zone between £100,000 and £125,140.
* **Scotland** (`tax.region: 'scotland'`): starter 19%, basic 20%,
  intermediate 21%, higher 42%, advanced 45%, top 48%, bands in taxable income
  above the allowance (`SCOT_BANDS`).
* **Indexation**: all thresholds frozen to April 2031 (Autumn Budget 2025),
  then indexed each year with the plan's inflation unless `tax.indexation` is
  `'frozen'`. The lump sum allowance and the ISA allowance stay fixed.
* **Provenance**: every constant comes from `TAX_DEFAULTS` / `SCOT_BANDS` in
  the engine; `taxFor` reads only `region`, `indexation` and `indexFrom` from
  a saved plan, so an old plan never carries an old tax year with it.
  `TAX_RULES` lists each rule with its source, effective date and the date it
  was read.
* **Not modelled**: savings and dividend allowances, capital gains tax on the
  general account, the annual allowance and its taper and the money purchase
  annual allowance (a warning only), National Insurance, benefits.

## 5. Tax-free cash and the lump sum allowance

Tax-free cash is a **balance-sheet transfer, not income**. The entitlement is
`tfcRate` (25% unless protected) of the **uncrystallised** part of a pot,
within one **lump sum allowance** of £268,275 per person, cumulative across
personal pensions and scheme lump sums **in the order they are paid**, less
`pclsTaken`. `lumpAfterLsa` splits any lump sum into free and excess; the
excess is taxed as income. Modes: `'phased'` (a slice with each draw),
`'upfront'` (all at once in the first year the pension can be accessed; up to
the ISA allowance into the ISA, the rest into the general account and fed into
the ISA each year), `'none'`.

## 6. Withdrawal order and marginal-rate allocation

`strategy` chooses the order: pensions to the free allowances only then ISAs
(default), pensions to the cheap bands first then ISAs (`'sippfirst'`), or ISAs
first (`'isafirst'`). Within a pension step the couple's draws are allocated
to whoever has the **cheaper next pound**: both personal allowances are used
before anyone pays basic rate, both basic bands before anyone pays higher rate
(`bandEdgesFor`, `serveFrom` in `fundYear`).

## 7. Defined-benefit pensions

A simple scheme pension (`db`, `dbStartYear`, `dbIndexed`) and public-sector
tranches (`dbSchemes`, `DB_SCHEMES` presets: NHS, Teachers', LGPS, Civil
Service, custom; normal pension age, accrual, revaluation, early and late
factors, lump-sum rules, `DB_SCHEMES_ASOF`). `dbSchedule` gives income and
lump sums by year; the survivor share (`dbSurvivorPct`, default 50%) pays to
the other partner after a death. Scheme factors are as published; a scheme's
own quote takes precedence.

## 8. Longevity and the survivor phase

* The plan never ends by a random death. A partner's `deathAge` is a planning
  choice that starts the survivor phase: that State Pension stops, the scheme
  survivor pension begins, pots pass (tax-free before 75), spending falls to
  `survivorSpend` (default 75%) of the couple's.
* `householdSurvival` and `lifeOdds` use a unisex Gompertz hazard
  (`MORTALITY`: a = 9.8 × 10⁻⁶, b = 0.105) fitted to the ONS 2020 to 2022
  national life tables with a modest improvement allowance. They weight the
  futures (`successLifetime`) and inform the choice of plan age ("half live
  past 86 · 56% one of you at 90"). Limitation: unisex, so a single person
  gets the midpoint of the male and female tables.

## 9. The Monte Carlo (`runMonteCarlo`)

* `nPaths` (2,000 in the app) random paths **from today**: returns are random
  through the saving years as well as the spending years, so the pot at
  retirement is itself uncertain (`potsAtRetirementP10/50/90`).
* Returns are normal (Box–Muller) with standard deviation `mcSd` and an
  **arithmetic mean of `growth + mcSd²/2`** so that the **median** path
  compounds at the chosen lens rate and the Monte Carlo centres on the plan.
  The charge comes off every return.
* Seeded (Mulberry32, `mcSeed`, default 42): the same plan and seed give the
  same answer, bit for bit. The result carries `engineVersion` and `seed`.
* **Invariant**: at zero volatility every path equals the deterministic plan
  (asserted on every load across thirteen plan shapes, and for the structured
  plan when equity and gold volatility are also zero).
* Outputs: `successProb` with `successSe` (one binomial standard error),
  `successProbWithCuts`, `successLifetime`, `confidenceAge` (first age at
  which fewer than 85% of paths are still solvent), `shortAgeP10` /
  `shortAgeP5` (the age by which one future in ten / twenty has run short),
  `finalP10/50/90`, per-age solvency, sixty charted tracks.
* **What the range covers**: the sampling range shown in the app
  (±2 standard errors) covers the randomness of the simulation **only**. It
  does not cover parameter uncertainty (are the growth, inflation and charge
  assumptions right?), model uncertainty (returns are normal, with no fat
  tails and no regimes) or policy uncertainty (tax and pension rules). The
  interface says so beside the figure.
* **Limitations**: a single normal return model; one asset mix for all
  invested money (`equityShare` scales only the stress paths); no historical
  block bootstrap. These are listed as open items in VALIDATION.md.

## 10. Stress tests and guardrails

`STRESS_PATHS` are named sequences of **real** returns replayed from the year
work stops (Japan 1990 twenty years; 2008 ten years including the recovery;
1970s stagflation eight years; a 30% fall then flat five years), applied to
the `equityShare` of invested money with the rest at 1% real
(`blendReal`), converted to nominal with the plan's inflation, less the
charge. `stressTests(P)` runs the plan through each; the dial's floor is the
most that would hold under the chosen history. `guardrails` gives the safe
yearly spend under each history and lens. With the architecture on, the growth
engine takes the stress path in full (`architecture.stressPath`).

## 11. The architecture overlay (optional)

A gilt ladder (`ladderYears` of spending at `giltReal`, refilled by rule), a
growth engine (`equityReal` ± `equitySd`, with `goldPct` of diversifiers),
written spending rules (`cutBelow`/`cutBy`, `raiseAbove`/`raiseBy` with a lag,
`floorMult`/`capMult`), an optional annuity purchase, a care-cost block and a
house parachute. The sleeves are modelled at household level; the blended
household return is then applied to every wrapper so tax accounting is
unchanged and totals reconcile. `assessStructure` judges it on spending
delivered (certainty-equivalent), never on survival alone.

## 12. Decision support

* `levers(P)`: ranked actions (stop later, spend less, pay in more, change
  the order, take the tax-free cash differently) each measured by a
  deterministic run and a seeded Monte Carlo against the same base.
* The decision map (`insights.decisionMap`): a grid of stop years × spending
  levels, each cell a full `drawdown`, with the edge (the most that holds for
  each stop year). Cells read `holds` / `runsShortAgeA`.
* `compareStrategies`, `compareDbTiming`, `compareArchitecture`: the same
  engine, different settings, side by side.

## 13. Plans: validation, repair, migration

* `validatePlan` returns messages (errors and warnings) for impossible or
  unusual inputs; the interface shows them. It never changes a value.
* `sanitisePlan` repairs a plan into range (clamps, fills defaults). It runs
  on load and on import, and its effects are visible under Details.
* `migratePlan` upgrades a saved plan to the current schema (v1 → v2: infer
  `household`, keep gross figures with `fee: 0`, keep the old stress
  convention with `equityShare: 1`) and then sanitises. The engine's own tax
  constants always win over anything saved.
* Export files record `schemaVersion`, `engineVersion` and `taxYear`.

## 14. Consumers of the contract

| Surface | Reads |
|---|---|
| Dial (home) | `accumulate`, `drawdown` (`holds`, `runsShortAgeA`), `runMonteCarlo` (`successProb`), `stressTests` floor, `levers` |
| Decision map | `drawdown` per cell |
| Explore | `drawdown` rows, `runMonteCarlo`, `levers`, `stressTests`, `compareStrategies`, `estate` |
| Peace | `Assumptions` (generated from the plan and engine constants), `HowWeChecked` (`runAssertions` live, `TAX_RULES`) |
| PDF report | the same objects as the screen, plus `ENGINE_VERSION`, `TAX_RULES`, `runAssertions` at print time |

None of these recomputes anything the engine already computes.

## 15. Change control

* Any change to a rule, a default, a convention or an output changes
  `ENGINE_VERSION` and this document in the same commit, and is noted in
  [VALIDATION.md](VALIDATION.md).
* Tax constants are rolled every April (`TAX_YEAR`, `TAX_DEFAULTS`,
  `SCOT_BANDS`, `TAX_RULES`), with golden cases re-derived by hand.
* The release gates are listed in VALIDATION.md §3; a release does not ship
  with any of them red.
