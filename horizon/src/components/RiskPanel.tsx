import type { MC } from '../engine/engine';
import type { Rail } from '../lib/insights';
import { fmt } from '../lib/format';
import { shortByOf } from '../lib/shortBy';
import { SP_YEARS_SHORT } from '../lib/insights';

/**
 * "What could go wrong": the central case, a poor run and three real bad
 * histories replayed from the day you stop, then a smaller State Pension
 * (where one is still to start), then the simulated futures. Each row is the
 * most the case could pay a month, every year, and whether that is enough.
 * The 2008 path includes the bull decade that followed it, so as a stress it
 * is the mildest of the set; it stays in the Explore stress tests but not
 * here.
 *
 * More than halved on 22 November 2026 (Pension Scout, a Subtract cycle: 331
 * words to 134 on the panel's plan, against a target of 150). Each row said its result three
 * times (the figure, "short of your ask", "Spending £703 a month less would
 * see it through"): now once. The futures row says what the home says, in the
 * home's words and with the home's age (`shortByOf`), so the two cannot
 * differ, and it says what the unlucky are still paid ("falling to about
 * £2,050 a month"). The chance of still being here at that age, and the
 * figure weighted by how long people live, went: all six readers of the old
 * sheet were lost by them, and the weighted figure is in Explore and the
 * report. Three text sizes, none under 13 px.
 */
const RISKS: { key: string; name: string; means: (plan: any) => string }[] = [
  { key: 'base', name: 'The central case', means: p => `${Math.round(p.growthBase * 100)}% a year, every year.` },
  { key: 'poor', name: 'A poor run', means: p => `${Math.round(p.growthBear * 100)}% a year, every year.` },
  { key: 'japan', name: 'Japan from 1990', means: () => 'Two lost decades, from the day you stop.' },
  { key: 'stagflation', name: 'The 1970s', means: () => 'High inflation and falling markets.' },
  { key: 'crashflat', name: 'A 30% fall, then five flat years', means: () => '' },
  // Not a market: the one source of income most plans lean on hardest. Absent when every State Pension is already in payment.
  { key: 'spLow', name: 'A smaller State Pension', means: () => `A fifth less, for life: ${SP_YEARS_SHORT} missing years of National Insurance, or a change in the rules. Check yours at gov.uk/check-state-pension.` }];

export default function RiskPanel({ plan, mc, rails, unlucky = null }: {
  plan: any; mc: MC | null; rails: Rail[] | null;
  /** What the unluckiest 10 of 100 futures are paid in the plan's last year, a month (as the home's years say it). */
  unlucky?: number | 'full' | null;
}) {
  const month = Math.round((plan.targetNet || 0) / 12);
  const held = ((mc as any)?.perAgeHeld || []) as { age: number; full: number }[];
  // One age for "until": yours when the plan ends, as on the home (it was the plan age, which for a couple can be the other's).
  const toAge = held.length ? held[held.length - 1].age : plan.horizonAge;
  const shortBy = shortByOf(held), count = mc ? Math.round(mc.successProb * 100) : null;
  return (
    <div data-risk-panel>
      <p className="text-[0.875rem] leading-snug px-1 mb-1" style={{ color: 'var(--color-ink-dim)' }}>
        What each case could pay you a month until you are {toAge}. You ask for <b className="tnum" style={{ color: 'var(--color-ink)' }}>{fmt(month)}</b>.
      </p>
      {!rails ? <p className="text-[0.875rem] px-1 py-2" style={{ color: 'var(--color-ink-dim)' }}>Running your plan through each history…</p>
        : RISKS.map((k, i) => {
          const r = rails.find(x => x.key === k.key); if (!r) return null;
          const v = Math.round(r.year / 12 / 10) * 10, short = v < month, means = k.means(plan);
          return (
            <div key={k.key} data-risk={k.key} className="flex items-start gap-3 py-2.5 px-1" style={{ borderTop: i ? '1px solid var(--color-hairline)' : 'none' }}>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-semibold leading-snug">{k.name}</span>
                {means && <span className="block text-[0.875rem] leading-snug mt-0.5" style={{ color: 'var(--color-ink-dim)' }}>{means}</span>}
              </span>
              <span className="tnum shrink-0 text-right">
                <span data-risk-pays className="block text-[1rem] font-extrabold leading-snug" style={{ color: short ? 'var(--color-hope)' : 'var(--color-sage-strong)' }}>{fmt(v)}</span>
                <span data-risk-verdict className="block text-[0.8125rem]" style={{ color: 'var(--color-ink-dim)' }}>{short ? `${fmt(Math.round((month - v) / 10) * 10)} short` : 'enough'}</span>
              </span>
            </div>);
        })}
      <div data-risk="futures" className="py-2.5 px-1" style={{ borderTop: '1px solid var(--color-hairline)' }}>
        <span className="block text-[1rem] font-semibold leading-snug">{(mc?.nPaths || 2000).toLocaleString()} random futures</span>
        <span className="block text-[0.875rem] leading-snug mt-0.5" style={{ color: 'var(--color-ink-dim)' }}>
          {mc && count != null ? <><b className="tnum">{count} times in 100</b>, the money lasts until you are {toAge}.{' '}
            {/* "Runs short" is not "runs out": four of six blind readers took it for nothing at all, so it says what is still paid. */}
            {shortBy ? <span data-risk-short>{shortBy.line}{!shortBy.often && typeof unlucky === 'number' ? <>, falling to about <b className="tnum">{fmt(unlucky)}</b> a month</> : null}.</span> : <span data-risk-short>The worst 10 times in 100 are paid in full.</span>}</>
            : 'Working out the futures.'}
        </span>
      </div>
      <p className="text-[0.8125rem] mt-2 px-1" style={{ color: 'var(--color-ink-dim)' }}>
        Scenarios, not predictions.
      </p>
    </div>
  );
}
