import { useCallback, useMemo, useState } from 'react';
import { createEngine } from '../engine/engine';
import type { Plan, Accum, Drawdown, MC } from '../engine/engine';

// One engine instance — the SAME byte-verified maths as the production app.
const E = createEngine();
const KEY = 'horizon-plan-v1';

export type Lens = 'bear' | 'base' | 'bull';

function loadPlan(): Plan {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...E.defaults(), ...JSON.parse(s) };
  } catch { /* fall through */ }
  // Seed with the worked example so the Horizon is alive on first open.
  return E.defaults();
}

export interface PlanResult {
  plan: Plan;
  lens: Lens;
  growth: number;
  acc: Accum; dd: Drawdown; ddBear: Drawdown; ddBull: Drawdown;
  mc: MC | null;
  estate: any;
  potsAtRet: number;
  update: (patch: Partial<Plan> | ((p: Plan) => Plan)) => void;
  setLens: (l: Lens) => void;
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

  const derived = useMemo(() => {
    const P: Plan = { ...plan, growth };
    const acc = E.accumulate(P, growth);
    const dd = E.drawdown(P, { growth, startPots: acc.atRetirement });
    // Poor / Positive envelope for the serene confidence band.
    const accBear = E.accumulate(P, plan.growthBear);
    const accBull = E.accumulate(P, plan.growthBull);
    const ddBear = E.drawdown(P, { growth: plan.growthBear, startPots: accBear.atRetirement });
    const ddBull = E.drawdown(P, { growth: plan.growthBull, startPots: accBull.atRetirement });
    let mc: MC | null = null;
    try { mc = E.runMonteCarlo(P, 500, P.mcSeed || 42); } catch { mc = null; }
    let estate: any = null;
    try { estate = E.estate(P); } catch { estate = null; }
    const a = acc.atRetirement;
    const potsAtRet = a.pensionA + a.pensionB + a.isaA + a.isaB;
    return { acc, dd, ddBear, ddBull, mc, estate, potsAtRet };
  }, [plan, growth]);

  return { plan, lens, growth, update, setLens, ...derived };
}

export { E };
