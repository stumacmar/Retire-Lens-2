# Pension Scout: the simplicity ledger

Memory between cycles under version 2 of `PENSION_SCOUT.md`. Read it first;
update it last. The format is in the manual, §8.

## The owner's words

Word for word, newest first. These outrank any score.

| Date | About | The owner said |
|---|---|---|
| 2026-11-21 | the tower, on seeing the panel's finding that nobody can read it | "Yes the tower is not intuitive. You can remove it but only to replace with something better and non standard. Think of all the 3d spacial opportunities or 4D or button pressing to open more- don't know what I mean like visual levels of depth" |
| 2026-11-21 | the first draft of version 2 (subtract, subtract) | "Don't ruin the UX in warn something visually stunning and different but simplicity is importantly" (read as: don't ruin the UX; I want something visually stunning and different, but simplicity is important) |
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
app, and the same day the owner asked for "something visually stunning and
different". Read together: the picture is wanted, and wanted bolder. What is
not wanted is everything that has grown up around it to explain it. The
answer is a picture that needs no explaining, with almost nothing beside it.

## The budget

`cd horizon && npm run build && npm run ux:metrics` (example couple, 390 × 660).

| Date | Home: words | figures | controls | sizes | smallest | under 12 px | Would help: words | Go wrong: words | Details: words / controls | Explore: words / figures | Peace: words | All: words / controls |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| target | 60 | 5 | 7 | 4 | 13 px | 0 | — | 150 | — / 12 | 300 / 20 | — | 1,600 / 80 |
| 2026-11-21 (baseline) | 171 | 21 | 21 | 15 | 9.9 px | 71 | 91 | 305 | 909 / 86 | 1,419 / 219 | 184 | 3,250 / 156 |
| 2026-11-21 (after the first Subtract cycle) | 107 | 17 | 19 | 13 | 9.9 px | 16 | 91 | 305 | 909 / 86 | 1,419 / 219 | 184 | 3,122 / 152 |

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
| The tower | When does it get risky? | 1 | The hero, and it stays a hero. Today it answers a second-layer question (which years, which futures) and leaves the first-layer answer (can I?) to the words beside it. The aim: a picture whose overall look is the answer |
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

### Home: what the first cycle did (21 November 2026)

| Element | Rung | Done |
|---|---|---|
| Key ("Pays in full", "Falls short") | 1 remove | Gone |
| Caption ("Each floor is a year. Each window…") | 1 remove | Gone |
| "How to read this" and its sheet | 1 remove | Gone (`LanternKey.tsx` deleted) |
| "Sources, money left, stress" | 3 down a layer | Gone from the home; the full-screen view is reached from Explore |
| Age and count labels (five pairs, 10 px) | 3 down a layer | Two ages (first and last, 13 px); the count for a year is in the words when a floor is tapped |
| State Pension strips on the tower | 3 down a layer | Full-screen view only: without a key they read as glitches |
| "You ask for £X" in the answer | 2 merge | Gone from the Lantern's answer: it is on the stepper and in the sentence |
| Resting line ("From 78, some futures fall short…") | 3 down a layer | Gone from the first screen (it is in "What could go wrong?") |
| The tower | keep, and more of it | A third taller: it has the room the scaffolding took |
| Steppers, switches, questions, counts line, tabs | not yet judged | Next cycles (see the work list) |

### The panel on the home (21 November 2026)

The test plan: the example couple asking £4,333 a month. Truth from the
engine: the central case pays (£4,500 a month, £167 over the ask); 58 of 100
futures pay £4,333 every year to the end; in the unluckiest 1 in 10 the
money is short by 77. K is the home before this cycle, M after.

| | Q1 what is it telling you | Q2 can they stop, how sure | Q3 which number matters | One word |
|---|---|---|---|---|
| K (before) | 6 of 6 right | 6 of 6 right ("probably, not sure") | 2 right (58 of 100), 4 partly (the big figure, muddled with the ask) | Busy, Flash, Striking, Slick, Serious, Chatty |
| M (after) | 6 of 6 right | 6 of 6 right | 3 right, 3 partly | Smart, Slick, Smart, Slick, Pretty, Fiddly |

Design critics (each saw both, unlabelled; this cycle without the three
benchmark apps beside them, which the manual asks for: collect those
pictures in the first Benchmark cycle). K: 5 and 5 of 10. M: 7 and 6. Both
would be prouder of M ("the only one that looks like a designer said no to
things"). Neither calls M's top half generic; both call its bottom half
"stock form UI". M is better and is not yet stunning.

**The work list the panel wrote** (question 5, most raised first):

1. **The words contradict each other** (12 of 12 readers). "Enough in most
   futures, not all" and "£167 to spare" beside "58 of 100": "that's barely
   better than a coin toss, I don't call that most." The status word `thin`
   covers anything under 80 of 100, including under 50, where "most" is
   false. This is a wrong word, so it outranks the budget: fix
   `lib/status.ts` and the spec (§3.4) next cycle.
2. **Nobody can read the tower** (11 of 12, in both versions). "It's pretty,
   but I don't know what it is." "Ignore the building." In K the key and
   caption did not help: "went straight over my head." Removing them lost
   nothing; the picture still does not give the answer. This is the case for
   the first Leap: a picture whose overall look is the answer.
3. **Two figures for one thing** (10). "£4,500 … then £4,333: which is the
   real one?"
4. **"15% less from 75"** (10). "Less of what? They're already ticked and I
   didn't tick them."
5. **The tabs** (11). "Horizon" and "Peace" "mean nothing to me."
6. **"Futures"** (9). "I have only one future. Is it 100 people, or 100
   guesses?"
7. **Ages that disagree** (7). The tower runs to 94; the sentence says
   "lasts to 92" (one is the older partner's age at the end, the other the
   plan age).
8. **"You pay in a month"** (5). "Pay into what?"
9. **The counts line** is cut off by the tab bar (5, in M).
10. **Screen reader:** the first thing announced is a slider, "Years of your
    plan, 64", with no explanation; the figure is read in five pieces; there
    is one heading on the screen; the tabs do not say which is selected.
11. **Critics, the render:** dotted lines through the windows and uneven
    gutters; a white header strip that spends 70 px on a name; six text sizes
    in the answer; seven bordered objects under the picture in three styles.
    Both suggested one annotation on the tower tying it to the sentence.

## Benchmarks

None yet under version 2. (The market's pension calculators are in
`pension-scout-ledger.md`: about forty examined. What they have in common is one
line, before tax, and an adviser at the end. None is a model of a first
screen.)

## Patterns

To be filled from Benchmark cycles. Starting hypotheses, each to be tested,
not believed:

1. The first screen is one stunning picture that is itself the answer, one
   sentence and one control. Everything else is a tap.
2. Uncertainty is said the way a forecast says it, in words a person acts on,
   with the picture behind a tap.
3. The app decides more and asks less: defaults in place of settings.

## Concepts

None yet. The first Leap cycle is due within the first week.

## Cycles

| Date | Kind | What shipped | Pull request | The owner's reaction |
|---|---|---|---|---|
| 2026-11-21 | setup (owner-driven) | Version 2 of the manual; `horizon/ux-metrics.mjs` and the baseline above; this ledger with a first inventory of the home | #76, #77 | "Don't ruin the UX… visually stunning and different but simplicity is important"; then "Run it now" |
| 2026-11-21 | Subtract (home) | The picture without its scaffolding: key, caption, two buttons, the count labels, the State Pension strips, "You ask for" and the resting line are off the first screen; the tower is a third taller. Panel: no worse on any question; critics 7 and 6 against 5 and 5 | see the pull request | — |

**Standing instruction (owner, 21 November 2026):** do not ruin the UX. The
result must be visually stunning and different as well as simple. Subtract
the scaffolding, never the picture.

**Next:** (1) the wrong word: the status for a plan paid in the central case
but in fewer than half, or little more than half, of futures must not say
"most" (work list 1; `lib/status.ts`, spec §3.4, with the tests). (2) A
Subtract cycle on what is under the picture: one figure not two, the two
"less from" switches, "You pay in", the counts line, the tab names (work
list 3 to 9). (3) A Benchmark cycle that also collects the three reference
screens for the critics. (4) The first Leap, within the week: the panel says
the tower is liked and not understood.
