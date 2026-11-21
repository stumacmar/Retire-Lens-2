import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
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
import { canDraw3d } from '../lib/picture';
import type { Picture } from '../lib/picture';

// The moon brings Three.js with it, so it loads in its own chunk, only when the home shows it.
const MoonHome = lazy(() => import('../moon/MoonHome'));
import type { MoonStep } from '../moon/MoonHome';
import RiskPanel from './RiskPanel';
import Island from './Island';
import { lifeEvents } from '../lib/lifeEvents';
import { tranchesOf, type TrancheKey } from '../lib/tranches';
import TrancheSheet from './TrancheSheet';

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

export default function SimpleHome({ plan, update, dd, mc, onDetails, header, headerNight, picture = 'moon', pending = false, front = true, onNight }: {
  plan: any; update: (p: any) => void; dd: Drawdown; mc: MC | null; onDetails: () => void; header?: React.ReactNode; picture?: Picture;
  /** The app's name as it is set on the moon's night screen. */
  headerNight?: React.ReactNode;
  /** A new simulation is on its way; `mc` is still the last one. */
  pending?: boolean;
  /** Nothing covers the home (no sheet is open over it). */
  front?: boolean;
  /** Told whether the home is the night-blue moon, so the tab bar can match it. */
  onNight?: (night: boolean) => void;
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

  // What the island shows only on touch: how short the bad futures are. The leanest
  // year in the worst 10 of 100 futures, as a monthly amount (it counts the
  // State Pension and other guaranteed income, so it is never shown as nothing).
  const structured = !!plan.architecture?.on;
  const stopAge = plan.retireYear - A.birthYear;
  const held = useMemo(() => mc?.perAgeHeld || [], [mc]);
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
  // Past full, the moon cannot say more, so its glow does: how much is left at the end in the unluckiest 10 of 100
  // futures, in years of what is asked (20 years or more is the most it shows). It falls to nothing as the moon starts to wane.
  const leftAtEnd = (mc as any)?.perAgeWealth as { p10: number }[] | undefined;
  const spare = leftAtEnd?.length && plan.targetNet > 0 ? Math.max(0, Math.min(1, (leftAtEnd[leftAtEnd.length - 1].p10 || 0) / plan.targetNet / 20)) : 0;
  const [typing, setTyping] = useState<{ id: string; text: string } | null>(null);
  const commit = () => { if (!typing) return; const n = parseFloat(typing.text.replace(/[,£\s]/g, '')); if (Number.isFinite(n)) write(typing.id, () => n); setTyping(null); };

  const [panel, setPanel] = useState<null | 'help' | 'risk'>(null);
  // The moon needs WebGL; without it (or if the context is lost) the home shows the island instead.
  const [no3d, setNo3d] = useState(() => !canDraw3d());
  const moon = picture === 'moon' && !no3d && hasMoney;
  useEffect(() => { onNight?.(moon && panel == null); return () => onNight?.(false); }, [moon, panel, onNight]);
  // What the moon draws: at each age, the share of futures still paying in full, and (for a safe-ladder plan) the share
  // still paying once its rules have trimmed spending. The last year is the headline count.
  // With them, for each age, what the unluckiest 10 of 100 futures pay that year, a month in today's money: the answer
  // to the question every blind reader asked of the count ("and the other 43 times? a bit less, or nothing?").
  const moonYears = useMemo(() => {
    const paid = new Map<number, number[]>((mc?.perAgePaid?.ages || []).map((a: any) => [a.age as number, a.q as number[]]));
    const asked = new Map<number, number>((dd.rows as any[]).map(r => [r.ageA as number, (r.planTarget || 0) / Math.pow(1 + (plan.inflation || 0), r.year - plan.startYear) / 12]));
    return held.map((h: any) => {
      const q = paid.get(h.age), want = asked.get(h.age);
      // The 10th percentile of that year's futures sits between the engine's 7.5% and 12.5% levels.
      const share = q && q.length > 2 ? (q[1] + q[2]) / 2 : null;
      // The moon counts what was asked for, paid in full, on every plan (owner, 21 November 2026: "The moon isn't sensitive
      // enough"). On a safe-ladder plan it used to count the futures that last once the rules have trimmed spending: that count
      // hardly moves, and can rise when more is asked for, because the rules cut harder. It is now stated beside the moon.
      return { age: h.age as number, p: h.full as number, kept: (structured ? Math.max(h.full, h.rules) : h.full) as number,
        unlucky: share == null || want == null ? null : share >= 0.99 ? 'full' as const : Math.round((share * want) / 50) * 50 };
    });
  }, [held, structured, mc, dd, plan.inflation, plan.startYear]);
  const events = useMemo(() => lifeEvents(plan, dd), [plan, dd]);
  const central = useMemo(() => { try { return (E as any).coverByAge(plan) as { age: number; cover: number }[]; } catch { return []; } }, [plan]);
  const endAge = held.length ? held[held.length - 1].age : plan.horizonAge;
  const tranches = useMemo(() => tranchesOf(plan, dd, stopAge, endAge), [plan, dd, stopAge, endAge]);
  const [open, setOpen] = useState<{ key: TrancheKey; at: number | null } | null>(null);
  const openTranche = tranches.find(t => t.key === open?.key);
  const figure = status.sustainable ?? month;
  const gap = status.gap;

  // The island's answer: the status, the one figure, what you ask and the gap. (The moon home says its own.)
  const head = <>
                <p data-status={status.key} className={`flex items-center gap-1.5 font-semibold leading-tight text-[0.82rem]`} style={{ color: `var(--status-ink, ${status.colour})` }} aria-live="polite">
                  <span aria-hidden className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: status.colour }} />{status.label}
                </p>
                {/* The figure: what the plan can pay, labelled so it is never mistaken for what
                    you ask (review, 17 November 2026), with what you ask and the gap. */}
                <span data-figure-label className={`block font-semibold leading-tight text-[0.7rem] mt-1`} style={{ color: 'var(--color-ink-dim)' }}>Your plan can pay</span>
                <h1 className="serif tnum leading-none" style={{ fontSize: 'clamp(1.9rem, 8.5vw, 2.5rem)', letterSpacing: '-0.04em', color: 'var(--color-ink)' }} data-supports>{fmt(figure)}</h1>
                <span className={`block leading-tight mt-0.5 text-[0.74rem]`} style={{ color: 'var(--color-ink-dim)' }}>a month after tax · <span data-ask>You ask for {fmt(month)}</span></span>
                {gap != null && (
                  <span data-gap className={`block font-semibold leading-tight whitespace-nowrap text-[0.78rem]`} style={{ color: gap < 0 ? 'var(--color-slate)' : status.key === 'on' ? 'var(--color-ring)' : 'var(--color-ink-dim)' }}>
                    {Math.abs(gap) < 25 ? <>Just what you ask</>
                      : gap < 0 ? <>{fmt(-gap)} short</>
                        : <>{fmt(gap)} to spare</>}
                  </span>)}
              </>;
  const sheets = <>
    <Sheet open={panel === 'help'} onClose={() => setPanel(null)} title="What would help most">
      {panel === 'help' && <HelpPanel plan={plan} update={update} onDone={() => setPanel(null)} />}
    </Sheet>
    <Sheet open={panel === 'risk'} onClose={() => setPanel(null)} title="What could go wrong">
      {panel === 'risk' && <RiskPanel plan={plan} mc={mc} rails={rails} />}
    </Sheet>
  </>;
  const answer = <span data-futures style={{ color: 'var(--color-ink)' }}>{futuresSentence(status)}</span>;

  if (moon) {
    // The moon home: the count, the verdict and the two things most people change. Everything else is in Details.
    const stepOf = (d: Driver, label: string, typed: boolean): MoonStep => {
      const n = d.val.get();
      // The names a screen reader hears start with the words on the screen.
      const less = d.id === 'targetNet' ? `${label}: £100 less` : `${label}: ${d.less}`, more = d.id === 'targetNet' ? `${label}: £100 more` : `${label}: ${d.more}`;
      return { id: d.id, label, value: d.show(n), raw: n, less, more, canLess: n > d.val.min, canMore: n < d.val.max,
        onLess: () => write(d.id, (_v, cur) => cur - d.step), onMore: () => write(d.id, (_v, cur) => cur + d.step), onType: typed ? v => write(d.id, () => v) : undefined };
    };
    return (<>
      <Suspense fallback={<div data-simple-home data-moon-loading className="fixed inset-0" style={{ background: '#070C1F' }} />}>
        <MoonHome header={headerNight ?? header} held={moonYears} structured={structured} spare={spare} pending={pending} front={front && panel == null}
          steps={[stepOf(drivers[0], 'Stop work at', false), stepOf(drivers[1], 'Live on each month', true)]}
          onHelp={() => setPanel('help')} onRisk={() => setPanel('risk')} onFailed={() => setNo3d(true)} />
      </Suspense>
      {sheets}
    </>);
  }

  return (<>
    <div data-simple-home className="fixed inset-0 overflow-y-auto"
      style={{ background: 'var(--color-canvas)', paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 5.4rem)',
        paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}>
      {/* At least a screen tall, so the island can take whatever height is
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
            {/* ── The picture is the screen, and the answer sits in it: the island ── */}
            {<Island mc={mc} structured={structured} fromAge={stopAge} toAge={plan.horizonAge} ask={month} central={central} events={events} tranches={tranches}
              onOpen={(key, at) => setOpen({ key, at })} onAsk={m => update((p: any) => ({ ...p, targetNet: m * 12 }))}
              summary={`${spokenAnswer(status, stopAge, typicalShort)} ${resting}`} resting={resting}
              head={head}
              answer={answer} />}
          </section>
        )}

        {/* ── The three things most people change, side by side ──────── */}
        {hasMoney && (
          <section className="mt-2 grid grid-cols-3 gap-1.5" aria-label="Change your plan">
            {drivers.map(d => {
              const n = d.val.get();
              return (
                <div key={d.id} data-driver={d.id} className="rounded-2xl px-1 pt-1.5 pb-1 flex flex-col items-center text-center min-w-0" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
                  <div className="text-[0.66rem] font-semibold leading-tight truncate max-w-full" style={{ color: 'var(--color-ink-dim)' }}>{d.label}{d.sub === 'a month' ? ' a month' : ''}</div>
                  <div className="flex items-center gap-0.5 w-full mt-0.5">
                    <button type="button" aria-label={`${d.label}: ${d.less}`} disabled={n <= d.val.min} onClick={() => write(d.id, (_v, cur) => cur - d.step)}
                      className="shrink-0 w-7 h-8 rounded-full flex items-center justify-center disabled:opacity-30" style={{ color: 'var(--color-ink)' }}><Minus size={15} /></button>
                    {typing?.id === d.id ? (
                      <input autoFocus inputMode="decimal" aria-label={`${d.label}, type a figure`} value={typing.text} onChange={e => setTyping({ id: d.id, text: e.target.value })}
                        onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setTyping(null); }}
                        className="tnum text-center text-[0.95rem] font-bold rounded-lg py-0.5 min-w-0 flex-1 outline-none" style={{ background: 'var(--color-canvas)', color: 'var(--color-ink)', border: '1px solid var(--color-calm)' }} />
                    ) : (
                      <button type="button" onClick={() => setTyping({ id: d.id, text: String(n) })} aria-label={`${d.label}: ${d.show(n)}. Tap to type a figure`}
                        className="tnum text-[0.98rem] font-bold leading-none min-h-[32px] min-w-0 flex-1" style={{ color: 'var(--color-ink)' }}>{d.show(n)}</button>
                    )}
                    <button type="button" aria-label={`${d.label}: ${d.more}`} disabled={n >= d.val.max} onClick={() => write(d.id, (_v, cur) => cur + d.step)}
                      className="shrink-0 w-7 h-8 rounded-full flex items-center justify-center disabled:opacity-30" style={{ color: 'var(--color-ink)' }}><Plus size={15} /></button>
                  </div>
                </div>);
            })}
          </section>
        )}

        {/* ── Spending less in later life (owner, 17 November 2026: "add toggles for reduce
            spend at 75 and 82"). The same settings as Details → Spending; the percentages are
            measured against the full retirement spend, so the later one is the total, not a cut
            on top of the first. ──────────────────────────────────────────── */}
        {hasMoney && (
          <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Spend less in later life">
            {([['phase1', plan.phase1Age, plan.phase1Cut, !!plan.phase1On], ['phase2', plan.phase2Age, plan.phase2Cut, !!plan.phase2On]] as const).map(([k, age, cut, on]) => (
              <button key={k} type="button" role="switch" aria-checked={on} data-step-down={k}
                aria-label={`Spend ${Math.round(cut * 100)}% less from ${age}${k === 'phase2' ? ', in total' : ''}`}
                onClick={() => update((p: any) => ({ ...p, [k + 'On']: !on }))}
                className="flex items-center justify-center gap-1.5 rounded-full min-h-[34px] px-2 text-[0.76rem] [@media(max-width:379px)]:text-[0.72rem] font-semibold"
                style={{ background: on ? 'color-mix(in srgb, var(--color-calm) 12%, var(--color-canvas))' : 'var(--color-canvas)', border: `1px solid ${on ? 'var(--color-calm)' : 'var(--color-hairline)'}`, color: on ? 'var(--color-calm-strong)' : 'var(--color-ink-dim)' }}>
                <span aria-hidden className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[0.65rem]" style={{ background: on ? 'var(--color-calm)' : 'transparent', border: on ? 'none' : '1px solid var(--color-ink-faint)', color: 'var(--color-on-calm)' }}>{on ? '✓' : ''}</span>
                {Math.round(cut * 100)}% less from {age}
              </button>))}
          </div>
        )}

        {/* ── Two questions, one tap each ────────────────────────────── */}
        {hasMoney && (
          <div className="mt-3 [@media(max-height:760px)]:mt-2 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setPanel('help')} className="rounded-2xl py-2 px-1 min-h-[40px] text-[0.84rem] [@media(max-width:379px)]:text-[0.8rem] font-semibold" style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-calm)', color: 'var(--color-calm-strong)' }}>What would help?</button>
            <button type="button" onClick={() => setPanel('risk')} className="rounded-2xl py-2 px-1 min-h-[40px] text-[0.84rem] [@media(max-width:379px)]:text-[0.8rem] font-semibold" style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-calm)', color: 'var(--color-calm-strong)' }}>What could go wrong?</button>
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
    {sheets}
    <Sheet open={!!openTranche} onClose={() => setOpen(null)} title={openTranche?.name || ''}>
      {openTranche && <TrancheSheet plan={plan} tranche={openTranche} first={stopAge} last={endAge} at={open?.at ?? null} />}
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
