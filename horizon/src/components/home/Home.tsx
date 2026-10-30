import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, SlidersHorizontal } from 'lucide-react';
import type { Drawdown, MC } from '../../engine/engine';
import { fmt, fmtK } from '../../lib/format';
import { useInsight } from '../../lib/useInsight';
import type { Rail } from '../../lib/insights';
import Sky from './Sky';

/**
 * The home. One page, one idea: your answer, in the open, above the horizon
 * — and beneath it the six steps that shape it. There is nothing to unlock
 * and nothing to confirm: touch a step and it counts, the sky lightens a
 * sixth, and when all six are set the sun is up.
 *
 * Which steps are set lives on the plan (plan.codeSet — the name predates
 * this screen), so it survives a reload and travels with an exported plan.
 */
const STEPS = ['you', 'someday', 'pensions', 'savings', 'promised', 'later'] as const;
type StepId = typeof STEPS[number];
const NAMES: Record<StepId, string> = { you: 'You', someday: 'Someday', pensions: 'Pensions', savings: 'Savings', promised: 'Promised', later: 'Later' };

const thisYear = new Date().getFullYear();

// ── Small parts ─────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, fmt: f, note, onChange }: {
  label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; note?: string; onChange: (v: number) => void;
}) {
  const fill = ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
  return (
    <label className="block pt-2">
      <span className="flex justify-between items-baseline gap-2 text-[0.8rem]" style={{ color: 'var(--cx-dim)' }}>
        <span className="min-w-0">{label}{note && <span style={{ color: 'var(--cx-faint)' }}> · {note}</span>}</span>
        <span className="cx-serif text-[1.3rem] leading-none shrink-0" style={{ color: 'var(--cx-ink)' }}>{f(value)}</span>
      </span>
      <input type="range" className="cx-range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))}
        style={{ '--fill': `${fill.toFixed(1)}%` } as React.CSSProperties}
        onChange={e => onChange(Number(e.target.value))} aria-label={label} />
    </label>
  );
}
function Seg<T extends string | boolean>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="grid gap-[3px] p-[3px] rounded-xl mt-1" role="group" aria-label={label}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, background: 'rgba(255,255,255,.06)' }}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className="rounded-[9px] min-h-[36px] text-[0.82rem]"
          style={{ background: value === v ? 'rgba(255,255,255,.13)' : 'transparent', color: value === v ? 'var(--cx-ink)' : 'var(--cx-dim)' }}>{l}</button>
      ))}
    </div>
  );
}

// ── The home ────────────────────────────────────────────────────────────
export default function Home({ plan, update, dd, mc, viz, header, onDetails }: {
  plan: any; update: (p: any) => void; dd: Drawdown; mc: MC | null;
  viz: { base: [number, number][]; low: [number, number][]; high: [number, number][] };
  header?: React.ReactNode; onDetails: () => void;
}) {
  const A = plan.partnerA, B = plan.partnerB, single = plan.household === 'single';
  const setA = (patch: any) => update((p: any) => ({ ...p, partnerA: { ...p.partnerA, ...patch } }));
  const setB = (patch: any) => update((p: any) => ({ ...p, partnerB: { ...p.partnerB, ...patch } }));
  const done: string[] = Array.isArray(plan.codeSet) ? plan.codeSet : [];
  const isDone = (id: StepId) => done.includes(id);
  const nDone = STEPS.filter(isDone).length, allDone = nDone === STEPS.length;
  const [stepI, setStepI] = useState(() => Math.max(0, STEPS.findIndex(id => !done.includes(id))));
  const id = STEPS[stepI];

  // Touching a step is what sets it. Next confirms a step left as it was.
  const markDone = (s: StepId) => {
    if (isDone(s)) return;
    update((p: any) => ({ ...p, codeSet: Array.from(new Set([...(Array.isArray(p.codeSet) ? p.codeSet : []), s])) }));
  };
  const next = () => { markDone(id); if (stepI < STEPS.length - 1) setStepI(stepI + 1); };

  // The moment the last one lands.
  const wasAll = useRef(allDone);
  useEffect(() => {
    if (allDone && !wasAll.current) { try { navigator.vibrate?.([12, 40, 18]); } catch { /* not supported */ } }
    wasAll.current = allDone;
  }, [allDone]);

  // The answer.
  const railsKey = useMemo(() => JSON.stringify({ ...plan, targetNet: 0, codeSet: null, spendingPlanOn: false }), [plan]);
  const rails = useInsight<Rail[]>('guardrails', plan, railsKey);
  const month = Math.round((plan.targetNet || 0) / 12);
  const lasts = dd.exhaustedAgeA == null;
  const base = rails?.find(r => r.key === 'base');
  const hasMoney = (A.pension + A.isa + (single ? 0 : B.pension + B.isa) + (plan.cash || 0) + A.monthlyPension) > 0;
  const holds = mc ? (mc.successProb >= 0.975 ? 'over 95%' : `about ${Math.round(mc.successProb * 20) * 5}%`) : null;

  // ── The six steps ─────────────────────────────────────────────────────
  const pair = (a: React.ReactNode, b: React.ReactNode) => single ? a : <div className="grid grid-cols-2 gap-x-4">{a}{b}</div>;
  const year = (v: number) => String(v);
  const fields: Record<StepId, React.ReactNode> = {
    you: <>
      <Seg label="Who the plan is for" value={single ? 'single' : 'couple'} onChange={v => update({ household: v })}
        options={[['couple', 'The two of us'], ['single', 'Just me']]} />
      {pair(
        <Slider label="Born" note={`${thisYear - A.birthYear} now`} value={A.birthYear} min={1935} max={2000} step={1} fmt={year} onChange={v => setA({ birthYear: v })} />,
        <Slider label="They were born" note={`${thisYear - B.birthYear}`} value={B.birthYear} min={1935} max={2000} step={1} fmt={year} onChange={v => setB({ birthYear: v })} />)}
    </>,
    someday: <>
      <Slider label="Stop work in" note={`at ${plan.retireYear - A.birthYear}`} value={plan.retireYear} min={plan.startYear + 1} max={plan.startYear + 20} step={1} fmt={year}
        onChange={v => update({ retireYear: v })} />
      <Slider label="Take home a month" note="today's money" value={month} min={800} max={15000} step={50} fmt={fmt}
        onChange={v => update({ targetNet: v * 12, spendingPlanOn: false })} />
    </>,
    pensions: <>
      {pair(
        <Slider label={single ? 'Your pensions' : 'Your pot'} value={A.pension} min={0} max={2500000} step={5000} fmt={fmtK} onChange={v => setA({ pension: v, pots: [], tfcRate: 0.25 })} />,
        <Slider label="Their pot" value={B.pension} min={0} max={2500000} step={5000} fmt={fmtK} onChange={v => setB({ pension: v, pots: [], tfcRate: 0.25 })} />)}
      <Slider label="Still paying in, a month" value={A.monthlyPension} min={0} max={6000} step={25} fmt={fmt} onChange={v => setA({ monthlyPension: v })} />
    </>,
    savings: <>
      {pair(
        <Slider label={single ? 'ISAs' : 'Your ISAs'} value={A.isa} min={0} max={1500000} step={5000} fmt={fmtK} onChange={v => setA({ isa: v })} />,
        <Slider label="Their ISAs" value={B.isa} min={0} max={1500000} step={5000} fmt={fmtK} onChange={v => setB({ isa: v })} />)}
      <Slider label="Cash and Premium Bonds" value={plan.cash || 0} min={0} max={500000} step={1000} fmt={fmtK} onChange={v => update({ cash: v })} />
    </>,
    promised: <>
      {pair(
        <Slider label={single ? 'State Pension a year' : 'Your State Pension'} value={A.spAmount} min={0} max={13000} step={50} fmt={fmt} onChange={v => setA({ spAmount: v })} />,
        <Slider label="Theirs" value={B.spAmount} min={0} max={13000} step={50} fmt={fmt} onChange={v => setB({ spAmount: v })} />)}
      {pair(
        <Slider label={single ? 'Company pension a year' : 'Your company pension'} value={A.db} min={0} max={60000} step={250} fmt={fmt}
          onChange={v => setA({ db: v, dbStartYear: v > 0 && !(A.db > 0) ? plan.retireYear : A.dbStartYear })} />,
        <Slider label="Theirs" value={B.db} min={0} max={60000} step={250} fmt={fmt}
          onChange={v => setB({ db: v, dbStartYear: v > 0 && !(B.db > 0) ? plan.retireYear : B.dbStartYear })} />)}
    </>,
    later: <>
      <Seg label="How spending changes" value={plan.phase2On ? 'gogo' : plan.phase1On ? 'slowgo' : 'nogo'}
        onChange={v => update(v === 'gogo' ? { phase1On: true, phase2On: true } : v === 'slowgo' ? { phase1On: true, phase2On: false } : { phase1On: false, phase2On: false })}
        options={[['gogo', 'Go-go'], ['slowgo', 'Slow-go'], ['nogo', 'Steady']]} />
      <Slider label="Plan to age" value={plan.horizonAge} min={Math.max(70, plan.retireYear - A.birthYear + 1)} max={105} step={1} fmt={year} onChange={v => update({ horizonAge: v })} />
      <button type="button" onClick={onDetails} className="mt-3 flex items-center gap-1.5 text-[0.78rem]" style={{ color: 'var(--cx-faint)' }}>
        <SlidersHorizontal size={13} /> Everything else — schemes, tax, structure — is in Details
      </button>
    </>,
  };

  // The horizon sits just under the answer, wherever that lands on this screen.
  const answerBox = useRef<HTMLDivElement | null>(null);
  const [geo, setGeo] = useState({ hz: 320, cx: 200, size: 320 });
  useLayoutEffect(() => {
    const el = answerBox.current; if (!el) return;
    const measure = () => { const r = el.getBoundingClientRect(); setGeo({ hz: r.bottom + 4, cx: window.innerWidth / 2, size: Math.min(window.innerWidth * 0.8, 340) }); };
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [hasMoney]);
  const ridges = useMemo(() => ({ good: viz.high.map(d => d[1]), base: viz.base.map(d => d[1]), poor: viz.low.map(d => d[1]) }), [viz]);

  return (
    <div className="cx relative min-h-full">
      <Sky k={nDone / STEPS.length} horizonY={geo.hz} sun={{ cx: geo.cx, size: geo.size }} ridges={ridges} turn={stepI * 60} />
      <div className="relative mx-auto max-w-[560px]" style={{ zIndex: 1,
        paddingTop: 'calc(env(safe-area-inset-top) + 0.8rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)',
        paddingLeft: 'max(18px, env(safe-area-inset-left))', paddingRight: 'max(18px, env(safe-area-inset-right))' }}>
        {header}

        {/* ── The answer, in the open ─────────────────────────────────── */}
        {/* The figure stands in the sky; the horizon runs just beneath it, and
            the verdict sits on the dark ground below where it can be read at dawn. */}
        <div data-answer className="text-center" style={{ textShadow: '0 1px 2px rgba(0,0,0,.55), 0 2px 22px rgba(0,0,0,.6)' }}>
          <div ref={answerBox} className="flex flex-col justify-end pt-6 pb-3" style={{ minHeight: '34vh' }}>
            {hasMoney ? (
              <h1 className="cx-serif leading-[.95]">
                <span className="block" style={{ fontSize: 'clamp(3.2rem, 17vw, 4.8rem)' }}>{fmt(month)}</span>
                <span className="block text-[0.7rem] tracking-[0.22em] uppercase mt-2 font-sans" style={{ color: 'var(--cx-ink)', opacity: 0.9 }}>a month, for life</span>
              </h1>
            ) : (
              <h1 className="cx-serif leading-[1.04]" style={{ fontSize: 'clamp(2rem, 9vw, 2.6rem)' }}>Six steps to <em style={{ color: 'var(--cx-gold)' }}>your someday.</em></h1>
            )}
          </div>
          <p className="pt-3 text-[0.9rem] leading-snug mx-auto max-w-[34ch]" style={{ color: 'var(--cx-dim)' }}>
            {hasMoney ? <>
              {lasts ? <b style={{ color: 'var(--cx-sage)' }}>Lasts into your {Math.floor(plan.horizonAge / 10) * 10}s.</b>
                : <b style={{ color: 'var(--cx-rose)' }}>Runs short at {dd.exhaustedAgeA}.</b>}
              {base && <> Could stretch to {fmt(base.year / 12)}.</>}
              {holds && <> Holds in {holds} of simulated futures.</>}
            </> : <>Set your pensions and savings below. The sky lightens as you go, and your answer appears here.</>}
          </p>
        </div>

        {/* ── The six steps ───────────────────────────────────────────── */}
        <div className="hm-panel mt-5">
          <nav aria-label="Steps" className="flex justify-between gap-1 px-1">
            <span className="sr-only" role="img" aria-label={`${nDone} of 6 steps set`} />
            {STEPS.map((s, i) => (
              <button key={s} type="button" onClick={() => setStepI(i)} aria-current={i === stepI ? 'step' : undefined}
                className="flex flex-col items-center gap-1.5 flex-1 min-w-0 py-1 text-[0.66rem]"
                style={{ color: i === stepI ? 'var(--cx-ink)' : isDone(s) ? 'var(--cx-dim)' : 'var(--cx-faint)' }}>
                <span className="block w-[6px] h-[6px] rounded-full transition-all duration-500"
                  style={{ background: isDone(s) ? 'var(--cx-gold)' : 'transparent', border: `1px solid ${isDone(s) ? 'var(--cx-gold)' : 'rgba(255,255,255,.3)'}`,
                    boxShadow: isDone(s) ? '0 0 8px rgba(220,192,140,.6)' : undefined }} />
                <span className="whitespace-nowrap" style={{ borderBottom: i === stepI ? '1px solid var(--cx-gold)' : '1px solid transparent' }}>{NAMES[s]}</span>
              </button>
            ))}
          </nav>

          <motion.section key={id} data-step={id} aria-label={NAMES[id]} className="mt-4"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }}
            onInputCapture={() => markDone(id)}
            onClickCapture={e => { if ((e.target as HTMLElement).closest('button[aria-pressed]')) markDone(id); }}>
            <div className="flex justify-between items-baseline">
              <h2 className="cx-serif text-[1.6rem] leading-none">{NAMES[id] === 'Later' ? 'Later life' : NAMES[id]}</h2>
              <span className="text-[0.7rem] tracking-[0.18em] uppercase" style={{ color: 'var(--cx-faint)' }}>Step {stepI + 1} of 6</span>
            </div>
            <div className="mt-1">{fields[id]}</div>
          </motion.section>

          <div className="flex justify-between items-center mt-5">
            <button type="button" onClick={() => setStepI(Math.max(0, stepI - 1))} disabled={stepI === 0}
              className="flex items-center gap-1.5 text-[0.84rem] min-h-[40px] px-2 disabled:opacity-0" style={{ color: 'var(--cx-dim)' }}>
              <ArrowLeft size={15} /> Back
            </button>
            {stepI < STEPS.length - 1 ? (
              <button type="button" onClick={next} className="flex items-center gap-2 rounded-full pl-5 pr-4 min-h-[42px] text-[0.9rem] font-semibold"
                style={{ background: 'rgba(220,192,140,.16)', border: '1px solid rgba(220,192,140,.6)', color: 'var(--cx-gold-hi)' }}>
                Next <ArrowRight size={16} />
              </button>
            ) : !isDone('later') ? (
              <button type="button" onClick={next} className="rounded-full px-5 min-h-[42px] text-[0.9rem] font-semibold"
                style={{ background: 'rgba(220,192,140,.16)', border: '1px solid rgba(220,192,140,.6)', color: 'var(--cx-gold-hi)' }}>
                Done
              </button>
            ) : (
              <span className="text-[0.8rem]" style={{ color: 'var(--cx-gold)' }}>All six set</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
