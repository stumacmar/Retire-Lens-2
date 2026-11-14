import type { MC } from '../engine/engine';
import type { Rail } from '../lib/insights';
import { fmt } from '../lib/format';

/**
 * "What could go wrong": the central case, a poor run and three real bad
 * histories replayed from the day you stop, hardest first, then the simulated
 * futures. Each row is the most you could spend a month and still be paid
 * every year, with one sentence on what the case means and the cut in
 * spending that would see it through. The 2008 path includes the bull decade
 * that followed it, so as a stress it is the mildest of the set; it stays in
 * the Explore stress tests but not here.
 */
const RISKS: { key: string; name: string; means: (plan: any) => string }[] = [
  { key: 'base', name: 'The central case', means: p => `Returns of ${Math.round(p.growthBase * 100)}% a year, every year.` },
  { key: 'poor', name: 'A poor run', means: p => `Returns of ${Math.round(p.growthBear * 100)}% a year, every year.` },
  { key: 'japan', name: 'Japan from 1990', means: () => 'Two lost decades in the markets, starting the day you stop.' },
  { key: 'stagflation', name: 'The 1970s', means: () => 'High inflation and falling markets, from the day you stop.' },
  { key: 'crashflat', name: 'A 30% fall, then flat', means: () => 'A crash the day you stop and five flat years after it.' }];

export default function RiskPanel({ plan, mc, rails }: { plan: any; mc: MC | null; rails: Rail[] | null }) {
  const month = Math.round((plan.targetNet || 0) / 12);
  return (
    <div data-risk-panel>
      <p className="text-[0.8rem] leading-relaxed px-1 mb-1" style={{ color: 'var(--color-ink-dim)' }}>
        The most you could spend a month, after tax in today's money, and still be paid every year to {plan.horizonAge} in each case. You ask for <b className="tnum" style={{ color: 'var(--color-ink)' }}>{fmt(month)}</b>.
      </p>
      {!rails ? <p className="text-[0.84rem] px-1 py-2" style={{ color: 'var(--color-ink-dim)' }}>Running your plan through each history…</p>
        : RISKS.map((k, i) => {
          const r = rails.find(x => x.key === k.key); if (!r) return null;
          const v = Math.round(r.year / 12 / 10) * 10, short = v < month;
          return (
            <div key={k.key} data-risk={k.key} className="flex items-start gap-3 py-2.5 px-1" style={{ borderTop: i ? '1px solid var(--color-hairline)' : 'none' }}>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9rem] font-semibold">{k.name}</span>
                <span className="block text-[0.76rem] mt-0.5" style={{ color: 'var(--color-ink-dim)' }}>{k.means(plan)} {short
                  ? `Spending ${fmt(month - v)} a month less would see it through.`
                  : 'What you ask would still be paid.'}</span>
              </span>
              <span className="tnum shrink-0 text-right">
                <span className="block text-[0.95rem] font-extrabold" style={{ color: short ? 'var(--color-hope)' : 'var(--color-sage-strong)' }}>{fmt(v)}</span>
                <span className="block text-[0.68rem]" style={{ color: 'var(--color-ink-faint)' }}>{short ? 'short of your ask' : 'covers your ask'}</span>
              </span>
            </div>);
        })}
      <div data-risk="futures" className="py-2.5 px-1" style={{ borderTop: '1px solid var(--color-hairline)' }}>
        <span className="block text-[0.9rem] font-semibold">{(mc?.nPaths || 2000).toLocaleString()} simulated futures</span>
        <span className="block text-[0.76rem] mt-0.5" style={{ color: 'var(--color-ink-dim)' }}>
          {mc ? <>Random markets from today, through the saving years too. What you ask is paid every year in <b className="tnum">{Math.round(mc.successProb * 100)} of 100</b>.{' '}
            {mc.shortAgeP10 != null ? <>In the unluckiest 1 in 10 the money has run short by <b className="tnum">{mc.shortAgeP10}</b>.</> : <>Even the unluckiest 1 in 10 are paid in full to {plan.horizonAge}.</>}</>
            : 'Working out the futures.'}
        </span>
      </div>
      <p className="text-[0.7rem] mt-2 px-1" style={{ color: 'var(--color-ink-faint)' }}>
        Scenarios, not predictions. The histories are real sequences of returns replayed on your plan; the future will not repeat any of them. Tax rules, inflation and your own life will differ too.
      </p>
    </div>
  );
}
