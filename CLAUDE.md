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
- One withdrawal routine: `fundYear(S, P, T, need, baseA, baseB)` funds a year for BOTH `drawdown` and `runMonteCarlo` (cash/ISA, phased or upfront tax-free cash with the ISA-allowance feed, withdrawal order, marginal-rate allocation). `runAssertions` checks MC == deterministic at zero volatility across eight plan shapes; keep it that way. The lump sum allowance (`lumpAfterLsa`) is shared across scheme lump sums and personal tax-free cash; the plan runs to `planEndYear(P)` (younger partner's horizon).
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
