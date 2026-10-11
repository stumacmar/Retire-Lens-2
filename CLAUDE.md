# CLAUDE.md

## Project Overview

RetireLens 2 is a UK retirement planning engine answering: "Can I retire at age X with £Y net income?" It runs 100% client-side in the browser with no backend.

## Which app is live

The deployed product is **Horizon** (`horizon/`): Vite + React 19 + TypeScript + Tailwind v4, with the verified engine copied byte-for-byte into `horizon/src/engine/engine.js`. CI builds it into the site root. The vanilla app described below is the legacy "classic" planner at `app.html`.

Horizon essentials:
- `horizon/src/config/product.ts` — free/Plus pricing, Lemon Squeezy checkout links, licence policy, disclaimer version.
- `horizon/src/lib/entitlement.ts` — licence activate/validate against the Lemon Squeezy licence API; `useEntitlement()` exposes `plus`.
- `horizon/src/components/Plus.tsx` — `Locked`, `PlusPill`, `PlusSheetBody`. Gate a feature with `plus ? <Feature/> : <Locked …/>`.
- `horizon/src/components/Disclaimer.tsx` — accept-once gate (bump `disclaimerVersion` to re-ask).
- Tests: `cd horizon && npm run uat` (builds, 120+ checks) and `node e2e.mjs` (140+ checks). Both run as a seeded Plus customer and then exercise the free tier; both are blocking in CI.
- Tax year constants: `TAX_YEAR`, `TAX_DEFAULTS`, `SCOT_BANDS` in the Horizon engine; `config/defaults.js` for the legacy app. Roll both every April.
- One simulation: `runPath(X, acc, ret, want)` runs a retirement year by year for BOTH `drawdown` (constant or named-path returns) and `runMonteCarlo` (random returns from today, pre-retirement years included); `prepare(P)` builds the shared context (per-year tax tables, schedules, gates); `fundYear(S, P, T, need, baseA, baseB)` funds one year (cash, general account, ISAs, phased or upfront tax-free cash, withdrawal order, marginal-rate allocation; `S.canA/canB` gate the pensions). `runAssertions` (114 checks) includes MC == deterministic at zero volatility across thirteen plan shapes; keep it that way.
- Engine rules (October 2026 audit): normal minimum pension age gates DC draws (`nmpaFor`, 55/57 by birth year, protected ages); State Pension age from birth year (`spaFor`) unless overridden; survivor phase after a partner's `deathAge` (SP stops, scheme survivor share, pots inherited tax-free before 75, `survivorSpend`); `household: 'single'` normalises partner B away (`normalisePlan`); tax thresholds frozen to April 2031 then indexed by `taxFor(P, year)` (`tax.indexation`), never read from a saved plan; the MC arithmetic mean is `growth + sd²/2` so the median path matches the lens; `fee` comes off every return; `equityShare` scales stress paths; surplus guaranteed income is banked; a partner can keep working (`stopYear`, `income`, `contribGrossUp`); `successProb` is full-spending success, `successProbWithCuts` after rules, `successLifetime` mortality-weighted (Gompertz). The lump sum allowance (`lumpAfterLsa`) is used in payment order; the plan runs to `planEndYear(P)` (later horizon or death year).
- Plans: `validatePlan` (messages), `sanitisePlan` (repair), `migratePlan` (schema v2, run on every load in `usePlan`). MC runs in a web worker (`lib/mc.worker.ts`, 2,000 paths) with a main-thread fallback. Fresh plans default to `pclsMode: 'phased'`, `fee: 0.005`, `equityShare: 0.7`.
- Decision support: `levers(P)` (ranked actions, deterministic + seeded MC), `stressTests(P)` (named return paths via `drawdown(P, { returnPath })` on plain plans, `architecture.stressPath` on structured ones). UI: `Levers`, `StressTests` sections in Explore; `components/Assumptions.tsx` in Peace; `components/ErrorBoundary.tsx` wraps the app.
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
