/**
 * The Lantern's view model: everything the tower draws, already worked out
 * by the adapter (adapter.js) from the engine's results. The renderer reads
 * this and nothing else. All money is today's money.
 */

/** full: pays the planned spend that year. floor: pays the essentials but not the plan. short: falls below the essentials. */
export type WindowState = 'full' | 'floor' | 'short';

export type SourceKey = 'pension' | 'isa' | 'cash' | 'scheme' | 'work' | 'sp' | 'partnerSp';

export type Floor = {
  age: number;
  partnerAge: number | null;
  year: number;
  /** Planned spend that year. */
  spend: number;
  /** 20 windows, worst future on the left to best on the right; each is 5% of that year's futures. */
  windows: WindowState[];
  /** The same 20 windows under the stress. */
  stress: WindowState[];
  /** The central case's spending that year by source; a total below `spend` is a shortfall. */
  sources: { key: SourceKey; amount: number }[];
  /** Money left at the end of the year. */
  wealth: { p10: number; p50: number; p90: number };
};

export type LanternModel = {
  floors: Floor[];
  /** The essential floor, a year. */
  essential: number;
  /** A structured plan's safe ladder, in years of spending: the height of the plinth. 0 without one. */
  ladderFloors: number;
  spines: { key: 'sp' | 'partnerSp'; fromFloor: number; income: number }[];
  stressName: string | null;
};

export const SOURCE_NAME: Record<SourceKey, string> = {
  pension: 'pensions', isa: 'ISAs', cash: 'cash', scheme: 'scheme pensions', work: 'work',
  sp: 'State Pension', partnerSp: "partner's State Pension",
};
