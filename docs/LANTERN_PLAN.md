# The Lantern: plan (Stage 0)

Written on 17 November 2026, before any Lantern code, from the owner's brief
("The Lantern": a four-sided glass tower of retirement years, 20 windows a
floor, rotation as the lens change). This file records what the engine gives
today, what it does not, and where the brief and the codebase disagree.

No figures from a real household appear here or in the prototype. The
prototype draws a made-up household; the real plan is read from the device at
run time, never from the repository.

## 1. Which engine

The live engine is `horizon/src/engine/engine.js` (`createEngine()`), not the
root `engine/` directory the brief names. Root `engine/` (`monteCarlo.js`,
`projections.js`, …) belongs to the classic planner at `app.html`. The Lantern
uses only the Horizon engine.

## 2. Engine functions the Lantern will call

| Call | Used for | Notes |
|---|---|---|
| `prepare(P)` / `drawdown(P)` | The central case, year by year (`rows[]`) | Face B (where the money comes from), structural elements, the readout |
| `runMonteCarlo(P, 2000, seed)` | The futures | Runs in the web worker (`lib/mc.worker.ts`), main-thread fallback |
| `drawdown(P, { returnPath })`, `STRESS_PATHS` | Deterministic stress | Central case only, not the futures |
| `lifeEvents` on the plan | Downsizing release, part-time work | Existing plan inputs |

**Paths:** 2,000 in the app (`runMonteCarlo(P, nPaths, seed)`; the worker
passes 2,000). **Seed:** `P.mcSeed`, default 42, Mulberry32; the same plan and
seed give the same result bit for bit, so the same inputs always draw the same
tower.

## 3. Output fields

Available today:

| Field | What it is |
|---|---|
| `drawdown(P).rows[]` | Per year, central case: `year`, `ageA`, `planTarget`, `spA`, `spB`, `dbA`, `dbB`, `annuity`, pots by wrapper (`potA`, `potB`, `isaA`, `isaB`, `cash`, `gia`), a structured plan's `ladder` and `engine` |
| `mc.perAgeHeld[]` | Per year: share of futures paid in full every year so far (`full`), and with the rules (`rules`). Cumulative, never rises |
| `mc.perAgeCover` | Per year: 21 quantiles of cover (the island) |
| `mc.finalP10/50/90`, `legacyP50Real` | Money left at the end only |
| `mc.worstYearRatioP10` | The leanest year in the worst 10 of 100 futures |

**Not available today, needed by the faces:**

| Face | Needs | Status |
|---|---|---|
| A "Will it pay?" | Per year, 20 quantiles across paths of income paid ÷ planned spend **that year** | Not reported. `perAgeHeld` is cumulative (paid every year so far), which is a different question |
| B "Sources" | Central case income by source | Partly: State Pensions, scheme pensions, annuity and earnings are in the rows; draws are tracked by wrapper (pension, ISA, cash), not by asset (shares, gold, money market) |
| C "What's left" | Per year, 10th, 50th and 90th percentile of total wealth across paths, today's money | Not reported per year (only at the end) |
| D "Stress" | Face A recomputed with a crash of a given size in a given year, across all paths | Not supported: stress paths are deterministic only |

## 4. The brief's variables against the engine

| # | Variable | Engine input | Supported? |
|---|---|---|---|
| 1 | Retirement date | `retireYear` | Yes, in whole years. The engine is annual: a one-month step is not representable |
| 2 | Planned spend | `targetNet` | Yes |
| 3 | First step-down (age, amount) | `phase1On`, `phase1Age`, `phase1Cut` | Yes. The cut is a share of the full spend, so an amount dial writes the share |
| 4 | Second step-down (age, amount) | `phase2On`, `phase2Age`, `phase2Cut` | Yes. The age is a plan setting (default 82) and can be set |
| 5 | Essential floor | None | Not an engine input. It can be a threshold in the adapter (how a window is coloured) without touching the maths. A structured plan's `floorMult` is a different thing: the limit on how far the rules may trim |
| 6 | Real return | `growth` (nominal), `inflation`, `fee` | Yes, by conversion in the adapter. The live default is the FCA base rate, 5% nominal with 2% inflation and a 0.5% charge, not the 4% real the brief quotes |
| 7 | Inflation | `inflation` | The fixed level is a plan input and is supported. Inflation that varies inside the simulation is not (backlog B26) |
| 8 | Mix (shares, gold, money market) | None for a plain plan | **Not in the engine yet.** A plain plan is one return and one volatility; `equityShare` only scales stress paths. A structured plan has `architecture.goldPct`. There is no money-market sleeve |
| 9 | State Pension start (each person) | `partnerA.spAge`, `partnerB.spAge` | Yes, as a whole age (60 to 75), not a date |
| 10 | Gilt ladder on/off, end date | `architecture.on`, `ladderYears` | On/off: yes. **End date: not in the engine yet.** The engine's ladder is a rolling number of years of spending that is topped up, so it has no end date. A bridge that runs out on a date needs an engine change, or the plinth is drawn from the ladder's real balance (`rows[].ladder`) |
| 11 | Downsizing release (amount, age) | `lifeEvents` (`kind: 'income'`, a year, today's money) | Yes |
| 12 | Part-time work (income, years) | `lifeEvents` (`kind: 'earned'`, one per year) | Yes; taxed as earnings |
| 13 | Sequence shock (size, year) | `drawdown(P, { returnPath })` | Central case only. **Across the futures: not in the engine yet** |

## 5. Engine changes needed (separate pull requests, each with tests)

None of these changes the maths of a path; the first two only report more of
what each path already computes. Each still bumps `ENGINE_VERSION`, adds a row
to `docs/VALIDATION.md`, and extends the zero-volatility parity check.

1. `perAgePaid`: per year, 20 quantiles of income paid ÷ planned spend (Face A).
2. `perAgeWealth`: per year, the 10th, 50th and 90th percentile of total wealth in today's money (Face C).
3. A shock option on `runMonteCarlo` (a forced return of a given size in a given year after stopping), for Face D and the "Crash in year 1" chip.
4. A fixed-term gilt bridge (variable 10), if the owner wants the plinth to end on a date.
5. A three-way asset mix for plain plans (variable 8).
6. Inflation that varies in the simulation (B26), if the inflation dial is to mean more than the fixed level.

**Landed (engine 2026.11.18):** 1 (`perAgePaid`), 2 (`perAgeWealth`) and 3 (the shock option), with zero-volatility parity and seven checks in `verify.mjs`. 4, 5 and 6 are open.

Until each of the others lands, its control is shown disabled, labelled "Not in the engine yet".

## 6. Where the brief and the codebase disagree

1. **The current hero is the island, not the tunnel.** The island (#63) went live on 17 November 2026, the same day as this brief; the brief bans "ocean or water". The island stays the home until Stage 5, when the Lantern replaces it behind a setting.
2. **Lit windows have been tried.** The "ten lit windows" picture was built and rejected by the owner on 15 November 2026 ("doesn't work"), and `CLAUDE.md` records the lesson that "anything made of many small marks reads as noise on a phone". The Lantern's front face is 720 windows, each about 8 px wide on a phone. Stage 1 exists to judge exactly this on a real iPhone before anything is wired up.
3. **Colour.** `CLAUDE.md` says "never red or green". The brief asks for a red ember edge on dark windows and green for part-time work. The prototype follows the brief (the ember is a thin edge, never the only signal). The owner decides which rule stands.
4. **A simple home.** `CLAUDE.md`: "Keep the home simple, and put anything new in Details, Explore or a sheet." The brief puts lenses, chips and dials on the home. Dials in a bottom sheet are consistent with the rule; the chip row is a Stage 3 decision.
5. **Typed ages.** `CLAUDE.md`: a person's age is a fact and is never put on a stepper, drag or ring. The brief's dials are plan choices (when to stop, when spending steps down), which is allowed; birth years stay typed.
6. **One label a floor.** Floors are about 11 px tall on a phone, so the prototype labels every fifth floor and the step-down floors. Every floor's ages are in the readout when it is tapped.
7. **Dark only.** The app has light and dark themes; the Lantern is dark navy in both.
8. **The median window.** With 20 windows the middle future falls between the 10th and 11th. The prototype rings the 10th (the more cautious of the two).
9. **A floor equal to the plan.** Where the planned spend has stepped down to the essential floor, "pays the floor but less than the plan" cannot happen, so those floors show only gold and dark windows.
10. **Dust and render on demand.** Drifting dust means something always moves. The prototype renders at full rate only while the tower moves, and ticks the dust about ten times a second when idle; reduced motion stops it.
11. **Privacy.** The brief's defaults are a real household's figures. The repository is public and holds none of them; the prototype's dummy household is made up, and defaults come from the plan on the device from Stage 2.

## 7. Structure

```
engine (unchanged)
  -> horizon/src/lantern/adapter.ts     pure functions, unit tested (Stage 2)
  -> horizon/src/lantern/model.ts       the view model (types)
  -> horizon/src/lantern/scene.ts       framework-free Three.js scene
  -> horizon/src/lantern/LanternCanvas.tsx   one React component that owns the scene
```

Three.js is installed with npm at a pinned version and bundled by Vite into
its own chunk, loaded only when the Lantern is opened. Nothing is fetched from
a third party.

## 8. Stages

| Stage | What | State |
|---|---|---|
| 0 | This plan | Done |
| 1 | The tower from dummy data at `?lantern=1` | Done (#65) |
| 2a | Engine outputs: `perAgePaid`, `perAgeWealth`, the shock option | Done (#66, engine 2026.11.18) |
| 2b | Adapter (`lantern/adapter.js`, tested by hand calculation) and wiring to the plan on the device, read only | Done |
| 5 (early) | The Lantern is the home's picture, with a key for each face and "How to read this"; the island is the switch-back in Explore and the fallback without WebGL (owner, 18 November 2026) | Done |
| 5 (simplified) | After three reviews: new colours; then one face on the home, two window states, ten windows a floor counted "of 100", and the count beside the ages (owner, 20 November 2026; §10) | Done |
| 5 (stripped) | The home's panel is the tower and the answer and nothing else: no key, caption, buttons, counts or State Pension strips; tested blind first (Scout, 21 November 2026; `docs/agents/ux-ledger.md`) | Done |
| 3 | Dials, chips, bottom sheet | Not started |
| 4 | The "now" band, Play, Flat view, table, reduced motion | Not started (reduced motion already cross-fades and stops the dust) |
| 5 | Polish, performance stepping, replace the home behind a setting | Not started |

## 9. Self-review after Stage 1 (17 November 2026)

The owner asked for an honest assessment rather than a verdict of their own.

**What worked.** It reads at once as a lit building, and the question it
poses ("how many lights are on at 85?") is about a life, not about money
moving through space. The stepped silhouette shows the spending taper with no
legend. The Sources face is the clearest of the four.

**What did not, and what was done about it.**

1. *The front face was a gold slab with one informative corner.* Most of the
   720 windows were identical, each 6 to 8 px wide: the "many small marks"
   problem that sank the ten windows and the orbit. Countable windows only
   help on a floor you can actually count. **Changed:** the tapped floor
   opens (3.4 floors tall, its neighbours 1.7 and 1.25), so its 20 windows
   are tall bars that can be counted and told apart by shape: full height,
   half height, dark with an ember foot. The other floors are texture that
   shows where the lights go out.
2. *The ring column carried nothing.* A ring on the same column of every
   floor is a stripe, not information. **Changed:** one outline, on the open
   floor.
3. *The essential-floor lines cut through the windows* and read as a glitch.
   **Removed;** the essentials are in the window states, the key and the
   readout.
4. *The State Pension core muddied every face.* A glass tower with charts on
   its faces cannot also be read through. **Changed:** strips of light up
   the corners, from the year each pension starts.
5. *The scaffolding for the working years* was four empty floors that shrank
   the tower. **Removed.**
6. *"Essentials only" was the wrong words* for a future paying 90% of the
   plan. **Changed** to "less than the plan but covers the essentials".

**What is still true and not fixed.**

* The third dimension is not doing analytical work. Each face is a flat
  chart; turning the tower is a carousel between four of them. That is the
  brief's own answer to "no unjustified 3D", and it is defensible, but the
  depth is atmosphere, not information.
* "What's left" and "Stress" are the weakest faces: thin bars, and outlines
  that are hard to see at phone size.
* With the essential floor at three quarters of the plan and the second
  step-down at a quarter off, the floor equals the plan from that age, so
  there a trimmed future reads as "falls short" with nothing in between.
* Frame rate, pinch and the glow have only been seen in a software renderer.
  They need a real iPhone.
* Whether a stranger aged 55 to 70 reads it in a few seconds is untested,
  as it was for every picture before it.

**Verdict.** Better than Stage 1 and honest to the engine. Its real strength
is reading one year at a time in countable units, which the island does not
do; the island is better at the whole shape at a glance. It has not yet
earned the home screen.

## 10. Three reviews (20 November 2026)

The owner asked for "theoretical feedback on the candle": could the colours be
better, and could it be simplified? Three reviewers were each given the
screenshots, the palette and what the picture encodes, and nothing else: one on
colour (CIEDE2000 differences, colour-blindness simulated with Machado 2009 and
cross-checked with Viénot 1999, contrast measured from the renders), one on
simplification, and one reading it as a 60-year-old who has never seen it.

What all three found:

1. **The picture looked safer than the words.** The unlit windows were the navy
   of the panel, so the part of the tower where the plan fails read as shadow,
   and the red foot that was meant to mark them was half a CSS pixel thick.
2. **Gold meant four things**: paid in full, a cautious status, the selected
   button, and (as an outline) a light the stress put out.
3. **The middle state was not in the middle.** "Less, essentials covered" was
   drawn as bright as gold (and brighter in the key), with only hue and one
   pixel of height to tell them apart.
4. **Two sources could not be told apart by red-green colour-blind readers**
   (pensions cyan and the partner's lilac: a difference of 0.5 where 10 is the
   least that works for small marks); three more pairs were under 7.
5. **The glow cost most of the contrast** (gold against the gaps: 9.9 to 1 on
   paper, 2.9 to 1 on screen), and the dust shared the data's blue-grey.
6. Text contrast was already good (8 to 1 or better everywhere).

Changed the same day (the palette is in `scene.ts` and `words.tsx`):

| Was | Now |
|---|---|
| Unlit window: panel navy with a red foot | A slate pane, a clear step lighter than the gaps; no red |
| Essentials only: pale blue-white, as bright as gold | Mid blue, between gold and slate in lightness |
| Gold status line, gold selected button, gold stress outline | White status beside its dot, pale blue button, white outline |
| "To spare" in gold whatever the status | Gold only when the status is on track |
| Seven sources at one lightness | Spread in lightness as well as hue; worst pair 17 for red-green, 14 for blue-yellow |
| Money left: cyan bar on a blue band | A paler bar on a deeper band (4.2 to 1, was 2.9) |
| Dust, bloom 0.38 | No dust, bloom 0.22 with a higher threshold; glass edges at half the strength |
| The caption did not say the tower can be tapped | "Tap one to read it." |

Then the four simplifications, the same day (owner: "Do 1 through to 4"):

1. **One face on the home.** The home shows "Will it pay?" only: no lens
   buttons, a key of two marks, and the tower does not turn there. Sources,
   What's left and Stress are in the full-screen view, one tap away
   ("Sources, money left, stress" in the panel's foot).
2. **Two states, not three.** A window is lit (that year's plan paid in full,
   99% or more) or unlit. The "essentials" tier, three quarters of the plan,
   a line nobody chose, is gone from the picture, the words and the table.
3. **One count.** Ten windows a floor, each 10 of every 100 futures; the
   engine's 20 levels are drawn two to a window, so a window can be half lit
   (5). The reading says "70 of 100 futures pay your full £3,250 a month",
   the same count and the same unit as the answer above the tower.
4. **The count on the picture.** Beside the floors, in one column: the age,
   and under it "75 of 100", for the first and last year, the years spending
   steps and the fifth birthdays, as many as fit without touching. A couple's
   second age moved into the reading ("At 88 (2056; your partner is 86)").

Still open: Stress could move into "What could go wrong?"; text on the panel
is 10 to 12 px in places (the count labels are 10 px); nothing here has been
tested on people.

What the reviews could not judge: the new palette on a real phone outdoors,
ageing eyes (a yellowing lens weakens blue against violet, which is one more
reason the palette now separates by lightness), and whether five people who
have never seen it read the right answer. The reviewer's five questions for
that test: what is this a picture of; is this plan fine or not; where is the
risk; what does one window mean; what would you tap.

## 11. Off the home (21 November 2026)

Blind tests on 21 November (twelve readers, with and without the key) found
that one reader could say what the tower meant. The owner: "Yes the tower is
not intuitive. You can remove it but only to replace with something better
and non standard." Three replacements were built and tested the same day and
the owner chose the moon ("Moon - do it"); it is the home from that date
(`horizon/src/moon/`, `CLAUDE.md`). The Lantern stays as the full-screen
view of the years at `?lantern=1`, reached from Explore, with all four faces
and their keys, and its adapter still feeds "Show every year as a table".
`LanternHome.tsx` was deleted. Stages 3 and 4 above are not planned.
