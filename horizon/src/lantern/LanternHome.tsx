import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import LanternCanvas from './LanternCanvas';
import { lanternModel } from './adapter';
import { Swatch, captionFor, legendFor, readout } from './words';

/**
 * The Lantern as the home's picture (owner, 18 November 2026: "move the
 * candle to the main screen", with "a key or other way to understand how
 * it's constructed in each example").
 *
 * One dark panel and one face of the tower, "Will it pay?" (owner, 20
 * November 2026, after three reviews: one face on the home, the other three
 * in the full-screen view). Left: the answer (status, what the plan can pay,
 * the gap) and under it the key, two marks. Right: the tower, with the age
 * and the count of 100 futures that pay in full beside its floors. Along the
 * foot: one line on how to read it, "How to read this", and the way to the
 * other views. Under the panel, the reading: the answer sentence at rest,
 * the open floor's year in words once a floor is tapped.
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

const FOOT_BUTTON = 'min-h-[40px] rounded-xl px-3 text-[0.76rem] font-semibold leading-tight flex items-center justify-center text-center whitespace-nowrap';
const FOOT_STYLE = { background: '#16224A', color: '#F4F6FF', border: '1px solid #6177BD' } as React.CSSProperties;

export default function LanternHome({ plan, rows, mc, head, answer, resting, spoken, onKey, onFailed }: {
  plan: any; rows: any[]; mc: any | null; head: ReactNode; answer: ReactNode; resting: string; spoken: string;
  onKey: () => void; onFailed: () => void;
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
  const legend = model ? legendFor(model, 0) : [];
  const summary = f ? line : spoken;

  return (
    <div data-lantern-home className="flex-1 flex flex-col">
      <div className="relative flex-1 min-h-[300px] [@media(min-height:650px)]:min-h-[318px] [@media(min-height:700px)]:min-h-[380px] max-h-[640px] -mx-4 sm:mx-0 sm:rounded-3xl overflow-hidden grid"
        style={{ ...PANEL_VARS, background: 'linear-gradient(180deg, #060B1A, #0B1430)', color: '#F4F6FF',
          gridTemplateColumns: 'minmax(0, 43%) minmax(0, 57%)', gridTemplateRows: 'minmax(0, 1fr) auto', ['--foot' as any]: '88px' }}>
        {/* The tower is drawn across the whole panel, standing in the right-hand part of it, so the glow has no seam. */}
        <div className="relative min-h-0 col-start-1 col-span-2 row-start-1">
          {model
            ? <LanternCanvas model={model} lens={0} selected={sel} summary={summary} compact locked onLens={() => {}} onSelect={i => setSel(s => (i === s ? -1 : i))} onFailed={onFailed} />
            : <p data-lantern-wait className="absolute inset-y-0 right-0 w-[57%] flex items-center justify-center px-4 text-center text-[0.8rem]" style={{ color: '#C9D4F2' }}>Working out 2,000 futures…</p>}
        </div>

        {/* Laid over the left of the tower's panel, and out of the flow, so the key never changes the panel's height. */}
        <div className="absolute z-10 pointer-events-none left-0 top-0 w-[43%] pl-4 pr-1 pt-3 flex flex-col overflow-hidden" style={{ bottom: 'var(--foot, 62px)' }}>
          <div>{head}</div>
          {/* The key: two marks. */}
          <ul data-lantern-legend className="mt-auto pt-1 pb-1 space-y-1">
            {legend.map(it => (
              <li key={it.label} className="flex items-center gap-1.5 leading-[1.15] text-[0.76rem]" style={{ color: '#E3E9FB' }}>
                <Swatch kind={it.kind} colour={it.colour} tile={false} />{it.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 row-start-2 px-3 pb-2 pt-1">
          <p data-lantern-caption className="px-1 text-[0.72rem] leading-snug" style={{ color: '#B9C8F5' }}>{model ? captionFor(model, 0) : ''}</p>
          <div className="mt-1.5 flex gap-2">
            <button type="button" data-lantern-key-open onClick={onKey} className={`${FOOT_BUTTON} shrink-0`} style={FOOT_STYLE}>
              How to read this <span aria-hidden="true">&nbsp;›</span>
            </button>
            {/* The other three faces (where the money comes from, what is left, a market fall) are a tap away, full screen. */}
            <a data-lantern-more href="./?lantern=1" className={`${FOOT_BUTTON} flex-1 min-w-0`} style={{ ...FOOT_STYLE, textDecoration: 'none' }}>
              Sources, money left, stress <span aria-hidden="true">&nbsp;›</span>
            </a>
          </div>
        </div>
      </div>

      {/* The reading: the answer at rest, the open floor's year once one is tapped. */}
      <p data-lantern-reading aria-live="polite" className="mt-1.5 px-0 text-center text-[0.8rem] leading-snug min-h-[3.75em]" style={{ color: f ? 'var(--color-ink)' : 'var(--color-ink-dim)' }}>
        <span className={f ? 'sr-only' : undefined}>{answer} </span>
        <span data-lantern-text>{f ? line : resting}</span>
      </p>
    </div>
  );
}
