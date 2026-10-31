import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, X } from 'lucide-react';
import type { Drawdown, MC } from '../../engine/engine';
import { E } from '../../lib/usePlan';
import { deflate, fmt } from '../../lib/format';
import { useInsight } from '../../lib/useInsight';
import type { Rail } from '../../lib/insights';
import DecisionMap from '../DecisionMap';
import { FACES, valuesFor, clampVal, type Face, type Side, type Val } from './values';

/**
 * The Horizon Dial. One ring on one fixed screen. The six groups of the plan
 * are six engravings round the bezel; the one you tap becomes the needle's
 * home, and dragging round the ring turns a tick scale under that fixed
 * needle, one detent per step. The answer — pounds a month after tax — sits
 * in the middle and is itself the control for what you want (drag it up or
 * down). Inside the track, a hundred grains light in proportion to the share
 * of simulated futures in which the plan holds. Under the dial, your money
 * over time as faint strands, with the floor under the worst real history.
 *
 * Six hidden range inputs (twelve for a couple) are the source of truth for
 * keyboards and screen readers; the drawing is a presentation of them.
 */
type View = 'home' | 'bands' | 'edge' | 'levers';
const DETENT = 12;                                   // degrees per step
const HISTORIES: { key: string; when: string }[] = [
  { key: 'gfc', when: 'a 2008 start' }, { key: 'japan', when: 'a Japan-1990 start' }, { key: 'stagflation', when: 'a 1970s start' }];
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const unwrap = (a: number) => ((a + 540) % 360) - 180;
const norm = (a: number) => ((a % 360) + 360) % 360;

export default function Dial({ plan, update, dd, mc, mcPending, viz, plus, onUpgrade, onDetails, header }: {
  plan: any; update: (p: any) => void; dd: Drawdown; mc: MC | null; mcPending: boolean;
  viz: { base: [number, number][]; low: [number, number][]; high: [number, number][]; atRetire: number };
  plus: boolean; onUpgrade: () => void; onDetails: () => void; header?: React.ReactNode;
}) {
  const single = plan.household === 'single';
  const [face, setFace] = useState<Face>('someday');
  const [sub, setSub] = useState(0);
  const [side, setSide] = useState<Side>('A');
  const [view, setView] = useState<View>('home');
  const [hist, setHist] = useState(0);
  const [typing, setTyping] = useState<string | null>(null);
  useEffect(() => { if (single && side === 'B') setSide('A'); }, [single, side]);

  const vals = useMemo(() => ({ A: valuesFor(plan, 'A'), B: valuesFor(plan, 'B') }), [plan]);
  const faceVals = vals[side][face];
  const active: Val | null = faceVals[sub] ?? faceVals[0] ?? null;

  // Which groups have been touched: the sky lightens a sixth for each.
  const touched: string[] = Array.isArray(plan.codeSet) ? plan.codeSet : [];
  const touch = (f: Face) => { if (!touched.includes(f)) update((p: any) => ({ ...p, codeSet: Array.from(new Set([...(Array.isArray(p.codeSet) ? p.codeSet : []), f])) })); };

  // Every way of changing a value goes through here. Steps are computed
  // inside the updater so a fast flick never works from a stale plan.
  const write = useCallback((f: Face, s: number, sd: Side, fn: (val: Val, cur: number) => number) => {
    update((p: any) => {
      const val = valuesFor(p, sd)[f][s]; if (!val) return p;
      const cur = val.get(), next = clampVal(val, fn(val, cur));
      if (next === cur) return p;
      const patch = val.set(next);
      const codeSet = Array.from(new Set([...(Array.isArray(p.codeSet) ? p.codeSet : []), f]));
      return { ...p, ...patch, codeSet };
    });
  }, [update]);
  const step = (dir: number) => write(face, sub, side, (val, cur) => cur + dir * val.detent(cur));
  const setAbs = (n: number) => write(face, sub, side, () => n);
  const stepRef = useRef(step); stepRef.current = step;

  // ── The answer ────────────────────────────────────────────────────────
  const A = plan.partnerA, B = plan.partnerB;
  const hasMoney = (A.pension + A.isa + (single ? 0 : B.pension + B.isa) + (plan.cash || 0) + A.monthlyPension) > 0;
  const month = Math.round((plan.targetNet || 0) / 12);
  const lasts = dd.exhaustedAgeA == null;
  const railsKey = useMemo(() => JSON.stringify({ ...plan, targetNet: 0, codeSet: null, spendingPlanOn: false }), [plan]);
  const rails = useInsight<Rail[]>('guardrails', plan, railsKey, 400);
  const floor = hasMoney ? rails?.find(r => r.key === HISTORIES[hist].key) : undefined;
  const lit = mc ? Math.round(mc.successProb * 100) : null;

  // ── Geometry: everything sized from the height we actually have ──────
  const [vp, setVp] = useState({ w: 390, h: 844 });
  useLayoutEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on(); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on);
  }, []);
  const compact = vp.h < 720;
  const d = Math.max(236, Math.min(320, vp.w - 70, vp.h - (compact ? 425 : 440)));
  const R = d / 2, stripH = compact ? 72 : vp.h >= 820 ? 128 : 104;
  const boxPad = compact ? 36 : 40;

  // ── The ring: a tick scale that turns under a fixed needle ───────────
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const scale = useRef(0);                 // the scale's angle, degrees
  const needle = useRef(FACES[0].angle);   // where the needle points now
  const raf = useRef(0);
  const inertia = useRef<{ left: number; t: number } | null>(null);
  const state = useRef({ plan, mc, mcPending, face, side, touched, d, lit });
  state.current = { plan, mc, mcPending, face, side, touched, d, lit };

  // Turning: degrees of scale → detents → steps. Fast turns gain, like a click wheel.
  const accum = useRef(0);
  const turn = useCallback((deg: number, haptic: boolean) => {
    scale.current += deg; accum.current += deg;
    while (Math.abs(accum.current) >= DETENT) {
      const s = Math.sign(accum.current); accum.current -= DETENT * s; stepRef.current(s);
      if (haptic) { try { navigator.vibrate?.(5); } catch { /* none */ } }
    }
  }, []);

  const draw = useCallback(() => {
    const cv = canvas.current; if (!cv) return;
    const { touched, d, lit, mcPending } = state.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1), Rr = d / 2;
    if (cv.width !== Math.round(d * dpr)) { cv.width = Math.round(d * dpr); cv.height = Math.round(d * dpr); }
    const g = cv.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, d, d);
    const dim = css('--color-ink-dim'), hair = css('--ring-track'), accent = css('--color-calm');
    const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
    // The track, in six arcs: a hairline where the group is untouched, a line where it is set.
    for (const f of FACES) {
      const on = touched.includes(f.id);
      g.beginPath(); g.arc(Rr, Rr, Rr * 0.91, rad(f.angle - 30 + 1.5), rad(f.angle + 30 - 1.5));
      g.lineWidth = on ? 3 : 1; g.strokeStyle = on ? dim : hair; g.globalAlpha = on ? 0.9 : 1; g.stroke(); g.globalAlpha = 1;
    }
    // The scale: thirty ticks, turning with the ring.
    for (let i = 0; i < 30; i++) {
      const a = rad(scale.current + i * DETENT), major = i % 5 === 0;
      const r0 = Rr * (major ? 0.83 : 0.86), r1 = Rr * 0.89;
      g.beginPath(); g.moveTo(Rr + r0 * Math.cos(a), Rr + r0 * Math.sin(a)); g.lineTo(Rr + r1 * Math.cos(a), Rr + r1 * Math.sin(a));
      g.lineWidth = major ? 1.5 : 1; g.strokeStyle = dim; g.globalAlpha = major ? 0.7 : 0.4; g.stroke();
    }
    g.globalAlpha = 1;
    // A hundred grains: the share of futures that hold, lit from the top, clockwise.
    for (let i = 0; i < 100; i++) {
      const a = rad(i * 3.6), r = Rr * 0.74, on = lit != null && i < lit;
      g.beginPath(); g.arc(Rr + r * Math.cos(a), Rr + r * Math.sin(a), on ? 1.7 : 1.1, 0, 7);
      g.fillStyle = on ? accent : hair; g.globalAlpha = on ? (mcPending ? 0.45 : 1) : 1; g.fill();
    }
    g.globalAlpha = 1;
    // The needle: fixed at the active group's home, pointing in at the scale.
    const na = rad(needle.current), tip = Rr * 0.855, base = Rr * 0.935, half = 0.026;
    g.beginPath(); g.moveTo(Rr + tip * Math.cos(na), Rr + tip * Math.sin(na));
    g.lineTo(Rr + base * Math.cos(na - half), Rr + base * Math.sin(na - half)); g.lineTo(Rr + base * Math.cos(na + half), Rr + base * Math.sin(na + half));
    g.closePath(); g.fillStyle = accent; g.fill();
  }, []);

  // One frame loop: the needle settles toward its home and any inertia plays out.
  const frame = useCallback(() => {
    raf.current = 0;
    const home = FACES.find(f => f.id === state.current.face)!.angle;
    const dn = unwrap(home - needle.current);
    let busy = false;
    if (Math.abs(dn) > 0.2) { needle.current = reduced() ? home : norm(needle.current + dn * 0.18); busy = true; } else needle.current = home;
    const inert = inertia.current;
    if (inert) {
      const now = performance.now(), dt = Math.min(40, now - inert.t); inert.t = now;
      const move = inert.left * (1 - Math.exp(-dt / 120));
      inert.left -= move; turn(move, false);
      if (Math.abs(inert.left) < 0.4) { inertia.current = null; scale.current = Math.round(scale.current / DETENT) * DETENT; accum.current = 0; } else busy = true;
    }
    draw();
    if (busy) raf.current = requestAnimationFrame(frame);
  }, [draw, turn]);
  const kick = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(frame); }, [frame]);
  useEffect(() => { kick(); }, [plan, mc, mcPending, face, side, d, kick]);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);
  useEffect(() => { const mq = matchMedia('(prefers-color-scheme: dark)'); const on = () => kick(); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, [kick]);

  const gesture = useRef<{ mode: 'ring' | 'scrub'; last: number; samples: [number, number][]; y0: number; v0: number } | null>(null);
  const polar = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect(), x = e.clientX - r.left - R, y = e.clientY - r.top - R;
    return { dist: Math.hypot(x, y), ang: norm((Math.atan2(x, -y) * 180) / Math.PI) };
  };
  const velocity = (s: [number, number][]) => {
    const now = performance.now(), recent = s.filter(([t]) => now - t < 90);
    if (recent.length < 2) return 0;
    const [t0, a0] = recent[0], [t1, a1] = recent[recent.length - 1];
    return t1 > t0 ? unwrap(a1 - a0) / (t1 - t0) : 0;                 // degrees per ms
  };
  const gain = (w: number) => (Math.abs(w) < 0.09 ? 1 : Math.abs(w) > 0.54 ? 8 : 1 + (7 * (Math.abs(w) - 0.09)) / 0.45);
  const onDown = (e: React.PointerEvent) => {
    if (view !== 'home' || typing) return;
    const { dist, ang } = polar(e);
    if (dist > R * 0.98) return;
    inertia.current = null;
    if (dist >= R * 0.62) { if (!active) return; gesture.current = { mode: 'ring', last: ang, samples: [[performance.now(), ang]], y0: e.clientY, v0: 0 }; }
    else { gesture.current = { mode: 'scrub', last: 0, samples: [], y0: e.clientY, v0: month }; }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const gs = gesture.current; if (!gs) return;
    if (gs.mode === 'ring') {
      const { ang } = polar(e), dA = unwrap(ang - gs.last); gs.last = ang;
      gs.samples.push([performance.now(), ang]); if (gs.samples.length > 8) gs.samples.shift();
      turn(dA * gain(velocity(gs.samples)), true); kick();
    } else {
      const n = gs.v0 + Math.round((gs.y0 - e.clientY) / 6) * 50;
      if (n !== month) write('someday', 1, 'A', () => n);
    }
  };
  const onUp = () => {
    const gs = gesture.current; if (!gs) return; gesture.current = null;
    if (gs.mode === 'ring') {
      const w = velocity(gs.samples);
      if (!reduced() && Math.abs(w) > 0.05) inertia.current = { left: w * 700 * Math.min(gain(w), 3), t: performance.now() };
      else { scale.current = Math.round(scale.current / DETENT) * DETENT; accum.current = 0; }
      kick();
    }
  };

  // ── Hidden ranges: the real controls ──────────────────────────────────
  const ranges = (sd: Side) => FACES.flatMap(f => vals[sd][f.id].map((val, i) => (
    <input key={val.key} type="range" className="sr-only" aria-label={val.label} min={val.min} max={val.max} step={val.step} value={val.get()}
      aria-valuetext={val.text(val.get())}
      onFocus={() => { setFace(f.id); setSub(i); setSide(sd); }}
      onChange={e => { const n = Number(e.target.value); write(f.id, i, sd, () => n); }} />)));

  // ── Sector labels round the bezel ─────────────────────────────────────
  const pos = (angle: number): React.CSSProperties => {
    if (angle === 0) return { left: '50%', top: 0, transform: 'translateX(-50%)', textAlign: 'center' };
    if (angle === 180) return { left: '50%', bottom: 0, transform: 'translateX(-50%)', textAlign: 'center' };
    const right = angle < 180, top = angle === 60 || angle === 300;
    return { [right ? 'right' : 'left']: 0, [top ? 'top' : 'bottom']: 2, textAlign: right ? 'right' : 'left' } as React.CSSProperties;
  };
  const flip = (to: Side) => { if (to === side) return; setSide(to); setSub(0); };

  // ── Levers, measured when the tray opens ──────────────────────────────
  const [levers, setLevers] = useState<any>(null);
  useEffect(() => {
    if (view !== 'levers') return; let live = true; setLevers(null);
    const id = setTimeout(() => { try { const r = (E as any).levers(plan, { paths: 200 }); if (live) setLevers(r); } catch { if (live) setLevers({ levers: [] }); } }, 60);
    return () => { live = false; clearTimeout(id); };
  }, [view, plan]);

  const topLevers: any[] = levers?.levers ? levers.levers.filter((l: any) => l.dConf > 0.004) : [];
  const holdsText = !hasMoney ? 'Turn the ring to set your pensions and savings. The answer appears in the middle.'
    : lit == null ? 'Working out the futures.' : `Holds in ${lit} of 100 futures.`;
  const floorV = floor ? floor.year / 12 : null;
  const floorText = floorV == null ? '' : floorV >= month ? `Even after ${HISTORIES[hist].when}, ${fmt(floorV)} a month would hold.` : `Falls to ${fmt(floorV)} a month after ${HISTORIES[hist].when}.`;
  const skyT = Math.min(1, FACES.filter(f => touched.includes(f.id)).length / 6);
  const qual = !hasMoney ? '' : lasts ? `a month, to ${plan.horizonAge}` : `a month, to ${dd.exhaustedAgeA}`;
  const headSize = Math.round(d * 0.2);

  return (
    <div className="dial-home fixed inset-0 flex flex-col items-center select-none" data-home
      style={{ '--sky-t': skyT, paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.6rem)',
        paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))', overscrollBehavior: 'none', touchAction: 'none' } as React.CSSProperties}>
      <div className="w-full max-w-[560px]">{header}</div>
      {!compact && <p className="text-[0.72rem] mt-1 tracking-wide" style={{ color: 'var(--color-ink-faint)' }}>After tax · today's money · 2,000 futures · {plan.startYear}/{String(plan.startYear + 1).slice(2)}</p>}

      {/* ── The dial ──────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {view !== 'bands' && (
          <motion.div key="dial" className="relative shrink-0" style={{ width: d + 60, height: d + boxPad * 2, marginTop: compact ? 0 : 6 }}
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25 }}>
            <motion.div className="absolute" style={{ left: 30, top: boxPad, width: d, height: d }}
              animate={{ scaleX: 1 }} key={side} initial={{ scaleX: 0 }} transition={{ duration: reduced() ? 0 : 0.2 }}>
              <canvas ref={canvas} className="block" style={{ width: d, height: d, touchAction: 'none', cursor: 'grab' }} aria-hidden="true"
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
              {/* The headline: pounds a month, and the control for what you want. */}
              <div data-answer className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none" style={{ padding: R * 0.3 }}>
                {hasMoney ? <>
                  <h1 className="serif tnum leading-none" style={{ fontSize: headSize, color: 'var(--color-ink)' }}>{fmt(month)}</h1>
                  <p className="mt-1 text-[0.86rem] font-medium" style={{ color: lasts ? 'var(--color-ink-dim)' : 'var(--color-hope)' }}>{qual}</p>
                  {!single && !compact && <p className="text-[0.66rem] mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>{side === 'A' ? 'the two of you' : `on ${B.name || 'their'} side`}</p>}
                </> : <>
                  <h1 className="serif leading-[1.05]" style={{ fontSize: Math.round(d * 0.085), color: 'var(--color-ink)' }}>What could you take home, for life?</h1>
                </>}
              </div>
            </motion.div>
            {/* Six engravings on the bezel. */}
            {FACES.map(f => {
              const fv = vals[side][f.id], on = f.id === face, set = touched.includes(f.id), empty = fv.length === 0;
              return (
                <button key={f.id} type="button" disabled={empty} aria-pressed={on} data-face={f.id}
                  onClick={() => { if (on) setSub(s => (fv[1 - s] ? 1 - s : s)); else { setFace(f.id); setSub(0); } kick(); }}
                  className="absolute px-1.5 py-1 min-h-[40px] min-w-[44px] leading-tight" style={{ ...pos(f.angle), opacity: empty ? 0.25 : set || on ? 1 : 0.55 }}>
                  <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em]" style={{ color: on ? 'var(--color-calm-strong)' : 'var(--color-ink-dim)' }}>{f.name}</span>
                  <span className="block text-[0.78rem] tnum font-medium" style={{ color: 'var(--color-ink)' }}>
                    {fv.map((v, i) => <span key={v.key} style={{ opacity: on && i !== sub ? 0.5 : 1 }}>{i ? ' · ' : ''}{v.short(v.get())}</span>)}
                  </span>
                </button>);
            })}
          </motion.div>)}
      </AnimatePresence>

      {/* ── The reticle: the active value, with the ways round dragging ── */}
      {view !== 'bands' && active && (
        <div className="flex items-center justify-center gap-2 w-full max-w-[420px]" style={{ minHeight: compact ? 42 : 48, marginTop: compact ? 0 : 4 }}>
          <button type="button" onClick={() => step(-1)} aria-label={`${active.label}: less`} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ border: '1px solid var(--color-hairline)', color: 'var(--color-ink-dim)' }}><Minus size={16} /></button>
          <div className="flex-1 text-center min-w-0">
            {active.options ? (
              <div className="flex justify-center gap-1">
                {active.options.map((o, i) => (
                  <button key={o} type="button" aria-pressed={active.get() === i} onClick={() => setAbs(i)} className="rounded-full px-3 min-h-[36px] text-[0.8rem] font-semibold"
                    style={{ background: active.get() === i ? 'var(--color-canvas)' : 'transparent', color: active.get() === i ? 'var(--color-ink)' : 'var(--color-ink-dim)', border: '1px solid var(--color-hairline)' }}>{o}</button>))}
              </div>
            ) : typing != null ? (
              <input autoFocus inputMode="decimal" aria-label={`${active.label}, type a figure`} value={typing} onChange={e => setTyping(e.target.value)}
                onBlur={() => { const n = parseFloat(typing.replace(/[,£\s]/g, '')); if (Number.isFinite(n)) setAbs(n); setTyping(null); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setTyping(null); }}
                className="tnum text-center text-[1.1rem] font-bold rounded-xl px-2 py-1 w-40 outline-none" style={{ background: 'var(--color-canvas)', color: 'var(--color-ink)', border: '1px solid var(--color-calm)' }} />
            ) : (
              <button type="button" onClick={() => setTyping(String(active.get()))} className="text-[0.95rem] leading-tight px-2 py-1 rounded-xl" aria-label={`${active.text(active.get())}. Tap to type a figure`}
                style={{ color: 'var(--color-ink)' }}>
                <b className="tnum">{active.text(active.get())}</b>
              </button>)}
            {!single && (
              <div className="flex justify-center gap-1 mt-0.5 text-[0.7rem]">
                {(['A', 'B'] as Side[]).map(s => <button key={s} type="button" aria-pressed={side === s} onClick={() => flip(s)} className="px-2 py-0.5 rounded-full font-semibold"
                  style={{ color: side === s ? 'var(--color-calm-strong)' : 'var(--color-ink-faint)' }}>{s === 'A' ? (A.name || 'You') : (B.name || 'Them')}</button>)}
              </div>)}
          </div>
          <button type="button" onClick={() => step(1)} aria-label={`${active.label}: more`} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ border: '1px solid var(--color-hairline)', color: 'var(--color-ink-dim)' }}><Plus size={16} /></button>
        </div>)}

      {/* ── Your money over time ──────────────────────────────────────── */}
      <Strands plan={plan} dd={dd} mc={mc} viz={viz} height={view === 'bands' ? Math.max(260, vp.h - 420) : stripH} width={Math.min(vp.w - 32, 528)}
        bands={view === 'bands'} floor={floorV} onTap={() => setView(v => (v === 'bands' ? 'home' : 'bands'))} />
      {view === 'bands' && (
        <div data-answer className="mt-2 text-center">
          <span className="serif tnum text-[2rem] leading-none" style={{ color: 'var(--color-ink)' }}>{fmt(month)}</span>
          <span className="text-[0.85rem] ml-2" style={{ color: 'var(--color-ink-dim)' }}>{qual}</span>
          <p className="text-[0.76rem] mt-1" style={{ color: 'var(--color-ink-faint)' }}>Poor to good markets shaded, the typical path drawn. Tap the strip to go back.</p>
        </div>)}

      {/* ── One sentence, said once ───────────────────────────────────── */}
      <p data-sentence aria-live="polite" className={`${compact ? 'mt-1 text-[0.82rem]' : 'mt-2 text-[0.9rem]'} leading-snug text-center max-w-[38ch]`} style={{ color: 'var(--color-ink-dim)' }}>
        {holdsText}
        {floorText && <> <button type="button" onClick={() => setHist(h => (h + 1) % HISTORIES.length)} aria-label={`${floorText} Next bad history`} className="text-left" style={{ color: 'inherit' }}>{floorText}</button></>}
        {hasMoney && <> <button type="button" onClick={() => setView(v => (v === 'levers' ? 'home' : 'levers'))} style={{ color: 'var(--color-calm-strong)' }}>What would help?</button></>}
      </p>
      <div className={`flex gap-4 ${compact ? 'mt-0.5 text-[0.72rem]' : 'mt-1 text-[0.76rem]'}`} style={{ color: 'var(--color-ink-faint)' }}>
        <button type="button" onClick={() => setView('edge')}>Every retirement</button>
        <button type="button" onClick={onDetails}>Everything else, in Details</button>
      </div>
      <div className="sr-only">{ranges('A')}{!single && ranges('B')}</div>

      {/* ── Trays and views that grow from the dial ───────────────────── */}
      <AnimatePresence>
        {view === 'levers' && (
          <Tray key="levers" title="What would help most" onClose={() => setView('home')}>
            {!levers ? <p className="text-[0.84rem] px-1" style={{ color: 'var(--color-ink-dim)' }}>Measuring each action across the same futures…</p>
              : !topLevers.length ? <p className="text-[0.84rem] px-1" style={{ color: 'var(--color-ink-dim)' }}>Nothing measured would clearly improve this plan. That is a good place to be.</p>
              : topLevers.slice(0, plus ? 6 : 3).map((l: any, i: number) => (
                <button key={l.id} type="button" onClick={() => { update(() => ({ ...l.patch, codeSet: plan.codeSet })); setView('home'); }}
                  className="w-full text-left flex items-start gap-3 py-2.5 px-1" style={{ borderTop: i ? '1px solid var(--color-hairline)' : 'none' }}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9rem] font-semibold">{l.label}</span>
                    {(plus || i === 0) && <span className="block text-[0.76rem] mt-0.5" style={{ color: 'var(--color-ink-dim)' }}>{l.detail}</span>}
                  </span>
                  <span className="tnum shrink-0 text-[0.9rem] font-extrabold" style={{ color: 'var(--color-sage-strong)' }}>+{Math.round(l.dConf * 100)} of 100</span>
                </button>))}
            {levers && !plus && topLevers.length > 3 && (
              <button type="button" onClick={onUpgrade} className="w-full text-left text-[0.78rem] py-2 px-1" style={{ borderTop: '1px solid var(--color-hairline)', color: 'var(--color-ink-dim)' }}>
                Every lever, with its detail, is in <b style={{ color: 'var(--color-calm-strong)' }}>Plus</b>.</button>)}
            <p className="text-[0.7rem] mt-2 px-1" style={{ color: 'var(--color-ink-faint)' }}>Tap one and the dial turns to it. Each is the plan run again through the same simulated futures; prompts, not advice.</p>
          </Tray>)}
        {view === 'edge' && (
          <Tray key="edge" title="Every retirement you could choose" onClose={() => setView('home')} tall>
            <DecisionMap plan={plan} update={update} />
          </Tray>)}
      </AnimatePresence>
    </div>
  );
}

// A tray grows from the bottom of the instrument; it never scrolls the page.
function Tray({ title, onClose, children, tall }: { title: string; onClose: () => void; children: React.ReactNode; tall?: boolean }) {
  return (
    <motion.div role="dialog" aria-label={title} className="fixed left-0 right-0 z-30 mx-auto max-w-[560px] rounded-t-[24px] px-4 pt-3 overflow-y-auto"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.4rem)', maxHeight: tall ? '72vh' : '52vh', background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', boxShadow: '0 -12px 40px rgba(0,0,0,.18)', paddingBottom: 16 }}
      initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[0.72rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-ink-faint)' }}>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: 'var(--color-ink-dim)' }}><X size={16} /></button>
      </div>
      {children}
    </motion.div>
  );
}

// Your money over time: the typical path and two dozen simulated futures as
// faint strands, in today's money; the floor under the worst real history.
function Strands({ plan, dd, mc, viz, width, height, bands, floor, onTap }: {
  plan: any; dd: Drawdown; mc: MC | null; viz: { base: [number, number][]; low: [number, number][]; high: [number, number][] };
  width: number; height: number; bands: boolean; floor: number | null; onTap: () => void;
}) {
  const cv = useRef<HTMLCanvasElement | null>(null);
  const retireAge = plan.retireYear - plan.partnerA.birthYear;
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = width, H = height;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const base = viz.base; if (!base.length) return;
    const y0 = base[0][0], y1 = base[base.length - 1][0], rows = dd.rows as any[];
    const D = (v: number, y: number) => deflate(v, y, plan.startYear, plan.inflation);
    const pre = base.filter(p => p[0] < plan.retireYear);
    const tracks: [number, number][][] = (mc?.tracks || []).filter((_: any, i: number) => i % Math.max(1, Math.floor((mc?.tracks?.length || 1) / (bands ? 60 : 24))) === 0)
      .map((t: number[]) => [...pre, ...t.map((v, i) => [rows[i]?.year ?? plan.retireYear + i, D(v, rows[i]?.year ?? plan.retireYear + i)] as [number, number])]);
    const tops = [...tracks.map(t => Math.max(...t.map(p => p[1]))), Math.max(...viz.high.map(p => p[1]))].sort((a, b) => a - b);
    const max = Math.max(1, (bands ? tops[tops.length - 1] : tops[Math.floor(tops.length * 0.9)]) || 1) * 1.05;
    const X = (y: number) => 4 + ((y - y0) / Math.max(1, y1 - y0)) * (W - 8), Y = (v: number) => H - 16 - (Math.min(max, Math.max(0, v)) / max) * (H - 26);
    const line = (s: [number, number][], colour: string, w: number, alpha: number) => {
      g.beginPath(); s.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))));
      g.strokeStyle = colour; g.lineWidth = w; g.globalAlpha = alpha; g.stroke(); g.globalAlpha = 1;
    };
    const ocean = css('--color-ocean'), accent = css('--color-calm'), dim = css('--color-ink-dim'), faint = css('--color-ink-faint');
    if (bands) {
      const band = (lo: [number, number][], hi: [number, number][], alpha: number) => {
        g.beginPath(); hi.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))));
        lo.slice().reverse().forEach(p => g.lineTo(X(p[0]), Y(p[1]))); g.closePath(); g.fillStyle = ocean; g.globalAlpha = alpha; g.fill(); g.globalAlpha = 1;
      };
      band(viz.low, viz.high, 0.12);
    }
    tracks.forEach(t => line(t, ocean, 1, bands ? 0.16 : 0.22));
    line(base, accent, bands ? 2 : 1.6, 1);
    // The stop line and the labels.
    g.setLineDash([2, 3]); g.beginPath(); g.moveTo(X(plan.retireYear), 2); g.lineTo(X(plan.retireYear), H - 16); g.strokeStyle = faint; g.lineWidth = 1; g.stroke(); g.setLineDash([]);
    g.font = '500 11px system-ui, sans-serif'; g.fillStyle = dim; g.textBaseline = 'alphabetic';
    g.textAlign = 'left'; g.fillText(`today ${new Date().getFullYear() - plan.partnerA.birthYear}`, 4, H - 4);
    g.textAlign = 'center'; g.fillText(`stop ${retireAge}`, Math.min(W - 40, Math.max(40, X(plan.retireYear))), 11);
    g.textAlign = 'right'; g.fillText(`to ${plan.horizonAge}`, W - 4, H - 4);
  }, [plan, dd, mc, viz, width, height, bands, retireAge]);
  return (
    <div className="relative mt-1.5 shrink-0" style={{ width, height }}>
      <canvas ref={cv} className="block" style={{ width, height }} role="img"
        aria-label={`What you have from today to ${plan.horizonAge}, in today's money; stopping at ${retireAge}; simulated futures as faint strands${floor != null ? `; the floor under the worst real history is ${fmt(floor)} a month` : ''}`} />
      <button type="button" onClick={onTap} aria-label={bands ? 'Back to the dial' : 'See the range of futures'} className="absolute inset-0" />
    </div>
  );
}

