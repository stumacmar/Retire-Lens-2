# Isaac and Someday: a gap audit

**Written 28 November 2026. Step 1 of the owner's brief. No code was changed.**

Isaac (isaacmoney.com, Budgetwise Ltd, App Store id 6759624582) is a direct
competitor: a UK retirement planner for a phone. This document sets what Isaac
does beside what Someday does, and picks the few changes worth making.

Someday should not copy Isaac. It wins on three things, and every change below
is judged against them:

1. **It is private.** No account, no network request, no tracking.
2. **It is simple.** The owner's standing instruction, and the `ux:metrics` budget.
3. **It is honest about money.** Everything is shown in today's money.

## Where the facts about Isaac come from

- **The owner's notes and screenshots** (version 6.5.3, Premium trial, 28 November 2026).
- **Isaac's own public pages**, read on 28 November 2026: isaacmoney.com, its
  privacy policy (dated 4 November 2026) and its App Store listing (version
  6.13.5). Nothing below comes from using the app.

Three of the owner's notes differ from what the public pages say today:

| The note | What the public pages say |
|---|---|
| Year-by-year and compare plans are Premium | The website lists "Year-by-year detail" and "What if & plan comparison" as free |
| The stress test covers "every real retirement since 1871" | That is the separate historical backtest ("replayed from every retirement year since 1871"). The stress test is "1,000 market paths". No page says which country's history it is |
| Isaac tells Meta when the app is installed, opened or a trial starts | The privacy policy says the Meta SDK runs only if the person agrees to Apple's tracking prompt, and "never receives your financial planning data". The App Store privacy label lists identifiers and usage data "used to track you", and name, email and financial information "linked to you" |

The pages also name these outside services: RevenueCat, Apple, Google, Stripe,
Umami, Expo, Cloudflare Turnstile and Meta. Someday uses none.

## Someday today

Measured on `main` after pull requests #88 and #89 (`npm run ux:metrics`,
example couple, 390 × 660):

| Screen | Words | Figures | Controls |
|---|---|---|---|
| Home | 65 | 13 | 12 |
| What would help? | 44 | 6 | 4 |
| What could go wrong? | 126 | 19 | 1 |
| Details, as it opens | 449 | 19 | 61 |
| Explore | 858 | 82 | 15 |
| Workings | 186 | 3 | 6 |
| All | 1,793 | | 111 |

The targets are 1,600 words and 80 controls. Every proposal below says what it
would cost against them.

## The table

"Cost" means words or controls added to a screen a person meets. "A layer down"
means inside Details → More, or inside a sheet, never the home.

### Price and what is free

| Isaac | Someday | Where | Better, same or worse | Cost to add or improve |
|---|---|---|---|---|
| Free tier, or Premium at £7.99 a month or £79.99 a year. A 3-day trial, no card | **Has, differently.** Everything is free. A paid tier (Plus, £49 a year or £129 once) exists in the code and is switched off | `horizon/src/config/product.ts` (`plusOffered: false`), `components/Plus.tsx`, `lib/entitlement.ts` | Better for the person. Nothing is for sale, so nothing nags | None |
| The Premium offer appears straight after the first result | **Not done, on purpose** | | Better. The first answer is not a sales page | None. Do not add |
| Unlimited plans | **Partial.** One plan on a device. A plan can be saved to a file and loaded back | `lib/usePlan.ts` (one stored plan), Details → More → Plan file | Worse | A plan switcher is at least three controls and a new idea to learn. Not worth it yet |
| Projection chart (optimistic, base, cautious) | **Has** | `components/ChartHome.tsx`, Explore → Futures in `App.tsx` | Better. It charts monthly income in today's money, with the bad case drawn. Isaac charts the pot | None |
| "What would it take?" for retirement age, spending and saving | **Partial.** "What would help?" ranks actions by how many more times in 100 the money lasts. The map in Explore gives the most you can spend for each stop year. Nothing states the earliest age, or the saving needed, as one figure | `HelpPanel` in `components/SimpleHome.tsx`, `levers` in the engine, `capacity` and `decisionMap` in `lib/insights.ts` | Worse on the direct question, better on honesty (each action is run through 2,000 futures) | None if solved answers replace rows already in the sheet |
| Excel export | **Missing** in the live app. The year-by-year table is on screen and in the report | `YearTable` in `App.tsx`, `components/PrintReport.tsx` | Worse | One button a layer down (a CSV file needs no library and no network) |
| PDF report | **Has.** The report prints or saves as a PDF | `components/PrintReport.tsx`, Workings | Same | None |
| Monte Carlo stress test, 1,000 paths | **Has.** 2,000 paths, seeded, so the same plan always gives the same answer | `runMonteCarlo` in the engine, `lib/mc.worker.ts` | Better | None |
| Historical backtest from every retirement year since 1871 | **Partial.** Three named histories are replayed from the day you stop: 2008, a Japan-style two lost decades, 1970s stagflation. There is no run through every start year | `STRESS_PATHS` and `stressTests` in the engine, `components/RiskPanel.tsx`, Explore → Stress | Worse on coverage. Better on naming: each history says what it is | No screen cost if it becomes one row in "What could go wrong?". The cost is finding UK data that may be used |

### Premium features

| Isaac | Someday | Where | Better, same or worse | Cost to add or improve |
|---|---|---|---|---|
| Cash flow view | **Partial.** A bar of where income comes from, and the year-by-year table | Explore in `App.tsx`, the full-screen years at `?lantern=1` | Worse | Would add a chart to Explore, which is already 558 words over its target. Not now |
| Year-by-year | **Has** | Explore → "Each year: what you start with, take out and have left", the report | Same | None |
| Compare plans | **Partial.** One plan, compared with itself: withdrawal orders, scheme pension start ages, the safe ladder on or off, and "press one to try it" | `compareStrategies`, `compareDbTiming`, `compareArchitecture` in the engine | Worse for two saved plans. Better for one decision at a time | A second plan costs controls and a new idea. Not now |
| "Which pot first?" | **Has.** Three orders with the lifetime tax of each | Explore → Withdrawal order, Details → More → Drawing | Same | None |
| Inheritance tax | **Partial, with a fault.** The sums are there: the nil-rate band, the residence band and its taper, pensions in scope from April 2027. But **the live app has no field for the value of the home**, so every plan made in the app leaves the home out | `estate` in the engine, Explore in `App.tsx` | Worse until the home can be entered | One money field a layer down |
| Business owner tools | **Missing** | | Worse for that customer | A new subject. Out of scope |
| Couple linking | **Missing, on purpose.** A couple plans on one device, or passes the plan file | | Different. Linking needs accounts and a server | Would break "no account". Do not add |

### The stress test in detail

| Isaac | Someday | Where | Better, same or worse | Cost to add or improve |
|---|---|---|---|---|
| The chance the money lasts at each age | **Has** | "The years ahead" in `components/ChartHome.tsx` | Same | None |
| The chance either partner is still alive, beside it, from UK life expectancy | **Partial.** The engine works it out (`lifeOdds`, `householdSurvival`, fitted to the ONS 2020 to 2022 life tables). It appears as a hint under "Plan through to age" and as one sentence in Explore that no panel reader has understood | `lib/longevity.ts`, `components/PlanForm.tsx`, `components/Assumptions.tsx`, Explore | Worse: the two are never side by side | One column in a sheet. Nothing on the home |
| Worst 1 in 10, middle, best 1 in 10, steady growth | **Has** | The home (the worst 10 times in 100, or the middle case), Explore → Futures | Better on units: Someday's are all pounds a month, or all pounds left. Isaac mixes ages and pounds | None |

### Couples

| Isaac | Someday | Where | Better, same or worse | Cost to add or improve |
|---|---|---|---|---|
| Each partner taxed separately, both allowances, both lots of tax-free cash, each pound drawn from whoever pays less tax | **Has** | `fundYear` in the engine, `docs/MODEL_SPEC.md` §4 to §6 | Same | None |
| One partner dying first, with the survivor's spending set separately | **Has** | "Survivor spends" in Details → Who, the planned age in each person's guaranteed income page, `deathAge` and `survivorSpend` in the engine | Same | None |

### Property

| Isaac | Someday | Where | Better, same or worse | Cost to add or improve |
|---|---|---|---|---|
| The home, and the residence nil-rate band | **Partial.** In the model, with no field to enter it (see inheritance tax above) | `house`, `houseGrowth`, `estate` in the engine | Worse | One field a layer down |
| Downsizing | **Partial.** A windfall in a chosen year (Details → More → Life events). With the safe ladder on, a share of the house can be released once, late, if the plan is off track | `lifeEvents`, the "parachute" in `components/Architecture.tsx` | Worse: nothing is called downsizing | A named row in Life events, a layer down |
| Equity release | **Missing** | | Worse | Two or three fields a layer down, and a new calculation with tests |
| Buy-to-let rent as income | **Missing.** Guaranteed income is taxed as pension, and a life event lasts one year | | Worse | Two fields a layer down, and tax treatment to get right |
| Mortgage, joint ownership shares | **Missing** | | Worse | Several fields. Not now |

### Other

| Isaac | Someday | Where | Better, same or worse | Cost to add or improve |
|---|---|---|---|---|
| Guided tours on each screen | **Missing, on purpose** | | Better without. A screen that needs a tour is the wrong screen (CLAUDE.md, the simplicity rules) | Do not add |
| "Make your plan accurate" checklist, including the Pension Tracing Service | **Partial.** One line asks people to check their State Pension forecast at gov.uk | `components/PlanForm.tsx`, `components/Dates.tsx` | Worse | A line or two. Words on a screen that is over budget. Not now |
| Home screen widget | **Missing.** The app installs from the browser | `horizon/public/manifest.webmanifest` | Worse | A web app cannot offer one. Not possible today |
| Defined benefit commutation | **Has**, for the public-sector schemes, within the HMRC limit | `components/SchemePensions.tsx`, `DB_SCHEMES` in the engine | Same or better (the NHS, Teachers', LGPS, Civil Service and uniformed schemes are built in) | None |
| National Insurance checker | **Partial.** "What could go wrong?" tests a State Pension a fifth lower (seven of the 35 years short). There is no count of years | `withLowerStatePension` in `lib/insights.ts`, `components/RiskPanel.tsx` | Worse | One field (years on your record) could replace typing the amount. A layer down |
| Gilt and bond ladder | **Has.** The safe ladder, with written spending rules | `components/Architecture.tsx`, `docs/MODEL_SPEC.md` §11 | Same or better (the rules are shown in pounds on the plan's own figures) | None |
| The April 2028 rise in the minimum pension age | **Has** | `nmpaFor` in the engine, Explore → Dates | Same | None |

### Isaac's flaws, checked against Someday

| Isaac's flaw | Does Someday have it? |
|---|---|
| The stress test mixes units (three tiles are ages, one is pounds) | **No.** The home's two lines are both pounds a month. Explore's three tiles are all pounds left |
| The dashboard says "£0 at 92" and the stress test says "lasts to 93" | **Yes, in another form.** For a couple of different ages the home says the money lasts "until you are 94" (the older partner's age when the plan ends) and Explore says "Wealth left at 92", "Money lasts 92+" and "left at 92" (the age typed in Details). Both are right and they read as two answers |
| The same result as different numbers | **Yes.** The home says 96 times in 100. Explore says "about 95% hold" and "about 97%" (weighted by how long people live). Three figures for one question |
| Income shown in future pounds by default | **No.** Today's money everywhere, and the report says so |
| The source of the historical data is not named | **No.** Each history is named. Workings lists every rule with its source and date |

## The changes worth making

In order of value for the least added complexity.

**1. Say it is private on the home, in one line.**
Twelve of twelve blind readers this week said "maybe" to putting their own
figures in, "for want of knowing who made it and where the figures go". The
line exists in setup and in Workings, not where the doubt arises. It is also
the one thing Isaac cannot say. Cost: about eight words on the home, which is
at 65 against a target of 60. That needs the owner's say-so, and a blind read
of whether "maybe" moves.

**2. One age and one count for the same result, everywhere.**
This is Isaac's worst flaw and Someday shares it. Explore should give the same
age as the home, and one count, not three. Cost: none. It removes figures. It
then needs a test that fails if two screens ever disagree (the brief's item 7).

**3. A field for the home, a layer down.**
Without it the inheritance tax figure is wrong for every homeowner who made
their plan in the app, and nothing about property can be built. Cost: one
field in Details → More. This is a fault to fix more than a feature to add.

**4. Life expectancy beside the money, in "The years ahead".**
Isaac's best idea. A plan that "fails at 93" matters less if few people reach
93, and more if most do. The engine already has the figure. Cost: one column in
a sheet, nothing on the home. It should replace the sentence in Explore that
nobody understands, so the app's word count goes down. It must be read blind
first: a chance of dying is easy to misread.

**5. Answer the three direct questions inside "What would help?".**
The earliest age you can stop, the most you can spend, the saving needed. The
engine can already solve the first two. Cost: none if the solved answers
replace the fixed steps the sheet shows now ("Stop work at 65", "+1").

### Worth doing, with a condition

- **A UK historical backtest.** Valuable, and Isaac does not say whose history
  it uses. The condition is data: UK share, gilt and inflation series whose
  licence allows a public app. If there is none, the honest course is to say
  so and stop. No screen cost if it is one row in "What could go wrong?".
- **Equity release and rent.** Both need item 3 first.
- **A file of the year-by-year figures.** One button a layer down.

### Not worth doing

- **Accounts, couple linking, cloud sync.** They would end "no account".
- **Tours and checklists.** They add words to explain screens. The rule here is
  to fix the screen.
- **Several saved plans, a cash flow chart, business owner tools, mortgages.**
  Each costs controls or a new subject, for a product that is still 193 words
  and 31 controls over its own budget.
- **A paywall after the first result.** Someday's first answer is the product.

## The owner on Isaac's interface

"The one thing about Isaac is that it's UX isn't intuitive - ensure ours is
world class as part of our agents ongoing work" (28 November 2026). This is now
in the daily agent's manual (`docs/agents/PENSION_SCOUT.md`) and its ledger.
