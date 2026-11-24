# Pension Scout: the simplicity ledger

Memory between cycles under version 2 of `PENSION_SCOUT.md`. Read it first;
update it last. The format is in the manual, §8.

## The owner's words

Word for word, newest first. These outrank any score.

| Date | About | The owner said |
|---|---|---|
| 2026-11-24 | the council's verdict: a plain chart under the count in place of the moon, shown as two sketches | "Build it" |
| 2026-11-23 | the home's pictures, two days after choosing the moon | "Do you know what perhaps the lantern and island and the moon are too gimmicky - gather the council please" |
| 2026-11-22 | a research report he had commissioned, proposing a strip of funded years (three bands a year, locks, hatching, two edges) in place of the moon; asked "Thoughts ??", then | "You do what you think is best for the user" |
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
| 2026-11-22 ("What could go wrong?" halved) | 38 | 5 | 12 | 4 | 13 px | 0 | 91 | 126 | 909 / 86 | 1,424 / 219 | 186 | 2,812 / 138 |
| 2026-11-23 ("What would help?" in the home's words) | 38 | 5 | 12 | 4 | 13 px | 0 | 44 | 126 | 909 / 86 | 1,424 / 219 | 186 | 2,765 / 138 |
| 2026-11-24 (the plain chart is the home; owner: "Build it") | 65 | 13 | 12 | 4 | 13 px | 0 | 44 | 126 | 909 / 86 | 1,416 / 219 | 186 | 2,811 / 139 |
| 2026-11-24 (Details said shorter, in three sizes) | 65 | 13 | 12 | 4 | 13 px | 0 | 44 | 126 | 670 / 86 | 1,416 / 219 | 186 | 2,572 / 139 |

**The chart home (24 November) is over the home's targets for words and
figures, by the owner's choice of a chart**: 65 words against 60 and 13
figures against 5 on the budget's example (more on a plan with a lower
line: about 74 words). The moon home was 38 and 5. A chart has an axis:
seven of the figures are the ages along its foot, which the first two
blind reads showed it cannot do without. It is recorded as the second
exception to "numbers only go down", and it is the owner's.

The moon home meets the home's targets for words, figures, sizes and smallest
text. Controls are 12 against 7: four tabs, four stepper buttons, the typed
figure, "The years ahead" and the two questions. (The tab labels went from
9.9 to 13 px on every screen, which is where the app-wide "smallest" will
move as each screen is worked on.)

The second row of the evening went up by two words on the home ("until you
are 94" for "to 94") and four elsewhere (two of them the Workings sheet's title): every reader had
asked whose 94 it was. It is recorded as an exception to "numbers only go
down", inside the home's target of 60.

Notes on the baseline: Explore is measured as it opens. Details is every one
of its fourteen pages at once (the pages sit side by side in the sheet, so
the count has always included them: the note here that they were "not yet
counted" was wrong). What a person meets on opening Details is the first
page: 7 controls, with 14 page names and two arrows round it. Reading grade: home 4.6, Details 12.1,
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

### The moon home, second panel (22 November 2026)

After three rounds of changes nobody fresh had read (the readers' first list,
the more sensitive moon, the bad case as an age). The same six personas and
plan; truth: 57 of 100; in the unluckiest 10 the money runs short by 77; the
guaranteed income is about £2,050 a month.

| | Q1 what is it telling you | Q2 can they stop, how sure | Q3 which number matters | If the money does not last: what happens, and when? |
|---|---|---|---|---|
| The moon home | 6 of 6 right | 6 of 6 right | 6 of 6 right | 5 of 5 who saw the years: "they don't end up with nothing… they drop from £4,333 to about £2,050… from about 77"; the screen-reader persona, with the first screen only, could not say |

One word each: Calm, Smart, Striking, Handsome, Sparse, Beautiful. Three of
six said the line they would lose sleep over was the new one ("the number I'd
actually worry about is the 77"), which is the point of it. All five
"pieced it together from three places": no screen said outright what the
drop is.

Found, and fixed before it shipped:

| Found | By | Done |
|---|---|---|
| "Runs short by 77": 77 what? Pounds, per cent, years? | 6 of 6 | "by age 77"; "the unluckiest 10 of 100" |
| "£2,050 still comes in whatever the markets do" beside "£2,050 or less": "which is it?"; "why 69?" | 5 of 5 | "or less" went; the separate sentence went (the year reading says it) |
| The years screen: "the top half is empty black where the big moon was. It looked like something had failed to load"; "Press one" nearly missed | 2, and three critics before them | One level: opening the years chooses the last age, and the moon travels to stand over it |
| Screen reader: the button read as two things glued together | 1 | "The years ahead: in the unluckiest 10 of 100, it runs short by age 77" |

Still open (added to the list above): the figures under the ages are
unlabelled (5 of 6); it never says it is a couple, together, after tax (6 of
6); "Workings" (2 of 6: "working like a job?"); what the £2,050 is made of
(4); what happens if one of them dies (the teacher: "at our age the real
question"); the stop age cannot be typed and is read as a bare "64" (screen
reader). Not run this time: the two critics (the look changed only in the
night side and the glow).

### "What could go wrong?" (22 November 2026): 331 words, 22 figures, 7 text sizes, smallest 10.9 px

The sheet the home sends people to for "and the other times?". Target: 150
words.

| Element | Question it answers | Rung | Done |
|---|---|---|---|
| Opening sentence (27 words: "The most you could spend a month, after tax in today's money, and still be paid every year to 92 in each case…") | What am I looking at? | 5 say it shorter | "What each case could pay you a month until you are 94. You ask for £4,333." The age is now yours at the plan's end, as on the home (it was the plan age, 92, beside the home's 94) |
| Each case's meaning ("Returns of 5% a year, every year"; "A crash the day you stop and five flat years after it") | What is this case? | 5, and 2 for the crash | Shorter; the crash's is merged into its name ("A 30% fall, then five flat years") |
| "Spending £703 a month less would see it through" / "What you ask would still be paid" | Is it enough? | 2 merge | Gone: it was the third statement of one fact |
| The figure, and "covers your ask" / "short of your ask" | Is it enough? | 2 merge | The figure, and "enough" or "£700 short" |
| A smaller State Pension (45 words) | What if the State Pension is less? | 5 | 21 words; "with returns of 5% a year" and "(the full rate needs 35)" went |
| The futures: "Random markets from today, through the saving years too" | How was this done? | 3 down a layer | Gone from here (the name says "random futures"; the method is in Workings) |
| The futures: the count and the unlucky age | How often, and when? | keep, in the home's words | "57 times in 100, the money lasts until you are 94. In the unluckiest 10 of 100, it runs short by age 77, falling to about £2,050 a month." One rule for the age, shared with the home |
| "The chance at least one of you is still here at 77 is about 96 in 100" | Will I be here to feel it? | 3 | Gone (found odd or morbid by 7 of 12) |
| "Counting how long people live, the money runs short while one of you is still here in about 36 of 100 futures. These are national averages…" | The same, as one figure | 3 | Gone from here: it is in Explore and the report. All six readers of the old sheet could not relate 36 to 57 |
| Closing paragraph (31 words) | Is this a forecast? | 5 | "Scenarios, not predictions." |
| Seven text sizes, the smallest 10.9 px | | | Three: 16, 14 and 13 px |

**Panel** (six fresh readers a version, each shown the whole sheet; the
example couple asking £4,333; truth: the central case pays £4,470, the worst
history, Japan from 1990, £3,330, which is £1,000 short; 57 of 100; the
unluckiest 10 short by 77). K is the sheet before, M after.

| | Q1 what is it telling you | Q2 safe? the worst case, in pounds | Q3 which number matters | Q4 how often, what happens, when | Time to read (their words) | One word |
|---|---|---|---|---|---|---|
| K (331 words) | 6 of 6 right | 6 of 6 right | 6 of 6 (57 of 100) | 6 right on 57 and 77; 6 of 6 lost by "36 of 100" ("I can't see how the two relate"); 3 unsure 77 was an age | 1½ to 4 minutes | Dense, Heavy, Heavy, Dense, Heavy, Heavy |
| M (143 words) | 6 of 6 right | 6 of 6 right | 6 of 6 | 6 right; nobody unsure of the age; 4 asked whether "runs short" means nothing at all | 40 seconds to 2 minutes | Worrying, Worrying, Worrying, Vague, Dense, Confusing |

No worse on any question, and read in about half the time. "Worrying" is a
true reading of a plan that lasts 57 times in 100. After the panel, from
what M's readers said: the sentence about still being here went (4 of 6
found it odd) and the bad case now says what is still paid ("falling to
about £2,050 a month"); the sheet's surface is nearly opaque (3 of 6 saw the
home's count through it). The sheet as shipped is 134 words. Those two
changes have not been read blind. The
readers were a smaller model than earlier panels used, the same for both
versions.

Still open on this sheet: the names of the cases mean little to a reader
with English as a second language ("A poor run: a run is something you do
with your legs?"; "central of what?"); "5% a year: of what?" (3); five
bad histories where "two would do" (the teacher); the engineer wants the
working behind each figure; gov.uk cannot be pressed (the app sends nobody
anywhere, by rule).

### "What would help?" (23 November 2026): 91 words, 5 text sizes, smallest 11.8 px

The sheet behind the home's first question. It spoke the engine's words
beside a home that speaks its own: "Spend £3,000 a year less" under a
stepper that says "Live on each month"; "+10 of 100" under "times in 100".
(On the couple asking £4,333, as the panel read it: 105 words.)

| Element | Question it answers | Rung | Done |
|---|---|---|---|
| Title, "What would help most" | What is this? | 5 | "What would help?": the words on the button that opened it (5 of 6 noticed the difference; two actions tie, so "most" was not true either) |
| (nothing said what the numbers count) | More of what? | | One line, in the home's phrase: "How many more times in 100 the money would last." |
| "Stop work one year later" | What could I do? | 5 the home's words | "Stop work at 65": the stepper's label and the age it would show |
| "One more year of growth and saving, one fewer to fund." | Why does it help? | 1 delete | Gone: the row is a control on the home, and the gain is the answer |
| "Spend £3,000 a year less" | What could I do? | 5 the home's units | "Live on £250 a month less": the home is in months |
| "A little under £60 a week, for the whole retirement." | How much is that? | 1 | Gone: a third unit of time for one sum |
| "Two years of part-time work after stopping, £10,000 a year" | What could I do? | keep | Kept (the engine's name for it) |
| "Taxed as earnings; bridges the early years so the pots keep growing." | Why does it help? | 1 | Gone: jargon to 6 of 6 ("bridges", "pots": "a cooking word?") |
| "Save £250 a month more until you stop" / "Into the pension, with growth on top." | What could I do? | keep / 1 | The name kept; its line gone |
| "+10 of 100", in amber | How much would it help? | 5 | "+10", in the green the app uses for good news ("orange to me is warning"); heard by a screen reader as "Stop work at 65: 10 more times in 100" |
| "Each is your plan run again through the same simulated futures." | How was it measured? | 3 down a layer | Gone from here (the method is in Workings) |
| "Tap one to try it; you can change it back above." | What does a press do? | 5 | "Press one to try it." ("Above" pointed at the island home's steppers; on the moon home they are behind the sheet, and to a screen reader "above" is nowhere) |
| "Prompts, not advice." | Is this advice? | 5 | "Ideas, not advice." ("Prompts" was not understood by 6 of 6) |
| Five text sizes, the smallest 11.8 px; the footer in the faint ink | | | Three in the panel (16, 14, 13 px) and the title; the footer in the dim ink |

Rows for the actions that are not the home's own controls (easing spending
from 75, taking the tax-free cash in stages, the order of withdrawal, a
scheme pension at its normal age) keep the engine's one line of why: a
reader has nothing else to place them by. The example couple's sheet shows
none of them.

**Panel** (six fresh readers a version, the whole sheet over the home; the
couple asking £4,333, whose home says "57 times in 100"; truth: stopping at
65 or living on £250 a month less each add 10, part-time work and saving
more 3 each; a press applies the change and closes the sheet). K is the
sheet before, M the first rewrite, N the sheet as shipped (three readers:
the nurse, the second-language reader, the screen-reader user).

| | Q1 what is it telling you | Q2 what helps most, by how much | What the number counts | Q3 the home afterwards (67) | Q4 what a press does | Time | One word |
|---|---|---|---|---|---|---|---|
| K (105 words) | 6 of 6 | 6 of 6 (two tie at +10) | 6 guessed right, and 6 of 6 asked "of 100 what?" ("it might be 10 per cent, it might be 10 people") | 6 of 6 | 6 of 6; 3 not sure how to undo | 20 to 40 s (mean 29) | Clear, Shifty, Clear, Thin, Dense, Confusing |
| M (62 words) | 6 of 6 | 6 of 6 | 6 right, 5 quoting the opening line; 2 still asked whether it was per cent | 6 of 6 | 6 of 6; 4 not sure it can be undone | 20 to 40 s (mean 25) | Clear, Plain, Clear, Thin, Clipped, Clear |
| N (50 words) | 3 of 3 | 3 of 3 | 3 right, all from the opening line; all 3 still wonder aloud whether it is per cent | 3 of 3 | 3 of 3; 1 not sure it can be undone | 20 to 25 s | Clear, Clear, Terse |

No worse on any question, and the one thing every reader of the old sheet
asked ("of 100 what?") is answered by one line. From M's readers, before N:
the part-time row's line of why went (jargon to 6 of 6), "Prompts" became
"Ideas" (6 of 6), the title became the button's words (5 of 6), the gains
went from amber to green (3 across both panels). From N: the rows are named
for a screen reader ("+10" was heard as "plus ten" of nothing); that name
has not been heard by a fresh listener. The readers were the smaller model
the last cycle used, the same for every version.

Still open on this sheet: whether a press can be undone (the old words
"you can change it back above" did not settle it either; a real "Undo" on
the home after a press would, and it is a control, so it waits for the
home's controls to come down); "+10" still wondered at as possibly per cent by 3 of 3, though each
read it right;
the two that tie give no reason to choose ("how can a year's work be worth
the same as £3,000 a year less?", the builder); "Stop work at 65" does not
say it is a year later than now (2); the part-time row is long, and does
not say whose work or whether £10,000 is before tax; "Save £250 a month
more until you stop": into what; "Ideas, not advice" still reads as a
disclaimer (which it is); the engineer wants the working.

### Details (24 November 2026): 909 words, 86 controls, 14 text sizes, smallest 10.6 px, 257 words under 12 px

Fourteen pages in one sheet. The first Subtract cycle here took the two
lowest rungs only (remove; say it shorter) and the type. No field, switch or
page went: every one is an input to the model, and the tests enter figures
by the fields' names.

| Page | Words before | After | What went or changed |
|---|---|---|---|
| Who | 47 | 28 | The sentence under "A couple / Just me" ("Two people taxed as two individuals, planned to the later horizon, with the survivor modelled after a first death") |
| Someday | 90 | 83 | The living standards' source in a bracket; "Tap one to use it" |
| Pots (each person) | 103 / 86 | 71 / 62 | The payment's hint from 42 words to 18, and it now names the employer's share; the Advanced switch's label |
| Guaranteed income (each) | 62 | 46 | "change only if you know otherwise"; the list of schemes that the button under it repeats |
| Spending | 37 | 37 | |
| Life events | 11 | 11 | |
| Investing | 49 | 37 | "the simulation's spread and the share of your money the stress tests hit together" |
| Tax | 51 | 35 | "Every figure in the app recalculates on your choice"; the freeze said in eleven words |
| Drawing | 95 | 65 | Each choice's line ("Crystallises a slice with each withdrawal…" is "A quarter of each withdrawal is tax-free: often the least tax"); "advice-grade decision" |
| The lens | 12 | 12 | Renamed "Growth rates": ten of twelve readers did not know what "The lens" was |
| Safe ladder | 88 | 52 | The paragraph from 75 words to 39; "gilts" is "government bonds (gilts)" |
| Plan file | 77 | 56 | "A plain JSON file…", the engine version |
| Page blurbs (one shows at a time) | 12 of 14 pages had one | 3 | Kept: the State Pension forecast at gov.uk; "Most people spend less later."; "Most people leave these alone." |
| Type | 14 sizes from 10.6 px | 4: 21.6, 16, 14 and 13 px | Labels and figures 16, hints 14, the small controls 13; hints in the dimmer ink, not the faint one |

**Panel** (six fresh readers a version on five pages: pots, guaranteed
income, tax, drawing, safe ladder; truth for Q1: £200 from wages and £300
from the employer is 500 in the box, and the bank-account switch stays
off). K is before, M the first rewrite, N as shipped (three readers).

| | Q1 the payment | Q2 State Pension, the third box | Q3 the tax switch | Q4 tax-free cash | Q5 the ladder | Time | One word | Small grey text hard to see |
|---|---|---|---|---|---|---|---|---|
| K (909 words) | 6 of 6 | 6 of 6 | 5 of 6 | 6 of 6 | 6 of 6 | 3½ to 10 min (mean 6.3) | Dense ×5, Fiddly | 5 of 5 sighted |
| M (657) | 6 of 6; 1 unsure the employer's share counts | 6 of 6 | 6 of 6 | 6 of 6 | 6 of 6 | 2½ to 10 min (mean 5.6) | Dense ×4, Fiddly ×2 | 4 of 5 |
| N (670) | 3 of 3, each quoting "yours and your employer's" | 3 of 3 | 3 of 3 | 3 of 3 | 3 of 3 | 5 to 10 min | Dense ×2, Fiddly | 3 of 3 ("a bit faint") |

No worse on any question, and not better in the way that matters: a
quarter fewer words and larger type, and it is still "dense" or "fiddly"
to every reader. Each reader of every version listed eight to twenty-three
terms they did not know, and the lists hardly changed: "defined
contribution", "the allowance taper", "protected tax-free cash", "Which
pot first", "Allowances", "Capped at £268,275", "annuity", "gilts" (still
listed with "government bonds" beside it, though two of three then used
those words to explain the page). The difficulty of Details is its
vocabulary and its fourteen pages, not its word count. The readers were
the smaller model, the same for every version.

Still open on Details: the terms above; fourteen page names in a strip
that runs off the screen ("the tabs run off the edge", 6 of 12); three ways
to move between pages (the strip, the arrows, a swipe); the labels do not
use the home's words ("Retire in year", "Income you want each year" beside
"Stop work at", "Live on each month": the tests enter figures by these
names, so it is a cycle of its own); the full State Pension as the default
beside "most people are not on the full amount" (the engineer); 86
controls against a target of 12, which only a different structure (the
five pages most people need, and the rest a layer down) will move.

### The chart as the home (24 November 2026, owner: "Build it")

**The council** (23 November, owner: "gather the council"): twelve fresh
seats in the three factions of `design-rounds/world-class-council.md`
(a financial planner, a Consumer Duty specialist, a product lead; three
designers: product, data, brand; six consumers), each shown five
unlabelled first screens for one couple: the moon, the island, the
Lantern, a count with a bar, and a chart of savings by age.

| | First choice | The moon | The island and the Lantern |
|---|---|---|---|
| Round 1, six professionals | The moon, 6 of 6 | "An honest ornament": no information, no harm | A gimmick or an overreach, 6 of 6 |
| Round 1, six consumers | The chart, 6 of 6 | Third of five for 5; a toy or a gimmick to 5 ("a moon isn't money"; "I'd be embarrassed to say the moon says 57") | Nobody could read either |
| Round 2, the professionals shown the consumers' result | A plain chart under the count and the verdict, 6 of 6 | Off the home | Off the home |

All six consumers trusted the chart most and said dull is fine for money.
All six also misread it: savings at nothing from 77 was taken for no
income. Five professionals would label that on the chart; the data seat
would chart monthly income in place of savings. The owner was shown both
as sketches and said "Build it".

**What was built**: `components/ChartHome.tsx`, the income form. The
moon's words (the count, "times in 100, the money lasts until you are
94", the verdict, the bad case as an age), one chart of what you would
live on each month, the two steppers, the two questions. The moon and the
island are in Explore → "Home picture".

**Panel** (six fresh readers a version, the couple asking £4,333, 57 in
100; truth: in the unluckiest 10 of 100 they are paid £4,333 at 70 and
about £2,050 at 80, and nobody is ever paid nothing). F is the sketch of
the savings chart with its zero point labelled; M, N and P are the built
income chart, each changed from what the one before found.

| | What they live on at 70 in the bad case | At 80 | Read the bad case as nothing | Worry, 0 to 10 |
|---|---|---|---|---|
| F, savings sketch | 0 of 6 could say (2 guessed right) | 4 of 6, each "a guess"; 1 could not say | 1 of 6 ("in the bad case they've nothing at 77") | 6, all six |
| M, income: the lower line drawn only where it differs | 0 of 6 ("about £3,000", "a little under") | 6 of 6 | 0 | 5, all six |
| N: the lower line its whole length, wide, under the asked line | 3 of 6 | 4 of 6 | 0 | 5 to 6 |
| P: the fifth birthdays marked along the foot, the area under the line filled | 5 of 5 | 5 of 5 | 0 | 5 to 6 |

What each read changed. From M: the lower line was hidden under the asked
line until it left it, so nobody could see the unlucky were still paid in
full at 70; it is now drawn wide its whole length beneath the thin asked
line. From N: with only 64, 77 and 94 along the foot, three of four placed
70 and 80 wrongly; the fifth birthdays are marked, with faint uprights.
From M and N: "a big empty gap" under the lines (most readers); the area
under the lower line is filled faintly, and the chart no longer keeps an
empty band above itself. From P: two of five took the far end of the
asked line for what an ordinary case pays. Named "then £3,250" and read by
two more (who both had 70 and 80 right), it was still "the plan as it
stands" to one and "an ordinary case" to the other, which is near enough
true and not what the label meant; it now says "you ask £3,250". That
wording has not been read.

A failing plan (£5,300 a month: 21 in 100, "Probably not", the lower
line the middle case, "More often than not: about £2,050 a month") was
read by two: both right at 70 (£5,300) and at 85 (£2,050), both took the
thin line for what is asked, both scored the worry 7, and one said "the
picture looks worse than the words".

Limits: simulated readers of the smaller model, stills. The failing plan
was read by two, not six; a comfortable one (no lower line) by nobody. No design critics: the brief for the home
is no longer "stunning". The council's consumers chose a savings chart
they then misread; this is the income chart the data seat proposed, which
they did not see.

Still open on this screen: "times in 100" is still "odd" to most; "the
unluckiest 10 of 100" (people or outcomes?); "What you ask" ("it sounds as
if someone is asking me for money"; "I would say what you want to spend");
why the asked line steps down (most guessed right: they plan to spend less
later; nothing says so); whether "runs short" means nothing or less (the
chart answers it, the words do not); before or after tax, and in today's
money; and trust: asked whether they would put their own figures in, four
of five said "maybe" and one "no", none "yes", for want of knowing who
made it and where the figures go. That last is the same on every screen
this app has had.

## Benchmarks

The first under version 2, 23 November 2026. None of the three was run:
each was read from its maker's own pages and its store listing, so the
counts of words and controls are not given. (The market's pension
calculators are in `pension-scout-ledger.md`: about forty examined. What
they have in common is one line, before tax, and an adviser at the end.
None is a model of a first screen.)

For the critics, a reference to stand the home beside (manual §5): the
maker's own picture of (Not Boring) Weather,
`https://cdn.prod.website-files.com/5f52cb73016fed9a30bb4d95/602cf9d3ce0c80797de3228a_weather-hero.jpg`.
No critic has yet been shown it.

### (Not Boring) Weather — 2026-11-23 — notbor.ing (the product page), its App Store listing

The one job it does for the person: says what the weather is and will be today, as a thing to look at ("Most weather apps are more akin to reading a weather chart").
First screen: words, figures and controls not counted (stills only) · the eye lands on one 3D scene of the weather, with one bar under it for the day.
What makes it beautiful, and what makes it unmistakably itself: "Built like a game, Runs like an app": a lit, moving 3D object where every other weather app has a table.
Before the first answer it asks for: not stated (a place, presumably).
How it reveals depth (what one tap shows, and the next): the bar "tells you what's most important"; "Tap anywhere on the bar to preview the weather at that time… Scrub to play through a full day"; then "Tap to reveal the underlying weather data".
How it says uncertainty, in its own words: not stated.
What it leaves out that a pension tool would put in: menus ("No menus… Just simple swipes and taps"); anything not needed now ("Just what you need, Not a button more").
The pattern, in one sentence: one object fills the screen, one bar under it is time, a finger on the bar plays the object through time, and the numbers are one tap beneath.
Would it survive on Someday's first screen? Why or why not: most of it is there (one moon, the count, depth by a press). What is missing is the scrub: the years are a second state with a row of small moons to press one at a time, where a finger drawn along the ages could make the one large moon wane. That is a Leap, not a subtraction.
Sources: notbor.ing/product/weather; apps.apple.com (id 1531063436).

### Flighty — 2026-11-23 — flighty.com, its App Store listing

The one job it does for the person: says whether your flight is on time, before the airline does ("Never stop and stare at a flight board again").
First screen: not counted · the eye lands on a status in words: "Your flight today is on time", "Delayed 45m".
What makes it beautiful, and what makes it unmistakably itself: not stated by its makers in what was read.
Before the first answer it asks for: the flight; "No account required".
How it reveals depth (what one tap shows, and the next): not stated in what was read.
How it says uncertainty, in its own words: "Delay predictions. Long before airlines admit it"; "Probability of extension is 30-60%"; a gate "may start as a concourse or gate range, then sharpen as departure gets closer".
What it leaves out that a pension tool would put in: an account; the model behind the prediction.
The pattern, in one sentence: the answer is a status sentence in everyday words, with the size of the trouble in the unit the person lives in (minutes late), and a prediction is a range that narrows as the day comes.
Would it survive on Someday's first screen? Why or why not: the verdict ("Probably") and the bad case as an age ("runs short by age 77") are this pattern already. The range that narrows is not here: the count is one number, and its sampling range is in Explore. A range on the first screen would be a sixth figure; not now.
Sources: flighty.com; its App Store listing.

### Met Office forecast — 2026-11-23 — weather.metoffice.gov.uk/guides/what-does-this-forecast-mean

The one job it does for the person: says whether it will rain where you are.
First screen: not looked at (the guide to reading it was).
What makes it beautiful, and what makes it unmistakably itself: not stated.
Before the first answer it asks for: a place.
How it reveals depth: not stated.
How it says uncertainty, in its own words: "a 70% chance means a 7 in 10 chance that precipitation will fall at some point during that period".
What it leaves out that a pension tool would put in: how the chance was worked out.
The pattern, in one sentence: a chance is never said bare: it comes with the event it is the chance of and the period it covers, as a count in 10.
Would it survive on Someday's first screen? Why or why not: it is there ("57 times in 100, the money lasts until you are 94": the count, the event, the period). It was missing one press away, where "What would help?" said "+10 of 100" of nothing; this cycle put it right.
Sources: the guide above. (Its page on probability returned "not found"; Apple's guide to its Weather app could be read only in part, and nothing is taken from it.)

**The three patterns most worth trying**, in order:

1. **Every chance carries its event and its period** (Met Office). Applied
   this cycle to "What would help?". Still bare or in other words: Explore
   and the report ("futures", a percentage here and there).
2. **Scrub time on the one object** (Weather). The years as a finger drawn
   along the ages under the one large moon, which wanes as it goes, in
   place of a second state with a row of small moons. For the next Leap.
3. **Not a button more, and one vocabulary** (Weather; Flighty's status
   line). A sheet opened from the home says things in the home's words and
   units, and carries no line the answer does not need. Applied this cycle
   to "What would help?"; Details (86 controls) is where it matters most.

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

12. **Say the bad case as an age.** "Runs short by 77" is easier to hold than
    "57 times in 100", and it is the question every reader asked (when?).
    From the report the owner brought (Kitces, Blanchett, eMoney: success
    rates hide when and how badly). Not yet tested blind here.

13. **A sheet speaks the words of the screen that opened it.** "Spend
    £3,000 a year less" under a control named "Live on each month", and
    "+10 of 100" under "times in 100": six of six asked "of 100 what?".
    One line in the home's phrase answered it, and the rows lost their
    second lines without any question scoring worse.
14. **A chance is never said bare.** The count, what it is the chance of,
    and until when (the Met Office's "7 in 10… at some point during that
    period"). Where a number stands alone ("+10"), one line above must
    carry the rest, and a screen reader must hear it on the number itself.
15. **A line of why is the first thing to go.** Each action carried a
    sentence of mechanism ("bridges the early years so the pots keep
    growing"); nobody needed one to choose, and the one that was left was
    jargon to six of six.

16. **Ask the people who would pay, before the people who design.** Six
    professionals put the moon first and six consumers put it third;
    shown that, all six professionals changed their vote. (Simulated.)
17. **A line that coincides with another is not seen.** Where the bad
    case equals what is asked, draw it anyway, wide, under the other:
    "still paid in full" has to be visible, not inferred.
18. **A chart needs its axis.** Three ages along the foot were not enough
    to find 70; no reader missed a key, a grid or a title once the fifth
    birthdays were there. Label the lines where they end and the axis
    where people look things up; leave out the rest.
19. **Chart the thing the question is about.** "Can we live on this?" is
    answered by income, not by the pot: on the pot, the bad case read as
    nothing; on income, as about £2,050 a month, to every reader.

20. **Fewer words is not plainer words.** Details lost a quarter of its
    words and every reader still called it dense, with the same list of
    terms they did not know. Count the terms a reader cannot define, not
    only the words.

Still hypotheses: for money, people trust the form they already know over
a new one, and dull is no fault (the council; simulated);
the app should decide more and ask less; a prediction
given as a range that narrows (Flighty); the years scrubbed under one moon
(Weather).

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

| 2026-11-22 | Reword (owner: "You do what you think is best for the user") | The strip was not built: it is the bar strip, the stripe canvas and the tower again (one mark a year; 1 of 12 could read the tower), with five encodings on one object, and the report's case was against a moon that measures the pot, which this one does not. Its best idea was taken: the bad case as an age, as the way in to the years ("In the unluckiest 10 of 100, it runs short by age 77 ›"). A second blind panel then read everything changed since the first (6 of 6 again; what it found is in "second panel" above), and the years became one level | merged by the owner's standing instruction | — |

| 2026-11-22 | Subtract ("What could go wrong?") | The sheet more than halved: 331 words to 134 (143 as the panel read it), seven text sizes to three, nothing under 13 px; each row says its result once; the futures row in the home's words with the home's age; the two longevity sentences gone. Panel: 6 of 6 on every question before and after, read in about half the time | #84 | "Merge" |

| 2026-11-23 | Benchmark | (Not Boring) Weather, Flighty and the Met Office read from their makers' pages (templates above); three patterns ranked. One applied as a subtraction: "What would help?" says things in the home's words and units, with one line for what the numbers count; 91 words to 44 on the budget's example (105 to 50 as the panel read it), five text sizes to four, nothing under 13 px. Panel: 6 of 6 on every question before and after; "of 100 what?" from 6 of 6 to none | #85 | "Merge" |

| 2026-11-23 | Council (owner: "gather the council") | Whether the moon, the island and the Lantern are gimmicks. Twelve seats, two rounds; the verdict was a plain chart under the count. Put to the owner with two sketches | none: nothing built | "Build it" |

| 2026-11-24 | The plain chart home (owner-driven) | `ChartHome.tsx` is the default home: the moon's words over one chart of monthly income (what you ask; what the unlucky are paid), the years as a table one press down; the moon and the island in Explore. Read blind three times and changed after each: at 70 in the bad case 0 of 6, then 3 of 6, then 5 of 5; at 80, 5 of 5; nobody read the bad case as nothing. The home is over its targets for words and figures (65 and 13) | merged by the owner's standing instruction | — |

| 2026-11-24 | Subtract (Details) | Every page said shorter and set in three sizes: 909 words to 670, fourteen text sizes to four, none under 13 px (257 words were), hints in a darker ink; "The lens" is "Growth rates". Panel: no worse on any question, and still "dense": the trouble is the vocabulary and the fourteen pages | this pull request | — |

**Standing instruction (owner, 21 November 2026):** do not ruin the UX. The
result must be visually stunning and different as well as simple. Subtract
the scaffolding, never the picture.

**Next (the plain chart is the home):** read it blind on a comfortable
plan (nobody has) and with six on a failing one, and read the "you ask
£3,250" label; then the open
list in "The chart as the home" (what "runs short" means, "What you ask",
after tax and today's money one tap away, not as more words). The same
words across the app: the island, Explore and the report still say
"futures" and take their verdict from `planStatus`. Then Details again, this time its structure (the pages most people need
first, the rest a layer down) and its vocabulary, and Explore (1,416
words, 21 text sizes, 654 words under 12 px), where the type scale used on
Details would apply as it stands. The moon and the
island are alternatives now, not to be worked on; once the chart has been
lived with, ask the owner whether they should go. No Leap for the home
unless the owner asks for one.

**Before that (after 23 November):** the next cycle is a Subtract (Details: 909
words and 86 controls against a target of 12 controls; add its pages to
`ux-metrics.mjs` first) or, if a week has passed since the moon, the Leap
that scrubs the years under the one moon. The two sheets off the home are
now within reach of their targets; the home's controls (12 against 7) are
not, and an "Undo" after a press in "What would help?" waits on that.
Critics have still not been shown a reference screen: the address of one is
under Benchmarks.

**Before that (the moon is the home):** a blind panel on the evening's changes (the unlucky sentence, the new label,
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
