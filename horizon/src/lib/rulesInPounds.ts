import { E } from './usePlan';
import { fmt } from './format';

/**
 * The safe ladder's written rules, in pounds. The rules fire on a "funded
 * ratio" (what you have, over what you still need to a cautious age), which
 * is exact but tells nobody what to watch for. This turns the trigger into
 * the figure a person can check against a statement: "if your money is below
 * about £612,000 in the year you stop, spending is trimmed from £5,000 to
 * £4,500 a month".
 *
 * Nothing is recalculated. For each year the engine reports the two sides of
 * its ratio as it measured them: what the plan still needs (`fundedNeed`,
 * the planned spending still to come) and the guaranteed income still to
 * come (`fundedGuar`), both valued at the gilt yield to the cautious age. The
 * money at which the ratio would equal a rule's threshold follows directly.
 * Everything is in today's money.
 *
 * (Scout, 20 November 2026. Income Lab states its guardrails as money: "If
 * your portfolio drops to the lower guardrail, we reduce spending to
 * $7,400". Flexible Retirement Planner ties its policies to the portfolio's
 * real value.)
 */
export type RuleYear = {
  age: number;
  /** Planned spend a month that year. */
  spend: number;
  /** The central case's money at the end of that year. */
  money: number;
  /** Below this, the rules trim; null when guaranteed income alone keeps the ratio above the trigger. */
  trimBelow: number | null;
  /** Above this (for the lag), the rules raise. */
  raiseAbove: number;
};
export type RulesInPounds = {
  first: RuleYear; later: RuleYear | null;
  trimTo: number; raiseTo: number; floor: number; cutBy: number; raiseBy: number; lag: number;
};

const k = (v: number) => Math.round(v / 1000) * 1000;

export function rulesInPounds(plan: any): RulesInPounds | null {
  const AR = plan.architecture || {};
  if (!AR.on || AR.rulesOn === false) return null;
  let rows: any[];
  try { rows = E.drawdown({ ...plan, growth: plan.growthBase ?? plan.growth }).rows as any[]; } catch { return null; }
  const infl = plan.inflation || 0;
  const year = (i: number): RuleYear | null => {
    const row = rows[i];
    if (!row || row.fundedRatio == null || row.fundedRatio > 50 || !(row.fundedNeed > 0)) return null;
    const f = Math.pow(1 + infl, row.year - plan.startYear);
    const age = row.aliveA === false ? row.ageB : row.ageA;
    // The need was measured at the spending in force that year; the plan's own need is that over the multiplier.
    const need = row.fundedNeed / (row.fundedMult || 1);
    const at = (ratio: number) => ratio * need - row.fundedGuar;
    const trim = at(AR.cutBelow ?? 0.9);
    return { age, spend: row.planTarget / f / 12, money: row.wealth / f, trimBelow: trim > 1000 ? trim : null, raiseAbove: Math.max(0, at(AR.raiseAbove ?? 1.25)) };
  };
  const first = year(0);
  if (!first) return null;
  const cutBy = AR.cutBy ?? 0.1, raiseBy = AR.raiseBy ?? 0.05;
  return {
    first, later: rows.length > 10 ? year(10) : null,
    trimTo: first.spend * Math.max(AR.floorMult ?? 0.75, 1 - cutBy), raiseTo: first.spend * Math.min(AR.capMult ?? 1.25, 1 + raiseBy),
    floor: first.spend * (AR.floorMult ?? 0.75), cutBy, raiseBy, lag: AR.raiseLagYears ?? 2,
  };
}

/** The rules as sentences for Details. */
export function rulesWords(R: RulesInPounds): string {
  const pc = (v: number) => `${Math.round(v * 100)}%`;
  const m = (v: number) => fmt(Math.round(v / 10) * 10);
  const a = R.first;
  const trim = a.trimBelow == null
    ? `In the year you stop work (age ${a.age}) the guaranteed income you have coming keeps the plan above the trigger whatever your pots hold, so the rules would not trim.`
    : `In the year you stop work (age ${a.age}), the rules trim spending by ${pc(R.cutBy)}, from ${m(a.spend)} to ${m(R.trimTo)} a month, if your money is below about ${fmt(k(a.trimBelow))}. ${a.money < a.trimBelow ? `The central case has about ${fmt(k(a.money))} then, which is below it: on these figures spending is trimmed from the start.` : `The central case has about ${fmt(k(a.money))} then.`}`;
  const later = R.later && R.later.trimBelow != null ? ` Ten years on, at ${R.later.age}, the trigger is about ${fmt(k(R.later.trimBelow))}.` : '';
  const raise = ` Spending rises by ${pc(R.raiseBy)}, to ${m(R.raiseTo)} a month, once your money has stayed above about ${fmt(k(a.raiseAbove))} for ${R.lag} year${R.lag === 1 ? '' : 's'} running.`;
  return `${trim}${later} However many trims there are, spending is never taken below ${m(R.floor)} a month.${raise} All in today’s money.`;
}
