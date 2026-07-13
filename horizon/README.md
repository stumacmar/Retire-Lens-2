# Someday · Horizon

A serene, private, UK retirement-planning experience — Apple-HIG in spirit.
Vite + React 19 + TypeScript + Tailwind v4 + Framer Motion.

**The maths is not new.** `src/engine/engine.js` is the byte-for-byte production
engine (UK tax, State Pension, ISAs, pensions, tax-free cash, couples with
different ages, Monte Carlo). The redesign is presentation only — the numbers
stay verified against the workbook.

## Run
```bash
cd horizon
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/  (relative asset paths, deploy anywhere)
npm run preview
```

## Deploy (GitHub Pages)
The build uses `base: './'`, so `dist/` works from any path.
- **Simplest:** deploy `dist/` to Netlify/Vercel (drag-drop or connect the repo, build command `npm run build`, output `dist`).
- **GitHub Pages:** add a workflow that builds and publishes `horizon/dist` to the
  `gh-pages` branch, or copy `dist/` into a `/horizon` folder on the Pages branch.
  (The current vanilla app still serves from the repo root; this lives alongside it.)

## Architecture
- `src/engine/` — the verified engine (JS) + `engine.d.ts` type surface.
- `src/lib/usePlan.ts` — React hook: plan state, localStorage, live recompute.
- `src/components/HorizonViz.tsx` — the serene SVG landscape (dawn sky, confidence
  glow, median path, sun at retirement, hills).
- `src/App.tsx` — the answer, the Horizon, live what-if, tab bar, sheets.
