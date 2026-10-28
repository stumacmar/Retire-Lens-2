import { useEffect, useRef, useState } from 'react';
import { E } from './usePlan';
import { guardrails, decisionMap } from './insights';

type Kind = 'guardrails' | 'map';

function makeWorker(): Worker | null {
  try {
    if (typeof Worker === 'undefined') return null;
    return new Worker(new URL('./insight.worker.ts', import.meta.url), { type: 'module' });
  } catch { return null; }
}

/**
 * Ask for an expensive figure for a plan, and get it back when it is ready.
 * Requests settle for a moment first (no point working out every position of
 * a slider), run in a worker where there is one, and an answer that arrives
 * after a newer request is dropped. Until the first answer, returns null;
 * after that it keeps showing the last answer while the next is worked out,
 * so nothing flickers to empty mid-drag.
 */
export function useInsight<T>(kind: Kind, plan: any, key: string, delay = 180): T | null {
  const [value, setValue] = useState<T | null>(null);
  const worker = useRef<Worker | null | undefined>(undefined);
  const req = useRef(0);
  const latestPlan = useRef(plan);
  latestPlan.current = plan;

  useEffect(() => () => { worker.current?.terminate(); }, []);

  useEffect(() => {
    const id = ++req.current;
    const t = setTimeout(() => {
      if (worker.current === undefined) {
        worker.current = makeWorker();
        if (worker.current) {
          worker.current.onmessage = (ev: MessageEvent) => {
            const { id: got, result } = ev.data || {};
            if (got === req.current && result) setValue(result);
          };
          worker.current.onerror = () => { worker.current = null; };
        }
      }
      const P = latestPlan.current;
      if (worker.current) worker.current.postMessage({ id, kind, plan: P });
      else {
        // No worker (old browser, some test runners): work it out here.
        try { setValue((kind === 'map' ? decisionMap(E, P) : guardrails(E, P)) as any); } catch { /* keep last */ }
      }
    }, value == null ? 0 : delay);
    return () => clearTimeout(t);
  }, [kind, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return value;
}
