# Pension Scout ledger

Memory between cycles. Read it first; update it last. Format is in
`PENSION_SCOUT.md` §6.

## Roster status

| Planner | Last examined | Notes |
|---|---|---|
| MoneyHelper pension calculator | 2026-11-13 (GOV.UK transparency record; site blocks fetches) | Annuity-based, 5% / 0.75% / 2.5%, no income tax, SP figure stale. 62% completion. |
| Hargreaves Lansdown (pension + drawdown calculators) | 2026-11-13 (drawdown calc read; pension calc is JS-only) | Drawdown: single 5% line, 1% charge, **no inflation**, ONS cohort life expectancy by sex. |
| PensionBee pension calculator | 2026-11-13 | 3/5/8% growth, 0.7% fee, 2.5% inflation, SP 12,547, PLSA standards shown, tax relief inconsistent (20% vs 25%). |
| unbiased.co.uk | 2026-10 (desk research) | Email-gated result; 5% growth; ignores income tax; adviser CTAs. |
| Wealthfront Path | 2026-10 (desk research) | Sliders with live projection; deliberately withholds "the number you need". |
| Betterment | 2026-10 (desk research) | Compresses a plan to "On track · 96% chance". |
| Boldin (NewRetirement) | 2026-10 (desk research) | 1,000 Monte Carlo paths, paid tier. |
| ProjectionLab | 2026-10 (desk research) | 2,000 paths; mobile redesign. |
| Everything else in the roster | never | Next: Nutmeg, Vanguard UK, AJ Bell, Standard Life (has a public assumptions page), Timeline. |

## Examinations

### MoneyHelper pension calculator — 2026-11-13 — https://www.moneyhelper.org.uk/en/pensions-and-retirement/pensions-basics/pension-calculator
Audience: UK general public, 55+ is the stated core · Access: free, no sign-up · Platform: web (server-side calculation)
Engine: growth 5% a year, single rate · inflation 2.5% (pot and income deflated) · charges 0.75% a year · tax: relief on contributions only, **no income tax on retirement income** · SP: full new State Pension, age from DoB, but the record still quotes **£221.20 a week (2024/25)**, uprated by inflation · TFC: up to 25%, reduces the annuity · DB: entered as income, rises with inflation · annuity/drawdown: pot converted to a **fixed, non-increasing lifetime annuity**; no drawdown · sequence risk: none · MC: none · guardrails: none · couples: single person only (a deceased partner's pension as "other income") · longevity: not addressed ("does not directly address the risk of outliving pension income") · care/housing/IHT: none · contributions: user + employer, rise 2.5% a year · levers: shortfall recommendations (pay more, retire later); pots over £1m referred to advice.
UX: first answer after a five-step form (no live update) · defaults: target income derived from salary · uncertainty: none · headline: table of total income by age vs target, shortfall/surplus · gating: none · accessibility: GOV-standard · mobile: yes · copy: plain, "illustrative, not definitive".
Best thing about it (specific): tested against 25 Government Actuary's Department scenarios and published as a GOV.UK algorithmic transparency record; inputs live only in the browser query string.
Worst thing about it (specific): a nominal, non-increasing annuity is presented as the retirement income, with no income tax, so the "income at 67" overstates what lands in the bank and understates how far it falls behind prices.
Traps: fixed annuity as the only decumulation model; stale State Pension figure in the published record; no income tax.
Gaps for Someday: none in correctness. Coverage: a salary-derived target suggestion (low value; Someday now anchors to Retirement Living Standards instead). Trust: the GAD-scenario provenance is a model for how to publish `runAssertions` (medium / small / trust) → B9.
Sources: https://www.gov.uk/algorithmic-transparency-records/money-and-pensions-service-pension-calculator (the calculator page itself returns 403 to automated fetches).

### Hargreaves Lansdown drawdown calculator — 2026-11-13 — https://www.hl.co.uk/retirement/drawdown/calculator
Audience: DIY investors at or near retirement · Access: free, no sign-up · Platform: web
Engine: growth 5% net, editable · inflation **not modelled** ("Results don't take into account the effects of inflation") · charges 1% a year, editable · tax: income entered "before tax"; not applied · SP: not mentioned · TFC: an input, use not explained · DB: none · annuity/drawdown: drawdown only · sequence risk: none ("rather than grow by a steady percentage each year as shown in this calculator") · MC: none · guardrails: none · couples: none · longevity: **life expectancy from ONS 2020-based cohort tables by age and sex, plus the DWP chance of living to 100** · care/housing/IHT: none · levers: edit growth, charge, life expectancy.
UX: first answer in ~30 s (DoB, pot, monthly income, TFC, sex) · defaults 5% / 1% · not live (Calculate button) · uncertainty: none · headline: how long the pot lasts vs life expectancy · gating: none · copy: clear risk warnings.
The pension calculator at https://www.hl.co.uk/pensions/pension-calculator renders only in JavaScript; not examined.
Best thing about it (specific): the horizon is a personal life expectancy from ONS cohort tables, named as such, with the chance of reaching 100 alongside.
Worst thing about it (specific): a nominal projection with no inflation presented to people choosing a monthly income for twenty-plus years.
Traps: nominal money; a single deterministic line; "before tax" income as the headline.
Gaps for Someday: show the user's cohort life expectancy and chance of reaching the plan age next to "Plan to age" (medium / small / coverage) → B3 re-scoped; Someday already has a unisex Gompertz fit; HL's sex-specific ONS cohort table is more honest for a single person (low / medium / correctness) → B10.
Sources: https://www.hl.co.uk/retirement/drawdown/calculator

### PensionBee pension calculator — 2026-11-13 — https://www.pensionbee.com/uk/pension-calculator
Audience: savers 25–55 consolidating pots · Access: free; PDF export; "Get started" sign-up CTAs throughout · Platform: web, live-updating
Engine: growth Low 3% / Average 5% / High 8%, single line at a time · inflation 2.5% ("the FCA's assumed rate") · fee 0.7% a year · tax: **relief on contributions shown, but the page says 20% in one place and 25% in another**; no income tax on retirement income · SP: £12,547 a year (2026/27), from 67, rises with inflation · TFC: 25% toggle, reduces the pot · DB: none · annuity/drawdown: pot drawn to age 100, not named · sequence risk: none · MC: none · guardrails: none · couples: none · longevity: fixed at 100 · care/housing/IHT: none (assumes mortgage- and rent-free) · contributions: user + employer, rise with inflation · levers: the three growth buttons and the contribution fields.
UX: first answer in ~20 s with sensible example inputs · live · uncertainty: three growth lines, no probabilities · headline: **projected pot vs target pot, then monthly income from pot + State Pension, with the PLSA Retirement Living Standards (Minimum / Moderate / Comfortable) alongside** · gating: soft (sign-up CTAs, PDF) · mobile: good · copy: friendly, "£270 ahead of your target".
Best thing about it (specific): the target is framed against a published, independent yardstick (Retirement Living Standards), in today's money, so a first-time user knows whether £2,000 a month is Minimum or Comfortable.
Worst thing about it (specific): "income from the pot" is gross of tax while the standards it is compared to are after tax, so the comparison flatters the plan.
Traps: comparing gross income with after-tax standards; relief stated inconsistently; a growth button in place of a distribution.
Gaps for Someday: Retirement Living Standards shown with the target (medium / small / coverage) → **shipped this cycle** (B11). Someday's fresh-start default quoted a two-editions-old figure (43,100) → corrected to 45,400.
Sources: https://www.pensionbee.com/uk/pension-calculator · https://www.pensionbee.com/uk/drawdown-calculator (a one-off withdrawal tax tool, emergency Month 1 code; not a projection) · https://www.retirementlivingstandards.org.uk/ (2026 edition: one person 13,900 / 32,700 / 45,400; two people 22,500 / 45,400 / 62,700; after tax, home owned outright).

## Scorecard

Updated every cycle. Standing: ahead · parity · behind · missing. Stop rule in
`PENSION_SCOUT.md` §7.

| # | Dimension | Best in market (planner) | Someday | Evidence |
|---|---|---|---|---|
| 1 | Honest headline | Someday | ahead, with a caveat | Was wrong for stops before pension age until B13 (2026-11-13): "lasts" ignored unpaid years. MoneyHelper (nominal fixed annuity, no tax), HL (no inflation), PensionBee (gross pot income vs after-tax standards) all examined 2026-11-13 |
| 2 | Uncertainty in the primary view | Wealthfront fan; Acme-style strands | ahead | grains + strands + floor; the three UK tools show one line |
| 3 | UK tax correctness | HL / Timeline | ahead (unverified vs Timeline) | engine `taxFor`, Scotland; none of the three UK consumer tools taxes retirement income |
| 4 | State Pension | PensionBee (12,547, 2026/27) | parity | `spaFor`, 12,548 (12,547.60 rounded); MoneyHelper's record is a year stale |
| 5 | Defined benefit | Timeline / Voyant | parity (unverified) | `DB_SCHEMES` |
| 6 | Contributions and relief | MoneyHelper / HL | behind | B2; PensionBee shows relief but inconsistently |
| 7 | Sequence risk, bad histories | Timeline / cFIREsim | ahead on coverage; the 2008 path is too kind (B14) | `STRESS_PATHS`; gfc floor only 3–6% under base |
| 8 | Dynamic spending rules | Income Lab / Timeline | parity | guardrails, levers |
| 9 | Couples and survivor | MaxiFi / Boldin | parity; UX thin | B1 |
| 10 | Longevity | HL (ONS cohort by sex, chance of 100) / Rich Broke or Dead | behind (display) | B3, B10: engine has Gompertz; UI shows a fixed age |
| 11 | Care, housing, IHT | Boldin / Voyant | missing | B4 |
| 12 | Levers, measured | Boldin | ahead | `levers`; MoneyHelper offers two unmeasured suggestions |
| 13 | Time to first answer, defaults | PensionBee (standards alongside the target) | ahead on the target; behind on discoverability (B15) and growth default (B18) | Living Standards chips + dial hint + corrected default (B11); owner could not tell what the ring is for |
| 20b | Visual design (owner's view) | — | reset 2026-11-13 (B16 shipped); awaiting the owner's reaction | white / slate / blue, bold sans figure |
| 14 | Liveness | Wealthfront Path | ahead | the ring; PensionBee is live too, MoneyHelper and HL are not |
| 15 | Accessibility | — | parity (unverified; no axe run yet) | hidden ranges |
| 16 | Mobile fit | — | parity | 375 × 667 fits |
| 17 | Trust signals | MoneyHelper (GOV.UK transparency record, GAD scenarios) | behind (no public provenance) | Assumptions sheet exists; B6, B9 |
| 18 | Performance | — | unknown (not measured on a real phone) | B7 |
| 19 | Data safety | Someday (MoneyHelper also keeps inputs in the browser) | ahead | no server |
| 20 | Copy | PensionBee (friendly) / MoneyHelper (plain) | parity | — |

## Comparison

| Feature | Best in market | Someday today | Verdict |
|---|---|---|---|
| Headline framing | £ a month after tax (Someday); MoneyHelper shows a nominal fixed annuity, HL a nominal drawdown, PensionBee gross pot income | £ a month after tax, today's money, with "lasts to" | Ahead |
| Target against an independent yardstick | PensionBee shows PLSA Minimum / Moderate / Comfortable | Shipped 2026-11-13: chips on the Someday page, hint under the dial figure, Assumptions row; fresh default = Moderate for two | Parity → ahead (after tax, per household) |
| Uncertainty | Boldin/ProjectionLab: % success; Wealthfront: fan | 100 grains (share of 2,000 futures), strands, floor under real bad histories | Ahead; keep honest |
| Income tax | Most UK consumer tools ignore it (all three examined) | Full UK bands incl. Scotland, taper, LSA | Ahead |
| Inflation | PensionBee, MoneyHelper 2.5%; HL none | User-set, applied to spending, SP, indexed pensions, thresholds | Ahead |
| Charges | MoneyHelper 0.75%, PensionBee 0.7%, HL 1% | 0.5% default, user-set, off every return | Parity; default is at the low end — note in Assumptions (B12) |
| Couples | Rare; MaxiFi and Boldin do it | Two individuals, survivor phase | Ahead; survivor UX is thin |
| Dynamic spending rules | Timeline, Income Lab, Boldin | Guardrails and levers | At parity; no user-set rule yet |
| Care costs / housing | Boldin, Voyant | Not modelled | Gap (coverage) |
| Pension contributions and tax relief | MoneyHelper, HL, PensionBee | Contributions yes; relief via a gross-up toggle | Gap (correctness, small) |
| Longevity | HL: ONS cohort life expectancy by sex, chance of 100; Rich Broke or Dead | Mortality-weighted success exists; UI uses a fixed horizon | Gap (display) |
| Provenance | MoneyHelper: GOV.UK transparency record, 25 GAD scenarios | 117 load-time assertions, not surfaced | Gap (trust) |

## Backlog

| Id | Title | Class | Value | Cost | Evidence | Status |
|---|---|---|---|---|---|---|
| B1 | Show the survivor's income after a first death on the dial (not only in Explore) | coverage | medium | medium | Comparison: couples | open |
| B2 | Explicit tax relief on contributions (basic/higher rate, salary sacrifice) | correctness | medium | small | MoneyHelper, HL, PensionBee show relief | open |
| B3 | Show cohort life expectancy and the chance of reaching the plan age beside "Plan to age" (engine `householdSurvival` already exists) | coverage | medium | small | HL drawdown calculator names ONS cohort life expectancy; Engaging Data | open (re-scoped 2026-11-13) |
| B4 | Care-cost scenario as a lever | coverage | medium | large | Boldin, Voyant | open |
| B5 | Hallway test the dial's bezel words (findability within 10 s) | ux-evidence | high | small | Research report §D | open |
| B6 | One-tap "assumptions and sources" from the dial (trust) | trust | medium | small | Scorecard 17 | open |
| B7 | Measure performance on a mid-range Android (engine call, MC latency) | performance | medium | small | Scorecard 18 | open |
| B8 | Run axe-core in the UAT and fix what it finds | accessibility | medium | small | Scorecard 15 | open |
| B9 | Publish the engine's provenance: a "How we checked" page listing the 117 load-time assertions and the hand-checked tax cases | trust | medium | small | MoneyHelper's GOV.UK transparency record (GAD scenarios) | open |
| B10 | Sex-specific ONS cohort mortality for single-person plans (keep unisex for couples) | correctness | low | medium | HL uses ONS 2020-based cohort tables by sex | open |
| B11 | Retirement Living Standards beside the target; fresh default corrected to the 2026 Moderate figure for two | coverage | medium | small | PensionBee; retirementlivingstandards.org.uk | shipped 2026-11-13 |
| B12 | Say in Assumptions that 0.5% is a low-cost all-in charge and that 0.7–1% is common | trust | low | small | MoneyHelper 0.75%, PensionBee 0.7%, HL 1% | open |
| B13 | "Lasts" must mean every year paid: a pension locked until 57 never "exhausts", so the map, edge, guardrails, dial and report called fifteen unpaid years a plan that lasts | correctness | high | small | Owner, 2026-11-13: "the dashboard is nonsense"; reproduced with a 41-year-old stopping at 42 on £70k | shipped 2026-11-13 (`holds`, `runsShortAgeA`) |
| B14 | The "2008, the day you stop" path includes the 2009–2017 recovery (+86% real over ten years), so its floor sits only 3–6% under base in every plan shape; the dial shows it first | correctness | medium | small | Owner, 2026-11-13; `STRESS_PATHS.gfc` analysis | open: drop the recovery years or show the worst history first |
| B15 | The ring is not self-evident: nothing says "tap a label, then turn the ring"; bezel labels read as captions | ux | high | small | Owner, 2026-11-13; B5 | shipped 2026-11-13: first-use hint until the first turn, pill behind every label, the active one in the action colour |
| B16 | Palette reads dated (cream, caramel, serif figure, dawn gradient); owner wants crisp and modern | polish | medium | small | Owner, 2026-11-13 | shipped 2026-11-13: white page, slate ink, blue action colour, bold sans figure, flat backdrop; graphite dark mode; map colours amber/red; PWA theme colours and SW cache bumped |
| B19 | The stop-age ring was capped at twenty years out (a 26-year-old could not look past 46) and the decision map covered the same nineteen years | correctness | high | small | Owner, 2026-11-13 | shipped 2026-11-13: ring to 75; map to age 75 in steps of up to three years, nearest-column lookup |
| B17 | CI takes ~10 minutes because the non-blocking legacy classic-planner E2E runs for 6 of them | performance | low | small | CI run 43399782976 step timings | open |
| B18 | Default growth 7% nominal (4.5% real after the 0.5% fee) sat near the FCA "higher" rate; MoneyHelper and PensionBee use 5%. A 26-year-old with £570k and £3,200 a month was shown £5m in today's money at 60, 100 of 100 futures and a Japan floor of £10,750 a month | correctness | high | small | Owner, 2026-11-13 ("utter nonsense"); FCA COBS 13 Annex 2 rates 2/5/8%; GOV.UK transparency record | shipped 2026-11-13: Balanced = FCA 2 / 5 / 8, Cautious 1.5 / 3.5 / 5.5, Adventurous 2.5 / 6 / 9; fresh plans apply the preset. The workbook fixture keeps 4 / 7 / 10 for parity tests |
| B20 | The strands chart scaled to the single wildest future, so sixty years of compounding flattened the central path into the baseline, and nothing on it said what the height meant | polish | medium | small | Owner's screenshot, 2026-11-13 | shipped 2026-11-13: scale to the ninth decile of strand peaks; label the top of the chart and the pot on the day you stop, in today's money |

## Cycles

| Date | Planners | Improvement | PR | Outcome |
|---|---|---|---|---|
| — | — | Ledger seeded from the October 2026 UX research | — | — |
| 2026-11-13 | MoneyHelper, Hargreaves Lansdown, PensionBee | Retirement Living Standards (Pensions UK 2026) beside the target: engine constant + 3 assertions, chips on the Someday page, hint under the dial figure, Assumptions row; fresh default 43,100 → 45,400 | [#34](https://github.com/stumacmar/Retire-Lens-2/pull/34) (branch scout/2026-11-13-living-standards) | merged and live 2026-11-13 10:18 |
| 2026-11-13 (owner-driven) | — | CI runner pinned to Ubuntu 24.04 (GitHub moved `ubuntu-latest` to 26.04; Playwright could not install Chromium; nothing had deployed since 31 October) | [#35](https://github.com/stumacmar/Retire-Lens-2/pull/35) | merged; first green CI since 31 October; deploy restored |
| 2026-11-13 (owner-driven) | — | B18, B20: FCA projection rates as the Balanced preset and the fresh-plan default; strands chart scaled to the ninth decile with the top and the pot-at-stop labelled. 2 new assertions (123), e2e E47h | scout/2026-11-13-fca-rates | see PR |
| 2026-11-13 (owner-driven) | — | B15, B16, B19: stop-age ring to 75 and the map to age 75; crisp palette (white / slate / blue, graphite dark), bold sans figure, flat backdrop; ring hint and tappable bezel labels. UAT 124–131, e2e E47g | scout/2026-11-13-owner-fixes | see PR |
| 2026-11-13 (owner-driven) | — | B13: "holds" means every year paid. `drawdown` gains `runsShortYear/AgeA` and `holds`; insights (capacity, guardrails, decision map), the dial, the report, stress tests, levers, strategy and DB-timing comparisons all read it. 4 new assertions (121), UAT 121–123, e2e E47d–f | scout/2026-11-13-unfunded-years | see PR |
