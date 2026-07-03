# RetireLens 3: UK drawdown tax topology for couples

A retirement drawdown planner for a two-partner UK household that answers one
question first: what is the least tax you can legally pay to fund this life,
and exactly where does HMRC take the most from each partner?

There is no fan chart on the top fold, on purpose. The hero visualisations are:

1. **Molten Tax-Band Vessels**: drag income and watch it pour through each tax
   band as molten metal. The tapered-allowance trap pulses red. The silver PCLS
   stream visibly bypasses every vessel.
2. **Tax Efficiency Frontier**: every withdrawal-sequencing strategy plotted by
   lifetime tax against residual estate, with the efficient frontier glowing.
   Walk it with a slider and the whole plan re-renders.
3. **Crossover Horizon**: one life-lane per partner, lamps dimming as funding
   confidence fades with age.

Monte Carlo (1000 live correlated paths in a Web Worker) and the year-by-year
table exist, below the fold, demoted by design.

## Files

    v3/
      index.html      the app shell
      app.js          UI, rendering, Web Worker wiring
      engine.js       tax engine, sequencing solver, Monte Carlo (shared with the worker)
      styles.css      dark molten-metal theme
      stress.test.js  dev-time invariant battery, run with node
      stress.md       what the battery covers and its honest results
      CRITIQUE.md     red-team self-review of the tax engine
      README.md       this file

No build step, no backend, no external network calls at runtime, no analytics.
State lives in memory; export or import your inputs as JSON from the Inputs
panel.

## Tax model

Exact 2026/27 figures, both partners computed in isolation then merged:
England and Scotland band ladders (switchable per partner), personal allowance
taper above 100,000 (the 60 pence England trap, 67.5 pence Scotland), PCLS at
25% with the 268,275 lump sum allowance cap, UFPLS, state pension, DB pensions,
ISA tax exemption, and the MPAA warning. No NI on pension income. All figures
in real terms. Sources are cited in the in-app Assumptions drawer, and the
engine asserts its own tax maths in the browser console at load.

## Verify it yourself

    node v3/stress.test.js

runs the deterministic battery (98,616 assertions over 1,152 full plan
combinations plus band sweeps and edge cases). Opening the app prints the
load-time tax assertions to the console.

## Deploy to GitHub Pages, from an iPhone

The whole app is static files, so GitHub Pages serves it as-is.

1. In Safari, go to github.com, sign in, and open (or create) your repository.
2. Add the five app files. Easiest from a phone: open the repo, tap the plus
   button, "Create new file", name it `v3/index.html`, paste the content, and
   commit. Repeat for `app.js`, `engine.js`, `styles.css`, and the markdown
   files. (If you are using Claude Code on your phone, it commits and pushes
   for you.)
3. In the repo, tap the "..." menu, Settings, then Pages.
4. Under "Build and deployment", set Source to "Deploy from a branch", pick
   your default branch and the root folder, and Save.
5. Wait about a minute, then visit
   `https://YOUR-USERNAME.github.io/YOUR-REPO/v3/`.
6. Updates are just new commits; Pages redeploys automatically.

Add it to your home screen from Safari's share sheet for an app-like feel.

## Honesty

This is a modelling tool, not regulated financial advice. Every headline number
is traceable to an input or a stated assumption; the Assumptions drawer lists
all of them with sources. Known simplifications and the five biggest ways the
tool could mislead you are documented in CRITIQUE.md, read it before trusting
any output with real money.
