/**
 * The plan's status in plain words, and the three numbers behind it.
 *
 * One rule decides the words for the dial, the simple home and the tests, and
 * the rule is built so the label can never contradict the figure beside it.
 * It starts from the central case (the same run that gives the big figure)
 * and only then looks at the simulated futures:
 *
 *   The central case pays what you ask, in full, every year
 *     on    "On track under these assumptions"   and at least 80 of 100 futures hold
 *     thin  "Enough on average, not safe yet"    but fewer than 80 of 100 futures hold
 *   The central case lasts only because the plan's own rules trim spending
 *     trim  "Enough, with a trim to spending"    (structured plans only)
 *   The central case runs short
 *     close "Nearly enough"                      what it can pay is within a tenth of the ask
 *     not   "Not enough yet"                     otherwise
 *
 * Two faults in the earlier rule are why it is written this way. A plan that
 * supported exactly what was asked, or more, could be labelled "Not yet
 * funded" because fewer than half its futures held. And a structured plan
 * that stayed solvent by cutting spending to 75% was credited with supporting
 * the uncut figure while being labelled "Not yet funded" for the cuts.
 *
 * "Futures" means, for a plain plan, the share of simulated futures that pay
 * the ask in full every year. A structured plan is designed to trim in bad
 * years, so its status uses the share that last with the rules; the share
 * paid in full is reported beside it.
 *
 * It is a statement about the model under the stated assumptions, never a
 * promise; the caveat travels with it.
 */
export type StatusKey = 'on' | 'thin' | 'trim' | 'close' | 'not';
export interface PlanStatus {
  key: StatusKey;
  label: string;                 // the status, in words
  colour: string;                // a theme token; the words carry the meaning
  sustainable: number | null;    // monthly income the plan can pay in full to the plan age (today's money, after tax)
  gap: number | null;            // sustainable − target, a month (negative = short)
  target: number;                // what was asked for, a month
  toAge: number;                 // the age the plan is tested through
  line: string;                  // "About £4,150 a month would last to 90: £850 less than you ask."
  note: string | null;           // one extra sentence when the label needs it
  futures: number | null;        // the share the status rests on, 0–100
  futuresInFull: number | null;  // paid in full every year, 0–100 (differs only for structured plans)
  structured: boolean;
}

const money = (n: number) => '£' + Math.round(n).toLocaleString('en-GB');
export const STATUS_LABELS: Record<StatusKey, string> = {
  on: 'On track under these assumptions',
  thin: 'Enough on average, not safe yet',
  trim: 'Enough, with a trim to spending',
  close: 'Nearly enough',
  not: 'Not enough yet',
};

export function planStatus(o: {
  holds: boolean;                 // drawdown().holds on the central path (no year unpaid)
  deepestTrim?: number;           // lowest spending multiplier the rules reached on the central path (1 = never trimmed)
  structured?: boolean;           // the plan runs the written-rules structure
  successProb: number | null;     // share of futures paid in full every year; null while they run
  successWithCuts?: number | null; // share of futures that last once the rules have trimmed
  sustainableYear: number | null; // the most a year paid in full on the central case; null while it is worked out
  targetYear: number;
  horizonAge: number;
  runsShortAge: number | null;
}): PlanStatus {
  const structured = !!o.structured;
  const trimTo = o.deepestTrim == null ? 1 : o.deepestTrim;
  const full = o.holds && trimTo >= 0.999;          // the central case pays the ask in full
  const target = Math.round(o.targetYear / 12);
  let sustainable = o.sustainableYear == null ? null : Math.round(o.sustainableYear / 12 / 10) * 10;
  // The supportable income is found to the nearest £100 a year; never let
  // that rounding (or a figure still being worked out for an older version
  // of the plan) contradict the central case.
  if (sustainable != null && full && sustainable < target) sustainable = target;
  if (sustainable != null && !full && sustainable >= target) sustainable = null;
  const gap = sustainable == null ? null : sustainable - target;
  const pFull = o.successProb;
  const pUse = structured && o.successWithCuts != null ? o.successWithCuts : pFull;
  const ratio = sustainable == null || target <= 0 ? null : sustainable / target;

  let key: StatusKey;
  if (full) key = pUse == null || pUse >= 0.8 ? 'on' : 'thin';
  else if (o.holds) key = 'trim';
  else key = ratio != null && ratio >= 0.9 ? 'close' : 'not';

  const colour = key === 'on' ? 'var(--color-sage-strong)' : key === 'not' ? 'var(--color-map-early)' : 'var(--color-hope)';
  let line: string;
  if (sustainable == null) {
    line = full ? `Your ${money(target)} a month is paid every year to ${o.horizonAge} on the central case.`
      : o.holds ? `On the central case the money lasts to ${o.horizonAge}, with spending trimmed.`
        : `On the central case the money runs short at ${o.runsShortAge ?? '?'}.`;
  } else if (Math.abs(gap!) < 25) {
    line = `About ${money(sustainable)} a month would last to ${o.horizonAge}: just what you ask.`;
  } else {
    line = `About ${money(sustainable)} a month would last to ${o.horizonAge}: ${money(Math.abs(gap!))} ${gap! > 0 ? 'more' : 'less'} than you ask.`;
  }
  const pc = (p: number | null) => (p == null ? null : Math.round(p * 100));
  const note = key === 'trim' ? `On the central case your spending rules trim it to ${Math.round(trimTo * 100)}% of what you ask for a time.`
    : key === 'thin' ? 'The central case pays it, but too few of the simulated futures do.' : null;
  return { key, label: STATUS_LABELS[key], colour, sustainable, gap, target, toAge: o.horizonAge, line, note,
    futures: pc(pUse), futuresInFull: pc(pFull), structured };
}

/** The one sentence about the futures, with its caveat, for either home. */
export function futuresSentence(s: PlanStatus, short = false): string {
  if (s.futures == null) return 'Working out the futures.';
  const caveat = short ? 'not a guarantee' : 'An estimate in today\'s money, not a guarantee';
  if (s.structured && s.futuresInFull != null && s.futuresInFull !== s.futures) {
    return short ? `Lasts in ${s.futures} of 100 futures with your rules (paid in full in ${s.futuresInFull}); ${caveat}.`
      : `With your rules the money lasts in ${s.futures} of 100 simulated futures, paid in full every year in ${s.futuresInFull}. ${caveat}.`;
  }
  return short ? `Holds in ${s.futures} of 100 futures; ${caveat}.`
    : `What you ask holds in ${s.futures} of 100 simulated futures. ${caveat}.`;
}
