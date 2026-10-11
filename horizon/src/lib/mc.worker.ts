// Monte Carlo off the main thread. The worker holds its own engine instance
// (the same byte-verified module) and answers {id, plan, paths, seed} with
// {id, mc}. Stale answers are dropped by the caller using the id.
import { createEngine } from '../engine/engine';
const E = createEngine();
self.onmessage = (ev: MessageEvent) => {
  const { id, plan, paths, seed } = ev.data || {};
  try {
    const mc = E.runMonteCarlo(plan, paths, seed);
    (self as any).postMessage({ id, mc });
  } catch (e: any) {
    (self as any).postMessage({ id, error: String(e && e.message || e) });
  }
};
