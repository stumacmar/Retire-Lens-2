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
| Standard Life retirement calculator | 2026-11-14 (assumptions page) | 2/5/8%, 2% inflation, 0.55% charge, contributions +3.5% a year; gross income; annuity rates dated 09/10/2026; **drawdown income is flat with no inflation rises**; no horizon stated. |
| Vanguard UK pension calculator | 2026-11-14 | 2/5/8% ("FCA rules"), 2% inflation, 0.15% + 0.20% fees, SP from 67, 25% TFC capped at the LSA, **income = 4% of the remaining pot, before tax**; three growth buttons, no probabilities. |
| Fidelity UK retirement calculator (Wealth Wizards) | 2026-11-14 | 5%, 2% inflation, 0.41% charge; **net of a basic income-tax calculation**; SP 12,547 (×2 for couples); couples' contributions; Retirement Living Standards as the target; 4% drawdown **to age 100**; no TFC; single estimate. |
| Nutmeg (now J.P. Morgan Personal Investing), AJ Bell | 2026-11-14 (pages 404) | Nutmeg's calculator redirects to personalinvesting.jpmorgan.com and 404s; AJ Bell's calculator URL 404s. Re-try with new URLs. |
| AJ Bell pension calculator | 2026-11-15 | 5% (2% / 8% options) before charges and inflation, 2% inflation, contributions rise 3% a year, 0.6% charge, 25% TFC capped at the LSA, **income = 4% of the remaining pot**, "subject to income tax" but not taxed in the figure; tax relief not described in the calculator (20%, "more if higher rate" on the SIPP page). |
| Timeline (adviser) | 2026-11-15 (research article; software is adviser-only) | Bengen-style rolling 30-year historical windows from 1915 (UK), 1% fee, gross of tax; UK local 50/50 at 4% succeeds in 70% of windows; worst UK start June 1947, £29,700 from £1m (2.97%). |
| Royal London | 2026-11-15 (published documents; calculator URL 404) | FCA 2/5/8% capped rates from its quarterly LEAF assumptions; living-standards guide uses 5% growth, 2% inflation, 0.75% fee. Calculator not reachable. |
| Aviva, Scottish Widows, Legal & General | 2026-11-15 (blocked: 403 / error page / not found) | Not examined; try again or via app-store teardown. |
| Nest retirement calculator | 2026-11-16 (public "What could I get" page) | Today's money; growth 2–3% above inflation and charges; 2.5% inflation; 0.3% a year plus **1.8% of each contribution**; basic-rate relief; annuity only (3.7% level, 0.2% for an inflation-linked income, as stated); **no income tax, no State Pension** (points to MoneyHelper); single estimate. |
| Penfold generic illustration | 2026-11-16 | FCA 2/5/8%, 2% inflation, today's money; **0.75% a year** (0.88% Sharia); 25% TFC; annuity only, from 68; basic-rate relief; no State Pension. |
| Smart Pension calculator | 2026-11-16 (help article; members only) | Members under 75 only; result against the Retirement Living Standards; fixed single-life annuity; growth after charges by fund; salary +2.5%. |
| Interactive Investor, Guiide, TPAW Planner | 2026-11-16 (not reachable: ii calculator 404; Guiide and TPAW render only in JavaScript) | TPAW described secondhand: 500 simulations, percentile spending (5th used as the cautious view). Retry with a browser. |
| Moneyfarm pension calculator | 2026-11-17 | 5% saving / 3% retired (one fixed allocation), 2% inflation, today's money, **0.62% all in**, basic-rate relief ("higher and additional rate taxpayers may get more"), **State Pension £11,501 at 66 (2024/25 figures)**, drawdown to **ONS life expectancy 82.6**, no tax on withdrawals, single estimate; FAQ quotes different assumptions (4% growth, SP £8,546, 83). |
| Which? pension calculator | 2026-11-17 (article only) | Pot at retirement; State Pension "you'll also need to factor in"; no assumptions published on the page. |
| Aviva My Retirement Planner | 2026-11-17 (403 again at aviva.co.uk/retirement/tools/my-retirement-planner) | Not examined. |
| Moneybox | 2026-11-17 (help article 404; search snippet only) | Target and projected income adjusted for 2% inflation; nothing else published. |
| FIRECalc | 2026-11-18 | Every historical start year since 1871 (Shiller), 75/25 "couch potato" at a 0.18% fee, constant real spending by default; Bernicke (spending falls 2–3% a year in real terms from 56 to 76) and percentage-of-portfolio options; success = "not depleted"; no tax; free, "does not store any information you enter". |
| MaxiFi Planner | 2026-11-18 (how-it-works page; software is paid) | Consumption smoothing: the headline is "the highest annual spending level that your household income and assets can support", in today's dollars; plans to a maximum age, not life expectancy; "Living Standard Monte Carlo"; argues an "80% chance of success" is a 20% chance of going broke. US taxes and Social Security. Subscription tiers. |
| Engaging Data "Rich, Broke or Dead" | 2026-11-18 | Historical cycles (Shiller 1871–2023) crossed with mortality (SSA average, Society of Actuaries low/high, by sex): each year of retirement shows the share broke, the bands of money left and a growing "wedge of death"; average tax rate as a gross-up; fees; spending flexibility. "The likelihood of dying is much higher than running out of money." Free. |
| Portfolio Visualizer (Monte Carlo) | 2026-11-19 | Returns: historical bootstrap (single month, single year or blocks of years), statistical, forecasted, parameterised (normal or fat-tailed, GARCH); inflation historical or with its own mean and volatility; "Worst 1 Year First" to "Worst 10 Years First" sequence stress; withdrawals fixed, percentage, smoothing rules or by life expectancy; user-chosen "Percentile Intervals" for the reported figures; US tax rates as flat percentages; sign-up offered. |
| cFIREsim | 2026-11-19 | Every historical start year (data to August 2026), a single start year, or constant growth; eight spending plans (inflation adjusted, percent of portfolio, VPW, Hebeler Autopilot, Guyton-Klinger, variable CAPE…); equities/bonds/gold/cash with fees and a glide path; two Social Security streams, pensions, floors and ceilings; no tax; "Maximum Initial Yearly Spending For 100% Success"; free, no sign-up. |
| FI Calc | 2026-11-19 (about and docs introduction; the app is JavaScript-only) | Backtesting of withdrawal strategies on historical data; results exportable as CSV; free, donation-supported. Details not reachable without a browser. |
| TPAW Planner | 2026-11-19 (learn page renders only in JavaScript) | Not examined. |
| Flexible Retirement Planner | 2026-11-20 (home and five documentation pages) | Monte Carlo, 10,000 trials from a return and a standard deviation; three spending policies (Stable; Conservative withholds the inflation rise while the real portfolio is below its start; Flexible also raises after good years, on thresholds "chosen somewhat arbitrarily"); "Probability of Success" with traffic lights (below 75% "a failed plan", green above 90%) beside "Average Spending Shortfall" and "Percent of Expenses Funded"; median bars with 10th and 90th bands; a year-by-year "Detailed View" that can be printed, copied or exported; a two-input sensitivity heatmap; one-year crash entries. |
| Pralana (Online and Gold) | 2026-11-20 (home and Online highlights; vendor copy) | Deterministic, historical (every start year from 1928, best and worst start named), and 1,000 conventional or block-bootstrap Monte Carlo runs; US federal, state and local tax down to replicas of the forms; Roth conversion, withdrawal-order and Social Security optimisers; charts and tables throughout; "consumption smoothing"; three scenarios side by side; subscription with a free trial (web) or an Excel model. No essential/discretionary split, floor or guardrail described; "success" not defined. |
| Income Lab | 2026-11-20 (home and guardrails guide; adviser software, vendor copy) | Risk-based guardrails stated as money: "You can spend $8,200 per month." "If your portfolio drops to the lower guardrail, we reduce spending to $7,400." Target at the 20th percentile of 1,000+ scenarios; cuts are 10% of the gap (gradual), raises 100% (immediate), changes under 5% ignored; recalculated monthly; argues probability of success "answers the wrong question" and hides underspending. Advisers only, 14-day trial. |
| FI Calc (the app itself) | 2026-11-21 (read with the built-in browser; JavaScript-only) | 154 historical start years by default; thirteen withdrawal strategies (constant dollar, percent of portfolio, 1/N, VPW, Guyton-Klinger, CAPE-based, Vanguard dynamic and others); beside the success rate (97.4%, "150 out of 154") five more counts: volatile spending, large and small spending, **large end portfolio (at least double the start: 58.4%)** and small end portfolio; median, largest and smallest end values; first-year dollars; share and export. |
| TPAW Planner (learn pages) | 2026-11-21 (built-in browser) | Variable spending by amortising the total portfolio (pensions and future savings counted as assets); "displays the range of your retirement spending at each age without attaching an artificial pass/fail sign"; returns from history shifted down to today's yields and not held to history's order; "Assume that your pension will be lower than expected… re-run the simulations using high, medium, and low estimates". |
| Moneysmart retirement planner (Australian government) | 2026-11-21 (built-in browser; plain fetches get 403) | Three steps, results downloadable; **"Include the Age Pension? Yes / No"**, home ownership and personal assets (the means test); CPI 2.5%, wage inflation 3.7%, **deflated by wages before retirement and prices after**; returns by option (super: High Growth 6.8% to Cash 3.7%; pension phase 7.2% to 4.3%); fees in dollars and per cent with a cap; partner optional; one line, no range. |
| Guiide | 2026-11-21 (home, FAQ titles and charges comparison, built-in browser; the planner needs an account) | Free, FCA-regulated, built by actuaries; after-tax income need, withdrawals split between pots "to make these more tax efficient", stress test, yearly tracking; couples "once the product is launched"; a **drawdown charges comparison in lifetime pounds** (a 60-year-old with £300,000 taking £20,000 a year: £59,200 of charges at 1%, £22,600 at the cheapest provider). |
| Canadian Retirement Income Calculator (Government of Canada) | 2026-11-21 | CPP/QPP, OAS, employer pension, RRSP/TFSA, other income, one tab each; "about 30 minutes to complete"; a table and chart of income by age 65 to 88 against a goal in today's dollars, before tax; **age the income stops defaults to life expectancy from age and sex** (women 88, men 85 to 86); couples run it twice; "does not collect any personal information"; no return or inflation assumption published on the pages read; no range. |
| Legal & General, Aegon, Retirement Line, Scottish Widows, Voyant, Nest Egg Guru | 2026-11-21 (not reachable: 404 ×5; Scottish Widows serves an error page; Voyant's site is a JavaScript shell with no content; nesteggguru.com is now a different product) | Not examined. Voyant is worth one try with the built-in browser. |
| Everything else in the roster | never | Next: Voyant, Aviva, Scottish Widows and the Hargreaves Lansdown pension calculator **with the built-in browser** (it reads JavaScript-only pages and some sites that refuse plain fetches: `scratchpad` script with Playwright through the session's proxy); Virgin Money Navigator; CashCalc; Empower, Schwab and Vanguard US; Wealthfront and Betterment (desk research only so far). |

## Examinations

### FI Calc — 2026-11-21 — https://ficalc.app/
DIY retirees (US) · free, no account · web app (JavaScript only; read with the built-in browser)
Engine: historical start years (154 by default, "loops to the first year"); 80/15/5 stocks, bonds and cash rebalanced yearly; thirteen withdrawal strategies; extra withdrawals and income by year; first-year dollars. No tax.
UX: configuration on the left, results at once on the right. Beside "Success Rate 97.4%, 150 out of 154": volatile spending (a year-on-year change over 25%), large and small spending (50% above or below the first year), **large end portfolio (at least 100% more than the start: 58.4%, 90 of 154)** and small end portfolio (5.8%); then median, average, largest and smallest end portfolio, the count of $0 portfolios, a histogram and a table. Share and export.
Best thing: the answer is six counts, not one. Ending with double what you started with is reported as plainly as running out, so over-saving is visible.
Worst thing: thirteen strategies and no guidance on choosing; history only, so the worst case is the worst that has happened.
Traps: counts out of 154 overlapping histories read as more evidence than they are.
Gaps for Someday: nothing says how often a plan ends with more than it started with (B34, needs a count from the simulation). Lifetime end values are in Explore as percentiles already.
Sources: the app's default results, read 2026-11-21.

### TPAW Planner — 2026-11-21 — https://tpawplanner.com/learn (and /learn/uncertainty, /learn/sequence-of-return-risk)
DIY retirees (US) · free · web app (JavaScript only)
Engine (as described): spending amortised from the total portfolio, future savings and pensions included as assets; a fixed allocation on that total, so the visible portfolio's glide path is dynamic; returns from history "shift[ed] down to reflect current yields" and not held to history's order; spending floor and ceiling optional.
UX: "displays the range of your retirement spending at each age without attaching an artificial pass/fail sign to it"; pass or fail "treats coming up short by $1 in the last year of life the same as going broke midway".
Best thing: the argument for showing the range of spending by age instead of one probability, made in plain words; and the instruction to test the plan against a lower pension: "Assume that your pension will be lower than expected… re-run the simulations using high, medium, and low estimates of future savings and retirement income".
Worst thing: the model's vocabulary (Merton's portfolio problem, risk aversion parameters) stands between a lay reader and an answer.
Traps: "no long term damage" from a crash holds only because spending falls percent for percent; Someday's plans hold spending level, so sequence risk is real and must stay on show.
Gaps for Someday: every case in "What could go wrong?" was a market; none tested the State Pension → shipped this cycle (B32).
Sources: the three pages above.

### Moneysmart retirement planner — 2026-11-21 — https://moneysmart.gov.au/plan-for-your-retirement/retirement-planner
Australian public (ASIC) · free, no account · web (plain fetches refused; read with the built-in browser, including "Assumptions and settings")
Engine: super in accumulation and pension phases with separate returns by investment option; fees as dollars, per cent and a cap; insurance premiums; career breaks; other assets; partner optional; the means-tested Age Pension, with "Will you own your own home?" and personal assets ($25,000 default).
Assumptions (all editable, with "Reset to default"): inflation 2.5%, wage inflation 3.7%, salary growth 3.7%; **deflator 3.7% before retirement and 2.5% after**; super returns 6.8 / 6.4 / 6.1 / 5.7 / 4.9 / 3.7% (High Growth to Cash), pension-phase returns 7.2 to 4.3%; shares 7.0%, property growth 3.7%.
UX: three steps ("Where you're at now", "How much you'll need", "Review your options"); a running header of target, average estimated income and the gap; download of results; five languages; a 60-second video.
Best thing: **"Include the Age Pension? Yes / No"**: a government planner lets a plan be seen without the public pension.
Worst thing: "today's dollars" before retirement means deflated by wages, so the same word means two things either side of the retirement date.
Traps: the wage deflator. Someday deflates by prices throughout and should keep saying so.
Gaps for Someday: no way to see the plan with less State Pension without editing Details → shipped this cycle (B32).
Sources: the planner and its assumptions panel, read 2026-11-21.

### Guiide — 2026-11-21 — https://www.guiide.co.uk/ · /faq · /drawdowncostcomparer
UK DIY drawdown · free, account needed to build a plan; FCA-regulated (FRN 1031526), "built by actuaries" · web
Engine (as described; the planner itself was not reachable without an account): after-tax income need and for how long; fixed income first, then pension and savings withdrawals "split… to make these more tax efficient"; a stress test; yearly review each April; couples "once the product is launched".
UX: "Finish a plan in minutes"; an integrated drawdown product "coming soon" that pays the planned withdrawals "like a wage".
Best thing: the charges comparison in lifetime pounds for a stated example (a 60-year-old, £300,000, £20,000 a year after tax rising 2.5%, full State Pension): £59,200 at 1% a year against £22,600 at the cheapest provider.
Worst thing: the plan is the front door to a product, and the comparison's provider links are commercial.
Traps: an account before an answer.
Gaps for Someday: charges are stated as pounds a month for 0.25% more; a lifetime figure would land harder (B33).
Sources: the three pages above (FAQ answers are collapsed; only the questions were read).

### Canadian Retirement Income Calculator — 2026-11-21 — https://www.canada.ca/en/services/benefits/publicpensions/cpp/retirement-income-calculator.html
Canadian public (Government of Canada) · free, no account · web
Engine (as described): CPP/QPP from the Statement of Contributions with editable future earnings and start date, OAS from residence history, employer pension, RRSP/TFSA, other income. Return, inflation and tax assumptions are not on the pages read.
UX: "about 30 minutes to complete"; six tabs; a table and a chart of income by source for each age from 65 to 88 beside "Difference Between Your Income Goal and Estimated Income"; the goal in today's dollars before tax; the age income stops defaults to life expectancy for the user's age and sex ("women aged 25 to 65 can expect to live until age 88"); couples are told to run it once each; "The calculator does not collect any personal information or identifiers", though "Your anonymous results may be collected for research purposes".
Best thing: the plan age is offered from a life table, with the basis stated.
Worst thing: half an hour, before tax, one line, and a couple cannot be planned together.
Traps: planning to average life expectancy: half live longer. Someday says so beside the plan age.
Gaps for Someday: none.
Sources: the landing page, the calculator's first tab and its FAQ.

### Income Lab — 2026-11-20 — https://incomelaboratory.com/ · https://incomelaboratory.com/retirement-income-guardrails-complete-guide/
Financial advisers (US) · Core and Pro plans, 14-day trial · web
Engine (as described): 1,000+ scenarios with varying inflation; the spending target sits at a chosen percentile (20th by default); an upper guardrail when every scenario shows underspending, a lower one at 75% overspending risk; cuts are 10% of the gap to target, raises the whole gap; changes under 5% are ignored; recalculated monthly; after-tax, with Social Security and pensions as inputs
UX: the output "is a dollar amount. Not a percentage, not a probability score": a monthly spend, the portfolio values that would change it, and what it would change to
Best thing: every adjustment has a stated trigger, direction and size, in money a client can check against a statement.
Worst thing: the thresholds come from a simulation the client cannot inspect; no worked example states its assumptions.
Traps: its case against probability of success is a vendor's; Someday already names the amount and the worst dip beside the count, and should keep both.
Gaps for Someday: the safe ladder's rules were stated only as funded-ratio percentages → shipped this cycle (B29). Doing the turning-round exposed B30: the ratio counts only guaranteed income already in payment.
Sources: the two pages above.

### Flexible Retirement Planner — 2026-11-20 — https://www.flexibleretirementplanner.com/wp/documentation/
DIY planners (US) · access terms not on the pages read · web or download
Engine: Monte Carlo, 10,000 trials from one return and one standard deviation · inflation by year range, separate rates per cash flow · taxable, tax-deferred and tax-free buckets with a single income-tax rate · spending policies Stable, Conservative and Flexible, keyed to the real portfolio against its starting value
UX: "Probability of Success" with traffic lights, beside "Average Spending Shortfall" and "Percent of Expenses Funded"; median bars with 10th and 90th bands; a detailed year-by-year table that can be printed, copied or exported; a two-input sensitivity heatmap
Best thing: it says in its own documentation that a high probability of success can hide large shortfalls, and shows the shortfall beside it.
Worst thing: results are averages across trials, which the site itself calls "a bit misleading"; the Flexible thresholds are admitted to be arbitrary.
Traps: traffic-light thresholds (75%, 90%) presented as pass and fail.
Gaps for Someday: none in correctness. Its exportable table supports a CSV export of the futures table (B28, still open). Its shortfall measure is Someday's "in the worst 10 of 100, income dips to about £X".
Sources: the page above and its spending-policies, planner-output, additional-inputs and sensitivity-analysis pages.

### Pralana — 2026-11-20 — https://pralanaretirementcalculator.com/ · https://pralanaretirementcalculator.com/pralana-online-highlights/
Detail-minded DIY planners (US) · subscription with a free trial (web), or an Excel model · web / Excel
Engine (vendor copy): deterministic, historical from 1928 with best and worst start years, 1,000 conventional or block-bootstrap Monte Carlo runs · US tax to the level of form replicas, IRMAA and ACA subsidies · Roth conversion, withdrawal-order and claiming-age optimisers · consumption smoothing · three scenarios at once
UX: charts and tables for everything; "Metric MRI" shows the calculation behind a figure
Best thing: a figure can be opened to show how it was calculated.
Worst thing: "success" is never defined on the pages, and no floor, guardrail or essential spending is described.
Traps: depth as a selling point; the pages list dozens of outputs and no single answer.
Gaps for Someday: "show the working behind a figure" is a trust idea worth a backlog note (B31); best and worst historical start years are B24.
Sources: the two pages above.


### Portfolio Visualizer (Monte Carlo) — 2026-11-19 — https://www.portfoliovisualizer.com/monte-carlo-simulation
Investors and advisers (US) · free with a user agreement; sign-up offered · web
Engine: returns by historical bootstrap (month, year or block of years), statistical (means, volatilities, correlations), forecasted or parameterised (normal or fat-tailed, optional GARCH) · inflation historical or parameterised with its own mean and volatility · sequence stress "Worst 1 Year First" to "Worst 10 Years First" · withdrawals fixed, percentage, rolling-average or geometric smoothing, or by life expectancy · 5 to 75 years or perpetual · tax as flat federal, state, capital gains and dividend percentages
UX: one long form; the user chooses the "Percentile Intervals" the results report
Best thing: the worst years can be placed first, which isolates sequence risk from average returns; and the reported percentiles are the user's choice, given as figures.
Worst thing: a form of some forty fields before any answer; tax is a flat percentage.
Traps: fat tails, GARCH and block bootstraps are offered side by side with no guidance; the choice changes the answer more than most inputs.
Gaps for Someday: (1) the year-by-year figures behind the futures existed only as a picture → shipped this cycle (B28). (2) Inflation with its own volatility is B26. (3) "Worst N years first" is close to the crash-then-flat path and the Lantern's shock; no new item.
Sources: the page above.

### cFIREsim — 2026-11-19 — https://www.cfiresim.com/
Early retirers (US) · free, no sign-up · web
Engine: every historical start year (data to August 2026), a chosen start year, or constant growth · equities, bonds, gold, cash, fees, annual rebalancing, a glide path · eight spending plans including VPW, Guyton-Klinger, Hebeler Autopilot and variable CAPE, with floors and ceilings · CPI or a flat rate · two Social Security streams, pensions and other adjustments by year · no tax
UX: tabs for up to 49 saved simulations; "Investigate Spending" solves for "Maximum Initial Yearly Spending For 100% Success"
Best thing: solving for the most that can be spent at a chosen success rate, which is Someday's headline turned round.
Worst thing: no tax; the many spending plans are named after their authors, not explained.
Traps: 100% historical success presented as a safe figure.
Gaps for Someday: named spending rules beyond the guardrails are coverage for enthusiasts, not correctness; not added. All-start-years history remains B24.
Sources: the page above.

### FI Calc — 2026-11-19 — https://ficalc.app/about · https://ficalc.app/docs
Early retirers · free, donation-supported · web (JavaScript-only app)
Engine and UX: backtesting of several withdrawal strategies on historical data; results can be exported as CSV. Nothing more is on the pages that can be read without a browser.
Gaps for Someday: export of the simulated figures; the table shipped this cycle gives them on screen (a file export is a possible follow-on).
Sources: the two pages above.


### Engaging Data "Rich, Broke or Dead" — 2026-11-18 — https://engaging-data.com/will-money-last-retire-early/
Early retirers (US) · free, no sign-up · web
Engine: Shiller returns and inflation 1871–2023, every start year as a cycle · stocks/bonds/cash mix · fees · an average tax rate as a gross-up on spending · extra income and expenses by age · spending flexibility (a cut below a threshold of the starting balance) · mortality: SSA average, Society of Actuaries low and high tables, by sex · no MC (history only)
UX: one stacked chart by age: broke (red), bands of money left (below the start, above it, 2×, 5×) and a grey "wedge of death" that can be hidden · nominal or real
Best thing: the two risks on one picture. "The likelihood of dying is much higher than running out of money."
Worst thing: one person only; an average tax rate; "success" is any balance above zero, so a pot of £1 passes.
Traps: historical frequencies presented as probabilities (the page says so itself); the wedge can read as "do not worry", which is wrong for the half who live longer.
Gaps for Someday: the joint figure existed in the engine (`successLifetime`) but only as a percentage in Explore and the report; "What could go wrong?" gave the age the unluckiest 1 in 10 run short and nothing about being here at that age → shipped this cycle (B27).
Sources: the page above.

### FIRECalc — 2026-11-18 — https://www.firecalc.com/
Early retirers (US) · free; a supporter login adds yearly revisions · web
Engine: every start year since 1871 (mixed portfolios from 1927), not an average · 75/25 default at 0.18% · inflation by CPI, PPI or a fixed rate · spending: constant real (default), Bernicke, or a percentage of the remaining portfolio with a floor (the "95% rule") · Social Security, pensions, lump sums as options · no tax · solves for a target success rate
UX: three inputs to a first answer (spending, portfolio, years) · results in a new window as a success rate and a chart of year-end balances
Best thing: every start year, so the answer is "it would have failed in N of M histories", which a lay reader can check.
Worst thing: no tax at all; US data only.
Traps: a success rate over overlapping 30-year windows is far fewer independent samples than it looks.
Gaps for Someday: all-start-years history is B24 (needs a sourced UK annual real-returns series). Bernicke's falling real spending is already the two later-life switches (15% less from 75, 25% less from 82).
Sources: the page above.

### MaxiFi Planner — 2026-11-18 — https://maxifi.com/how-it-works
US households · paid subscription (Standard, Premium, PRO) · web
Engine: consumption smoothing by dynamic programming (Kotlikoff): the highest sustainable living standard for life · today's dollars · plans to a maximum age of life, not life expectancy · US tax and Social Security optimisers · "Living Standard Monte Carlo"
UX (from the page): headline is a spending level, not a pot and not a probability
Best thing: the headline is what you can spend, for life. Someday's "Your plan can pay £X a month" is the same idea.
Worst thing: paywalled; nothing can be tried.
Traps: none seen from the page.
Gaps for Someday: none in framing (parity: the supportable figure is the headline). Its critique of a bare success percentage is met by the amount named in the sentence and, from this cycle, by the joint figure.
Sources: the page above.

### Moneyfarm — 2026-11-17 — https://www.moneyfarm.com/uk/pension-calculator/
Robo-adviser · free, no sign-up; product and consultant CTAs · web
Engine: growth 5% while saving, 3% in retirement, one fixed allocation · inflation 2%, today's money · charges 0.62% all in · basic-rate relief, "higher and additional rate taxpayers may get more" (not shown) · State Pension £11,501 from 66 (2024/25) · drawdown to ONS life expectancy 82.6 · no tax on withdrawals · no MC
UX: inputs include a gross income target and a State Pension toggle · single estimate · headline: "£20,615.92 off your target", the monthly contribution needed
Best thing: answers "what would I need to pay in" directly, as a monthly figure.
Worst thing: plans to an average life expectancy of 82.6, so half of people outlive the plan; its State Pension and age are two years stale, and the FAQ contradicts the calculator.
Traps: average life expectancy as the horizon; stale State Pension; higher-rate relief mentioned but never quantified.
Gaps for Someday: higher-rate relief named but not measured by anyone examined → shipped this cycle (B2, part).

### Nest — 2026-11-16 — https://nestpensions.org.uk/schemeweb/nest/my-nest-pension/what-could-I-get.html
Workplace (auto-enrolment) members · free · web
Engine: growth "between 2 per cent and 3 per cent per year on average" above inflation and charges, lower near retirement · inflation 2.5% · charges 0.3% a year plus 1.8% of every contribution · basic-rate relief · contributions rise with inflation · annuity bought at retirement (3.7% level, 0.2% inflation-linked, as stated) · no income tax · no State Pension · no MC
UX: today's money · a single estimate, "could be more or less" · the "How we calculate" link is a placeholder
Best thing: says plainly it shows today's money and that the income depends on annuity prices at the time.
Worst thing: no State Pension and no income tax, so the "income" is neither the whole income nor what lands in the bank.
Gaps for Someday: none in correctness. Its charge (0.3% + 1.8% of contributions) widens the market range for B12 → shipped this cycle.

### Penfold — 2026-11-16 — https://getpenfold.com/generic-illustration
App-first SIPP · free illustration · web
Engine: FCA 2/5/8% (real 0.0 / 2.9 / 5.9%) · 2% inflation · 0.75% all in (0.88% Sharia) · basic-rate relief shown (£40 + £10) · 25% TFC · lifetime annuity from 68, five-year guarantee · no State Pension · no tax on income · no MC
Best thing: the charge is broken into its parts (0.73% + 0.02%), with the fee tier above £100,000.
Worst thing: an annuity at 68 is the only route, with no State Pension beside it.
Gaps for Someday: none; 0.75% joins the evidence for B12.

### Smart Pension — 2026-11-16 — https://smartpension.co.uk/support/en/articles/6006698-your-pension-calculator
Workplace members under 75 · gated to members · in-app
Engine: growth after charges by fund · salary +2.5% · fixed single-life annuity, no guarantee · other pensions (DC and DB) as yearly amounts
UX: result compared with the Retirement Living Standards
Gaps for Someday: none; confirms the standards as the common yardstick (B11).



### AJ Bell pension calculator — 2026-11-15 — https://www.ajbell.co.uk/pensions/calculator
UK consumer · free, no sign-up · web
Engine: growth 5% (2/8 options) before charges and inflation · inflation 2% · charge 0.6% · contributions rise 3% a year · tax relief not stated in the calculator ("20% … more if you're a higher rate taxpayer" on the SIPP page) · TFC 25% capped at the £268,275 LSA · income = 4% of the remaining pot, "subject to income tax", figure untaxed · no horizon · no SP in the calculator · no MC
UX: pot first, 4% income beside it · "How we calculate this" on the page · no gating
Best thing: the assumptions are on the same page as the result.
Worst thing: income is 4% of the pot, before tax, with no horizon; the reader cannot tell whether it lasts.
Traps: a 4% rule presented as income, untaxed.
Gaps for Someday: none new; confirms B2 (relief is described everywhere but rarely shown in the figure).

### Timeline — 2026-11-15 — https://www.timeline.co/resources/bengens-4-rule-around-the-world
Adviser software · paid · web
Engine: real historical returns and inflation in rolling 30-year windows (UK monthly data from 1915); 1% fee on the outstanding portfolio; gross of tax in the research (the software adds tax); local and global 50/50 portfolios
Results: UK local 50/50 at 4% succeeds in 70% of windows; worst UK start June 1947 (£29,700 a year from £1m, 2.97%); global 50/50 worst start May 1961 (3.05%)
Best thing: real UK history, including 1947 and the 1970s, not a single invented crash.
Worst thing: success means "not empty at 30 years", which hides lean years.
Traps: calling long datasets "too pessimistic" and trimming them.
Gaps for Someday: a UK history among the stress paths (1947 or 1972–74) would be more relevant to UK users than Japan 1990; ties to B14 (the 2008 path is too kind). New backlog B24.

### Royal London — 2026-11-15 — https://adviser.royallondon.com/funds/how-we-set-our-growth-rates/
Provider · documents only (calculator URL 404)
Engine: FCA capped 2/5/8% from a quarterly Long-term Economic Assumptions Forum; living-standards guide uses 5% growth, 2% inflation, 0.75% fee
Gaps for Someday: none; confirms the Balanced preset and that 0.75% is a common charge (B12).

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

### Standard Life retirement calculator — 2026-11-14 — https://www.standardlife.co.uk/retirement/tools/retirement-calculator/assumptions
Audience: Standard Life workplace and personal pension customers, 50+ · Access: free, no sign-up · Platform: web
Engine: growth **2% / 5% / 8%** (the FCA's standardised rates, not tied to funds) · inflation 2%, pot shown in today's money · charges 0.55% a year · contributions rise 3.5% a year and stop at the retirement age · tax: contributions assumed to include relief; the Annual Allowance applied; **income figures gross and "subject to income tax"**; lump sums at emergency tax · SP: full new State Pension assumed, no amount or age stated · TFC: 25%, capped at the £268,275 lump sum allowance; taken as a lump for drawdown · DB: none · annuity/drawdown: both; annuity rates "last updated 09/10/2026", good health, five-year guarantee; **drawdown income is a fixed amount with no increases for inflation** · sequence risk: none · MC: none · guardrails: none · couples: none · longevity: no life expectancy or horizon stated · care/housing/IHT: none · levers: growth button, retirement age.
UX: the assumptions page is the part examined (the calculator itself is JavaScript-only) · headline: gross annual income from drawdown or annuity · uncertainty: three growth rates · gating: none · copy: plain, repeated "can go down as well as up".
Best thing about it (specific): a dated annuity-rate basis (09/10/2026) and the FCA 2 / 5 / 8 rates, stated on a public page.
Worst thing about it (specific): a drawdown income that never rises with inflation is shown next to an inflation-adjusted pot, so the income looks sustainable for longer than it is in real terms.
Traps: gross income headline; flat drawdown income; no horizon.
Gaps for Someday: none in correctness or coverage. Someday states the plan age and, from this cycle, the odds behind it (B3). Someday's Balanced preset already uses the same FCA rates (B18).
Sources: https://www.standardlife.co.uk/retirement/tools/retirement-calculator/assumptions

### Vanguard UK pension calculator — 2026-11-14 — https://www.vanguardinvestor.co.uk/what-we-offer/personal-pension/pension-calculator
Audience: DIY investors saving into a SIPP · Access: free, no sign-up · Platform: web, live
Engine: growth Low 2% / Medium 5% / High 8% ("in line with FCA rules") · inflation fixed at 2%, applied to contributions when "Increase with inflation" is ticked · fees 0.15% account + 0.20% fund, deducted from the pot (the £4 a month account fee excluded) · tax: **"figures are before tax"; no income tax, no allowances** · SP: full State Pension from 67, £1,046 a month in the sample · TFC: 25% assumed taken, capped at £268,275, income reduced accordingly · DB: an "annual final salary pension" input · annuity/drawdown: **income = 4% a year of the remaining pot**, not named as drawdown · sequence risk: none · MC: none · guardrails: none · couples: none · longevity: none (a 4% rule stands in for a horizon) · care/housing/IHT: none · levers: pay more, retire later, lower the target.
UX: first answer in ~30 s (target, age, monthly contribution, savings) · live · uncertainty: three growth buttons, no probabilities · headline: estimated monthly income vs "You'll need £ per month", pot, tax-free cash, and a stacked breakdown (DB, personal pension, State Pension) · gating: none; "See where you stand" product CTA · copy: "a guide, not a guarantee".
Best thing about it (specific): the income breakdown by source against the target, with the State Pension and a DB pension stacked under the pot's income.
Worst thing about it (specific): a before-tax 4%-of-pot income compared against a target the user will have thought of as spending money; whether the figures are today's money is not stated.
Traps: 4% rule as the only decumulation model; before-tax income vs an after-tax need; today's-money status unclear.
Gaps for Someday: none. Someday's stacked income by source exists in Explore; the dial's "Guaranteed" face covers SP and DB.
Sources: https://www.vanguardinvestor.co.uk/what-we-offer/personal-pension/pension-calculator · https://www.vanguardinvestor.co.uk/need-help/answer/how-much-should-i-save-into-my-pension (the retirement-planning-calculator URL on the roster returns 404)

### Fidelity UK retirement calculator (powered by Wealth Wizards) — 2026-11-14 — https://www.fidelity.co.uk/retirement/calculators/retirement-calculator/
Audience: UK savers 40–60, couples welcome · Access: free, "anonymous and short quiz", no sign-up (Fidelity customers can log in to pull balances) · Platform: web
Engine: growth 5% a year, single rate · inflation 2% · charges 0.41% a year · contributions rise 1.5% a year · tax: **"a basic income tax calculation"; results net of income tax**, assuming no other income · SP: £12,547 a year from State Pension age; **twice that for a couple, starting at the same time** · TFC: **not modelled** ("no initial tax-free lump sum will be taken out"), the whole pot taxed as income · DB: excluded from savings input · annuity/drawdown: drawdown at 4% of savings at retirement each year, **to age 100** · sequence risk: none · MC: none · guardrails: none · couples: **yes** (both partners' contributions and two State Pensions) · longevity: fixed 100 · care/housing/IHT: none; standards assume mortgage- and rent-free · levers: change the retirement age and savings on the results page · target: **Retirement Living Standards (minimum / moderate / comfortable)** chosen after a lifestyle quiz (holidays, car, kitchen).
UX: first answer after a lifestyle quiz plus three inputs (~90 s) · not live until the results page · uncertainty: a single estimate ("only a guide") · headline: projected income vs the chosen living standard · gating: none; "What next?" points to Fidelity products · data: anonymous data shared with Fidelity by Wealth Wizards.
Best thing about it (specific): the only one of the nine examined so far that taxes retirement income and models a couple; the Living Standards quiz gets a first-time user to a target in a minute.
Worst thing about it (specific): a 4%-to-100 single line at 5% presents a sixty-year retirement with no uncertainty and ignores tax-free cash, so the tax figure is overstated and the sustainability figure is a rule of thumb.
Traps: 4% rule; no TFC; two State Pensions starting on the same date whatever the partners' ages.
Gaps for Someday: none in correctness. Fidelity reaches the Living Standards through a lifestyle quiz rather than three chips (low / medium / ux) → B22, parked: the chips were shipped 2026-11-13 and the owner has not yet reacted.
Sources: https://www.fidelity.co.uk/retirement/calculators/retirement-calculator/ (the myplan assumptions page on the roster returns 404)

## Scorecard

Updated every cycle. Standing: ahead · parity · behind · missing. Stop rule in
`PENSION_SCOUT.md` §7.

| # | Dimension | Best in market (planner) | Someday | Evidence |
|---|---|---|---|---|
| 1 | Honest headline | Someday | ahead, with a caveat | Was wrong for stops before pension age until B13 (2026-11-13): "lasts" ignored unpaid years. MoneyHelper (nominal fixed annuity, no tax), HL (no inflation), PensionBee (gross pot income vs after-tax standards) all examined 2026-11-13 |
| 2 | Uncertainty in the primary view | Wealthfront fan; Acme-style strands | ahead | grains + strands + floor; the three UK tools show one line |
| 3 | UK tax correctness | Fidelity (basic calc, net) / Timeline | ahead (unverified vs Timeline) | engine `taxFor`, Scotland, taper, LSA; of six UK consumer tools examined only Fidelity taxes retirement income, and only with a "basic" calculation |
| 4 | State Pension | PensionBee (12,547, 2026/27); Moneysmart (the plan with or without the public pension) | parity, ahead on testing it (2026-11-21: "A smaller State Pension" in "What could go wrong?", B32) | `spaFor`, 12,548 (12,547.60 rounded); MoneyHelper's record is a year stale |
| 5 | Defined benefit | Timeline / Voyant | parity (unverified) | `DB_SCHEMES` |
| 6 | Contributions and relief | MoneyHelper / HL | ahead on relief (2026-11-17: the extra relief a higher-rate payer can claim back is measured in pounds; Moneyfarm, AJ Bell and PensionBee only mention it) | The choice is now under the payment field with what goes in stated, and the home's counts line says "tax relief included" or "£X paid plus 25% basic-rate tax relief". Most UK tools treat the figure as relief-included (MoneyHelper, Standard Life) and none of AJ Bell, Vanguard, Fidelity shows relief in the figure. Higher-rate relief and salary sacrifice savings remain (B2) |
| 7 | Sequence risk, bad histories | Timeline / cFIREsim | ahead on coverage; the 2008 path is too kind (B14) | `STRESS_PATHS`; gfc floor only 3–6% under base |
| 8 | Dynamic spending rules | Income Lab / Timeline | parity | guardrails, levers; 2026-11-20: the safe ladder's rules are stated in pounds (B29); the funded ratio now values what is still to come (B30, fixed the same day, engine 2026.11.20) |
| 9 | Couples and survivor | MaxiFi / Boldin; Fidelity (two SPs, both contribute) | parity; UX thin | B1; Fidelity starts both State Pensions on one date, Someday uses each partner's age |
| 10 | Longevity | HL (ONS cohort by sex, chance of 100) / Rich Broke or Dead | parity, ahead in words (2026-11-18: "What could go wrong?" puts running short beside still being here, B27); B10 open | "Half live past 86 · 56% one of you at 90" under the plan-age needle, the long form under "Plan through to age" and in Assumptions; from the engine's Gompertz fit (`lifeOdds`). Unisex, so a single person gets the midpoint of the ONS male/female tables (B10) |
| 11 | Care, housing, IHT | Boldin / Voyant | missing | B4 |
| 12 | Levers, measured | Boldin | ahead | `levers`; MoneyHelper offers two unmeasured suggestions |
| 13 | Time to first answer, defaults | PensionBee (standards alongside the target) | ahead on the target and the growth default; discoverability addressed 2026-11-14 by the simple home (owner found the dial complex twice: 13 and 14 Nov) | The default home needs no instruction: one figure, three steppers. B5 (hallway test) now applies to the simple home |
| 20b | Visual design (owner's view) | — | reset 2026-11-13 (B16 shipped); awaiting the owner's reaction | white / slate / blue, bold sans figure |
| 14 | Liveness | Wealthfront Path | ahead | the ring; PensionBee is live too, MoneyHelper and HL are not |
| 15 | Accessibility | — | ahead (2026-11-14): axe-core WCAG 2.2 AA gate in CI, zero critical/serious on all four surfaces; decision map as a table | B8 shipped; the first run found zoom disabled, bezel contrast 3.4:1, ink-on-blue buttons 3.45:1, unfocusable scroll regions; all fixed; 2026-11-19: the futures year by year as a table (B28), so the home's picture has a full text equivalent |
| 16 | Mobile fit | — | parity | 375 × 667 fits |
| 17 | Trust signals | MoneyHelper (GOV.UK transparency record, GAD scenarios) | ahead (2026-11-16: charges placed among nine UK calculators and measured for the plan) | "How we checked" runs the engine's 134 checks live in the app with sources; `verify.mjs` differential and property evidence in CI; versions printed in the report; B6 (one tap from the dial) still open |
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
| Charges | Penfold breaks its 0.75% into parts; Nest adds 1.8% of contributions; range 0.3% (Nest) to 1% (HL) | 0.5% default, user-set, off every return; from 2026-11-16 Assumptions places it in that range and measures another 0.25% for the plan | Ahead (no other tool shows what its charge costs the income) |
| Couples | Rare; MaxiFi and Boldin do it | Two individuals, survivor phase | Ahead; survivor UX is thin |
| Dynamic spending rules | Timeline, Income Lab, Boldin | Guardrails and levers | At parity; no user-set rule yet |
| Spending rules stated as money | Income Lab: "If your portfolio drops to the lower guardrail, we reduce spending to $7,400" | Shipped 2026-11-20 for plans with the safe ladder: Details → Safe ladder says the money below which the rules trim, what spending becomes, the floor, and the money above which it rises, in today's money, from the engine's own ratio turned round | Parity for structured plans; plain plans have no rule to state |
| Care costs / housing | Boldin, Voyant | Not modelled | Gap (coverage) |
| Pension contributions and tax relief | MoneyHelper, Standard Life: "contributions include tax relief"; AJ Bell describes 20% relief but does not show it | Shipped 2026-11-15: the relief choice sits under the payment, the field says what goes in, the home's counts line says which | Parity; higher-rate relief to the person (not the pot) explained, not modelled |
| Longevity | HL: ONS cohort life expectancy by sex, chance of 100; Rich Broke or Dead; Fidelity and PensionBee fix 100; Standard Life and Vanguard state no horizon | Shipped 2026-11-14: the chosen plan age, with the median age and the chance of reaching it (one of a couple) beside the control, on the dial and in Assumptions | Parity (sex-specific single-person table still open, B10) |
| Running short against being here | Engaging Data: one chart of broke, money left and a "wedge of death" by age (history, one person) | Shipped 2026-11-18: in "What could go wrong?", the chance you are (one of you is) still here at the age the unluckiest 1 in 10 run short, and the futures in which the money runs short while you are still here (`successLifetime`), in words | Parity on the idea; ahead for couples and for tax; no chart of it |
| The futures as figures | Portfolio Visualizer reports user-chosen percentiles; FI Calc exports every simulation as CSV | Shipped 2026-11-19: Explore → Futures → "Show every year as a table": per year, of 100 futures how many pay in full, pay less but cover the essentials, or fall short, and money left at the 10th, 50th and 90th | Parity on figures; ahead on meaning (counts of futures against the plan and the essentials, after UK tax) |
| Decumulation model | Vanguard and Fidelity: 4% of the pot a year; Standard Life: flat drawdown or an annuity; MoneyHelper: fixed annuity | Year-by-year funding to the spend you set, tax-aware, with the money's end age | Ahead |
| Provenance | MoneyHelper: GOV.UK transparency record, 25 GAD scenarios | 126 load-time assertions, not surfaced | Gap (trust) |
| A smaller public pension, tested | Moneysmart: "Include the Age Pension? Yes / No"; TPAW: "Assume that your pension will be lower than expected" | Shipped 2026-11-21: "What could go wrong?" has "A smaller State Pension": each State Pension still to start a fifth lower (seven of the 35 qualifying years), the most the plan could then pay a month, and what cut would see it through | Ahead of every UK calculator examined (none tests it) |

## Backlog

| Id | Title | Class | Value | Cost | Evidence | Status |
|---|---|---|---|---|---|---|
| B1 | Show the survivor's income after a first death on the dial (not only in Explore) | coverage | medium | medium | Comparison: couples | open |
| B2 | Explicit tax relief on contributions (basic/higher rate, salary sacrifice) | correctness | medium | small | MoneyHelper, HL, PensionBee show relief; Moneyfarm and AJ Bell only mention higher-rate relief | part shipped 2026-11-15 (basic-rate choice under the payment) and 2026-11-17 (with a salary entered, the field names the extra relief a higher-rate or Scottish intermediate-and-above payer can claim back, from the engine's tax tables; `lib/relief.ts`; UAT 158c3b–c). Open: salary-sacrifice NI saving |
| B3 | Show cohort life expectancy and the chance of reaching the plan age beside "Plan to age" (engine `householdSurvival` already exists) | coverage | medium | small | HL drawdown calculator names ONS cohort life expectancy; Engaging Data | shipped 2026-11-14: `lifeOdds(P, age)` (median age, chance of reaching the plan age, chance one of a couple is here at the plan's end; 3 assertions, 126); dial sub line, Details hint, Assumptions "Longevity" row; UAT 138–141, e2e E47i–k, U75b |
| B4 | Care-cost scenario as a lever | coverage | medium | large | Boldin, Voyant | open |
| B5 | Hallway test the dial's bezel words (findability within 10 s) | ux-evidence | high | small | Research report §D | open |
| B6 | One-tap "assumptions and sources" from the dial (trust) | trust | medium | small | Scorecard 17 | open |
| B7 | Measure performance on a mid-range Android (engine call, MC latency) | performance | medium | small | Scorecard 18 | open |
| B8 | Run axe-core in the UAT and fix what it finds | accessibility | medium | small | Scorecard 15 | shipped 2026-11-14: UAT 100a–e gate (zero critical/serious, WCAG 2.2 AA tags) on Home, Details, Explore, Peace; six classes of defect found and fixed |
| B9 | Publish the engine's provenance: a "How we checked" page listing the load-time assertions and the hand-checked tax cases | trust | medium | small | MoneyHelper's GOV.UK transparency record (GAD scenarios) | shipped 2026-11-14: Peace → "How we checked these numbers" runs the 134 assertions live and lists every rule with its source; `docs/VALIDATION.md` is the dated record |
| B10 | Sex-specific ONS cohort mortality for single-person plans (keep unisex for couples) | correctness | low | medium | HL uses ONS 2020-based cohort tables by sex | open |
| B11 | Retirement Living Standards beside the target; fresh default corrected to the 2026 Moderate figure for two | coverage | medium | small | PensionBee; retirementlivingstandards.org.uk | shipped 2026-11-13 |
| B12 | Say in Assumptions that 0.5% is a low-cost all-in charge and that 0.7–1% is common | trust | low | small | MoneyHelper 0.75%, PensionBee 0.7%, HL 1%, Nest 0.3% + 1.8% of contributions, Penfold 0.75%, AJ Bell 0.6%, Standard Life 0.55%, Fidelity 0.41% | shipped 2026-11-16: a "Charges" row says where the plan's charge sits among nine UK calculators and what another 0.25% a year costs this plan a month (`lib/charges.ts`; UAT 69g recomputes it from the engine) |
| B13 | "Lasts" must mean every year paid: a pension locked until 57 never "exhausts", so the map, edge, guardrails, dial and report called fifteen unpaid years a plan that lasts | correctness | high | small | Owner, 2026-11-13: "the dashboard is nonsense"; reproduced with a 41-year-old stopping at 42 on £70k | shipped 2026-11-13 (`holds`, `runsShortAgeA`) |
| B14 | The "2008, the day you stop" path includes the 2009–2017 recovery (+86% real over ten years), so its floor sits only 3–6% under base in every plan shape; the dial showed it first and the sentence read as a boast ("Even after a 2008 start, £10,750 a month would hold") | correctness | medium | small | Owner, 2026-11-13 ("claptrap"); `STRESS_PATHS.gfc` analysis | shipped 2026-11-13: the dial rotates Japan-1990 → 30% fall then flat → 1970s; copy is "After X, the most that would hold is £Y" / "only £Y would hold". 2008 stays in the Explore stress tests |
| B15 | The ring is not self-evident: nothing says "tap a label, then turn the ring"; bezel labels read as captions | ux | high | small | Owner, 2026-11-13; B5 | shipped 2026-11-13: first-use hint until the first turn, pill behind every label, the active one in the action colour |
| B16 | Palette reads dated (cream, caramel, serif figure, dawn gradient); owner wants crisp and modern | polish | medium | small | Owner, 2026-11-13 | shipped 2026-11-13: white page, slate ink, blue action colour, bold sans figure, flat backdrop; graphite dark mode; map colours amber/red; PWA theme colours and SW cache bumped |
| B19 | The stop-age ring was capped at twenty years out (a 26-year-old could not look past 46) and the decision map covered the same nineteen years | correctness | high | small | Owner, 2026-11-13 | shipped 2026-11-13: ring to 75; map to age 75 in steps of up to three years, nearest-column lookup |
| B17 | CI takes ~10 minutes because the non-blocking legacy classic-planner E2E runs for 6 of them | performance | low | small | CI run 43399782976 step timings | open |
| B18 | Default growth 7% nominal (4.5% real after the 0.5% fee) sat near the FCA "higher" rate; MoneyHelper and PensionBee use 5%. A 26-year-old with £570k and £3,200 a month was shown £5m in today's money at 60, 100 of 100 futures and a Japan floor of £10,750 a month | correctness | high | small | Owner, 2026-11-13 ("utter nonsense"); FCA COBS 13 Annex 2 rates 2/5/8%; GOV.UK transparency record | shipped 2026-11-13: Balanced = FCA 2 / 5 / 8, Cautious 1.5 / 3.5 / 5.5, Adventurous 2.5 / 6 / 9; fresh plans apply the preset. The workbook fixture keeps 4 / 7 / 10 for parity tests |
| B21 | The ring could change a person's age. The owner (56) turned the ring with WHO selected and became 26; every "nonsense" report on 2026-11-13 (46 cap, £5m at 60, 100 of 100, £10,750 floor) was computed for a 26-year-old. The age was on screen in small print and nobody noticed | ux / correctness | high | small | Owner, 2026-11-14 | shipped 2026-11-14: ages are typed, never dialled (`typed` values ignore the ring, the ± and the flick; the keypad still works); "Born 1970 · tap the age to change it" under the figure |
| B24 | A UK history among the stress paths (June 1947 start, or 1972–74), from Timeline's UK data: worst UK 30-year start 2.97% on a 50/50 portfolio with a 1% fee | correctness | medium | medium | Timeline, 2026-11-15 | open; needs a sourced annual UK real-returns series |
| B23 | The same plan supports a figure up to 0.4% different in different browsers: the withdrawal allocator makes exact comparisons at band edges and `Math.pow` differs in its last bit between JavaScript engines | correctness | medium | medium | `e2e150.mjs` check J, 2026-11-14 (141 of 150 identical, largest 0.38%) | open |
| B22 | A lifestyle quiz (holidays, car, kitchen) as a way into the Living Standards target for people who cannot name a monthly figure | ux | low | medium | Fidelity / Wealth Wizards, 2026-11-14 | parked until the owner reacts to the chips shipped 2026-11-13 |
| B20 | The strands chart scaled to the single wildest future, so sixty years of compounding flattened the central path into the baseline, and nothing on it said what the height meant | polish | medium | small | Owner's screenshot, 2026-11-13 | shipped 2026-11-13: scale to the ninth decile of strand peaks; label the top of the chart and the pot on the day you stop, in today's money |
| B27 | Put the chance of still being here beside the chance of running short | coverage | medium | small | Engaging Data "Rich, Broke or Dead"; MaxiFi on bare success percentages | shipped 2026-11-18: `lib/stillHere.ts`, two sentences in the futures row of "What could go wrong?"; UAT 17b5b. Open: the same pair by age as a table in Explore |
| B28 | The futures year by year as a table: the numbers behind the home's picture, as text | accessibility / trust | medium | small | Portfolio Visualizer (percentile figures), FI Calc (CSV export); the Lantern brief's own "view as table" | shipped 2026-11-19: `components/FuturesTable.tsx` in Explore → Futures, built by the Lantern's adapter so the two cannot disagree; UAT 65d. Open: a link to it from the home's key sheet; a CSV export |
| B29 | The safe ladder's spending rules stated in pounds | trust | medium (structured plans) | small | Income Lab's guardrails as money; Flexible Retirement Planner's policies keyed to the real portfolio | shipped 2026-11-20: `lib/rulesInPounds.ts`, a paragraph under the rule fields in Details → Safe ladder; UAT 115b–c |
| B30 | The funded ratio counts only guaranteed income already in payment, so anyone who stops before State Pension age has a low ratio in the early years and the rules trim from the start, even where the State Pension will cover much of the spend later. Example (made-up couple, stop at 64, £40,000 a year, £661k): ratio 0.67 at 64, trigger £887k | correctness | high (every structured plan that stops before State Pension age) | medium (engine: value guaranteed income still to come, as cover does; ENGINE_VERSION, spec, parity) | Found 2026-11-20 while turning the ratio round for B29; Income Lab counts Social Security from its start date | shipped 2026-11-20 (owner: "Yes make changes"): engine 2026.11.20 values spending and guaranteed income still to come on both sides of the ratio; the made-up couple goes from 12 to 98 of 100 futures paid in full |
| B31 | Open a headline figure to see how it was calculated (the year, the tax, the draws) | trust | medium | medium | Pralana's "Metric MRI" | open |
| B32 | A smaller State Pension among the cases in "What could go wrong?" | coverage | high (the State Pension is the largest single income in most plans, and the default is the full rate) | small | Moneysmart's Age Pension switch; TPAW Planner; GOV.UK: 35 qualifying years for the full rate, about £6.89 a week for each | shipped 2026-11-21: `insights.withLowerStatePension`, a `spLow` rail, a row in `RiskPanel`; UAT 17b, 17b7, 153, 187 |
| B33 | Charges as lifetime pounds for this plan, beside the monthly figure | trust | medium | small | Guiide's drawdown charges comparison (£59,200 at 1% against £22,600) | open: `lib/charges.ts` already runs the plan at two charges; sum the difference in today's money over the plan |
| B34 | How often the plan ends with more than it started with (asking too little is a risk too) | coverage | medium | medium (a count from the simulation: an engine output, a version bump, an assertion) | FI Calc's "Large End Portfolio Value" beside its success rate; MaxiFi and TPAW on pass/fail | open |

## Cycles

| Date | Planners | Improvement | PR | Outcome |
|---|---|---|---|---|
| 2026-11-17 | Moneyfarm, Which?, Moneybox (Aviva 403; Moneybox help 404) | B2 (part): higher-rate relief in pounds. With relief at source and a salary entered, Details says how much more a year can be claimed back through Self Assessment (tax(S) − tax(S − G) − 20% of G on the engine's tables, so Scotland and the taper count) and that it goes to the person, not the pot. UAT 158c3b–c. Disjoint from the open #58 | scout/2026-11-17-higher-rate-relief | see PR |
| 2026-11-16 | Nest, Penfold, Smart Pension (Interactive Investor 404; Guiide and TPAW JavaScript-only) | B12: charges in context. Assumptions gains a "Charges" row placing the plan's charge among nine UK calculators (0.3% to 1%) and measuring what another 0.25% a year costs the plan a month. UAT 69g | scout/2026-11-16-charges-in-context | see PR |
| 2026-11-15 | AJ Bell, Timeline, Royal London (Aviva, Scottish Widows, Legal & General blocked) | Tax relief made explicit: the "paid from my bank account" choice moved out of a closed section to sit under the payment, the field says what goes in, the home's counts line says whether relief is included (B2, part) | scout/2026-11-15-tax-relief-explicit | see PR |
| — | — | Ledger seeded from the October 2026 UX research | — | — |
| 2026-11-13 | MoneyHelper, Hargreaves Lansdown, PensionBee | Retirement Living Standards (Pensions UK 2026) beside the target: engine constant + 3 assertions, chips on the Someday page, hint under the dial figure, Assumptions row; fresh default 43,100 → 45,400 | [#34](https://github.com/stumacmar/Retire-Lens-2/pull/34) (branch scout/2026-11-13-living-standards) | merged and live 2026-11-13 10:18 |
| 2026-11-13 (owner-driven) | — | CI runner pinned to Ubuntu 24.04 (GitHub moved `ubuntu-latest` to 26.04; Playwright could not install Chromium; nothing had deployed since 31 October) | [#35](https://github.com/stumacmar/Retire-Lens-2/pull/35) | merged; first green CI since 31 October; deploy restored |
| 2026-11-15 (owner-driven) | — | The canvas "looks bad"; three concepts mocked (orbit chosen, built, then "too complex": not merged, branch owner/2026-11-15-orbit). The owner commissioned an outside research report from a prompt written here and asked for it to be applied: built its recommendation, the closing ring, with ten lit windows as the detail, the answer sentence that names the amount, the renamed status, a dead zone, amber and slate, and a severity line. Open from the report: a three-second test with real 55- to 70-year-olds | owner/2026-11-15-closing-ring | see PR |
| 2026-11-15 (owner-driven) | — | "The sunset doesn't work. Think again… take inspiration from art." The sunrise was squashed on the owner's phone (Safari, ~690 px) and washed out on their structured plan. Replaced with the canvas after Richter's Strip paintings (100 stripes, same data), laid out to take whatever height the screen leaves. Lesson: judge a picture on the owner's real phone height and their real plan type, not at 390×844 on a plain plan | owner/2026-11-15-strip-painting | see PR |
| 2026-11-15 (owner-driven) | — | "Should we keep the dual view? Can the dial and the sunrise be combined?" Recommended one home; owner agreed. Dial and header switch removed; the dial's needle kept as a draggable meridian on the sunrise that reads any age. Tests that drove the dial now set plans up through Details | owner/2026-11-15-one-home | see PR |
| 2026-11-14 (owner-driven) | — | On the years strip: "no wow, it's dull". Lesson: accurate is not enough for the home screen; it has to carry the product's idea. Replaced the bar strip with the sunrise (100 lines over a horizon, one per future, same `perAgeHeld` data), placed above the answer, with the counts line moved below the two questions | owner/2026-11-14-sunrise | see PR |
| 2026-11-14 (owner-driven) | — | "Research the best UX: modern, crisp and truly unique visually without being a gimmick." Research read: frequency pictures (icon arrays, quantile dotplots) are read more accurately than percentages, pension visuals must explain themselves because the text beside them is only partly read, and a bare success percentage says nothing about when or how much. Shipped the years strip on the simple home (one bar a year, as tall as the futures still paying), a left-aligned answer and shorter copy. Not done: the same strip in Explore and the risk sheet, a redesign of Details and Explore | owner/2026-11-14-home-years-strip | see PR |
| 2026-11-14 (owner-driven) | — | "Still showing not yet funded: nonsensical and erroneous. Carry out 150 end to end tests." Status rule corrected (central case first; "paid in full" excludes trimmed years; plain labels), `e2e150.mjs` added as a CI gate (150 of 150), counts line and annuity label ([#46](https://github.com/stumacmar/Retire-Lens-2/pull/46)), chart scale label ([#47](https://github.com/stumacmar/Retire-Lens-2/pull/47)). New backlog B23: cross-browser drift of up to 0.38% in the supportable figure | owner/2026-11-14-status-coherent-e2e150 | see PR |
| 2026-11-14 (owner-driven) | — | "The UX is complex": a simple home is now the default (status in words, what the plan can support, gap, futures; three steppers; two questions). The dial stays one tap away. Also audit releases 2 and 3: map as a table and axe gate ([#43](https://github.com/stumacmar/Retire-Lens-2/pull/43)); status, "What could go wrong?" and a render-path fix ([#44](https://github.com/stumacmar/Retire-Lens-2/pull/44)) | owner/2026-11-14-simple-home | see PR |
| 2026-11-14 (owner-driven: the 10/10 audit) | — | Assurance layer from the independent audit: `ENGINE_VERSION`, `TAX_RULES` rule pack with sources, `verify.mjs` (golden, differential, property, metamorphic, stability, migration, cross-engine; 133 checks) as a CI gate, classic-engine success definition fixed (F-01), four-layer uncertainty copy and the bad 1-in-10 age (F-04), save status (F-06), `docs/MODEL_SPEC.md` + `docs/VALIDATION.md` (F-07), "How we checked" in Peace (closes B9), Plus switched off at the owner's request | audit/2026-11-14-prove-the-model; owner/2026-11-14-hide-plus [#41](https://github.com/stumacmar/Retire-Lens-2/pull/41) | see PR |
| 2026-11-14 | Standard Life, Vanguard UK, Fidelity UK (Nutmeg/J.P. Morgan and AJ Bell pages 404) | B3: the odds behind the age to plan for. `lifeOdds` in the engine (3 assertions, 126); "Half live past 86 · 56% one of you at 90" under the plan-age needle, the long form under "Plan through to age" and a Longevity row in Assumptions. UAT 138–141, e2e E47i–k, U75b | scout/2026-11-14-life-expectancy | see PR |
| 2026-11-14 (owner-driven) | — | B21: age is typed, never dialled. Root cause of the day's "nonsense": the ring had changed the owner's age from 56 to 26. UAT 132–137 | [#39](https://github.com/stumacmar/Retire-Lens-2/pull/39) (scout/2026-11-14-typed-age) | merged 2026-11-14; deployed |
| 2026-11-13 (owner-driven) | — | B18, B20: FCA projection rates as the Balanced preset and the fresh-plan default; strands chart scaled to the ninth decile with the top and the pot-at-stop labelled. 2 new assertions (123), e2e E47h | scout/2026-11-13-fca-rates | see PR |
| 2026-11-13 (owner-driven) | — | B15, B16, B19: stop-age ring to 75 and the map to age 75; crisp palette (white / slate / blue, graphite dark), bold sans figure, flat backdrop; ring hint and tappable bezel labels. UAT 124–131, e2e E47g | scout/2026-11-13-owner-fixes | see PR |
| 2026-11-13 (owner-driven) | — | B13: "holds" means every year paid. `drawdown` gains `runsShortYear/AgeA` and `holds`; insights (capacity, guardrails, decision map), the dial, the report, stress tests, levers, strategy and DB-timing comparisons all read it. 4 new assertions (121), UAT 121–123, e2e E47d–f | scout/2026-11-13-unfunded-years | see PR |
| 2026-11-15 (owner-driven) | — | The closing ring "doesn't cut the mustard - think in 3 dimensions": replaced by the road ahead (perspective road; lane share = futures paying in full; key line; full-bleed). UAT 31 and 158g rewritten | owner/2026-11-15-road | see PR |
| 2026-11-15 (owner-driven) | — | Ten windows "doesn't work", road "too crushed", asked for a tunnel showing life events: the time tunnel (frames, life-event signs from `lifeEvents`, travel), steppers side by side, sentence swatches as the key. UAT 31, 158j rewritten | owner/2026-11-15-tunnel | see PR |
| 2026-11-15 (owner-driven) | — | Tunnel "doesn't convey any knowledge": walls become the tranches (ladder/engine or pensions/ISAs), touch to open their performance under four markets (`lib/tranches.ts`, `TrancheSheet`). UAT 158g, 158k | owner/2026-11-15-tranches | see PR |
| 2026-11-17 (owner-driven) | — | Outside review (7/10) fixed: worked example no longer loads the workbook fixture (privacy), names scrubbed from the repository, headline labelled, −£0, tunnel key and labels, desktop hint, copy (sliders, never sell, futures counts, free, legal placeholders), charge and volatility warnings, stale build files. Backlog: B25 ask the approach after the numbers; B26 inflation that varies in the simulation (2022-style shock) | owner/2026-11-17-review-fixes | see PR |
| 2026-11-17 (owner-driven) | — | Asked for "something so totally new" after five pictures; three concepts mocked; the island chosen ("There's something to this do it"). New engine output `perAgeCover` (cover by age across futures) with zero-volatility parity (142 assertions); the island replaces the tunnel: land = what the money covers, sea = the ask (drag to change it), touch to read any age, tranche chips and life-event flags kept. Open: a three-second test with real 55- to 70-year-olds; WebGL only if the canvas proves too slow on older phones | owner/2026-11-17-island | see PR |
| 2026-11-17 (owner-driven) | — | "The safety ladder is too specific to me for a UX that I could sell": the approach question ("How should the money be run?") is gone from setup (closes B25 by removing it rather than moving it); every plan starts as one invested pot and the ladder is an optional switch in Details → Safe ladder, starting from the standard set-up. Variables named after real people renamed in the test files | owner/2026-11-17-ladder-optional | see PR |
| 2026-11-17 (owner-driven) | — | The owner's brief for a tenth picture, "The Lantern" (a glass tower of years, 20 windows a floor, turning the tower changes the lens). Stage 0 plan written (`docs/LANTERN_PLAN.md`: what the engine gives, what it lacks, eleven places the brief and the codebase disagree, including that lit windows were rejected on 15 November and that the brief bans the island shipped the same day). Stage 1 built from made-up figures at `?lantern=1`; the island stays the home until the owner has judged the look on a phone | owner/2026-11-17-lantern-stage1 | see PR |
| 2026-11-17 (owner-driven) | — | "Go for it - what do you think. Self analyse as you are better than I." Engine outputs for the Lantern shipped on their own ([#66](https://github.com/stumacmar/Retire-Lens-2/pull/66): `perAgePaid`, `perAgeWealth`, opt-in shock; 154 assertions). Stage 2: the tower wired to the plan on the device through a tested adapter. Self-review written into `docs/LANTERN_PLAN.md` §9 and acted on: the front face was a gold slab with one informative corner and windows too small to count, so the tapped floor now opens; decoration that carried nothing (ring column, floor lines, scaffolding, a core that muddied the faces) removed. Honest verdict recorded: strongest as a way to read one year at a time; rotation is a carousel of four flat charts, not a use of depth; still needs a real phone and real 55 to 70 year olds | owner/2026-11-17-lantern-stage2 | see PR |
| 2026-11-18 | FIRECalc, MaxiFi, Engaging Data "Rich, Broke or Dead" | B27: running short beside still being here. The futures row of "What could go wrong?" now says how likely you are (or one of you is) to be here at the age the unluckiest 1 in 10 run short, and in how many of 100 futures the money runs short while you are still here, from the engine's mortality curve and `successLifetime`. No engine change. UAT 17b5b. Disjoint from the open #58 and #59 | scout/2026-11-18-short-while-here | see PR |
| 2026-11-18 (owner-driven) | — | After trying the tower on a phone: "We need to move the candle to the main screen but we also need a key or other way to understand how it's constructed in each example." The Lantern is now the home's picture: the answer and a key for the showing face sit beside the tower, "How to read this" explains the construction and each face, the island is one tap away in Explore. First the owner could not reach the preview at all (an installed app has no address bar): fixed with a link in Explore ([#69](https://github.com/stumacmar/Retire-Lens-2/pull/69)). Lesson: a preview behind a URL parameter is not reachable from a Home Screen app | owner/2026-11-18-lantern-home | see PR |
| 2026-11-19 | Portfolio Visualizer, cFIREsim, FI Calc (TPAW JavaScript-only) | B28: the futures year by year as a table. Explore → Futures gains "Show every year as a table": for each year, of 100 simulated futures how many pay the plan in full, pay less but cover the essentials, or fall short, and the money left in the unluckiest 1 in 10, the middle and the luckiest 1 in 10. The same adapter as the tower. UAT 65d (counts exact; money within 2%, because a percentile can land on a neighbouring future between JavaScript engines) | scout/2026-11-19-futures-table | see PR |
| 2026-11-20 | Flexible Retirement Planner, Pralana, Income Lab | B29: the safe ladder's spending rules in pounds. Details → Safe ladder now says, on the plan's own figures, the money below which the rules trim, what spending becomes, the floor, the trigger ten years on and the money above which spending rises, in today's money: the engine's funded ratio turned round, nothing recalculated. UAT 115b–c put the stated trigger back through `fundedRatio`. Found on the way: B30, the ratio ignores State Pension not yet in payment | scout/2026-11-20-rules-in-pounds | see PR |
| 2026-11-20 (owner-driven) | — | "Yes make changes": B30 fixed in the engine (2026.11.20). The safe ladder's funded ratio now values the plan's own spending still to come against the money plus guaranteed income still to come, so a State Pension not yet in payment counts and a later step-down in spending counts. Twelve new hand-calculated assertions (166, then 168). Also: 300 end-to-end households including NHS pensions and couples of different ages, and three independent theory-based reviews of the Lantern's colours and complexity The 300 found one fault (299 of 300 on the first run): a safe-ladder plan showed fewer futures lasting with the rules than paid in full, because a year that paid the plan but not all of a raise was scored as short; fixed in the same engine version (a raise is a bonus) with two more assertions. The Lantern had three independent reviews (colour, simplification, a first-time reader): palette and tidy changes shipped, the larger simplifications are with the owner (`docs/LANTERN_PLAN.md` §10). | owner/2026-11-20-funded-ratio-ahead | see PR |
| 2026-11-21 | FI Calc, TPAW Planner, Moneysmart (Australia), Guiide, Canadian Retirement Income Calculator (six more not reachable) | B32: "A smaller State Pension" in "What could go wrong?". Every case there was a market; now, where a State Pension is still to start, one more row lowers it by a fifth (seven of the 35 qualifying years the full rate needs, or a change in the rules) and gives the most the plan could then pay a month and the cut that would see it through. No engine change. Also found: the built-in browser reads the JavaScript-only planners that plain fetches could not | #75 | open, for the owner |
