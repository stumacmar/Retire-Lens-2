/**
 * The figures behind the payslip, Months and the decision map. Pure
 * functions of a plan and an engine instance, so the same code runs on the
 * main thread and in the insight worker and can never disagree.
 *
 * "Lasts" means what it means everywhere else in the app: every year to the
 * end of the plan was paid in full (drawdown().holds) — the pots never ran
 * out AND no year went unpaid because the pension could not be touched yet.
 */
type Eng = any;

/** A copy we can change freely; spending is a flat figure for these sums. */
function prep(plan: any) {
  const P = JSON.parse(JSON.stringify(plan));
  P.spendingPlanOn = false;
  return P;
}

/** Run one plan, optionally on a named bad history or a different growth rate. */
export function runOn(E: Eng, P: any, { path = null as string | null, growth = null as number | null } = {}) {
  const g = growth ?? P.growth ?? P.growthBase;
  let Q = { ...P, growth: g };
  // Structured plans replay a history through their growth engine; plain
  // plans take it as the return path itself (the same split stressTests uses).
  if (path && Q.architecture?.on) Q = { ...Q, architecture: { ...Q.architecture, stressPath: path } };
  const acc = E.accumulate(Q, g);
  const opts: any = { growth: g, startPots: acc.atRetirement };
  if (path && !Q.architecture?.on) opts.returnPath = E.STRESS_PATHS[path];
  return { acc, dd: E.drawdown(Q, opts) };
}

/**
 * Paid in full: every year to the end of the plan received what was asked.
 * `holds` covers a plain plan. A structured plan's written rules can keep it
 * solvent by trimming spending (to as little as 75%), and a trimmed year is
 * not a year paid in full: without this test a plan asking £7,200 a month
 * and delivering £5,400 was reported as "supporting £7,200".
 */
export function trimmedAt(dd: any): number | null {
  const r = (dd.rows as any[]).find(x => x.spendMult != null && x.spendMult < 0.999);
  return r ? r.ageA : null;
}
export const paidInFull = (dd: any): boolean => !!dd.holds && trimmedAt(dd) == null;
/** The deepest the rules cut spending on this path (1 = never cut). */
export const deepestTrim = (dd: any): number => (dd.rows as any[]).reduce((m, x) => (x.spendMult != null && x.spendMult < m ? x.spendMult : m), 1);

/** The most a year the plan can pay IN FULL every year, to the nearest £100. */
export function capacity(E: Eng, plan: any, opts: { path?: string | null; growth?: number | null } = {}) {
  const P = prep(plan);
  let lo = 2000, hi = Math.max(250000, (P.targetNet || 0) * 3);
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (paidInFull(runOn(E, { ...P, targetNet: mid }, opts as any).dd)) lo = mid; else hi = mid;
  }
  return Math.floor(lo / 100) * 100;
}

/**
 * A smaller State Pension (Scout, 21 November 2026). Every other case in
 * "What could go wrong?" is about markets, yet for most plans the State
 * Pension is the largest single source of income and the figure entered is
 * the full new rate unless it has been changed. A fifth less is what seven
 * missing qualifying years do: the full rate needs 35, and each year short
 * takes off 1/35 (GOV.UK, "The new State Pension: what you'll get"). It also
 * stands in for a change in the rules. A State Pension already in payment
 * when the plan starts is a known amount and is left alone.
 * (Moneysmart, the Australian government's planner, asks "Include the Age
 * Pension?" so a plan can be seen without it; TPAW Planner: "Assume that your
 * pension will be lower than expected", and test the plan against it.)
 */
export const SP_LOWER = 0.2;
export const SP_YEARS_SHORT = 7, SP_YEARS_FULL = 35;

/** The plan with each State Pension not yet in payment a fifth lower, or null when there is none to lower. */
export function withLowerStatePension(E: Eng, plan: any): any | null {
  const P = JSON.parse(JSON.stringify(plan)), single = E.isSingle(P);
  let any = false;
  for (const w of single ? [P.partnerA] : [P.partnerA, P.partnerB]) {
    if (!w || !(Number(w.spAmount) > 0) || !(w.birthYear > 1900)) continue;
    if (P.startYear - w.birthYear >= E.spAgeOf(w)) continue;   // already in payment: a known amount
    w.spAmount = Math.round(Number(w.spAmount) * (1 - SP_LOWER)); any = true;
  }
  return any ? P : null;
}

export interface Rail { key: string; label: string; when?: string; year: number }
/** Guardrails: safe yearly spending under four real bad histories and the three lenses, and (last, where it applies) with a smaller State Pension. */
export function guardrails(E: Eng, plan: any): Rail[] {
  const histories: Rail[] = [
    { key: 'japan', label: 'Japan, 1990 on', when: 'a Japan-style lost two decades', year: 0 },
    { key: 'stagflation', label: '1970s stagflation', when: 'a 1970s-style stagflation', year: 0 },
    { key: 'crashflat', label: 'A 30% fall, then flat years', when: 'a 30% fall followed by flat years', year: 0 },
    { key: 'poor', label: `Returns of ${Math.round(plan.growthBear * 100)}% a year`, when: `a run of ${Math.round(plan.growthBear * 100)}% returns`, year: 0 },
    { key: 'gfc', label: '2008, the day you stop', when: 'a 2008 crash the day you stop', year: 0 },
  ];
  const lenses: Rail[] = [
    { key: 'base', label: `Returns of ${Math.round(plan.growthBase * 100)}% a year (base)`, year: 0 },
    { key: 'good', label: `Returns of ${Math.round(plan.growthBull * 100)}% a year`, year: 0 },
  ];
  for (const r of histories) {
    r.year = r.key === 'poor' ? capacity(E, plan, { growth: plan.growthBear })
      : capacity(E, plan, { path: r.key, growth: plan.growthBase });
  }
  lenses[0].year = capacity(E, plan, { growth: plan.growthBase });
  lenses[1].year = capacity(E, plan, { growth: plan.growthBull });
  // Not a market history: the central case's returns, with the State Pension a fifth lower.
  const low = withLowerStatePension(E, plan);
  const policy: Rail[] = low ? [{ key: 'spLow', label: 'A State Pension a fifth lower', when: 'a State Pension a fifth lower than entered', year: capacity(E, low, { growth: plan.growthBase }) }] : [];
  return [...histories, ...lenses, ...policy];
}

export interface MonthRow { year: number; working: boolean; guaranteed: number; pots: number; unpaid: number }
/** One row per year to partner A's horizon: how many of its 12 months each source pays for. */
export function monthRows(plan: any, dd: any, deflate: (v: number, y: number) => number): MonthRow[] {
  const end = plan.partnerA.birthYear + plan.horizonAge;
  const out: MonthRow[] = [];
  for (let y = plan.startYear; y < end; y++) {
    const r = (dd.rows as any[]).find(x => x.year === y);
    if (y < plan.retireYear || !r) { out.push({ year: y, working: true, guaranteed: 0, pots: 0, unpaid: 0 }); continue; }
    const D = (v: number) => deflate(v || 0, y);
    const g = D(r.spA + r.spB + r.dbA + r.dbB);
    const p = D(r.grossA + r.grossB + r.tfcA + r.tfcB + (r.isaDraw || 0) + (r.cashDraw || 0) + (r.giaDraw || 0));
    const s = D(r.shortfall || 0), need = g + p + s || 1;
    const unpaid = Math.round(12 * s / need), guaranteed = Math.min(12 - unpaid, Math.round(12 * g / need));
    out.push({ year: y, working: false, guaranteed, pots: 12 - guaranteed - unpaid, unpaid });
  }
  return out;
}

export interface MapCell { ok: boolean; left: number; age: number | null; trim?: boolean }
export interface DecisionMap { years: number[]; spends: number[]; cells: MapCell[][]; edge: number[] }
/** Every (stop year × spending) retirement, plus the edge: the most you can spend for each stop year. */
export function decisionMap(E: Eng, plan: any): DecisionMap {
  const P = prep(plan);
  // Every stop year from next year to age 75 (at most fifty years out), in
  // steps that keep the map to about two dozen columns on a phone.
  const first = P.startYear + 1, last = Math.max(first, Math.min(P.startYear + 50, P.partnerA.birthYear + 75));
  const yStep = Math.max(1, Math.ceil((last - first) / 24));
  const years: number[] = []; for (let y = first; y <= last; y += yStep) years.push(y);
  const top = Math.max(130000, Math.ceil(((P.targetNet || 0) * 1.4) / 5000) * 5000);
  const step = top > 200000 ? 10000 : 5000;
  const spends: number[] = []; for (let s = 20000; s <= top; s += step) spends.push(s);
  const end = (dd: any) => (dd.rows as any[])[dd.rows.length - 1];
  const real = (v: number, y: number) => v / Math.pow(1 + P.inflation, y - P.startYear);
  const cells = years.map(yr => spends.map(sp => {
    const { dd } = runOn(E, { ...P, retireYear: yr, targetNet: sp });
    const last = end(dd);
    // A structured plan that stays solvent only by trimming spending is not
    // a retirement that "lasts" as asked: it is marked with the age of the
    // first trim, so the edge (paid in full) and the squares agree.
    return paidInFull(dd) ? { ok: true, left: real(last.wealth, last.year), age: null }
      : dd.holds ? { ok: false, left: 0, age: trimmedAt(dd), trim: true }
        : { ok: false, left: 0, age: dd.runsShortAgeA };
  }));
  const edge = years.map(yr => capacity(E, { ...P, retireYear: yr }));
  return { years, spends, cells, edge };
}
