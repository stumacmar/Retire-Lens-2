import { useCallback, useEffect, useMemo, useState } from 'react';
import { createEngine } from '../engine/engine';
import type { Plan, Accum, Drawdown, MC } from '../engine/engine';

// One engine instance — the SAME byte-verified maths as the production app.
const E = createEngine();
const KEY = 'horizon-plan-v1';

export type Lens = 'bear' | 'base' | 'bull';

export function hasSavedPlan(): boolean {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

function loadPlan(): Plan {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...E.defaults(), ...JSON.parse(s) };
  } catch { /* fall through */ }
  // New visitor: a gentle blank start (freshStart), completed via onboarding.
  return E.freshStart();
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
    const a = acc.atRetirement;
    const potsAtRet = a.pensionA + a.pensionB + a.isaA + a.isaB;
    return { acc, dd, ddBear, ddBull, estate, potsAtRet };
  }, [plan, growth]);

  // Monte-Carlo (500 paths) is the expensive bit → debounce it so dragging a
  // slider never blocks on a full simulation. Confidence settles ~300ms after
  // you stop moving. (UX audit fix: no jank on continuous input.)
  const [mc, setMc] = useState<MC | null>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      try { setMc(E.runMonteCarlo({ ...plan, growth }, 500, plan.mcSeed || 42)); } catch { setMc(null); }
    }, 300);
    return () => clearTimeout(id);
  }, [plan, growth]);

  return { plan, lens, growth, update, setLens, mc, ...derived };
}

export { E };
