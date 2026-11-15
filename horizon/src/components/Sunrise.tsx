import { useEffect, useRef, useState } from 'react';
import type { MC } from '../engine/engine';

/**
 * The sunrise: the home's one picture, and the product's name drawn from the
 * plan's own numbers.
 *
 * A hundred fine lines rise over a horizon line. Each line is one of 100
 * simulated futures. It starts on the left, the year work stops, and sweeps
 * across the sky for as long as that future keeps paying. A future that pays
 * every year to the plan age reaches the horizon on the right. One that runs
 * short stops where it ran short, so a fragile plan has a thin, frayed sky
 * and a sound one has a whole sun.
 *
 *   100 futures,                                   69 of 100
 *   one line each          ·  ⌒⌒⌒⌒⌒  ·              reach 90
 *                      ⌒⌒⌒           ⌒⌒
 *   ─────────────────────────────────────────────────────────
 *   60            First shortfalls at 71                   90
 *
 * It is the same data as a survival chart, in a form people read correctly:
 * a count out of 100 as a picture (icon-array and quantile-dotplot research),
 * on the plan's own age line. The lines are `mc.perAgeHeld` turned on its
 * side: line k keeps going while at least k of 100 futures are still paid.
 * So the number of lines that reach the right-hand horizon IS the futures
 * count in the sentence underneath; they cannot disagree.
 *
 * The steadiest futures are the inner, golden lines; the most fragile are the
 * outer, blue ones, so what a plan loses first is the edge of its sky.
 *
 * A structured plan trims spending in bad years. Its lines are bright while a
 * future is paid in full and continue, fainter, while it is still paying once
 * the rules have trimmed.
 *
 * The needle (what was kept of the retired Horizon Dial): a meridian through
 * every line at one age. Press and slide across the sun, or focus it and use
 * the arrow keys, to read any age: "At 80: 84 of 100 still paying". The lines
 * it crosses are exactly the futures still paying that year. It rests on the
 * first age a future falls short (or, on a structured plan, is first
 * trimmed); Escape, or a tap elsewhere, puts it back.
 */
const N = 100, W = 360;

/** How far the sun clears the horizon, by the height of the screen. */
function useRise() {
  const pick = () => { const h = typeof window === 'undefined' ? 800 : window.innerHeight; return h <= 700 ? 66 : h < 820 ? 110 : 150; };
  const [rise, setRise] = useState(pick);
  useEffect(() => { const on = () => setRise(pick()); on(); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  return rise;
}

/** Gold at the centre, through rose and violet, to blue at the rim. */
function ringColour(k: number) {
  const t = (k - 1) / (N - 1), seg = Math.min(2, Math.floor(t * 3)), u = t * 3 - seg;
  return `color-mix(in oklab, var(--sun-${seg + 2}) ${Math.round(u * 100)}%, var(--sun-${seg + 1}))`;
}

export default function Sunrise({ mc, structured, fromAge, toAge, accent }: {
  mc: MC | null; structured: boolean; fromAge: number; toAge: number; accent: string;
}) {
  const rise = useRise(), flat = rise < 100;
  const held = mc?.perAgeHeld;
  const ready = !!(held && held.length);
  const n = ready ? held!.length : Math.max(1, toAge - fromAge + 1);
  const first = ready ? held![0].age : fromAge, last = ready ? held![n - 1].age : toAge;
  // Futures still paying each year, of 100 (never rises), and those paid in full.
  const use = ready ? held!.map(h => Math.round((structured ? h.rules : h.full) * 100)) : [];
  const full = ready ? held!.map((h, i) => Math.min(Math.round(h.full * 100), use[i])) : [];
  const yearsFor = (c: number[], k: number) => { let m = 0; while (m < c.length && c[m] >= k) m++; return m; };
  const rings = Array.from({ length: N }, (_, i) => {
    const k = i + 1, m = ready ? yearsFor(use, k) : 0, mf = ready ? yearsFor(full, k) : 0;
    return { k, years: m, f: m / n, fullYears: mf, ff: mf / n };
  });
  const reach = ready ? use[n - 1] : 0, reachFull = ready ? full[n - 1] : 0;
  const dropAt = ready ? held!.find((_h, i) => use[i] < 100)?.age : undefined;
  const trimAt = ready && structured ? held!.find((_h, i) => full[i] < use[i])?.age : undefined;

  // The sun is a circle whose centre sits below the horizon: what shows is
  // the part that has risen. `rise` is how far the rim clears the line.
  const R = ((W / 2) ** 2 + rise ** 2) / (2 * rise), below = R - rise, rMin = below + 5, pitch = (R - 0.6 - rMin) / (N - 1);
  const arc = (r: number) => { const a = Math.sqrt(Math.max(0, r * r - below * below)); return `M${(W / 2 - a).toFixed(2)} ${rise}A${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${(W / 2 + a).toFixed(2)} ${rise}`; };

  // Rise once, when the futures first arrive, from the centre outward; after
  // that the lines glide together to their new lengths as the plan changes.
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    if (!ready || phase !== 0) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase(1)));
    return () => cancelAnimationFrame(id);
  }, [ready, phase]);
  useEffect(() => { if (phase !== 1) return; const id = setTimeout(() => setPhase(2), 1700); return () => clearTimeout(id); }, [phase]);
  const risen = phase > 0, delay = (k: number) => (phase === 1 ? `${k * 6}ms` : '0ms');

  // The needle. Year i of n sits at fraction (i + 0.5) / n along every line,
  // so the meridian through those points crosses exactly the lines still
  // paying that year: use[i] of them.
  const [picked, setPicked] = useState<number | null>(null);      // an age, once the person has chosen one
  const restAt = dropAt ?? trimAt;                                // where the sky first frays
  const restIdx = ready ? (restAt != null ? restAt - first : n - 1) : 0;
  const idx = picked == null ? restIdx : Math.max(0, Math.min(n - 1, picked - first));
  const age = first + idx;
  const cy = rise + below;                                         // the sun's centre, below the horizon
  const at = (r: number, t: number) => { const phi = Math.acos(Math.min(1, below / r)), al = phi * (2 * t - 1); return [W / 2 + r * Math.sin(al), cy - r * Math.cos(al)]; };
  const tNeedle = (idx + 0.5) / n;
  const needle = Array.from({ length: 25 }, (_, j) => at(rMin - pitch + (R - rMin + pitch) * j / 24, tNeedle))
    .map(([x, y], j) => `${j ? 'L' : 'M'}${x.toFixed(2)} ${Math.min(rise, y).toFixed(2)}`).join('');
  const knob = at(R, tNeedle);
  const svgRef = useRef<SVGSVGElement>(null), boxRef = useRef<HTMLDivElement>(null), dragging = useRef(false);
  const pickAt = (clientX: number, clientY: number) => {
    const el = svgRef.current; if (!el || !ready) return;
    const b = el.getBoundingClientRect(), k = W / b.width;
    const x = (clientX - b.left) * k - W / 2, y = cy - (clientY - b.top) * k;
    const r = Math.max(rMin, Math.min(R, Math.hypot(x, y))), phi = Math.acos(Math.min(1, below / r));
    const al = Math.max(-phi, Math.min(phi, y <= 0 ? Math.sign(x) * phi : Math.atan2(x, y)));
    setPicked(first + Math.max(0, Math.min(n - 1, Math.floor(((al / phi + 1) / 2) * n))));
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
  const resting = !ready ? '' : structured && trimAt != null ? `Bright: paid in full. Faint: trimmed, from ${trimAt}`
    : dropAt != null ? `First shortfalls at ${dropAt}` : structured ? 'Paid in full in every one of them' : 'No shortfalls in any of them';
  const label = !ready ? 'Working out the futures, year by year.'
    : `A sunrise of 100 lines, one for each simulated future. A line crosses the sky for as long as that future is ${what}. ${reach} of 100 reach age ${last}.`
      + (dropAt != null ? ` The first fall short at age ${dropAt}.` : ' None falls short.')
      + (structured ? ` ${reachFull} of 100 are paid in full every year${trimAt != null ? `; the first trims come at age ${trimAt}` : ''}.` : '')
      + ' Use the arrow keys to read any age.';

  return (
    <div ref={boxRef} data-sunrise data-ready={ready ? '1' : '0'} data-reach={reach} data-first={first} data-last={last} data-years={n} data-age={ready ? age : ''}
      role="slider" tabIndex={ready ? 0 : -1} aria-label="Futures still paying, by age" aria-describedby="sunrise-summary"
      aria-valuemin={first} aria-valuemax={last} aria-valuenow={ready ? age : first} aria-valuetext={ready ? `Age ${age}: ${use[idx]} of 100 futures still paying${structured ? `, ${full[idx]} in full` : ' in full'}` : 'Working out the futures'}
      onKeyDown={onKey}
      className="relative mt-3 [@media(max-height:700px)]:mt-1.5 select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-calm)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-canvas)]">
      <span id="sunrise-summary" className="sr-only">{label}</span>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${rise + 1}`} className="block w-full h-auto" aria-hidden focusable="false"
        style={{ touchAction: 'pan-y', cursor: ready ? 'ew-resize' : 'default' }}
        onPointerDown={e => { if (!ready) return; dragging.current = true; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); pickAt(e.clientX, e.clientY); }}
        onPointerMove={e => { if (dragging.current) pickAt(e.clientX, e.clientY); }}
        onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
        {rings.map(r => (
          <path key={'g' + r.k} d={arc(rMin + (r.k - 1) * pitch)} fill="none" stroke="var(--color-ink)" strokeOpacity={0.075} strokeWidth={pitch * 0.5} />))}
        {structured && rings.map(r => (
          <path key={'t' + r.k} className="sun-ring" d={arc(rMin + (r.k - 1) * pitch)} pathLength={1} fill="none" stroke={ringColour(r.k)} strokeOpacity={0.45} strokeWidth={pitch * 0.62}
            style={{ strokeDasharray: `${risen ? r.f : 0} 1`, transitionDelay: delay(r.k) }} />))}
        {rings.map(r => (
          <path key={'r' + r.k} data-ring={r.k} data-years={r.years} data-f={r.f.toFixed(4)} data-full-years={r.fullYears} className="sun-ring" d={arc(rMin + (r.k - 1) * pitch)} pathLength={1} fill="none"
            stroke={ringColour(r.k)} strokeWidth={pitch * 0.62} style={{ strokeDasharray: `${risen ? (structured ? r.ff : r.f) : 0} 1`, transitionDelay: delay(r.k) }} />))}
        {/* The sun itself: the small disc the lines rise from. */}
        <path d={`${arc(rMin - pitch)}Z`} fill="var(--sun-1)" />
        <line x1={0} x2={W} y1={rise + 0.5} y2={rise + 0.5} stroke="var(--color-ink)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {/* The needle: a meridian through every line at the chosen age. */}
        {ready && (
          <g data-needle className="sun-needle" style={{ opacity: phase === 2 || picked != null ? 1 : 0 }}>
            <path d={needle} fill="none" stroke="var(--color-canvas)" strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" strokeOpacity={0.7} />
            <path d={needle} fill="none" stroke="var(--color-ink)" strokeWidth={1.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <circle cx={knob[0]} cy={Math.min(rise, knob[1])} r={picked != null ? 5 : 4} fill="var(--color-ink)" stroke="var(--color-canvas)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </g>)}
      </svg>
      {/* The corners of the sky are empty, so the two labels live there. */}
      <div className="absolute left-0 top-0 text-[0.72rem] leading-[1.15]" style={{ color: 'var(--color-ink-faint)' }}>{flat ? '100 futures' : <>100 futures,<br />one line each</>}</div>
      <div className="absolute right-0 top-0 text-right text-[0.72rem] leading-[1.15] tnum" style={{ color: 'var(--color-ink-faint)' }} data-sun-end>
        {ready ? <><b className="text-[0.86rem]" style={{ color: accent }}>{reach}</b> of 100{flat ? ' ' : <br />}reach {last}</> : '…'}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2 text-[0.74rem] leading-none tnum" style={{ color: 'var(--color-ink-faint)' }}>
        <span>{first}</span>
        <span data-sun-drop aria-hidden style={{ color: picked != null ? 'var(--color-ink)' : 'var(--color-ink-dim)', fontWeight: picked != null ? 600 : 400 }}>{picked != null ? reading : resting}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}
