import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import LanternCanvas from './LanternCanvas';
import { lanternModel } from './adapter';
import { readout } from './words';

/**
 * The Lantern as the home's picture: one dark panel, the tower, and the
 * answer beside it. Nothing else.
 *
 * Scout, 21 November 2026 (the owner: "The UX is now too complex", and
 * "something visually stunning and different but simplicity is important"):
 * the key, the caption, "How to read this", the way out to the other views
 * and the count beside every fifth floor are gone from here, and the space
 * they took goes to the tower. Lit means paid; unlit means not. A tap on a
 * floor still opens it and reads that year in words under the panel. The
 * other three faces are in the full-screen view, reached from Explore.
 *
 * The tower is drawn from the same results as everything else on the home:
 * the central case's rows and the simulated futures the home already has.
 */
const PANEL_VARS = {
  // The home's answer is written with theme tokens; inside the navy panel they are given light values.
  '--color-ink': '#F4F6FF', '--color-ink-dim': '#B9C8F5', '--color-ink-faint': '#9FB0D9',
  '--color-ring': '#FFC53D', '--color-slate': '#B7C6E0',
  // Gold means "paid in full" and nothing else: the status is said in white beside its dot (colour review, 20 November 2026).
  '--status-ink': '#F4F6FF',
} as React.CSSProperties;

export default function LanternHome({ plan, rows, mc, head, answer, spoken, onFailed }: {
  plan: any; rows: any[]; mc: any | null; head: ReactNode; answer: ReactNode; spoken: string; onFailed: () => void;
}) {
  const [sel, setSel] = useState(-1);
  const P = useMemo(() => ({ ...plan, growth: plan.growthBase ?? plan.growth }), [plan]);

  const model = useMemo(
    () => (mc && mc.perAgePaid && rows.length ? lanternModel({ plan: P, rows, mc, stress: null }) : null),
    [P, rows, mc]);
  const n = model ? model.floors.length : 0;
  useEffect(() => { if (sel >= n) setSel(-1); }, [sel, n]);
  const f = model && sel >= 0 && sel < n ? model.floors[sel] : null;
  const line = model && f ? readout(model, f, 0) : '';
  const summary = f ? line : spoken;

  return (
    <div data-lantern-home className="flex-1 flex flex-col">
      <div className="relative flex-1 min-h-[300px] [@media(min-height:650px)]:min-h-[318px] [@media(min-height:700px)]:min-h-[380px] max-h-[640px] -mx-4 sm:mx-0 sm:rounded-3xl overflow-hidden"
        style={{ ...PANEL_VARS, background: 'linear-gradient(180deg, #060B1A, #0B1430)', color: '#F4F6FF' }}>
        {/* The tower is drawn across the whole panel, standing in the right-hand part of it, so the glow has no seam. */}
        <div className="absolute inset-0">
          {model
            ? <LanternCanvas model={model} lens={0} selected={sel} summary={summary} compact locked onLens={() => {}} onSelect={i => setSel(s => (i === s ? -1 : i))} onFailed={onFailed} />
            : <p data-lantern-wait className="absolute inset-y-0 right-0 w-[57%] flex items-center justify-center px-4 text-center text-[0.84rem]" style={{ color: '#C9D4F2' }}>Working out 2,000 futures…</p>}
        </div>

        {/* The answer, laid over the left of the panel. */}
        <div className="absolute z-10 pointer-events-none left-0 top-0 w-[43%] pl-4 pr-1 pt-4">{head}</div>
      </div>

      {/* Under the picture: the answer in one sentence, or the open floor's year once one is tapped. */}
      <p data-lantern-reading aria-live="polite" className="mt-2 px-0 text-center text-[0.88rem] leading-snug min-h-[2.75em]" style={{ color: 'var(--color-ink)' }}>
        <span className={f ? 'sr-only' : undefined}>{answer}</span>
        <span data-lantern-text>{f ? line : ''}</span>
      </p>
    </div>
  );
}
