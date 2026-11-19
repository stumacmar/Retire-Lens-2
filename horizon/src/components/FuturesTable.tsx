import { useMemo, useState } from 'react';
import { countWindows, essentialOf, lanternModel } from '../lantern/adapter';
import { fmt, fmtK } from '../lib/format';

/**
 * Every year of the futures as a table: what the home's picture shows a floor
 * at a time, all at once and as text. For each year of the plan: what is
 * planned, how many of 100 simulated futures pay it in full, pay less but
 * cover the essentials, or fall short, and the money left in the unluckiest
 * 1 in 10, the middle and the luckiest 1 in 10, in today's money.
 *
 * The rows come from the same adapter as the tower, so the two cannot
 * disagree. (Scout, 19 November 2026: Portfolio Visualizer reports chosen
 * percentiles as figures and FI Calc exports every simulation; here the
 * year-by-year figures existed only as a picture.)
 */
export default function FuturesTable({ plan, rows, mc }: { plan: any; rows: any[]; mc: any }) {
  const [open, setOpen] = useState(false);
  const model = useMemo(() => (open && mc?.perAgePaid ? lanternModel({ plan, rows, mc, stress: null, essential: essentialOf(plan) }) : null), [open, plan, rows, mc]);
  const k = (v: number) => (v < 500 ? '£0' : fmtK(v));
  return (
    <div className="mt-3">
      <button type="button" data-futures-table-toggle aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="w-full min-h-[44px] rounded-xl text-[0.84rem] font-semibold"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)', color: 'var(--color-ink)' }}>
        {open ? 'Hide the year-by-year table' : 'Show every year as a table'}
      </button>
      {open && model && (
        <>
          <p className="text-[0.74rem] leading-snug mt-2" style={{ color: 'var(--color-ink-dim)' }}>
            Of 100 simulated futures, for each year: how many pay that year’s plan in full, how many pay less but still cover the essentials
            ({fmt(model.essential)} a year), and how many fall short. Then the money left at the end of the year, in today’s money.
          </p>
          <div className="overflow-x-auto rounded-xl mt-2" tabIndex={0} role="region" aria-label="The futures, year by year, as a table; scrolls sideways" data-futures-table style={{ background: 'var(--color-surface)' }}>
            <table className="w-full text-[0.72rem] tnum" style={{ borderCollapse: 'collapse', minWidth: 470 }}>
              <caption className="sr-only">For each year of the plan: the planned spend, how many of 100 simulated futures pay it in full, pay less but cover the essentials, or fall short, and the money left in the unluckiest 1 in 10, the middle and the luckiest 1 in 10 futures.</caption>
              <thead>
                <tr style={{ color: 'var(--color-ink-faint)' }}>
                  <th scope="col" className="text-left font-semibold pl-2.5 pr-1 py-2">Age</th>
                  <th scope="col" className="text-right font-semibold px-1.5 py-2">Plan a year</th>
                  <th scope="col" className="text-right font-semibold px-1.5 py-2">In full</th>
                  <th scope="col" className="text-right font-semibold px-1.5 py-2">Less</th>
                  <th scope="col" className="text-right font-semibold px-1.5 py-2">Short</th>
                  <th scope="col" className="text-right font-semibold px-1.5 py-2">Left: unlucky</th>
                  <th scope="col" className="text-right font-semibold px-1.5 py-2">Middle</th>
                  <th scope="col" className="text-right font-semibold pl-1.5 pr-2.5 py-2">Lucky</th>
                </tr>
              </thead>
              <tbody>
                {model.floors.map(f => {
                  const c = countWindows(f.windows);
                  return (
                    <tr key={f.year} data-age={f.age} style={{ borderTop: '1px solid var(--color-hairline)', color: 'var(--color-ink)' }}>
                      <th scope="row" className="text-left font-semibold pl-2.5 pr-1 py-1.5">{f.age}{f.partnerAge != null ? <span style={{ color: 'var(--color-ink-faint)' }}> · {f.partnerAge}</span> : null}</th>
                      <td className="text-right px-1.5 py-1.5">{fmt(f.spend)}</td>
                      <td className="text-right px-1.5 py-1.5 font-semibold" data-full>{c.full * 5}</td>
                      <td className="text-right px-1.5 py-1.5">{c.floor * 5}</td>
                      <td className="text-right px-1.5 py-1.5">{c.short * 5}</td>
                      <td className="text-right px-1.5 py-1.5">{k(f.wealth.p10)}</td>
                      <td className="text-right px-1.5 py-1.5">{k(f.wealth.p50)}</td>
                      <td className="text-right pl-1.5 pr-2.5 py-1.5">{k(f.wealth.p90)}</td>
                    </tr>);
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[0.7rem] leading-snug mt-1.5" style={{ color: 'var(--color-ink-faint)' }}>
            Each count is to the nearest 5 of 100, for that year alone: a future can pay in full one year and fall short the next. “Unlucky” and “lucky” are the 10th and 90th of 100 futures.
          </p>
        </>
      )}
    </div>
  );
}
