import { useEffect, useRef, useState } from 'react';

/** Tween a number toward its target (easeOutCubic) whenever it changes.
 *  Respects prefers-reduced-motion. Powers the calm "count-up" on the answer. */
export function useCountUp(target: number, ms = 600): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  const raf = useRef(0);
  useEffect(() => {
    let reduce = false;
    try { reduce = !matchMedia('(prefers-reduced-motion: no-preference)').matches; } catch { /* noop */ }
    if (reduce) { setV(target); return; }
    const start = performance.now(), a = from.current, b = target;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3);
      setV(a + (b - a) * e);
      if (k < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return v;
}
