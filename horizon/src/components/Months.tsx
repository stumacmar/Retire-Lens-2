import type { Drawdown } from '../engine/engine';
import { deflate } from '../lib/format';
import { monthRows } from '../lib/insights';

/**
 * Your life, month by month. One row a year, one square a month, from today
 * to partner A's plan horizon, coloured by what pays for it: still working,
 * pensions guaranteed for life, your own pots — or nothing. Time is the unit,
 * not money, so a shortfall reads as empty months rather than a negative pound.
 */
const KEY: [string, string, boolean?][] = [
  ['still working', 'var(--color-work)'],
  ['paid by guaranteed pensions', 'var(--color-sage)'],
  ['paid from your pots', 'var(--color-calm)'],
  ['not paid for', 'transparent', true],
];

export default function Months({ plan, dd }: { plan: any; dd: Drawdown }) {
  const rows = monthRows(plan, dd, (v, y) => deflate(v, y, plan.startYear, plan.inflation));
  const ret = rows.filter(r => !r.working), total = ret.length * 12;
  const unpaid = ret.reduce((a, r) => a + r.unpaid, 0), gtd = ret.reduce((a, r) => a + r.guaranteed, 0);
  const A = plan.partnerA;
  const cell = (fill: string, empty = false) => (
    <span className="block rounded-[4px] aspect-square"
      style={{ background: fill, boxShadow: empty ? 'inset 0 0 0 1.5px var(--color-hope)' : undefined }} />
  );
  return (
    <section aria-labelledby="months-h" className="mt-5">
      <h2 id="months-h" className="text-[1.15rem] leading-snug font-bold tracking-tight">
        From {plan.retireYear} to {A.name}&rsquo;s {plan.horizonAge}th birthday is <span className="tnum">{total}</span> months.{' '}
        {unpaid === 0
          ? <span style={{ color: 'var(--color-sage-strong)' }}>All {total} are paid for.</span>
          : <span style={{ color: 'var(--color-hope)' }}><span className="tnum">{total - unpaid}</span> are paid for; <span className="tnum">{unpaid}</span> are not.</span>}
      </h2>
      <p className="mt-1 text-[0.86rem]" style={{ color: 'var(--color-ink-dim)' }}>
        Pensions guaranteed for life cover <b className="tnum" style={{ color: 'var(--color-ink)' }}>{gtd}</b> of them.
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.76rem]" style={{ color: 'var(--color-ink-dim)' }}>
        {KEY.map(([k, c, e]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="inline-block w-[11px] h-[11px] rounded-[3px]" style={{ background: c, boxShadow: e ? 'inset 0 0 0 1.5px var(--color-hope)' : undefined }} />{k}
          </span>
        ))}
      </div>
      <div className="mt-3 grid gap-y-[3px]" role="img"
        aria-label={`${total} months of retirement; ${total - unpaid} paid for, ${gtd} by guaranteed pensions.`}>
        {rows.map(r => {
          const stop = r.year === plan.retireYear;
          return (
            <div key={r.year} className="grid items-center gap-x-[3px]" style={{ gridTemplateColumns: '4.6rem repeat(12, minmax(0, 1fr))' }}>
              <span className="text-[0.72rem] tnum pr-1.5 flex justify-between" style={{ color: stop ? 'var(--color-calm-strong)' : 'var(--color-ink-faint)', fontWeight: stop ? 800 : 400 }}>
                <span>{r.year}</span><span>{stop ? 'stop' : r.year - A.birthYear}</span>
              </span>
              {Array.from({ length: 12 }, (_, m) => (
                <span key={m}>{r.working ? cell('var(--color-work)')
                  : m < r.guaranteed ? cell('var(--color-sage)')
                  : m < r.guaranteed + r.pots ? cell('var(--color-calm)')
                  : cell('transparent', true)}</span>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
