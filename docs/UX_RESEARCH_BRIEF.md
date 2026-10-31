# Research brief: a genuinely new interface for Someday

You are a senior interaction designer and researcher. Your job is to find, evidence and specify an interface for a UK retirement planner that is **unlike anything on the market**: modern, minimalist, futuristic, and **not a scrolling page of fields**. Treat this as a proper research project, not a brainstorm. Every recommendation must be backed by references you have actually examined, and must survive the evaluation criteria below.

## 1. The product you are designing for

**Someday** answers one question: *"Can I stop work at age X with £Y a month, after tax, for life?"* It runs entirely in the browser on a phone (no backend, no accounts, data stays on the device). A verified engine already exists; the interface is the problem.

The engine takes six groups of inputs and returns one answer with depth behind it.

**Inputs (these will not change; the questions are the same, the way of asking is yours):**
1. Who: one person or a couple; ages.
2. Someday: the age to stop work; the take-home wanted a month.
3. Pensions: pot sizes; monthly contributions still going in.
4. Savings: ISAs; cash.
5. Guaranteed income: State Pension; company (defined-benefit) pension a year.
6. Later life: how spending changes (go-go / slow-go / steady); the age to plan to.

**Outputs:**
- The headline: £ a month after tax, in today's money, and how long it lasts.
- Confidence: the share of 2,000 simulated futures in which it holds.
- A projection of wealth over time, with good/base/poor bands.
- "How far it could fall": the safe monthly figure under real bad histories (Japan 1990, 1970s stagflation, 2008 at the day you stop).
- "The edge": a map of every stop-age × spending pair, showing which hold.
- Ranked levers: the actions that would most improve the plan, measured.
- Year-by-year detail, tax, estate.

Secondary surfaces (Details, Explore, Peace of mind) exist as sheets and can stay conventional. **The home — where the six inputs are set and the answer is seen — is what must be reinvented.**

## 2. What has already been rejected, and why

Learn from this; do not propose these again in another coat of paint.

| Attempt | Verdict |
|---|---|
| A "constellation" of floating figures | "Awful": looked cheap, nothing could be found |
| A long form of rows in cards | A list; boring |
| A horizontal card carousel | "Same old": conventional |
| A payslip and a grid of months as the home | "Cartoony" |
| A two-ring cryptex (3D drums rolled up and down; one ring for views, one for inputs) | Right instinct, wrong execution: fussy, too much hardware, everything said three times |
| A single calm page with six steps and a dawn sky | Better but still a page |
| A one-page calculator in the style of unbiased.co.uk (sliders with numbers, result on top) | "A bag of spanners": staid, conservative, a long scroll |

**What the owner liked and wants more of:** a **3D rotating drum** you turn to complete parts of the picture; a **rotating pie**; the feeling of an **instrument** rather than a form; a meaningful, atmospheric background (a night sky that became dawn as the plan filled in); serif numerals. The owner's own words: *"modern, minimalist, futuristic and not just long scrolling pages."*

## 3. The brief

Find and specify an interaction paradigm in which:

- **The whole thing lives on one phone screen** (390 × 844 is the reference; 375 × 667 must still work). No long scrolling. If there is depth, it is reached by turning, zooming, rotating, flipping, expanding, or moving through space — not by scrolling down.
- **Setting an input and seeing the answer are the same gesture**, or as close to it as possible. The answer should move while the hand is still on the control.
- **Six inputs feel like one object**, not six fields. The owner's instinct (a drum, a dial, a pie, a sphere, a stack, an orrery) is the right family: a single physical-feeling instrument with six faces, segments or positions.
- **It is minimal.** One typeface family, one accent, no chrome that carries no information, nothing said twice. If a label can be replaced by position or motion, it should be.
- **It is futuristic without being a gimmick**: the motion and depth must encode meaning (progress, uncertainty, time, risk), never decoration.
- **It is honest**: the uncertainty (bands, confidence, bad histories) must be visible in the primary view, not hidden in a sub-screen.
- **It is buildable** in React + CSS/WebGL/Canvas on a phone browser at 60 fps, with keyboard and screen-reader access, and respects `prefers-reduced-motion`.

## 4. Where to look (go wide; finance is the least interesting place)

Research **at least these fields** and cite specific products, screens or papers. For each, record what the interaction is, what it encodes, and what is transferable.

1. **Instruments and controls**: aircraft primary flight displays and HUDs; car instrument clusters (Rivian, Lucid, Polestar, Porsche Taycan); watch crowns and complications (watchOS, Apple Watch Ultra); camera dials; synthesiser and hardware UIs (Teenage Engineering OP-1 / OP-Z, Elektron, Nothing, Braun/Dieter Rams); smart-home dials (Nest thermostat); the iPod click wheel; rotary and radial menus in games.
2. **Spatial and 3D interfaces**: visionOS and spatial windows; Google Earth's globe; Apple Maps 3D; WebGL "object as interface" sites (Awwwards / FWA winners, 2022–2026); product configurators (Tesla, Porsche, Apple Watch Studio); Things/Fantastical's non-page interactions; "zoomable UI" (Prezi, Figma canvas, Muse).
3. **Data physicalisation and generative visuals**: Giorgia Lupi, Nadieh Bremer, Shirley Wu, Moritz Stefaner, Accurat, Fathom; "data humanism"; the New York Times' scroll-free explorable explainers; Bret Victor's "Explorable Explanations" and "Up and Down the Ladder of Abstraction"; Nicky Case.
4. **Finance and fintech that actually broke the mould** (short list, assess critically): Robinhood's early slide-to-set interactions; Monzo and Revolut's pots; Copilot Money; Wealthfront's path tool; Betterment's goal sliders; Nutmeg/Moneybox's projection dials; Japan's and Korea's bank apps; "Pension dashboards" prototypes; MoneyHelper; unbiased.co.uk (what people find trustworthy and why).
5. **Games and playful systems**: Monument Valley (rotation as navigation); Alto's Odyssey; The Room (physical puzzle boxes); Tetris Effect; Loop Hero; the "radial wheel" in Apple Arcade titles; weather apps (Carrot, Weather Line, Dark Sky's timeline).
6. **Academic and practitioner research**: radial vs linear input accuracy (Fitts's law for dials); "direct manipulation" (Shneiderman); "fluid interaction"; uncertainty visualisation (Hullman, Kay, Correll — hypothetical outcome plots, quantile dotplots, "ensemble" displays); affective responses to projections; the "peak-end" effect in onboarding; cognitive load of simultaneous vs sequential input.
7. **Typography and motion for numbers**: Apple's SF Rounded and SF Compact in complications; Instrument Serif, Fraunces, GT Alpina for display numerals; "Stripe-style" counting; Linear's and Arc's motion design; Family (crypto wallet) and Amie for delight without clutter.

For each source, **look at the thing itself** (screens, videos, demos), not just an article about it.

## 5. What to produce

### A. A landscape (2–3 pages)
The ten most transferable interaction ideas from §4, each with: the source, a one-sentence description of the gesture, what it encodes, a screenshot or link, and a judgement of fit against §3.

### B. Three candidate paradigms, fully worked
For each candidate:
1. **Name and one-line metaphor** (e.g. "the orrery", "the tuning drum", "the horizon dial").
2. **The screen**: an ASCII or described layout of the single phone screen, including where the six inputs live, where the answer lives, and where uncertainty lives.
3. **The gestures**: how each of the six inputs is set; how the answer responds mid-gesture; how a couple's second set of figures is reached; how the five deeper views (bands, bad histories, the edge, levers, year-by-year) are reached without scrolling.
4. **Progress and first use**: how an empty plan reads; what changes as it fills; the moment it is complete.
5. **Motion and atmosphere**: what moves, why, and what it means. What the background is and what it encodes. What happens under `prefers-reduced-motion`.
6. **Accessibility**: keyboard path, screen-reader names and values, hit targets ≥ 44 px, contrast.
7. **Feasibility**: the rendering approach (CSS 3D, Canvas, WebGL/Three.js, SVG), the main technical risks, and an estimate of build effort.
8. **Risks**: where it could tip into gimmick, confusion or "cartoony"; how to guard against that.

### C. A recommendation
Pick one. Justify it against §3 and against the rejected list in §2, explicitly. Then give a **build specification** detailed enough for an engineer to start: component tree, state model (the six inputs, the answer, the view), the gesture handlers, the animation curves, the typography scale, the colour tokens (light and dark), and a test plan (what an automated UI test should assert).

### D. Prototype directions
Three low-cost ways to test the recommendation before building it in full (e.g. a single-screen HTML prototype of the core gesture; a Figma motion mock; a five-person hallway test script with tasks and success measures).

## 6. Evaluation criteria (score every candidate 1–5 on each, with a sentence of reasoning)

1. **Different**: no mainstream finance app looks or behaves like this.
2. **One screen**: no scrolling needed to set anything or see the answer.
3. **One object**: the six inputs feel like one instrument.
4. **Live**: the answer moves while the input moves.
5. **Honest**: uncertainty is visible in the primary view.
6. **Minimal**: nothing decorative; nothing said twice.
7. **Legible in ten seconds**: a stranger can tell what the number is and how to change it.
8. **Buildable**: 60 fps on a three-year-old phone in a browser, accessible, under four weeks of work.

## 7. Tone and constraints for the research itself

- UK English. UK pensions vocabulary (pension pot, ISA, State Pension, defined benefit, tax-free cash, drawdown).
- Be concrete: screens, gestures, pixels, curves. Avoid "could consider" and "might explore".
- Cite everything with links. Flag anything you could not verify.
- Do not propose a form, a wizard, a stepper, a carousel of cards, a chat interface, or a dashboard of tiles. Those are the market.
- Do not propose anything that needs a server, an account or a sign-up.
- When in doubt, prefer the stranger idea with the stronger evidence over the safer idea with none.
