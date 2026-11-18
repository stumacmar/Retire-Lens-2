import { E } from './usePlan';

/**
 * Two risks, put side by side: the money running short, and still being here
 * when it does. A plan that runs short at 92 in one future in ten is a
 * different thing from one that runs short at 72, because far fewer people
 * are still here at 92. Both figures come from the engine: the age from the
 * simulated futures (`shortAgeP10`, partner A's age), the chance of being
 * here from its mortality curve (`lifeOdds`), and the joint figure from
 * `successLifetime`, which weights every future by how long the household
 * lasts. National averages; half of people live longer than the middle age.
 *
 * (Scout, 18 November 2026. Engaging Data's "Rich, Broke or Dead" draws the
 * two together as a chart; the UK calculators examined show neither.)
 */
export type StillHere = {
  couple: boolean;
  /** The age by which the unluckiest 1 in 10 futures has run short, or null when none has. */
  age: number | null;
  /** Of 100: the chance you are (or, for a couple, at least one of you is) still here at that age. */
  here: number | null;
  /** Of 100: futures in which the money runs short while you are (one of you is) still here. */
  shortWhileHere: number;
};

export function stillHere(plan: any, mc: { shortAgeP10?: number | null; successLifetime: number }): StillHere {
  const age = mc.shortAgeP10 == null ? null : mc.shortAgeP10;
  let here: number | null = null, couple = false;
  const o: any = (E as any).lifeOdds(plan, age == null ? undefined : age);
  couple = !!o.b;
  if (age != null && o.a) {
    const ahead = age - o.a.ageNow;
    const pa = o.a.at(age), pb = o.b ? o.b.at(o.b.ageNow + ahead) : 0;
    here = Math.round((1 - (1 - pa) * (1 - pb)) * 100);
  }
  return { couple, age, here, shortWhileHere: Math.round((1 - mc.successLifetime) * 100) };
}

/** The sentences for "What could go wrong?". */
export function stillHereWords(s: StillHere): string {
  const who = s.couple ? 'one of you is' : 'you are';
  const joint = s.shortWhileHere < 1
    ? `Counting how long people live, the money runs short while ${who} still here in fewer than 1 of 100 futures.`
    : `Counting how long people live, the money runs short while ${who} still here in about ${s.shortWhileHere} of 100 futures.`;
  const at = s.age != null && s.here != null
    ? `${s.couple ? 'The chance at least one of you is' : 'The chance you are'} still here at ${s.age} is about ${s.here} in 100. `
    : '';
  return `${at}${joint} These are national averages, and many people live longer.`;
}
