import { useEffect, useRef, useState } from 'react';
import type { MC } from '../engine/engine';
import { fmt } from '../lib/format';

/**
 * The road ahead: the home's one picture (15 November 2026, replacing the
 * closing ring, which the owner found flat: "think in 3 dimensions").
 *
 * You stand on the day work stops; the road runs away from you towards the
 * horizon, one stretch a year, and reaches the plan age before the horizon.
 * Beyond it the road carries on into the haze, because life does not stop
 * at the plan age.
 *
 *                     £5,040              ← the answer sits in the sky
 *                 a month after tax
 *  ─────────────────────·───────────────  ← the horizon
 *                      ╱ ╲  90
 *                    ╱ ░▓░ ╲               bright lane: futures paying the
 *                  ╱ ░░▓▓▓░░ ╲             ask in full; pale amber: still
 *                ╱ ░░▓▓▓▓▓▓▓░░ ╲  70       paying once the plan's rules trim
 *              ╱ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ╲         spending; grey: short of the ask
 *            ╱▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╲ 60
 *
 * Why a road in depth rather than a flat chart: across the road, every
 * stretch is the 100 futures, so the share of the road's width that is lit
 * is the share of futures still paying in full at that age. Perspective
 * scales a whole stretch at once, so that share reads the same near and far
 * (a ratio across the road survives the projection; lengths along it do
 * not, which is why nothing is measured along the road). The near years are
 * big and the far years small, which is how sure we can be of them too;
 * the haze thickens towards the horizon for the same reason.
 *
 * How much is in words in the sky, never drawn: the monthly figure the plan
 * can pay and the gap to the ask. Few marks: one road, three tones, four
 * age labels and one notch at the first shortfall. Touch the road (or focus
 * it and use the keys) to read any age; a bar crosses the road there.
 * Motion only follows a change the person made (300 ms ease-out; reduced
 * motion changes at once). Nothing plays on its own.
 */
const S_END = 0.13;        // how wide the road still is at the plan age, as a share of its width at your feet

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

const r1 = (v: number) => Math.round(v * 10) / 10;

export default function RoadAhead({ mc, structured, fromAge, toAge, ask, summary, resting, onSeeFutures, children }: {
  mc: MC | null; structured: boolean; fromAge: number; toAge: number; ask: number;
  summary: string; resting: string; onSeeFutures?: () => void; children?: (fontSize: number) => React.ReactNode;
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
  const shownFull = ready ? eased.slice(0, n) : [], shownRules = ready ? eased.slice(n, 2 * n) : [];

  // ── The scene, in px from the measured box ─────────────────────────────
  const fontSize = Math.round(Math.max(30, Math.min(50, h * 0.15)));
  const horizon = Math.round(Math.min(h * 0.42, fontSize + 34));          // room in the sky for the answer
  const bottom = h, cx = w / 2;
  const nearW = Math.min(w * 0.64, 360);
  // How big a stretch looks at t (0 at your feet, 1 at the plan age). The
  // edges are straight lines to one vanishing point on the horizon, so the
  // width at any height is proportional to its distance below the horizon;
  // the years are spaced evenly down the road so the late ones stay readable.
  const sAt = (t: number) => 1 - (1 - S_END) * t;
  const yAt = (t: number) => horizon + (bottom - horizon) * sAt(t);
  const halfAt = (t: number) => (nearW / 2) * sAt(t);
  const tOfYear = (i: number) => (i + 0.5) / n;                            // the middle of year i's stretch
  // A lane: at every year, a band centred on the road whose share of the road's width is the count.
  const lane = (counts: number[]) => {
    if (!ready) return '';
    const pts: [number, number][] = [[0, counts[0]], ...counts.map((c, i) => [tOfYear(i), c] as [number, number]), [1, counts[n - 1]]];
    const left = pts.map(([t, c]) => `${r1(cx - halfAt(t) * c / 100)},${r1(yAt(t))}`);
    const right = pts.slice().reverse().map(([t, c]) => `${r1(cx + halfAt(t) * c / 100)},${r1(yAt(t))}`);
    return [...left, ...right].join(' ');
  };
  const road = `${r1(cx - halfAt(0))},${r1(yAt(0))} ${r1(cx - halfAt(1))},${r1(yAt(1))} ${r1(cx + halfAt(1))},${r1(yAt(1))} ${r1(cx + halfAt(0))},${r1(yAt(0))}`;
  const beyond = `${r1(cx - halfAt(1))},${r1(yAt(1))} ${r1(cx)},${r1(horizon)} ${r1(cx + halfAt(1))},${r1(yAt(1))}`;

  // ── Reading an age by touch or keys ────────────────────────────────────
  const [picked, setPicked] = useState<number | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const pickAt = (y: number) => {
    const el = sceneRef.current; if (!el || !ready || h <= 0) return;
    const b = el.getBoundingClientRect();
    const s = Math.max(S_END, Math.min(1, (y - b.top - horizon) / (bottom - horizon)));
    const t = (1 - s) / (1 - S_END);
    setPicked(first + Math.max(0, Math.min(n - 1, Math.floor(t * n))));
  };
  useEffect(() => {
    if (picked == null) return;
    const away = (e: PointerEvent) => { if (sceneRef.current && !sceneRef.current.contains(e.target as Node)) setPicked(null); };
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

  // ── Few marks: the ages beside the road, the notch, the bar you touched ─
  const labelAges = ready ? [first, ...Array.from({ length: 20 }, (_, k) => Math.ceil((first + 1) / 10) * 10 + k * 10).filter(a => a > first && a < last), last] : [];
  const labels: { age: number; y: number; x: number; size: number }[] = [];
  for (const a of labelAges) {
    const t = a === last ? 1 : tOfYear(a - first), y = yAt(t), size = Math.max(10.5, Math.min(13, 13 * Math.sqrt(sAt(t))));
    const prev = labels[labels.length - 1];
    if (prev && prev.y - y < size + 3) { if (a === last) labels.pop(); else continue; }
    labels.push({ age: a, y, x: cx + halfAt(t) + 6 + 4 * sAt(t), size });
  }
  const notchAge = firstShort ?? firstTrim;
  const notchT = notchAge != null ? (notchAge - first) / n : null;
  const barT = picked != null ? tOfYear(idx) : null;
  const ink = (pct: number) => `color-mix(in srgb, var(--color-ink) ${pct}%, transparent)`;
  const lit = 'var(--color-ring)';
  const shade = 'color-mix(in srgb, var(--color-ring) 34%, var(--color-canvas))';
  const mist = 'color-mix(in srgb, var(--color-slate) 30%, var(--color-canvas))';

  return (
    <div data-road data-ready={ready ? '1' : '0'} data-first={first} data-last={last} data-years={n}
      data-full-counts={full.join(',')} data-rules={structured ? rules.join(',') : ''} data-first-short={firstShort ?? ''} data-first-trim={firstTrim ?? ''}
      data-age={picked ?? ''} data-horizon={horizon} className="flex-1 min-h-[180px] [@media(min-height:680px)]:min-h-[240px] max-h-[480px] flex flex-col mt-2 -mx-4 sm:mx-0">
      <span id="road-summary" className="sr-only">{summary}</span>
      <div ref={boxRef} className="relative flex-1 min-h-0">
        <div ref={sceneRef} role="slider" tabIndex={ready ? 0 : -1} aria-label="Futures still paying, by age" aria-describedby="road-summary"
          aria-valuemin={first} aria-valuemax={last} aria-valuenow={age} aria-valuetext={valuetext} onKeyDown={onKey}
          onPointerDown={e => { if (!ready) return; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); pickAt(e.clientY); }}
          onPointerMove={e => { if (e.buttons) pickAt(e.clientY); }}
          className="absolute inset-0 sm:rounded-3xl overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-calm)]"
          style={{ touchAction: 'pan-y', cursor: ready ? 'pointer' : 'default' }}>
          {w > 0 && h > 0 && (
            <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 block">
              <defs>
                <linearGradient id="road-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: "var(--color-canvas)" }} />
                  <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--color-ring) 9%, var(--color-canvas))" }} />
                </linearGradient>
                <linearGradient id="road-ground" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--color-slate) 7%, var(--color-canvas))" }} />
                  <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--color-slate) 14%, var(--color-canvas))" }} />
                </linearGradient>
                <radialGradient id="road-glow" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0" style={{ stopColor: "var(--color-ring)", stopOpacity: 0.22 }} />
                  <stop offset="1" style={{ stopColor: "var(--color-ring)", stopOpacity: 0 }} />
                </radialGradient>
                {/* The haze: the further away, the less sharp. */}
                <linearGradient id="road-haze" gradientUnits="userSpaceOnUse" x1="0" y1={horizon} x2="0" y2={bottom}>
                  <stop offset="0" style={{ stopColor: "var(--color-canvas)", stopOpacity: 0.85 }} />
                  <stop offset={String(Math.max(0.01, (yAt(1) - horizon) / (bottom - horizon)))} style={{ stopColor: "var(--color-canvas)", stopOpacity: 0.22 }} />
                  <stop offset="1" style={{ stopColor: "var(--color-canvas)", stopOpacity: 0 }} />
                </linearGradient>
                {/* Nearer the viewer the road is a little darker: light falls off towards you. */}
                <linearGradient id="road-near" gradientUnits="userSpaceOnUse" x1="0" y1={yAt(0.45)} x2="0" y2={bottom}>
                  <stop offset="0" style={{ stopColor: '#000', stopOpacity: 0 }} />
                  <stop offset="1" style={{ stopColor: '#000', stopOpacity: 0.12 }} />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width={w} height={horizon} fill="url(#road-sky)" />
              {/* Light from beyond the horizon: in the sky only. */}
              <ellipse cx={cx} cy={horizon} rx={w * 0.46} ry={Math.max(28, horizon * 0.62)} fill="url(#road-glow)" />
              <rect x="0" y={horizon} width={w} height={h - horizon} fill="url(#road-ground)" />
              <line x1="0" x2={w} y1={horizon} y2={horizon} style={{ stroke: ink(14) }} strokeWidth="1" />
              {/* The fields either side: a few faint lines to the same vanishing point, so the ground reads as ground. */}
              {[-1, 1].flatMap(side => [1.35, 2.1, 3.4].map(k => (
                <line key={`${side}${k}`} x1={cx + side * (nearW / 2) * k} y1={bottom} x2={cx} y2={horizon} style={{ stroke: ink(5) }} strokeWidth="1" />)))}
              {/* Beyond the plan age the road carries on into the haze. */}
              <polygon points={beyond} style={{ fill: ready ? mist : ink(6) }} opacity="0.5" />
              <polygon data-lane="road" points={road} style={{ fill: ready ? mist : ink(6) }} />
              {ready && structured && <polygon data-lane="rules" points={lane(shownRules)} style={{ fill: shade }} />}
              {ready && <polygon data-lane="full" points={lane(shownFull)} style={{ fill: lit }} />}
              <polygon points={`${road} `} fill="url(#road-haze)" />
              <polygon points={beyond} fill="url(#road-haze)" />
              <polygon points={road} fill="url(#road-near)" />
              {/* The road's edges, so it reads as a surface. */}
              <line x1={cx - halfAt(0)} y1={yAt(0)} x2={cx} y2={horizon} style={{ stroke: ink(16) }} strokeWidth="1" />
              <line x1={cx + halfAt(0)} y1={yAt(0)} x2={cx} y2={horizon} style={{ stroke: ink(16) }} strokeWidth="1" />
              {notchT != null && <g data-notch><line x1={cx - halfAt(notchT) - 4} x2={cx - halfAt(notchT) - 4} y1={yAt(notchT)} y2={yAt(notchT) - 6 - 8 * sAt(notchT)} style={{ stroke: 'var(--color-ink-dim)' }} strokeWidth="1.5" strokeLinecap="round" />
                <circle cx={cx - halfAt(notchT) - 4} cy={yAt(notchT) - 6 - 8 * sAt(notchT)} r="2.2" style={{ fill: 'var(--color-ink-dim)' }} /></g>}
              {barT != null && <line data-road-bar x1={cx - halfAt(barT) - 4} x2={cx + halfAt(barT) + 4} y1={yAt(barT)} y2={yAt(barT)} style={{ stroke: 'var(--color-ink)' }} strokeWidth="2.5" strokeLinecap="round" />}
            </svg>)}
          {labels.map(l => (
            <span key={l.age} aria-hidden {...(l.age === first ? { 'data-road-start': '' } : l.age === last ? { 'data-road-end': '' } : {})}
              className="absolute tnum leading-none -translate-y-1/2" style={{ left: Math.min(w - 22, l.x), top: Math.min(h - 8, l.y - (l.age === first ? 8 : 0)), fontSize: l.size, color: picked === l.age ? 'var(--color-ink)' : 'var(--color-ink-dim)' }}>{l.age}</span>
          ))}
          {notchT != null && notchAge != null && (
            <span aria-hidden data-notch-age className="absolute tnum leading-none -translate-x-full -translate-y-1/2 text-[0.72rem] font-semibold whitespace-nowrap" style={{ left: cx - halfAt(notchT) - 9, top: yAt(notchT) - 6 - 8 * sAt(notchT), color: 'var(--color-ink-dim)' }}>{firstShort != null ? `short from ${notchAge}` : `trims from ${notchAge}`}</span>)}
          {/* The answer, in the sky above the road. */}
          <div className="absolute inset-x-0 top-0 flex flex-col items-center justify-center text-center pointer-events-none" style={{ height: horizon }}>{children?.(fontSize)}</div>
        </div>
      </div>
      {/* What the tones mean, then the reading: how short the bad futures are, or the age you touched. */}
      {ready && (
        <p data-road-key aria-hidden className="mt-1.5 px-4 sm:px-0 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[0.74rem] leading-tight" style={{ color: 'var(--color-ink-dim)' }}>
          <span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: lit }} />{fmt(ask)} in full</span>
          {structured && <span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: shade, outline: `1px solid ${ink(12)}` }} />with your rules</span>}
          <span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: mist, outline: `1px solid ${ink(12)}` }} />short</span>
        </p>)}
      <p data-road-reading className="mt-1 px-4 sm:px-0 text-center text-[0.84rem] leading-snug" style={{ color: picked != null ? 'var(--color-ink)' : 'var(--color-ink-dim)' }}>
        <span data-road-text className={picked != null ? 'font-semibold' : ''}>{picked != null && ready
          ? `At ${age}: ${full[idx]} of 100 futures still pay ${fmt(ask)} a month in full${structured && rules[idx] > full[idx] ? `; ${rules[idx]} still paying with your rules` : ''}.`
          : resting}</span>
        {onSeeFutures && ready && <>{' '}<button type="button" data-see-futures onClick={onSeeFutures} className="underline inline-block min-h-[24px] font-semibold" style={{ color: 'var(--color-calm-strong)' }}>See 10 futures</button></>}
      </p>
    </div>
  );
}
