import type { Floor, LanternModel, SourceKey, WindowState } from './model';
import { WINDOWS } from './model';

/**
 * A hand-made household for Stage 1, so the look can be judged before any
 * engine wiring. Made up: nobody's plan. Ages 60 to 95 (36 floors), a partner
 * two years older, spending that steps down at 75 and again at 80, a gilt
 * ladder for the first seven years, two State Pensions.
 */
const N = 36, STOP_AGE = 60, STOP_YEAR = 2031;
const SPEND = 48000, STEP1 = 40800, STEP2 = 36000, ESSENTIAL = 32000;
const SP = 11500, PARTNER_SP = 9200, SP_FLOOR = 7, PARTNER_SP_FLOOR = 5, GILT_FLOORS = 7;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function windows(short: number, floor: number): WindowState[] {
  const s = Math.max(0, Math.min(WINDOWS, short)), f = Math.max(0, Math.min(WINDOWS - s, floor));
  return [...Array(s).fill('short'), ...Array(f).fill('floor'), ...Array(WINDOWS - s - f).fill('full')];
}

function floorAt(i: number): Floor {
  const age = STOP_AGE + i;
  const spend = age >= 80 ? STEP2 : age >= 75 ? STEP1 : SPEND;

  // Base plan: every light on for the first decade; a few futures drop to the
  // essentials through the seventies (easing a little at each step-down), and
  // a few go dark from the eighties.
  const short = Math.round(4 * Math.pow(clamp01((i - 18) / 17), 1.6));
  let floor = Math.round(3 * clamp01((i - 9) / 12));
  if ((i >= 15 && i <= 17) || (i >= 20 && i <= 22)) floor = Math.max(0, floor - 1);

  // The same plan after a 30% fall in the first year: the lights go out sooner.
  const sShort = Math.round(8 * Math.pow(clamp01((i - 9) / 26), 1.3));
  const sFloor = Math.round(4 * clamp01((i - 3) / 10));

  // Where the middle future's money comes from.
  const sp = i >= SP_FLOOR ? SP : 0, psp = i >= PARTNER_SP_FLOOR ? PARTNER_SP : 0;
  const rest = Math.max(0, spend - sp - psp);
  const parts: [SourceKey, number][] = i < GILT_FLOORS
    ? [['gilt', rest * 0.82], ['mmf', rest * 0.18], ['partnerSp', psp], ['sp', sp]]
    : [['equity', rest * 0.74], ['gold', rest * 0.12], ['mmf', rest * 0.14], ['partnerSp', psp], ['sp', sp]];

  return {
    age, partnerAge: age + 2, year: STOP_YEAR + i, spend,
    windows: windows(short, floor), stress: windows(sShort, sFloor),
    sources: parts.filter(([, a]) => a > 0).map(([key, amount]) => ({ key, amount: Math.round(amount) })),
    wealth: {
      p10: Math.max(0, Math.round((700 - 27 * i) * 1000)),
      p50: Math.round((780 - 15.5 * i) * 1000),
      p90: Math.round((860 + 9 * i) * 1000),
    },
  };
}

export const dummyModel: LanternModel = {
  floors: Array.from({ length: N }, (_v, i) => floorAt(i)),
  essential: ESSENTIAL,
  workingYears: 4,
  giltFloors: GILT_FLOORS,
  spines: [
    { key: 'sp', fromFloor: SP_FLOOR, income: SP },
    { key: 'partnerSp', fromFloor: PARTNER_SP_FLOOR, income: PARTNER_SP },
  ],
  stressName: 'A 30% fall in year 1',
};
