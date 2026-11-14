import { E } from './usePlan';

/**
 * The engine's load-time assertions, run once per session and remembered.
 * They take a few hundred milliseconds (a Monte Carlo and thirteen plan
 * shapes), so nothing may run them on a render path: turning the ring
 * re-renders the app many times a second.
 */
export interface Check { name: string; pass: boolean; got: number; want: number }
let cache: Check[] | null = null;

/** Run now if not yet run. Call from an event handler, an effect or idle time. */
export function selfCheck(): Check[] {
  if (!cache) { try { cache = (E as any).runAssertions() as Check[]; } catch { cache = []; } }
  return cache;
}
/** The remembered result, or null if the checks have not run yet. Safe in render. */
export const selfCheckCached = (): Check[] | null => cache;
