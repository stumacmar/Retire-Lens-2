import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Drawdown } from '../engine/engine';
import { fmt, fmtK } from '../lib/format';

/**
 * Predict, then reveal. Before Someday shows its answer, you draw what you
 * expect your money to do. Then the engine draws the real line over yours.
 * Committing to a guess first makes the answer land: you see your own
 * assumption next to the projection, not just a number.
 *
 * Shown once per device. The axis is fixed at twice the starting pot, so its
 * scale gives nothing away.
 */
export default function Guess({ plan, series, dd, onDone }: {
  plan: any; series: [number, number][]; dd: Drawdown; onDone: () => void;
}) {
  const A = plan.partnerA;
  const startAge = plan.retireYear - A.birthYear, endAge = plan.horizonAge;
  const real = series.filter(([y]) => y >= plan.retireYear && y - A.birthYear <= endAge).map(([y, v]) => [y - A.birthYear, v] as [number, number]);
  const start = real[0]?.[1] ?? 0, yMax = Math.max(1, start * 2);
  const lasts = dd.exhaustedAgeA == null;
  const endReal = real[real.length - 1]?.[1] ?? 0;

  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [pts, setPts] = useState<Record<number, number>>({});
  const [shown, setShown] = useState(0);            // 0 → 1 as the real line draws in
  const revealed = shown > 0;
  const ages = Object.keys(pts).map(Number).sort((a, b) => a - b);
  const covered = ages.length ? (ages[ages.length - 1] - startAge) / Math.max(1, endAge - startAge) : 0;

  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const dpr = window.devicePixelRatio || 1, W = cv.parentElement!.clientWidth, H = Math.round(Math.min(W * 0.7, 360));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
    const g = cv.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const L = 10, R = 10, T = 12, B = 12, iw = W - L - R, ih = H - T - B;
    const X = (a: number) => L + ((a - startAge) / Math.max(1, endAge - startAge)) * iw;
    const Y = (v: number) => T + ih - Math.max(0, Math.min(1, v / yMax)) * ih;
    const font = getComputedStyle(document.body).fontFamily;
    g.fillStyle = css('--color-surface'); g.beginPath(); (g as any).roundRect(0, 0, W, H, 16); g.fill();
    g.strokeStyle = css('--color-hairline'); g.lineWidth = 1;
    [0.5, 1, 1.5].forEach(f => { g.beginPath(); g.moveTo(L, Y(start * f)); g.lineTo(W - R, Y(start * f)); g.stroke(); });
    g.fillStyle = css('--color-ink-faint'); g.font = `12px ${font}`;
    g.fillText(`${fmtK(start)} when you stop`, L + 6, Y(start) - 7);
    g.fillText('nothing left', L + 6, Y(0) - 7);
    // your line
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = css('--color-ocean'); g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(X(startAge), Y(start)); ages.forEach(a => g.lineTo(X(a), Y(pts[a]))); g.stroke();
    g.fillStyle = css('--color-ocean'); g.beginPath(); g.arc(X(startAge), Y(start), 5.5, 0, 7); g.fill();
    if (!ages.length) {
      g.fillStyle = css('--color-ink-dim'); g.font = `15px ${font}`; g.textAlign = 'center';
      g.fillText('Draw from the dot, left to right', W / 2, H / 2 + 20); g.textAlign = 'left';
    }
    // the engine's line
    if (revealed) {
      const n = Math.max(2, Math.round(real.length * shown));
      g.strokeStyle = css('--color-calm-strong'); g.lineWidth = 4;
      g.beginPath(); real.slice(0, n).forEach(([a, v], i) => i ? g.lineTo(X(a), Y(v)) : g.moveTo(X(a), Y(v))); g.stroke();
      // The key sits in the empty top corner, clear of both lines.
      g.font = `700 12.5px ${font}`; g.textAlign = 'right';
      g.fillStyle = css('--color-ocean'); g.fillText('— your guess', W - R - 6, T + 16);
      g.fillStyle = css('--color-calm-strong'); g.fillText('— Someday', W - R - 6, T + 34);
      if (real.some(([, v]) => v > yMax)) g.fillText('keeps rising ↑', W - R - 6, T + 52);
      g.textAlign = 'left';
    }
  }, [pts, shown, start, yMax, startAge, endAge]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drawing: each age you pass gets your height; a quick stroke fills the gaps.
  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    let down = false;
    const at = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect(), L = 10, R = 10, T = 12, B = 12;
      const age = Math.round(startAge + ((e.clientX - r.left - L) / (r.width - L - R)) * (endAge - startAge));
      const v = Math.max(0, Math.min(yMax, (1 - (e.clientY - r.top - T) / (r.height - T - B)) * yMax));
      if (age <= startAge || age > endAge) return;
      setPts(prev => {
        const next: Record<number, number> = {};
        const known = Object.keys(prev).map(Number).filter(a => a < age);
        known.forEach(a => { next[a] = prev[a]; });
        const from = known.length ? Math.max(...known) : startAge, fv = known.length ? prev[from] : start;
        for (let a = from + 1; a <= age; a++) next[a] = fv + (v - fv) * ((a - from) / (age - from));
        return next;
      });
    };
    const dn = (e: PointerEvent) => { if (shown > 0) return; down = true; cv.setPointerCapture(e.pointerId); at(e); };
    const mv = (e: PointerEvent) => { if (down) at(e); };
    const up = () => { down = false; };
    cv.addEventListener('pointerdown', dn); cv.addEventListener('pointermove', mv);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    return () => { cv.removeEventListener('pointerdown', dn); cv.removeEventListener('pointermove', mv);
      cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); };
  }, [shown, startAge, endAge, yMax, start]);

  const reveal = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(1); return; }
    const t0 = performance.now();
    const step = (t: number) => { const f = Math.min(1, (t - t0) / 900); setShown(Math.max(0.001, f)); if (f < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };

  const youOut = ages.find(a => pts[a] <= start * 0.08);
  const btn = 'w-full rounded-2xl py-4 font-bold text-[1.05rem] active:scale-[0.98] transition-transform';
  return (
    <motion.div className="fixed inset-0 z-[60] overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ background: 'var(--color-canvas)' }}>
      <div className="mx-auto max-w-[560px] px-6 min-h-full flex flex-col justify-center py-[max(2rem,env(safe-area-inset-top))]">
        <p className="text-[0.75rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-calm-strong)' }}>Before we show you</p>
        <h1 className="mt-1 text-[1.9rem] leading-tight font-extrabold tracking-tight">First, a guess.</h1>
        <p className="mt-3 text-[1.02rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          You stop in <b style={{ color: 'var(--color-ink)' }}>{plan.retireYear}</b> with about <b className="tnum" style={{ color: 'var(--color-ink)' }}>{fmtK(start)}</b> in
          today&rsquo;s money, and live on <b className="tnum" style={{ color: 'var(--color-ink)' }}>{fmt(plan.targetNet)}</b> a year.
          Draw how you think your money goes, from {startAge} to {endAge}.
        </p>
        <div className="mt-4">
          <canvas ref={canvas} className="block w-full" style={{ touchAction: 'none', cursor: revealed ? 'default' : 'crosshair' }}
            aria-label={`Drawing area. Draw from left to right how you think your money changes from age ${startAge} to ${endAge}.`} />
          <div className="mt-1.5 flex justify-between text-[0.75rem]" style={{ color: 'var(--color-ink-faint)' }}>
            <span>age {startAge}</span><span>age {endAge}</span>
          </div>
        </div>
        {shown >= 1 && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl px-4 py-3 text-[0.98rem] leading-relaxed" aria-live="polite"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
            {youOut ? <>You drew it running out around <b>{youOut}</b>.</> : <>You drew it lasting, ending near <b className="tnum">{fmtK(pts[ages[ages.length - 1]] ?? 0)}</b>.</>}{' '}
            Someday&rsquo;s projection: {lasts
              ? <>it lasts past {endAge}, with <b className="tnum">{fmtK(endReal)}</b> left in today&rsquo;s money.</>
              : <>it runs out at <b>{dd.exhaustedAgeA}</b>.</>}
          </motion.p>
        )}
        <div className="mt-5">
          {shown >= 1 ? (
            <button onClick={onDone} className={btn} style={{ background: 'var(--color-calm)', color: '#2a1d10' }}>See my plan →</button>
          ) : (
            <button onClick={reveal} disabled={revealed || covered < 0.5} className={btn}
              style={covered >= 0.5 ? { background: 'var(--color-calm)', color: '#2a1d10' }
                : { background: 'var(--color-surface)', color: 'var(--color-ink-faint)', border: '1px solid var(--color-hairline)', cursor: 'not-allowed' }}>
              {covered < 0.5 ? 'Draw your line first' : 'Show me the real answer'}
            </button>
          )}
          {!revealed && <div className="mt-2 flex justify-center gap-6">
            {ages.length > 0 && <button onClick={() => setPts({})} className="py-2 text-[0.9rem] font-medium" style={{ color: 'var(--color-calm-strong)' }}>Start again</button>}
            <button onClick={onDone} className="py-2 text-[0.9rem] font-medium" style={{ color: 'var(--color-ink-faint)' }}>Skip</button>
          </div>}
        </div>
      </div>
    </motion.div>
  );
}
