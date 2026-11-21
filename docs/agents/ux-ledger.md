# Pension Scout: the simplicity ledger

Memory between cycles under version 2 of `PENSION_SCOUT.md`. Read it first;
update it last. The format is in the manual, §8.

## The owner's words

Word for word, newest first. These outrank any score.

| Date | About | The owner said |
|---|---|---|
| 2026-11-21 | the whole app | "The UX is now too complex. Create or revise the agent to create a world class UX by reviewing the best in the market and then using AI development to paradym shift" |
| 2026-11-20 | the Lantern | "Do 1 through to 4" (one face on the home, two window states, one count, the count on the picture) |
| 2026-11-20 | the Lantern | "could the colours be better visually , could it be simplified ?" |
| 2026-11-18 | the Lantern | "We need to move the candle to the main screen but we also need a key or other way to understand how it's constructed in each example" |
| 2026-11-17 | the safe ladder in setup | "too specific to me for a UX that I could sell" |
| 2026-11-17 | the island (a concept mock) | "There's something to this do it" |
| 2026-11-17 | the time tunnel | "doesn't convey any knowledge" |
| 2026-11-17 | the road ahead | "too crushed" |
| 2026-11-15 | the ten lit windows | "doesn't work" |
| 2026-11-14 to 15 | the orbit of 100 seeds; the dial | "too complex" (the dial twice) |
| 2026-11-14 | a bar strip | dull |
| 2026-11-13 | the first dashboard | "the dashboard is nonsense"; "claptrap"; "utter nonsense" (figures computed for the wrong age, and a stress case that read as a boast) |
| standing | how to work | "do it and stop asking me for permissions multiple times - take it as given" |

What the pattern says. Eight pictures have been tried on the home since 13
November. The ones rejected fastest were made of many small marks or needed
explaining. The one kept longest (the Lantern) was kept on the condition that
it came with a key, was then simplified four ways in one day, and the verdict
the next day was still "too complex". The complaint is now about the whole
app, not the picture. Another picture is unlikely to be the answer.

## The budget

`cd horizon && npm run build && npm run ux:metrics` (example couple, 390 × 660).

| Date | Home: words | figures | controls | sizes | smallest | under 12 px | Would help: words | Go wrong: words | Details: words / controls | Explore: words / figures | Peace: words | All: words / controls |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| target | 60 | 5 | 7 | 4 | 13 px | 0 | — | 150 | — / 12 | 300 / 20 | — | 1,600 / 80 |
| 2026-11-21 (baseline) | 171 | 21 | 21 | 15 | 9.9 px | 71 | 91 | 305 | 909 / 86 | 1,419 / 219 | 184 | 3,250 / 156 |

Notes on the baseline: Details and Explore are measured as they open; the
pages inside Details are not yet counted (add them to `ux-metrics.mjs` in the
cycle that first works on Details). Reading grade: home 4.6, Details 12.1,
Explore 10.3, Peace 10.

## Inventory

### Home, first screen (21 November 2026): 21 controls, 171 words

Not yet judged: the first Subtract cycle gives each a rung (manual §3.1).

| Element | Question it answers | Controls | First thoughts |
|---|---|---|---|
| Status in words ("On track under these assumptions") | Can I? | 0 | The answer. Keep; it is 5 words and the most important thing here |
| "Your plan can pay £4,470" | How much could I have? | 0 | A second answer to a question the visitor did not ask. They asked "can I stop at 64 on £3,333" |
| "a month after tax · You ask for £3,333" | What did I ask for? | 0 | Needed only because the big figure is not the ask |
| "£1,137 to spare" | By how much? | 0 | Third figure about the same thing |
| The tower | When does it get risky? | 1 | Answers a second-layer question on the first screen |
| Age and count labels ("94 / 95 of 100", five of them) | How sure, each year? | 0 | 10 figures, 10 px |
| Key ("Pays in full", "Falls short") | What do the marks mean? | 0 | Manual §1: if it needs a key |
| Caption ("Each floor is a year. Each window…") | How do I read it? | 0 | Same |
| "How to read this" | How do I read it? | 1 | Same |
| "Sources, money left, stress" | What else is there? | 1 | A way out of the first screen before the answer has landed |
| Answer sentence ("In 96 of 100 futures, £3,333 a month lasts to 92…") | How sure? | 0 | The honest answer in words. Says what the status says, with the number |
| Resting line ("From 78, some futures fall short.") | When? | 0 | Second layer |
| Stop work at (− value +) | What if I stop earlier or later? | 3 | The one lever a first-time visitor reaches for |
| Take home a month (− value +) | What if I spend less or more? | 3 | The second |
| You pay in a month (− value +) | What if I save more? | 3 | Third; matters only while working |
| "15% less from 75", "25% less from 82" | What if I spend less later? | 2 | Settings on the first screen |
| "What would help?" | What can I do? | 1 | The third thing §1 says the screen must answer; today it is a tap away |
| "What could go wrong?" | What are the risks? | 1 | Second layer; fine as a tap |
| Counts line ("Counts Alex and Sam: £430k…") and its link | What did you count? | 1 | Trust; below the fold |
| Tab bar (Horizon, Details, Explore, Peace) | Where is everything? | 4 | Four places, two of whose names say nothing about what is in them |

## Benchmarks

None yet under version 2. (The market's pension calculators are in
`pension-scout-ledger.md`: about forty examined. What they have in common is one
line, before tax, and an adviser at the end. None is a model of a first
screen.)

## Patterns

To be filled from Benchmark cycles. Starting hypotheses, each to be tested,
not believed:

1. The first screen is one sentence and one control. Everything else is a tap.
2. Uncertainty is said the way a forecast says it, in words a person acts on,
   with the picture behind a tap.
3. The app decides more and asks less: defaults in place of settings.

## Concepts

None yet. The first Leap cycle is due within the first week.

## Cycles

| Date | Kind | What shipped | Pull request | The owner's reaction |
|---|---|---|---|---|
| 2026-11-21 | setup (owner-driven) | Version 2 of the manual; `horizon/ux-metrics.mjs` and the baseline above; this ledger with a first inventory of the home | see the pull request | — |

**Next:** a Subtract cycle on the home. Give every row of the inventory its
rung, run the panel on the home as it is (the baseline score), then ship the
largest subtraction that the panel does not score worse. Then a Benchmark
cycle (Apple Weather or the Met Office app, Google Maps, Monzo), then the
first Leap.
