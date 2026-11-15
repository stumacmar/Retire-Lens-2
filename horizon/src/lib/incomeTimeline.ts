import { deflate } from './format';

/**
 * Where each year's income comes from, from the central case's rows, a month
 * at a time in today's money. The sources add up to the gross income; tax
 * comes off the top; what is left is what you get, and the ask is what you
 * asked for. A year where you get less than you ask is short.
 *
 *   gross = State Pension + scheme pensions and annuities + pay
 *         + drawn from pensions (taxable and tax-free) + drawn from ISAs, cash and other savings
 *   you get = gross − tax − anything banked for later
 */
export type SourceKey = 'sp' | 'db' | 'work' | 'pensions' | 'isas';
export type IncomeYear = { age: number; year: number; parts: Record<SourceKey, number>; gross: number; tax: number; net: number; ask: number; short: number; trim: number };

export const SOURCES: { key: SourceKey; name: string; colour: string }[] = [
  { key: 'sp', name: 'State Pension', colour: 'var(--color-ring)' },
  { key: 'db', name: 'Scheme pensions', colour: 'color-mix(in srgb, var(--color-ring) 55%, var(--color-canvas))' },
  { key: 'work', name: 'Pay', colour: 'color-mix(in srgb, var(--color-ink) 28%, var(--color-canvas))' },
  { key: 'pensions', name: 'From pensions', colour: 'color-mix(in srgb, var(--color-calm) 80%, var(--color-canvas))' },
  { key: 'isas', name: 'From ISAs and cash', colour: 'color-mix(in srgb, var(--color-calm) 38%, var(--color-canvas))' },
];

export function incomeTimeline(plan: any, dd: { rows?: any[] } | null | undefined, first: number, last: number): IncomeYear[] {
  const rows = dd?.rows || [];
  const by = new Map<number, any>(rows.map(r => [r.ageA, r]));
  const out: IncomeYear[] = [];
  for (let a = first; a <= last; a++) {
    const r = by.get(a);
    if (!r) { out.push({ age: a, year: plan.retireYear + (a - first), parts: { sp: 0, db: 0, work: 0, pensions: 0, isas: 0 }, gross: 0, tax: 0, net: 0, ask: 0, short: 0, trim: 0 }); continue; }
    const m = (v: number) => Math.max(0, deflate(v || 0, r.year, plan.startYear, plan.inflation || 0) / 12);
    const parts = {
      sp: m(r.spA + r.spB),
      db: m(r.dbA + r.dbB + (r.annuity || 0)),
      work: m((r.salaryA || 0) + (r.salaryB || 0) - (r.contribA || 0) - (r.contribB || 0)),
      pensions: m(r.grossA + r.grossB + r.tfcA + r.tfcB),
      isas: m(r.isaDraw + r.cashDraw + r.giaDraw),
    };
    const gross = parts.sp + parts.db + parts.work + parts.pensions + parts.isas;
    // A structured plan's rules may set this year's target below the ask: that part of the gap is a trim, by design; only
    // what falls below the rules' own target is short.
    const net = m(r.netIncome), ask = m(r.planTarget), ruled = Math.min(ask, m(r.target));
    out.push({ age: a, year: r.year, parts, gross, tax: Math.max(0, gross - net - m(r.banked)), net, ask, short: Math.max(0, ruled - net), trim: Math.max(0, ask - Math.max(net, ruled)) });
  }
  return out;
}
