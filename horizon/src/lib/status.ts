/**
 * The plan's status in plain words, and the three numbers behind it.
 *
 * The audit of November 2026 asked the results screen to lead with the
 * income the plan can support, the gap to the target and the age it is
 * tested through, and to say where the plan stands in words rather than a
 * green or red verdict. This is the one place that decides those words, so
 * the dial, Explore and the report can never disagree.
 *
 *   on    "On track under these assumptions"  the plan pays every year on the
 *                                             central path AND at least 80 of
 *                                             100 simulated futures hold
 *   close "Close: a small change needed"      between the two
 *   not   "Not yet funded"                    fewer than half the futures hold,
 *                                             or the central path runs short
 *                                             and the supportable income is
 *                                             more than a tenth under the ask
 *
 * It is a statement about the model under the stated assumptions, never a
 * promise; the caveat travels with it.
 */
export type StatusKey = 'on' | 'close' | 'not';
export interface PlanStatus {
  key: StatusKey;
  label: string;                 // the status, in words
  colour: string;                // a theme token; the words carry the meaning
  sustainable: number | null;    // monthly income the plan can support to the plan age (today's money, after tax)
  gap: number | null;            // sustainable − target, a month (negative = short)
  target: number;                // what was asked for, a month
  toAge: number;                 // the age the plan is tested through
  line: string;                  // "About £4,150 a month would last to 90: £850 less than you ask."
}

const money = (n: number) => '£' + Math.round(n).toLocaleString('en-GB');

export function planStatus(o: {
  holds: boolean;                // drawdown().holds on the central path
  successProb: number | null;    // share of simulated futures that hold; null while they run
  sustainableYear: number | null; // capacity on the base lens, a year; null while it is worked out
  targetYear: number;
  horizonAge: number;
  runsShortAge: number | null;
}): PlanStatus {
  const target = Math.round(o.targetYear / 12);
  let sustainable = o.sustainableYear == null ? null : Math.round(o.sustainableYear / 12 / 10) * 10;
  // The supportable income is found to the nearest £100 a year; never let
  // that rounding contradict the central path.
  if (sustainable != null && o.holds && sustainable < target) sustainable = target;
  if (sustainable != null && !o.holds && sustainable >= target) sustainable = null;
  const gap = sustainable == null ? null : sustainable - target;
  const p = o.successProb;
  const ratio = sustainable == null || target <= 0 ? null : sustainable / target;

  let key: StatusKey;
  if (o.holds && (p == null || p >= 0.8)) key = 'on';
  else if ((p != null && p < 0.5) || (!o.holds && (ratio == null || ratio < 0.9))) key = 'not';
  else key = 'close';

  const label = key === 'on' ? 'On track under these assumptions' : key === 'close' ? 'Close: a small change needed' : 'Not yet funded';
  const colour = key === 'on' ? 'var(--color-sage-strong)' : key === 'close' ? 'var(--color-hope)' : 'var(--color-map-early)';
  let line: string;
  if (sustainable == null) {
    line = o.holds ? `Your ${money(target)} a month is paid every year to ${o.horizonAge} on the central path.`
      : `On the central path the money runs short at ${o.runsShortAge ?? '?'}.`;
  } else if (gap === 0 || Math.abs(gap!) < 25) {
    line = `About ${money(sustainable)} a month would last to ${o.horizonAge}: just what you ask.`;
  } else {
    line = `About ${money(sustainable)} a month would last to ${o.horizonAge}: ${money(Math.abs(gap!))} ${gap! > 0 ? 'more' : 'less'} than you ask.`;
  }
  return { key, label, colour, sustainable, gap, target, toAge: o.horizonAge, line };
}
