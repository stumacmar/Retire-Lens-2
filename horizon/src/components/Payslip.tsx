import { useMemo, useState } from 'react';
import type { Drawdown } from '../engine/engine';
import { deflate, fmt } from '../lib/format';
import { useInsight } from '../lib/useInsight';
import type { Rail } from '../lib/insights';

/**
 * The answer as a payslip: what lands each month, line by line, in today's
 * money — the thing a retiree actually lives on, rather than a pot balance.
 * Step through the years to watch the State Pension arrive and the draw from
 * the pots shrink.
 */
export function Payslip({ plan, dd, single }: { plan: any; dd: Drawdown; single: boolean }) {
  const rows = dd.rows as any[];
  const first = rows[0]?.year ?? plan.retireYear, last = rows[rows.length - 1]?.year ?? first;
  const [pick, setPick] = useState<number | null>(null);
  const year = pick == null || pick < first || pick > last ? first : pick;
  const r = rows.find(x => x.year === year);
  if (!r) return null;
  const M = (v: number) => deflate(v || 0, year, plan.startYear, plan.inflation) / 12;
  const A = plan.partnerA, B = plan.partnerB;
  const lines: [string, number][] = ([
    ['Earnings', M((r.salaryA || 0) + (r.salaryB || 0))],
    ['State Pension', M(r.spA + r.spB)],
    ['Company pension', M(r.dbA + r.dbB)],
    ['From pensions', M(r.grossA + r.grossB)],
    ['Tax-free cash', M(r.tfcA + r.tfcB)],
    ['From ISAs and savings', M((r.isaDraw || 0) + (r.cashDraw || 0) + (r.giaDraw || 0))],
  ] as [string, number][]).filter(l => l[1] >= 1);
  const gross = lines.reduce((a, l) => a + l[1], 0);
  const btn = 'w-[34px] h-[34px] rounded-full flex items-center justify-center text-[1.05rem] disabled:opacity-30';
  const bs = { background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', color: 'var(--color-calm-strong)' };
  return (
    <article className="payslip relative mt-5 rounded-[6px_6px_18px_18px] px-5 pt-5 pb-4 tnum"
      aria-label={`Payslip for ${year}`}
      style={{ background: 'var(--color-paper)', border: '1px solid var(--color-hairline)',
               boxShadow: '0 1px 2px rgba(40,30,20,.08), 0 12px 32px rgba(40,30,20,.10)' }}>
      <div className="flex items-center justify-between gap-3 pb-2.5 mb-2.5" style={{ borderBottom: '1.5px solid var(--color-ink)' }}>
        <span className="text-[0.82rem] font-extrabold tracking-[0.1em] uppercase">Someday payslip</span>
        <span className="flex items-center gap-1.5">
          <button className={btn} style={bs} onClick={() => setPick(Math.max(first, year - 1))} disabled={year <= first} aria-label="Previous year">‹</button>
          <span className="text-[0.9rem] font-semibold w-[3.2em] text-center">{year}</span>
          <button className={btn} style={bs} onClick={() => setPick(Math.min(last, year + 1))} disabled={year >= last} aria-label="Next year">›</button>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[0.76rem] mb-3" style={{ color: 'var(--color-ink-dim)' }}>
        <span>Paid to <b style={{ color: 'var(--color-ink)' }}>{single ? A.name : `${A.name} & ${B.name}`}</b></span>
        <span>Age{single ? '' : 's'} <b style={{ color: 'var(--color-ink)' }}>{single ? year - A.birthYear : `${year - A.birthYear} & ${year - B.birthYear}`}</b></span>
        <span>Tax year <b style={{ color: 'var(--color-ink)' }}>{year}/{String((year + 1) % 100).padStart(2, '0')}</b></span>
        <span>Paid <b style={{ color: 'var(--color-ink)' }}>monthly</b>, today's money</span>
      </div>
      {lines.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-1.5 text-[0.92rem]" style={{ borderBottom: '1px dashed var(--color-hairline)' }}>
          <span>{k}</span><span>{fmt(v)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-3 py-1.5 text-[0.92rem]" style={{ borderBottom: '1px dashed var(--color-hairline)' }}>
        <span style={{ color: 'var(--color-ink-dim)' }}>Gross</span><span>{fmt(gross)}</span>
      </div>
      <div className="flex justify-between gap-3 py-1.5 text-[0.92rem]" style={{ borderBottom: '1px dashed var(--color-hairline)' }}>
        <span>Income tax</span><span style={{ color: 'var(--color-hope)' }}>−{fmt(M(r.tax))}</span>
      </div>
      {r.shortfall > 1 && (
        <div className="flex justify-between gap-3 py-1.5 text-[0.92rem]" style={{ borderBottom: '1px dashed var(--color-hairline)' }}>
          <span>Not covered</span><span style={{ color: 'var(--color-hope)' }}>−{fmt(M(r.shortfall))}</span>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-3 mt-3 pt-3" style={{ borderTop: '1.5px solid var(--color-ink)' }}>
        <span className="text-[0.74rem] font-bold tracking-[0.12em] uppercase">Take home</span>
        <strong className="text-[1.9rem] font-extrabold tracking-tight">{fmt(M(r.netIncome))}</strong>
      </div>
    </article>
  );
}

/**
 * Guardrails: the most you could safely take each month if the years after
 * you stop went like real bad histories, and like each growth lens. Green
 * reaches past your figure (you would live through it unchanged); red stops
 * short (you would trim). Worked out in the insight worker.
 */
export function Guardrails({ plan }: { plan: any }) {
  // Everything except what you spend changes the rails.
  const key = useMemo(() => JSON.stringify({ ...plan, targetNet: 0, spendingPlanOn: false, spending: null }), [plan]);
  const rails = useInsight<Rail[]>('guardrails', plan, key);
  const mo = Math.round((plan.targetNet || 0) / 12);
  if (!rails) {
    return <p className="mt-3 text-[0.85rem]" style={{ color: 'var(--color-ink-faint)' }}>Working out how far it could fall…</p>;
  }
  const max = Math.max(mo * 1.12, ...rails.map(r => r.year / 12)) * 1.04;
  const pc = (v: number) => Math.min(100, (v / max) * 100);
  const bad = rails.filter(r => r.when), base = rails.find(r => r.key === 'base')!;
  const list = (xs: string[]) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  const holds = bad.filter(r => mo <= r.year / 12 + 0.5), breaks = bad.filter(r => mo > r.year / 12 + 0.5);
  const B = ({ children }: { children: React.ReactNode }) => <b className="tnum">{children}</b>;
  let note: React.ReactNode;
  if (mo > base.year / 12 + 0.5) {
    note = <>At <B>{fmt(mo)}</B> a month the plan runs short even at base returns: the most it can pay is <B>{fmt(base.year / 12)}</B>. A bad run would take that to as little as <B>{fmt(bad[0].year / 12)}</B> in {bad[0].when}.</>;
  } else if (!breaks.length) {
    note = <>Your <B>{fmt(mo)}</B> a month gets through every one of these, even {bad[0].when}.</>;
  } else {
    const mild = breaks[breaks.length - 1];
    note = <>{holds.length ? <>Your <B>{fmt(mo)}</B> a month gets through {list(holds.map(r => r.when!))} without a change. </> : null}
      In {mild.when}, you would trim to about <B>{fmt(mild.year / 12)}</B>{breaks.length > 1 ? <>, and in {bad[0].when}, to <B>{fmt(bad[0].year / 12)}</B>.</> : '.'}</>;
  }
  return (
    <section className="mt-7" aria-labelledby="fall-h">
      <h2 id="fall-h" className="text-[1.2rem] font-extrabold tracking-tight">How far could it fall?</h2>
      <p className="mt-1 mb-3 text-[0.86rem]" style={{ color: 'var(--color-ink-dim)' }}>
        The most you could safely take each month if the years after you stop went like these. Green reaches past your
        figure: you would live through it without changing a thing. Red stops short: you would need to trim.
      </p>
      <div className="relative grid gap-2.5 pb-7" role="list" aria-label="Safe monthly take-home under different histories">
        {rails.map(r => {
          const ok = mo <= r.year / 12 + 0.5;
          return (
            <div key={r.key} role="listitem">
              <div className="flex justify-between gap-3 text-[0.84rem]">
                <span style={{ color: 'var(--color-ink-dim)' }}>{r.label}</span>
                <b className="tnum" style={{ color: ok ? 'var(--color-sage-strong)' : 'var(--color-hope)' }}>{fmt(r.year / 12)}</b>
              </div>
              <div className="mt-1 h-[9px] rounded-full" style={{ background: 'var(--color-hairline)' }}>
                <div className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${pc(r.year / 12).toFixed(1)}%`, background: ok ? 'var(--color-sage)' : 'var(--color-hope)', opacity: ok ? 1 : 0.55 }} />
              </div>
            </div>
          );
        })}
        <div className="absolute -top-1 bottom-5 w-[2.5px] rounded pointer-events-none"
          style={{ left: `calc(${pc(mo).toFixed(2)}% - 1px)`, background: 'var(--color-calm-strong)' }} />
        <div className="absolute bottom-0 -translate-x-1/2 text-[0.78rem] font-extrabold whitespace-nowrap tnum pointer-events-none"
          style={{ left: `clamp(56px, ${pc(mo).toFixed(2)}%, calc(100% - 56px))`, color: 'var(--color-calm-strong)' }}>you take {fmt(mo)}</div>
      </div>
      <p className="mt-2 rounded-2xl px-4 py-3 text-[0.92rem] leading-relaxed"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>{note}</p>
    </section>
  );
}
