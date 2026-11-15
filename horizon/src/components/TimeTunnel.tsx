import { useEffect, useRef, useState } from 'react';
import type { MC } from '../engine/engine';
import { fmt } from '../lib/format';
import type { LifeEvent } from '../lib/lifeEvents';

/**
 * The time tunnel: the home's one picture (15 November 2026, after the road
 * ahead, which the owner liked but found "too crushed", and a request for "a
 * tunnel where you can see the life interactions happening").
 *
 * You stand at the day work stops and look down a corridor of years. A frame
 * every five years recedes to the plan age; beyond it the corridor opens into
 * light, because life does not stop at the plan age. The corners run to one
 * vanishing point, so the frames nest like a tesseract drawn on paper.
 *
 *   ┌──────────────────────────────────────┐   signs hang where life changes:
 *   │╲ 67 · Your State Pension starts     ╱│   an income starting, an ISA or a
 *   │  ╲┌──────────────────────────────┐╱  │   pot running out, a partner
 *   │   │╲ ┌──────────────────────┐   ╱│   │   stopping work, the plan's own
 *   │   │  │      ┌────────┐      │    │   │   events, the first shortfall
 *   │   │  │      │ light  │      │    │   │
 *   │   │  │      └────────┘ 90   │    │   │   the floor is the 100 futures:
 *   │   │ ╱└──────▓▓▓▓▓▓▓▓──────┘70 ╲│   │   its bright lane is the share
 *   │  ╱└───▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓──────┘ 65╲ │   still paying the ask in full,
 *   │╱▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╲│   pale amber with the rules, grey short
 *   └──────────────────────────────────────┘
 *
 * Across each year's stretch of floor, the bright lane's share of the floor's
 * width is the share of futures still paying in full; perspective scales a
 * whole stretch at once, so the share reads the same near and far. Nothing
 * is measured along the corridor, and the years are spaced evenly down it.
 *
 * Travel: swipe up (or tap a depth, or use the arrow keys) and you move down
 * the corridor; the frames and signs come towards you and pass, and the
 * floor at your feet is the year you have reached. Escape or Home goes back.
 * Motion only follows what the person does (450 ms; reduced motion jumps).
 * Nothing plays on its own.
 */
const S_END = 0.13;   // the plan age's frame, as a share of the frame at your feet

function useMeasured() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => setBox({ w: Math.floor(el.clientWidth), h: Math.floor(el.clientHeight) });
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el); window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return [ref, box] as const;
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

/** Ease the drawn counts to new values over 300 ms (resampled if the number of years changed). */
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

const r1 = (v: number) => Math.round(v * 10) / 10;

export default function TimeTunnel({ mc, structured, fromAge, toAge, ask, events, summary, resting }: {
  mc: MC | null; structured: boolean; fromAge: number; toAge: number; ask: number; events: LifeEvent[];
  summary: string; resting: string;
}) {
  const reduced = useReducedMotion();
  const [boxRef, { w, h }] = useMeasured();
  const held = mc?.perAgeHeld;
  const ready = !!(held && held.length);
  const n = ready ? held!.length : Math.max(1, toAge - fromAge + 1);
  const first = ready ? held![0].age : fromAge, last = ready ? held![n - 1].age : toAge;
  const full = ready ? held!.map(hh => Math.round(hh.full * 100)) : [];
  const rules = ready ? held!.map((hh, i) => Math.max(full[i], Math.round(hh.rules * 100))) : [];
  const firstShort = ready ? held!.find((_h, i) => (structured ? rules : full)[i] < 100)?.age : undefined;
  const firstTrim = ready && structured ? held!.find((_h, i) => full[i] < rules[i])?.age : undefined;
  const eased = useEased(ready ? [...full, ...(structured ? rules : full)] : [], reduced);
  const settledLen = eased.length === 2 * n && eased.every(Number.isFinite);
  const shownFull = !ready ? [] : settledLen ? eased.slice(0, n) : full;
  const shownRules = !ready ? [] : settledLen ? eased.slice(n, 2 * n) : (structured ? rules : full);

  // ── Where you stand: the camera, in years from the stop age ────────────
  const [picked, setPicked] = useState<number | null>(null);
  const [cam, setCam] = useState(0);                      // years travelled (fractional while moving)
  const camRef = useRef(0), raf = useRef(0);
  const travelTo = (years: number, instant = false) => {
    cancelAnimationFrame(raf.current);
    const to = Math.max(0, Math.min(n - 1, years)), from = camRef.current;
    if (instant || reduced || Math.abs(to - from) < 0.01) { camRef.current = to; setCam(to); return; }
    const t0 = performance.now();
    const step = (t: number) => {
      const f = Math.min(1, (t - t0) / 450), e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
      const v = from + (to - from) * e; camRef.current = v; setCam(v);
      if (f < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const pick = (age: number | null, instant = false) => {
    const a = age == null ? null : Math.max(first, Math.min(last, Math.round(age)));
    setPicked(a); travelTo(a == null ? 0 : a - first, instant);
  };
  useEffect(() => { if (picked != null && (picked < first || picked > last)) pick(null, true); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, last]);

  // ── The corridor, in px ─────────────────────────────────────────────────
  const cx = w / 2, vy = Math.round(h * 0.42);
  const c = cam / n;                                        // the camera, in the corridor's 0..1
  const span = Math.max(1e-6, 1 - c);
  const sAt = (t: number) => 1 - (1 - S_END) * ((t - c) / span);   // 1 at your feet, S_END at the plan age
  const fr = (s: number) => ({ l: cx - s * cx, r: cx + s * (w - cx), t: vy - s * vy, b: vy + s * (h - vy) });
  const tOfYear = (i: number) => (i + 0.5) / n;
  const tOfAge = (a: number) => (a - first) / n;           // the start of that year's stretch
  const far = fr(S_END);
  // A lane on the floor: at every year still ahead, a band centred on the floor whose share of its width is the count.
  const countAt = (counts: number[], t: number) => {
    const x = t * n - 0.5, i = Math.max(0, Math.min(n - 1, Math.floor(x))), j = Math.min(n - 1, i + 1), f = Math.max(0, Math.min(1, x - i));
    return counts[i] + (counts[j] - counts[i]) * f;
  };
  const lane = (counts: number[]) => {
    if (!ready || w <= 0) return '';
    const pts: [number, number][] = [[c, c === 0 ? counts[0] : countAt(counts, c)], ...counts.map((k, i) => [tOfYear(i), k] as [number, number]).filter(([t]) => t > c + 1e-6), [1, counts[n - 1]]];
    const left = pts.map(([t, k]) => { const f = fr(sAt(t)); return `${r1(cx - (cx - f.l) * k / 100)},${r1(f.b)}`; });
    const right = pts.slice().reverse().map(([t, k]) => { const f = fr(sAt(t)); return `${r1(cx + (f.r - cx) * k / 100)},${r1(f.b)}`; });
    return [...left, ...right].join(' ');
  };
  const floor = `0,${h} ${r1(far.l)},${r1(far.b)} ${r1(far.r)},${r1(far.b)} ${w},${h}`;

  // Frames: every fifth birthday still ahead, and the plan age.
  const every = n > 36 ? 10 : 5;   // no more than about seven frames
  const frameAges = ready ? [...Array.from({ length: 30 }, (_, k) => Math.ceil((first + 1) / every) * every + every * k).filter(a => a < last && a - first > cam + 0.05), last + 1] : [];
  const frameOf = (a: number) => (a === last + 1 ? S_END : sAt(tOfAge(a)));

  // Signs: the life events still ahead, and the first shortfall or trim.
  const shortSign = firstShort != null ? { age: firstShort, label: 'short', kind: 'short' as const }
    : firstTrim != null ? { age: firstTrim, label: 'trim', kind: 'trim' as const } : null;
  const allSigns = events.filter(e => e.age > first && e.age <= last);
  const markT = shortSign && shortSign.age > first && tOfAge(shortSign.age) > c ? tOfAge(shortSign.age) : null;
  const [used, setUsed] = useState(false);
  const placed: { e: (typeof allSigns)[number]; x: number; y: number; size: number; side: 'l' | 'r'; s: number; box: { x0: number; x1: number; y0: number; y1: number } }[] = [];
  allSigns.forEach((e, k) => {
    const t = tOfYear(e.age - first); if (t <= c + 0.2 / n) return;
    const s = sAt(t), f = fr(s), side: 'l' | 'r' = k % 2 ? 'r' : 'l';
    const size = Math.max(10, Math.min(15, 15 * Math.pow(s, 0.45)));
    const y = f.t + 5 + 4 * s, x = side === 'l' ? f.l + 6 + 6 * s : f.r - 6 - 6 * s;
    const wide = Math.min(size * 0.56 * (String(e.age).length + 3 + e.label.length) + 18, Math.abs(x - (side === 'l' ? f.r : f.l)) - 8);
    const box = { x0: side === 'l' ? x : x - wide, x1: side === 'l' ? x + wide : x, y0: y, y1: y + size * 1.35 + 4 };
    // A sign that would overlap a nearer one waits until you come closer.
    if (wide < 70 || placed.some(p => box.x0 < p.box.x1 + 4 && p.box.x0 < box.x1 + 4 && box.y0 < p.box.y1 + 3 && p.box.y0 < box.y1 + 3)) return;
    placed.push({ e, x, y, size, side, s, box });
  });
  // The hint gives way to life: top right if that is clear, else top left, else not at all.
  const clear = (b: { x0: number; x1: number; y0: number; y1: number }) => !placed.some(p => b.x0 < p.box.x1 + 4 && p.box.x0 < b.x1 + 4 && b.y0 < p.box.y1 + 3 && p.box.y0 < b.y1 + 3);
  const hintSide = used || !ready || w <= 0 ? null : clear({ x0: w - 158, x1: w - 8, y0: 6, y1: 30 }) ? 'r' : clear({ x0: 8, x1: 158, y0: 6, y1: 30 }) ? 'l' : null;

  // ── Touch and keys ──────────────────────────────────────────────────────
  const sceneRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; cam: number; moved: boolean } | null>(null);
  const ageAtY = (y: number) => {
    const el = sceneRef.current; if (!el) return first;
    const b = el.getBoundingClientRect(), yy = y - b.top;
    const s = yy >= vy ? (yy - vy) / Math.max(1, h - vy) : (vy - yy) / Math.max(1, vy);
    const t = c + (1 - Math.max(S_END, Math.min(1, s))) / (1 - S_END) * span;
    return first + Math.max(0, Math.min(n - 1, Math.floor(t * n)));
  };
  const onDown = (e: React.PointerEvent) => {
    if (!ready) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, cam: camRef.current, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !e.buttons) return;
    const dy = d.y - e.clientY;                           // up is forward
    if (!d.moved && Math.abs(dy) < 6) return;
    d.moved = true; setUsed(true);
    const years = d.cam + dy / Math.max(6, (h * 0.9) / n);
    const a = Math.max(0, Math.min(n - 1, years));
    travelTo(a, true); setPicked(first + Math.round(a));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null; if (!d || !ready) return;
    if (d.moved) { pick(first + Math.round(camRef.current)); return; }
    setUsed(true); pick(ageAtY(e.clientY));
  };
  useEffect(() => {
    if (picked == null) return;
    const away = (e: PointerEvent) => { if (sceneRef.current && !sceneRef.current.contains(e.target as Node)) pick(null); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);
  const age = picked ?? last, idx = Math.max(0, Math.min(n - 1, age - first));
  const onKey = (e: React.KeyboardEvent) => {
    if (!ready) return;
    const step = ({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 } as Record<string, number>)[e.key];
    if (e.key === 'Escape') { if (picked != null) { pick(null); e.preventDefault(); } return; }
    if (e.key === 'Home' || e.key === 'End') { pick(e.key === 'Home' ? first : last); e.preventDefault(); return; }
    if (step) { pick((picked ?? (step > 0 ? first - 1 : last + 1)) + step); e.preventDefault(); }
  };
  const valuetext = !ready ? 'Working out the futures'
    : `Age ${age}: ${full[idx]} of 100 futures still pay ${fmt(ask)} a month in full${structured ? `, ${rules[idx]} still paying with your rules` : ''}`;

  const ink = (pct: number) => `color-mix(in srgb, var(--color-ink) ${pct}%, transparent)`;
  const lit = 'var(--color-ring)';
  const shade = 'color-mix(in srgb, var(--color-ring) 34%, var(--color-canvas))';
  const mist = 'color-mix(in srgb, var(--color-slate) 30%, var(--color-canvas))';
  const signColour = (k: string) => k === 'in' ? 'var(--color-ring)' : k === 'out' ? 'var(--color-slate)' : 'var(--color-ink-dim)';

  return (
    <div data-tunnel data-ready={ready ? '1' : '0'} data-first={first} data-last={last} data-years={n}
      data-full-counts={full.join(',')} data-rules={structured ? rules.join(',') : ''} data-first-short={firstShort ?? ''} data-first-trim={firstTrim ?? ''}
      data-age={picked ?? ''} data-horizon={vy} data-cam={Math.round(cam * 100) / 100}
      className="flex-1 min-h-[200px] [@media(min-height:680px)]:min-h-[260px] max-h-[560px] flex flex-col mt-2 -mx-4 sm:mx-0">
      <span id="tunnel-summary" className="sr-only">{summary}</span>
      <div ref={boxRef} className="relative flex-1 min-h-0">
        <div ref={sceneRef} role="slider" tabIndex={ready ? 0 : -1} aria-label="Futures still paying, by age" aria-describedby="tunnel-summary"
          aria-valuemin={first} aria-valuemax={last} aria-valuenow={age} aria-valuetext={valuetext} onKeyDown={onKey}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; }}
          className="absolute inset-0 sm:rounded-3xl overflow-hidden outline-none select-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-calm)]"
          style={{ touchAction: 'none', cursor: ready ? 'grab' : 'default' }}>
          {w > 0 && h > 0 && (
            <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 block">
              <defs>
                <linearGradient id="tn-wall-l" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--color-slate) 13%, var(--color-canvas))' }} />
                  <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--color-slate) 5%, var(--color-canvas))' }} />
                </linearGradient>
                <linearGradient id="tn-wall-r" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--color-slate) 13%, var(--color-canvas))' }} />
                  <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--color-slate) 5%, var(--color-canvas))' }} />
                </linearGradient>
                <linearGradient id="tn-ceil" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--color-slate) 9%, var(--color-canvas))' }} />
                  <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--color-slate) 3%, var(--color-canvas))' }} />
                </linearGradient>
                <radialGradient id="tn-light" cx="0.5" cy="0.62" r="0.75">
                  <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--color-ring) 16%, var(--color-canvas))' }} />
                  <stop offset="1" style={{ stopColor: 'var(--color-canvas)' }} />
                </radialGradient>
                <linearGradient id="tn-haze" gradientUnits="userSpaceOnUse" x1="0" y1={far.b} x2="0" y2={h}>
                  <stop offset="0" style={{ stopColor: 'var(--color-canvas)', stopOpacity: 0.45 }} />
                  <stop offset="0.55" style={{ stopColor: 'var(--color-canvas)', stopOpacity: 0.08 }} />
                  <stop offset="1" style={{ stopColor: 'var(--color-canvas)', stopOpacity: 0 }} />
                </linearGradient>
                <linearGradient id="tn-near" gradientUnits="userSpaceOnUse" x1="0" y1={vy + (h - vy) * 0.55} x2="0" y2={h}>
                  <stop offset="0" style={{ stopColor: '#000', stopOpacity: 0 }} />
                  <stop offset="1" style={{ stopColor: '#000', stopOpacity: 0.1 }} />
                </linearGradient>
              </defs>
              {/* Ceiling and walls, lit from the far end. */}
              <polygon points={`0,0 ${w},0 ${r1(far.r)},${r1(far.t)} ${r1(far.l)},${r1(far.t)}`} fill="url(#tn-ceil)" />
              <polygon points={`0,0 ${r1(far.l)},${r1(far.t)} ${r1(far.l)},${r1(far.b)} 0,${h}`} fill="url(#tn-wall-l)" />
              <polygon points={`${w},0 ${r1(far.r)},${r1(far.t)} ${r1(far.r)},${r1(far.b)} ${w},${h}`} fill="url(#tn-wall-r)" />
              {/* Beyond the plan age: light. */}
              <rect x={far.l} y={far.t} width={far.r - far.l} height={far.b - far.t} fill="url(#tn-light)" />
              {/* The floor: the 100 futures, year by year. */}
              <polygon data-lane="road" points={floor} style={{ fill: ready ? mist : ink(6) }} />
              {ready && structured && <polygon data-lane="rules" points={lane(shownRules)} style={{ fill: shade }} />}
              {ready && <polygon data-lane="full" points={lane(shownFull)} style={{ fill: lit }} />}
              <polygon points={floor} fill="url(#tn-haze)" />
              <polygon points={floor} fill="url(#tn-near)" />
              {/* Where the first future falls short (or the rules first trim): a line across the floor. */}
              {markT != null && (() => { const f = fr(sAt(markT)); return <line data-notch-line x1={f.l} x2={f.r} y1={f.b} y2={f.b} style={{ stroke: ink(45) }} strokeWidth={r1(0.8 + sAt(markT))} strokeDasharray="4 3" />; })()}
              {/* The corners, to one vanishing point. */}
              {[[0, 0, far.l, far.t], [w, 0, far.r, far.t], [0, h, far.l, far.b], [w, h, far.r, far.b]].map(([x1, y1, x2, y2], k) => (
                <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: ink(14) }} strokeWidth="1" />))}
              {/* A frame every five years. */}
              {frameAges.map(a => { const s = frameOf(a), f = fr(s); return (
                <rect key={a} data-frame={a} x={r1(f.l)} y={r1(f.t)} width={r1(f.r - f.l)} height={r1(f.b - f.t)} rx={r1(10 * s)}
                  fill="none" style={{ stroke: a === last + 1 ? ink(26) : ink(17) }} strokeWidth={r1(0.8 + 1.4 * s)} />); })}
            </svg>)}
          {/* Ages, at the foot of each frame's right side. */}
          {w > 0 && frameAges.map(a => { const s = frameOf(a), f = fr(s), size = Math.max(10, Math.min(14, 14 * Math.pow(s, 0.4))); const shown = a === last + 1 ? last : a; return (
            <span key={a} aria-hidden {...(a === last + 1 ? { 'data-tunnel-end': '' } : {})} className="absolute tnum leading-none font-semibold -translate-x-full -translate-y-full"
              style={{ left: f.r - 4 - 2 * s, top: f.b - 4 - 2 * s, fontSize: size, color: 'var(--color-ink-dim)' }}>{shown}</span>); })}
          {/* Life, where it changes. */}
          {placed.map(p => (
            <span key={`${p.e.age}-${p.e.label}`} aria-hidden data-event={p.e.kind} data-event-age={p.e.age} 
              className={`absolute leading-tight rounded-md px-1.5 py-0.5 whitespace-nowrap ${p.side === 'r' ? '-translate-x-full' : ''}`}
              style={{ left: p.x, top: p.y, fontSize: p.size, maxWidth: p.box.x1 - p.box.x0, overflow: 'hidden', textOverflow: 'ellipsis',
                background: 'color-mix(in srgb, var(--color-canvas) 88%, transparent)', borderLeft: `3px solid ${signColour(p.e.kind)}`, color: 'var(--color-ink)', boxShadow: `0 1px ${r1(2 + 4 * p.s)}px ${ink(10)}` }}>
              <b className="tnum">{p.e.age}</b> · {p.e.label}
            </span>))}
          {markT != null && shortSign && (() => { const s2 = sAt(markT), f = fr(s2), size = Math.max(10, Math.min(13, 13 * Math.pow(s2, 0.4))); return (
            <span aria-hidden data-notch data-event={shortSign.kind} data-event-age={shortSign.age} className="absolute leading-none font-semibold whitespace-nowrap -translate-y-full rounded px-1 py-0.5"
              style={{ left: f.l + 6 + 10 * s2, top: f.b - 3, fontSize: size, color: 'var(--color-ink)', background: 'color-mix(in srgb, var(--color-canvas) 80%, transparent)' }}>{shortSign.kind === 'short' ? `short from ${shortSign.age}` : `trims from ${shortSign.age}`}</span>); })()}
          {/* Where you are, while travelling. */}
          {picked != null && ready && (
            <span aria-hidden data-tunnel-here className="absolute left-1/2 -translate-x-1/2 bottom-2 rounded-full px-3 py-1 text-[0.8rem] font-bold tnum whitespace-nowrap"
              style={{ background: 'var(--color-ink)', color: 'var(--color-canvas)' }}>Age {age}</span>)}
          {hintSide && picked == null && (
            <span aria-hidden data-tunnel-hint className={`absolute ${hintSide === 'r' ? 'right-2' : 'left-2'} top-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold whitespace-nowrap pointer-events-none`}
              style={{ background: 'color-mix(in srgb, var(--color-canvas) 90%, transparent)', color: 'var(--color-ink-dim)', boxShadow: `0 1px 4px ${ink(12)}` }}>Swipe up to travel ↑</span>)}
        </div>
      </div>
      {/* Under it: how short the bad futures are, or the age you have reached. */}
      <p data-tunnel-reading className="mt-1.5 px-4 sm:px-0 text-center text-[0.84rem] leading-snug min-h-[2.6em]" style={{ color: picked != null ? 'var(--color-ink)' : 'var(--color-ink-dim)' }}>
        <span data-tunnel-text className={picked != null ? 'font-semibold' : ''}>{picked != null && ready
          ? `At ${age}: ${full[idx]} of 100 futures still pay ${fmt(ask)} a month in full${structured && rules[idx] > full[idx] ? `; ${rules[idx]} still paying with your rules` : ''}.`
          : resting}</span>
      </p>
    </div>
  );
}
