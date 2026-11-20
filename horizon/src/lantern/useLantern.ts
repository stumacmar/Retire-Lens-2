import { useEffect, useMemo, useState } from 'react';
import { E, MC_PATHS, loadPlan } from '../lib/usePlan';
import { lanternModel } from './adapter';
import type { LanternModel } from './model';

/** The stress the fourth face shows until there is a control for it. */
export const STRESS = { year: 1, size: 0.3 };

const hasMoney = (p: any) => {
  const A = p.partnerA || {}, B = p.partnerB || {}, single = p.household === 'single';
  return ((A.pension || 0) + (A.isa || 0) + (single ? 0 : (B.pension || 0) + (B.isa || 0)) + (p.cash || 0) + (A.monthlyPension || 0)) > 0;
};

/**
 * The plan on this device, run through the engine and the adapter. Read
 * only: this stage changes nothing in the plan. With no figures on the
 * device it shows the engine's made-up example and says so.
 *
 * Two simulations run in a worker (the same module the app uses): the plan
 * as it is, and the same futures with the stress. The tower is built once
 * both are back.
 */
export function useLantern(): { model: LanternModel | null; own: boolean; plan: any; failed: boolean } {
  const [{ plan, own }] = useState(() => {
    const saved: any = loadPlan(), mine = hasMoney(saved), q: any = mine ? saved : E.example();
    return { plan: { ...q, growth: q.growthBase ?? q.growth }, own: mine };
  });
  const rows = useMemo(() => E.drawdown(plan).rows as any[], [plan]);
  const [runs, setRuns] = useState<{ base: any; stress: any }>({ base: null, stress: null });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true, worker: Worker | null = null;
    const seed = plan.mcSeed || 42;
    const here = () => {
      // No worker: run on the main thread, after the page has painted.
      window.setTimeout(() => {
        if (!live) return;
        try { setRuns({ base: E.runMonteCarlo(plan, MC_PATHS, seed), stress: E.runMonteCarlo(plan, MC_PATHS, seed, { shock: STRESS }) }); }
        catch { setFailed(true); }
      }, 60);
    };
    try { worker = typeof Worker === 'undefined' ? null : new Worker(new URL('../lib/mc.worker.ts', import.meta.url), { type: 'module' }); } catch { worker = null; }
    if (!worker) { here(); return () => { live = false; }; }
    const got: { base: any; stress: any } = { base: null, stress: null };
    worker.onmessage = (ev: MessageEvent) => {
      const { id, mc, error } = ev.data || {};
      if (!live) return;
      if (error || !mc) { setFailed(true); return; }
      if (id === 'base') got.base = mc; else if (id === 'stress') got.stress = mc;
      if (got.base && got.stress) setRuns({ base: got.base, stress: got.stress });
    };
    worker.onerror = () => { if (live) { worker?.terminate(); worker = null; here(); } };
    worker.postMessage({ id: 'base', plan, paths: MC_PATHS, seed });
    worker.postMessage({ id: 'stress', plan, paths: MC_PATHS, seed, opts: { shock: STRESS } });
    return () => { live = false; worker?.terminate(); };
  }, [plan]);

  const model = useMemo(
    () => (runs.base && runs.stress ? lanternModel({ plan, rows, mc: runs.base, stress: runs.stress }) : null),
    [plan, rows, runs]);
  return { model, own, plan, failed };
}
