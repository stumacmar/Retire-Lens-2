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
- One home: `components/SimpleHome.tsx` (the status in words, the monthly income the plan can support as the big figure, the canvas above it, the gap to the ask, the futures count with its caveat; three steppers for stop age, take-home and paying in, each also typeable; "What would help?" and "What could go wrong?" as sheets). The Horizon Dial and the header switch to it were retired on 15 November 2026 (owner's call: one home, not two; the owner had found the dial complex). Keep the home simple, and put anything new in Details, Explore or a sheet. The steppers write through `lib/planValues.ts` `valuesFor()` (the dial's old value definitions: ranges, steps, how each value writes back). Figures beyond the three steppers are entered in Details; the UAT and e2e enter them there. A stale `someday-home-v1` key in a browser is ignored. A sheet opened from a `position: fixed` home must be rendered outside it, or it slides under the tab bar. Under the answer, `lib/counts.ts` `planCounts(plan).line` says who and what is counted ("Counts you and Carol: £616k in pensions, £95k in ISAs and cash and £30k a year guaranteed once it is all in payment"), read straight from the plan, with a link to Details. An annuity in payment is entered as guaranteed income (`db`), and the field says so.
- The canvas (`components/FuturesCanvas.tsx`) is the home's one picture, after Gerhard Richter's Strip paintings: 100 horizontal stripes edge to edge, one for each simulated future, steadiest at the top. A stripe is painted from the year work stops (left) for as long as that future keeps paying; where it runs short the canvas is bare, so risk shows as bare canvas eating in from the lower right, and the number of stripes reaching the right-hand edge is the futures count in the sentence (lengths are `mc.perAgeHeld` turned on its side; verify, UAT 158d–i, e2e150 check K). Colour is a palette, not a code (`--paint-0` warm to `--paint-9` cool in a plain `:root` block, never a warning red or a go green, seeded per stripe so a stripe keeps its colour); the meaning is where the paint stops. A structured plan paints each stripe in full colour while paid in full and a slightly dustier tone while still paying after its rules trim. Canvas grain is a noise image over the paint. Stripes are painted top to bottom once (`transform: scaleX`), then glide; `prefers-reduced-motion` turns that off. The needle is what was kept of the dial: a vertical line at one age, crossing exactly the futures still paying that year. Press and slide across the canvas, or focus it (`role="slider"`) and use the arrow keys, Home and End, to read "At 80: 84 of 100 still paying"; it rests on the first age a future falls short (a structured plan: first trimmed), and Escape or a tap elsewhere puts it back (UAT 30–31c, e2e150 check L). History: a bar strip (owner: "dull") and a sunrise of arcs (owner: "doesn't work": squashed on a real phone, washed out on a structured plan) came before it; keep it bold and keep it a painting. The home's main column is at least a screen tall and the canvas takes the height left over (`flex-1`, 56–360 px), so the two question buttons always sit just above the tab bar and the counts line follows below; check 390×690 (an iPhone in Safari), 390×844, 375×667, 360×780 and 360×640 for a plain and a structured plan after any change.
- Results screen: `lib/status.ts` `planStatus()` is the one place that decides the plan's status in words, and it starts from the central case so the label can never contradict the figure: `on` "On track under these assumptions" (paid in full, ≥80 of 100 futures), `thin` "Enough on average, not safe yet" (paid in full, fewer futures), `trim` "Enough, with a trim to spending" (a structured plan that lasts only by its rules cutting spending), `close` "Nearly enough" (runs short, within a tenth), `not` "Not enough yet". "Paid in full" is `insights.paidInFull(dd)`: `holds` and no year trimmed by a structured plan's rules; `capacity`, the guardrails and the decision map all use it. Structured plans report the share of futures that last with the rules, with the paid-in-full share beside it (`futuresSentence`). Rules in `docs/MODEL_SPEC.md` §3.4. The home shows it with the futures count and the caveat; "What could go wrong?" (`components/RiskPanel.tsx`) is the layered risk panel.
- `cd horizon && npm run build && npm run e2e150`: 150 households through the built app in a browser (the owner's plan and neighbours, then a seeded generator). Checks the status, figure, gap, futures and counts line on screen, plus independent arithmetic written in the test: pots on the day of stopping by a compound-interest formula (no double counting) and a tax-free ceiling on the figure. Expectations are computed in the page (the engine source is served beside the app) because the same plan can differ by up to 0.4% between JavaScript engines; that drift is measured and capped at 1%. A CI gate.
- Performance: `runAssertions()` takes a quarter of a second or more. Never call it (or anything like it) during render: use `lib/selfCheck.ts` (`selfCheck()` from an effect or handler, `selfCheckCached()` in render). UAT 83b times ten ring detents.
- Provenance: `ENGINE_VERSION` (bump on any change to the maths, a rule or a default, together with `docs/MODEL_SPEC.md` and a row in `docs/VALIDATION.md`), `TAX_RULES` (the rule pack: sources, effective dates, retrieval date). `components/HowWeChecked.tsx` runs `runAssertions()` live in Peace and lists the rules with sources; the report prints the versions and the self-check count; `usePlan` exposes `saved` (shown under Details → Plan file). MC results carry `shortAgeP10/P5` (the age by which 1 in 10 / 1 in 20 futures have run short), shown in Explore beside a sentence that the sampling range covers simulation error only.
- Tax year constants: `TAX_YEAR`, `TAX_DEFAULTS`, `SCOT_BANDS` in the Horizon engine; `config/defaults.js` for the legacy app. Roll both every April.
- One simulation: `runPath(X, acc, ret, want)` runs a retirement year by year for BOTH `drawdown` (constant or named-path returns) and `runMonteCarlo` (random returns from today, pre-retirement years included); `prepare(P)` builds the shared context (per-year tax tables, schedules, gates); `fundYear(S, P, T, need, baseA, baseB)` funds one year (cash, general account, ISAs, phased or upfront tax-free cash, withdrawal order, marginal-rate allocation; `S.canA/canB` gate the pensions). `runAssertions` (134 checks) includes MC == deterministic at zero volatility across thirteen plan shapes; keep it that way.
- Engine rules (October 2026 audit): normal minimum pension age gates DC draws (`nmpaFor`, 55/57 by birth year, protected ages); State Pension age from birth year (`spaFor`) unless overridden; survivor phase after a partner's `deathAge` (SP stops, scheme survivor share, pots inherited tax-free before 75, `survivorSpend`); `household: 'single'` normalises partner B away (`normalisePlan`); tax thresholds frozen to April 2031 then indexed by `taxFor(P, year)` (`tax.indexation`), never read from a saved plan; the MC arithmetic mean is `growth + sd²/2` so the median path matches the lens; `fee` comes off every return; `equityShare` scales stress paths; surplus guaranteed income is banked; a partner can keep working (`stopYear`, `income`, `contribGrossUp`); `successProb` is full-spending success, `successProbWithCuts` after rules, `successLifetime` mortality-weighted (Gompertz). The lump sum allowance (`lumpAfterLsa`) is used in payment order; the plan runs to `planEndYear(P)` (later horizon or death year). `drawdown` returns `holds` (every year paid in full) and `runsShortAgeA` (first unpaid year, whether the pots emptied or could not be touched before pension age); every "lasts" in the UI, the decision map, guardrails, stress tests and levers reads those, never `exhaustedAgeA` alone.
- Plans: `validatePlan` (messages), `sanitisePlan` (repair), `migratePlan` (schema v2, run on every load in `usePlan`). MC runs in a web worker (`lib/mc.worker.ts`, 2,000 paths) with a main-thread fallback. Fresh plans default to `pclsMode: 'phased'`, `fee: 0.005`, `equityShare: 0.7` and the Balanced risk preset, which is the FCA's standardised projection rates (COBS 13 Annex 2): Poor 2%, Base 5%, Positive 8% nominal. `defaults()` is the workbook fixture and keeps 4 / 7 / 10 for the parity tests; do not use it as a product default.
- Decision support: `levers(P)` (ranked actions, deterministic + seeded MC), `stressTests(P)` (named return paths via `drawdown(P, { returnPath })` on plain plans, `architecture.stressPath` on structured ones). UI: `Levers`, `StressTests` sections in Explore; `components/Assumptions.tsx` in Peace; `components/ErrorBoundary.tsx` wraps the app.
- Longevity: `lifeOdds(P, horizonAge?)` reads the Gompertz curve the Monte Carlo is weighted by and returns, per person, the chance of reaching the plan age and the median age (half live past), plus `either` (one of a couple still here at the plan's end). `lib/longevity.ts` `longevityLine(plan, age, short)` puts it under "Plan through to age" in Details and in Assumptions. It informs the choice of plan age and never ends the plan.
- Retirement Living Standards: `LIVING_STANDARDS` (Pensions UK, formerly PLSA; yearly after-tax spending for one person / two people at Minimum, Moderate, Comfortable, with `asOf`), `livingStandards(P)`, `livingStandardOf(P, net)`. Fresh plans default to the couple's Moderate figure. UI: `components/LivingStandards.tsx` chips on the Someday page, a row in Assumptions. Roll the figures when Pensions UK publishes a new edition.
- Look: tokens in `horizon/src/index.css` (`@theme`): white page, slate ink, one blue action colour (`--color-calm`), green confidence, amber concern, `--color-map-late/early` for the decision map; graphite dark mode. The big figure uses the `.serif` class, which is now the bold system sans. The stop age runs to 75 and the decision map to age 75 (columns may step by up to three years; use the nearest column). A `Val` with `typed: true` in `lib/planValues.ts` (the ages) is a fact: never put one on a stepper, a drag or a ring (the retired dial's ring once turned a 56-year-old into a 26-year-old). Bump `CACHE` in `public/sw.js` on a release that must flush installed copies.
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
