import type { Floor, LanternModel, SourceKey } from './model';
import { of100 } from './adapter';

/**
 * The Lantern in words: the reading for a floor, the key for each face, and
 * the little drawn samples the key uses. Shared by the home and the
 * full-screen preview, so the two can never describe the tower differently.
 */
export const LENSES = ['Will it pay?', 'Sources', "What's left", 'Stress'];

export const gbp = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`;
export const gbpK = (v: number) => (v < 500 ? 'nothing' : v >= 1e6 ? `£${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}m` : `£${Math.round(v / 1000)}k`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** The colours the scene draws with, for the key (scene.ts holds the same hues). */
export const TONE = { full: '#FFC53D', short: '#3D4E80', edge: '#6D7FB3', ghost: '#F4F6FF', bar: '#C4ECFF', halo: '#2E6FA8', stone: '#8A6A42' };
export const SOURCE_TONE: Record<SourceKey, string> = {
  pension: '#3FA3A6', isa: '#F1EC5E', cash: '#EEF2F7', scheme: '#C8742A', work: '#93D3A0', sp: '#9160F8', partnerSp: '#CDB6FF',
};
export const SOURCE_LABEL: Record<SourceKey, string> = {
  pension: 'Pensions', isa: 'ISAs', cash: 'Cash', scheme: 'Scheme pensions', work: 'Work', sp: 'State Pension', partnerSp: 'Partner’s State Pension',
};
const SOURCE_SAID: Record<SourceKey, string> = {
  pension: 'pensions', isa: 'ISAs', cash: 'cash', scheme: 'scheme pensions', work: 'work', sp: 'State Pension', partnerSp: 'partner’s State Pension',
};
const SOURCE_ORDER: SourceKey[] = ['pension', 'isa', 'cash', 'scheme', 'work', 'partnerSp', 'sp'];

/** A year's figure as the home says it: a month, to the pound (so a floor at the full plan reads exactly what "You ask for" does). */
export const aMonth = (yearly: number) => gbp(Math.round(yearly / 12));

/** One count, "of 100", and one unit, a month: the same as the answer above the tower. */
function windowsLine(f: Floor, w: Floor['windows'], lead: string) {
  const full = of100(w), short = 100 - full;
  return `${lead} ${full} of 100 futures pay your full ${aMonth(f.spend)} a month.${short ? ` ${short} fall short.` : ''}`;
}

/** One floor, read in words for the face that is showing. */
export function readout(m: LanternModel, f: Floor, lens: number) {
  const at = `At ${f.age} (${f.year}):`;
  if (lens === 1) {
    if (!f.sources.length) return `${at} nothing was paid in the central case.`;
    const parts = [...f.sources].sort((a, b) => b.amount - a.amount).map(s => `${SOURCE_SAID[s.key]} ${aMonth(s.amount)}`);
    return `${at} each month, ${parts.join(', ')}.`;
  }
  if (lens === 2) return `${at} about ${gbpK(f.wealth.p50)} left in the middle future; ${gbpK(f.wealth.p10)} to ${gbpK(f.wealth.p90)} across most futures.`;
  if (lens === 3) return m.stressName ? windowsLine(f, f.stress, `At ${f.age}, after ${lower(m.stressName)}:`) : `${at} working out the fall…`;
  return windowsLine(f, f.windows, f.partnerAge != null ? `At ${f.age} (${f.year}; your partner is ${f.partnerAge}):` : at);
}

export type SwatchKind = 'full' | 'short' | 'ghost' | 'bar' | 'halo' | 'block' | 'strip' | 'stone';
export type KeyItem = { kind: SwatchKind; colour?: string; label: string };

/** What each mark on the showing face means: the key that sits beside the tower. */
export function legendFor(m: LanternModel, lens: number): KeyItem[] {
  const windows: KeyItem[] = [
    { kind: 'full', label: 'Pays in full' },
    { kind: 'short', label: 'Falls short' },
  ];
  if (lens === 1) {
    const seen = new Set<SourceKey>();
    for (const f of m.floors) for (const s of f.sources) seen.add(s.key);
    return SOURCE_ORDER.filter(k => seen.has(k)).map(k => ({ kind: 'block' as const, colour: SOURCE_TONE[k], label: SOURCE_LABEL[k] }));
  }
  if (lens === 2) return [{ kind: 'bar', label: 'The middle future' }, { kind: 'halo', label: '10th to 90th of 100 futures' }];
  if (lens === 3) return [...windows, { kind: 'ghost', label: 'A light the fall put out' }];
  return windows;
}

/** One line under the tower: how the showing face is laid out. */
export function captionFor(m: LanternModel, lens: number) {
  if (lens === 1) return 'Each floor: where that year’s spending comes from.';
  if (lens === 2) return `Each floor: money left, from nothing to ${gbpK(Math.max(...m.floors.map(f => f.wealth.p90)))}.`;
  if (lens === 3) return m.stressName ? `The same futures after ${lower(m.stressName)}.` : 'Working out the fall…';
  return 'Each floor is a year. Each window is 10 of 100 futures, the worst on the left. Tap a floor to read it.';
}

/** A small drawn sample of a mark, on the tower's own navy so every colour reads. */
export function Swatch({ kind, colour, tile = true }: { kind: SwatchKind; colour?: string; tile?: boolean }) {
  const mark = (() => {
    switch (kind) {
      case 'full': return <span style={{ width: 10, height: 10, background: TONE.full }} />;
      case 'short': return <span style={{ width: 10, height: 10, background: TONE.short, outline: `1px solid ${TONE.edge}` }} />;
      case 'ghost': return <span style={{ width: 11, height: 11, background: TONE.short, border: `1.5px solid ${TONE.ghost}` }} />;
      case 'bar': return <span style={{ width: 12, height: 4, background: TONE.bar, alignSelf: 'center' }} />;
      case 'halo': return <span style={{ width: 12, height: 9, background: TONE.halo, alignSelf: 'center' }} />;
      case 'strip': return <span style={{ width: 3, height: 13, background: colour }} />;
      case 'stone': return <span style={{ width: 6, height: 13, background: TONE.stone, borderTop: '2px solid #FFB347' }} />;
      default: return <span style={{ width: 11, height: 8, background: colour, alignSelf: 'center' }} />;
    }
  })();
  return (
    <span aria-hidden="true" className="inline-flex items-end justify-center shrink-0"
      style={{ width: 16, height: 16, borderRadius: 4, background: tile ? '#0B1430' : 'transparent', padding: tile ? 1.5 : 0 }}>
      {mark}
    </span>
  );
}
