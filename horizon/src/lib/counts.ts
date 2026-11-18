import { E } from './usePlan';
import { fmt, fmtK } from './format';

/**
 * What the answer is counting, in one line, so nobody has to wonder whether
 * a partner's pots or annuity are in:
 *
 *   Counts you and Jo: £616k in pensions, £95k in ISAs and cash, and
 *   £30k a year guaranteed once it is all in payment. £3,200 a month going
 *   into pensions, tax relief included.
 *
 * Read straight from the plan: nothing here is modelled or estimated.
 * "Guaranteed" is each person's State Pension plus any annuity, company or
 * scheme pension, in today's money, once every one of them has started.
 */
export interface PlanCounts { who: string; pensions: number; savings: number; guaranteed: number; payingIn: number; working: string | null; line: string }

export function planCounts(plan: any): PlanCounts {
  const single = plan.household === 'single';
  const A = plan.partnerA || {}, B = single ? null : (plan.partnerB || {});
  const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const nameA = !A.name || A.name === 'You' ? 'you' : A.name;
  const nameB = B ? (!B.name || B.name === 'Partner' ? 'your partner' : B.name) : '';
  const who = B ? `${nameA} and ${nameB}` : nameA;
  const scheme = (w: any) => (Array.isArray(w?.dbSchemes) ? w.dbSchemes : []).reduce((s: number, t: any) => {
    try { return s + n((E as any).trancheBenefits(plan, w, t).pension); } catch { return s; }
  }, 0);
  const pensions = n(A.pension) + (B ? n(B.pension) : 0);
  const savings = n(A.isa) + (B ? n(B.isa) : 0) + n(plan.cash);
  const guaranteed = n(A.spAmount) + n(A.db) + scheme(A) + (B ? n(B.spAmount) + n(B.db) + scheme(B) : 0);
  // A partner who works on after the household's stop year.
  const later = [A, B].filter(w => w && n(w.stopYear) > n(plan.retireYear))
    .map(w => `${w === A ? (nameA === 'you' ? 'You work' : `${nameA} works`) : `${nameB === 'your partner' ? 'Your partner' : nameB} works`} until ${w.stopYear}`);
  const working = later.length ? later.join('; ') + '.' : null;
  // What goes into pensions each month while people are still working, and
  // whether that figure already includes tax relief (the engine adds 25% to
  // a payment marked as coming from a bank account).
  const start = n(plan.startYear), stop = n(plan.retireYear);
  const payers = [A, B].filter(w => w && n(w.monthlyPension) > 0 && Math.max(stop, n(w.stopYear)) > start);
  const payingIn = payers.reduce((s, w) => s + n(w.monthlyPension) * (w.contribGrossUp ? 1.25 : 1), 0);
  const grossed = payers.filter(w => w.contribGrossUp).length;
  const paid = payers.reduce((s, w) => s + n(w.monthlyPension), 0);
  const relief = !payers.length ? null
    : grossed === 0 ? `${fmt(payingIn)} a month going into pensions, tax relief included.`
      : grossed === payers.length ? `${fmt(payingIn)} a month going into pensions: ${fmt(paid)} paid plus 25% basic-rate tax relief.`
        : `${fmt(payingIn)} a month going into pensions, with basic-rate tax relief added where it is paid from a bank account.`;
  const parts = [
    pensions > 0 ? `${fmtK(pensions)} in pensions` : '',
    savings > 0 ? `${fmtK(savings)} in ISAs and cash` : '',
    guaranteed > 0 ? `${fmtK(guaranteed)} a year guaranteed once it is all in payment` : '',
  ].filter(Boolean);
  const list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] || 'nothing yet';
  const line = `Counts ${who}: ${list}.${relief ? ' ' + relief : ''}${working ? ' ' + working : ''}`;
  return { who, pensions, savings, guaranteed, payingIn, working, line };
}
