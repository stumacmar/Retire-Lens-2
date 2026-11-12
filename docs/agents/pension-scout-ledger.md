# Pension Scout ledger

Memory between cycles. Read it first; update it last. Format is in
`PENSION_SCOUT.md` §6.

## Roster status

| Planner | Last examined | Notes |
|---|---|---|
| MoneyHelper pension calculator | 2026-10 (desk research) | Five-step form; single 5% growth; no tax; table of income by age; 62% completion. Worth a proper examination. |
| unbiased.co.uk | 2026-10 (desk research) | Email-gated result; 5% growth; ignores income tax; adviser CTAs. |
| Wealthfront Path | 2026-10 (desk research) | Sliders with live projection; deliberately withholds "the number you need". |
| Betterment | 2026-10 (desk research) | Compresses a plan to "On track · 96% chance". |
| Boldin (NewRetirement) | 2026-10 (desk research) | 1,000 Monte Carlo paths, paid tier. |
| ProjectionLab | 2026-10 (desk research) | 2,000 paths; mobile redesign. |
| Everything else in the roster | never | |

## Examinations

_None yet beyond the desk research above (see `docs/reports/` and
`docs/research_notes/` for the sources)._

## Scorecard

Updated every cycle. Standing: ahead · parity · behind · missing. Stop rule in
`PENSION_SCOUT.md` §7.

| # | Dimension | Best in market (planner) | Someday | Evidence |
|---|---|---|---|---|
| 1 | Honest headline | Someday | ahead | research report §C |
| 2 | Uncertainty in the primary view | Wealthfront fan; Acme-style strands | ahead | grains + strands + floor |
| 3 | UK tax correctness | HL / Timeline | ahead (unverified vs Timeline) | engine `taxFor`, Scotland |
| 4 | State Pension | MoneyHelper | parity | `spaFor`, 12,548 |
| 5 | Defined benefit | Timeline / Voyant | parity (unverified) | `DB_SCHEMES` |
| 6 | Contributions and relief | MoneyHelper / HL | behind | B2 |
| 7 | Sequence risk, bad histories | Timeline / cFIREsim | ahead | `STRESS_PATHS` |
| 8 | Dynamic spending rules | Income Lab / Timeline | parity | guardrails, levers |
| 9 | Couples and survivor | MaxiFi / Boldin | parity; UX thin | B1 |
| 10 | Longevity | Rich Broke or Dead | behind (display) | B3 |
| 11 | Care, housing, IHT | Boldin / Voyant | missing | B4 |
| 12 | Levers, measured | Boldin | ahead | `levers` |
| 13 | Time to first answer, defaults | Toss-style single input | parity | dial defaults |
| 14 | Liveness | Wealthfront Path | ahead | the ring |
| 15 | Accessibility | — | parity (unverified; no axe run yet) | hidden ranges |
| 16 | Mobile fit | — | parity | 375 × 667 fits |
| 17 | Trust signals | MoneyHelper (GOV) | behind (no assumptions page on the home) | Peace sheet has assumptions |
| 18 | Performance | — | unknown (not measured on a real phone) | — |
| 19 | Data safety | Someday | ahead | no server |
| 20 | Copy | — | parity | — |

## Comparison

| Feature | Best in market | Someday today | Verdict |
|---|---|---|---|
| Headline framing | £ a month after tax (Someday); most show a pot or a gross annual figure | £ a month after tax, today's money, with "lasts to" | Ahead |
| Uncertainty | Boldin/ProjectionLab: % success; Wealthfront: fan | 100 grains (share of 2,000 futures), strands, floor under real bad histories | Ahead; keep honest |
| Income tax | Most UK consumer tools ignore it | Full UK bands incl. Scotland, taper, LSA | Ahead |
| Couples | Rare; MaxiFi and Boldin do it | Two individuals, survivor phase | Ahead; survivor UX is thin |
| Dynamic spending rules | Timeline, Income Lab, Boldin | Guardrails and levers | At parity; no user-set rule yet |
| Care costs / housing | Boldin, Voyant | Not modelled | Gap (coverage) |
| Pension contributions and tax relief | MoneyHelper, HL | Contributions yes; relief/salary sacrifice not explicit | Gap (correctness, small) |
| Longevity | Rich Broke or Dead uses mortality tables in the chart | Mortality-weighted success exists; chart uses a fixed horizon | Gap (polish) |

## Backlog

| Id | Title | Class | Value | Cost | Evidence | Status |
|---|---|---|---|---|---|---|
| B1 | Show the survivor's income after a first death on the dial (not only in Explore) | coverage | medium | medium | Comparison: couples | open |
| B2 | Explicit tax relief on contributions (basic/higher rate, salary sacrifice) | correctness | medium | small | MoneyHelper, HL show relief | open |
| B3 | Mortality shading on the strands (Rich, Broke or Dead) | polish | low | small | Engaging Data | open |
| B4 | Care-cost scenario as a lever | coverage | medium | large | Boldin, Voyant | open |
| B5 | Hallway test the dial's bezel words (findability within 10 s) | ux-evidence | high | small | Research report §D | open |
| B6 | One-tap "assumptions and sources" from the dial (trust) | trust | medium | small | Scorecard 17 | open |
| B7 | Measure performance on a mid-range Android (engine call, MC latency) | performance | medium | small | Scorecard 18 | open |
| B8 | Run axe-core in the UAT and fix what it finds | accessibility | medium | small | Scorecard 15 | open |

## Cycles

| Date | Planners | Improvement | PR | Outcome |
|---|---|---|---|---|
| — | — | Ledger seeded from the October 2026 UX research | — | — |
