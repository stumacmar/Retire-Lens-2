import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { MoonStage } from './moon';
import { verdictFor } from '../lib/status';
import { shortByOf } from '../lib/shortBy';

/**
 * The home, as the moon (owner, 21 November 2026, on the three concepts
 * tested in the lab: "Moon - do it").
 *
 * One night-blue screen. A moon, lit by the share of your futures in which
 * the money lasts. Under it the count, the sentence that says what is being
 * counted, and a verdict that the count alone decides. Then the two things
 * most people change, on the same screen, so the light moves across the moon
 * as you step them. Nothing else: what you pay in, the spending step-downs
 * and what the plan counts are in Details, where they always were.
 *
 * Depth is time: "The years ahead" (or a press on the moon) opens it into a
 * row of moons, one every five years, each lit by how often the money lasts
 * to that age; a press on one lifts a large moon out of it and reads it out.
 *
 * It draws only what the home already has: the simulated futures' own count
 * of how many are still paying at each age (`mc.perAgeHeld`, whose last year
 * is the headline count), so the moon, the row and the words cannot differ.
 */
/** `unlucky`: what the unluckiest 10 of 100 futures pay that year, a month (or 'full' when even they are paid in full). */
export type MoonYear = { age: number; p: number; kept: number; unlucky?: number | 'full' | null };
export type MoonStep = {
  id: string; label: string; value: string; raw: number; less: string; more: string; canLess: boolean; canMore: boolean;
  onLess: () => void; onMore: () => void; onType?: (n: number) => void;
};

const NIGHT = '#070C1F';
// The header is written with theme tokens; on the night screen they are given light values.
const VARS = { '--color-ink': '#F4F6FF', '--color-ink-dim': '#C9D4F2', '--color-ink-faint': '#9FB0D9', '--color-calm': '#9DB8FF' } as React.CSSProperties;

/** A whole number that counts to each new value over about half a second. */
function useCounted(value: number | null, go: boolean) {
  const [n, setN] = useState<number | null>(null), from = useRef(0);
  useEffect(() => {
    if (value == null || !go) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const a = from.current, t0 = performance.now(), ms = calm ? 0 : 650;
    let raf = 0;
    const tick = (now: number) => { const k = ms ? Math.min(1, (now - t0) / ms) : 1, e = 1 - Math.pow(1 - k, 3), v = Math.round(a + (value - a) * e); from.current = v; setN(v); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, go]);
  return n ?? (go ? value : 0) ?? 0;
}

function Step({ s }: { s: MoonStep }) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => { if (text == null) return; const n = parseFloat(text.replace(/[,£\s]/g, '')); if (Number.isFinite(n)) s.onType?.(n); setText(null); };
  const round = 'w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30';
  const ring = { color: '#DCE6FF', border: '1px solid rgba(157, 184, 255, 0.38)' };
  const slot = { width: '5.4ch' };
  return (
    <div data-driver={s.id} role="group" aria-label={`${s.label}: ${s.value}`} className="flex items-center justify-between gap-2 min-h-[50px]">
      <span className="text-[1rem] whitespace-nowrap" style={{ color: '#C9D4F2' }}>{s.label}</span>
      <span className="flex items-center gap-1.5 pointer-events-auto">
        <button type="button" aria-label={s.less} disabled={!s.canLess} onClick={s.onLess} className={round} style={ring}><Minus size={18} aria-hidden /></button>
        {text != null ? (
          <input autoFocus inputMode="decimal" aria-label={`${s.label}, type a figure`} value={text} onChange={e => setText(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setText(null); }}
            className="tnum text-center text-[1.35rem] font-semibold rounded-lg outline-none" style={{ ...slot, background: '#101A40', color: '#F4F6FF', border: '1px solid #9DB8FF' }} />
        ) : s.onType ? (
          <button type="button" data-value onClick={() => setText(String(s.raw))} aria-label={`${s.label}: ${s.value}. Tap to type a figure`}
            className="tnum text-[1.35rem] font-semibold text-center min-h-[44px]" style={{ ...slot, color: '#F4F6FF' }}>{s.value}</button>
        ) : <span data-value className="tnum text-[1.35rem] font-semibold text-center" style={slot}>{s.value}</span>}
        <button type="button" aria-label={s.more} disabled={!s.canMore} onClick={s.onMore} className={round} style={ring}><Plus size={18} aria-hidden /></button>
      </span>
    </div>
  );
}

export default function MoonHome({ header, held, structured, spare = 0, pending, front, steps, onHelp, onRisk, onFailed }: {
  header?: ReactNode; held: MoonYear[]; structured: boolean; spare?: number; pending: boolean; front: boolean; steps: MoonStep[];
  onHelp: () => void; onRisk: () => void; onFailed: () => void;
}) {
  const n = held.length, last = n ? held[n - 1] : null;
  // The day you stop, each fifth birthday, and the last year (dropping a birthday that would crowd either end);
  // on a long retirement, each tenth birthday, so the row never holds more than eight.
  const data = useMemo(() => {
    if (!n) return null;
    const pick = (every: number) => held.filter((y, i) => i === 0 || i === n - 1 || (y.age % every === 0 && i >= 3 && i <= n - 4));
    const five = pick(5), years = (five.length > 8 ? pick(10) : five).map(y => ({ age: y.age, p: y.p }));
    return { p: held[n - 1].p, years };
  }, [held, n]);
  const keptOf = useMemo(() => new Map(held.map(y => [y.age, Math.round(y.kept * 100)])), [held]);
  const unluckyOf = useMemo(() => new Map(held.map(y => [y.age, y.unlucky ?? null])), [held]);
  const count = last ? Math.round(last.p * 100) : null, kept = last ? Math.round(last.kept * 100) : null;
  const v = count != null ? verdictFor(count) : null;

  const host = useRef<HTMLDivElement>(null), overlay = useRef<HTMLDivElement>(null), box = useRef<HTMLDivElement>(null);
  const stage = useRef<MoonStage | null>(null), latest = useRef(data);
  latest.current = data;
  const [at, setAt] = useState<{ level: number; sel: number }>({ level: 0, sel: -1 });
  const [drawn, setDrawn] = useState(false);
  const has = !!data;
  useEffect(() => {
    if (!has || !host.current || !overlay.current || !box.current || !latest.current) return;
    let s: MoonStage;
    try { s = new MoonStage(host.current, overlay.current, box.current, latest.current, (level, sel) => setAt({ level, sel })); } catch { onFailed(); return; }
    s.onLost = onFailed; stage.current = s; setDrawn(true);
    return () => { s.dispose(); stage.current = null; setDrawn(false); setAt({ level: 0, sel: -1 }); };
    // The scene is made once; new figures are handed to it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [has]);
  useEffect(() => { if (data) stage.current?.setData(data); }, [data]);
  useEffect(() => { stage.current?.setSpare(spare); }, [spare, drawn]);
  useEffect(() => { stage.current?.setPaused(!front); }, [front, drawn]);

  // The browser's own bar takes the night's colour while the moon is in front.
  useEffect(() => {
    if (!front) return;
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')), was = metas.map(m => m.content);
    metas.forEach(m => { m.content = '#050916'; });
    return () => { metas.forEach((m, i) => { m.content = was[i]; }); };
  }, [front]);

  // The bad case, said as an age (it is easier to hold than a count, and it is what every reader asked: when?). Where
  // the money lasts at least half the time: the age by which the unluckiest 10 of 100 have run short. Where it does
  // not, the age by which more than half have. Nothing where fewer than 10 in 100 ever run short. It is read from the
  // same per-age counts as the moon and the row, so it cannot disagree with them, and it is the way in to the years.
  const shortBy = useMemo(() => shortByOf(held.map(y => ({ age: y.age, full: y.p }))), [held]);
  // The figure counts to its new value as the light moves across the moon (at once, where motion is unwelcome).
  const shown = useCounted(count, drawn);
  const level = has ? at.level : 0;
  const year = data && level === 2 && at.sel >= 0 ? data.years[at.sel] : null;
  const yearCount = year ? Math.round(year.p * 100) : null, yearKept = year ? keptOf.get(year.age) ?? null : null;
  const yearLine = year == null ? '' : structured && yearKept != null && yearKept !== yearCount
    ? `${yearCount} times in 100, it pays in full this long; ${yearKept} times, trimmed by your rules.`
    : `${yearCount} times in 100, the money lasts this long.`;
  // What the count leaves unsaid: in the futures where the money has not lasted, the guaranteed income still comes in.
  const un = year ? unluckyOf.get(year.age) ?? null : null;
  const unluckyLine = un == null ? '' : un === 'full' ? 'Even the unluckiest 10 are paid in full that year.' : `In the unluckiest 10, it pays about £${un.toLocaleString('en-GB')} a month.`;
  const rules = structured && kept != null && kept !== count ? `or ${kept} times, trimmed by your rules` : null;
  const ages = data ? data.years.map(y => y.age) : [];
  const key = (e: React.KeyboardEvent) => {
    const s = stage.current; if (!s) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') s.step(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') s.step(-1);
    else if (e.key === 'Home') s.select(0);
    else if (e.key === 'End') s.select(ages.length - 1);
    else if (e.key === 'Escape') s.back();
    else return;
    e.preventDefault();
  };

  return (
    <div data-simple-home data-moon-home data-level={level} data-count={count ?? ''} data-pending={pending ? '1' : '0'} data-drawn={drawn ? '1' : '0'}
      data-years={data ? data.years.map(y => `${y.age}:${Math.round(y.p * 100)}`).join(' ') : ''} data-sel={year ? year.age : ''}
      className="fixed inset-0 overflow-y-auto" style={{ ...VARS, background: NIGHT, color: '#F4F6FF' }}>
      <div className="relative min-h-full flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.7rem)' }}>
        {/* The scene fills the whole screen, so its glow has no edge; the words sit over it. */}
        <div ref={host} className="absolute inset-0" aria-hidden="true" />
        <div ref={overlay} className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-[560px] flex-1 flex flex-col pointer-events-none"
          style={{ paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}>
          {header && <div className="pointer-events-auto">{header}</div>}

          {/* Where the moon is drawn. Closed, the words under it say all it says; open, it is the years, stepped with the arrow keys. */}
          {level === 0
            ? <div ref={box} data-moon-box className="flex-1 min-h-[168px]" aria-hidden="true" />
            : <div ref={box} data-moon-box className="flex-1 min-h-[168px] rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#9DB8FF]" role="slider" tabIndex={0} onKeyDown={key}
                aria-label="The years ahead" aria-valuemin={ages[0]} aria-valuemax={ages[ages.length - 1]} aria-valuenow={year ? year.age : ages[0]}
                aria-valuetext={year ? `At ${year.age}: ${yearLine}${unluckyLine ? ' ' + unluckyLine : ''}` : 'No year chosen. Use the arrow keys to choose one.'} />}

          <section data-answer data-ready={has && !pending && drawn ? '1' : '0'} aria-live="polite" className="text-center flex flex-col justify-center -mx-2" style={{ minHeight: rules ? '9.9rem' : '8.5rem' }}>
            {!has && <p data-moon-wait className="text-[1rem]" style={{ color: '#C9D4F2' }}>Working out 2,000 futures…</p>}
            {has && level === 0 && <>
              <h1 className="font-normal">
                {/* Light and large; the verdict is the one bold line. While a new count is on its way the old one waits in a
                    quieter colour (never dimmed with opacity). A screen reader is told the count once, not every step of the counting. */}
                <span aria-hidden="true" className="block tnum tracking-tight" style={{ fontSize: '4.5rem', lineHeight: 0.95, fontWeight: 400, letterSpacing: '-0.045em', color: pending ? '#9FB0D9' : '#FFFFFF' }}>{shown}</span>
                <span data-moon-count className="sr-only">{count}</span>
                {/* "Times in 100", not "futures": nine of twelve readers stumbled on "futures" ("I have only one future"). */}
                <span data-moon-line className="block mt-0.5 text-[1rem] font-medium leading-snug whitespace-nowrap" style={{ color: '#F4F6FF' }}>times in 100, {rules ? 'it pays in full' : 'the money lasts'} until you are {last!.age}</span>
              </h1>
              {rules && <p data-moon-rules className="text-[1rem] leading-snug" style={{ color: '#C9D4F2' }}>{rules}</p>}
              <p data-status={v!.key} className="mt-1.5 text-[1.35rem] font-bold leading-tight tracking-tight">{v!.label}</p>
            </>}
            {has && level >= 1 && <ul className="sr-only" data-moon-list>{data!.years.map(y => <li key={y.age}>To {y.age}: {Math.round(y.p * 100)} times in 100.</li>)}</ul>}
            {year && <>
              <h1 data-moon-title className="text-[1.35rem] font-extrabold leading-tight tracking-tight">At {year.age}</h1>
<p data-moon-line className="mt-2 text-[1rem] leading-snug" style={{ color: '#C9D4F2' }}>{yearLine}{unluckyLine && <> <span data-moon-unlucky>{unluckyLine}</span></>}</p>
            </>}
          </section>

          {/* The way in, and the way back out, in the same place. Nobody in the lab pressed the moon unprompted. */}
          <div className="flex justify-center">
            <button type="button" data-moon-years data-short-by={level === 0 && shortBy ? shortBy.age : undefined} disabled={!has} onClick={() => (level === 0 ? stage.current?.enter() : stage.current?.back())}
              aria-label={level === 0 && shortBy ? `The years ahead: ${shortBy.line.charAt(0).toLowerCase()}${shortBy.line.slice(1)}` : undefined}
              className="pointer-events-auto min-h-[44px] px-1 text-[1rem] leading-snug" style={{ color: '#B9C8F5', textWrap: 'balance' } as React.CSSProperties}>
              {level === 0 ? <>{shortBy ? shortBy.line : 'The years ahead'} <span aria-hidden="true">›</span></> : <><span aria-hidden="true">‹</span> Back</>}
            </button>
          </div>

          <section aria-label="Change your plan" className="mt-2">
            {steps.map(s => <Step key={s.id} s={s} />)}
          </section>

          <div className="mt-1 flex justify-between">
            <button type="button" onClick={onHelp} className="pointer-events-auto min-h-[44px] text-[1rem]" style={{ color: '#B9C8F5' }}>What would help?</button>
            <button type="button" onClick={onRisk} className="pointer-events-auto min-h-[44px] text-[1rem]" style={{ color: '#B9C8F5' }}>What could go wrong?</button>
          </div>
        </div>
      </div>
    </div>
  );
}
