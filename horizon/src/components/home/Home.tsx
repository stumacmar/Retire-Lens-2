import { useEffect, useId, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { Drawdown, MC } from '../../engine/engine';
import { E } from '../../lib/usePlan';
import { deflate, fmt, fmtK } from '../../lib/format';
import { useInsight } from '../../lib/useInsight';
import type { Rail } from '../../lib/insights';
import { Segmented } from '../Field';

/**
 * The home: a pension calculator in the plain sense — the kind people already
 * trust — done properly. Everything is on one page. The answer sits at the
 * top and changes as you move anything below it; every figure is a slider
 * with a number you can type beside it, with a sensible default so there is
 * a result from the first second. No sign-up, no gate, no steps to get lost
 * in. The answer is after tax and in today's money, says how long it lasts
 * and how often it holds, and the action plan beneath is measured, not sold.
 */
const thisYear = new Date().getFullYear();

// ── A figure you can slide or type ───────────────────────────────────────
function Range({ label, value, min, max, step, onChange, money, suffix, hint, show }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
  money?: boolean; suffix?: string; hint?: string; show?: (v: number) => string;
}) {
  const id = useId();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const display = (v: number) => money ? Math.round(v).toLocaleString('en-GB') : String(Math.round(v));
  const [text, setText] = useState(display(value));
  useEffect(() => { setText(display(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => { const t = text.replace(/[,£\s]/g, ''); const v = t === '' ? min : parseFloat(t); if (Number.isFinite(v)) onChange(clamp(v)); else setText(display(value)); };
  const fill = ((clamp(value) - min) / (max - min)) * 100;
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="min-w-0 flex-1 text-[0.92rem] leading-[1.3]" style={{ color: 'var(--color-ink)' }}>
          {label}{hint && <span className="block text-[0.73rem] leading-snug mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>{hint}</span>}
        </label>
        <span className="flex items-baseline shrink-0 rounded-xl px-2 py-1 -mr-2 transition-colors focus-within:bg-[color-mix(in_srgb,var(--color-calm)_16%,transparent)]">
          {money && <span className="text-[0.95rem] mr-0.5" style={{ color: 'var(--color-ink-faint)' }} aria-hidden="true">£</span>}
          <input id={id} className="tnum bg-transparent outline-none text-right text-[1.05rem] font-bold" inputMode={money ? 'decimal' : 'numeric'}
            style={{ width: `${Math.max(2, text.length) + 0.4}ch`, color: 'var(--color-ink)' }} value={text}
            onChange={e => setText(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
          {suffix && <span className="text-[0.9rem] ml-0.5" style={{ color: 'var(--color-ink-faint)' }}>{suffix}</span>}
          {show && <span className="text-[0.8rem] ml-1.5 tnum" style={{ color: 'var(--color-ink-faint)' }}>{show(value)}</span>}
        </span>
      </div>
      <input type="range" className="range mt-1" min={min} max={max} step={step} value={clamp(value)} aria-label={label}
        style={{ '--fill': `${fill.toFixed(1)}%` } as React.CSSProperties} onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="mt-5">
      <h2 className="text-[0.72rem] font-bold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--color-ink-faint)' }}>{title}</h2>
      <div className="rounded-[20px] px-4 [&>*+*]:border-t [&>*+*]:border-[color:var(--color-hairline)] [&>div[role=group]]:my-3"
        style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }}>
        {children}
      </div>
    </section>
  );
}

// ── The small chart in the result: your money over time, in today's money ──
function Wealth({ viz, retireYear, horizonAge, birthYear }: { viz: { base: [number, number][]; low: [number, number][]; high: [number, number][] }; retireYear: number; horizonAge: number; birthYear: number }) {
  const all = [...viz.high, ...viz.base], max = Math.max(1, ...all.map(d => d[1]));
  const y0 = viz.base[0]?.[0] ?? thisYear, y1 = viz.base[viz.base.length - 1]?.[0] ?? y0 + 1, W = 320, H = 96;
  const X = (y: number) => ((y - y0) / Math.max(1, y1 - y0)) * W, Y = (v: number) => H - 14 - (Math.max(0, v) / max) * (H - 22);
  const path = (s: [number, number][]) => s.map((d, i) => `${i ? 'L' : 'M'}${X(d[0]).toFixed(1)},${Y(d[1]).toFixed(1)}`).join('');
  const band = path(viz.high) + viz.low.slice().reverse().map(d => `L${X(d[0]).toFixed(1)},${Y(d[1]).toFixed(1)}`).join('') + 'Z';
  const peak = Math.max(0, ...viz.base.map(d => d[1]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto mt-3" role="img"
      aria-label={`What you have from ${y0} to ${y1} in today's money, peaking at ${fmtK(peak)}; poor to good markets shaded`}>
      <path d={band} fill="color-mix(in srgb, var(--color-ocean) 14%, transparent)" />
      <path d={path(viz.base)} fill="none" stroke="var(--color-ocean)" strokeWidth={2.2} strokeLinejoin="round" />
      <line x1={X(retireYear)} x2={X(retireYear)} y1={4} y2={H - 14} stroke="var(--color-ink-faint)" strokeDasharray="2 3" />
      <text x={Math.min(X(retireYear) + 4, W - 60)} y={11} fontSize={9.5} fill="var(--color-ink-dim)">stop at {retireYear - birthYear}</text>
      <text x={0} y={H - 2} fontSize={9.5} fill="var(--color-ink-faint)">{y0}</text>
      <text x={W} y={H - 2} fontSize={9.5} fill="var(--color-ink-faint)" textAnchor="end">{y1} · age {horizonAge}</text>
    </svg>
  );
}

// ── The action plan: the three things that would help most, measured ──────
function ActionPlan({ plan, plus, onUpgrade }: { plan: any; plus: boolean; onUpgrade: () => void }) {
  const [res, setRes] = useState<any>(null);
  useEffect(() => {
    let live = true;
    const id = setTimeout(() => { try { const r = (E as any).levers(plan, { paths: 200 }); if (live) setRes(r); } catch { if (live) setRes(null); } }, 700);
    return () => { live = false; clearTimeout(id); };
  }, [plan]);
  const top = res?.levers?.filter((l: any) => l.dConf > 0.004).slice(0, 3) ?? [];
  return (
    <section aria-label="Your action plan" className="mt-5">
      <h2 className="text-[0.72rem] font-bold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--color-ink-faint)' }}>Your action plan</h2>
      <div className="rounded-[20px] overflow-hidden" style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }}>
        {!res ? <p className="px-4 py-4 text-[0.84rem]" style={{ color: 'var(--color-ink-dim)' }}>Measuring what would help most, across the same simulated futures…</p>
          : !top.length ? <p className="px-4 py-4 text-[0.84rem]" style={{ color: 'var(--color-ink-dim)' }}>Nothing measured would clearly improve this plan. That is a good place to be.</p>
          : top.map((l: any, i: number) => (
            <div key={l.id} className="px-4 py-3 flex items-start gap-3" style={{ borderTop: i ? '1px solid var(--color-hairline)' : 'none' }}>
              <span className="tnum shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[0.78rem] font-bold"
                style={{ background: 'color-mix(in srgb, var(--color-sage) 30%, transparent)', color: 'var(--color-sage-strong)' }}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9rem] font-semibold">{l.label}</span>
                {(plus || i === 0) && <span className="block text-[0.78rem] leading-relaxed mt-0.5" style={{ color: 'var(--color-ink-dim)' }}>{l.detail}</span>}
              </span>
              <span className="tnum shrink-0 text-[0.9rem] font-extrabold" style={{ color: 'var(--color-sage-strong)' }}>+{Math.round(l.dConf * 100)} pts</span>
            </div>))}
        {res && top.length > 1 && !plus && (
          <button onClick={onUpgrade} className="w-full text-left px-4 py-3 text-[0.8rem]" style={{ borderTop: '1px solid var(--color-hairline)', color: 'var(--color-ink-dim)' }}>
            The detail behind each action, and every lever measured, is in <b style={{ color: 'var(--color-calm-strong)' }}>Plus</b>.
          </button>)}
      </div>
      <p className="text-[0.72rem] mt-1.5 px-1 leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
        Points are how much more often the plan holds across {res?.paths ?? 200} simulated futures. Prompts to explore with an adviser — not advice.
      </p>
    </section>
  );
}

// ── The home ────────────────────────────────────────────────────────────
export default function Home({ plan, update, dd, mc, viz, header, plus, onUpgrade, onDetails }: {
  plan: any; update: (p: any) => void; dd: Drawdown; mc: MC | null;
  viz: { base: [number, number][]; low: [number, number][]; high: [number, number][]; atRetire: number };
  header?: React.ReactNode; plus: boolean; onUpgrade: () => void; onDetails: () => void;
}) {
  const A = plan.partnerA, B = plan.partnerB, single = plan.household === 'single';
  const setA = (patch: any) => update((p: any) => ({ ...p, partnerA: { ...p.partnerA, ...patch } }));
  const setB = (patch: any) => update((p: any) => ({ ...p, partnerB: { ...p.partnerB, ...patch } }));

  const railsKey = useMemo(() => JSON.stringify({ ...plan, targetNet: 0, spendingPlanOn: false }), [plan]);
  const rails = useInsight<Rail[]>('guardrails', plan, railsKey);
  const month = Math.round((plan.targetNet || 0) / 12);
  const lasts = dd.exhaustedAgeA == null;
  const base = rails?.find(r => r.key === 'base');
  const hasMoney = (A.pension + A.isa + (single ? 0 : B.pension + B.isa) + (plan.cash || 0) + A.monthlyPension) > 0;
  const holds = mc ? (mc.successProb >= 0.975 ? 'over 95%' : `about ${Math.round(mc.successProb * 20) * 5}%`) : null;
  const retireAge = plan.retireYear - A.birthYear;

  // The first retired year, in today's money: what is guaranteed and the tax-free cash.
  const r0 = (dd.rows as any[])[0];
  const D = (v: number) => (r0 ? deflate(v || 0, r0.year, plan.startYear, plan.inflation) : 0);
  const guaranteed = r0 ? D(r0.spA + r0.spB + r0.dbA + r0.dbB) / 12 : 0;
  const tfc = Math.round(0.25 * (A.pension + (single ? 0 : B.pension)));

  const pair = (a: React.ReactNode, b: React.ReactNode) => single ? a : <>{a}{b}</>;

  return (
    <div className="relative mx-auto max-w-[560px]" style={{
      paddingTop: 'calc(env(safe-area-inset-top) + 0.8rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)',
      paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}>
      {header}

      {/* ── The answer ─────────────────────────────────────────────────── */}
      <div data-answer className="mt-4 rounded-[24px] px-5 pt-5 pb-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
        {hasMoney ? <>
          <p className="text-[0.72rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-ink-faint)' }}>You could take home</p>
          <h1 className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="serif tnum leading-none" style={{ fontSize: 'clamp(3rem, 14vw, 4rem)', color: 'var(--color-ink)' }}>{fmt(month)}</span>
            <span className="text-[0.95rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>a month, for life</span>
          </h1>
          <p className="mt-2 text-[0.88rem] leading-snug" style={{ color: 'var(--color-ink-dim)' }}>
            After tax, in today's money, from {plan.retireYear} when you're {retireAge}.{' '}
            {lasts ? <b style={{ color: 'var(--color-sage-strong)' }}>Lasts into your {Math.floor(plan.horizonAge / 10) * 10}s.</b>
              : <b style={{ color: 'var(--color-hope)' }}>Runs short at {dd.exhaustedAgeA}.</b>}
            {base && <> Could stretch to {fmt(base.year / 12)}.</>}
            {holds && <> Holds in {holds} of simulated futures.</>}
          </p>
          <Wealth viz={viz} retireYear={plan.retireYear} horizonAge={plan.horizonAge} birthYear={A.birthYear} />
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            {([['Pots when you stop', fmtK(viz.atRetire)], ['Tax-free cash', fmtK(tfc)], ['Guaranteed a month', fmt(guaranteed)]] as [string, string][]).map(([l, v]) => (
              <div key={l} className="rounded-xl py-2 px-1" style={{ background: 'var(--color-canvas)' }}>
                <div className="tnum text-[0.98rem] font-extrabold">{v}</div>
                <div className="text-[0.64rem] leading-tight mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>{l}</div>
              </div>))}
          </div>
        </> : <>
          <h1 className="serif leading-[1.05]" style={{ fontSize: 'clamp(1.8rem, 8vw, 2.3rem)', color: 'var(--color-ink)' }}>What could you take home, for life?</h1>
          <p className="mt-2 text-[0.9rem] leading-snug" style={{ color: 'var(--color-ink-dim)' }}>
            Add your pension and savings below and your figure appears here — after tax, in today's money, with how long it lasts.
          </p>
        </>}
      </div>

      {/* ── Every figure, on one page ──────────────────────────────────── */}
      <div data-home>
        <Section title="About you">
          <div role="group" className="pt-3">
            <Segmented label="Who the plan is for" value={single ? 'single' : 'couple'} onChange={v => update({ household: v })}
              options={[{ value: 'single', label: 'Just me' }, { value: 'couple', label: 'The two of us' }]} />
          </div>
          {pair(
            <Range label="Your age" value={thisYear - A.birthYear} min={thisYear - 2000} max={thisYear - 1935} step={1} onChange={v => setA({ birthYear: thisYear - v })} show={v => `born ${thisYear - v}`} />,
            <Range label="Their age" value={thisYear - B.birthYear} min={thisYear - 2000} max={thisYear - 1935} step={1} onChange={v => setB({ birthYear: thisYear - v })} show={v => `born ${thisYear - v}`} />)}
        </Section>

        <Section title="Your retirement">
          <Range label="Retire at age" value={retireAge} min={Math.max(40, plan.startYear + 1 - A.birthYear)} max={plan.startYear + 20 - A.birthYear} step={1}
            onChange={v => update({ retireYear: A.birthYear + v })} show={v => `in ${A.birthYear + v}`} />
          <Range label="Take home a month" hint="after tax, in today's money" value={month} min={800} max={15000} step={50} money
            onChange={v => update({ targetNet: v * 12, spendingPlanOn: false })} />
        </Section>

        <Section title="Pensions">
          {pair(
            <Range label="Your pension pots" value={A.pension} min={0} max={2500000} step={5000} money onChange={v => setA({ pension: v, pots: [], tfcRate: 0.25 })} />,
            <Range label="Their pension pots" value={B.pension} min={0} max={2500000} step={5000} money onChange={v => setB({ pension: v, pots: [], tfcRate: 0.25 })} />)}
          <Range label="Still paying in, a month" hint="you and your employer together" value={A.monthlyPension} min={0} max={6000} step={25} money onChange={v => setA({ monthlyPension: v })} />
        </Section>

        <Section title="Savings">
          {pair(
            <Range label={single ? 'ISAs' : 'Your ISAs'} value={A.isa} min={0} max={1500000} step={5000} money onChange={v => setA({ isa: v })} />,
            <Range label="Their ISAs" value={B.isa} min={0} max={1500000} step={5000} money onChange={v => setB({ isa: v })} />)}
          <Range label="Cash and Premium Bonds" value={plan.cash || 0} min={0} max={500000} step={1000} money onChange={v => update({ cash: v })} />
        </Section>

        <Section title="Guaranteed income">
          {pair(
            <Range label={single ? 'State Pension a year' : 'Your State Pension a year'} hint={`from ${(E as any).spAgeOf(A)}; the full new State Pension is ${fmt(FULL_SP)}`} value={A.spAmount} min={0} max={13000} step={50} money onChange={v => setA({ spAmount: v })} />,
            <Range label="Their State Pension a year" value={B.spAmount} min={0} max={13000} step={50} money onChange={v => setB({ spAmount: v })} />)}
          {pair(
            <Range label={single ? 'Company pension a year' : 'Your company pension a year'} hint="final salary or career average" value={A.db} min={0} max={60000} step={250} money
              onChange={v => setA({ db: v, dbStartYear: v > 0 && !(A.db > 0) ? plan.retireYear : A.dbStartYear })} />,
            <Range label="Their company pension a year" value={B.db} min={0} max={60000} step={250} money
              onChange={v => setB({ db: v, dbStartYear: v > 0 && !(B.db > 0) ? plan.retireYear : B.dbStartYear })} />)}
        </Section>

        <Section title="Later life">
          <div role="group" className="pt-3">
            <Segmented label="How spending changes" small value={plan.phase2On ? 'gogo' : plan.phase1On ? 'slowgo' : 'nogo'}
              onChange={v => update(v === 'gogo' ? { phase1On: true, phase2On: true } : v === 'slowgo' ? { phase1On: true, phase2On: false } : { phase1On: false, phase2On: false })}
              options={[{ value: 'gogo', label: 'Go-go', sub: 'more early on' }, { value: 'slowgo', label: 'Slow-go', sub: 'eases later' }, { value: 'nogo', label: 'Steady', sub: 'the same throughout' }]} />
          </div>
          <Range label="Plan to age" value={plan.horizonAge} min={Math.max(70, retireAge + 1)} max={105} step={1} onChange={v => update({ horizonAge: v })} show={v => `in ${A.birthYear + v}`} />
          <button type="button" onClick={onDetails} className="w-full py-3 flex items-center gap-2 text-left text-[0.86rem]" style={{ color: 'var(--color-calm-strong)' }}>
            <SlidersHorizontal size={15} /> Everything else — schemes, tax, structure — is in Details
          </button>
        </Section>
      </div>

      {hasMoney && <ActionPlan plan={plan} plus={plus} onUpgrade={onUpgrade} />}
    </div>
  );
}

// The full new State Pension this tax year, for the hint only.
const FULL_SP: number = (() => { try { return Math.round((E as any).defaults().partnerA.spAmount) || 12548; } catch { return 12548; } })();
