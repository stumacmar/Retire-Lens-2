/**
 * Higher-rate relief on pension payments made from a bank account
 * (Pension Scout, 17 November 2026; backlog B2).
 *
 * With relief at source the provider adds basic-rate relief (20%: £25 on
 * every £100 paid). Someone who pays tax above 20% can claim the rest back
 * through Self Assessment, or by asking HMRC; it comes back to them, through
 * their tax, not into the pension (GOV.UK, "Tax on your private pension
 * contributions"). On a salary S with gross payments G a year, the extra is
 * the tax saved on that slice of pay at the person's own rates, less the 20%
 * already added: tax(S) − tax(S − G) − 20% of G. The engine's own tax
 * tables are used, so Scotland's rates and the personal-allowance taper are
 * included. The plan does not count this money: it goes to the person.
 */
export function extraRelief(E: any, plan: any, who: any): number {
  const S = Number(who?.income) || 0, paid = (Number(who?.monthlyPension) || 0) * 12;
  if (!who?.contribGrossUp || S <= 0 || paid <= 0) return 0;
  const T = E.taxFor(plan, plan.startYear);
  const G = Math.min(paid * 1.25, S);                 // relief is due on payments up to 100% of earnings
  const extra = E.taxOn(S, T) - E.taxOn(S - G, T) - 0.2 * G;
  return Math.max(0, Math.round(extra / 10) * 10);
}
