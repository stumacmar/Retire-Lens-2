import { useEffect, useRef, useState } from 'react';
import type { MC } from '../engine/engine';

/**
 * The canvas: the home's one picture. After Gerhard Richter's Strip
 * paintings (2011 onwards), whose long horizontal bands of colour were cut
 * from his own abstract paintings by software: here the bands are cut from
 * your plan.
 *
 * A hundred horizontal stripes, one for each simulated future. Each stripe
 * is painted from the year work stops (left) for as long as that future
 * keeps paying; where it runs short the canvas is left bare. The steadiest
 * futures are at the top, the most fragile at the bottom, so risk shows as
 * bare canvas eating in from the lower right, and the number of stripes that
 * reach the right-hand edge IS the futures count in the sentence below.
 *
 *   ████████████████████████████████████████████  ← paid every year to 90
 *   ████████████████████████████████████████████
 *   ███████████████████████████████████████
 *   █████████████████████████████                 ← ran short at 80
 *   60          First shortfalls at 71          90
 *   100 futures, one stripe each.   69 of 100 reach 90
 *
 * The data is `mc.perAgeHeld` turned on its side: stripe k runs for as many
 * years as at least k of 100 futures are still paid. A structured plan trims
 * spending in bad years: its stripes are full colour while paid in full and
 * a dusty tone of the same colour while still paying after its rules trim
 * (not pale: the owner found a washed-out sky unreadable).
 *
 * Colour is a palette, not a code: warm at the top, cool at the bottom, with
 * a little seeded variation from stripe to stripe (as in the paintings). It
 * never uses red or green, so nothing reads as a warning. The meaning is in
 * where the paint stops.
 *
 * The needle (kept from the retired Horizon Dial) is a vertical line at one
 * age; the stripes it crosses are exactly the futures still paying that
 * year. Press and slide across the canvas, or focus it and use the arrow
 * keys, Home and End, to read "At 80: 84 of 100 still paying". It rests on
 * the first age a future falls short (a structured plan: first trimmed);
 * Escape or a tap elsewhere puts it back.
 *
 * The canvas takes whatever height the screen leaves (the home lays it out
 * with flex), so it is a tall painting on a tall phone and a long band on a
 * short one, and the controls below always stay in view.
 */
const N = 100;
const PAINTS = 10;

/** A fixed, seeded colour for each stripe, so a stripe keeps its colour as the plan changes. */
function stripeColour(k: number) {
  let s = (k * 2654435761) >>> 0;
  const rand = () => { s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0; return s / 4294967296; };
  const pos = ((k - 1) / (N - 1)) * (PAINTS - 1);                 // warm at the top, cool at the bottom
  const jump = rand() < 0.3 ? (rand() < 0.5 ? -1.4 : 1.4) : 0;   // the odd stripe from a neighbouring colour
  const p = Math.max(0, Math.min(PAINTS - 1, pos + jump + (rand() - 0.5) * 0.9));
  const i = Math.floor(p), j = Math.min(PAINTS - 1, i + 1), t = Math.round((p - i) * 100);
  const shade = Math.round((rand() - 0.5) * 22);                  // a touch lighter or darker
  const base = `color-mix(in oklab, var(--paint-${j}) ${t}%, var(--paint-${i}))`;
  return shade === 0 ? base : `color-mix(in oklab, ${base} ${100 - Math.abs(shade)}%, ${shade > 0 ? 'white' : 'black'})`;
}
const COLOURS = Array.from({ length: N }, (_, i) => stripeColour(i + 1));

export default function FuturesCanvas({ mc, structured, fromAge, toAge, accent }: {
  mc: MC | null; structured: boolean; fromAge: number; toAge: number; accent: string;
}) {
  const held = mc?.perAgeHeld;
  const ready = !!(held && held.length);
  const n = ready ? held!.length : Math.max(1, toAge - fromAge + 1);
  const first = ready ? held![0].age : fromAge, last = ready ? held![n - 1].age : toAge;
  // Futures still paying each year, of 100 (never rises), and those paid in full.
  const use = ready ? held!.map(h => Math.round((structured ? h.rules : h.full) * 100)) : [];
  const full = ready ? held!.map((h, i) => Math.min(Math.round(h.full * 100), use[i])) : [];
  const yearsFor = (c: number[], k: number) => { let m = 0; while (m < c.length && c[m] >= k) m++; return m; };
  const stripes = Array.from({ length: N }, (_, i) => {
    const k = i + 1, m = ready ? yearsFor(use, k) : 0, mf = ready ? yearsFor(full, k) : 0;
    return { k, years: m, f: m / n, fullYears: mf, ff: mf / n };
  });
  const reach = ready ? use[n - 1] : 0, reachFull = ready ? full[n - 1] : 0;
  const dropAt = ready ? held!.find((_h, i) => use[i] < 100)?.age : undefined;
  const trimAt = ready && structured ? held!.find((_h, i) => full[i] < use[i])?.age : undefined;

  // Painted once, top to bottom like a brush, when the futures first arrive;
  // after that the stripes glide to their new lengths as the plan changes.
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    if (!ready || phase !== 0) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase(1)));
    return () => cancelAnimationFrame(id);
  }, [ready, phase]);
  useEffect(() => { if (phase !== 1) return; const id = setTimeout(() => setPhase(2), 1500); return () => clearTimeout(id); }, [phase]);
  const painted = phase > 0, delay = (k: number) => (phase === 1 ? `${k * 5}ms` : '0ms');

  // The needle: year i occupies [i/n, (i+1)/n] of the width.
  const [picked, setPicked] = useState<number | null>(null);
  const restAt = dropAt ?? trimAt;
  const restIdx = ready ? (restAt != null ? restAt - first : n - 1) : 0;
  const idx = picked == null ? restIdx : Math.max(0, Math.min(n - 1, picked - first));
  const age = first + idx;
  const boxRef = useRef<HTMLDivElement>(null), paintRef = useRef<HTMLDivElement>(null), dragging = useRef(false);
  const pickAt = (clientX: number) => {
    const el = paintRef.current; if (!el || !ready) return;
    const b = el.getBoundingClientRect();
    setPicked(first + Math.max(0, Math.min(n - 1, Math.floor(((clientX - b.left) / b.width) * n))));
  };
  useEffect(() => {
    if (picked == null) return;
    const away = (e: PointerEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setPicked(null); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [picked]);
  const onKey = (e: React.KeyboardEvent) => {
    if (!ready) return;
    const step = ({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 } as Record<string, number>)[e.key];
    if (e.key === 'Escape') { if (picked != null) { setPicked(null); e.preventDefault(); } return; }
    if (e.key === 'Home' || e.key === 'End') { setPicked(e.key === 'Home' ? first : last); e.preventDefault(); return; }
    if (step) { setPicked(Math.max(first, Math.min(last, age + step))); e.preventDefault(); }
  };

  const what = structured ? 'still paying, with your rules' : 'still paying in full';
  const reading = !ready ? '' : `At ${age}: ${use[idx]} of 100 still paying${structured ? `, ${full[idx]} in full` : ''}`;
  const resting = !ready ? '' : structured && trimAt != null ? `Dusty: trimmed by your rules, from ${trimAt}`
    : dropAt != null ? `First shortfalls at ${dropAt}` : 'No shortfalls in any of them';
  const summary = !ready ? 'Working out the futures, year by year.'
    : `A painting of 100 stripes, one for each simulated future. A stripe runs from the year work stops for as long as that future is ${what}; where it runs short the canvas is bare. ${reach} of 100 reach age ${last}.`
      + (dropAt != null ? ` The first fall short at age ${dropAt}.` : ' None falls short.')
      + (structured ? ` ${reachFull} of 100 are paid in full every year${trimAt != null ? `; the first trims come at age ${trimAt}` : ''}.` : '')
      + ' Use the arrow keys to read any age.';
  const needleLeft = `${((idx + 0.5) / n) * 100}%`;

  return (
    <div ref={boxRef} data-canvas data-ready={ready ? '1' : '0'} data-reach={reach} data-first={first} data-last={last} data-years={n} data-age={ready ? age : ''}
      role="slider" tabIndex={ready ? 0 : -1} aria-label="Futures still paying, by age" aria-describedby="canvas-summary"
      aria-valuemin={first} aria-valuemax={last} aria-valuenow={ready ? age : first}
      aria-valuetext={ready ? `Age ${age}: ${use[idx]} of 100 futures still paying${structured ? `, ${full[idx]} in full` : ' in full'}` : 'Working out the futures'}
      onKeyDown={onKey}
      className="flex-1 min-h-[88px] max-h-[360px] flex flex-col select-none outline-none rounded-md focus-visible:ring-2 focus-visible:ring-[var(--color-calm)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-canvas)]">
      <span id="canvas-summary" className="sr-only">{summary}</span>
      {/* The painting: edge to edge on a phone, framed on a wider screen. */}
      <div ref={paintRef} data-paint className="relative flex-1 min-h-[56px] mt-2 -mx-4 sm:mx-0 sm:rounded-lg overflow-hidden"
        style={{ touchAction: 'pan-y', cursor: ready ? 'ew-resize' : 'default', background: 'var(--color-canvas)' }}
        onPointerDown={e => { if (!ready) return; dragging.current = true; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); pickAt(e.clientX); }}
        onPointerMove={e => { if (dragging.current) pickAt(e.clientX); }}
        onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
        <svg viewBox={`0 0 1000 ${N}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden focusable="false" shapeRendering="crispEdges">
          {structured && stripes.map(s => (
            <rect key={'t' + s.k} className="canvas-stripe" x={0} y={s.k - 1} width={1000} height={1.02} fill={`color-mix(in oklab, ${COLOURS[s.k - 1]} 74%, var(--color-ink-faint))`}
              style={{ transform: `scaleX(${painted ? s.f : 0})`, transitionDelay: delay(s.k) }} />))}
          {stripes.map(s => (
            <rect key={'s' + s.k} data-stripe={s.k} data-years={s.years} data-f={s.f.toFixed(4)} data-full-years={s.fullYears} className="canvas-stripe"
              x={0} y={s.k - 1} width={1000} height={1.02} fill={COLOURS[s.k - 1]}
              style={{ transform: `scaleX(${painted ? (structured ? s.ff : s.f) : 0})`, transitionDelay: delay(s.k) }} />))}
        </svg>
        {/* Canvas grain: drawn once as an image, so it costs nothing as the stripes move. */}
        <div aria-hidden className="canvas-grain absolute inset-0 pointer-events-none" />
        {ready && (
          <div data-needle aria-hidden className="canvas-needle absolute top-0 bottom-0 pointer-events-none" style={{ left: needleLeft, opacity: phase === 2 || picked != null ? 1 : 0 }}>
            <div className="absolute top-0 bottom-0 -translate-x-1/2" style={{ width: 2, background: 'var(--color-ink)', boxShadow: '0 0 0 1px var(--color-canvas)' }} />
            <div className="absolute -translate-x-1/2 rounded-full" style={{ top: 4, width: picked != null ? 12 : 10, height: picked != null ? 12 : 10, background: 'var(--color-ink)', boxShadow: '0 0 0 2px var(--color-canvas)' }} />
          </div>)}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[0.74rem] leading-none tnum" style={{ color: 'var(--color-ink-faint)' }}>
        <span>{first}</span>
        <span data-canvas-drop aria-hidden className="truncate" style={{ color: picked != null ? 'var(--color-ink)' : 'var(--color-ink-dim)', fontWeight: picked != null ? 600 : 400 }}>{picked != null ? reading : resting}</span>
        <span>{last}</span>
      </div>
      {/* The wall label. */}
      <div className="mt-1 flex items-baseline justify-between gap-3 text-[0.74rem] leading-tight" style={{ color: 'var(--color-ink-faint)' }}>
        <span className="italic">100 futures, one stripe each</span>
        <span className="tnum shrink-0" data-canvas-end>{ready ? <><b className="text-[0.86rem] not-italic" style={{ color: accent }}>{reach}</b> of 100 reach {last}</> : '…'}</span>
      </div>
    </div>
  );
}
