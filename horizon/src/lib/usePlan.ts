import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createEngine } from '../engine/engine';
import type { Plan, Accum, Drawdown, MC } from '../engine/engine';

// One engine instance — the SAME byte-verified maths as the production app.
const E = createEngine();
const KEY = 'horizon-plan-v1';
// The confidence figure is shown with its sampling range, so it needs enough
// paths for that range to be tight (2,000 → about one point either way).
export const MC_PATHS = 2000;

export type Lens = 'bear' | 'base' | 'bull';

export function hasSavedPlan(): boolean {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

// Saved plans are migrated to the current schema on load: missing fields are
// filled, bad values repaired and the tax constants always come from the
// engine (never from a plan saved under an older tax year).
function loadPlan(): Plan {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return (E as any).migratePlan(JSON.parse(s));
  } catch { /* fall through */ }
  // New visitor: a gentle blank start (freshStart), completed via onboarding.
  return E.freshStart();
}

export function exportPlanJson(plan: Plan): string {
  return JSON.stringify({ app: 'Someday', schemaVersion: (E as any).SCHEMA_VERSION, exported: new Date().toISOString(), plan }, null, 2);
}
export function importPlanJson(text: string): Plan {
  const raw = JSON.parse(text);
  const p = raw && raw.plan && typeof raw.plan === 'object' ? raw.plan : raw;
  if (!p || typeof p !== 'object' || !p.partnerA) throw new Error('Not a Someday plan file');
  return (E as any).migratePlan(p);
}

export interface PlanResult {
  plan: Plan;
  lens: Lens;
  growth: number;
  acc: Accum; dd: Drawdown; ddBear: Drawdown; ddBull: Drawdown;
  mc: MC | null;
  mcPending: boolean;
  estate: any;
  potsAtRet: number;
  issues: { path: string; message: string; level: 'error' | 'warn' }[];
  update: (patch: Partial<Plan> | ((p: Plan) => Plan)) => void;
  setLens: (l: Lens) => void;
}

// The simulation runs in a web worker where the browser has one, so dragging
// a slider never waits on 2,000 futures; otherwise it runs here, debounced.
function makeWorker(): Worker | null {
  try {
    if (typeof Worker === 'undefined') return null;
    return new Worker(new URL('./mc.worker.ts', import.meta.url), { type: 'module' });
  } catch { return null; }
}

export function usePlan(): PlanResult {
  const [plan, setPlan] = useState<Plan>(loadPlan);
  const [lens, setLens] = useState<Lens>('base');

  const update = useCallback((patch: Partial<Plan> | ((p: Plan) => Plan)) => {
    setPlan(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);

  const growth = lens === 'bear' ? plan.growthBear : lens === 'bull' ? plan.growthBull : plan.growthBase;

  // Deterministic maths is cheap → compute live on every change (smooth sliders).
  const derived = useMemo(() => {
    const P: Plan = { ...plan, growth };
    const acc = E.accumulate(P, growth);
    const dd = E.drawdown(P, { growth, startPots: acc.atRetirement });
    const accBear = E.accumulate(P, plan.growthBear);
    const accBull = E.accumulate(P, plan.growthBull);
    const ddBear = E.drawdown(P, { growth: plan.growthBear, startPots: accBear.atRetirement });
    const ddBull = E.drawdown(P, { growth: plan.growthBull, startPots: accBull.atRetirement });
    let estate: any = null;
    try { estate = E.estate(P); } catch { estate = null; }
    let issues: PlanResult['issues'] = [];
    try { issues = (E as any).validatePlan(P); } catch { issues = []; }
    const a = acc.atRetirement;
    const potsAtRet = a.pensionA + a.pensionB + a.isaA + a.isaB;
    return { acc, dd, ddBear, ddBull, estate, potsAtRet, issues };
  }, [plan, growth]);

  const [mc, setMc] = useState<MC | null>(null);
  const [mcPending, setMcPending] = useState(false);
  const workerRef = useRef<Worker | null | undefined>(undefined);
  const reqId = useRef(0);
  useEffect(() => {
    if (workerRef.current === undefined) {
      workerRef.current = makeWorker();
      if (workerRef.current) {
        workerRef.current.onmessage = (ev: MessageEvent) => {
          const { id, mc: result } = ev.data || {};
          if (id !== reqId.current) return;          // a newer request is in flight
          setMc(result || null); setMcPending(false);
        };
        workerRef.current.onerror = () => { workerRef.current = null; };
      }
    }
    const id = ++reqId.current;
    setMcPending(true);
    const run = () => {
      const P = { ...plan, growth };
      const w = workerRef.current;
      if (w) { w.postMessage({ id, plan: P, paths: MC_PATHS, seed: plan.mcSeed || 42 }); return; }
      try { if (id === reqId.current) setMc(E.runMonteCarlo(P, MC_PATHS, plan.mcSeed || 42)); } catch { setMc(null); }
      setMcPending(false);
    };
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [plan, growth]);

  return { plan, lens, growth, update, setLens, mc, mcPending, ...derived };
}

export { E };
