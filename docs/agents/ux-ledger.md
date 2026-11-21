# Pension Scout: the simplicity ledger

Memory between cycles under version 2 of `PENSION_SCOUT.md`. Read it first;
update it last. The format is in the manual, §8.

## The owner's words

Word for word, newest first. These outrank any score.

| Date | About | The owner said |
|---|---|---|
| 2026-11-21 | the moon home, live | "The moon isn't sensitive enough." |
| 2026-11-21 | the three concepts built in the lab, the moon recommended | "Moon - do it" (said twice) |
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
| 2026-11-21 (the moon is the home) | 36 | 5 | 12 | 4 | 13 px | 0 | 91 | 305 | 909 / 86 | 1,424 / 219 | 184 | 2,985 / 138 |
| 2026-11-21 (what the readers still asked) | 38 | 5 | 12 | 4 | 13 px | 0 | 91 | 305 | 909 / 86 | 1,424 / 219 | 186 | 2,991 / 138 |

The moon home meets the home's targets for words, figures, sizes and smallest
text. Controls are 12 against 7: four tabs, four stepper buttons, the typed
figure, "The years ahead" and the two questions. (The tab labels went from
9.9 to 13 px on every screen, which is where the app-wide "smallest" will
move as each screen is worked on.)

The second row of the evening went up by two words on the home ("until you
are 94" for "to 94") and four elsewhere (two of them the Workings sheet's title): every reader had
asked whose 94 it was. It is recorded as an exception to "numbers only go
down", inside the home's target of 60.

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

### The moon as the home (21 November 2026)

The owner chose the moon ("Moon - do it") and it replaced the Lantern on the
home the same day. The same test plan as above: the example couple asking
£4,333 a month. Truth from the engine: the money lasts to 94 in 57 of 100
futures; stopping two years later, 76.

**Readers** (six fresh agents, one screenshot at 390 × 660 each, the
screen-reader persona given the accessibility tree; then the screen after two
presses of "+" beside "Stop work at", then the years):

| | Q1 what is it telling you | Q2 can they stop, how sure | Q3 which number matters | One word |
|---|---|---|---|---|
| The stripped tower (before) | 6 of 6 right | 6 of 6 right | 3 right, 3 partly | Smart, Slick, Smart, Slick, Pretty, Fiddly |
| The moon home | 6 of 6 right | 6 of 6 right ("a coin toss"; "I wouldn't hand my notice in on that") | 6 of 6 right (the 57, and what it counts) | Calming, Slick, Calm, Slick, Sparse (screen reader), Beautiful |

Could they say what the picture means? The tower: 1 of 12. The moon: 5 of 5
sighted readers guessed right from the first screen and were sure after one
press ("I watched it fill up as the number rose: fuller moon, better
chances"). All five called the years view the most useful thing they had
seen ("the trouble comes late, not early"). None had seen anything like it
for money ("a weather app, or the moon phase on a calendar"; "nothing like
the pension statements I get, which are forty pages of nothing").

What the readers found, and what was done the same day:

| Found | By | Done |
|---|---|---|
| The moon at the end of the row "marked 57 looks less than half lit" | the engineer | True: a wide lens showed an off-centre moon from its dark side. The lens is now long (6°), so every moon is lit as its count |
| Pressing an age left a hole in the row: "I thought something had gone wrong" | 5 of 5 | The row stays whole; a large moon lifts out of the age, above it |
| The row sat on an arc: "does the height mean anything?" | 3 of 5 | Level |
| "Lasts", "still paying", "paying in full": "are those the same test?" | the engineer | One phrase at every level: "the money lasts" |
| "Press a year": "they are ages, not years" | 2 | "Press one" |
| Screen reader: "64" was a bare number between two buttons; the years were a picture only | 1 | Each stepper is a named group ("Stop work at: 64"); the years are also a list |

**Done the same evening** (owner: "Continue"): items 1 to 4 below. The year
view now says what the unluckiest 10 of 100 are paid at that age; the tabs
are Home, Details, Explore and Workings; "Take home a month" is "Live on each
month"; the sentence says "until you are 94". The moon was retuned on the
critics' round 3 (a cooler pearl surface, a clean edge to the shadow, a wider
and softer glow, larger where the screen is tall), and measured: its lit
share is within one point of the count at 8, 23, 40, 57, 72 and 100. Not yet
tested blind: the next panel reads these.

**Still open, in the readers' order** (the next cycles' work list):

1. **What happens the other 43 times?** (6 of 6.) "Broke at 93 and broke at 78
   are very different problems." "Does it pay a bit less, or nothing?" The
   year view should say what the unlucky futures pay at that age, and the
   first screen's way to it ("What could go wrong?") should answer exactly
   this.
2. **The tabs** (6 of 6, again). "Horizon" and "Peace" "mean nothing to me";
   "Peace? Sounds like they're selling funeral plans."
3. **"Take home a month"**: now, or in retirement? After tax? (6 of 6.)
4. **Why 94, and whose?** (6 of 6.) It is a couple and the screen never says so.
5. **"Times in 100" of what?** (5 of 6 asked, all 6 understood it.) "I live
   only one time."
6. **What is counted** (the builder, the engineer, the screen reader): "I'm
   asked to trust a 57 with nothing behind it." The assumptions are in Peace;
   nothing on the first screen says so.
7. The small numbers under the ages are unlabelled (4).

**Critics** (two fresh pairs per round, each shown the moon home beside the
stripped tower, unlabelled; again without three reference apps, which the
first Benchmark cycle must collect). Overall, of 10:

| Round | The moon home | The stripped tower | What they said |
|---|---|---|---|
| 1 (first build) | 6.5 and 6.5 | 5 and 5 | "One picture, one number and one verdict, and I understand it in two seconds." "The idea is distinctive; the rendering is not yet": "a two-tone mustard-and-navy ball" |
| 2 (a baked, cratered surface; lighter count; quieter controls) | 6.5 and 6.5 | 4.5 and 5 | "A metaphor doing work." The shadow's edge was "ragged, like a displacement artefact"; the night side "a flat royal-blue disc" |
| 3 (soft shadow edge, night side near the sky, ivory surface, tighter glow, the row at the foot) | 7 and 7 | 5 and 5 | "The better first screen by a distance." "It already looks better than almost anything in its category, and its flaws are polish, not concept." "Not award-grade yet" |

All six would be prouder of the moon; all six say it is its own thing in
finance ("the category runs on gauges, rings and fan charts") and that its
relatives are sky and sleep apps; all six call the deeper level "a real idea"
and the opening motion, the one moon travelling to the end of the row, "the
best thing in the set". All six say the lower half is still "a form under a
poster". The bar in the manual is 8. It shipped at 7 because the owner chose
it; the difference is the next cycles' work:

1. **The moon's render, once more** (both, every round): a higher-resolution
   surface in a cooler pearl ivory, a clean edge to the shadow with long
   crater shadows only beside it, a wider and softer glow, and the moon a
   fifth larger.
2. **One lockup for the answer**: the count larger and in a face with
   character, "of 100" beside it, one caption line, the verdict the only bold
   line; the moon itself as the way in, with a small mark on it, so "The
   years ahead ›" can go.
3. **The lower half**: a fixed column for the figures, the two questions as a
   matched pair, the tab bar set apart.
4. A moon lit on the right is waxing in northern skies, and the row runs from
   full to half, which is waning: for anyone who knows the sky it runs
   backwards. Consider lighting from the left.
5. Nothing says it is an estimate (both critics in round 3; the caveat went
   from the first screen with the old sentence). "That should be one tap
   away, not more text on the screen."

## Benchmarks

None yet under version 2. (The market's pension calculators are in
`pension-scout-ledger.md`: about forty examined. What they have in common is one
line, before tax, and an adviser at the end. None is a model of a first
screen.)

## Patterns

Learned on this product, from the panels (each with its evidence above):

1. **A control teaches a picture better than a key does.** Nobody could read
   the tower with its key. Everyone read the moon after one press of "+".
   Put the lever next to the picture and let the picture move.
2. **The count goes with the picture, in plain words.** "58 times in 100",
   large, under the object. Not "futures" (9 of 12 stumbled), not an idiom
   ("Touch and go" was read as an instruction), not a headline that
   contradicts the count ("most" beside 58; "outweighs" beside "touch and
   go").
3. **Familiar is understood; familiar is also generic.** The scales were read
   perfectly and scored 4.5 for looks. The answer is a distinctive object
   made familiar by its behaviour, not a familiar object.
4. **One encoding per object.** The core carried two (size and lit share) and
   nobody could read it.
5. **Do not shrink things with distance.** Smaller moons were read as less
   money by 3 of 3.
6. **People press the control, not the picture.** Depth that hangs off the
   picture alone will not be found; give it a visible way in.

7. **A gap reads as a fault.** When the chosen year's moon left the row,
   every reader thought something had broken. Show the detail beside the
   thing, never in place of it.
8. **Position is an encoding whether you meant it or not.** A row on an arc
   made three of five ask what the height meant.
9. **One test, one phrase.** "Lasts", "still paying" and "paying in full" on
   three levels read as three tests.
10. **Check the picture against the number at the edges.** Perspective made
    a moon at the edge of the screen look less lit than its count, and a
    reader caught it. The UAT now measures the lit share from a photograph.

11. **The picture must move when the plan does.** Three ways it did not: the
    count for ladder plans was one that rules hold steady; the unlit part
    was the colour of the sky, so 90 looked like 100; and a step of two in
    100 moves the shadow four pixels. Count what was asked; keep both parts
    of the picture visible; show a change where it happened; and give the
    picture something to say past full.

Still hypotheses: the app should decide more and ask less; uncertainty said
the way a forecast says it.

## Concepts

### The first Leap (21 November 2026)

The owner: "the tower is not intuitive. You can remove it but only to replace
with something better and non standard. Think of all the 3d spacial
opportunities or 4D or button pressing to open more … visual levels of
depth". Three concepts, each one object in the dark that is the answer at a
glance and a press that goes a level deeper, on the real engine at
`?lab=<name>` (`horizon/src/lab/`). (The owner chose the moon the same day; the
scales, the core and the lab's route were then deleted, and the moon's stage
moved to `horizon/src/moon/`.)

| Concept | In one sentence | Address | Lay readers (3): what does the picture mean? | Critics (of 10) | Verdict |
|---|---|---|---|---|---|
| **Moon** | The lit share of one moon is the share of futures in which the money lasts; press it and it becomes the years ahead | `?lab=moon` | 3 of 3 right, each saying "I'm guessing"; after stepping the stop age, 3 of 3 sure ("the moon made more sense once I saw it change") | 7 and 7.5; both rank it first: "the only one I would screenshot", "the only one where the picture is the answer" | **Recommended.** Kept, and taken to a second version |
| **Scales** | What you have against what you need on a balance that sways with the uncertainty | `?lab=scales` | 3 of 3 right at once, every part named ("much friendlier than a graph"); pressing a pan gave "exactly what I expected" | 4.5 and 4.5; both rank it last: "clip-art", "the stock metaphor for money" | The most understood and the least distinctive. Not the home. Keep the idea of have against need for a deeper level |
| **Core** | Income guaranteed for life as a solid core in a glass shell lit by the share of futures | `?lab=core` | 0 of 3 from the picture ("the labels do the work, the picture doesn't"); its sentence was "the clearest thing so far" | 6 and 6: "needs that sentence to be understood at all" | Kill the picture. Keep the sentence ("£2,060 of your £4,333 a month is guaranteed for life") for a deeper level |
| The stripped tower (the baseline) | — | the home after cycle 1 | 1 of 12 could say what it means | 5.5 and 5.5 | Replaced if the owner chooses the moon |

Screening used three lay readers a concept (the nurse, the builder, the
second-language reader), not six, and the critics again had no reference
apps beside the screens. The winner gets the full panel when it is built as
the home.

**The moon, second version** (the same day, from what the readers and critics
said): the count locked up with the picture ("58 / times in 100, the money
lasts to 94"), a verdict in plain words, the years as a level row with the
count under each age, a proper surface (relief, a crisp terminator, light on
the dark side), and the two things a person would change ("Stop work at",
"Take home a month") on the same dark screen, so the light moves across the
moon as they are stepped. Nothing is saved from the lab.

What three lay readers then said of it:
- All three read the first screen right, and all three would press "+"
  beside "Stop work at" before anything else.
- After pressing it: "Age went to 66, the number went from 58 to 77, and it
  now says 'Probably'. The moon's filled up more. So two more years' graft
  buys a much better chance. That's useful and I got it straight away."
  "Bigger yellow is better." The interaction teaches the picture; no key did.
- The years view needed words and numbers ("give me the numbers under each
  one, or don't bother"): added.
- Still open: "why a moon?" (2 of 3: understood, not explained); "lasts to
  94: the money, or me?" (reworded to "the money lasts to 94"); is £4,333
  what I get or what I want, before or after tax; whose money and how much;
  nobody thought to press the moon itself.

Honesty check: at 16 times in 100 the moon is a thin crescent and says "Not
as it stands"; at 97 it is all but full and says "Yes, on track".

## Cycles

| Date | Kind | What shipped | Pull request | The owner's reaction |
|---|---|---|---|---|
| 2026-11-21 | setup (owner-driven) | Version 2 of the manual; `horizon/ux-metrics.mjs` and the baseline above; this ledger with a first inventory of the home | #76, #77 | "Don't ruin the UX… visually stunning and different but simplicity is important"; then "Run it now" |
| 2026-11-21 | Leap (owner-directed) | Three concepts at `?lab=moon`, `?lab=scales`, `?lab=core`; the moon taken to a second version with the count, plain words and two live steppers. Recommendation: build the home around the moon | see the pull request | — |
| 2026-11-21 | Subtract (home) | The picture without its scaffolding: key, caption, two buttons, the count labels, the State Pension strips, "You ask for" and the resting line are off the first screen; the tower is a third taller. Panel: no worse on any question; critics 7 and 6 against 5 and 5 | #78 | "Yes the tower is not intuitive. You can remove it but only to replace with something better and non standard…" |

| 2026-11-21 | Leap, shipped (owner-driven) | The moon is the home: one night screen, the count, a verdict the count decides, two steppers, the years a press deeper. The Lantern is off the home; the lab's losers are deleted. Readers 6 of 6 on every question; critics 7 and 7 against 5 and 5 | merged by the owner's standing instruction | "Moon - do it" |

| 2026-11-21 | Subtract and reword (owner: "Continue") | What the readers still asked: the unluckiest 10 at each age; "until you are 94"; "Live on each month"; tabs named Home and Workings. The moon retuned after the critics' third round, and its lit share measured against the count | merged by the owner's standing instruction | — |

| 2026-11-21 | Fix (owner: "The moon isn't sensitive enough") | The moon counts paid in full on every plan (a ladder plan's "with rules" count hardly moved and could rise with the ask); the unlit sliver is visible; a change flashes where it happened; the glow widens with what is to spare past full | merged by the owner's standing instruction | — |

**Standing instruction (owner, 21 November 2026):** do not ruin the UX. The
result must be visually stunning and different as well as simple. Subtract
the scaffolding, never the picture.

**Next (the moon is the home):** a blind panel on the evening's changes (the unlucky sentence, the new label,
the tab names, the retuned moon), since none of them has been read by fresh
eyes yet. Then the rest of the two work lists above: "times in 100" of what,
what is counted and that it is an estimate (one tap away, not more words),
the labels under the row; and from the critics the lockup for the answer and
the lower half. Then the wording app-wide: "times in 100" and a verdict that cannot
contradict its count everywhere `lib/status.ts` still says "futures" and
"Enough in most futures, not all" (the island home, Explore, the report;
spec §3.4), and one age for "lasts to". Then what sits a level down from the
moon besides the years: what it is made of (guaranteed for life against your
pots), and have against need. The island home still carries everything the
moon home dropped; once the moon has been lived with, ask the owner whether
the island should go.
