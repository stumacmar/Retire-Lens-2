/**
 * The figures behind the payslip, Months and the decision map. Pure
 * functions of a plan and an engine instance, so the same code runs on the
 * main thread and in the insight worker and can never disagree.
 *
 * "Lasts" means what it means everywhere else in the app: partner A's money
 * is not exhausted before the plan ends (drawdown().exhaustedAgeA == null).
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

/** The most a year the plan can pay and still last, to the nearest £100. */
export function capacity(E: Eng, plan: any, opts: { path?: string | null; growth?: number | null } = {}) {
  const P = prep(plan);
  let lo = 2000, hi = Math.max(250000, (P.targetNet || 0) * 3);
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (runOn(E, { ...P, targetNet: mid }, opts as any).dd.exhaustedAgeA == null) lo = mid; else hi = mid;
  }
  return Math.floor(lo / 100) * 100;
}

export interface Rail { key: string; label: string; when?: string; year: number }
/** Guardrails: safe yearly spending under four real bad histories and the three lenses. */
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
  return [...histories, ...lenses];
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

export interface MapCell { ok: boolean; left: number; age: number | null }
export interface DecisionMap { years: number[]; spends: number[]; cells: MapCell[][]; edge: number[] }
/** Every (stop year × spending) retirement, plus the edge: the most you can spend for each stop year. */
export function decisionMap(E: Eng, plan: any): DecisionMap {
  const P = prep(plan);
  const years: number[] = []; for (let y = P.startYear + 1; y <= P.startYear + 19; y++) years.push(y);
  const top = Math.max(130000, Math.ceil(((P.targetNet || 0) * 1.4) / 5000) * 5000);
  const step = top > 200000 ? 10000 : 5000;
  const spends: number[] = []; for (let s = 20000; s <= top; s += step) spends.push(s);
  const end = (dd: any) => (dd.rows as any[])[dd.rows.length - 1];
  const real = (v: number, y: number) => v / Math.pow(1 + P.inflation, y - P.startYear);
  const cells = years.map(yr => spends.map(sp => {
    const { dd } = runOn(E, { ...P, retireYear: yr, targetNet: sp });
    const last = end(dd);
    return dd.exhaustedAgeA == null
      ? { ok: true, left: real(last.wealth, last.year), age: null }
      : { ok: false, left: 0, age: dd.exhaustedAgeA };
  }));
  const edge = years.map(yr => capacity(E, { ...P, retireYear: yr }));
  return { years, spends, cells, edge };
}
