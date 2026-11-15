import { useEffect, useRef, useState } from 'react';
import type { MC } from '../engine/engine';
import { fmt, fmtK } from '../lib/format';
import type { LifeEvent } from '../lib/lifeEvents';
import type { Tranche, TrancheKey } from '../lib/tranches';
import { SOURCES, type IncomeYear } from '../lib/incomeTimeline';

/**
 * The income timeline: the home's one picture (15 November 2026, from the
 * owner's UX review: "make the income timeline the centrepiece").
 *
 *   £/month                                         you ask £5,000
 *   ───────────────────────────────────────────────────────────────── ask
 *   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  tax
 *   ██████████████████████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  from pensions
 *   ██████████████████████████                                       from ISAs
 *                             ████████████████████████████████████  State Pension
 *   60          67 State Pension              80                90
 *
 * Every year from the day work stops to the plan age, side by side and the
 * same width, so the late years are as readable as the early ones. Each
 * year is stacked from its sources (gross, a month, today's money); tax is
 * hatched off the top, and what is left is what you get. The line is what
 * you ask: where you get less, the gap under the line is drawn in slate and
 * the year is short. The central case only; how many futures do better or
 * worse is in the sentence above and the reading below.
 *
 * Touch or drag (or use the arrow keys) to read any year: its sources, its
 * tax, what you get, and any life event that year. The two tranches below
 * open into how each performs in four markets. Nothing moves on its own.
 */
export default function IncomeTimeline({ years, mc, structured, ask, events, tranches, onOpen, summary, resting }: {
  years: IncomeYear[]; mc: MC | null; structured: boolean; ask: number; events: LifeEvent[];
  tranches: [Tranche, Tranche] | null; onOpen: (key: TrancheKey, age: number | null) => void; summary: string; resting: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const m = () => setBox({ w: Math.floor(el.clientWidth), h: Math.floor(el.clientHeight) });
    m(); const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null; ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const { w, h } = box;
  const n = years.length;
  const first = years[0]?.age ?? 0, last = years[n - 1]?.age ?? 0;
  const held = mc?.perAgeHeld;
  const ready = !!(held && held.length === n);
  const full = ready ? held!.map(x => Math.round(x.full * 100)) : [];
  const rules = ready ? held!.map((x, i) => Math.max(full[i], Math.round(x.rules * 100))) : [];
  const firstShort = ready ? held!.find((_x, i) => (structured ? rules : full)[i] < 100)?.age : undefined;
  const firstTrim = ready && structured ? held!.find((_x, i) => full[i] < rules[i])?.age : undefined;

  // ── Geometry ────────────────────────────────────────────────────────────
  const padL = 2, padR = 2, padT = 22, padB = 20;
  const top = Math.max(1, ...years.map(y => Math.max(y.gross, y.ask))) * 1.08;
  const bw = n ? (w - padL - padR) / n : 0;
  const xOf = (i: number) => padL + i * bw;
  const yOf = (v: number) => padT + (1 - v / top) * Math.max(1, h - padT - padB);
  const base = yOf(0);

  // ── Touch and keys ──────────────────────────────────────────────────────
  const [picked, setPicked] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const pickAt = (clientX: number) => {
    const el = plotRef.current; if (!el || !n) return;
    const b = el.getBoundingClientRect();
    setPicked(first + Math.max(0, Math.min(n - 1, Math.floor((clientX - b.left - padL) / Math.max(1, bw)))));
  };
  useEffect(() => {
    if (picked == null) return;
    const away = (e: PointerEvent) => { const t = e.target as Node; if (!(t as Element).closest?.('[data-timeline]')) setPicked(null); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [picked]);
  useEffect(() => { if (picked != null && (picked < first || picked > last)) setPicked(null); }, [first, last, picked]);
  const age = picked ?? last, idx = Math.max(0, Math.min(n - 1, age - first)), Y = years[idx];
  const tAge = picked ?? first, tIdx = tAge - first;          // the tranches show the year you touched, else the day work stops
  const onKey = (e: React.KeyboardEvent) => {
    if (!n) return;
    const step = ({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 } as Record<string, number>)[e.key];
    if (e.key === 'Escape') { if (picked != null) { setPicked(null); e.preventDefault(); } return; }
    if (e.key === 'Home' || e.key === 'End') { setPicked(e.key === 'Home' ? first : last); e.preventDefault(); return; }
    if (step) { setPicked(Math.max(first, Math.min(last, (picked ?? (step > 0 ? first - 1 : last + 1)) + step))); e.preventDefault(); }
  };
  const futuresAt = ready ? `${full[idx]} of 100 futures still pay ${fmt(ask)} a month in full${structured && rules[idx] > full[idx] ? `; ${rules[idx]} still paying with your rules` : ''}` : '';
  const valuetext = !n ? 'Working out your income'
    : `Age ${age}: you get ${fmt(Y.net)} a month after ${fmt(Y.tax)} tax${Y.short > 25 ? `, ${fmt(Y.short)} short of what you ask` : Y.trim > 25 ? `, ${fmt(Y.trim)} trimmed by your rules` : ''}.${ready ? ` ${futuresAt}.` : ''}`;

  // Sources present at all, in stacking order, for the key.
  const present = SOURCES.filter(s => years.some(y => y.parts[s.key] > 1));
  const eventsAt = (a: number) => events.filter(e => e.age === a);
  const shortT = firstShort ?? firstTrim;
  const ticks = [first, ...[60, 65, 70, 75, 80, 85, 90, 95, 100].filter(a => a > first + 2 && a < last - 2), last];
  const ink = (p: number) => `color-mix(in srgb, var(--color-ink) ${p}%, transparent)`;

  return (
    <div data-timeline data-ready={ready ? '1' : '0'} data-first={first} data-last={last} data-years={n}
      data-full-counts={full.join(',')} data-rules={structured ? rules.join(',') : ''} data-first-short={firstShort ?? ''} data-first-trim={firstTrim ?? ''} data-age={picked ?? ''}
      className="flex-1 min-h-[200px] [@media(min-height:680px)]:min-h-[250px] max-h-[480px] flex flex-col mt-2">
      <span id="timeline-summary" className="sr-only">{summary}</span>
      <div ref={ref} className="relative flex-1 min-h-0">
        <div ref={plotRef} role="slider" tabIndex={n ? 0 : -1} aria-label="Your income, year by year" aria-describedby="timeline-summary"
          aria-valuemin={first} aria-valuemax={last} aria-valuenow={age} aria-valuetext={valuetext} onKeyDown={onKey}
          onPointerDown={e => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); pickAt(e.clientX); }}
          onPointerMove={e => { if (e.buttons) pickAt(e.clientX); }}
          className="absolute inset-0 outline-none rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--color-calm)]" style={{ touchAction: 'pan-y', cursor: 'pointer' }}>
          {w > 0 && h > 0 && n > 0 && (
            <svg aria-hidden width={w} height={h} className="absolute inset-0 block">
              <defs>
                <pattern id="tl-tax" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="5" height="5" style={{ fill: 'var(--color-canvas)' }} />
                  <line x1="0" y1="0" x2="0" y2="5" strokeWidth="2.2" style={{ stroke: ink(22) }} />
                </pattern>
              </defs>
              {/* The years: sources stacked, tax hatched off the top, a gap to the ask in slate. */}
              {years.map((Y, i) => {
                let acc = 0; const x = xOf(i), wd = bw + 0.4;
                return (
                  <g key={Y.age} data-year={Y.age} opacity={picked != null && picked !== Y.age ? 0.55 : 1}>
                    {SOURCES.map(s => { const v = Y.parts[s.key]; if (v <= 0) return null; const y0 = yOf(acc), y1 = yOf(acc + v); acc += v;
                      return <rect key={s.key} data-part={s.key} x={x} y={y1} width={wd} height={Math.max(0, y0 - y1)} style={{ fill: s.colour }} />; })}
                    {Y.tax > 0 && <rect data-part="tax" x={x} y={yOf(Y.gross)} width={wd} height={Math.max(0, yOf(Y.net) - yOf(Y.gross))} fill="url(#tl-tax)" />}
                    {Y.short > 25 && <rect data-part="short" x={x} y={yOf(Y.net + Y.short)} width={wd} height={Math.max(0, yOf(Y.net) - yOf(Y.net + Y.short))}
                      style={{ fill: 'color-mix(in srgb, var(--color-slate) 30%, var(--color-canvas))' }} />}
                    {Y.trim > 25 && <rect data-part="trim" x={x} y={yOf(Y.ask)} width={wd} height={Math.max(0, yOf(Y.ask - Y.trim) - yOf(Y.ask))}
                      style={{ fill: 'color-mix(in srgb, var(--color-ring) 14%, var(--color-canvas))' }} />}
                  </g>);
              })}
              {/* What you ask: one line across every year. */}
              <polyline data-ask fill="none" points={years.map((Y, i) => `${xOf(i).toFixed(1)},${yOf(Y.ask).toFixed(1)} ${(xOf(i) + bw).toFixed(1)},${yOf(Y.ask).toFixed(1)}`).join(' ')}
                style={{ stroke: 'var(--color-ink)' }} strokeWidth="1.6" />
              <line x1={padL} x2={w - padR} y1={base} y2={base} style={{ stroke: ink(25) }} />
              {/* The first age a future falls short (or the rules first trim). */}
              {shortT != null && (() => { const x = xOf(shortT - first); return <line data-short-mark x1={x} x2={x} y1={padT - 4} y2={base} style={{ stroke: 'var(--color-slate)' }} strokeWidth="1.2" strokeDasharray="3 3" />; })()}
              {/* Life events: a small mark on the age line. */}
              {events.filter(e => e.age >= first && e.age <= last).map(e => (
                <circle key={`${e.age}${e.label}`} data-event-age={e.age} cx={xOf(e.age - first) + bw / 2} cy={base + 4} r="2.6" style={{ fill: e.kind === 'out' ? 'var(--color-slate)' : e.kind === 'in' ? 'var(--color-ring)' : 'var(--color-ink-dim)' }} />))}
              {picked != null && <rect data-picked x={xOf(idx) - 1} y={padT - 6} width={bw + 2} height={base - padT + 6} fill="none" rx="2" style={{ stroke: 'var(--color-ink)' }} strokeWidth="1.5" />}
            </svg>)}
          {/* Labels: what you ask, the first shortfall, the ages. */}
          {n > 0 && w > 0 && (<>
            <span aria-hidden className="absolute left-1 text-[0.72rem] font-semibold leading-none -translate-y-full pb-1" style={{ top: yOf(years[0].ask), color: 'var(--color-ink)' }}>You ask {fmt(ask)}</span>
            {shortT != null && (() => { const x = xOf(shortT - first), right = x > w * 0.6; return (
              <span aria-hidden data-notch className={`absolute text-[0.7rem] font-semibold leading-none whitespace-nowrap ${right ? '-translate-x-full pr-1' : 'pl-1'}`} style={{ left: x, top: 2, color: 'var(--color-slate)' }}>
                {firstShort != null ? `some futures short from ${shortT}` : `rules trim from ${shortT}`}</span>); })()}
            {ticks.map(a => (
              <span key={a} aria-hidden className="absolute text-[0.7rem] tnum leading-none -translate-x-1/2" style={{ left: Math.min(w - 8, Math.max(8, xOf(a - first) + bw / 2)), top: base + 9, color: picked === a ? 'var(--color-ink)' : 'var(--color-ink-dim)' }}>{a}</span>))}
          </>)}
          {/* The year you touched: its sources, tax, what you get, its life events and its futures. */}
          {picked != null && n > 0 && w > 0 && (() => { const x = xOf(idx) + bw / 2, right = x > w / 2; return (
            <div data-timeline-card className="absolute z-10 rounded-xl px-2.5 py-1.5 text-[0.74rem] leading-snug pointer-events-none"
              style={{ top: 4, [right ? 'right' : 'left']: right ? Math.max(4, w - x + 10) : Math.max(4, x + 10), maxWidth: Math.max(170, (right ? x : w - x) - 16),
                background: 'color-mix(in srgb, var(--color-canvas) 94%, transparent)', border: '1px solid var(--color-hairline)', boxShadow: `0 2px 10px ${ink(14)}` }}>
              <p className="tnum"><b style={{ color: 'var(--color-ink)' }}>At {age}</b>{eventsAt(age).length > 0 && <span className="font-semibold" style={{ color: 'var(--color-ink)' }}> · {eventsAt(age).map(e => e.label).join(' · ')}</span>}</p>
              {SOURCES.filter(s2 => Y.parts[s2.key] > 1).map(s2 => <p key={s2.key} className="tnum flex justify-between gap-3" style={{ color: 'var(--color-ink-dim)' }}><span><i className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: s2.colour }} />{s2.name}</span><b style={{ color: 'var(--color-ink)' }}>{fmt(Y.parts[s2.key])}</b></p>)}
              <p className="tnum flex justify-between gap-3" style={{ color: 'var(--color-ink-dim)' }}><span>Tax</span><b style={{ color: 'var(--color-ink)' }}>−{fmt(Y.tax)}</b></p>
              <p className="tnum flex justify-between gap-3 mt-0.5 pt-0.5" style={{ borderTop: '1px solid var(--color-hairline)', color: 'var(--color-ink)' }}><span>You get</span><b style={{ color: Y.short > 25 ? 'var(--color-slate)' : 'var(--color-ink)' }}>{fmt(Y.net)}{Y.short > 25 ? ` (${fmt(Y.short)} short)` : Y.trim > 25 ? ` (rules trim ${fmt(Y.trim)})` : ''}</b></p>
              {ready && <p data-timeline-text className="mt-0.5" style={{ color: 'var(--color-ink-dim)' }}>{`At ${age}: ${futuresAt}.`}</p>}
            </div>); })()}
          {picked == null && n > 0 && (
            <span aria-hidden data-timeline-hint className="absolute right-1 bottom-6 text-[0.68rem] font-semibold rounded-full px-2 py-0.5 pointer-events-none" style={{ background: 'color-mix(in srgb, var(--color-canvas) 88%, transparent)', color: 'var(--color-ink-dim)' }}>Touch a year ›</span>)}
        </div>
      </div>
      {/* The key: only the sources this plan has. */}
      <p aria-hidden className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[0.7rem] leading-tight" style={{ color: 'var(--color-ink-dim)' }}>
        {present.map(s => <span key={s.key} className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.colour }} />{s.name}</span>)}
        <span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'repeating-linear-gradient(45deg, var(--color-canvas) 0 2px, color-mix(in srgb, var(--color-ink) 22%, transparent) 2px 3.5px)', outline: `1px solid ${ink(12)}` }} />Tax</span>
        {years.some(y => y.trim > 25) && <span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'color-mix(in srgb, var(--color-ring) 14%, var(--color-canvas))', outline: `1px solid ${ink(12)}` }} />Trimmed by rules</span>}
        {years.some(y => y.short > 25) && <span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'color-mix(in srgb, var(--color-slate) 30%, var(--color-canvas))' }} />Short</span>}
        <span className="ml-auto">a month, today's money</span>
      </p>
      {/* The two tranches, at the year you touched: open one to see how it performs. */}
      {tranches && (
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {tranches.map(tr => (
            <button key={tr.key} type="button" data-tranche-open={tr.key} onClick={() => onOpen(tr.key, picked)}
              aria-label={`${tr.name}: ${fmtK(tr.values[tIdx] ?? 0)} at ${tAge}, in today's money. Open to see how it performs`}
              className="flex items-center justify-between rounded-xl px-3 py-1.5 text-left" style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', borderLeft: `4px solid ${tr.colour}` }}>
              <span className="leading-tight"><span className="block text-[0.7rem]" style={{ color: 'var(--color-ink-dim)' }}>{tr.name} at {tAge}</span>
                <b className="tnum text-[0.95rem]" style={{ color: 'var(--color-ink)' }}>{fmtK(tr.values[tIdx] ?? 0)}</b></span>
              <span aria-hidden className="text-[1.1rem]" style={{ color: 'var(--color-calm-strong)' }}>›</span>
            </button>))}
        </div>)}
    </div>
  );
}
