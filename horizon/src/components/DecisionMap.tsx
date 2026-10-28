import { useEffect, useMemo, useRef } from 'react';
import { fmt, fmtK } from '../lib/format';
import { useInsight } from '../lib/useInsight';
import type { DecisionMap as Map } from '../lib/insights';

/**
 * Every retirement you could choose, on one map: across is the year you stop,
 * up is what you spend, and each square is a full run of the engine. The bold
 * line is the edge — the most you can spend for each stop year and still have
 * it last. Your plan is the dot; drag it and the plan changes.
 *
 * The grid is a few hundred engine runs, so it is worked out in the insight
 * worker, and only when something other than the two axes changes.
 */
const L = 48, R = 18, T = 8, B = 26;

export default function DecisionMap({ plan, update }: { plan: any; update: (p: any) => void }) {
  const key = useMemo(() => JSON.stringify({ ...plan, retireYear: 0, targetNet: 0, spendingPlanOn: false, spending: null }), [plan]);
  const map = useInsight<Map>('map', plan, key, 250);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const live = useRef({ plan, map, update });
  live.current = { plan, map, update };

  const age = plan.retireYear - plan.partnerA.birthYear;
  const ix = map ? Math.max(0, Math.min(map.years.length - 1, map.years.indexOf(plan.retireYear))) : 0;
  const here = map?.edge[ix] ?? null, next = map?.edge[ix + 1] ?? null;
  const ok = here != null && plan.targetNet <= here;

  // Draw. Colours come from the theme tokens, so it repaints for dark mode.
  useEffect(() => {
    const cv = canvas.current; if (!cv || !map) return;
    const draw = () => {
      const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      const dpr = window.devicePixelRatio || 1, W = cv.parentElement!.clientWidth, H = Math.round(W * 0.9);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
      const g = cv.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const iw = W - L - R, ih = H - T - B, cw = iw / map.years.length, ch = ih / map.spends.length;
      const lo = map.spends[0], step = map.spends[1] - map.spends[0], hi = map.spends[map.spends.length - 1];
      const fy = (v: number) => T + ih - ((v - lo + step / 2) / (hi - lo + step)) * ih;
      const sage = css('--color-sage'), deep = css('--color-sage-strong'), amber = css('--color-calm'), rose = css('--color-hope');
      map.cells.forEach((col, i) => col.forEach((c, j) => {
        g.fillStyle = c.ok ? (c.left > 900000 ? deep : sage) : ((c.age ?? 0) >= 80 ? amber : rose);
        g.globalAlpha = c.ok ? 0.4 + Math.min(0.5, c.left / 2.5e6) : 0.5 + Math.min(0.4, (88 - (c.age ?? 60)) / 40);
        g.beginPath(); (g as any).roundRect(L + i * cw + 1, T + ih - (j + 1) * ch + 1, cw - 2, ch - 2, 3); g.fill();
      }));
      g.globalAlpha = 1;
      g.save(); g.beginPath(); g.rect(L, T, iw, ih); g.clip();
      g.lineWidth = 3; g.strokeStyle = css('--color-ink'); g.lineJoin = 'round';
      g.beginPath(); map.edge.forEach((v, i) => { const x = L + i * cw + cw / 2, y = fy(v); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
      g.restore();
      g.fillStyle = css('--color-ink-faint'); g.font = '12px ' + getComputedStyle(document.body).fontFamily;
      g.textAlign = 'right'; g.textBaseline = 'middle';
      const tick = hi > 150000 ? 40000 : 20000;
      for (let v = Math.ceil(lo / tick) * tick; v <= hi; v += tick) g.fillText('£' + v / 1000 + 'k', L - 7, fy(v));
      g.textAlign = 'center'; g.textBaseline = 'top';
      map.years.forEach((y, i) => { if ((y - map.years[0]) % 3 === 0) g.fillText(String(y), L + i * cw + cw / 2, T + ih + 7); });
      // your plan
      const p = live.current.plan, k = map.years.indexOf(p.retireYear);
      if (k >= 0) {
        const px = L + k * cw + cw / 2, py = Math.max(T, Math.min(T + ih, fy(p.targetNet)));
        g.strokeStyle = css('--color-calm-strong'); g.lineWidth = 1; g.setLineDash([3, 4]);
        g.beginPath(); g.moveTo(px, T); g.lineTo(px, T + ih); g.moveTo(L, py); g.lineTo(L + iw, py); g.stroke(); g.setLineDash([]);
        g.fillStyle = css('--color-canvas'); g.beginPath(); g.arc(px, py, 13, 0, 7); g.fill();
        g.fillStyle = css('--color-calm-strong'); g.beginPath(); g.arc(px, py, 9, 0, 7); g.fill();
      }
    };
    draw();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', draw); window.addEventListener('resize', draw);
    return () => { mq.removeEventListener('change', draw); window.removeEventListener('resize', draw); };
  }, [map, plan.retireYear, plan.targetNet]);

  // Drag the dot: across picks the year you stop, up picks what you spend.
  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    let down = false;
    const pick = (e: PointerEvent) => {
      const { map: m, plan: p, update: up } = live.current; if (!m) return;
      const r = cv.getBoundingClientRect(), iw = r.width - L - R, ih = r.height - T - B;
      const i = Math.max(0, Math.min(m.years.length - 1, Math.floor((e.clientX - r.left - L) / (iw / m.years.length))));
      const lo = m.spends[0], step = m.spends[1] - m.spends[0], hi = m.spends[m.spends.length - 1];
      const frac = 1 - (e.clientY - r.top - T) / ih;
      const sp = Math.max(lo, Math.min(hi, Math.round((lo - step / 2 + frac * (hi - lo + step)) / 1000) * 1000));
      if (m.years[i] !== p.retireYear || sp !== p.targetNet) up({ retireYear: m.years[i], targetNet: sp, spendingPlanOn: false });
    };
    const dn = (e: PointerEvent) => { down = true; cv.setPointerCapture(e.pointerId); pick(e); };
    const mv = (e: PointerEvent) => { if (down) pick(e); };
    const upE = () => { down = false; };
    const key = (e: KeyboardEvent) => {
      const { map: m, plan: p, update: up } = live.current; if (!m) return;
      const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1000], ArrowDown: [0, -1000] } as any)[e.key];
      if (!d) return; e.preventDefault();
      const yr = Math.max(m.years[0], Math.min(m.years[m.years.length - 1], p.retireYear + d[0]));
      up({ retireYear: yr, targetNet: Math.max(m.spends[0], Math.min(m.spends[m.spends.length - 1], p.targetNet + d[1])), spendingPlanOn: false });
    };
    cv.addEventListener('pointerdown', dn); cv.addEventListener('pointermove', mv);
    cv.addEventListener('pointerup', upE); cv.addEventListener('pointercancel', upE); cv.addEventListener('keydown', key);
    return () => { cv.removeEventListener('pointerdown', dn); cv.removeEventListener('pointermove', mv);
      cv.removeEventListener('pointerup', upE); cv.removeEventListener('pointercancel', upE); cv.removeEventListener('keydown', key); };
  }, []);

  return (
    <div id="explore-map" className="rounded-2xl p-4" style={{ background: 'var(--color-canvas)' }}>
      <div className="text-[0.9rem] font-semibold">Every retirement you could choose</div>
      <p className="text-[0.76rem] mt-0.5 mb-3" style={{ color: 'var(--color-ink-faint)' }}>
        Across is the year you stop, up is what you spend. Each square is a whole retirement, worked out by the engine. Drag the dot to choose yours.
      </p>
      <p className="text-[1.02rem] leading-snug mb-3" aria-live="polite">
        Stop in <b className="tnum">{plan.retireYear}</b> at {age}, live on <b className="tnum">{fmt(plan.targetNet)}</b> a year:{' '}
        {here == null ? '…' : ok
          ? <b style={{ color: 'var(--color-sage-strong)' }}>it lasts.</b>
          : <b style={{ color: 'var(--color-hope)' }}>it runs short.</b>}
      </p>
      <div className="relative">
        {!map && <p className="absolute inset-0 flex items-center justify-center text-[0.85rem]" style={{ color: 'var(--color-ink-faint)' }}>Working out every retirement…</p>}
        <canvas ref={canvas} tabIndex={0} className="block w-full rounded-xl" style={{ touchAction: 'none', cursor: 'crosshair', minHeight: 200 }}
          aria-label="Map of retirements. Arrow keys move your plan: left and right change the year you stop, up and down change what you spend." />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem]" style={{ color: 'var(--color-ink-dim)' }}>
        {[['lasts, with plenty left', 'var(--color-sage-strong)'], ['lasts, just', 'var(--color-sage)'],
          ['runs out in your 80s', 'var(--color-calm)'], ['runs out sooner', 'var(--color-hope)']].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5"><span className="inline-block w-[10px] h-[10px] rounded-[3px]" style={{ background: c }} />{l}</span>
        ))}
      </div>
      {here != null && (
        <p className="mt-3 text-[0.86rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          The bold line is the edge: the most you can spend for each year you might stop and still have it last.
          Stopping in {plan.retireYear}, that is <b className="tnum" style={{ color: 'var(--color-ink)' }}>{fmt(here)}</b> a year.
          {next != null && next > here && <> Working one more year moves it to <b className="tnum" style={{ color: 'var(--color-ink)' }}>{fmt(next)}</b>,
            about <b className="tnum" style={{ color: 'var(--color-ink)' }}>{fmtK(next - here)}</b> more every year for life.</>}
        </p>
      )}
    </div>
  );
}
