# CLAUDE.md

## Project Overview

RetireLens 2 is a UK retirement planning engine answering: "Can I retire at age X with £Y net income?" It runs 100% client-side in the browser with no backend.

## Which app is live

The deployed product is **Horizon** (`horizon/`): Vite + React 19 + TypeScript + Tailwind v4, with the verified engine copied byte-for-byte into `horizon/src/engine/engine.js`. CI builds it into the site root. The vanilla app described below is the legacy "classic" planner at `app.html`.

Horizon essentials:
- `horizon/src/config/product.ts` — free/Plus pricing, Lemon Squeezy checkout links, licence policy, disclaimer version. `plusOffered: false` (since November 2026, owner's call) hides every Plus surface (pill, sheet, locks, prices, licence check): everyone has everything and the app makes no network request. Flip it to sell again; the UAT free-tier block runs either way.
- `horizon/src/lib/entitlement.ts` — licence activate/validate against the Lemon Squeezy licence API; `useEntitlement()` exposes `plus`.
- `horizon/src/components/Plus.tsx` — `Locked`, `PlusPill`, `PlusSheetBody`. Gate a feature with `plus ? <Feature/> : <Locked …/>`.
- `horizon/src/components/Disclaimer.tsx` — accept-once gate (bump `disclaimerVersion` to re-ask).
- Tests: `cd horizon && npm run verify` (node only: golden tax cases, an independent second tax implementation, property and metamorphic tests, 2,000 vs 10,000 path stability, v1 migration, the classic engine's success definition), `npm run uat` (builds, 180+ checks) and `node e2e.mjs` (175+ checks). UAT and e2e run as a seeded Plus customer and then exercise the free tier (or the Plus-off switch); all three are blocking in CI.
- Accessibility: the UAT runs axe-core (WCAG 2.0/2.1/2.2 A+AA) on Home, Details, Explore and Peace and fails on any critical or serious violation (checks 100a–e). Keep text at 4.5:1 (never dim text with opacity; use `--color-ink-dim`/`--color-ink-faint`), use `--color-on-calm` for text on a solid blue button, give every `overflow-x-auto` region `tabIndex={0}` + `role="region"` + a label, never set `maximum-scale` on the viewport, keep the app inside `<main>`. The decision map has a "Show as a table" alternative (`[data-map-table]`).
- Two homes, one plan: the default home is `components/SimpleHome.tsx` (the status in words, the monthly income the plan can support as the big figure, the gap to the ask, the futures count with its caveat; three steppers for stop age, take-home and paying in, each also typeable; "What would help?" and "What could go wrong?" as sheets). The Horizon Dial (`components/dial/Dial.tsx`) is one tap away via the header switch (`[data-home-switch]`); the choice is stored in `localStorage['someday-home-v1']` (`'dial'` or absent). The owner found the dial complex (November 2026): keep the simple home simple, and put anything new in Details, Explore or a sheet. Both homes read `planStatus()` and write through `valuesFor()`, so they cannot disagree. The UAT and e2e sweeps set the key to `'dial'`; the simple home has its own UAT section (142–162). A sheet opened from a `position: fixed` home must be rendered outside it, or it slides under the tab bar.
- Results screen: `lib/status.ts` `planStatus()` is the one place that decides the plan's status in words ("On track under these assumptions" / "Close: a small change needed" / "Not yet funded"; rules in `docs/MODEL_SPEC.md` §3.4) and the three numbers (supportable monthly income from the `base` guardrail, gap to the ask, age tested to). The dial's sentence shows it with the futures count and the caveat; "What could go wrong?" (`RISKS` in `Dial.tsx`) is the layered risk tray. The home is one fixed screen: after any change to it, check it still fits above the tab bar at 390×844, 375×667 and 360×640.
- Performance: `runAssertions()` takes a quarter of a second or more. Never call it (or anything like it) during render: use `lib/selfCheck.ts` (`selfCheck()` from an effect or handler, `selfCheckCached()` in render). UAT 83b times ten ring detents.
- Provenance: `ENGINE_VERSION` (bump on any change to the maths, a rule or a default, together with `docs/MODEL_SPEC.md` and a row in `docs/VALIDATION.md`), `TAX_RULES` (the rule pack: sources, effective dates, retrieval date). `components/HowWeChecked.tsx` runs `runAssertions()` live in Peace and lists the rules with sources; the report prints the versions and the self-check count; `usePlan` exposes `saved` (shown under Details → Plan file). MC results carry `shortAgeP10/P5` (the age by which 1 in 10 / 1 in 20 futures have run short), shown in Explore beside a sentence that the sampling range covers simulation error only.
- Tax year constants: `TAX_YEAR`, `TAX_DEFAULTS`, `SCOT_BANDS` in the Horizon engine; `config/defaults.js` for the legacy app. Roll both every April.
- One simulation: `runPath(X, acc, ret, want)` runs a retirement year by year for BOTH `drawdown` (constant or named-path returns) and `runMonteCarlo` (random returns from today, pre-retirement years included); `prepare(P)` builds the shared context (per-year tax tables, schedules, gates); `fundYear(S, P, T, need, baseA, baseB)` funds one year (cash, general account, ISAs, phased or upfront tax-free cash, withdrawal order, marginal-rate allocation; `S.canA/canB` gate the pensions). `runAssertions` (134 checks) includes MC == deterministic at zero volatility across thirteen plan shapes; keep it that way.
- Engine rules (October 2026 audit): normal minimum pension age gates DC draws (`nmpaFor`, 55/57 by birth year, protected ages); State Pension age from birth year (`spaFor`) unless overridden; survivor phase after a partner's `deathAge` (SP stops, scheme survivor share, pots inherited tax-free before 75, `survivorSpend`); `household: 'single'` normalises partner B away (`normalisePlan`); tax thresholds frozen to April 2031 then indexed by `taxFor(P, year)` (`tax.indexation`), never read from a saved plan; the MC arithmetic mean is `growth + sd²/2` so the median path matches the lens; `fee` comes off every return; `equityShare` scales stress paths; surplus guaranteed income is banked; a partner can keep working (`stopYear`, `income`, `contribGrossUp`); `successProb` is full-spending success, `successProbWithCuts` after rules, `successLifetime` mortality-weighted (Gompertz). The lump sum allowance (`lumpAfterLsa`) is used in payment order; the plan runs to `planEndYear(P)` (later horizon or death year). `drawdown` returns `holds` (every year paid in full) and `runsShortAgeA` (first unpaid year, whether the pots emptied or could not be touched before pension age); every "lasts" in the UI, the decision map, guardrails, stress tests and levers reads those, never `exhaustedAgeA` alone.
- Plans: `validatePlan` (messages), `sanitisePlan` (repair), `migratePlan` (schema v2, run on every load in `usePlan`). MC runs in a web worker (`lib/mc.worker.ts`, 2,000 paths) with a main-thread fallback. Fresh plans default to `pclsMode: 'phased'`, `fee: 0.005`, `equityShare: 0.7` and the Balanced risk preset, which is the FCA's standardised projection rates (COBS 13 Annex 2): Poor 2%, Base 5%, Positive 8% nominal. `defaults()` is the workbook fixture and keeps 4 / 7 / 10 for the parity tests; do not use it as a product default.
- Decision support: `levers(P)` (ranked actions, deterministic + seeded MC), `stressTests(P)` (named return paths via `drawdown(P, { returnPath })` on plain plans, `architecture.stressPath` on structured ones). UI: `Levers`, `StressTests` sections in Explore; `components/Assumptions.tsx` in Peace; `components/ErrorBoundary.tsx` wraps the app.
- Longevity: `lifeOdds(P, horizonAge?)` reads the Gompertz curve the Monte Carlo is weighted by and returns, per person, the chance of reaching the plan age and the median age (half live past), plus `either` (one of a couple still here at the plan's end). `lib/longevity.ts` `longevityLine(plan, age, short)` puts it under the dial's plan-age needle, under "Plan through to age" in Details and in Assumptions. It informs the choice of plan age and never ends the plan.
- Retirement Living Standards: `LIVING_STANDARDS` (Pensions UK, formerly PLSA; yearly after-tax spending for one person / two people at Minimum, Moderate, Comfortable, with `asOf`), `livingStandards(P)`, `livingStandardOf(P, net)`. Fresh plans default to the couple's Moderate figure. UI: `components/LivingStandards.tsx` chips on the Someday page, a hint under the dial's take-home figure, a row in Assumptions. Roll the figures when Pensions UK publishes a new edition.
- Look: tokens in `horizon/src/index.css` (`@theme`): white page, slate ink, one blue action colour (`--color-calm`), green confidence, amber concern, `--color-map-late/early` for the decision map; graphite dark mode. The big figure uses the `.serif` class, which is now the bold system sans. The dial's stop-age ring runs to 75 and the decision map to age 75 (columns may step by up to three years; use the nearest column). A `Val` with `typed: true` (the ages) ignores the ring, the ± buttons and the flick and changes only through the keypad: an age is a fact, and the ring once turned a 56-year-old into a 26-year-old. Bump `CACHE` in `public/sw.js` on a release that must flush installed copies.
- Public-sector DB schemes: `DB_SCHEMES` (presets with NPA, accrual, revaluation margin, early/late factors, lump-sum rules, `DB_SCHEMES_ASOF`) and `trancheBenefits()` / `dbSchedule()` in the Horizon engine. Partners carry `dbSchemes: DbTranche[]` alongside the simple `db` fields; both feed `dbA`/`dbB`. Lump sums land in `cash` tax-free in the take year (accumulate before retirement, drawdown/MC after). UI: `components/SchemePensions.tsx`.

## Tech Stack

- Pure JavaScript ES6 modules (no framework, no build step)
- Chart.js for visualization
- Playwright for E2E tests
- Deployed via GitHub Pages

## Architecture

- `engine/` — Pure, stateless calculation functions (tax, projections, Monte Carlo, withdrawals). No UI or DOM access.
- `config/` — UK tax rates (2026/27), pension rules, scenario presets.
- `ui/` — Components, screens, export modules. All DOM interaction lives here.
- `src/ux/` — UX orchestration: pathfinder triage, user journeys, onboarding flow.
- `js/app.js` — Main application orchestrator (2700 lines, monolithic).
- `index.html` — Entry point, screen markup.

## Running Tests

```bash
npm run test:all     # All unit tests (7 suites)
npm run test:stress  # 100-scenario stress test (630 assertions)
npm run test:e2e     # Playwright E2E (requires: npx playwright install)
npm run dev          # Dev server on :8080
```

All test files use custom runners (not Jest) via `node tests/<file>.js`.

## Key Conventions

- Engine functions are pure — no side effects, no DOM access.
- State objects are frozen with `Object.freeze()`.
- Monte Carlo uses seeded PRNG (Mulberry32) for reproducibility.
- Tax calculations reference `config/defaults.js` for all UK thresholds.
- PCLS (tax-free cash) is a balance-sheet transfer, not income.
- Couples get independent personal allowances and tax bands.

## Common Pitfalls

- The Monte Carlo simulation must match the deterministic engine when volatility=0. Both paths must apply: mid-year contribution growth, state pension real growth (triple lock), DB pension escalation, and age-adjusted spending.
- Scottish tax bands are separate from England/Wales/NI bands.
- ISA annual cap (£20k) constrains PCLS reinvestment.

## Version

v1.1.0 — UK Tax Year 2026/27 rates.
