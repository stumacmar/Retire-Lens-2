/**
 * The bad case, said as an age, in one place so the home and "What could go
 * wrong?" can never give two ages for the same thing.
 *
 * Where the money lasts at least half the time: the age by which the
 * unluckiest 10 of 100 futures have run short of what was asked. Where it
 * does not: the age by which more than half have. Null where fewer than 10
 * in 100 ever run short. `held` is the simulation's own count, year by year,
 * of the futures still paid in full (`mc.perAgeHeld[].full`), which is what
 * the moon and its row of years draw.
 */
export type ShortBy = { age: number; often: boolean; line: string };

export function shortByOf(held: { age: number; full: number }[] | null | undefined): ShortBy | null {
  if (!held || !held.length) return null;
  const often = Math.round(held[held.length - 1].full * 100) < 50;
  const at = held.find(y => (often ? y.full < 0.5 : y.full <= 0.9));
  return at ? { age: at.age, often, line: often ? `More often than not, it runs short by age ${at.age}` : `In the unluckiest 10 of 100, it runs short by age ${at.age}` } : null;
}
