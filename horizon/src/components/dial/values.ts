import { fmt, fmtK } from '../../lib/format';

/**
 * What the ring can drive. Six faces round the bezel, each with up to two
 * values; a second set for a partner on the back of the dial. Every value
 * knows its range, its detent size, how to read itself aloud and how to
 * write itself back into the plan — so the ring, the hidden range inputs,
 * the keypad and the ± buttons all go through one definition.
 */
export type Face = 'someday' | 'pensions' | 'savings' | 'later' | 'guaranteed' | 'who';
export type Side = 'A' | 'B';
export const FACES: { id: Face; name: string; angle: number }[] = [
  { id: 'someday', name: 'Someday', angle: 0 },
  { id: 'pensions', name: 'Pensions', angle: 60 },
  { id: 'savings', name: 'Savings', angle: 120 },
  { id: 'later', name: 'Later life', angle: 180 },
  { id: 'guaranteed', name: 'Guaranteed', angle: 240 },
  { id: 'who', name: 'Who', angle: 300 },
];

export interface Val {
  key: string;
  label: string;                       // the hidden range's accessible name
  min: number; max: number;
  step: number;                        // the range input's step (keyboard)
  detent: (v: number) => number;       // one click of the ring at this value
  get: () => number;
  set: (v: number) => any;             // a patch, or a function of the plan
  text: (v: number) => string;         // spoken and shown at the needle
  short: (v: number) => string;        // on the bezel
  options?: string[];                  // discrete values, by index
}

const thisYear = new Date().getFullYear();
const pots = (v: number) => (v < 50000 ? 1000 : v < 500000 ? 5000 : 25000);
const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function valuesFor(plan: any, side: Side): Record<Face, Val[]> {
  const who = side === 'A' ? plan.partnerA : plan.partnerB;
  const them = side === 'A' ? 'Your' : 'Their';
  const patch = (p: any) => (side === 'A' ? { partnerA: { ...plan.partnerA, ...p } } : { partnerB: { ...plan.partnerB, ...p } });
  const age = thisYear - who.birthYear;
  const retireAge = plan.retireYear - plan.partnerA.birthYear;
  const single = plan.household === 'single';

  const v: Record<Face, Val[]> = {
    who: [
      { key: `${side}.age`, label: side === 'A' ? 'Your age' : 'Their age', min: thisYear - 2000, max: thisYear - 1935, step: 1, detent: () => 1,
        get: () => age, set: n => patch({ birthYear: thisYear - n }), text: n => `Age ${n}`, short: n => `${n}` },
    ],
    someday: [],
    pensions: [
      { key: `${side}.pension`, label: `${them} pension pots`, min: 0, max: 2500000, step: 1000, detent: pots,
        get: () => who.pension, set: n => patch({ pension: n, pots: [], tfcRate: 0.25 }), text: n => `Pension pots ${fmt(n)}`, short: fmtK },
      { key: `${side}.monthly`, label: side === 'A' ? 'Still paying in, a month' : 'They still pay in, a month', min: 0, max: 6000, step: 25, detent: () => 25,
        get: () => who.monthlyPension, set: n => patch({ monthlyPension: n }), text: n => `Paying in ${fmt(n)} a month`, short: n => `${fmt(n)}/mo` },
    ],
    savings: [
      { key: `${side}.isa`, label: `${them} ISAs`, min: 0, max: 1500000, step: 1000, detent: pots,
        get: () => who.isa, set: n => patch({ isa: n }), text: n => `ISAs ${fmt(n)}`, short: fmtK },
    ],
    guaranteed: [
      { key: `${side}.sp`, label: `${them} State Pension a year`, min: 0, max: 13000, step: 50, detent: () => 50,
        get: () => who.spAmount, set: n => patch({ spAmount: n }), text: n => `State Pension ${fmt(n)} a year`, short: n => `${fmtK(n)}/yr` },
      { key: `${side}.db`, label: `${them} company pension a year`, min: 0, max: 60000, step: 250, detent: () => 250,
        get: () => who.db, set: n => patch({ db: n, dbStartYear: n > 0 && !(who.db > 0) ? plan.retireYear : who.dbStartYear }),
        text: n => `Company pension ${fmt(n)} a year`, short: n => `${fmtK(n)}/yr` },
    ],
    later: [],
  };

  if (side === 'A') {
    v.who.push({ key: 'household', label: 'Who the plan is for', min: 0, max: 1, step: 1, detent: () => 1, options: ['Just me', 'The two of us'],
      get: () => (single ? 0 : 1), set: n => ({ household: n ? 'couple' : 'single' }), text: n => (n ? 'The two of us' : 'Just me'), short: n => (n ? 'couple' : 'single') });
    v.someday.push(
      { key: 'retireAge', label: 'Retire at age', min: Math.max(40, plan.startYear + 1 - plan.partnerA.birthYear), max: Math.min(75, plan.startYear + 20 - plan.partnerA.birthYear), step: 1, detent: () => 1,
        get: () => retireAge, set: n => ({ retireYear: plan.partnerA.birthYear + n }), text: n => `Stop work at ${n}`, short: n => `${n}` },
      { key: 'targetNet', label: 'Take home a month', min: 800, max: 15000, step: 50, detent: () => 50,
        get: () => Math.round((plan.targetNet || 0) / 12), set: n => ({ targetNet: n * 12, spendingPlanOn: false }), text: n => `${fmt(n)} a month after tax`, short: n => `${fmt(n)}` });
    v.savings.push({ key: 'cash', label: 'Cash and Premium Bonds', min: 0, max: 500000, step: 1000, detent: pots,
      get: () => plan.cash || 0, set: n => ({ cash: n }), text: n => `Cash ${fmt(n)}`, short: fmtK });
    v.later.push(
      { key: 'horizonAge', label: 'Plan to age', min: Math.max(70, retireAge + 1), max: 105, step: 1, detent: () => 1,
        get: () => plan.horizonAge, set: n => ({ horizonAge: n }), text: n => `Plan to age ${n}`, short: n => `to ${n}` },
      { key: 'shape', label: 'How spending changes', min: 0, max: 2, step: 1, detent: () => 1, options: ['Steady', 'Slow-go', 'Go-go'],
        get: () => (plan.phase2On ? 2 : plan.phase1On ? 1 : 0),
        set: n => (n === 2 ? { phase1On: true, phase2On: true } : n === 1 ? { phase1On: true, phase2On: false } : { phase1On: false, phase2On: false }),
        text: n => ['Spending steady', 'Spending eases from 75', 'More early on, then eases'][n], short: n => ['steady', 'slow-go', 'go-go'][n] });
  } else {
    v.someday.push({ key: 'B.stopAge', label: 'Their stop age', min: Math.max(retireAge, thisYear + 1 - who.birthYear), max: 75, step: 1, detent: () => 1,
      get: () => Math.max(plan.retireYear, who.stopYear || plan.retireYear) - who.birthYear,
      set: n => patch({ stopYear: who.birthYear + n > plan.retireYear ? who.birthYear + n : null }),
      text: n => `They stop work at ${n}`, short: n => `${n}` });
  }
  return v;
}

export const clampVal = (val: Val, n: number) => clampTo(Math.round(n / val.step) * val.step, val.min, val.max);
