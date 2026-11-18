import { useEffect, useRef, useState } from 'react';
import { E, MC_PATHS } from '../lib/usePlan';
import { STRESS } from './useLantern';

/**
 * The same futures after the stress, for the tower's fourth face. Run only
 * once that face has been asked for (`wanted`), in its own worker, a little
 * after the plan stops changing. Until a run for the current plan is back,
 * `fresh` is false and the last result is kept so the tower does not blink.
 */
export function useStress(plan: any, wanted: boolean): { stress: any | null; fresh: boolean } {
  const [res, setRes] = useState<{ plan: any; mc: any } | null>(null);
  const worker = useRef<Worker | null | undefined>(undefined);
  const req = useRef(0);
  const latest = useRef(plan); latest.current = plan;

  useEffect(() => {
    if (!wanted) return;
    if (worker.current === undefined) {
      try { worker.current = typeof Worker === 'undefined' ? null : new Worker(new URL('../lib/mc.worker.ts', import.meta.url), { type: 'module' }); }
      catch { worker.current = null; }
      if (worker.current) {
        worker.current.onmessage = (ev: MessageEvent) => {
          const { id, mc } = ev.data || {};
          if (id === req.current && mc) setRes({ plan: latest.current, mc });
        };
        worker.current.onerror = () => { worker.current = null; };
      }
    }
    const id = ++req.current, seed = plan.mcSeed || 42;
    const t = window.setTimeout(() => {
      const w = worker.current;
      if (w) { w.postMessage({ id, plan, paths: MC_PATHS, seed, opts: { shock: STRESS } }); return; }
      try { if (id === req.current) setRes({ plan, mc: E.runMonteCarlo(plan, MC_PATHS, seed, { shock: STRESS }) }); } catch { /* the face keeps its last state */ }
    }, 350);
    return () => window.clearTimeout(t);
  }, [plan, wanted]);

  useEffect(() => () => { worker.current?.terminate(); }, []);
  return { stress: res ? res.mc : null, fresh: !!res && res.plan === plan };
}
