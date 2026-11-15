import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtK } from '../lib/format';
import { trancheScenarios, trancheWords, type Tranche } from '../lib/tranches';

/**
 * One tranche, opened from a wall of the time tunnel: what it is, what it is
 * assumed to earn, and what it would be worth at each age (today's money)
 * in positive, base and poor markets and if 2008 struck the day work stops.
 * Four lines, each labelled at its end; the base line is the strongest.
 */
export default function TrancheSheet({ plan, tranche, first, last, at }: { plan: any; tranche: Tranche; first: number; last: number; at: number | null }) {
  const scen = useMemo(() => trancheScenarios(plan, tranche.key, first, last), [plan, tranche.key, first, last]);
  const words = trancheWords(plan, tranche.key);
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => { const el = ref.current; if (!el) return; const m = () => setW(el.clientWidth || 320); m(); const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null; ro?.observe(el); return () => ro?.disconnect(); }, []);

  const h = 200, padL = 8, padR = 104, padT = 14, padB = 26;
  const n = last - first + 1;
  // The scale follows the base, poor and 2008 lines; a positive line far above them runs off the top, and its label says where it ends.
  const others = Math.max(1, ...scen.filter(s => s.key !== 'positive').flatMap(s => s.values));
  const top = Math.min(Math.max(1, ...scen.flatMap(s => s.values)), others * 1.9) * 1.06;
  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (w - padL - padR);
  const y = (v: number) => padT + (1 - v / top) * (h - padT - padB);
  const style: Record<string, { stroke: string; width: number; dash?: string }> = {
    positive: { stroke: 'var(--color-ink-dim)', width: 1.5 },
    base: { stroke: tranche.colour.replace(/ \d+%, var\(--color-canvas\)/, ' 100%, var(--color-canvas)'), width: 3 },
    poor: { stroke: 'var(--color-slate)', width: 1.5 },
    gfc: { stroke: 'var(--color-ink)', width: 1.5, dash: '4 3' },
  };
  // Direct labels at the right, nudged apart so they never sit on each other.
  const short: Record<string, string> = { positive: 'Positive', base: 'Base', poor: 'Poor', gfc: '2008' };
  const ends = scen.map(s => ({ key: s.key, name: short[s.key], v: s.values[n - 1], off: s.values[n - 1] > top, y: Math.max(padT, y(s.values[n - 1])) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 13) ends[k].y = ends[k - 1].y + 13;
  const ticks = [first, ...[60, 65, 70, 75, 80, 85, 90, 95, 100].filter(a => a > first + 2 && a < last - 2), last];
  const baseVals = scen.find(s => s.key === 'base')!.values;
  const show = (a: number) => fmtK(baseVals[Math.max(0, Math.min(n - 1, a - first))]);
  const mid = Math.min(last, Math.max(first, at ?? Math.round((first + last) / 2)));

  return (
    <div data-tranche-sheet={tranche.key}>
      <p className="text-[0.92rem] leading-snug" style={{ color: 'var(--color-ink)' }}>{words.what}</p>
      <p className="mt-1.5 text-[0.84rem] leading-snug" style={{ color: 'var(--color-ink-dim)' }}>{words.assumed}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[first, mid, last].map((a, k) => (
          <div key={k} className="rounded-xl py-2" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
            <div className="text-[0.72rem]" style={{ color: 'var(--color-ink-dim)' }}>At {a}</div>
            <div data-tranche-at={a} className="tnum text-[1.05rem] font-bold" style={{ color: 'var(--color-ink)' }}>{show(a)}</div>
          </div>))}
      </div>
      <p className="mt-3 text-[0.78rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>What it could be worth, in today's money</p>
      <div ref={ref} className="mt-1 w-full">
        <svg width={w} height={h} role="img" aria-label={`${tranche.name}: in base markets ${show(first)} at ${first}, ${show(last)} at ${last}. In poor markets ${fmtK(scen.find(s => s.key === 'poor')!.values[n - 1])} at ${last}; in positive markets ${fmtK(scen.find(s => s.key === 'positive')!.values[n - 1])}.`}>
          <line x1={padL} x2={w - padR} y1={y(0)} y2={y(0)} style={{ stroke: 'var(--color-hairline)' }} />
          {ticks.map(a => (
            <text key={a} x={x(a - first)} y={h - 8} textAnchor="middle" fontSize="11" style={{ fill: 'var(--color-ink-dim)' }}>{a}</text>))}
          <defs><clipPath id={`tr-clip-${tranche.key}`}><rect x="0" y={padT - 2} width={w} height={h} /></clipPath></defs>
          {scen.map(s => (
            <polyline clipPath={`url(#tr-clip-${tranche.key})`} key={s.key} data-scenario={s.key} fill="none" strokeLinejoin="round" strokeLinecap="round"
              points={s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
              style={{ stroke: style[s.key].stroke }} strokeWidth={style[s.key].width} strokeDasharray={style[s.key].dash} />))}
          {ends.map(e => (
            <text key={e.key} x={w - padR + 6} y={e.y + 4} fontSize="11" fontWeight={e.key === 'base' ? 700 : 500} style={{ fill: e.key === 'base' ? 'var(--color-ink)' : 'var(--color-ink-dim)' }}>
              {e.name} {fmtK(e.v)}{e.off ? ' ↑' : ''}</text>))}
        </svg>
      </div>
      <p className="mt-2 text-[0.76rem] leading-snug" style={{ color: 'var(--color-ink-faint)' }}>
        Each line is the whole plan replayed with different markets: your positive, base and poor growth rates, and the 2008 crash and recovery starting the day you stop work. Spending, tax and the other tranche move with it. An illustration, not a forecast.
      </p>
    </div>
  );
}
