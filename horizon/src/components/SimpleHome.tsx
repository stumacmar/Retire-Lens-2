import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Drawdown, MC } from '../engine/engine';
import { E } from '../lib/usePlan';
import { fmt } from '../lib/format';
import { useInsight } from '../lib/useInsight';
import type { Rail } from '../lib/insights';
import { planStatus, futuresSentence, spokenAnswer, withDeadZone, type StatusKey } from '../lib/status';
import { deepestTrim } from '../lib/insights';
import { planCounts } from '../lib/counts';
import { valuesFor, clampVal, type Val } from '../lib/planValues';
import Sheet from './Sheet';
import RiskPanel from './RiskPanel';
import ClosingRing from './ClosingRing';
import TenWindows from './TenWindows';

/**
 * The simple home: the answer first, in words, one figure and one picture,
 * then the three things most people change, each one tap away. Nothing to
 * learn.
 *
 *   ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇  the canvas:
 *   ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇          100 futures,
 *   ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇                   one stripe each
 *   60          First shortfalls at 71                  90
 *
 *   ● Enough on average, not safe yet
 *   £5,600
 *   a month after tax, every year to age 90.
 *   You ask for £5,000: £600 a month to spare.
 *
 *   What you ask holds in 69 of 100 simulated futures. An estimate…
 *
 *   Stop work at      −  60  +
 *   Take home a month −  £5,000  +
 *   Paying in a month −  £3,200  +
 *
 *   [What would help?]  [What could go wrong?]
 *
 * Everything else lives where it already did: Details for the figures,
 * Explore for the charts, Peace for the assumptions. This is the only home:
 * the Horizon Dial was retired in November 2026 (the owner found two homes,
 * and the dial, more complex than they were worth).
 */
type Driver = { id: string; label: string; val: Val; step: number; show: (n: number) => string; sub: string; less: string; more: string };

export default function SimpleHome({ plan, update, dd, mc, onDetails, header }: {
  plan: any; update: (p: any) => void; dd: Drawdown; mc: MC | null; onDetails: () => void; header?: React.ReactNode;
}) {
  const single = plan.household === 'single';
  const A = plan.partnerA, B = plan.partnerB;
  const hasMoney = (A.pension + A.isa + (single ? 0 : B.pension + B.isa) + (plan.cash || 0) + A.monthlyPension) > 0;
  const month = Math.round((plan.targetNet || 0) / 12);
  const railsKey = useMemo(() => JSON.stringify({ ...plan, targetNet: 0, codeSet: null, spendingPlanOn: false }), [plan]);
  const rails = useInsight<Rail[]>('guardrails', plan, railsKey, 400);
  const baseRail = hasMoney ? rails?.find(r => r.key === 'base') : undefined;
  const ruled = planStatus({ holds: dd.holds, deepestTrim: deepestTrim(dd), structured: !!plan.architecture?.on,
    successProb: mc ? mc.successProb : null, successWithCuts: mc ? mc.successProbWithCuts : null, sustainableYear: baseRail ? baseRail.year : null,
    targetYear: plan.targetNet || 0, horizonAge: plan.horizonAge, runsShortAge: dd.runsShortAgeA });
  // The status word holds within a small dead zone at its number-decided
  // boundaries, so it does not flicker while the figures are being changed.
  const settled = !!(rails && mc);
  const prevKey = useRef<StatusKey | null>(null);
  const status = settled ? withDeadZone(prevKey.current, ruled) : ruled;
  useEffect(() => { if (settled) prevKey.current = status.key; }, [settled, status.key]);

  // What the ring cannot show: how short the bad futures are. The leanest
  // year in the worst 10 of 100 futures, as a monthly amount (it counts the
  // State Pension and other guaranteed income, so it is never shown as nothing).
  const structured = !!plan.architecture?.on;
  const stopAge = plan.retireYear - A.birthYear;
  const held = mc?.perAgeHeld || [];
  const countAt = (h: any) => Math.round((structured ? Math.max(h.full, h.rules) : h.full) * 100);
  const firstShort = held.find((h: any) => countAt(h) < 100)?.age;
  const endCount = held.length ? countAt(held[held.length - 1]) : 100;
  const typicalShort = endCount < 100 ? held.find((h: any) => countAt(h) <= (100 + endCount) / 2)?.age ?? null : null;
  const dip = mc && mc.worstYearRatioP10 < 0.995 ? Math.round((mc.worstYearRatioP10 * month) / 10) * 10 : null;
  const firstTrim = structured ? held.find((h: any) => Math.round(h.full * 100) < countAt(h))?.age : undefined;
  const dipLine = dip != null ? ` In the worst 10 of 100, income dips to about ${fmt(dip)} a month.` : '';
  const resting = !mc ? 'Working out the futures…'
    : firstShort != null ? `From ${firstShort}, some futures fall short.${dipLine}`
      : firstTrim != null ? `From ${firstTrim}, your rules trim spending in some futures.${dipLine}`
        : `No future falls short before ${plan.horizonAge}.`;
  const [windows, setWindows] = useState(false);

  // The three drivers, read and written through the plan's value definitions
  // (lib/planValues), so a range or a step is defined in one place.
  const vals = useMemo(() => valuesFor(plan, 'A'), [plan]);
  const drivers: Driver[] = [
    { id: 'retireAge', label: 'Stop work at', val: vals.someday[0], step: 1, show: n => String(n), sub: `in ${plan.retireYear}`, less: 'a year earlier', more: 'a year later' },
    { id: 'targetNet', label: 'Take home', val: vals.someday[1], step: 100, show: fmt, sub: 'a month', less: '£100 a month less', more: '£100 a month more' },
    { id: 'monthly', label: single ? 'Pay in' : 'You pay in', val: vals.pensions[1], step: 50, show: fmt, sub: 'a month', less: '£50 a month less', more: '£50 a month more' },
  ];
  const write = (id: string, fn: (val: Val, cur: number) => number) => update((p: any) => {
    const v = valuesFor(p, 'A'); const val = id === 'retireAge' ? v.someday[0] : id === 'targetNet' ? v.someday[1] : v.pensions[1];
    const cur = val.get(), next = clampVal(val, fn(val, cur));
    return next === cur ? p : { ...p, ...val.set(next) };
  });
  const [typing, setTyping] = useState<{ id: string; text: string } | null>(null);
  const commit = () => { if (!typing) return; const n = parseFloat(typing.text.replace(/[,£\s]/g, '')); if (Number.isFinite(n)) write(typing.id, () => n); setTyping(null); };

  const [panel, setPanel] = useState<null | 'help' | 'risk'>(null);
  const figure = status.sustainable ?? month;
  const gap = status.gap;

  return (<>
    <div data-simple-home className="fixed inset-0 overflow-y-auto"
      style={{ background: 'var(--color-canvas)', paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 5.4rem)',
        paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}>
      {/* At least a screen tall, so the ring can take whatever height is
          left once the answer and the controls are laid out: the two
          questions always sit just above the tab bar. */}
      <div className="mx-auto w-full max-w-[560px] min-h-full flex flex-col">
        {header}

        {/* ── The answer ─────────────────────────────────────────────── */}
        {!hasMoney ? (
          <section className="mt-10 text-center">
            <h1 className="serif text-[1.7rem] leading-tight" style={{ color: 'var(--color-ink)' }}>What could you take home, for life?</h1>
            <p className="mt-2 text-[0.95rem]" style={{ color: 'var(--color-ink-dim)' }}>Add your pensions and savings and the answer appears here.</p>
            <button type="button" onClick={onDetails} className="mt-5 rounded-2xl px-5 py-3 font-bold text-[var(--color-on-calm)]" style={{ background: 'var(--color-calm)' }}>Add my details</button>
          </section>
        ) : (
          <section className="flex-1 flex flex-col mt-1" data-answer data-ready={rails && mc ? '1' : '0'}>
            <p data-status={status.key} className="flex items-center gap-2 text-[0.95rem] font-semibold leading-tight" style={{ color: status.colour }} aria-live="polite">
              <span aria-hidden className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: status.colour }} />{status.label}
            </p>
            {/* The answer in words, naming the amount the futures are counted against. */}
            <p data-futures className="mt-1 text-[1.02rem] leading-snug" style={{ color: 'var(--color-ink)' }}>{futuresSentence(status)}</p>
            {/* ── The closing ring ─────────────────────────────────────── */}
            <ClosingRing mc={mc} structured={structured} fromAge={stopAge} toAge={plan.horizonAge} ask={month}
              summary={`${spokenAnswer(status, stopAge, typicalShort)} ${resting}`} resting={resting} onSeeFutures={() => setWindows(true)}>
              {(side: number) => (<>
                <h1 className="serif tnum leading-none" style={{ fontSize: Math.max(30, Math.min(56, side * 0.19)), letterSpacing: '-0.04em', color: 'var(--color-ink)' }} data-supports>{fmt(figure)}</h1>
                <span className="mt-1 text-[0.82rem] leading-tight whitespace-nowrap" style={{ color: 'var(--color-ink-dim)' }}>a month after tax</span>
                {gap != null && (
                  <span data-gap className="mt-1.5 text-[0.95rem] font-semibold leading-tight whitespace-nowrap" style={{ color: gap < 0 ? 'var(--color-slate)' : 'var(--color-ring)' }}>
                    {Math.abs(gap) < 25 ? <>Just what you ask</>
                      : gap < 0 ? <>{fmt(-gap)} short</>
                        : <>{fmt(gap)} to spare</>}
                  </span>)}
              </>)}
            </ClosingRing>
          </section>
        )}

        {/* ── The three things most people change ────────────────────── */}
        {hasMoney && (
          <section className="mt-4 [@media(max-height:760px)]:mt-2.5 rounded-3xl px-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }} aria-label="Change your plan">
            {drivers.map((d, i) => {
              const n = d.val.get();
              return (
                <div key={d.id} data-driver={d.id} className="flex items-center gap-2 py-2 [@media(max-height:760px)]:py-1" style={{ borderTop: i ? '1px solid var(--color-hairline)' : 'none' }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.95rem] font-semibold leading-tight" style={{ color: 'var(--color-ink)' }}>{d.label}</div>
                    <div className="text-[0.74rem] leading-tight mt-0.5 truncate" style={{ color: 'var(--color-ink-faint)' }}>{d.sub}</div>
                  </div>
                  <button type="button" aria-label={`${d.label}: ${d.less}`} disabled={n <= d.val.min} onClick={() => write(d.id, (_v, cur) => cur - d.step)}
                    className="w-11 h-11 [@media(max-height:760px)]:w-10 [@media(max-height:760px)]:h-10 shrink-0 rounded-full flex items-center justify-center disabled:opacity-30" style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', color: 'var(--color-ink)' }}><Minus size={18} /></button>
                  {typing?.id === d.id ? (
                    <input autoFocus inputMode="decimal" aria-label={`${d.label}, type a figure`} value={typing.text} onChange={e => setTyping({ id: d.id, text: e.target.value })}
                      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setTyping(null); }}
                      className="tnum text-center text-[1.05rem] font-bold rounded-xl py-1.5 w-[5.6rem] outline-none" style={{ background: 'var(--color-canvas)', color: 'var(--color-ink)', border: '1px solid var(--color-calm)' }} />
                  ) : (
                    <button type="button" onClick={() => setTyping({ id: d.id, text: String(n) })} aria-label={`${d.label}: ${d.show(n)}. Tap to type a figure`}
                      className="tnum text-center text-[1.1rem] font-bold rounded-xl py-1.5 w-[5.6rem] min-h-[44px] [@media(max-height:760px)]:min-h-[40px]" style={{ color: 'var(--color-ink)' }}>{d.show(n)}</button>
                  )}
                  <button type="button" aria-label={`${d.label}: ${d.more}`} disabled={n >= d.val.max} onClick={() => write(d.id, (_v, cur) => cur + d.step)}
                    className="w-11 h-11 [@media(max-height:760px)]:w-10 [@media(max-height:760px)]:h-10 shrink-0 rounded-full flex items-center justify-center disabled:opacity-30" style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', color: 'var(--color-ink)' }}><Plus size={18} /></button>
                </div>);
            })}
          </section>
        )}

        {/* ── Two questions, one tap each ────────────────────────────── */}
        {hasMoney && (
          <div className="mt-3 [@media(max-height:760px)]:mt-2 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setPanel('help')} className="rounded-2xl py-3 px-1 min-h-[48px] text-[0.86rem] [@media(max-width:379px)]:text-[0.8rem] font-semibold" style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-calm)', color: 'var(--color-calm-strong)' }}>What would help?</button>
            <button type="button" onClick={() => setPanel('risk')} className="rounded-2xl py-3 px-1 min-h-[48px] text-[0.86rem] [@media(max-width:379px)]:text-[0.8rem] font-semibold" style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-calm)', color: 'var(--color-calm-strong)' }}>What could go wrong?</button>
          </div>
        )}
      </div>
        {/* What the answer is counting, so nobody has to wonder whether a
            partner's pots or annuity are in. Read straight from the plan. It sits
            below the two questions, so they stay in view on a small screen. */}
        {hasMoney && (
          <p data-counts className="mx-auto w-full max-w-[560px] mt-3 text-[0.8rem] leading-snug" style={{ color: 'var(--color-ink-faint)' }}>
            {planCounts(plan).line}{' '}
            <button type="button" onClick={onDetails} className="underline inline-block min-h-[24px]" style={{ color: 'var(--color-ink-dim)' }}>Check or change in Details</button>
          </p>
        )}

    </div>

    {/* Outside the fixed home: a fixed element is its own stacking context,
        and inside it a sheet would slide under the tab bar. */}
    <Sheet open={panel === 'help'} onClose={() => setPanel(null)} title="What would help most">
      {panel === 'help' && <HelpPanel plan={plan} update={update} onDone={() => setPanel(null)} />}
    </Sheet>
    <Sheet open={windows} onClose={() => setWindows(false)} title="Ten futures">
      {windows && <TenWindows mc={mc} structured={structured} ask={month} />}
    </Sheet>
    <Sheet open={panel === 'risk'} onClose={() => setPanel(null)} title="What could go wrong">
      {panel === 'risk' && <RiskPanel plan={plan} mc={mc} rails={rails} />}
    </Sheet>
  </>);
}

/** Each action, measured on the same simulated futures; tap one to apply it. */
function HelpPanel({ plan, update, onDone }: { plan: any; update: (p: any) => void; onDone: () => void }) {
  const [res, setRes] = useState<any>(null);
  useEffect(() => {
    let live = true; setRes(null);
    const id = setTimeout(() => { try { const r = (E as any).levers(plan, { paths: 200 }); if (live) setRes(r); } catch { if (live) setRes({ levers: [] }); } }, 60);
    return () => { live = false; clearTimeout(id); };
  }, [plan]);
  const top: any[] = res?.levers ? res.levers.filter((l: any) => l.dConf > 0.004).slice(0, 6) : [];
  return (
    <div data-help-panel>
      {!res ? <p className="text-[0.9rem] py-2" style={{ color: 'var(--color-ink-dim)' }}>Measuring each action across the same futures…</p>
        : !top.length ? <p className="text-[0.9rem] py-2" style={{ color: 'var(--color-ink-dim)' }}>Nothing measured would clearly improve this plan. That is a good place to be.</p>
          : top.map((l, i) => (
            <button key={l.id} type="button" onClick={() => { update(() => ({ ...l.patch, codeSet: plan.codeSet })); onDone(); }}
              className="w-full text-left flex items-start gap-3 py-3" style={{ borderTop: i ? '1px solid var(--color-hairline)' : 'none' }}>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] font-semibold">{l.label}</span>
                <span className="block text-[0.8rem] mt-0.5 leading-snug" style={{ color: 'var(--color-ink-dim)' }}>{l.detail}</span>
              </span>
              <span className="tnum shrink-0 text-[0.92rem] font-extrabold" style={{ color: 'var(--color-ring)' }}>+{Math.round(l.dConf * 100)} of 100</span>
            </button>))}
      <p className="text-[0.74rem] mt-3" style={{ color: 'var(--color-ink-faint)' }}>Tap one to try it; you can change it back above. Each is your plan run again through the same simulated futures. Prompts, not advice.</p>
    </div>
  );
}
