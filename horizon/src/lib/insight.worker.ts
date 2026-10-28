// Guardrails and the decision map off the main thread — together they are
// several hundred engine runs, which would make a slider stutter. Same
// byte-verified engine and the same pure functions the app would call.
import { createEngine } from '../engine/engine';
import { guardrails, decisionMap } from './insights';
const E = createEngine();
self.onmessage = (ev: MessageEvent) => {
  const { id, kind, plan } = ev.data || {};
  try {
    const result = kind === 'map' ? decisionMap(E, plan) : guardrails(E, plan);
    (self as any).postMessage({ id, result });
  } catch (e: any) {
    (self as any).postMessage({ id, error: String(e && e.message || e) });
  }
};
