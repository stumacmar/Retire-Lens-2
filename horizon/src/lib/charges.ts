import { capacity } from './insights';

/**
 * Charges in context (Pension Scout, 16 November 2026; backlog B12).
 *
 * Someday's default all-in charge is 0.5% a year. UK pension calculators
 * assume anything from 0.3% to 1%, so the Assumptions sheet says where the
 * plan's own charge sits and measures, for this plan, what another 0.25% a
 * year would cost in the monthly income it can pay in full.
 *
 * The market figures are the charges each tool states in its own
 * assumptions, read on the dates in docs/agents/pension-scout-ledger.md.
 */
export const CHARGES_SEEN = {
  asOf: 'November 2026',
  low: 'Nest 0.3% (plus 1.8% of each contribution), Fidelity 0.41%',
  middle: 'Standard Life 0.55%, AJ Bell 0.6%, PensionBee 0.7%, MoneyHelper and Penfold 0.75%',
  high: 'Hargreaves Lansdown 1%',
};

export function chargeBand(fee: number): 'low' | 'typical' | 'high' {
  return fee < 0.0055 ? 'low' : fee <= 0.008 ? 'typical' : 'high';
}

/** What another 0.25% a year in charges costs this plan, a month after tax in today's money, to the nearest £10. */
export function costOfQuarterPoint(E: any, plan: any): number {
  const fee = Number(plan.fee) || 0;
  const now = capacity(E, plan), more = capacity(E, { ...plan, fee: fee + 0.0025 });
  return Math.max(0, Math.round((now - more) / 12 / 10) * 10);
}
