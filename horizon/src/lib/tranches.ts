import { E } from './usePlan';
import { deflate } from './format';

/**
 * The money behind the plan, in two tranches, year by year, in today's
 * money: the chips on the home's island and the sheets they open.
 *
 * A plan with the retirement architecture holds a safe ladder (years of
 * spending in gilts and cash; income is paid from it) and a growth engine
 * (shares with some gold; it refills the ladder when markets are up). The
 * engine tracks both every year (`rows[].ladder`, `rows[].engine`), and
 * together they are all the invested money. A plain plan has no sleeves, so
 * its two tranches are the wrappers: pensions, and ISAs with cash.
 *
 * Performance is shown by replaying the same plan through the engine under
 * the plan's own poor, base and positive growth rates and the 2008 shape
 * from the day work stops, so each tranche can be seen in good and bad
 * markets.
 */
export type TrancheKey = 'ladder' | 'engine' | 'pensions' | 'isas';
export type Tranche = { key: TrancheKey; name: string; colour: string; values: number[] };

const COLOUR: Record<TrancheKey, string> = {
  ladder: 'color-mix(in srgb, var(--color-calm) 55%, var(--color-canvas))',
  pensions: 'color-mix(in srgb, var(--color-calm) 55%, var(--color-canvas))',
  engine: 'color-mix(in srgb, var(--color-ring) 70%, var(--color-canvas))',
  isas: 'color-mix(in srgb, var(--color-ring) 70%, var(--color-canvas))',
};
const NAME: Record<TrancheKey, string> = { ladder: 'Safe ladder', engine: 'Growth engine', pensions: 'Pensions', isas: 'ISAs and cash' };

const pick = (key: TrancheKey) => (r: any) =>
  key === 'ladder' ? (r.ladder || 0)
    : key === 'engine' ? (r.engine || 0)
      : key === 'pensions' ? (r.potA || 0) + (r.potB || 0)
        : (r.isaA || 0) + (r.isaB || 0) + (r.cash || 0) + (r.gia || 0);

export const trancheKeys = (plan: any): [TrancheKey, TrancheKey] => (plan.architecture?.on ? ['ladder', 'engine'] : ['pensions', 'isas']);

/** One value a year (today's money) for each age from `first` to `last`, from a drawdown's rows. */
function series(plan: any, rows: any[], key: TrancheKey, first: number, last: number) {
  const by = new Map<number, any>(rows.map(r => [r.ageA, r]));
  const f = pick(key), out: number[] = [];
  for (let a = first; a <= last; a++) {
    const r = by.get(a);
    out.push(r ? Math.max(0, deflate(f(r), r.year, plan.startYear, plan.inflation || 0)) : 0);
  }
  return out;
}

export function tranchesOf(plan: any, dd: { rows?: any[] } | null | undefined, first: number, last: number): [Tranche, Tranche] {
  const rows = dd?.rows || [];
  return trancheKeys(plan).map(k => ({ key: k, name: NAME[k], colour: COLOUR[k], values: series(plan, rows, k, first, last) })) as [Tranche, Tranche];
}

export type Scenario = { key: 'positive' | 'base' | 'poor' | 'gfc'; name: string; values: number[] };

/** The same tranche under the plan's positive, base and poor growth, and 2008 striking the day work stops. */
export function trancheScenarios(plan: any, key: TrancheKey, first: number, last: number): Scenario[] {
  const arch = !!plan.architecture?.on;
  const run = (Q: any, opts?: any) => series(plan, E.drawdown(Q, opts).rows, key, first, last);
  const g = (v: any, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const base = g(plan.growthBase, plan.growth);
  return [
    { key: 'positive', name: 'Positive markets', values: run({ ...plan, growth: g(plan.growthBull, base + 0.03) }) },
    { key: 'base', name: 'Base', values: run({ ...plan, growth: base }) },
    { key: 'poor', name: 'Poor markets', values: run({ ...plan, growth: g(plan.growthBear, base - 0.03) }) },
    { key: 'gfc', name: '2008 the day you stop', values: arch
      ? run({ ...plan, growth: base, architecture: { ...plan.architecture, stressPath: 'gfc' } })
      : run({ ...plan, growth: base }, { returnPath: (E as any).STRESS_PATHS.gfc }) },
  ];
}

/** What each tranche is, and what it is assumed to earn, in words. */
export function trancheWords(plan: any, key: TrancheKey) {
  const AR = plan.architecture || {};
  const p = (v: number, dp = 1) => `${(Math.round(v * 1000) / 10).toFixed(dp).replace(/\.0$/, '')}%`;
  const infl = plan.inflation || 0, fee = plan.fee || 0;
  switch (key) {
    case 'ladder': return {
      what: `About ${AR.ladderYears || 0} years of your spending, held in gilts and cash. Your income is paid from here, so a fall in markets need not force you to sell shares while the ladder lasts; a long fall can empty it.`,
      assumed: `Assumed to earn about ${p(AR.giltReal || 0)} a year above inflation.` };
    case 'engine': return {
      what: `Shares${AR.goldPct ? `, with ${p(AR.goldPct, 0)} in gold,` : ''} left to grow. When markets are up it tops the safe ladder back up; when they are down it is left alone.`,
      assumed: `Expected to earn about ${p(AR.equityReal || 0)} a year above inflation, but it swings: in a typical year it could be ${p(AR.equitySd || 0, 0)} higher or lower.` };
    case 'pensions': return {
      what: 'Your pension pots. A quarter can come out tax-free; the rest is taxed as income when you draw it.',
      assumed: `Assumed to grow ${p(plan.growth || 0)} a year before inflation of ${p(infl)}, less charges of ${p(fee, 2)}.` };
    default: return {
      what: 'Your ISAs, cash and any general account. Nothing to pay in tax when you draw from ISAs.',
      assumed: `Invested ISAs are assumed to grow ${p(plan.growth || 0)} a year before inflation of ${p(infl)}, less charges of ${p(fee, 2)}.` };
  }
}
