import { E } from './usePlan';
import type { LifeOdds } from '../engine/engine';

/**
 * The odds behind "Plan to age N", read from the engine's mortality curve so
 * the same figures weight the Monte Carlo and sit beside the control. A plan
 * age is a choice, and this is what the choice means: how likely each person
 * is to still be here at N, and the age half of people their age live past.
 */
export const lifeOdds = (plan: any, horizonAge?: number): LifeOdds => (E as any).lifeOdds(plan, horizonAge);

const pc = (p: number) => `${Math.round(p * 100)}%`;

/**
 * One line. `short` is the dial's version (one line under the needle on a
 * 375-pixel phone): "Half live past 86 · 15% reach 95". The long form names
 * the person and, for a couple, the chance one of them is still here at the
 * plan's end.
 */
export function longevityLine(plan: any, horizonAge?: number, short = false): string {
  const o = lifeOdds(plan, horizonAge);
  const a = o.a;
  if (!a) return '';
  if (short) return o.b ? `Half live past ${a.median} · ${pc(o.either)} one of you at ${o.horizonAge}` : `Half live past ${a.median} · ${pc(a.reach)} reach ${o.horizonAge}`;
  const who = a.name === 'You' ? 'you' : a.name;
  const half = `Half of people aged ${a.ageNow} today live past ${a.median}`;
  if (!o.b) return `${half}; the chance ${who} reach${who === 'you' ? '' : 'es'} ${o.horizonAge} is about ${pc(a.reach)}.`;
  return `${half}. The chance at least one of you is still here at ${o.horizonAge} is about ${pc(o.either)} (${who} ${pc(a.reach)}, ${o.b.name} ${pc(o.b.reach)}).`;
}
