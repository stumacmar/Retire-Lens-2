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

## Cycles

| Date | Planners | Improvement | PR | Outcome |
|---|---|---|---|---|
| — | — | Ledger seeded from the October 2026 UX research | — | — |
