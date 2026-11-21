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
 *     thin  "Enough in most futures, not all"    but fewer than 80 of 100 futures hold
 *           (was "Enough on average, not safe yet": "on average" read as
 *           "fine", per the November 2026 design research)
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
  thin: 'Enough in most futures, not all',
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

  // One warm colour for "paying", one cool slate for "short"; never red or
  // green (colour-blind and older eyes, and they read as a verdict).
  const colour = key === 'close' || key === 'not' ? 'var(--color-slate)' : 'var(--color-ring)';
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

/**
 * The answer sentence. It always names the amount the futures are counted
 * against (the amount asked for), because the big figure is a different
 * amount (what the plan can pay) and the two must never be confused. It says
 * "x of 100 futures", never a bare percentage: a percentage with no
 * reference class is misread (Gigerenzer et al. 2005).
 *
 *   In 72 of 100 futures, £5,000 a month lasts to 90. An estimate, not a guarantee.
 */
export function futuresSentence(s: PlanStatus, _short = false): string {
  if (s.futures == null) return 'Working out the futures.';
  const ask = money(s.target), caveat = 'An estimate, not a guarantee.';
  if (s.structured && s.futuresInFull != null && s.futuresInFull !== s.futures) {
    return `In ${s.futures} of 100 futures the money lasts to ${s.toAge} with your spending rules; in ${s.futuresInFull} it pays ${ask} a month in full. ${caveat}`;
  }
  return `In ${s.futures} of 100 futures, ${ask} a month lasts to ${s.toAge}. ${caveat}`;
}

/**
 * The spoken equivalent of the picture, for screen readers:
 *   "Stop at 60 and take £5,000 a month. In 95 of 100 futures it lasts to 90.
 *    In the other 5, money first runs short at about 86."
 * `typicalShortAge` is the age by which half of the futures that do run
 * short have done so.
 */
export function spokenAnswer(s: PlanStatus, stopAge: number, typicalShortAge: number | null): string {
  if (s.futures == null) return 'Working out the futures.';
  const f = s.futures, rest = 100 - f;
  return `Stop at ${stopAge} and take ${money(s.target)} a month. In ${f} of 100 futures it lasts to ${s.toAge}${s.structured ? ' with your spending rules' : ''}.`
    + (rest > 0 && typicalShortAge != null ? ` In the other ${rest}, money first runs short at about ${typicalShortAge}.` : '');
}

/**
 * A dead zone at the two boundaries a number decides (the Torino lesson:
 * words that flip back and forth while you drag lose their meaning). The
 * word changes only when the result clearly crosses: "on track" and "enough
 * in most futures" swap at 80 of 100 only beyond 78 or 82; "nearly enough"
 * and "not enough yet" swap at nine tenths of the ask only beyond 0.88 or
 * 0.92. Boundaries set by the central case (paid in full or not) are facts
 * and never held. A fresh screen has no previous word and shows the rule.
 */
export function withDeadZone(prev: StatusKey | null, s: PlanStatus): PlanStatus {
  if (!prev || prev === s.key) return s;
  const f = s.futures, ratio = s.sustainable != null && s.target > 0 ? s.sustainable / s.target : null;
  let key = s.key;
  if (prev === 'on' && s.key === 'thin' && f != null && f >= 78) key = 'on';
  if (prev === 'thin' && s.key === 'on' && f != null && f < 82) key = 'thin';
  if (prev === 'close' && s.key === 'not' && ratio != null && ratio >= 0.88) key = 'close';
  if (prev === 'not' && s.key === 'close' && ratio != null && ratio < 0.92) key = 'not';
  if (key === s.key) return s;
  return { ...s, key, label: STATUS_LABELS[key], colour: key === 'close' || key === 'not' ? 'var(--color-slate)' : 'var(--color-ring)' };
}

/**
 * The verdict on the moon home: decided by the count it stands beside and by
 * nothing else, so the words and the number can never disagree. (Every one of
 * twelve blind readers saw "Enough in most futures, not all" beside "58 of
 * 100" as a contradiction; Pension Scout, 21 November 2026.) Plain words, no
 * idioms: "Touch and go" was read as an instruction to touch the screen.
 * `count` is the futures of 100 in which the money lasts to the plan age:
 * paid in full on a plain plan, lasting with its rules on a structured one.
 */
export type VerdictKey = 'yes' | 'probably' | 'either' | 'unlikely' | 'no';
export function verdictFor(count: number): { key: VerdictKey; label: string } {
  return count >= 80 ? { key: 'yes', label: 'Yes, on track' }
    : count >= 60 ? { key: 'probably', label: 'Probably' }
      : count >= 40 ? { key: 'either', label: 'It could go either way' }
        : count >= 20 ? { key: 'unlikely', label: 'Probably not' }
          : { key: 'no', label: 'Not as it stands' };
}
