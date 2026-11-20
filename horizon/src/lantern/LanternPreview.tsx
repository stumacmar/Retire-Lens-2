import { useEffect, useState } from 'react';
import LanternCanvas from './LanternCanvas';
import { useLantern } from './useLantern';
import { LENSES, Swatch, captionFor, gbp, legendFor, readout } from './words';

/**
 * The Lantern full screen at ?lantern=1: the tower drawn from the plan on
 * this device through the engine, read only. The home shows the same tower
 * in a panel; this is the larger view of it.
 */
export default function LanternPreview() {
  const { model, own, failed } = useLantern();
  const [lens, setLens] = useState(0);
  const [sel, setSel] = useState(-1);
  // Open at 85 where the plan reaches it, else two thirds of the way up.
  useEffect(() => {
    if (!model) return;
    const at85 = model.floors.findIndex(f => f.age === 85);
    setSel(at85 >= 0 ? at85 : Math.floor((model.floors.length * 2) / 3));
  }, [model]);
  const f = model && sel >= 0 ? model.floors[Math.min(sel, model.floors.length - 1)] : null;
  const last = model ? model.floors[model.floors.length - 1] : null;
  const line = model && f ? readout(model, f, lens) : model ? 'Tap a floor to read that year.' : '';
  const summary = model && last ? `The Lantern: a tower of ${model.floors.length} years, age ${model.floors[0].age} to ${last.age}. ${line}` : 'The Lantern';

  return (
    <main data-lantern-preview data-own={own ? '1' : '0'} className="fixed inset-0 flex flex-col"
      style={{ background: 'linear-gradient(180deg, #060B1A, #0B1430)', color: '#E6ECFF',
        paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
      <header className="flex items-center justify-between gap-3 px-4 pt-2">
        <h1 className="text-[1rem] font-extrabold tracking-tight">The Lantern <span data-lantern-whose className="font-semibold text-[0.78rem]" style={{ color: '#9FB0D9' }}>{own ? 'your plan' : 'example figures'}</span></h1>
        <a href="./" className="text-[0.8rem] font-semibold underline min-h-[44px] flex items-center" style={{ color: '#B9C8F5' }}>Back to Someday</a>
      </header>

      <div className="flex-1 min-h-[260px] relative">
        {model
          ? <LanternCanvas model={model} lens={lens} selected={sel} summary={summary} onLens={setLens} onSelect={i => setSel(s => (i === s ? -1 : i))} />
          : <p data-lantern-wait className="absolute inset-0 flex items-center justify-center px-8 text-center text-[0.9rem]" style={{ color: '#C9D4F2' }}>
              {failed ? 'The futures could not be worked out for this plan. Check your figures in Details.' : 'Working out 2,000 futures…'}
            </p>}
      </div>

      <div className="mx-auto w-full max-w-[560px] px-4">
        <p data-lantern-readout aria-live="polite" className="text-[0.86rem] leading-snug min-h-[4.2em]">{line}</p>
        <p data-lantern-left className="text-[0.78rem] leading-snug min-h-[1.4em]" style={{ color: '#9FB0D9' }}>{last ? `Median left at ${last.age}: about ${gbp(Math.round(last.wealth.p50 / 1000) * 1000)} in today’s money.` : ''}</p>

        <div role="group" aria-label="Lens" className="mt-2 grid grid-cols-4 gap-1.5">
          {LENSES.map((name, k) => (
            <button key={name} type="button" data-lens={k} aria-pressed={lens === k} onClick={() => setLens(k)}
              className="min-h-[44px] rounded-xl px-1 text-[0.78rem] font-bold leading-tight"
              style={lens === k
                ? { background: '#DCE6FF', color: '#0B1430', border: '1px solid #DCE6FF' }
                : { background: '#111B3D', color: '#E6ECFF', border: '1px solid #6177BD' }}>
              {name}
            </button>
          ))}
        </div>
        {/* The key for the face that is showing: a drawn sample beside each meaning. */}
        <div data-lantern-key className="mt-2 min-h-[5.4em]">
          <p className="text-[0.74rem] leading-snug" style={{ color: '#9FB0D9' }}>{model ? captionFor(model, lens) : ''}</p>
          <ul data-lantern-legend className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {model && legendFor(model, lens).map(it => (
              <li key={it.label} className="flex items-center gap-1.5 text-[0.74rem] leading-tight" style={{ color: '#C9D4F2' }}>
                <Swatch kind={it.kind} colour={it.colour} tile={false} />{it.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
