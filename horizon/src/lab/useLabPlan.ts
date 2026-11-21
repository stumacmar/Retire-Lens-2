import { useEffect, useMemo, useState } from 'react';
import { E, MC_PATHS, loadPlan } from '../lib/usePlan';
import { lanternModel, of100 } from '../lantern/adapter';
import type { LanternModel } from '../lantern/model';
import { planCounts } from '../lib/counts';

/**
 * The plan on this device run through the real engine, and the handful of
 * facts every lab concept draws from. Read only. With no figures on the
 * device it uses the engine's made-up example.
 */
export type LabFacts = {
  own: boolean;
  month: number;            // what is asked, a month, after tax
  toAge: number;            // the plan age the answer sentence names
  stopAge: number;
  p: number;                // share of futures in which it is paid every year (with the rules, on a structured plan)
  futures: number;          // the same, of 100
  pays: boolean;            // the central case pays every year
  years: { age: number; p: number; index: number }[];   // the first year, each fifth birthday and the last: share of futures paying that year
  cover: { lo: number; mid: number; hi: number };       // have ÷ need at the day of stopping: unlucky 1 in 10, middle, lucky 1 in 10
  guaranteed: { month: number; fromAge: number; share: number };   // after tax, today's money, once it is all in payment
  counts: ReturnType<typeof planCounts>;
  model: LanternModel;
};

const hasMoney = (p: any) => {
  const A = p.partnerA || {}, B = p.partnerB || {}, single = p.household === 'single';
  return ((A.pension || 0) + (A.isa || 0) + (single ? 0 : (B.pension || 0) + (B.isa || 0)) + (p.cash || 0) + (A.monthlyPension || 0)) > 0;
};

export function useLabPlan(): { facts: LabFacts | null; failed: boolean } {
  const [{ plan, own }] = useState(() => {
    const saved: any = loadPlan(), mine = hasMoney(saved), q: any = mine ? saved : E.example();
    return { plan: { ...q, growth: q.growthBase ?? q.growth }, own: mine };
  });
  const dd = useMemo(() => E.drawdown(plan) as any, [plan]);
  const [mc, setMc] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true, worker: Worker | null = null;
    const seed = plan.mcSeed || 42;
    const here = () => window.setTimeout(() => { if (!live) return; try { setMc(E.runMonteCarlo(plan, MC_PATHS, seed)); } catch { setFailed(true); } }, 60);
    try { worker = typeof Worker === 'undefined' ? null : new Worker(new URL('../lib/mc.worker.ts', import.meta.url), { type: 'module' }); } catch { worker = null; }
    if (!worker) { here(); return () => { live = false; }; }
    worker.onmessage = (ev: MessageEvent) => { if (!live) return; const { mc: m, error } = ev.data || {}; if (error || !m) setFailed(true); else setMc(m); };
    worker.onerror = () => { if (live) { worker?.terminate(); worker = null; here(); } };
    worker.postMessage({ id: 'base', plan, paths: MC_PATHS, seed });
    return () => { live = false; worker?.terminate(); };
  }, [plan]);

  const facts = useMemo<LabFacts | null>(() => {
    if (!mc || !mc.perAgePaid) return null;
    const rows = dd.rows as any[], model = lanternModel({ plan, rows, mc, stress: null }), F = model.floors, n = F.length;
    if (!n) return null;
    const structured = !!plan.architecture?.on;
    const p = structured && mc.successProbWithCuts != null ? mc.successProbWithCuts : mc.successProb;
    const years = F.map((f, i) => ({ age: f.age, p: of100(f.windows) / 100, index: i })).filter((y, i) => i === 0 || i === n - 1 || (y.age % 5 === 0 && i > 1 && i < n - 2));
    const q = mc.perAgeCover?.ages?.[0]?.q || [], cover = { lo: q[2] ?? 1, mid: q[10] ?? 1, hi: q[18] ?? 1 };
    // Guaranteed income after tax, in today's money, in the first year it is all in payment.
    const real = (r: any) => Math.pow(1 + (plan.inflation || 0), r.year - plan.startYear);
    let best = { v: 0, i: 0 };
    rows.forEach((r, i) => { const v = (r.guaranteedNet || 0) / real(r); if (v > best.v * 1.01) best = { v, i }; });
    const at = rows[best.i], ask = (at?.planTarget || plan.targetNet) / real(at);
    return {
      own, month: Math.round((plan.targetNet || 0) / 12), toAge: plan.horizonAge, stopAge: F[0].age, p, futures: Math.round(p * 100), pays: !!dd.holds, years, cover,
      guaranteed: { month: Math.round(best.v / 12), fromAge: at?.ageA ?? F[0].age, share: ask > 0 ? Math.min(1, best.v / ask) : 0 },
      counts: planCounts(plan), model,
    };
  }, [plan, dd, mc, own]);

  return { facts, failed };
}
