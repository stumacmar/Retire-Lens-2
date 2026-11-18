import type { Floor, LanternModel, SourceKey } from './model';
import { countWindows } from './adapter';

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
export const TONE = { full: '#FFB02E', floor: '#CFE0FF', short: '#111A36', ember: '#E2553A', outline: '#FFFFFF', bar: '#8FDCFF', halo: '#4F74D8', stone: '#8A6A42' };
export const SOURCE_TONE: Record<SourceKey, string> = {
  pension: '#3FD8FF', isa: '#F2D06B', cash: '#B9C2D0', scheme: '#FFA62E', work: '#55E08A', sp: '#9A6BFF', partnerSp: '#CDB4FF',
};
export const SOURCE_LABEL: Record<SourceKey, string> = {
  pension: 'Pensions', isa: 'ISAs', cash: 'Cash', scheme: 'Scheme pensions', work: 'Work', sp: 'State Pension', partnerSp: 'Partner’s State Pension',
};
const SOURCE_SAID: Record<SourceKey, string> = {
  pension: 'pensions', isa: 'ISAs', cash: 'cash', scheme: 'scheme pensions', work: 'work', sp: 'State Pension', partnerSp: 'partner’s State Pension',
};
const SOURCE_ORDER: SourceKey[] = ['pension', 'isa', 'cash', 'scheme', 'work', 'partnerSp', 'sp'];

function windowsLine(f: Floor, w: Floor['windows'], lead: string) {
  const c = countWindows(w);
  const parts = [`${c.full} of 20 futures pay your full ${gbp(f.spend)}.`];
  if (c.floor) parts.push(`${c.floor} pay${c.floor === 1 ? 's' : ''} less than the plan but cover${c.floor === 1 ? 's' : ''} the essentials.`);
  if (c.short) parts.push(`${c.short} fall${c.short === 1 ? 's' : ''} short.`);
  return `${lead} ${parts.join(' ')}`;
}

/** One floor, read in words for the face that is showing. */
export function readout(m: LanternModel, f: Floor, lens: number) {
  const at = `At ${f.age} (${f.year}):`;
  if (lens === 1) {
    if (!f.sources.length) return `${at} nothing was paid in the central case.`;
    const parts = [...f.sources].sort((a, b) => b.amount - a.amount).map(s => `${SOURCE_SAID[s.key]} ${gbp(s.amount)}`);
    return `${at} ${parts.join(', ')}.`;
  }
  if (lens === 2) return `${at} about ${gbpK(f.wealth.p50)} left in the middle future; ${gbpK(f.wealth.p10)} to ${gbpK(f.wealth.p90)} across most futures.`;
  if (lens === 3) return m.stressName ? windowsLine(f, f.stress, `At ${f.age}, after ${lower(m.stressName)}:`) : `${at} working out the fall…`;
  return windowsLine(f, f.windows, at);
}

export type SwatchKind = 'full' | 'floor' | 'short' | 'outline' | 'ghost' | 'bar' | 'halo' | 'block' | 'strip' | 'stone';
export type KeyItem = { kind: SwatchKind; colour?: string; label: string };

/** What each mark on the showing face means: the key that sits beside the tower. */
export function legendFor(m: LanternModel, lens: number): KeyItem[] {
  const windows: KeyItem[] = [
    { kind: 'full', label: 'Pays your plan in full' },
    { kind: 'floor', label: 'Less, essentials covered' },
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
  return 'Each floor is a year. Worst futures left, best right.';
}

/** A small drawn sample of a mark, on the tower's own navy so every colour reads. */
export function Swatch({ kind, colour, tile = true }: { kind: SwatchKind; colour?: string; tile?: boolean }) {
  const mark = (() => {
    switch (kind) {
      case 'full': return <span style={{ width: 6, height: 12, background: TONE.full }} />;
      case 'floor': return <span style={{ width: 5, height: 6, background: TONE.floor, alignSelf: 'flex-end' }} />;
      case 'short': return <span style={{ width: 6, height: 12, background: TONE.short, borderBottom: `2px solid ${TONE.ember}`, outline: '1px solid #33427A' }} />;
      case 'outline': return <span style={{ width: 8, height: 13, border: `1.5px solid ${TONE.outline}` }} />;
      case 'ghost': return <span style={{ width: 7, height: 12, border: `1.5px solid ${TONE.full}` }} />;
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
