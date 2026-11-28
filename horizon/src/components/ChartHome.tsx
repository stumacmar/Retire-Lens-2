import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import Sheet from './Sheet';
import { verdictFor } from '../lib/status';
import { shortByOf } from '../lib/shortBy';

/**
 * The home, as a plain chart (owner, 24 November 2026: "Build it", on the
 * verdict of the council asked whether the moon, the island and the Lantern
 * were "too gimmicky").
 *
 * The count, the sentence that says what is counted, and the verdict the
 * count alone decides: the words the moon home had. Under them one chart of
 * what you would live on each month at each age: what you ask, and what the
 * unlucky are paid. It charts income, not the pot: all six of the council's
 * consumers read a pot at nothing as no income, when the guaranteed income
 * still comes in. Two lines, each named where it ends, no key and no grid;
 * the ages on it are ones the screen already says.
 *
 * The lower line is the case the sentence under it names (`shortByOf`): the
 * unluckiest 10 of 100 where the money lasts at least half the time, the
 * middle case where it does not. It leaves what you ask at the age that
 * sentence gives, so the picture and the words cannot differ.
 *
 * One press down: the same count at each age, as plain numbers.
 */
export type ChartYear = {
  age: number;
  /** Share of futures still paying in full at this age (never rises; the last is the headline count). */
  p: number;
  /** The same once a safe ladder's rules have trimmed spending. */
  kept: number;
  /** What the unluckiest 10 of 100 are paid that year, a month, to the nearest £50 ('full' when even they are paid in full). */
  unlucky?: number | 'full' | null;
  /** A month, today's money: what the plan asks that year, and what the unluckiest 10 of 100 and the middle case are paid. */
  ask?: number; low?: number; mid?: number;
};
export type ChartStep = {
  id: string; label: string; value: string; raw: number; less: string; more: string; canLess: boolean; canMore: boolean;
  onLess: () => void; onMore: () => void; onType?: (n: number) => void;
};

const gbp = (n: number) => '£' + Math.round(n).toLocaleString('en-GB');

function Step({ s }: { s: ChartStep }) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => { if (text == null) return; const n = parseFloat(text.replace(/[,£\s]/g, '')); if (Number.isFinite(n)) s.onType?.(n); setText(null); };
  const round = 'w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30';
  const ring = { color: 'var(--color-calm-strong)', border: '1px solid var(--color-calm)' };
  const slot = { width: '5.4ch' };
  return (
    <div data-driver={s.id} role="group" aria-label={`${s.label}: ${s.value}`} className="flex items-center justify-between gap-2 min-h-[50px]" style={{ borderTop: '1px solid var(--color-hairline)' }}>
      <span className="text-[1rem] whitespace-nowrap" style={{ color: 'var(--color-ink)' }}>{s.label}</span>
      <span className="flex items-center gap-1.5">
        <button type="button" aria-label={s.less} disabled={!s.canLess} onClick={s.onLess} className={round} style={ring}><Minus size={18} aria-hidden /></button>
        {text != null ? (
          <input autoFocus inputMode="decimal" aria-label={`${s.label}, type a figure`} value={text} onChange={e => setText(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setText(null); }}
            className="tnum text-center text-[1.35rem] font-bold rounded-lg outline-none" style={{ ...slot, background: 'var(--color-surface)', color: 'var(--color-ink)', border: '1px solid var(--color-calm)' }} />
        ) : s.onType ? (
          <button type="button" data-value onClick={() => setText(String(s.raw))} aria-label={`${s.label}: ${s.value}. Tap to type a figure`}
            className="tnum text-[1.35rem] font-bold text-center min-h-[44px]" style={{ ...slot, color: 'var(--color-ink)' }}>{s.value}</button>
        ) : <span data-value className="tnum text-[1.35rem] font-bold text-center" style={slot}>{s.value}</span>}
        <button type="button" aria-label={s.more} disabled={!s.canMore} onClick={s.onMore} className={round} style={ring}><Plus size={18} aria-hidden /></button>
      </span>
    </div>
  );
}

export default function ChartHome({ header, years, structured, pending, steps, onHelp, onRisk }: {
  header?: ReactNode; years: ChartYear[]; structured: boolean; pending: boolean; steps: ChartStep[];
  onHelp: () => void; onRisk: () => void;
}) {
  const n = years.length, last = n ? years[n - 1] : null, has = n > 0;
  const count = last ? Math.round(last.p * 100) : null, kept = last ? Math.round(last.kept * 100) : null;
  const v = count != null ? verdictFor(count) : null;
  const rules = structured && kept != null && kept !== count ? `or ${kept} times, trimmed by your rules` : null;
  const shortBy = useMemo(() => shortByOf(years.map(y => ({ age: y.age, full: y.p }))), [years]);
  const [open, setOpen] = useState(false);

  // The chart. The lower line is the case the sentence under it names, and it is at what you ask until the age that sentence gives.
  const g = useMemo(() => {
    if (!n || years.some(y => y.ask == null)) return null;
    const a0 = years[0].age, a1 = years[n - 1].age + 1, top = Math.max(...years.map(y => y.ask || 0), 1);
    const X = (a: number) => ((a - a0) / Math.max(1, a1 - a0)) * 100;
    const Y = (m: number) => (1 - Math.max(0, Math.min(top, m)) / top) * 100;
    const lowOf = (y: ChartYear) => (!shortBy || y.age < shortBy.age ? y.ask! : Math.min(y.ask!, (shortBy.often ? y.mid : y.low) ?? y.ask!));
    const step = (f: (y: ChartYear) => number) => years.map((y, i) => `${i ? 'L' : 'M'}${X(y.age).toFixed(2)},${Y(f(y)).toFixed(2)} L${X(y.age + 1).toFixed(2)},${Y(f(y)).toFixed(2)}`).join(' ');
    const ask = step(y => y.ask!), low = step(lowOf);
    const back = years.slice().reverse().map(y => `L${X(y.age + 1).toFixed(2)},${Y(lowOf(y)).toFixed(2)} L${X(y.age).toFixed(2)},${Y(lowOf(y)).toFixed(2)}`).join(' ');
    const end = lowOf(years[n - 1]), endPaid = Math.round(end / 50) * 50;
    const lastAsk = years[n - 1].ask!;
    // The ages along the foot: each fifth birthday (each tenth on a long retirement), but not one crowding either end or the age the line leaves at.
    const every = a1 - a0 > 42 ? 10 : 5;
    const ticks = years.filter((y, i) => y.age % every === 0 && i >= 3 && i <= n - 4 && !(shortBy && Math.abs(y.age - shortBy.age) < 3)).map(y => ({ age: y.age, x: X(y.age) }));
    const under = `${low} L100,100 L0,100 Z`;
    return { ask, low, gap: `${ask} ${back} Z`, first: years[0].ask!, end, endPaid, endY: Y(end), askY: Y(years[0].ask!), lastAsk, lastAskY: Y(lastAsk), ticks, under, at: shortBy ? X(shortBy.age) : null, a0, a1: years[n - 1].age };
  }, [years, n, shortBy]);
  // The line is named for its case, in the readers' own words ("the middle case", "the worst 10"): the count alone
  // on the line ("10 times in 100: about £2,050") was not taken for a case by three of five.
  const who = shortBy?.often ? 'The middle case' : 'The worst 10 times in 100';
  const said = !g ? '' : shortBy ? `${who}: about ${gbp(g.endPaid)} a month` : 'The worst 10 times in 100: paid in full';
  // The rows one press down: the day you stop, each fifth birthday (each tenth on a long retirement) and the last year.
  const rows = useMemo(() => {
    const pick = (every: number) => years.filter((y, i) => i === 0 || i === n - 1 || (y.age % every === 0 && i >= 3 && i <= n - 4));
    const five = pick(5); return five.length > 8 ? pick(10) : five;
  }, [years, n]);

  return (<>
    <div data-simple-home data-chart-home data-count={count ?? ''} data-pending={pending ? '1' : '0'} data-ready={has && !pending ? '1' : '0'}
      data-years={rows.map(y => `${y.age}:${Math.round(y.p * 100)}`).join(' ')} data-short-by={shortBy ? shortBy.age : ''} data-end-paid={g && shortBy ? g.endPaid : ''}
      className="fixed inset-0 overflow-y-auto" style={{ background: 'var(--color-canvas)', color: 'var(--color-ink)' }}>
      <div className="mx-auto w-full max-w-[560px] min-h-full flex flex-col"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.9rem)', paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}>
        {header}

        <section data-answer data-ready={has && !pending ? '1' : '0'} aria-live="polite" className="mt-2">
          {!has && <p data-chart-wait className="text-[1rem] py-6" style={{ color: 'var(--color-ink-dim)' }}>Working out 2,000 futures…</p>}
          {has && <>
            <h1 className="font-normal flex items-end gap-3">
              {/* While a new count is on its way the old one waits in a quieter colour (never dimmed with opacity). */}
              <span data-chart-count className="tnum shrink-0" style={{ fontSize: '4.5rem', lineHeight: 0.86, fontWeight: 400, letterSpacing: '-0.045em', color: pending ? 'var(--color-ink-faint)' : 'var(--color-ink)' }}>{count}</span>
              {/* "Times in 100", not "futures": nine of twelve readers stumbled on "futures" ("I have only one future"). */}
              <span data-chart-line className="text-[1rem] leading-snug pb-0.5" style={{ color: 'var(--color-ink-dim)', textWrap: 'balance' } as React.CSSProperties}>times in 100, {rules ? 'it pays in full' : 'the money lasts'} until you are {last!.age}{rules && <span data-chart-rules className="block">{rules}</span>}</span>
            </h1>
            <p data-status={v!.key} className="mt-2.5 text-[1.35rem] font-bold leading-tight tracking-tight">{v!.label}</p>
          </>}
        </section>

        {/* What you would live on each month, at each age. The words on it are read out once, as its name. */}
        <div data-chart role="img" aria-label={g ? `What you would live on each month, in today's money. You ask ${gbp(g.first)} a month${g.lastAsk < g.first - 25 ? ` at first and ${gbp(Math.round(g.lastAsk / 10) * 10)} later` : ''}. ${shortBy ? `${shortBy.often ? 'In the middle case' : 'In the worst 10 times in 100'}, that is paid in full until ${shortBy.age}, then about ${gbp(g.endPaid)} a month until ${g.a1}` : said}.` : undefined}
          className="relative min-h-[150px] max-h-[380px] mt-3" style={{ flex: '100 1 0%' }}>
          {g && <div aria-hidden="true" className="absolute inset-0 text-[0.8125rem] leading-tight" style={{ top: '1.5rem', bottom: '1.35rem' }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
              {/* What is still paid is a filled shape, not a line over nothing ("a big empty gap", said most readers of the bare lines). */}
              <path d={g.under} fill="var(--color-ink)" fillOpacity="0.045" />
              {g.ticks.map(t => <line key={t.age} x1={t.x} x2={t.x} y1="0" y2="100" stroke="var(--color-hairline)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
              <line x1="0" x2="100" y1="100" y2="100" stroke="var(--color-hairline)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              {shortBy && <path d={g.gap} fill="var(--color-hope)" fillOpacity="0.13" />}
              {/* Drawn its whole length and wide, under the line of what is asked: it is seen to run with that line until the age it
                  leaves it. (Drawn only where it differed, five of five blind readers could not say what the unlucky are paid at 70.) */}
              {shortBy && <path data-chart-low d={g.low} fill="none" stroke="var(--color-hope)" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
              <path data-chart-ask d={g.ask} fill="none" stroke="var(--color-ink)" strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <span data-chart-asked className="absolute left-0 font-semibold" style={{ bottom: `calc(${100 - g.askY}% + 6px)`, color: 'var(--color-ink)' }}>What you ask: {gbp(g.first)} a month</span>
            {/* Where the plan itself asks for less later, the line's other end says how much and whose line it is ("you ask £3,250"):
                unnamed, or named only "then £3,250", readers took that end for what an ordinary case pays, or for a second plan. */}
            {g.lastAsk < g.first - 25 && <span data-chart-asked-last className="absolute right-0 tnum font-semibold" style={{ bottom: `calc(${100 - g.lastAskY}% + 6px)`, color: 'var(--color-ink)' }}>you ask {gbp(Math.round(g.lastAsk / 10) * 10)}</span>}
            {/* Named under its own end where there is room, above it where the line runs along the foot. */}
            <span data-chart-said className="absolute right-0 font-semibold text-right" style={{ ...(!shortBy ? { top: `calc(${g.endY}% + 8px)` } : g.endY < 72 ? { top: `calc(${g.endY}% + 9px)` } : { bottom: `calc(${100 - g.endY}% + 9px)` }), maxWidth: '62%', color: shortBy ? 'var(--color-hope)' : 'var(--color-ink-dim)', textWrap: 'balance' } as React.CSSProperties}>{said}</span>
            <span className="absolute left-0 tnum" style={{ bottom: 3, color: 'var(--color-ink-dim)' }}>£0</span>
          </div>}
          {g && <div aria-hidden="true" className="absolute left-0 right-0 bottom-0 h-[1.25rem] text-[0.8125rem] tnum" style={{ color: 'var(--color-ink-dim)' }}>
            <span className="absolute left-0">{g.a0}</span>
            {/* With only the first and last age marked, three of four readers placed 70 and 80 wrongly along the foot. */}
            {g.ticks.map(t => <span key={t.age} className="absolute -translate-x-1/2" style={{ left: `${t.x}%` }}>{t.age}</span>)}
            {g.at != null && g.at > 9 && g.at < 88 && <span className="absolute -translate-x-1/2 font-semibold" style={{ left: `${g.at}%`, color: 'var(--color-hope)' }}>{shortBy!.age}</span>}
            <span className="absolute right-0">{g.a1}</span>
          </div>}
        </div>

        {/* The bad case, said as an age, and the way in to the years. */}
        <div className="flex-1 flex flex-col justify-start">
          <button type="button" data-chart-years disabled={!has} onClick={() => setOpen(true)}
            aria-label={shortBy ? `The years ahead: ${shortBy.line.charAt(0).toLowerCase()}${shortBy.line.slice(1)}` : undefined}
            className="min-h-[44px] text-left text-[1rem] font-semibold leading-snug" style={{ color: 'var(--color-calm-strong)', textWrap: 'balance' } as React.CSSProperties}>
            {shortBy ? shortBy.line : 'The years ahead'} <span aria-hidden="true">›</span>
          </button>
        </div>

        <section aria-label="Change your plan" className="mt-1">
          {steps.map(s => <Step key={s.id} s={s} />)}
        </section>

        <div className="flex justify-between" style={{ borderTop: '1px solid var(--color-hairline)' }}>
          <button type="button" onClick={onHelp} className="min-h-[44px] text-[1rem] font-semibold" style={{ color: 'var(--color-calm-strong)' }}>What would help?</button>
          <button type="button" onClick={onRisk} className="min-h-[44px] text-[1rem] font-semibold" style={{ color: 'var(--color-calm-strong)' }}>What could go wrong?</button>
        </div>
      </div>
    </div>

    {/* Outside the fixed home, or it would slide under the tab bar. */}
    <Sheet open={open} onClose={() => setOpen(false)} title="The years ahead">
      {open && <div data-chart-table>
        <p className="text-[0.875rem] leading-snug mb-1" style={{ color: 'var(--color-ink-dim)' }}>How often the money lasts at each age, and what the worst 10 times in 100 are paid a month.</p>
        <table className="w-full text-[1rem] tnum">
          <thead><tr className="text-[0.8125rem] text-left" style={{ color: 'var(--color-ink-dim)' }}>
            <th scope="col" className="font-semibold py-2 pr-2">At</th><th scope="col" className="font-semibold py-2 pr-2">Times in 100</th><th scope="col" className="font-semibold py-2 text-right">Worst 10</th>
          </tr></thead>
          <tbody>{rows.map(y => (
            <tr key={y.age} data-year={y.age} style={{ borderTop: '1px solid var(--color-hairline)' }}>
              <th scope="row" className="font-semibold text-left py-2.5 pr-2">{y.age}</th>
              <td className="py-2.5 pr-2 font-bold">{Math.round(y.p * 100)}</td>
              <td className="py-2.5 text-right" style={{ color: y.unlucky === 'full' ? 'var(--color-ink-dim)' : 'var(--color-ink)' }}>{y.unlucky === 'full' ? 'paid in full' : y.unlucky != null ? `${gbp(y.unlucky)}` : ''}</td>
            </tr>))}</tbody>
        </table>
      </div>}
    </Sheet>
  </>);
}
