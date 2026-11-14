# Someday · Horizon — validation record

**Status as of:** 14 November 2026 · **Engine:** 2026.11.14 · **Tax rules:** 2026/27 (read 14 November 2026)
**Scope:** the live app (`horizon/`), built by CI into the site root at stumacmar.github.io/Retire-Lens-2.
The classic planner (`app.html`, root `engine/`) is legacy and is covered only where noted.

This is the single, dated, current record the audit of 14 November 2026 asked
for (F-07). The historic reports in the repository root (`BETA_TEST_REPORT.md`,
`FINAL-REPORT.md`) describe earlier generations of the product and are kept
for the record only; where they disagree with this page, this page is current.

---

## 1. What is checked, where, and how often

| Layer | What it proves | Where | When |
|---|---|---|---|
| **Load-time assertions** (134) | Tax by hand at every band edge (England and Scotland, including the 60% zone); Monte Carlo = plan at zero volatility across thirteen plan shapes; survivor, lump sum allowance, pension-age gating, banking of surplus income, mortality, living standards, life odds | `runAssertions()` in `horizon/src/engine/engine.js` | On every page load (listed to the user under Peace → "How we checked these numbers"), at print time in the report, in CI (`verify`, `e2e`) |
| **Golden cases** | 15 hand-worked income-tax cases (rUK and Scotland) to the penny; marginal rates 60% / 45% / 48% | `horizon/verify.mjs` §1 | Every CI run (`npm run verify`) |
| **Differential testing** | A second income-tax implementation written from the GOV.UK rules, not from the engine, agrees with the engine on 1,201 incomes from £0 to £300,000 to the penny, in both jurisdictions; `grossForNet` inverts `taxOn` within £1 | `verify.mjs` §2 | Every CI run |
| **Property tests** | Over ten plan shapes (fresh couple, single, the owner's plan, a stop before pension age, a high earner taking cash upfront, Scotland with a scheme pension and a late State Pension, an age-gap couple with one still working, a death at 80 with a survivor, the workbook fixture, the structure on): no negative balance in any year; no NaN; tax never above income and never negative; tax-free cash per person within the lump sum allowance; `holds` ⇔ no year was short; every year not short was paid in full; `runsShortAgeA` is the earlier of exhaustion and first shortfall; zero-volatility Monte Carlo equals the plan. Conservation: with no growth, no income and no tax, end wealth = start − everything drawn, to £1 | `verify.mjs` §3 | Every CI run |
| **Metamorphic relations** | Higher charges cannot raise end wealth or the share of futures that hold; higher spending cannot; the money never lasts longer with more spending; a later State Pension cannot raise guaranteed income at 68; higher growth raises end wealth; the same seed gives the same answer bit for bit, a different seed a close one; a single plan equals a couple with an empty partner; paying in more raises the pot; stopping later raises the share that holds | `verify.mjs` §4 | Every CI run |
| **Stability** | The headline moves less than 3 points from 2,000 to 10,000 paths and sits inside the 2,000-path two-standard-error range; more paths, smaller error; engine version and seed travel with the result | `verify.mjs` §5 | Every CI run |
| **Migration** | A v1 saved plan loads, an empty placeholder partner becomes single, `fee` defaults to 0, the figures survive, a stale personal allowance saved in the plan is ignored, garbage in becomes a fresh start, export → import is lossless | `verify.mjs` §6 | Every CI run |
| **Cross-engine** | The classic engine's `successRate` is the strict definition (target met every year AND solvent) and is never above its own "not depleted" rate | `verify.mjs` §7 | Every CI run |
| **UAT** (190+ browser checks) | Every screen renders without console or page errors on a 390 × 844 viewport; the dial, the faces, the keypad, the ring, Details, Explore, Peace, the report; the free tier and the Plus-off switch; the unpaid-years cases; the typed age; the plan-age odds; the four layers of uncertainty and the versions are stated; "How we checked" runs live and every rule names a source; the save status is shown; the decision map as a table | `horizon/uat.mjs` | Every CI run (blocking) |
| **Accessibility gate** | axe-core 4.10 (WCAG 2.0/2.1/2.2 A and AA rules) on Home, Details, Explore and Peace (with Assumptions and How we checked open): zero critical or serious violations; moderate and minor are printed in the log. Pinch-zoom allowed; every scroll region focusable; landmarks present | `horizon/uat.mjs` 100a–e | Every CI run (blocking) |
| **End-to-end** (175+ checks) | Every input reaches the engine and moves its output in the right direction, for both partners; the engine's own assertions pass in the built bundle; Details fields write to the plan | `horizon/e2e.mjs` | Every CI run (blocking) |
| **Classic planner** | 7 unit suites and a 100-scenario stress test (630 assertions) | root `npm run test:all`, `npm run test:stress` | Every CI run (blocking) |

CI: `.github/workflows/ci.yml` on Ubuntu 24.04, Node 20. Deploy
(`deploy.yml`) runs only after a green CI on `main`.

## 2. The audit's findings and their status

| Id | Finding (audit, 14 Nov 2026) | Status | Evidence |
|---|---|---|---|
| F-01 / P0 | Classic engine Monte Carlo `successRate` counted non-depletion only, while `runSingleSimulation` defined success as target met every year and solvent | **Fixed 14 Nov 2026.** `runMonteCarlo` now uses `isSuccess`; the old measure is kept as `notDepletedRate` for comparison | `engine/monteCarlo.js`; `verify.mjs` §7; root suites green |
| F-02 / P0 | Historic PCLS net-income understatement in the classic engine | **Historical, fixed before Horizon.** Horizon books tax-free cash as a balance-sheet transfer and asserts it on every load ("PCLS is not income", lump sum allowance in payment order) | `runAssertions`; `verify.mjs` §3 (tax-free cash within the allowance) |
| F-03 / P0 | Historic design report: doubled thresholds for couples; no survivor model | **Historical, not present in Horizon.** Each partner is taxed on their own allowance and bands ("Couples are taxed as two individuals" assertion); the survivor phase is modelled (§8 of the spec) and tested ("death at 80, survivor on" shape) | `runAssertions`; `verify.mjs` §3; `FINAL-REPORT.md` banner |
| F-04 / P1 | The confidence range could be read as total forecast confidence | **Fixed 14 Nov 2026.** Beside the figure in Explore: "The x–y% range is sampling error on 2,000 paths only. It says nothing about whether the growth, inflation, charge or tax assumptions are right, and those matter more." Assumptions names the four layers (sampling, parameter, model, policy). The report says what the range covers | `App.tsx` futures card; `Assumptions.tsx`; `PrintReport.tsx`; UAT 65c, 69c |
| F-05 / P1 | Decision map is a canvas with pointer dragging; keyboard and screen-reader operation not evident | **Fixed 14 Nov 2026.** "Show as a table" renders the same map as a table: one row per stop year, spending levels across, every cell a sentence ("lasts", "lasts, £1.2m left", "short at 84"), the plan's row and column marked with `aria-current`, a caption, a focusable scroll region. The canvas keeps arrow-key operation and an `aria-live` sentence. An axe-core WCAG 2.2 AA gate now runs in the UAT on Home, Details, Explore and Peace with zero critical or serious violations; it found and we fixed: pinch-zoom disabled by `maximum-scale`, bezel labels dimmed by opacity below 4.5:1, ink-on-blue buttons at 3.45:1, a quiet-fill colour used as text at 1.2:1, scroll regions without keyboard focus, content outside landmarks | `DecisionMap.tsx`; `index.html`; `index.css` (`--color-on-calm`); UAT 55d–g, 100a–e |
| F-06 / P1 | Local storage with migration on load; no visible save status or recovery path | **Fixed 14 Nov 2026.** Details → Plan file shows "Saved on this device at hh:mm" or, when the browser will not keep the figures, a plain warning and the export path; export files carry schema, engine version and tax year; migration is tested | `usePlan.ts`; `PlanForm.tsx`; `verify.mjs` §6; UAT 95b |
| F-07 / P1 | Several generations of reports; no single current validation record | **Fixed 14 Nov 2026.** This page; historical banners on the old reports; a model specification | `docs/VALIDATION.md`, `docs/MODEL_SPEC.md` |
| F-08 / P1 | Live engine and deployed commit not source-audited or runtime-tested by the desk review | **Addressed.** The deployed commit is the `Build: stage Horizon into the site root` commit on `main` after each merge; CI runs the suites above on every push; the engine lists its own version and self-check result in the app and in the report, so a reader can tie a figure to an engine | `deploy.yml`; Peace → How we checked; report §5 |

### Audit P0 themes, mapped

| Theme | Where it stands |
|---|---|
| One canonical model contract | `docs/MODEL_SPEC.md`, versioned with `ENGINE_VERSION`; one routine (`runPath`) for the plan, the stress tests and the Monte Carlo; every surface consumes the same outputs |
| Tax engine and rule governance | `TAX_RULES` rule pack (effective dates, sources, retrieval date, change notes); per-person tax; Scottish bands; taper; lump sum allowance as a cumulative person-level entitlement in payment order; pension access by birth year with protected ages; annual allowance as a warning. Open: savings/dividend tax, MPAA |
| Couples, survivor and household | Person-level ownership and tax; first death, survivor pension, inheritance of pots by age at death, survivor spending; age-gap and one-still-working shapes tested |
| Investment and decumulation realism | Named historic stress paths; sequence risk through the Monte Carlo from today; charges off every return; inflation separate from returns; written spending rules with floors, caps and a lag. Open: fat tails or regime paths, per-pot asset mixes (see §4) |

## 3. Release gates (all must be green)

1. **Financial correctness**: `runAssertions` all pass; `verify.mjs` golden and differential sections pass.
2. **Model validity**: Monte Carlo equals the plan at zero volatility (assertions and `verify.mjs` §3); stability within 3 points at 10,000 paths.
3. **Consistency**: UAT and e2e pass in the built bundle; the report reads the same objects as the screen and prints the engine's self-check count.
4. **Operational**: `TAX_RULES.effectiveTo` is not in the past at release time (roll every April); migration tests pass.
5. **Trust**: Assumptions and "How we checked" render from engine constants (never typed), with sources.

## 4. Known limitations and the plan

| Item | Class | Plan |
|---|---|---|
| axe-core covers what a machine can check; no moderated test with screen-reader users yet | accessibility | Moderated session with two screen-reader users and two keyboard-only users on the five core journeys (the audit's acceptance tests) |
| Returns are normal with one asset mix; no fat tails, no regimes, no block bootstrap | model | Scheduled: a Student-t option matched on variance, reported as a second line beside the normal result; later, a block bootstrap on UK real-return history |
| Unisex mortality | model | Sex-specific ONS cohort tables for single-person plans (backlog B10) |
| Savings and dividend tax on the general account; capital gains; MPAA; annual allowance taper | tax | Listed under "Not modelled" in Assumptions; warnings only |
| No independent actuarial or tax review yet | assurance | Sought; this record and the spec are the hand-over pack |
| No moderated usability study of the current interface | UX | Hallway test of the dial's bezel words (backlog B5); the audit's acceptance tests are the script |

## 5. How to reproduce

```bash
cd horizon && npm ci
npm run verify          # evidence layers 1–7 above, node only, ~15 s
npm run uat             # builds, then 180+ browser checks
node e2e.mjs            # 175+ input → engine checks
cd .. && npm run test:all && npm run test:stress   # classic planner
```

In the app: Peace → "How we checked these numbers" runs the engine's
assertions live and lists every rule with its source.

## 6. Change log of this record

| Date | Engine | Change |
|---|---|---|
| 2026-11-14 | 2026.11.14 | Simple home (owner: "the UX is complex"; audit §5B "lead with three numbers", "top drivers editable in one tap"): the default home is now the answer in words and one figure, three steppers and two questions; the dial is one tap away. No engine change. UAT 142–162, including an axe scan of the new home |
| 2026-11-14 | 2026.11.14 | Release 3 of the audit work (results screen, audit §5B–C): the home states the plan's status in words with the income it can support, the gap to the ask and the age tested to, with the caveat beside it (`lib/status.ts`, spec §3.4); "What could go wrong?" layered risk panel; the levers quote the same headline figure as the home; chart labels no longer overlap. **Defect fixed**: release 1 put the engine's self-checks on the report's render path (a quarter of a second on every turn of the ring); they now run once per session in idle time (`lib/selfCheck.ts`), with a UAT timing check (83b) so it cannot return |
| 2026-11-14 | 2026.11.14 | Release 2 of the audit work: the decision map as a table (F-05), axe-core WCAG 2.2 AA gate in the UAT, the contrast, zoom, focus and landmark fixes it found (`--color-on-calm` token) |
| 2026-11-14 | 2026.11.14 | Record created. F-01, F-04, F-06, F-07 fixed; F-02, F-03 confirmed historical; `verify.mjs` added to CI; `ENGINE_VERSION`, `TAX_RULES`, `shortAgeP10/P5`, golden boundary assertions (134 total); "How we checked" in Peace; versions in the report; save status in Details |
