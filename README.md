# Someday

**See the day you can afford to stop — an income-first UK retirement planner**

> "Can I retire at age X with £Y net income, and how robust is that outcome?"
> (Formerly "RetireLens". The live app is `index.html`, powered by `v4/`.)

100% private — all calculations run in-browser. Your planning data never leaves your device, and the app makes **no third-party requests** (Chart.js and the Inter font are self-hosted in `vendor/`).

## Product / going live

RetireLens ships as a sellable product with a marketing site, legal pages and a
soft access gate:

- `landing.html` — marketing page with pricing
- `guide.html` — how-to guide
- `legal.html` — disclaimer, terms & privacy
- `config/product.js` — single place to set branding, price, domain, Stripe link and the paywall switch
- `js/access.js` — disclaimer gate (always on) + optional access-code paywall
- **`LAUNCH.md`** — step-by-step go-live checklist (domain, DNS, Stripe, codes)

The disclaimer must be accepted once; the paywall is **off by default** until you
add a Stripe link and flip `paywallEnabled` in `config/product.js`.

## Quick Start

```bash
npm install
npm run dev          # Dev server on http://localhost:8080
npm run test:all     # All unit tests
npm run test:stress  # 100-scenario stress test
npm run test:e2e     # Playwright E2E tests
```

## Architecture

```
engine/           Pure calculation functions — no UI, no side effects
  projections.js  Accumulation & decumulation projections
  tax.js          UK income tax (England/Wales/NI + Scotland)
  withdrawals.js  PCLS strategies, pension/ISA sequencing
  monteCarlo.js   Stochastic simulation with seeded PRNG
  householdPlan.js Couples-first household projections
  spendingPolicy.js Age-based spending rules (go-go/slow-go/no-go)
  + 13 more       DB pension, healthcare, legacy, milestones, etc.

config/           UK tax rates (2025/26), pension rules, scenario presets
ui/               Mobile-first components, screens, export (PDF/Excel/QR)
src/ux/           UX orchestration: pathfinder, journeys, onboarding
js/app.js         Main application orchestrator
tests/            12 test suites, 630+ assertions
```

## Features

- **Deterministic projections** with transparent, configurable assumptions
- **Monte Carlo simulation** with confidence bands and fan charts
- **Plan A vs Plan B** comparison with numeric deltas
- **UK tax engine** — Personal Allowance tapering, Scottish bands, couples
- **PCLS strategies** — immediate, phased, deferred, or none
- **DB pension** support with CPI/fixed escalation
- **State Pension** with triple-lock real growth modelling
- **Age-based spending** reductions (go-go, slow-go, no-go phases)
- **Couples planning** — independent tax bands, survivor modelling
- **Monte Carlo** — seeded PRNG (Mulberry32) for reproducible results
- **Export** — PDF reports, Excel data, QR code sharing

## Tax Year 2025/26 Defaults

| Parameter | Value |
|---|---|
| Personal Allowance | £12,570 (tapers above £100k) |
| Basic Rate | 20% (£12,571 – £50,270) |
| Higher Rate | 40% (£50,271 – £125,140) |
| Additional Rate | 45% (£125,141+) |
| PCLS (Tax-Free Cash) | 25% of pension pot |
| State Pension Age | 67 |
| Full State Pension | £230.25/week |
| ISA Annual Allowance | £20,000 |
| Default Real Return | 4% after inflation |

## Debug Mode

Add `?debug=1` to URL for year-by-year tables, state tracking, and `window.__RL_EXPORT_DEBUG_LOG__()`.

## Testing

```bash
npm run test:all      # 7 unit test suites
npm run test:stress   # 100 scenarios × 6+ assertions each
npm run test:e2e      # Playwright browser tests
npm run test:engine   # Core engine only
npm run test:fixes    # Bug fix regression tests
```

## License

MIT
