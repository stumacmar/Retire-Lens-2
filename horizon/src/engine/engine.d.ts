export interface Partner {
  name: string; birthYear: number; spAge: number; spAmount: number;
  pension: number; isa: number; monthlyPension: number; monthlyIsa: number;
  db: number; dbStartYear: number; dbIndexed: boolean;
  pclsTaken?: number;      // tax-free cash already taken (reduces the lifetime cap)
  crystallised?: number;   // pot already accessed; pays no further tax-free cash
}
export interface Plan {
  startYear: number; retireYear: number; horizonAge: number;
  partnerA: Partner; partnerB: Partner;
  growth: number; growthBear: number; growthBase: number; growthBull: number;
  inflation: number; mcPaths: number; mcSeed: number;
  targetNet: number; spendingPlanOn: boolean;
  phase1Age: number; phase1Cut: number; phase1On: boolean;
  phase2Age: number; phase2Cut: number; phase2On: boolean;
  strategy: string; pclsMode: string;
  [k: string]: any;
}
export interface DrawRow {
  year: number; ageA: number; ageB: number; wealth: number;
  netIncome: number; target: number; guaranteed: number;
  potA: number; potB: number; isaA: number; isaB: number; cash: number;
  [k: string]: any;
}
export interface Drawdown {
  rows: DrawRow[]; endWealth: number; exhaustedAgeA: number | null;
  exhaustedYear: number | null; lifetimeTax: number; [k: string]: any;
}
export interface Accum { atRetirement: any; years: any[]; [k: string]: any }
export interface MC {
  successProb: number; confidenceAge: number;
  finalP10: number; finalP50: number; finalP90: number;
  nPaths: number; medianTrim: number;
  tracks: number[][];
  perAgeSolvency: { age: number; p: number }[];
  [k: string]: any;
}
export interface Engine {
  defaults(): Plan;
  freshStart(): Plan;
  accumulate(P: Plan, growth?: number): Accum;
  drawdown(P: Plan, opts?: { growth?: number; startPots?: any }): Drawdown;
  runMonteCarlo(P: Plan, n: number, seed: number): MC;
  [k: string]: any;
}
export function createEngine(): Engine;
