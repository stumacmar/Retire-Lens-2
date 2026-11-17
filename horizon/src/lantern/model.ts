/**
 * The Lantern's view model: everything the tower draws, already worked out.
 * The renderer reads this and nothing else; from Stage 2 an adapter fills it
 * from the engine (see docs/LANTERN_PLAN.md).
 */
export const WINDOWS = 20;

/** full: pays the planned spend that year. floor: pays the essentials but not the plan. short: falls below the essentials. */
export type WindowState = 'full' | 'floor' | 'short';

export type SourceKey = 'gilt' | 'equity' | 'gold' | 'mmf' | 'sp' | 'partnerSp' | 'work' | 'downsize';

export type Floor = {
  age: number;
  partnerAge: number | null;
  year: number;
  /** Planned spend that year, today's money. */
  spend: number;
  /** 20 windows, worst future on the left to best on the right; each is 5% of the futures. */
  windows: WindowState[];
  /** The same 20 windows under the active stress. */
  stress: WindowState[];
  /** The middle future's income that year by source; a total below `spend` is a shortfall. */
  sources: { key: SourceKey; amount: number }[];
  /** Money left at the end of the year, today's money. */
  wealth: { p10: number; p50: number; p90: number };
};

export type LanternModel = {
  floors: Floor[];
  /** The essential floor, today's money a year. */
  essential: number;
  /** Years still at work, drawn as scaffolding under the tower. */
  workingYears: number;
  /** The gilt ladder carries the first `giltFloors` floors. */
  giltFloors: number;
  spines: { key: 'sp' | 'partnerSp'; fromFloor: number; income: number }[];
  stressName: string;
};

export const SOURCE_NAME: Record<SourceKey, string> = {
  gilt: 'gilt ladder', equity: 'shares', gold: 'gold', mmf: 'money market fund',
  sp: 'State Pension', partnerSp: "partner's State Pension", work: 'part-time work', downsize: 'downsizing',
};

/** The window that marks the middle future (the more cautious of the two middle windows). */
export const MEDIAN_WINDOW = WINDOWS / 2 - 1;

export const countOf = (w: WindowState[], s: WindowState) => w.filter(x => x === s).length;

/** True when every floor has exactly 20 windows, sorted worst to best. */
export function modelOk(m: LanternModel) {
  const rank = { short: 0, floor: 1, full: 2 } as const;
  const sorted = (w: WindowState[]) => w.length === WINDOWS && w.every((s, i) => i === 0 || rank[w[i - 1]] <= rank[s]);
  return m.floors.length > 0 && m.floors.every(f => sorted(f.windows) && sorted(f.stress));
}
