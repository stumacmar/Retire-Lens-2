import { useEffect, useState } from 'react';
import LanternCanvas from './LanternCanvas';
import { useLantern } from './useLantern';
import { SOURCE_NAME } from './model';
import type { Floor, LanternModel } from './model';
import { countWindows } from './adapter';

/**
 * The Lantern preview at ?lantern=1 (docs/LANTERN_PLAN.md, Stage 2): the
 * tower drawn from the plan on this device through the engine. Read only,
 * and it does not replace the home.
 */
const LENSES = ['Will it pay?', 'Sources', "What's left", 'Stress'];

const gbp = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`;
const gbpK = (v: number) => (v < 500 ? 'nothing' : v >= 1e6 ? `£${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}m` : `£${Math.round(v / 1000)}k`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function windowsLine(f: Floor, w: Floor['windows'], lead: string) {
  const c = countWindows(w);
  const parts = [`${c.full} of 20 futures pay your full ${gbp(f.spend)}.`];
  if (c.floor) parts.push(`${c.floor} pay${c.floor === 1 ? 's' : ''} less than the plan but cover${c.floor === 1 ? 's' : ''} the essentials.`);
  if (c.short) parts.push(`${c.short} fall${c.short === 1 ? 's' : ''} short.`);
  return `${lead} ${parts.join(' ')}`;
}

function readout(m: LanternModel, f: Floor, lens: number) {
  const at = `At ${f.age} (${f.year}):`;
  if (lens === 1) {
    if (!f.sources.length) return `${at} nothing was paid in the central case.`;
    const parts = [...f.sources].sort((a, b) => b.amount - a.amount).map(s => `${SOURCE_NAME[s.key]} ${gbp(s.amount)}`);
    return `${at} ${parts.join(', ')}.`;
  }
  if (lens === 2) return `${at} about ${gbpK(f.wealth.p50)} left in the middle future; ${gbpK(f.wealth.p10)} to ${gbpK(f.wealth.p90)} across most futures.`;
  if (lens === 3) return windowsLine(f, f.stress, `At ${f.age}, after ${lower(m.stressName || 'the stress')}:`);
  return windowsLine(f, f.windows, at);
}

const keyFor = (m: LanternModel, lens: number) => [
  `Tap a floor to open it. Tall gold: pays your plan in full. Half-height white: less than the plan, but the essentials (${gbp(m.essential)} a year) are covered. Dark: falls short. Each window is 5 of 100 futures that year; the outline marks the middle one.`,
  'The central case: where each year’s spending comes from, after tax. A gap at the right would be a shortfall. The strips of light up the corners are the State Pensions, from the year each starts.',
  'Money left at the end of each year, in today’s money. Bright bar: the middle future. Halo: the 10th to the 90th of 100 futures.',
  `The same futures after ${lower(m.stressName || 'the stress')}. An outline marks a light the fall dimmed or put out.`,
][lens];

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
  const line = model && f ? readout(model, f, lens) : '';
  const summary = model && last ? `The Lantern: a tower of ${model.floors.length} years, age ${model.floors[0].age} to ${last.age}. ${line}` : 'The Lantern';

  return (
    <main data-lantern-preview data-own={own ? '1' : '0'} className="fixed inset-0 flex flex-col"
      style={{ background: 'linear-gradient(180deg, #060B1A, #0B1430)', color: '#E6ECFF',
        paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
      <header className="flex items-center justify-between gap-3 px-4 pt-2">
        <h1 className="text-[1rem] font-extrabold tracking-tight">The Lantern <span data-lantern-whose className="font-semibold text-[0.78rem]" style={{ color: '#9FB0D9' }}>preview · {own ? 'your plan' : 'example figures'}</span></h1>
        <a href="./" className="text-[0.8rem] font-semibold underline min-h-[44px] flex items-center" style={{ color: '#B9C8F5' }}>Back to Someday</a>
      </header>

      <div className="flex-1 min-h-[280px] relative">
        {model
          ? <LanternCanvas model={model} lens={lens} selected={sel} summary={summary} onLens={setLens} onSelect={setSel} />
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
                ? { background: '#FFC24A', color: '#141B33', border: '1px solid #FFC24A' }
                : { background: '#111B3D', color: '#E6ECFF', border: '1px solid #2A3A70' }}>
              {name}
            </button>
          ))}
        </div>
        <p data-lantern-key className="mt-2 text-[0.74rem] leading-snug min-h-[5.6em]" style={{ color: '#9FB0D9' }}>{model ? keyFor(model, lens) : ''}</p>
      </div>
    </main>
  );
}
