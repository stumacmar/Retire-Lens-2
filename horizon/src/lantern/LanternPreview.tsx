import { useState } from 'react';
import LanternCanvas from './LanternCanvas';
import { dummyModel } from './dummyData';
import { SOURCE_NAME, countOf } from './model';
import type { Floor, LanternModel } from './model';

/**
 * Stage 1 of the Lantern (docs/LANTERN_PLAN.md): the tower from made-up
 * figures at ?lantern=1, so its look can be judged on a phone before it is
 * wired to the engine. It does not replace the home.
 */
const LENSES = ['Will it pay?', 'Sources', "What's left", 'Stress'];
const KEYS = [
  'Gold: pays your plan in full. White: the essentials only. Dark: falls short. Each window is 5 of 100 futures; the ring marks the middle one.',
  'The middle future: where each year’s money comes from. A gap at the right would be a shortfall.',
  'Money left at the end of each year, in today’s money. Bright bar: the middle future. Halo: most futures.',
  'The same windows after the stress. An outline marks a light the stress put out.',
];

const gbp = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`;
const gbpK = (v: number) => (v >= 1e6 ? `£${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}m` : `£${Math.round(v / 1000)}k`);

function windowsLine(f: Floor, w: Floor['windows'], lead: string) {
  const full = countOf(w, 'full'), ess = countOf(w, 'floor'), short = countOf(w, 'short');
  const parts = [`${full} of 20 futures pay your full ${gbp(f.spend)}.`];
  if (ess) parts.push(`${ess} pay${ess === 1 ? 's' : ''} the essentials only.`);
  if (short) parts.push(`${short} fall${short === 1 ? 's' : ''} short.`);
  return `${lead} ${parts.join(' ')}`;
}

function readout(m: LanternModel, f: Floor, lens: number) {
  const at = `At ${f.age} (${f.year}):`;
  if (lens === 1) {
    const top = [...f.sources].sort((a, b) => b.amount - a.amount).map(s => `${SOURCE_NAME[s.key]} ${gbp(s.amount)}`);
    return `${at} ${top.join(', ')}.`;
  }
  if (lens === 2) return `${at} about ${gbpK(f.wealth.p50)} left in the middle future; ${gbpK(f.wealth.p10)} to ${gbpK(f.wealth.p90)} across most futures.`;
  if (lens === 3) return windowsLine(f, f.stress, `At ${f.age}, after ${m.stressName.charAt(0).toLowerCase()}${m.stressName.slice(1)}:`);
  return windowsLine(f, f.windows, at);
}

export default function LanternPreview() {
  const model = dummyModel;
  const [lens, setLens] = useState(0);
  const [sel, setSel] = useState(() => Math.max(0, model.floors.findIndex(f => f.age === 85)));
  const f = model.floors[sel], last = model.floors[model.floors.length - 1];
  const summary = `The Lantern: a tower of ${model.floors.length} years, age ${model.floors[0].age} to ${last.age}. ${readout(model, f, lens)}`;

  return (
    <main data-lantern-preview className="fixed inset-0 flex flex-col"
      style={{ background: 'linear-gradient(180deg, #060B1A, #0B1430)', color: '#E6ECFF',
        paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
      <header className="flex items-center justify-between gap-3 px-4 pt-2">
        <h1 className="text-[1rem] font-extrabold tracking-tight">The Lantern <span className="font-semibold text-[0.78rem]" style={{ color: '#9FB0D9' }}>preview · example figures</span></h1>
        <a href="./" className="text-[0.8rem] font-semibold underline min-h-[44px] flex items-center" style={{ color: '#B9C8F5' }}>Back to Someday</a>
      </header>

      <div className="flex-1 min-h-[280px]">
        <LanternCanvas model={model} lens={lens} selected={sel} summary={summary} onLens={setLens} onSelect={setSel} />
      </div>

      <div className="mx-auto w-full max-w-[560px] px-4">
        <p data-lantern-readout aria-live="polite" className="text-[0.86rem] leading-snug min-h-[4.2em]">{readout(model, f, lens)}</p>
        <p data-lantern-left className="text-[0.78rem] leading-snug" style={{ color: '#9FB0D9' }}>Median left at {last.age}: {gbp(last.wealth.p50)} in today’s money.</p>

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
        <p data-lantern-key className="mt-2 text-[0.74rem] leading-snug min-h-[4.2em]" style={{ color: '#9FB0D9' }}>{KEYS[lens]}</p>
      </div>
    </main>
  );
}
