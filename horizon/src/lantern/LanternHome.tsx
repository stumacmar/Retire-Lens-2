import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import LanternCanvas from './LanternCanvas';
import { useStress } from './useStress';
import { essentialOf, lanternModel } from './adapter';
import { LENSES, Swatch, captionFor, legendFor, readout } from './words';

/**
 * The Lantern as the home's picture (owner, 18 November 2026: "move the
 * candle to the main screen", with "a key or other way to understand how
 * it's constructed in each example").
 *
 * One dark panel. Left: the answer (status, what the plan can pay, the gap),
 * and under it the key for the face that is showing, a drawn sample beside
 * each meaning, with a button that opens the full explanation. Right: the
 * tower. Along the foot: one line on how the face is laid out, and the four
 * lens buttons. Under the panel, the reading: the answer sentence at rest,
 * the open floor's year in words once a floor is tapped.
 *
 * The tower is drawn from the same results as everything else on the home:
 * the central case's rows and the simulated futures the home already has.
 * The stress run starts only when the Stress face is first asked for.
 */
const PANEL_VARS = {
  // The home's answer is written with theme tokens; inside the navy panel they are given light values.
  '--color-ink': '#F4F6FF', '--color-ink-dim': '#B9C8F5', '--color-ink-faint': '#9FB0D9',
  '--color-ring': '#FFC24A', '--color-slate': '#B7C6E0',
} as React.CSSProperties;

export default function LanternHome({ plan, rows, mc, head, answer, resting, spoken, onKey, onFailed }: {
  plan: any; rows: any[]; mc: any | null; head: ReactNode; answer: ReactNode; resting: string; spoken: string;
  onKey: () => void; onFailed: () => void;
}) {
  const [lens, setLens] = useState(0);
  const [sel, setSel] = useState(-1);
  const [wantStress, setWantStress] = useState(false);
  useEffect(() => { if (lens === 3) setWantStress(true); }, [lens]);
  const P = useMemo(() => ({ ...plan, growth: plan.growthBase ?? plan.growth }), [plan]);
  const { stress, fresh } = useStress(P, wantStress);

  const model = useMemo(
    () => (mc && mc.perAgePaid && rows.length ? lanternModel({ plan: P, rows, mc, stress, essential: essentialOf(P) }) : null),
    [P, rows, mc, stress]);
  const n = model ? model.floors.length : 0;
  useEffect(() => { if (sel >= n) setSel(-1); }, [sel, n]);
  const f = model && sel >= 0 && sel < n ? model.floors[sel] : null;
  const line = model && f ? readout(model, f, lens) : '';
  // The key for the showing face; a long list of sources is set a little smaller so it always fits beside the tower.
  const legend = model ? legendFor(model, lens) : [];
  const summary = f ? line : spoken;

  return (
    <div data-lantern-home data-stress-ready={fresh ? '1' : '0'} className="flex-1 flex flex-col">
      <div className="relative flex-1 min-h-[300px] [@media(min-height:650px)]:min-h-[318px] [@media(min-height:700px)]:min-h-[380px] max-h-[640px] -mx-4 sm:mx-0 sm:rounded-3xl overflow-hidden grid"
        style={{ ...PANEL_VARS, background: 'linear-gradient(180deg, #060B1A, #0B1430)', color: '#F4F6FF',
          gridTemplateColumns: 'minmax(0, 43%) minmax(0, 57%)', gridTemplateRows: 'minmax(0, 1fr) auto', ['--foot' as any]: '88px' }}>
        {/* The tower is drawn across the whole panel, standing in the right-hand part of it, so the glow has no seam. */}
        <div className="relative min-h-0 col-start-1 col-span-2 row-start-1">
          {model
            ? <LanternCanvas model={model} lens={lens} selected={sel} summary={summary} compact onLens={setLens} onSelect={i => setSel(s => (i === s ? -1 : i))} onFailed={onFailed} />
            : <p data-lantern-wait className="absolute inset-y-0 right-0 w-[57%] flex items-center justify-center px-4 text-center text-[0.8rem]" style={{ color: '#C9D4F2' }}>Working out 2,000 futures…</p>}
        </div>

        {/* Laid over the left of the tower's panel, and out of the flow, so the key's length never changes the panel's height. */}
        <div className="absolute z-10 pointer-events-none left-0 top-0 w-[43%] pl-4 pr-1 pt-3 flex flex-col overflow-hidden" style={{ bottom: 'var(--foot, 62px)' }}>
          <div>{head}</div>
          {/* The key for the face that is showing. */}
          <ul data-lantern-legend className={`mt-auto pt-1 pb-0.5 ${legend.length > 5 ? 'space-y-0' : 'space-y-[2px]'}`}>
            {legend.map(it => (
              <li key={it.label} className={`flex items-center gap-1.5 leading-[1.15] ${legend.length > 5 ? 'text-[0.62rem]' : 'text-[0.66rem]'}`} style={{ color: '#D5DEF8' }}>
                <Swatch kind={it.kind} colour={it.colour} tile={false} />{it.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 row-start-2 px-2 pb-2 pt-1">
          <div className="flex items-center gap-2 pl-2">
            <p data-lantern-caption className="flex-1 min-w-0 text-[0.68rem] leading-tight" style={{ color: '#9FB0D9' }}>{model ? captionFor(model, lens) : ''}</p>
            <button type="button" data-lantern-key-open onClick={onKey}
              className="shrink-0 min-h-[30px] rounded-full px-3 text-[0.72rem] font-semibold whitespace-nowrap"
              style={{ background: '#16224A', color: '#F4F6FF', border: '1px solid #3A4C8C' }}>
              How to read this <span aria-hidden="true">›</span>
            </button>
          </div>
          <div role="group" aria-label="What the tower shows" className="mt-1 grid grid-cols-4 gap-1.5">
            {LENSES.map((name, k) => (
              <button key={name} type="button" data-lens={k} aria-pressed={lens === k} onClick={() => setLens(k)}
                className="min-h-[38px] rounded-xl px-0.5 text-[0.74rem] font-bold leading-tight"
                style={lens === k
                  ? { background: '#FFC24A', color: '#141B33', border: '1px solid #FFC24A' }
                  : { background: '#111B3D', color: '#F4F6FF', border: '1px solid #3A4C8C' }}>
                {name}
              </button>
            ))}
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
