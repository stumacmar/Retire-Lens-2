import { useEffect, useMemo, useRef, useState } from 'react';
import type { MC } from '../engine/engine';
import { fmt, fmtK } from '../lib/format';
import type { LifeEvent } from '../lib/lifeEvents';
import type { Tranche, TrancheKey } from '../lib/tranches';

/**
 * Your island: the home's one picture (owner, 17 November 2026, after nine
 * pictures that each squeezed a chart into a strip: "something so totally new").
 *
 * The sea is what you ask for. The land is how far your money still covers
 * that from each age on (the engine's cover: pensions at 85% for tax, ISAs and
 * cash, and guaranteed income still to come, over the spending still to come).
 * Across: your ages, every year the same width, so the late years are as
 * readable as the early ones. Into the distance: the futures, worst at the
 * front and best at the back, so nothing hides the bad ones. Where the land
 * drops under the sea, the money no longer covers what you ask; the white
 * coastline is the answer. A short plan floods: it can never look fine.
 *
 * Drag the sea (the handle on the right) and you change what you ask: the sea
 * rises over the land as you ask for more and falls as you ask for less, and
 * the plan is rerun when you let go. Touch the land to read any age in any
 * future; the keys move along the ages. Nothing moves on its own.
 *
 * Drawn on a canvas with a parallel projection (no vanishing point) and a
 * single light; heights are capped at twice the ask, which reads as a plateau.
 */
const CAP = 2;            // cover drawn up to twice the ask
const UP = 2;             // upsample in both directions for a smooth surface

type Props = {
  mc: MC | null; structured: boolean; fromAge: number; toAge: number; ask: number;
  central: { age: number; cover: number }[]; events: LifeEvent[];
  tranches: [Tranche, Tranche] | null; onOpen: (key: TrancheKey, age: number | null) => void;
  onAsk: (monthly: number) => void; summary: string; resting: string;
  head?: React.ReactNode; answer?: React.ReactNode;
};

function useBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const m = () => setBox({ w: Math.floor(el.clientWidth), h: Math.floor(el.clientHeight) });
    m(); const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null; ro?.observe(el); window.addEventListener('resize', m);
    return () => { ro?.disconnect(); window.removeEventListener('resize', m); };
  }, []);
  return [ref, box] as const;
}

const band = (l: number) => l < 0.47 ? `in the worst ${Math.max(1, Math.round(l * 100))} of 100 futures` : l > 0.53 ? `in the best ${Math.max(1, Math.round((1 - l) * 100))} of 100 futures` : 'in the middle future';

export default function Island({ mc, structured, fromAge, toAge, ask, central, events, tranches, onOpen, onAsk, summary, resting, head, answer }: Props) {
  const [boxRef, { w, h }] = useBox();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = mc?.perAgeHeld, cov = mc?.perAgeCover;
  const ready = !!(held && held.length && cov && cov.ages.length);
  const n0 = ready ? cov!.ages.length : Math.max(1, central.length || toAge - fromAge + 1);
  const first = ready ? cov!.ages[0].age : (central[0]?.age ?? fromAge), last = first + n0 - 1;
  const full = held ? held.map(x => Math.round(x.full * 100)) : [];
  const rules = held ? held.map((x, i) => Math.max(full[i], Math.round(x.rules * 100))) : [];
  const firstShort = held ? held.find((_x, i) => (structured ? rules : full)[i] < 100)?.age : undefined;
  const firstTrim = held && structured ? held.find((_x, i) => full[i] < rules[i])?.age : undefined;
  // Rows of cover: the engine's 21 levels once the futures are in, the central case alone before.
  const levels = ready ? cov!.levels : [0.5];
  const grid = useMemo(() => {
    const Q0 = levels.length;
    const raw = Array.from({ length: Q0 }, (_v, k) => Array.from({ length: n0 }, (_u, i) => ready ? cov!.ages[i].q[k] : (central[i]?.cover ?? 1)));
    return raw;
  }, [ready, cov, central, n0, levels.length]);
  const midRow = grid[Math.floor(grid.length / 2)] || [];

  // The sea while you drag it: a share of the current ask (1 at rest).
  const [sea, setSea] = useState(1);
  const dragging = useRef<{ y0: number; s0: number } | null>(null);
  const askNow = Math.round((ask * sea) / 50) * 50;

  // ── Geometry ────────────────────────────────────────────────────────────
  const Q0 = grid.length, n = (n0 - 1) * UP + 1, Q = Math.max(1, (Q0 - 1) * UP + 1);
  const padL = 10, padR = 46, base = h - 24;
  const plotW = Math.max(10, w - padL - padR);
  const depthX = Q > 1 ? Math.min(46, w * 0.12) : 0, depthY = Q > 1 ? Math.min(h * 0.3, 120) : 0;
  const plotW2 = plotW - depthX;
  const H = Math.max(20, Math.min((base - depthY - 96) / CAP, h * 0.3));
  const val = (qi: number, i: number) => {
    const a = i / UP, b = qi / UP, i0 = Math.floor(a), q0 = Math.floor(b), i1 = Math.min(n0 - 1, i0 + 1), q1 = Math.min(Q0 - 1, q0 + 1), fa = a - i0, fb = b - q0;
    const g = (q: number, i: number) => Math.min(CAP, grid[q]?.[i] ?? 1);
    return (g(q0, i0) * (1 - fa) + g(q0, i1) * fa) * (1 - fb) + (g(q1, i0) * (1 - fa) + g(q1, i1) * fa) * fb;
  };
  const P = (i: number, qi: number, v: number): [number, number] => [padL + (i / Math.max(1, n - 1)) * plotW2 + (Q > 1 ? qi / (Q - 1) : 0) * depthX, base - (Q > 1 ? qi / (Q - 1) : 0) * depthY - v * H];

  // ── Drawing ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || w <= 0 || h <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const x = cv.getContext('2d'); if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    const css = getComputedStyle(cv);
    const dark = (css.getPropertyValue('--island-dark') || '').trim() === '1';
    const L = [-0.45, -0.75, 0.62];
    const stops: [number, number[]][] = dark
      ? [[0, [70, 62, 52]], [0.95, [118, 104, 84]], [1, [164, 148, 116]], [1.2, [150, 120, 70]], [1.6, [128, 92, 48]], [2, [150, 140, 128]]]
      : [[0, [150, 132, 112]], [0.95, [206, 191, 160]], [1, [238, 226, 192]], [1.18, [216, 186, 120]], [1.55, [188, 140, 70]], [1.88, [150, 102, 46]], [2, [238, 234, 228]]];
    const col = (v: number, sh: number) => {
      let a = stops[0], b = stops[stops.length - 1];
      for (let k = 0; k < stops.length - 1; k++) if (v >= stops[k][0] && v <= stops[k + 1][0]) { a = stops[k]; b = stops[k + 1]; break; }
      const t = b[0] === a[0] ? 0 : (v - a[0]) / (b[0] - a[0]);
      return a[1].map((c, k) => Math.round((c + (b[1][k] - c) * t) * sh));
    };
    const seaV = sea;
    const quad = (pts: [number, number][]) => { x.beginPath(); pts.forEach((p, k) => k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); };
    for (let qi = Q - 1; qi >= 0; qi--) {
      const qn = Math.min(Q - 1, qi + 1);
      for (let i = 0; i < n - 1; i++) {
        const v00 = val(qi, i), v10 = val(qi, i + 1), v01 = val(qn, i), v11 = val(qn, i + 1);
        const nx = (v00 - v10) * H / Math.max(1, plotW2 / (n - 1)) * 0.5, nz = Q > 1 ? (v00 - v01) * H / Math.max(1, depthY / (Q - 1)) * 0.18 : 0;
        const nn = Math.hypot(nx, nz, 1), dif = Math.max(0, (nx * L[0] + nz * L[1] + L[2]) / nn), sh = 0.62 + 0.5 * dif;
        const vm = (v00 + v10 + v01 + v11) / 4;
        quad([P(i, qi, v00), P(i + 1, qi, v10), P(i + 1, qn, v11), P(i, qn, v01)]);
        const c = col(vm / seaV, sh); x.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; x.fill(); x.strokeStyle = x.fillStyle; x.lineWidth = 0.6; x.stroke();
        if (vm < seaV) {
          quad([P(i, qi, seaV), P(i + 1, qi, seaV), P(i + 1, qn, seaV), P(i, qn, seaV)]);
          const deep = Math.min(1, (seaV - vm) / seaV * 2.4);
          x.fillStyle = dark ? `rgba(${40 - 20 * deep | 0},${100 - 30 * deep | 0},${190 - 30 * deep | 0},${0.6 + 0.3 * deep})` : `rgba(${70 - 35 * deep | 0},${135 - 45 * deep | 0},${228 - 25 * deep | 0},${0.55 + 0.3 * deep})`;
          x.fill();
        }
      }
      if (qi === 0) {   // the front: a cliff of earth, and the sea against it
        x.beginPath(); for (let i = 0; i < n; i++) { const p = P(i, 0, val(0, i)); i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); }
        for (let i = n - 1; i >= 0; i--) { const p = P(i, 0, 0); x.lineTo(p[0], p[1]); } x.closePath();
        const g = x.createLinearGradient(0, base - H, 0, base); g.addColorStop(0, dark ? '#5a4632' : '#8a6a45'); g.addColorStop(1, dark ? '#2e241a' : '#5b4630'); x.fillStyle = g; x.fill();
        x.beginPath(); for (let i = 0; i < n; i++) { const p = P(i, 0, Math.min(seaV, val(0, i))); i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); }
        for (let i = n - 1; i >= 0; i--) { const p = P(i, 0, seaV); x.lineTo(p[0], p[1]); } x.closePath();
        x.fillStyle = dark ? 'rgba(40,100,200,.8)' : 'rgba(50,110,220,.78)'; x.fill();
      }
    }
    // the coastline: where the land meets the sea
    x.strokeStyle = dark ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.98)'; x.lineWidth = 2;
    for (let qi = 0; qi < Q - 1; qi++) for (let i = 0; i < n - 1; i++) {
      const c: [number, number, number][] = [[i, qi, val(qi, i)], [i + 1, qi, val(qi, i + 1)], [i + 1, qi + 1, val(qi + 1, i + 1)], [i, qi + 1, val(qi + 1, i)]];
      const seg: [number, number][] = [];
      for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; if ((a[2] - seaV) * (b[2] - seaV) < 0) { const t = (seaV - a[2]) / (b[2] - a[2]); seg.push(P(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, seaV)); } }
      if (seg.length === 2) { x.beginPath(); x.moveTo(seg[0][0], seg[0][1]); x.lineTo(seg[1][0], seg[1][1]); x.stroke(); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, grid, sea]);

  // ── Reading: touch the land, or move along the ages with the keys ──────
  const [pick, setPick] = useState<{ age: number; level: number } | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const pickAt = (cx: number, cy: number) => {
    const el = sceneRef.current; if (!el || !ready) return;
    const b = el.getBoundingClientRect(), px = cx - b.left, py = cy - b.top;
    let best: [number, number, number] = [1e9, 0, 0];
    for (let qi = 0; qi < Q; qi += 1) for (let i = 0; i < n; i += UP) {
      const p = P(i, qi, val(qi, i)), d = (p[0] - px) ** 2 + (p[1] - py) ** 2;
      if (d < best[0]) best = [d, i / UP, qi / UP];
    }
    const qIdx = Math.round(best[2]);
    setPick({ age: first + Math.round(best[1]), level: levels[Math.max(0, Math.min(levels.length - 1, qIdx))] });
  };
  useEffect(() => {
    if (!pick) return;
    const away = (e: PointerEvent) => { if (!(e.target as Element).closest?.('[data-island]')) setPick(null); };
    document.addEventListener('pointerdown', away); return () => document.removeEventListener('pointerdown', away);
  }, [pick]);
  const age = pick?.age ?? last, idx = Math.max(0, Math.min(n0 - 1, age - first));
  const midLevel = levels[Math.floor(levels.length / 2)];
  const onKey = (e: React.KeyboardEvent) => {
    if (!ready) return;
    const step = ({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 } as Record<string, number>)[e.key];
    if (e.key === 'Escape') { if (pick) { setPick(null); e.preventDefault(); } return; }
    if (e.key === 'Home' || e.key === 'End') { setPick({ age: e.key === 'Home' ? first : last, level: pick?.level ?? midLevel }); e.preventDefault(); return; }
    if (step) { setPick({ age: Math.max(first, Math.min(last, (pick?.age ?? (step > 0 ? first - 1 : last + 1)) + step)), level: pick?.level ?? midLevel }); e.preventDefault(); }
  };
  const futuresAt = held ? `${full[idx]} of 100 futures still pay ${fmt(ask)} a month in full${structured && rules[idx] > full[idx] ? `; ${rules[idx]} still paying with your rules` : ''}` : '';
  const coverAt = pick && ready ? cov!.ages[idx].q[Math.max(0, levels.indexOf(pick.level))] : null;
  const valuetext = !held ? 'Working out the futures' : `Age ${age}: ${futuresAt.replace(/;/, ',')}`;

  // ── Dragging the sea: what you ask ──────────────────────────────────────
  const seaY = P(n - 1, 0, sea)[1];
  const onSeaDown = (e: React.PointerEvent) => { e.stopPropagation(); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); dragging.current = { y0: e.clientY, s0: sea }; };
  const onSeaMove = (e: React.PointerEvent) => { const d = dragging.current; if (!d) return; setSea(Math.max(0.4, Math.min(1.9, d.s0 + (d.y0 - e.clientY) / H))); };
  const onSeaUp = () => { if (!dragging.current) return; dragging.current = null; const m = askNow; setSea(1); if (Math.abs(m - ask) >= 50) onAsk(m); };
  const seaKey = (e: React.KeyboardEvent) => { const d = ({ ArrowUp: 100, ArrowRight: 100, ArrowDown: -100, ArrowLeft: -100 } as Record<string, number>)[e.key]; if (d) { onAsk(Math.max(500, ask + d)); e.preventDefault(); } };

  const ticks = [first, ...[60, 65, 70, 75, 80, 85, 90, 95, 100].filter(a => a > first + 2 && a < last - 2), last];
  const evs = events.filter(e => e.age > first && e.age <= last).slice(0, 2);
  const mark = pick && ready ? P((pick.age - first) * UP, Math.round(levels.indexOf(pick.level) * UP), Math.min(CAP, coverAt ?? 1)) : null;

  return (
    <div data-island data-ready={ready ? '1' : '0'} data-first={first} data-last={last} data-years={n0}
      data-full-counts={full.join(',')} data-rules={structured ? rules.join(',') : ''} data-first-short={firstShort ?? ''} data-first-trim={firstTrim ?? ''}
      data-age={pick?.age ?? ''} data-cover-mid={midRow.map(v => v.toFixed(4)).join(',')} data-sea={sea.toFixed(3)}
      className="flex-1 min-h-[220px] [@media(min-height:680px)]:min-h-[300px] max-h-[620px] flex flex-col -mx-4 sm:mx-0">
      <span id="island-summary" className="sr-only">{summary}</span>
      <div ref={boxRef} className="relative flex-1 min-h-0 sm:rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-calm) 6%, var(--color-canvas)) 0%, var(--color-canvas) 45%, color-mix(in srgb, var(--color-calm) 14%, var(--color-canvas)) 100%)' }}>
        <div ref={sceneRef} role="slider" tabIndex={ready ? 0 : -1} aria-label="Futures still paying, by age" aria-describedby="island-summary"
          aria-valuemin={first} aria-valuemax={last} aria-valuenow={age} aria-valuetext={valuetext} onKeyDown={onKey}
          onPointerDown={e => pickAt(e.clientX, e.clientY)} className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-calm)]" style={{ cursor: 'crosshair', touchAction: 'pan-y' }}>
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0 block" style={{ width: w, height: h }} />
          {w > 0 && ticks.map(a => { const p = P((a - first) * UP, 0, 0); return (
            <span key={a} aria-hidden className="absolute text-[0.7rem] tnum font-semibold leading-none -translate-x-1/2" style={{ left: Math.max(10, Math.min(w - 12, p[0])), top: base + 6, color: pick?.age === a ? 'var(--color-ink)' : 'var(--color-ink-dim)' }}>{a}</span>); })}
          {w > 0 && ready && <>
            <span aria-hidden className="absolute text-[0.66rem] font-semibold leading-none" style={{ left: 8, top: base - 12, color: 'color-mix(in srgb, white 92%, transparent)' }}>worst futures</span>
            <span aria-hidden className="absolute text-[0.64rem] font-semibold leading-none whitespace-nowrap" style={{ left: P(Math.round(n * 0.04), Math.round(Q * 0.55), 0)[0], top: Math.max(4, P(Math.round(n * 0.04), Math.round(Q * 0.55), Math.min(CAP, val(Math.round(Q * 0.55), Math.round(n * 0.04))))[1] + 6), color: 'var(--color-ink-dim)' }}>the land: what your money covers</span>
            <span aria-hidden className="absolute text-[0.66rem] font-semibold leading-none -translate-x-full" style={{ left: P(n - 1, Q - 1, 0)[0], top: Math.max(4, P(n - 1, Q - 1, Math.min(CAP, val(Q - 1, n - 1)))[1] - 14), color: 'var(--color-ink-dim)' }}>best futures</span>
          </>}
          {w > 0 && ready && evs.map((e, k) => { const i = (e.age - first) * UP, qi = Math.round((Q - 1) * 0.5); const p = P(i, qi, Math.min(CAP, val(qi, i))); return (
            <span key={e.age + e.label} aria-hidden data-event-age={e.age} className="absolute text-[0.68rem] font-semibold leading-none whitespace-nowrap rounded-full px-2 py-1 -translate-x-1/2"
              style={{ left: Math.max(60, Math.min(w - 70, p[0])), top: Math.max(4, p[1] - 26 - k * 22), background: 'color-mix(in srgb, var(--color-canvas) 90%, transparent)', color: 'var(--color-ink)', boxShadow: '0 1px 4px rgba(15,23,42,.18)' }}>⚑ {e.age} · {e.label}</span>); })}
          {mark && <span aria-hidden data-island-mark className="absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ left: mark[0], top: mark[1], background: 'var(--color-canvas)', border: '2.5px solid var(--color-ink)' }} />}
        </div>
        {/* The sea's handle: what you ask, dragged up or down (or the arrow keys). */}
        {w > 0 && (
          <button type="button" data-sea-handle aria-label={`What you ask: ${fmt(askNow)} a month. Drag up or down, or use the arrow keys, to change it`}
            onPointerDown={onSeaDown} onPointerMove={onSeaMove} onPointerUp={onSeaUp} onPointerCancel={onSeaUp} onKeyDown={seaKey}
            className="absolute right-1 -translate-y-1/2 rounded-full pl-2.5 pr-3 min-h-[34px] text-[0.76rem] font-bold leading-none whitespace-nowrap select-none"
            style={{ top: Math.max(80, Math.min(h - 20, seaY)), background: 'var(--color-calm)', color: 'var(--color-on-calm)', touchAction: 'none', cursor: 'ns-resize', boxShadow: '0 2px 8px rgba(29,78,216,.35)' }}>
            ↕ {fmt(askNow)}
          </button>)}
        {/* Direct labels, in the scene: what the sea and the land are. */}
        {w > 0 && <span aria-hidden data-island-sea-label className="absolute right-2 text-[0.64rem] font-semibold leading-none whitespace-nowrap -translate-y-full"
          style={{ top: Math.max(34, Math.min(h - 30, seaY)) - 20, color: 'var(--color-calm-strong)' }}>the sea: what you ask</span>}
        {/* The answer, in the sky. */}
        {head && <div className="absolute left-3 top-2 pointer-events-none max-w-[62%]" style={{ textShadow: '0 1px 0 color-mix(in srgb, var(--color-canvas) 80%, transparent)' }}>{head}</div>}
        {/* The tranches, top right of the sky: open one to see how it performs. */}
        {tranches && ready && w > 0 && tranches.map((tr, k) => (
          <button key={tr.key} type="button" data-tranche-open={tr.key} onClick={() => onOpen(tr.key, pick?.age ?? null)}
            aria-label={`${tr.name}: ${fmtK(tr.values[pick ? idx : 0] ?? 0)} at ${pick ? age : first}, in today's money. Open to see how it performs`}
            className="absolute right-1.5 rounded-full px-2.5 min-h-[28px] text-[0.68rem] font-semibold leading-tight whitespace-nowrap"
            style={{ top: 6 + k * 34, background: 'color-mix(in srgb, var(--color-canvas) 92%, transparent)', borderLeft: `3px solid ${tr.colour}`, color: 'var(--color-ink)', boxShadow: '0 1px 4px rgba(15,23,42,.14)' }}>
            {tr.name} <b className="tnum">{fmtK(tr.values[pick ? idx : 0] ?? 0)}</b> <span aria-hidden style={{ color: 'var(--color-calm-strong)' }}>›</span>
          </button>))}
      </div>

      <p data-island-reading className="mt-0.5 px-4 sm:px-0 text-center text-[0.8rem] leading-snug min-h-[3.75em]" style={{ color: pick ? 'var(--color-ink)' : 'var(--color-ink-dim)' }}>
        {answer && <span className={pick ? 'sr-only' : ''}>{answer} </span>}<span data-island-text className={pick ? 'font-semibold' : ''}>{pick && held
          ? `At ${age}: ${futuresAt}.${coverAt != null ? ` ${band(pick.level)[0].toUpperCase()}${band(pick.level).slice(1)}, your money covers about ${Math.round(Math.min(coverAt, 9.99) * 100)}% of what you ask from here.` : ''}`
          : resting}</span>
      </p>
    </div>
  );
}
