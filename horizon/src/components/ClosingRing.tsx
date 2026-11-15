import { useEffect, useRef, useState } from 'react';
import type { MC } from '../engine/engine';
import { fmt } from '../lib/format';

/**
 * The closing ring: the home's one picture, from the design research of
 * 15 November 2026 ("Showing one retirement answer on a phone").
 *
 * One thick ring runs once round, clockwise from 12 o'clock (the age work
 * stops) to just short of 12 o'clock again (the plan age). It never quite
 * closes: the end tapers into a faint full track, because a closed ring
 * would read as a guarantee and life does not stop at the plan age.
 *
 *            60 ●━━━━━━━━━━╮ 90
 *          ╭               ┃         solid and crisp: nearly every future
 *          ┃    £5,720     ┃         still pays in full at that age
 *          ┃ a month after ┃
 *          ┃ £720 to spare ┃         softer and fainter: fewer do
 *          ╰ ─ ─ ─ ─ ─ ─ ─ ╯
 *
 * How sure: the stroke's clarity at each age follows the number of futures
 * (of 100) still paying in full there: 100 → solid, 90 → 70%, 70 → 45%,
 * 40 or fewer → 20% (never invisible, never black: a shortfall is not
 * nothing). As the count falls the edge also softens, which people read as
 * uncertainty without a legend (MacEachren et al. 2012); giving uncertain
 * values less visual range makes people weigh them properly (Correll,
 * Moritz and Heer 2018). There is no hard boundary to feel safe inside (the
 * hurricane cone's error).
 *
 * How much is in words in the centre, never drawn: the monthly figure the
 * plan can pay, and the gap to the ask. The stroke width is constant except
 * on a structured plan, where it narrows in the years its rules trim
 * spending in many futures ("spending a bit less"), and its clarity then
 * follows the futures still paying after the trims.
 *
 * A small notch on the outside marks the first shortfall. Touch the ring, or
 * focus it and use the arrow keys, to read any age. Motion only follows a
 * change the person made: the ring eases to its new shape over 300 ms;
 * reduced motion changes it at once. Nothing plays on its own.
 *
 * Drawing: two layers of the ring share conic gradients (one stop a year):
 * a crisp layer and a feathered (soft-edged) layer, cross-faded by how sure
 * each age is. Masks cut the ring shape; nesting a wide and a narrow ring
 * under complementary angular masks makes the structured narrowing.
 */
const GAP_DEG = 16;        // the unclosed part at the top, so the end never meets the start
const TAPER_DEG = 10;      // the end fades into the track over this arc

export const clarityOf = (c: number) => {
  // 100 → 1, 90 → 0.70, 70 → 0.45, ≤40 → 0.20 (piecewise linear)
  if (c >= 100) return 1;
  if (c >= 90) return 0.7 + (c - 90) * 0.03;
  if (c >= 70) return 0.45 + (c - 70) * 0.0125;
  if (c >= 40) return 0.2 + (c - 40) * (0.25 / 30);
  return 0.2;
};
export const softnessOf = (c: number) => Math.max(0, Math.min(1, (100 - c) / 60));

function useMeasuredSide() {
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => setSide(Math.floor(Math.min(el.clientWidth, el.clientHeight)));
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el); window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return [ref, side] as const;
}

function useReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)'); const on = () => setR(m.matches);
    m.addEventListener?.('change', on); return () => m.removeEventListener?.('change', on);
  }, []);
  return r;
}

/** Ease the drawn counts to their new values over 300 ms (resampled if the number of years changed). */
function useEased(target: number[], reduced: boolean) {
  const [shown, setShown] = useState(target);
  const from = useRef(target), raf = useRef(0), key = target.join(',');
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const start = from.current;
    if (reduced || !start.length || start.join(',') === key) { from.current = target; setShown(target); return; }
    const sample = (arr: number[], i: number, n: number) => arr[Math.min(arr.length - 1, Math.round(i * (arr.length - 1) / Math.max(1, n - 1)))];
    const t0 = performance.now();
    const step = (t: number) => {
      const f = Math.min(1, (t - t0) / 300), e = 1 - Math.pow(1 - f, 3);
      const cur = target.map((v, i) => sample(start, i, target.length) + (v - sample(start, i, target.length)) * e);
      setShown(cur); from.current = cur;
      if (f < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced]);
  return shown;
}

const ringMask = (rIn: number, rOut: number, feather: number) =>
  `radial-gradient(circle at 50% 50%, transparent ${rIn - feather}px, #000 ${rIn + feather}px, #000 ${rOut - feather}px, transparent ${rOut + feather}px)`;
const masked = (m: string): React.CSSProperties => ({ maskImage: m, WebkitMaskImage: m, maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' });

export default function ClosingRing({ mc, structured, fromAge, toAge, ask, summary, resting, onSeeFutures, children }: {
  mc: MC | null; structured: boolean; fromAge: number; toAge: number; ask: number;
  summary: string; resting: string; onSeeFutures?: () => void; children?: (side: number) => React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const [boxRef, side] = useMeasuredSide();
  const held = mc?.perAgeHeld;
  const ready = !!(held && held.length);
  const n = ready ? held!.length : Math.max(1, toAge - fromAge + 1);
  const first = ready ? held![0].age : fromAge, last = ready ? held![n - 1].age : toAge;
  const full = ready ? held!.map(h => Math.round(h.full * 100)) : [];
  const rules = ready ? held!.map((h, i) => Math.max(full[i], Math.round(h.rules * 100))) : [];
  const counts = structured ? rules : full;                       // what the clarity follows
  const firstShort = ready ? held!.find((_h, i) => counts[i] < 100)?.age : undefined;
  const firstTrim = ready && structured ? held!.find((_h, i) => full[i] < rules[i])?.age : undefined;
  const target = ready ? [...counts, ...(structured ? counts.map((c, i) => Math.max(0, Math.min(1, (c - full[i]) / 30))) : [])] : [];
  const eased = useEased(target, reduced);
  const shownCounts = ready ? eased.slice(0, n) : [];
  const shownNarrow = ready && structured ? eased.slice(n, 2 * n) : [];

  // Geometry, in px, from the measured side.
  const R = Math.max(0, side / 2 - 8);                           // room for the soft edge
  const wide = Math.max(10, side * 0.11), narrow = wide * 0.62;
  const mid = R - wide / 2;
  const span = 360 - GAP_DEG;
  const angleOf = (i: number) => ((i + 0.5) / n) * span;

  // Conic gradients: one stop a year, plus the taper into the track.
  const colourAt = (alpha: number) => `color-mix(in srgb, var(--color-ring) ${Math.round(alpha * 1000) / 10}%, transparent)`;
  const conic = (alphaOf: (c: number) => number) => {
    if (!ready) return 'none';
    const stops = shownCounts.map((c, i) => `${colourAt(alphaOf(c))} ${angleOf(i).toFixed(2)}deg`);
    const end = alphaOf(shownCounts[n - 1]);
    return `conic-gradient(from 0deg at 50% 50%, ${colourAt(alphaOf(shownCounts[0]))} 0deg, ${stops.join(', ')}, ${colourAt(end)} ${(span - TAPER_DEG).toFixed(2)}deg, ${colourAt(0)} ${span}deg, ${colourAt(0)} 360deg)`;
  };
  const crisp = conic(c => clarityOf(c) * (1 - softnessOf(c)));
  const soft = conic(c => clarityOf(c) * softnessOf(c));
  const angular = (w: (i: number) => number) => ready
    ? `conic-gradient(from 0deg at 50% 50%, ${shownCounts.map((_c, i) => `rgba(0,0,0,${w(i).toFixed(3)}) ${angleOf(i).toFixed(2)}deg`).join(', ')}, rgba(0,0,0,${w(n - 1).toFixed(3)}) 360deg)`
    : 'none';

  const layerPair = (width: number) => {
    const rOut = mid + width / 2, rIn = mid - width / 2;
    return (<>
      <div className="absolute inset-0" style={{ background: crisp, ...masked(ringMask(rIn, rOut, 0.6)) }} />
      <div className="absolute inset-0" style={{ background: soft, ...masked(ringMask(rIn + 2, rOut - 2, 5)) }} />
    </>);
  };

  // Reading an age by touch or keys.
  const [picked, setPicked] = useState<number | null>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pickAt = (x: number, y: number) => {
    const el = ringRef.current; if (!el || !ready) return;
    const b = el.getBoundingClientRect();
    let a = (Math.atan2(x - (b.left + b.width / 2), -(y - (b.top + b.height / 2))) * 180) / Math.PI;
    if (a < 0) a += 360;
    setPicked(first + Math.max(0, Math.min(n - 1, Math.floor((Math.min(a, span) / span) * n))));
  };
  useEffect(() => {
    if (picked == null) return;
    const away = (e: PointerEvent) => { if (ringRef.current && !ringRef.current.contains(e.target as Node)) setPicked(null); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [picked]);
  useEffect(() => { if (picked != null && (picked < first || picked > last)) setPicked(null); }, [first, last, picked]);
  const age = picked ?? last, idx = Math.max(0, Math.min(n - 1, age - first));
  const onKey = (e: React.KeyboardEvent) => {
    if (!ready) return;
    const step = ({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 } as Record<string, number>)[e.key];
    if (e.key === 'Escape') { if (picked != null) { setPicked(null); e.preventDefault(); } return; }
    if (e.key === 'Home' || e.key === 'End') { setPicked(e.key === 'Home' ? first : last); e.preventDefault(); return; }
    if (step) { setPicked(Math.max(first, Math.min(last, age + step))); e.preventDefault(); }
  };
  const valuetext = !ready ? 'Working out the futures'
    : `Age ${age}: ${full[idx]} of 100 futures still pay ${fmt(ask)} a month in full${structured ? `, ${rules[idx]} still paying with your rules` : ''}`;

  // Small marks: the start cap, the first-shortfall notch, the age labels.
  const pos = (deg: number, r: number) => ({ x: side / 2 + r * Math.sin((deg * Math.PI) / 180), y: side / 2 - r * Math.cos((deg * Math.PI) / 180) });
  const notchAge = firstShort ?? firstTrim;
  const notch = notchAge != null ? pos(angleOf(notchAge - first) - (span / n) / 2, R + 4) : null;
  const pickMark = picked != null ? pos(angleOf(idx), mid) : null;
  const capAlpha = ready ? clarityOf(shownCounts[0]) : 0.2;

  return (
    <div data-ring data-ready={ready ? '1' : '0'} data-first={first} data-last={last} data-years={n}
      data-counts={full.join(',')} data-rules={structured ? rules.join(',') : ''} data-first-short={firstShort ?? ''} data-first-trim={firstTrim ?? ''}
      data-age={picked ?? ''} className="flex-1 min-h-[200px] max-h-[460px] w-full flex flex-col">
      <span id="ring-summary" className="sr-only">{summary}</span>
      <div ref={boxRef} className="relative flex-1 min-h-0">
        <div ref={ringRef} role="slider" tabIndex={ready ? 0 : -1} aria-label="Futures still paying, by age" aria-describedby="ring-summary"
          aria-valuemin={first} aria-valuemax={last} aria-valuenow={age} aria-valuetext={valuetext} onKeyDown={onKey}
          onPointerDown={e => { if (!ready) return; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); pickAt(e.clientX, e.clientY); }}
          onPointerMove={e => { if (e.buttons) pickAt(e.clientX, e.clientY); }}
          className="absolute inset-0 m-auto rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-calm)]"
          style={{ width: side, height: side, touchAction: 'pan-y', cursor: ready ? 'pointer' : 'default' }}>
          {/* The track: the whole circle, faint, so the plan age always has a place and life goes on past it. */}
          <div aria-hidden className="absolute inset-0" style={{ background: 'color-mix(in srgb, var(--color-ink) 8%, transparent)', ...masked(ringMask(mid - wide / 2, mid + wide / 2, 0.6)) }} />
          {structured ? (<>
            <div aria-hidden className="absolute inset-0" style={masked(angular(i => 1 - (shownNarrow[i] ?? 0)))}>{layerPair(wide)}</div>
            <div aria-hidden className="absolute inset-0" style={masked(angular(i => shownNarrow[i] ?? 0))}>{layerPair(narrow)}</div>
          </>) : <div aria-hidden className="absolute inset-0">{layerPair(wide)}</div>}
          {/* The start cap: the day work stops. */}
          {ready && (() => { const w = structured && (shownNarrow[0] ?? 0) > 0.5 ? narrow : wide; return <div aria-hidden className="absolute rounded-full" style={{ left: side / 2 - w / 2, top: side / 2 - mid - w / 2, width: w, height: w, background: colourAt(capAlpha) }} />; })()}
          {notch && <div aria-hidden data-notch className="absolute rounded-full" style={{ left: notch.x - 2, top: notch.y - 2, width: 4, height: 4, background: 'var(--color-ink-dim)' }} />}
          {pickMark && <div aria-hidden className="absolute rounded-full" style={{ left: pickMark.x - wide * 0.32, top: pickMark.y - wide * 0.32, width: wide * 0.64, height: wide * 0.64, border: '2px solid var(--color-ink)', background: 'var(--color-canvas)' }} />}
          {/* The ages, just inside the ring either side of its opening at the top. */}
          {ready && (() => { const p60 = pos(9, mid - wide * 1.25), p90 = pos(span - 9, mid - wide * 1.25); return (<>
            <span aria-hidden data-ring-start className="absolute text-[0.78rem] tnum leading-none -translate-x-1/2 -translate-y-1/2" style={{ left: p60.x, top: p60.y, color: 'var(--color-ink-faint)' }}>{first}</span>
            <span aria-hidden data-ring-end className="absolute text-[0.78rem] tnum leading-none -translate-x-1/2 -translate-y-1/2" style={{ left: p90.x, top: p90.y, color: 'var(--color-ink-faint)' }}>{last}</span>
          </>); })()}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">{children?.(side)}</div>
        </div>
      </div>
      {/* Under the ring: how short the bad futures are, or the age you touched. */}
      <p data-ring-reading className="mt-1.5 text-center text-[0.84rem] leading-snug" style={{ color: picked != null ? 'var(--color-ink)' : 'var(--color-ink-dim)' }}>
        <span data-ring-text className={picked != null ? 'font-semibold' : ''}>{picked != null && ready
          ? `At ${age}: ${full[idx]} of 100 futures still pay ${fmt(ask)} a month in full${structured && rules[idx] > full[idx] ? `; ${rules[idx]} still paying with your rules` : ''}.`
          : resting}</span>
        {onSeeFutures && ready && <>{' '}<button type="button" data-see-futures onClick={onSeeFutures} className="underline inline-block min-h-[24px] font-semibold" style={{ color: 'var(--color-calm-strong)' }}>See 10 futures</button></>}
      </p>
    </div>
  );
}
