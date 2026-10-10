export interface Partner {
  name: string; birthYear: number; spAge: number; spAmount: number;
  pension: number; isa: number; monthlyPension: number; monthlyIsa: number;
  db: number; dbStartYear: number; dbIndexed: boolean;
  pclsTaken?: number;      // tax-free cash already taken (reduces the lifetime cap)
  crystallised?: number;   // pot already accessed; pays no further tax-free cash
  tfcRate?: number;        // blended tax-free entitlement on untouched funds (default 0.25)
  income?: number;         // annual income, for the allowance-taper warning
  dbTransferValue?: number; // CETV if quoted (display/report only)
  pots?: any[];            // optional scheme list (UI aggregates into the fields above)
  dbSchemes?: DbTranche[]; // public-sector defined-benefit tranches (see below)
}
export interface Plan {
  startYear: number; retireYear: number; horizonAge: number;
  partnerA: Partner; partnerB: Partner;
  growth: number; growthBear: number; growthBase: number; growthBull: number;
  inflation: number; mcPaths: number; mcSeed: number;
  targetNet: number; spendingPlanOn: boolean;
  approach?: 'traditional' | 'derisking' | null;
  architecture?: any;
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
  drawdown(P: Plan, opts?: { growth?: number; startPots?: any; returnPath?: number[] }): Drawdown;
  planEndYear(P: Plan): number;
  levers(P: Plan, opts?: { paths?: number }): { base: any; paths: number; levers: { id: string; label: string; detail: string; conf: number | null; dConf: number; end: number; dEnd: number; dTax: number; exhaustedAgeA: number | null }[] };
  stressTests(P: Plan): { base: Drawdown; baseReal: number; baseHolds: boolean; tests: { label: string; note: string; endWealthReal: number; delta: number; exhaustedAgeA: number | null; holds: boolean }[]; summary: { total: number; holds: number; fails: number; worst: any } };
  compareStrategies(P: Plan): { id: string; label: string; lifetimeTax: number; endWealth: number; exhaustedAgeA: number | null }[];
  STRESS_PATHS: Record<string, number[]>;
  SCOT_BANDS: { upTo: number; rate: number }[];
  runMonteCarlo(P: Plan, n: number, seed: number): MC;
  DB_SCHEMES: Record<string, DbScheme>;
  DB_SCHEMES_ASOF: string;
  trancheBenefits(P: Plan, who: Partner, t: DbTranche): TrancheBenefits;
  trancheNpa(who: Partner, t: DbTranche): number;
  trancheMinAge(who: Partner, t: DbTranche): number;
  maxCommute(pension: number, autoMult: number, rate: number): number;
  hasAnyDb(who: Partner): boolean;
  compareDbTiming(P: Plan, whoKey: 'partnerA' | 'partnerB', trancheId: string): { tranche: TrancheBenefits; options: { age: number; year: number; pension: number; lump: number; factor: number; endWealthReal: number; exhaustedAgeA: number | null; lifetimeTaxReal: number }[] } | null;
  [k: string]: any;
}
export function createEngine(): Engine;

// ── Defined-benefit scheme tranches (public sector) ──────────────────
export interface DbTranche {
  id: string;
  scheme: string;            // key of Engine.DB_SCHEMES ('nhs2015', 'tps60', 'lgpsCare', 'csAlpha', 'custom', …)
  label?: string;
  pension: number;           // annual pension at today's value, from the benefit statement
  takeAge?: number;          // age the member plans to take it (default: the scheme's normal pension age)
  npa?: number;              // override normal pension age
  commutePct?: number;       // 0..1 of the maximum pension that may be given up for cash
  accruing?: boolean;        // still building it up
  salary?: number;           // pensionable pay if accruing
  earlyRate?: number; lateRate?: number; revalReal?: number; accrual?: number;
  autoLump?: number; commuteRate?: number; indexed?: boolean; protectedAge?: boolean;
}
export interface DbScheme {
  label: string; family: string; npa: number | 'spa'; accrual: number; revalReal: number;
  autoLump: number; commuteRate: number; earlyRate: number; lateRate: number; minAge: number;
  legacy?: boolean; uniformed?: boolean;
}
export interface TrancheBenefits {
  id: string; scheme: string; label: string; family: string;
  npa: number; minAge: number; takeAge: number; takeYear: number;
  accrued: number; early: number; late: number; factor: number;
  basePension: number; pension: number; lump: number; lumpMin: number; lumpMax: number;
  commute: number; cMax: number; autoMult: number; rate: number; indexed: boolean; legacy: boolean;
}
