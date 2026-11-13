import { E } from './usePlan';
import { fmt } from './format';
import type { LivingStandards, LivingStandardSet, LivingTier } from '../engine/engine';

/**
 * Pensions UK (formerly the PLSA) Retirement Living Standards, read from the
 * engine so the figures live in one place. They are yearly spending after tax
 * with the home owned outright — the same footing as the plan's target — so a
 * first-time user can see whether "£3,800 a month" is a Minimum, a Moderate or
 * a Comfortable retirement before they trust the dial with it.
 */
export const LS = (E as any).LIVING_STANDARDS as LivingStandards;
export const standardsFor = (plan: any): LivingStandardSet => (E as any).livingStandards(plan);
export const tierOf = (plan: any, net: number): LivingTier | null => (E as any).livingStandardOf(plan, net);
export const whoText = (plan: any) => (plan.household === 'single' ? 'one person' : 'two people');

/**
 * One quiet line placing a yearly after-tax spend against the standards.
 * `short` is the dial's version: it has one line under the needle on a
 * 375-pixel phone, so "for two" rather than "for two people".
 */
export function standardLine(plan: any, net: number, short = false): string {
  const S = standardsFor(plan), t = tierOf(plan, net);
  const who = short ? (plan.household === 'single' ? 'for one' : 'for two') : `for ${whoText(plan)}`;
  const std = short ? 'standard' : 'living standard';
  if (!t) return short ? `Below the Minimum ${std} ${who}` : `Below the Minimum ${std} (${fmt(S.minimum)} a year) ${who}`;
  const i = LS.tiers.indexOf(t), next = LS.tiers[i + 1];
  const near = net < S[t] * 1.05;                       // within 5% above the line
  if (near) return `About the ${LS.labels[t]} ${std} ${who}`;
  if (!next) return `Above the ${LS.labels[t]} ${std} ${who}`;
  return short ? `Between ${LS.labels[t]} and ${LS.labels[next]} ${who}` : `Between the ${LS.labels[t]} and ${LS.labels[next]} ${std}s ${who}`;
}
