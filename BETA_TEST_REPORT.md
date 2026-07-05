# RetireLens — Beta Test Report

A team of virtual beta testers put RetireLens through its paces two ways:

1. **An independent reference model** (a second, from-scratch implementation of
   the UK maths) recomputes the engine's outputs and flags any disagreement —
   classic differential testing / "parallel model" accuracy checking.
2. **End-to-end UI testers** — realistic personas that drive the actual planner
   in a browser, enter data screen by screen, and record every issue.

## How to reproduce

```bash
npm run test:crosscheck   # engine vs independent reference model (604 checks)
npm run beta:excel        # regenerate the Excel comparison workbook
node tests/beta-e2e-bot.mjs   # UI testers (needs a server on :8899)
```

## The testers (personas)

Single: Stuart (56, the founder's own case), Priya (45, early retiree), James
(50, high earner in the taper zone), Maureen (58, late starter), Geoff (55, DB +
DC), Dawn (52, ISA-heavy), Kirsty (48, Scottish taxpayer), Tom (60, cautious),
Aisha (35, long runway). Couple: Ann & Bob (57/59).

---

## Findings

### 1. FIXED — Net income under-reported when tax-free cash (PCLS) applied

**Severity: high (money misstated).** The parallel model caught that, once
marginal PCLS kicked in, the engine withdrew the full pension amount from the
pot but only counted the *taxed* slice as income — omitting the 25% tax-free
cash the retiree actually receives.

- Example (Stuart, 56): the app showed **£24,023** net income when the retiree
  actually receives **~£28,994**. A ~£5,000/year understatement, every year PCLS
  applied.
- **Fix:** `engine/projections.js` and `engine/monteCarlo.js` now credit the
  tax-free cash to reported net income. Money is conserved; the pot trajectory
  is unchanged, so the Monte Carlo vol=0 invariant and all balance tests still
  hold.
- **Verified:** the cross-check now reconciles the engine's net income to the
  independent recomputation across every year of every persona.

### 2. VERIFIED — Accumulation and tax are exact

Across an income sweep (£0–£200k) and every persona's accumulation phase, the
independent model and the engine agree **to the penny** (max difference £0.00
over 604 assertions). UK Personal Allowance taper, England/Wales/NI bands, and
mid-year contribution growth all reconcile.

### 3. VERIFIED — End-to-end UI, singles and couples

All personas complete the flow (household → names → age → pension → ISA →
results) with **zero console or page errors** and a fully rendered results page:

| Persona | Retires | Result headline |
|---|---|---|
| Stuart, 56 (single) | 67 | £2,333/mo · 95% confidence |
| James, 50 (single) | 60 | £4,583/mo · 71% |
| Maureen, 58 (single) | 68 | £1,250/mo · 100% |
| Ann & Bob (couple) | 66 | £3,333/mo · 99% |

### 4. PROCESS NOTE — a false alarm, and a latent smell

An early run of the E2E bot reported "blank couple results". Investigation
showed the fault was in the **test harness**, not the app: the bot filled the
wrong partner-age field id, so the (correct) validation refused to calculate.
Corrected; the app renders couples correctly.

That said, the confusion is worth noting: the app has **two** partner-age input
ids — `input-partner-current-age` (the wizard's injected field) and
`input-partner-age` (used by an older follow-up path). They're easy to mix up.
*Recommendation:* consolidate to one id to remove a latent foot-gun. (Not
changed here — low risk but a real cleanup for later.)

---

## Suggested next tests

- Add the couple to the tight tax oracle (currently behavioural-only) by
  reconciling per-person tax against the independent model.
- Property test: net income delivered should always be ≥ target while solvent
  (now true after finding #1) — assert it in CI.
- Add an E2E assertion on the year-by-year table totals matching the summary.
- Exercise age-based spending reductions and DB escalation in the cross-check
  (currently held off to keep the oracle penny-exact).
