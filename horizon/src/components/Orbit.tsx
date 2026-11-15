import { useEffect, useRef, useState } from 'react';
import type { MC } from '../engine/engine';

/**
 * The orbit: the home's one picture. A hundred seeds set in a sunflower's
 * spiral (or, in the dark, a galaxy's) around the monthly figure, one for
 * each simulated future.
 *
 *            ·  ●  ●  ○  ·
 *         ●   ●  ●  ●   ●  ·        ● still paying at the age shown
 *       ●  ●   £5,720    ●  ○       ◐ still paying after the rules trim
 *         ●  a month, after ●       · ran short before it
 *            ●  ●  ●  ·  ·
 *    60 ━━━━━━━━━━━━━━━━━━━━━━━━━● 90
 *          At 90: 72 of 100 still paying
 *
 * Why this form (research, November 2026):
 * - A hundred separate, countable things are read more accurately than a
 *   percentage or a shaded band (icon arrays: Galesic, Garcia-Retamero and
 *   Gigerenzer; quantile dotplots: Fernandes, Kay, Hullman and colleagues).
 * - Showing the futures over time, rather than summarising them, helps
 *   people judge uncertainty (hypothetical outcome plots: Hullman, Resnick
 *   and Adar 2015); a summary shape such as the hurricane "cone" is misread
 *   (Ruginski, Padilla and colleagues).
 * - The figure sits in the hole of the ring, so the picture can be large on
 *   a short phone: the strip, the sunrise and the canvas before it failed
 *   by being squeezed under the figure.
 *
 * The seeds are placed by Vogel's model of a sunflower head (radius ∝ √n,
 * each seed turned by the golden angle, about 137.5°), over a ring rather
 * than a disc. Seed k holds the k-th steadiest future: the steadiest sit at
 * the inner edge, the most fragile at the rim, so a plan frays from the
 * outside in. The data is `mc.perAgeHeld` turned on its side (seed k is
 * still paying in year i while at least k of 100 futures are), so the seeds
 * lit at the plan's last age ARE the futures count in the sentence.
 *
 * The slider underneath moves through the years. On first sight it sweeps
 * from the year work stops to the plan's end, so you watch futures go out;
 * `prefers-reduced-motion` skips straight to the end. A small mark on the
 * track shows the first age a future falls short.
 */
const N = 100;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function useReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)'); const on = () => setR(m.matches);
    m.addEventListener?.('change', on); return () => m.removeEventListener?.('change', on);
  }, []);
  return r;
}

/** Inner seeds warm, rim seeds cool: a palette, not a code. */
const seedColour = (k: number) => {
  const p = ((k - 1) / (N - 1)) * 9, i = Math.floor(p), j = Math.min(9, i + 1);
  return `color-mix(in oklab, var(--paint-${j}) ${Math.round((p - i) * 100)}%, var(--paint-${i}))`;
};
// Seed positions in a 200 × 200 box: a ring from radius 62 to 98.
const R0 = 62, R1 = 97, SEED = 6.1;
const SEEDS = Array.from({ length: N }, (_, i) => {
  const r = Math.sqrt(R0 * R0 + (R1 * R1 - R0 * R0) * (i + 0.5) / N), a = i * GOLDEN - Math.PI / 2;
  return { k: i + 1, x: 100 + r * Math.cos(a), y: 100 + r * Math.sin(a), colour: seedColour(i + 1) };
});

export default function Orbit({ mc, structured, fromAge, toAge, children }: {
  mc: MC | null; structured: boolean; fromAge: number; toAge: number; children?: (side: number) => React.ReactNode;
}) {
  const reduced = useReducedMotion();
  // The ring is a square as large as the space the home leaves it. (CSS
  // container height units resolve to nothing inside this flex layout, so
  // the side is measured.)
  const boxRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState(0);
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const measure = () => setSide(Math.floor(Math.min(el.clientWidth, el.clientHeight)));
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el); window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const held = mc?.perAgeHeld;
  const ready = !!(held && held.length);
  const n = ready ? held!.length : Math.max(1, toAge - fromAge + 1);
  const first = ready ? held![0].age : fromAge, last = ready ? held![n - 1].age : toAge;
  const use = ready ? held!.map(h => Math.round((structured ? h.rules : h.full) * 100)) : [];
  const full = ready ? held!.map((h, i) => Math.min(Math.round(h.full * 100), use[i])) : [];
  const yearsFor = (c: number[], k: number) => { let m = 0; while (m < c.length && c[m] >= k) m++; return m; };
  const years = SEEDS.map(s => (ready ? yearsFor(use, s.k) : 0));
  const fullYears = SEEDS.map(s => (ready ? yearsFor(full, s.k) : 0));
  const reach = ready ? use[n - 1] : 0, reachFull = ready ? full[n - 1] : 0;
  const dropAt = ready ? held!.find((_h, i) => use[i] < 100)?.age : undefined;
  const trimAt = ready && structured ? held!.find((_h, i) => full[i] < use[i])?.age : undefined;

  // The age shown. It rests on the plan's last age; on first sight it sweeps
  // there from the year work stops.
  const [chosen, setChosen] = useState<number | null>(null);
  const [sweep, setSweep] = useState<number | null>(null);
  const swept = useRef(false), raf = useRef(0);
  useEffect(() => {
    if (!ready || swept.current) return;
    swept.current = true;
    if (reduced) return;
    const t0 = performance.now(), dur = 2600;
    const step = (t: number) => {
      const f = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - f, 2);
      setSweep(Math.round(e * (n - 1)));
      if (f < 1) raf.current = requestAnimationFrame(step); else setSweep(null);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [ready, reduced, n]);
  const stopSweep = () => { cancelAnimationFrame(raf.current); setSweep(null); };
  const idx = sweep != null ? sweep : chosen == null ? n - 1 : Math.max(0, Math.min(n - 1, chosen - first));
  const age = first + idx;

  const still = ready ? use[idx] : 0, inFull = ready ? full[idx] : 0;
  const reading = !ready ? 'Working out the futures…'
    : `At ${age}: ${still} of 100 still paying${structured && inFull < still ? `, ${inFull} in full` : ''}`;
  const summary = !ready ? 'Working out the futures.'
    : `100 seeds, one for each simulated future, in a ring around the figure. At age ${last}, ${reach} of 100 are still ${structured ? 'paying with your rules' : 'paying in full'}`
      + (structured ? `, ${reachFull} in full` : '') + '.'
      + (dropAt != null ? ` The first fall short at age ${dropAt}.` : ' None falls short.')
      + (structured && trimAt != null ? ` The rules first trim spending at age ${trimAt}.` : '')
      + ' Move the slider to see any age.';
  const pct = (i: number) => `${n > 1 ? (i / (n - 1)) * 100 : 100}%`;

  return (
    <div data-orbit data-ready={ready ? '1' : '0'} data-first={first} data-last={last} data-years={n} data-age={ready ? age : ''} data-reach={reach}
      data-first-short={dropAt ?? ''} className="flex-1 min-h-[200px] max-h-[460px] flex flex-col select-none">
      <span id="orbit-summary" className="sr-only">{summary}</span>
      {/* A square as large as the space allows, with the figure in its hole. */}
      <div ref={boxRef} className="relative flex-1 min-h-0">
        <div data-orbit-square className="absolute inset-0 m-auto" style={{ width: side, height: side }}>
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" aria-hidden focusable="false">
            {SEEDS.map((s, i) => {
              const alive = years[i] > idx, whole = !structured || fullYears[i] > idx;
              const state = !ready ? 'wait' : alive ? (whole ? 'full' : 'trim') : 'out';
              return (
                <g key={s.k} data-seed={s.k} data-years={years[i]} data-full-years={fullYears[i]} data-state={state} className="orbit-seed"
                  style={{ transformOrigin: `${s.x}px ${s.y}px`, transform: `scale(${state === 'out' ? 0.42 : state === 'wait' ? 0.6 : 1})`, opacity: state === 'wait' ? 0.25 : 1 }}>
                  <circle cx={s.x} cy={s.y} r={SEED} fill={state === 'full' ? s.colour : state === 'trim' ? `color-mix(in oklab, ${s.colour} 48%, var(--color-canvas))` : 'none'}
                    stroke={state === 'out' ? 'var(--color-ink-faint)' : s.colour} strokeWidth={state === 'out' ? 1.4 : state === 'trim' ? 1.6 : 0} strokeOpacity={state === 'out' ? 0.75 : 1} />
                </g>);
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children?.(side)}</div>
        </div>
      </div>
      {/* Through the years. */}
      <div className="mt-2 flex items-center gap-2.5 text-[0.74rem] tnum" style={{ color: 'var(--color-ink-faint)' }}>
        <span>{first}</span>
        <div className="relative flex-1 h-6 flex items-center">
          <div aria-hidden className="absolute inset-x-0 h-[3px] rounded-full" style={{ background: 'var(--color-dusk)' }} />
          <div aria-hidden className="absolute left-0 h-[3px] rounded-full" style={{ width: pct(idx), background: 'var(--color-ink)' }} />
          {dropAt != null && <div aria-hidden data-short-mark className="absolute w-[3px] h-[11px] -translate-x-1/2 rounded-full" style={{ left: pct(dropAt - first), background: 'var(--color-hope)' }} />}
          <input type="range" min={first} max={last} step={1} value={age} disabled={!ready} data-orbit-range
            aria-label="Futures still paying, by age" aria-describedby="orbit-summary"
            aria-valuetext={ready ? `Age ${age}: ${still} of 100 futures still paying${structured ? `, ${inFull} in full` : ' in full'}` : 'Working out the futures'}
            onPointerDown={stopSweep} onKeyDown={stopSweep} onChange={e => { stopSweep(); setChosen(Number(e.target.value)); }}
            className="orbit-range absolute inset-x-0 w-full" />
        </div>
        <span>{last}</span>
      </div>
      <p data-orbit-reading className="mt-0.5 text-center text-[0.84rem] leading-snug tnum" style={{ color: 'var(--color-ink-dim)' }}>
        <b style={{ color: 'var(--color-ink)' }}>{reading}</b>
        {ready && dropAt != null && <span className="[@media(max-height:760px)]:hidden"> · first shortfalls at {dropAt}</span>}
        {ready && dropAt == null && structured && trimAt != null && <span className="[@media(max-height:760px)]:hidden"> · first trims at {trimAt}</span>}
      </p>
    </div>
  );
}
