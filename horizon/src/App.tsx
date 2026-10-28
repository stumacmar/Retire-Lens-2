import { useEffect, useMemo, useState } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { Sunrise, SlidersHorizontal, Compass, ShieldCheck, Download, Lightbulb, Sparkles } from 'lucide-react';
import { usePlan, hasSavedPlan, E } from './lib/usePlan';
import type { Accum, Drawdown, MC } from './engine/engine';
import { fmt, fmtK, pct, deflate } from './lib/format';
import { useCountUp } from './lib/useCountUp';
import HorizonViz from './components/HorizonViz';
import Sheet from './components/Sheet';
import Onboarding from './components/Onboarding';
import PlanForm from './components/PlanForm';
import { Payslip, Guardrails } from './components/Paycheck';
import Months from './components/Months';
import DecisionMap from './components/DecisionMap';
import Guess from './components/Guess';
import PrintReport from './components/PrintReport';
import Approach from './components/Approach';
import { MoneyField, NumField, Segmented } from './components/Field';
import Disclaimer, { disclaimerAccepted } from './components/Disclaimer';
import Dates from './components/Dates';
import Assumptions from './components/Assumptions';
import { PlusPill, Locked, PlusSheetBody } from './components/Plus';
import { EntitlementContext, useEntitlement, useEntitlementState } from './lib/entitlement';
import { PRODUCT } from './config/product';

// Continuous wealth series (today → horizon) from the engine output, in
// today's money: every point is deflated to the start year, so the chart and
// its axis say what the caption says.
function series(plan: any, acc: Accum, dd: Drawdown): [number, number][] {
  const D = (v: number, year: number) => deflate(v, year, plan.startYear, plan.inflation);
  const start: [number, number] =
    [plan.startYear, plan.partnerA.pension + plan.partnerA.isa + plan.partnerB.pension + plan.partnerB.isa + (plan.cash || 0)];
  const pre = acc.years.filter((y: any) => y.year < dd.rows[0].year)
    .map((y: any): [number, number] => [y.year, D(y.pensionA + y.isaA + y.pensionB + y.isaB + (y.cash || 0), y.year)]);
  const post = dd.rows.map((r: any): [number, number] => [r.year, D(r.wealth, r.year)]);
  return [start, ...pre, ...post];
}

// Confidence, said honestly: rounded to five, never "100%", with the
// sampling range alongside. A simulation cannot promise certainty.
export function confText(mc: any): { main: string; range: string; pctRounded: number } {
  const p = mc.successProb as number;
  const se = (mc.successSe as number) || 0;
  const lo = Math.max(0, Math.round((p - 2 * se) * 100)), hi = Math.min(100, Math.round((p + 2 * se) * 100));
  const r5 = Math.round(p * 20) * 5;
  const main = p >= 0.975 ? 'over 95%' : p <= 0.025 ? 'under 5%' : 'about ' + r5 + '%';
  return { main, range: lo + '–' + hi + '%', pctRounded: Math.min(95, r5) };
}
const isSingle = (plan: any) => plan.household === 'single';

type Tab = 'horizon' | 'details' | 'explore' | 'peace' | 'plus';

// Free + Plus: one entitlement state for the whole app, read anywhere via context.
export default function App() {
  const ent = useEntitlementState();
  return <MotionConfig reducedMotion="user"><EntitlementContext.Provider value={ent}><Horizon /></EntitlementContext.Provider></MotionConfig>;
}

function Horizon() {
  const { plus } = useEntitlement();
  const S = usePlan();
  const { plan, dd, acc, ddBear, ddBull, mc, estate, lens, setLens, update } = S;
  // Explore reads the plan through the chosen lens, exactly as the Horizon
  // and the confidence figure do — one set of numbers, never two.
  const planL = useMemo(() => ({ ...plan, growth: S.growth }), [plan, S.growth]);
  const [sheet, setSheet] = useState<Tab | null>(null);
  // Which carousel page the Details sheet opens on (0 = Who).
  const [detailsPage, setDetailsPage] = useState(0);
  // The answer has three pictures: a payslip, your months, the wealth chart.
  const [homeView, setHomeViewState] = useState<'pay' | 'months' | 'chart'>(() => {
    try { const v = localStorage.getItem('someday-home-view'); return v === 'months' || v === 'chart' ? v : 'pay'; } catch { return 'pay'; }
  });
  const setHomeView = (v: 'pay' | 'months' | 'chart') => { setHomeViewState(v); try { localStorage.setItem('someday-home-view', v); } catch { /* private mode */ } };
  const [yearSel, setYearSel] = useState<number | null>(null);
  const [onboarded, setOnboarded] = useState(hasSavedPlan());
  const [disclaimerOk, setDisclaimerOk] = useState(disclaimerAccepted());
  // Predict-then-reveal, once per device, before the first answer.
  const [guessed, setGuessed] = useState(() => { try { return localStorage.getItem('someday-guessed-v1') === '1'; } catch { return true; } });
  const openPlus = () => setSheet('plus');

  // A plan with no money in it is a blank canvas — show the invitation,
  // not a broken chart and an alarming zero-confidence sentence.
  const A = plan.partnerA, B = plan.partnerB;
  const hasMoney = (A.pension + A.isa + A.monthlyPension + A.monthlyIsa + A.db
    + B.pension + B.isa + B.monthlyPension + B.monthlyIsa + B.db + (plan.cash || 0)) > 0
    || (E as any).hasAnyDb(A) || (E as any).hasAnyDb(B);

  const resetAll = () => {
    if (typeof window !== 'undefined' &&
        !window.confirm('Start over? This clears every figure on this device and returns to the welcome screen.')) return;
    update(() => E.freshStart());
    setLens('base');
    setSheet(null);
    setOnboarded(false);
  };

  const horizonYear = (E as any).planEndYear(plan);
  const lasts = dd.exhaustedAgeA == null;
  const spendToday = Math.round(plan.targetNet);
  const conf = mc ? mc.successProb : (lasts ? 0.9 : 0.5);

  // While a slider is actively dragged, show the live figure (no count-up
  // re-tween → no stutter). Count-up plays on arrival and after you let go.
  const [editing, setEditing] = useState(false);
  const spendAnim = useCountUp(spendToday);
  const confAnim = useCountUp(Math.round(conf * 100));
  const shownSpend = editing ? spendToday : spendAnim;

  const viz = useMemo(() => {
    const base = series(plan, acc, dd);
    const low = series(plan, acc, ddBear);
    const high = series(plan, acc, ddBull);
    const atRetire = base.find(([y]) => y === plan.retireYear)?.[1] ?? 0;
    return { base, low, high, atRetire };
  }, [plan, acc, dd, ddBear, ddBull]);

  const ageAtRetire = plan.retireYear - plan.partnerA.birthYear;
  const ageNow = plan.startYear - plan.partnerA.birthYear;

  // Spending Style (brief): the classic go-go / slow-go / no-go retirement
  // spending shape, mapped honestly onto the engine's phased step-downs.
  const spendStyle: 'gogo' | 'slowgo' | 'nogo' = plan.phase2On ? 'gogo' : plan.phase1On ? 'slowgo' : 'nogo';
  const setSpendStyle = (v: string) => update(
    v === 'gogo' ? { phase1On: true, phase2On: true }
      : v === 'slowgo' ? { phase1On: true, phase2On: false }
      : { phase1On: false, phase2On: false });

  // Years of buffer: extend the horizon to 105 and see how far the money
  // actually runs past your chosen age — headroom, in plain years.
  const bufferYears = useMemo(() => {
    if (!hasMoney) return null;
    try {
      const r = E.drawdown({ ...plan, growth: plan.growthBase, horizonAge: 105 });
      if (r.exhaustedAgeA == null) return `${105 - plan.horizonAge}+`;
      return String(Math.max(0, r.exhaustedAgeA - plan.horizonAge));
    } catch { return null; }
  }, [plan, hasMoney]);

  // The Coach — a few grounded, on-device thoughts computed from the same
  // verified engine (never generic tips). Prompts for an adviser, not advice.
  const coach = useMemo(() => {
    const items: { t: string; b: string }[] = [];
    if (!hasMoney) return items;   // nothing sensible to say about a blank plan
    try {
      const P = { ...plan, growth: plan.growthBase };
      // All Coach figures in today's money, like the rest of the app.
      const realTax = (r: any) => r.lifetimeTaxReal ?? r.lifetimeTax;
      const labels: Record<string, string> = {
        sippfirst: 'pensions first, ISA for the excess',
        pafirst: 'pensions to the free allowances, then ISA',
        isafirst: 'ISA first, pensions deferred',
      };
      const runs = (['sippfirst', 'pafirst', 'isafirst'] as const)
        .map(id => ({ id, tax: realTax(E.drawdown({ ...P, strategy: id })) }));
      const cur = runs.find(s => s.id === plan.strategy);
      const best = [...runs].sort((a, b) => a.tax - b.tax)[0];
      if (cur && best && best.id !== cur.id && cur.tax - best.tax > 2500) {
        items.push({
          t: `A different drawdown order could save ~${fmtK(cur.tax - best.tax)} in tax`,
          b: `Over the whole journey (today's money), “${labels[best.id]}” pays the least income tax. You can switch it in your settings and watch the effect live.`,
        });
      }
      if (plan.pclsMode !== 'phased') {
        const now = E.drawdown(P);
        const phased = E.drawdown({ ...P, pclsMode: 'phased' });
        const save = realTax(now) - realTax(phased);
        if (save > 2500 && (phased.exhaustedAgeA == null || phased.exhaustedAgeA >= (now.exhaustedAgeA ?? 999))) {
          items.push({
            t: `Phased tax-free cash could save ~${fmtK(save)} in tax`,
            b: 'Taking a slice of your 25% tax-free amount with each withdrawal lowers the tax on every year’s income, over the whole journey (today’s money).',
          });
        }
      }
      if (plan.architecture?.on && (dd as any).architecture?.on) {
        const a = (dd as any).architecture;
        if (a.spendMultFinal < 0.999) {
          items.push({
            t: `Your written rules end up trimming spending to ×${a.spendMultFinal.toFixed(2)}`,
            b: 'On the central path the funded ratio falls far enough to fire the trim rule. That is the rule working as designed — but worth knowing the plan leans on it, rather than being comfortable without it.',
          });
        } else if (a.fundedRatioFinal != null && a.fundedRatioFinal > 1.4) {
          items.push({
            t: 'The plan finishes well over-funded',
            b: `The funded ratio ends around ${Math.round(a.fundedRatioFinal * 100)}%. Either the spending target is lower than it needs to be, or there is room to bring the date forward — both worth testing on the Horizon.`,
          });
        }
      }
      for (const who of [plan.partnerA, plan.partnerB]) {
        const annual = who.monthlyPension * 12;
        const accessed = (who.pclsTaken || 0) > 0 || (who.crystallised || 0) > 0;
        const income = who.income || 0;
        const tapered = income > 260000 ? Math.max(10000, 60000 - (income - 260000) / 2) : 60000;
        const allowance = accessed ? Math.min(10000, tapered) : tapered;
        if (annual > allowance) {
          items.push({
            t: `${who.name}'s pension saving may exceed the ~${fmtK(allowance)} annual allowance`,
            b: accessed
              ? 'Flexibly accessing a pension can trigger the Money Purchase Annual Allowance (£10,000 a year of tax-relieved saving). The current contributions exceed that — one to confirm with an adviser.'
              : 'High incomes taper the £60,000 annual allowance down to as little as £10,000. Contributions above it can trigger a tax charge — worth an adviser check. The projection itself is unchanged.',
          });
          break;
        }
      }
      for (const who of [plan.partnerA, plan.partnerB]) {
        if ((who.db || 0) > 0 && (who.dbTransferValue || 0) > 0) {
          items.push({
            t: `${who.name}'s DB transfer value is ~${((who.dbTransferValue || 0) / who.db).toFixed(0)}× the annual pension`,
            b: 'For context only: giving up index-linked guaranteed income is rarely right, and transfers over £30,000 legally require regulated financial advice. The plan models the pension as kept.',
          });
          break;
        }
      }
      if (mc && mc.successProb < 0.75) {
        const now = E.drawdown(P);
        const Q1 = JSON.parse(JSON.stringify(P)); (E as any).shiftRetirement(Q1, 1);
        const oneMore = E.drawdown(Q1);
        const gain = deflate(oneMore.endWealth - now.endWealth, horizonYear, plan.startYear, plan.inflation);
        items.push({
          t: 'The plan is sensitive to rough markets',
          b: `It holds in ${Math.round(mc.successProb * 100)}% of simulated futures. One more working year adds roughly ${fmtK(Math.max(0, gain))} of headroom; a small trim to spending does similar work.`,
        });
      } else if (mc && mc.successProb >= 0.9 && estate && estate.iht > 0) {
        items.push({
          t: 'Strong plan — the estate is now the bigger question',
          b: `With ${Math.round(mc.successProb * 100)}% of futures holding, the ~${fmtK(deflate(estate.iht, estate.year, plan.startYear, plan.inflation))} inheritance-tax exposure matters more than running out. Gifting and allowances are worth an adviser conversation.`,
        });
      }
    } catch { /* the coach must never break the horizon */ }
    return items.slice(0, 3);
  }, [plan, mc, estate, horizonYear, hasMoney]);

  // New visitor → the calm vision-first onboarding (all hooks run above first).
  if (!onboarded) {
    return (
      <Onboarding plan={plan} update={update} plus={plus} onUpgrade={openPlus}
        onDone={() => { update((p: any) => ({ ...p })); setOnboarded(true); }}
        onExample={() => { update(() => ({ ...E.defaults(), approach: 'traditional' })); setOnboarded(true); }} />
    );
  }

  // Accepted once: guidance not advice, estimates not promises. Shown to
  // returning users too, the first time after it was introduced or revised.
  if (!disclaimerOk) {
    return <Disclaimer onAccept={() => setDisclaimerOk(true)} />;
  }

  // The framing choice, asked once — including for plans saved before it
  // existed, which is why it lives here rather than inside onboarding.
  if (plan.approach == null) {
    return <Approach plan={plan} update={update} onDone={() => { /* plan now carries the choice */ }} />;
  }

  // Draw what you expect, then see what Someday projects. Once per device.
  if (hasMoney && !guessed) {
    return <Guess plan={plan} series={viz.base} dd={dd}
      onDone={() => { setGuessed(true); try { localStorage.setItem('someday-guessed-v1', '1'); } catch { /* private mode */ } }} />;
  }

  return (
    <div className="min-h-full mx-auto max-w-[560px] lg:max-w-[1140px] px-5 lg:px-8"
         style={{ paddingBottom: 'calc(8.5rem + env(safe-area-inset-bottom))' }}>

      <header className="pt-[calc(env(safe-area-inset-top)+1.1rem)] pb-1 flex items-center gap-2.5">
        <svg width="24" height="24" viewBox="0 0 42 42" fill="none" aria-hidden="true">
          <path d="M9 27a12 12 0 0 1 24 0" stroke="var(--color-calm)" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="21" cy="27" r="4.5" stroke="var(--color-calm)" strokeWidth="3.2" />
          <path d="M5 33.5h32" stroke="var(--color-calm)" strokeWidth="3.2" strokeLinecap="round" opacity=".5" />
        </svg>
        <div className="flex-1">
          <div className="text-[1.15rem] font-extrabold tracking-tight leading-none">Someday</div>
          <div className="text-[0.72rem] italic mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>see your horizon</div>
        </div>
        <PlusPill plus={plus} onClick={openPlus} />
        <div className="hidden lg:flex items-center justify-center rounded-full text-[0.7rem] font-bold"
             style={{ width: 34, height: 34, color: 'var(--color-canvas)',
                      background: 'linear-gradient(145deg, var(--color-sage), var(--color-sage-strong))' }}>
          {(plan.partnerA.name[0] || 'Y')}{isSingle(plan) ? '' : (plan.partnerB.name[0] || 'P')}
        </div>
      </header>

      {/* The answer — the single most important line, instantly obvious.
          With no money in the plan yet, invite rather than alarm: a zero plan
          is a blank canvas, not a crisis. */}
      <section className="pt-3">
        <p className="text-[0.85rem] font-semibold tracking-wide" style={{ color: 'var(--color-ink-dim)' }}>
          {plan.partnerA.name}{!isSingle(plan) && <> &amp; {plan.partnerB.name}</>}
        </p>
        {hasMoney ? (<>
        <h1 className="mt-1 text-[1.85rem] leading-[1.18] font-extrabold tracking-tight">
          {lasts ? (
            <><span className="tnum" style={{ color: 'var(--color-calm-strong)' }}>{fmt(Math.round(shownSpend / 12))}</span>{' '}
              a month to live on, into your {Math.floor(plan.horizonAge / 10) * 10}s{dd.shortfallAgeA != null && dd.exhaustedAgeA == null ? <>, after a gap around age {dd.shortfallAgeA}</> : null}.</>
          ) : (
            <><span className="tnum">{fmt(Math.round(shownSpend / 12))}</span> a month runs short at{' '}
              <span style={{ color: 'var(--color-hope)' }}>age {dd.exhaustedAgeA}</span>. A little less, or a little longer, holds it.</>
          )}
        </h1>
        <p className="mt-2.5 text-[0.95rem]" style={{ color: 'var(--color-ink-dim)' }}>
          Retiring {new Date(plan.retireYear, 3).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}, at {ageAtRetire}.
          {mc && <> It holds in <b className="tnum" style={{ color: 'var(--color-ink)' }}>{mc.successProb >= 0.975 ? 'over 95%' : 'about ' + Math.round(confAnim / 5) * 5 + '%'}</b> of simulated futures.</>}
        </p>
        </>) : (<>
        <h1 className="mt-1 text-[1.85rem] leading-[1.18] font-extrabold tracking-tight">
          Let&rsquo;s draw your horizon.
        </h1>
        <p className="mt-2.5 text-[0.95rem]" style={{ color: 'var(--color-ink-dim)' }}>
          Add your pensions, ISAs and savings — the picture appears the moment you do, and it never leaves this device.
        </p>
        <button onClick={() => { setDetailsPage(2); setSheet('details'); }}
          className="mt-4 rounded-2xl px-6 py-3.5 font-bold text-[1rem] text-[var(--color-ink)] active:scale-[0.98] transition-transform"
          style={{ background: 'var(--color-calm)' }}>
          Add your numbers
        </button>
        </>)}
      </section>

      {/* Desktop: inputs on the left, the horizon large on the right (mobile keeps
          the vision-first order: horizon, then controls). */}
      <div className="lg:flex lg:gap-10 lg:items-start lg:mt-2">
      <div className="lg:order-2 lg:w-[62%] lg:min-w-0">
      <div className="hidden lg:block mt-4">
        <h2 className="text-[1.1rem] font-bold tracking-tight">Your Horizon</h2>
        <p className="text-[0.78rem] mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>
          Projected wealth in today's money · drag to read a year, tap for detail
        </p>
      </div>
      {hasMoney && <div className="mt-5">
        <Segmented value={homeView} onChange={setHomeView} label="How to see it" options={[
          { value: 'pay', label: 'Payslip' }, { value: 'months', label: 'Months' }, { value: 'chart', label: 'Chart' },
        ]} />
      </div>}

      {hasMoney && homeView === 'pay' && <>
        <Payslip plan={plan} dd={dd} single={isSingle(plan)} />
        <Guardrails plan={plan} />
      </>}

      {hasMoney && homeView === 'months' && <Months plan={plan} dd={dd} />}

      {(!hasMoney || homeView === 'chart') && <>
      <div className="mt-4 lg:mt-2 -mx-1 lg:mx-0">
        <HorizonViz base={viz.base} low={viz.low} high={viz.high}
          startYear={plan.startYear} retireYear={plan.retireYear} horizonYear={horizonYear}
          retireWealth={viz.atRetire} lasts={lasts} dryYear={dd.exhaustedYear}
          inflation={plan.inflation} birthYear={plan.partnerA.birthYear}
          spYear={isSingle(plan) ? plan.partnerA.birthYear + (E as any).spAgeOf(plan.partnerA) : Math.min(plan.partnerA.birthYear + (E as any).spAgeOf(plan.partnerA), plan.partnerB.birthYear + (E as any).spAgeOf(plan.partnerB))}
          pclsTaken={plan.pclsMode !== 'none'}
          onYearTap={setYearSel} />
      </div>

      {/* A quiet key so the shapes are legible — height is your total wealth. */}
      {hasMoney && <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[0.72rem]" style={{ color: 'var(--color-ink-dim)' }}>
        <span className="flex items-center gap-1.5">
          <span style={{ width: 16, height: 3, borderRadius: 2, background: 'var(--color-ocean)', display: 'inline-block' }} /> Typical path
        </span>
        <span className="flex items-center gap-1.5">
          <span style={{ width: 12, height: 10, borderRadius: 3, background: 'var(--color-sage)', opacity: 0.45, display: 'inline-block' }} /> Poor–Positive range
        </span>
        <span className="flex items-center gap-1.5">
          <span style={{ width: 9, height: 9, borderRadius: 9, background: 'var(--color-calm)', display: 'inline-block' }} /> You stop work
        </span>
        {!lasts && <span className="flex items-center gap-1.5">
          <span style={{ width: 9, height: 9, borderRadius: 9, background: 'var(--color-hope)', display: 'inline-block' }} /> Money runs short
        </span>}
        <span style={{ color: 'var(--color-ink-faint)' }}>· height = total wealth · tap any year for detail</span>
      </div>}
      </>}

      <div className="mt-3">
        <Segmented value={lens} onChange={setLens} options={[
          { value: 'bear', label: 'Poor', sub: pct(plan.growthBear, 0) },
          { value: 'base', label: 'Base', sub: pct(plan.growthBase, 0) },
          { value: 'bull', label: 'Positive', sub: pct(plan.growthBull, 0) },
        ]} />
      </div>
      </div>

      <div className="lg:order-1 lg:w-[38%] lg:min-w-0">
      {/* Live "what if" — direct manipulation, immediate feedback (the compact
          mobile card; the desktop brief card above replaces it at lg). */}
      <section className="lg:hidden mt-5 rounded-3xl p-5"
               style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)',
                        boxShadow: '0 1px 2px rgba(60,50,35,0.05), 0 8px 24px rgba(60,50,35,0.06)' }}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[0.72rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-ink-faint)' }}>Adjust your plan</h2>
          <span className="text-[0.7rem]" style={{ color: 'var(--color-ink-faint)' }}>saves as you go</span>
        </div>
        <WhatIf label="Retire in" out={`${plan.retireYear} · age ${ageAtRetire}`} onEdit={setEditing}
          min={plan.startYear + 1} max={plan.startYear + 25} step={1} value={plan.retireYear}
          onChange={v => update({ retireYear: v })} />
        <WhatIf label="Spend each year" out={fmt(spendToday)} onEdit={setEditing}
          min={20000} max={120000} step={1000} value={plan.targetNet}
          onChange={v => update({ targetNet: v, spendingPlanOn: false })} />
        <WhatIf label={`${plan.partnerA.name} saves monthly`} out={fmt(plan.partnerA.monthlyPension)} onEdit={setEditing}
          min={0} max={5000} step={50} value={plan.partnerA.monthlyPension}
          onChange={v => update((p: any) => ({ ...p, partnerA: { ...p.partnerA, monthlyPension: v } }))} />
        <div className="mt-5">
          <span className="block text-[0.8rem] font-semibold mb-2" style={{ color: 'var(--color-ink-dim)' }}>Spending Style</span>
          <Segmented small value={spendStyle} onChange={setSpendStyle} options={[
            { value: 'gogo', label: 'Go-go', sub: 'eases at 75 & 82' },
            { value: 'slowgo', label: 'Slow-go', sub: 'eases from 75' },
            { value: 'nogo', label: 'No-go', sub: 'flat throughout' },
          ]} />
        </div>
        {mc && hasMoney && (
          <div className="mt-4 rounded-2xl px-4 py-3.5 flex items-center gap-4"
               style={{ background: 'color-mix(in srgb, var(--color-sage) 16%, var(--color-surface))' }}>
            <span className="tnum text-[1.7rem] font-extrabold tracking-tight" style={{ color: 'var(--color-sage-strong)' }}>{confText(mc).main}</span>
            <span>
              <span className="block text-[0.82rem] font-semibold leading-snug">of simulated futures pay the full plan</span>
              <span className="block text-[0.7rem] mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>{mc.nPaths.toLocaleString()} simulated futures · {confText(mc).range} at this sample size</span>
            </span>
          </div>
        )}
      </section>

      {/* Desktop: the full inputs card from the design brief. */}
      <section className="hidden lg:block mt-4 rounded-2xl p-6"
               style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)',
                        boxShadow: '0 1px 2px rgba(60,50,35,0.05), 0 8px 24px rgba(60,50,35,0.06)' }}>
        <h2 className="text-[1.1rem] font-bold tracking-tight mb-4">Your Horizon Inputs</h2>
        <WhatIf label="Current Age" out={`${ageNow}`} onEdit={setEditing}
          min={30} max={70} step={1} value={ageNow}
          onChange={v => update((p: any) => ({ ...p, partnerA: { ...p.partnerA, birthYear: p.startYear - v } }))} />
        <WhatIf label="Target Annual Net Income (£)" out={fmt(spendToday)} onEdit={setEditing}
          min={20000} max={120000} step={500} value={plan.targetNet}
          onChange={v => update({ targetNet: v, spendingPlanOn: false })} />
        <div className="mt-5 space-y-3">
          <MoneyField label="Current Pension Pot (£)" value={plan.partnerA.pension}
            onChange={v => update((p: any) => ({ ...p, partnerA: { ...p.partnerA, pension: v } }))} />
          <MoneyField label="Annual Contributions (£)" value={Math.round(plan.partnerA.monthlyPension * 12)}
            onChange={v => update((p: any) => ({ ...p, partnerA: { ...p.partnerA, monthlyPension: v / 12 } }))} />
          <NumField label="Desired Retirement Age" value={ageAtRetire}
            onChange={v => update((p: any) => ({ ...p, retireYear: p.partnerA.birthYear + v }))} />
        </div>
        <div className="mt-5">
          <span className="block text-[0.8rem] font-semibold mb-2" style={{ color: 'var(--color-ink-dim)' }}>Spending Style</span>
          <Segmented small value={spendStyle} onChange={setSpendStyle} options={[
            { value: 'gogo', label: 'Go-go', sub: 'more early, eases at 75 & 82' },
            { value: 'slowgo', label: 'Slow-go', sub: 'eases from 75' },
            { value: 'nogo', label: 'No-go', sub: 'flat throughout' },
          ]} />
        </div>
        {mc && hasMoney && (
          <div className="mt-5 rounded-2xl px-5 py-4 flex items-center gap-4"
               style={{ background: 'color-mix(in srgb, var(--color-sage) 16%, var(--color-surface))' }}>
            <span className="tnum text-[2rem] font-extrabold tracking-tight" style={{ color: 'var(--color-sage-strong)' }}>{confText(mc).main}</span>
            <span>
              <span className="block text-[0.85rem] font-semibold leading-snug">of simulated futures pay the full plan</span>
              <span className="block text-[0.72rem] mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>{mc.nPaths.toLocaleString()} simulated futures · {confText(mc).range} at this sample size</span>
            </span>
          </div>
        )}
        <p className="mt-3 text-[0.7rem] text-right" style={{ color: 'var(--color-ink-faint)' }}>
          {plan.partnerA.name}'s figures · {isSingle(plan) ? 'more' : plan.partnerB.name + "'s and more"} in Details · saves as you go
        </p>
      </section>

      {/* The Coach — quiet, grounded nudges computed from your own numbers. */}
      {coach.length > 0 && (
        <section className="mt-4 rounded-3xl p-5"
                 style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)',
                          boxShadow: '0 1px 2px rgba(60,50,35,0.05), 0 8px 24px rgba(60,50,35,0.06)' }}>
          <div className="flex items-center gap-2">
            <Lightbulb size={15} style={{ color: 'var(--color-hope)' }} />
            <h2 className="text-[0.72rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-ink-faint)' }}>Worth a thought</h2>
          </div>
          <div className="mt-1">
            {coach.map((c, i) => (
              <div key={i} className="py-2.5" style={{ borderTop: i ? '1px solid var(--color-hairline)' : 'none' }}>
                {(plus || i === 0) ? (<>
                  <div className="text-[0.92rem] font-semibold">{c.t}</div>
                  <div className="mt-0.5 text-[0.84rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{c.b}</div>
                </>) : (
                  // Free: the first thought in full; the rest named, not hidden.
                  <button onClick={openPlus} className="w-full text-left flex items-start gap-2">
                    <span className="text-[0.92rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>{c.t}</span>
                    <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[0.64rem] font-bold uppercase tracking-wider"
                      style={{ background: 'color-mix(in srgb, var(--color-calm) 18%, transparent)', color: 'var(--color-calm-strong)' }}>Plus</span>
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-1 text-[0.72rem]" style={{ color: 'var(--color-ink-faint)' }}>
            Computed from your own figures, on this device. Prompts to explore — not advice.
            {!plus && coach.length > 1 && ' The first is free; Plus opens the rest.'}
          </p>
        </section>
      )}
      </div>
      </div>

      {/* Desktop: three calm metrics along the bottom (per the design brief). */}
      {hasMoney && <div className="flex flex-col lg:flex-row gap-3 lg:gap-8 mt-6 lg:mt-8">
        <DeskStat value={lasts ? `age ${plan.horizonAge}+` : `age ${dd.exhaustedAgeA}`} label="Sustainable to"
          desc={lasts ? (dd.shortfallAgeA != null ? `Holds to the horizon on the central path, with a funding gap around age ${dd.shortfallAgeA} (see Explore).` : 'Your income holds through your plan horizon on the central path. A projection, not a promise.') : 'Where the pots run short on today’s settings — see what moves the needle in Explore.'}
          color={lasts ? 'var(--color-ocean)' : 'var(--color-hope)'} />
        {estate && <DeskStat value={fmtK(deflate(estate.netToHeirs, estate.year, plan.startYear, plan.inflation))} label="Potential legacy"
          desc="What could pass to the people you love, in today’s money." color="var(--color-sage-strong)" />}
        {bufferYears != null && <DeskStat value={`${bufferYears} years`} label="Years of Buffer"
          desc={`Spare room beyond age ${plan.horizonAge} if you live longer than planned.`} color="var(--color-calm-strong)" />}
      </div>}

      <p className="mt-4 text-center text-[0.8rem]" style={{ color: 'var(--color-ink-faint)' }}>
        One possible future, not a promise. Your figures never leave this device.
      </p>

      <nav className="fixed bottom-0 left-0 right-0 z-40"
           style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.3rem)', paddingTop: '0.5rem',
                    background: 'color-mix(in srgb, var(--color-canvas) 82%, transparent)',
                    backdropFilter: 'saturate(180%) blur(22px)', WebkitBackdropFilter: 'saturate(180%) blur(22px)',
                    borderTop: '0.5px solid var(--color-hairline)' }}>
        <div className="flex justify-around mx-auto max-w-[560px]">
          <TabButton icon={<Sunrise size={24} />} label="Horizon" active={sheet === null} onClick={() => setSheet(null)} />
          <TabButton icon={<SlidersHorizontal size={24} />} label="Details" active={sheet === 'details'} onClick={() => setSheet('details')} />
          <TabButton icon={<Compass size={24} />} label="Explore" active={sheet === 'explore'} onClick={() => setSheet('explore')} />
          <TabButton icon={<ShieldCheck size={24} />} label="Peace" active={sheet === 'peace'} onClick={() => setSheet('peace')} />
        </div>
      </nav>

      <Sheet open={sheet === 'details'} onClose={() => setSheet(null)} title="Your details">
        <DetailsBody plan={plan} update={update} reset={resetAll} plus={plus} onUpgrade={openPlus} issues={S.issues}
          index={detailsPage} onIndex={setDetailsPage} />
      </Sheet>
      <Sheet open={sheet === 'explore'} onClose={() => setSheet(null)} title="Explore">
        <ExploreBody plan={planL} dd={dd} estate={estate} mc={mc} plus={plus} onUpgrade={openPlus} update={update} />
      </Sheet>
      <Sheet open={sheet === 'peace'} onClose={() => setSheet(null)} title="Peace of mind">
        <PeaceBody plus={plus} onUpgrade={openPlus} plan={plan} mc={mc} />
      </Sheet>
      <Sheet open={sheet === 'plus'} onClose={() => setSheet(null)} title={PRODUCT.plusName}>
        <PlusSheetBody />
      </Sheet>
      <Sheet open={yearSel != null} onClose={() => setYearSel(null)}
             title={yearSel != null ? `${yearSel} · a closer look` : undefined}>
        {yearSel != null && <YearDetail plan={plan} acc={acc} dd={dd} year={yearSel} />}
      </Sheet>

      {/* Print-only report — a fuller, adviser-ready PDF via the browser's Save as PDF. Plus. */}
      {plus && <PrintReport plan={plan} acc={acc} dd={dd} mc={mc} estate={estate} />}
    </div>
  );
}

// Desktop-only bottom metric card (the mobile equivalents live in Explore).
function DeskStat({ value, label, desc, color }: { value: string; label: string; desc: string; color: string }) {
  return (
    <div className="flex-1 rounded-3xl p-6"
         style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)',
                  boxShadow: '0 1px 2px rgba(60,50,35,0.05), 0 8px 24px rgba(60,50,35,0.06)' }}>
      <div className="tnum text-[1.7rem] font-extrabold tracking-tight" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-[0.85rem] font-semibold">{label}</div>
      <div className="mt-1 text-[0.76rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>{desc}</div>
    </div>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  // A tiny haptic tick where the platform supports it (progressive enhancement;
  // iOS Safari has no vibration API — the spring animation carries the feel there).
  const tap = () => { try { (navigator as any).vibrate?.(8); } catch { /* no-op */ } onClick(); };
  return (
    <button onClick={tap} className="flex flex-col items-center justify-center gap-1 px-3 py-1 min-h-[44px] min-w-[44px]"
            aria-current={active ? 'page' : undefined}
            style={{ color: active ? 'var(--color-calm-strong)' : 'var(--color-ink-faint)' }}>
      <motion.span animate={{ scale: active ? 1.08 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>{icon}</motion.span>
      <span className="text-[0.62rem] font-semibold">{label}</span>
    </button>
  );
}

function WhatIf({ label, out, min, max, step, value, onChange, onEdit }: {
  label: string; out: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; onEdit?: (b: boolean) => void;
}) {
  return (
    <div className="mt-4 first:mt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[0.9rem] font-medium">{label}</span>
        <span className="tnum text-[0.95rem] font-bold" style={{ color: 'var(--color-calm-strong)' }}>{out}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(Number(e.target.value))}
             onPointerDown={() => onEdit?.(true)}
             onPointerUp={() => onEdit?.(false)}
             onPointerCancel={() => onEdit?.(false)}
             onBlur={() => onEdit?.(false)}
             className="w-full mt-2 dawn-range"
             style={{ height: 28, '--fill': `${((value - min) / Math.max(1, max - min)) * 100}%` } as React.CSSProperties}
             aria-label={label} />
    </div>
  );
}
// Your details — the same carousel used at setup, so the whole form is
// learned once: one idea per page, a rail that names every other page.
function DetailsBody({ plan, update, reset, plus, onUpgrade, issues = [], index, onIndex }: {
  plan: any; update: (p: any) => void; reset: () => void; plus: boolean; onUpgrade: () => void;
  issues?: { path: string; message: string; level: string }[];
  index: number; onIndex: (i: number) => void;
}) {
  // A new page starts at its top, not wherever the last one was scrolled to.
  useEffect(() => { document.querySelector('[data-sheet-scroll]')?.scrollTo({ top: 0 }); }, [index]);
  return (
    <PlanForm plan={plan} update={update} reset={reset} plus={plus} onUpgrade={onUpgrade}
      issues={issues} index={index} onIndex={onIndex} />
  );
}
// One year, up close — the bottom-sheet drill-down behind a tap on the horizon.
function YearDetail({ plan, acc, dd, year }: { plan: any; acc: Accum; dd: Drawdown; year: number }) {
  const D = (v: number) => deflate(v, year, plan.startYear, plan.inflation);
  const ageA = year - plan.partnerA.birthYear, ageB = year - plan.partnerB.birthYear;
  const r = (dd.rows as any[]).find(x => x.year === year);
  const a = (acc.years as any[]).find((x: any) => x.year === year);

  const Line = ({ k, v, tone, strong }: { k: string; v: string; tone?: string; strong?: boolean }) => (
    <div className="flex items-baseline justify-between py-1.5" style={{ borderTop: '1px solid var(--color-hairline)' }}>
      <span className={`text-[0.88rem] ${strong ? 'font-bold' : ''}`} style={{ color: strong ? 'var(--color-ink)' : 'var(--color-ink-dim)' }}>{k}</span>
      <span className={`tnum text-[0.95rem] ${strong ? 'font-extrabold' : 'font-semibold'}`} style={{ color: tone || 'var(--color-ink)' }}>{v}</span>
    </div>
  );
  const Cap = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-[0.7rem] font-bold uppercase tracking-widest mt-4 mb-1" style={{ color: 'var(--color-ink-faint)' }}>{children}</h3>
  );

  if (r) {
    const spend = D(r.target), sp = D(r.spA + r.spB), db = D(r.dbA + r.dbB);
    const gross = D(r.grossA + r.grossB), tfc = D(r.tfcA + r.tfcB), isaDraw = D(r.isaDraw + (r.cashDraw || 0));
    const tax = D(r.tax);
    return (
      <div className="pb-2">
        <p className="text-[0.9rem] -mt-2 mb-1" style={{ color: 'var(--color-ink-dim)' }}>
          {plan.partnerA.name} is {ageA}, {plan.partnerB.name} is {ageB}. All figures in today's money.
        </p>
        <Cap>The year's income</Cap>
        <Line k="Spending target" v={fmt(spend)} strong />
        {sp > 0.5 && <Line k="State Pension" v={fmt(sp)} />}
        {db > 0.5 && <Line k="Defined-benefit pensions" v={fmt(db)} />}
        {gross > 0.5 && <Line k="Pension withdrawals (gross)" v={fmt(gross)} />}
        {tfc > 0.5 && <Line k="Tax-free cash" v={fmt(tfc)} tone="var(--color-hope)" />}
        {isaDraw > 0.5 && <Line k="ISA & cash withdrawals" v={fmt(isaDraw)} />}
        <Line k="Income tax paid" v={`−${fmt(tax)}`} tone="var(--color-hope)" />
        <Line k="Net income delivered" v={fmt(D(r.netIncome))} strong />
        {r.shortfall > 1 && <Line k="Shortfall this year" v={fmt(D(r.shortfall))} tone="var(--color-hope)" strong />}
        {(r.eventLabels || []).length > 0 && <Line k={`Events: ${r.eventLabels.join(', ')}`} v={r.eventCost > 0 ? `−${fmt(D(r.eventCost))}` : `+${fmt(D(r.eventInflow))}`} />}
        <Cap>Left at the end of the year</Cap>
        <Line k={`${plan.partnerA.name}'s pension`} v={fmt(D(r.potA))} />
        <Line k={`${plan.partnerB.name}'s pension`} v={fmt(D(r.potB))} />
        <Line k="ISA & cash pots" v={fmt(D(r.isaA + r.isaB + (r.cash || 0)))} />
        <Line k="Total wealth" v={fmt(D(r.wealth))} strong tone="var(--color-calm-strong)" />
        {r.ladder > 0 && <Line k="…of which the gilt ladder" v={fmt(D(r.ladder))} />}
        {r.engine > 0 && <Line k="…of which the growth engine" v={fmt(D(r.engine))} />}
        {r.fundedRatio != null && <Line k="Funded ratio" v={`${Math.round(r.fundedRatio * 100)}%`}
          tone={r.fundedRatio < 0.9 ? 'var(--color-hope)' : 'var(--color-sage-strong)'} />}
        {r.spendMult != null && Math.abs(r.spendMult - 1) > 0.001 &&
          <Line k="Spending rule in force" v={`×${r.spendMult.toFixed(2)}`} tone="var(--color-hope)" />}
        <p className="mt-3 text-[0.75rem]" style={{ color: 'var(--color-ink-faint)' }}>
          Marginal tax rates this year: {plan.partnerA.name} {pct(r.marginalA)}, {plan.partnerB.name} {pct(r.marginalB)}.
        </p>
      </div>
    );
  }

  // Before retirement: the saving years.
  const pots = a
    ? { pA: a.pensionA, pB: a.pensionB, isa: a.isaA + a.isaB + (a.cash || 0) }
    : { pA: plan.partnerA.pension, pB: plan.partnerB.pension, isa: plan.partnerA.isa + plan.partnerB.isa + (plan.cash || 0) };
  const contrib = (plan.partnerA.monthlyPension + plan.partnerB.monthlyPension + plan.partnerA.monthlyIsa + plan.partnerB.monthlyIsa) * 12;
  return (
    <div className="pb-2">
      <p className="text-[0.9rem] -mt-2 mb-1" style={{ color: 'var(--color-ink-dim)' }}>
        {plan.partnerA.name} is {ageA}, {plan.partnerB.name} is {ageB} — still saving, {plan.retireYear - year} year{plan.retireYear - year === 1 ? '' : 's'} to go. Today's money.
      </p>
      <Cap>Pots this year</Cap>
      <Line k={`${plan.partnerA.name}'s pension`} v={fmt(D(pots.pA))} />
      <Line k={`${plan.partnerB.name}'s pension`} v={fmt(D(pots.pB))} />
      <Line k="ISA & cash pots" v={fmt(D(pots.isa))} />
      <Line k="Total" v={fmt(D(pots.pA + pots.pB + pots.isa))} strong tone="var(--color-calm-strong)" />
      {contrib > 0 && <Line k="Going in this year" v={`+${fmt(contrib)}`} tone="var(--color-calm-strong)" />}
    </div>
  );
}

function StatCard({ label, value, tone = 'calm' }: { label: string; value: string; tone?: 'calm' | 'hope' | 'ink' }) {
  const color = tone === 'hope' ? 'var(--color-hope)' : tone === 'ink' ? 'var(--color-ink)' : 'var(--color-calm-strong)';
  return (
    <div className="rounded-2xl p-4 flex-1" style={{ background: 'var(--color-canvas)' }}>
      <div className="tnum text-[1.5rem] font-extrabold tracking-tight" style={{ color }}>{value}</div>
      <div className="text-[0.78rem] mt-0.5" style={{ color: 'var(--color-ink-dim)' }}>{label}</div>
    </div>
  );
}

// Where the retirement income comes from, over the whole plan (tax story).
function fundingMix(dd: Drawdown) {
  let sp = 0, db = 0, pen = 0, tfc = 0, isa = 0;
  for (const r of dd.rows as any[]) {
    sp += (r.spA || 0) + (r.spB || 0);
    db += (r.dbA || 0) + (r.dbB || 0);
    pen += Math.max(0, (r.grossA || 0) + (r.grossB || 0) - (r.taxA || 0) - (r.taxB || 0));
    tfc += (r.tfcA || 0) + (r.tfcB || 0);
    isa += (r.isaDraw || 0) + (r.cashDraw || 0);
  }
  const total = Math.max(1, sp + db + pen + tfc + isa);
  return [
    ['State Pension', sp, 'var(--color-ocean)'],
    ['Defined-benefit pension', db, 'var(--color-sage-strong)'],
    ['Pension draws (after tax)', pen, 'var(--color-calm-strong)'],
    ['Tax-free cash', tfc, 'var(--color-calm)'],
    ['ISAs & cash', isa, 'var(--color-sage)'],
  ].filter(s => (s[1] as number) / total > 0.005).map(([n, v, c]) => ({ n, pct: (v as number) / total, c })) as { n: string; pct: number; c: string }[];
}

// Monte-Carlo percentile fan — the range of futures, calm blues.
function McFan({ mc, retireYear }: { mc: MC; retireYear: number }) {
  const g = useMemo(() => {
    const tracks = mc.tracks || [];
    if (!tracks.length) return null;
    const n = Math.max(...tracks.map(t => t.length));
    const pctl = (arr: number[], q: number) => { const s = arr.filter(v => v != null).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.round(q * (s.length - 1)))] : 0; };
    const lo: [number, number][] = [], mid: [number, number][] = [], hi: [number, number][] = [];
    for (let i = 0; i < n; i++) { const col = tracks.map(t => t[i]); lo.push([i, pctl(col, 0.1)]); mid.push([i, pctl(col, 0.5)]); hi.push([i, pctl(col, 0.9)]); }
    let max = 1; for (const [, v] of hi) if (v > max) max = v;
    const W = 380, H = 120, pad = 4;
    const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (W - 2 * pad);
    const y = (v: number) => H - pad - (Math.max(0, v) / max) * (H - 2 * pad);
    const line = (s: [number, number][]) => s.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ');
    const area = line(hi) + ' L ' + [...lo].reverse().map(p => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' L ') + ' Z';
    return { area, mid: line(mid), W, H };
  }, [mc]);
  if (!g) return null;
  return (
    <svg viewBox={`0 0 ${g.W} ${g.H}`} width="100%" style={{ display: 'block' }} aria-label="Range of possible futures">
      <defs><linearGradient id="mcband" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--color-sage)" stopOpacity="0.30" /><stop offset="1" stopColor="var(--color-sage)" stopOpacity="0.03" />
      </linearGradient></defs>
      <path d={g.area} fill="url(#mcband)" />
      <path d={g.mid} fill="none" stroke="var(--color-ocean)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function ExploreBody({ plan, dd, estate, mc, plus, onUpgrade, update }: { plan: any; dd: Drawdown; estate: any; mc: MC | null; plus: boolean; onUpgrade: () => void; update: (p: any) => void }) {
  const today = (v: number, year: number) => deflate(v, year, plan.startYear, plan.inflation);
  const lifeTax = (dd as any).lifetimeTaxReal ?? dd.lifetimeTax;
  const mix = fundingMix(dd);
  const horizonYear = (E as any).planEndYear(plan);
  const nowP10 = mc ? deflate(mc.finalP10, horizonYear, plan.startYear, plan.inflation) : 0;
  const nowP50 = mc ? deflate(mc.finalP50, horizonYear, plan.startYear, plan.inflation) : 0;
  const nowP90 = mc ? deflate(mc.finalP90, horizonYear, plan.startYear, plan.inflation) : 0;

  // Does the structure earn its keep? Measured, never asserted. Only run
  // when the overlay is on — it is four full projections plus Monte Carlo.
  const archCmp = useMemo(() => {
    if (!plus || !plan.architecture?.on) return null;
    try { return (E as any).compareArchitecture(plan, 250); } catch { return null; }
  }, [plan, plus]);

  // The verdict, judged on the spending actually delivered rather than on
  // survival — a rule that trims spending must not score as a success for
  // cutting what you live on.
  const worthIt = useMemo(() => {
    if (!plus || !plan.architecture?.on) return null;
    try { return (E as any).assessStructure(plan, { paths: 400 }); } catch { return null; }
  }, [plan, plus]);

  // Withdrawal-order tax comparison (the same three strategies, one engine).
  const strat = useMemo(() => {
    try { return (E as any).compareStrategies(plan) as { id: string; label: string; lifetimeTax: number; endWealth: number; exhaustedAgeA: number | null }[]; }
    catch { return []; }
  }, [plan]);
  const bestTax = strat.length ? Math.min(...strat.map(s => s.lifetimeTax)) : 0;

  // Rich year-by-year: opening → drawn → growth → tax → closing, per person or combined.
  const [tv, setTv] = useState<'A' | 'B' | 'combined'>('combined');
  const sp: any = (dd as any).startPots || {};
  const rows = dd.rows as any[];
  const table = rows.map((r, i) => {
    const prev = rows[i - 1];
    const D = (v: number) => today(v, r.year);
    if (tv === 'combined') {
      const start = i === 0 ? (sp.pensionA + sp.pensionB + sp.isaA + sp.isaB + (sp.cash || 0)) : prev.wealth;
      const drawn = r.grossA + r.grossB + r.tfcA + r.tfcB + r.isaDraw + r.cashDraw;
      const closing = r.wealth;
      return { year: r.year, age: `${r.ageA}/${r.ageB}`, start: D(start), drawn: D(drawn), ret: D(closing - (start - drawn)), tax: D(r.tax), closing: D(closing) };
    }
    const A = tv === 'A';
    const start = i === 0 ? ((A ? sp.pensionA : sp.pensionB) + (A ? sp.isaA : sp.isaB))
      : ((A ? prev.potA : prev.potB) + (A ? prev.isaA : prev.isaB));
    const drawn = (A ? r.grossA : r.grossB) + (A ? r.tfcA : r.tfcB) + (A ? r.isaDrawA : r.isaDrawB);
    const closing = (A ? r.potA : r.potB) + (A ? r.isaA : r.isaB);
    return { year: r.year, age: A ? r.ageA : r.ageB, start: D(start), drawn: D(drawn), ret: D(closing - (start - drawn)), tax: D(A ? r.taxA : r.taxB), closing: D(closing) };
  });

  const jump = (id: string) => { const el = document.getElementById('explore-' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return (
    <div className="space-y-5 pb-2">
      <div className="sticky top-0 z-10 -mx-6 px-6 pb-2" style={{ background: 'var(--color-surface)' }}>
        <nav aria-label="Explore sections" className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[['map', 'Map'], ['futures', 'Futures'], ['levers', 'Levers'], ['dates', 'Dates'], ['stress', 'Stress'], ['tax', 'Tax'], ['table', 'Year by year']].map(([id, l]) => (
            <button key={id} onClick={() => jump(id)} className="shrink-0 rounded-full px-3 min-h-[36px] text-[0.75rem] font-semibold"
              style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', color: 'var(--color-ink-dim)' }}>{l}</button>
          ))}
        </nav>
      </div>
      {/* ── Every retirement you could choose ────────────────────── */}
      <DecisionMap plan={plan} update={update} />
      {/* ── Monte Carlo ─────────────────────────────────────────── */}
      {mc && (
        <div id="explore-futures" className="rounded-2xl p-4" style={{ background: 'var(--color-canvas)' }}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[0.9rem] font-semibold">Monte Carlo · range of futures</span>
            <span className="tnum text-[0.9rem] font-bold" style={{ color: 'var(--color-calm-strong)' }}>{confText(mc).main} hold</span>
          </div>
          <McFan mc={mc} retireYear={plan.retireYear} />
          <p className="text-[0.72rem] mt-1 mb-3" style={{ color: 'var(--color-ink-faint)' }}>
            {mc.nPaths} random market histories · lucky to unlucky. Typical line in the middle.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Unlucky', nowP10, '10th'], ['Typical', nowP50, '50th'], ['Lucky', nowP90, '90th']].map(([l, v, p]) => (
              <div key={l as string} className="rounded-xl py-2" style={{ background: 'var(--color-surface)' }}>
                <div className="tnum text-[1.05rem] font-extrabold" style={{ color: 'var(--color-calm-strong)' }}>{fmtK(v as number)}</div>
                <div className="text-[0.68rem]" style={{ color: 'var(--color-ink-faint)' }}>{l} · {p} pctile</div>
              </div>
            ))}
          </div>
          <p className="text-[0.72rem] mt-2 text-center" style={{ color: 'var(--color-ink-dim)' }}>
            Wealth left at {plan.horizonAge} (today's money). Confidence stays above {pct(mc.threshold ?? 0.85, 0)} until age <b className="tnum">{mc.confidenceAge}</b>.
            {' '}Sampling range {confText(mc).range}. Weighted by how long you are likely to be here, the money outlives you in about <b className="tnum">{Math.round(mc.successLifetime * 100)}%</b> of futures.
            {mc.successProbWithCuts > mc.successProb + 0.005 && <> With the written rules trimming spending, {Math.round(mc.successProbWithCuts * 100)}% stay solvent.</>}
          </p>
        </div>
      )}

      {/* ── What moves the needle: the levers, ranked (decision support) ── */}
      <div id="explore-levers"><Levers plan={plan} plus={plus} onUpgrade={onUpgrade} /></div>

      {/* ── Dates that matter (free: personal from the first screen) ── */}
      <div id="explore-dates"><Dates plan={plan} /></div>

      {/* ── Income mix ──────────────────────────────────────────── */}
      <div>
        <h3 className="text-[0.72rem] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-ink-faint)' }}>Where your income comes from</h3>
        <div className="flex rounded-full overflow-hidden h-3.5">
          {mix.map(s => <span key={s.n} style={{ flex: s.pct, background: s.c }} />)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {mix.map(s => (
            <span key={s.n} className="flex items-center gap-1.5 text-[0.76rem]" style={{ color: 'var(--color-ink-dim)' }}>
              <i style={{ width: 9, height: 9, borderRadius: 3, background: s.c, display: 'inline-block' }} />
              {s.n} <b className="tnum" style={{ color: 'var(--color-ink)' }}>{Math.round(s.pct * 100)}%</b>
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <StatCard label="Lifetime income tax (today's money)" value={fmtK(lifeTax)} tone="ink" />
        <StatCard label={dd.exhaustedAgeA == null ? ((dd as any).shortfallAgeA != null ? 'Funding gap around' : 'Money lasts') : 'Runs short at'} value={dd.exhaustedAgeA == null ? ((dd as any).shortfallAgeA != null ? `age ${(dd as any).shortfallAgeA}` : `${plan.horizonAge}+`) : `age ${dd.exhaustedAgeA}`} tone={dd.exhaustedAgeA == null && (dd as any).shortfallAgeA == null ? 'calm' : 'hope'} />
      </div>
      {estate && (plus ? (
        <div className="flex gap-3">
          <StatCard label="Left to your family" value={fmtK(today(estate.netToHeirs, estate.year))} tone="calm" />
          <StatCard label={estate.iht > 0 ? 'Inheritance tax — often reducible' : 'Inheritance tax'} value={fmtK(today(estate.iht, estate.year))} tone="ink" />
        </div>
      ) : (
        <Locked compact title="The estate picture" onUpgrade={onUpgrade}
          line="What could pass to your family, and the inheritance-tax exposure — including pensions coming into scope from April 2027." />
      ))}
      {!plus && plan.architecture?.on && (
        <Locked compact title="Is the structure worth it?" onUpgrade={onUpgrade}
          line="Your de-risking structure, judged on the spending it actually delivers against a plain plan, through the same simulated markets — and how it fares if the bad decade starts the day you stop." />
      )}

      {worthIt && (() => {
        const w = worthIt;
        const title = w.verdict === 'clear' ? 'Yes — clearly'
          : w.verdict === 'modest' ? 'Yes, modestly'
          : w.verdict === 'marginal' ? 'It is a close call'
          : 'Not on these numbers';
        const tone = w.verdict === 'against' ? 'var(--color-hope)' : 'var(--color-sage-strong)';
        // Each line is coloured by whether the structure is actually better on
        // that measure — never by the headline verdict, or a row that goes the
        // other way would be dressed up as a win.
        const Cmp = ({ k, a, b, note, better }: { k: string; a: string; b: string; note?: string; better?: number }) => (
          <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-hairline)' }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.85rem] font-semibold">{k}</span>
              <span className="text-right">
                <span className="tnum block text-[0.95rem] font-bold"
                      style={{ color: better == null || Math.abs(better) < 1e-9 ? 'var(--color-ink)'
                        : better > 0 ? 'var(--color-sage-strong)' : 'var(--color-hope)' }}>{a}</span>
                <span className="tnum block text-[0.72rem]" style={{ color: 'var(--color-ink-faint)' }}>without it {b}</span>
              </span>
            </div>
            {note && <p className="mt-1 text-[0.72rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>{note}</p>}
          </div>
        );
        return (
          <div>
            <h3 className="text-[0.72rem] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-ink-faint)' }}>Is the structure worth it?</h3>
            <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
              <div className="px-4 pt-4 pb-3">
                <div className="text-[1.3rem] font-extrabold tracking-tight" style={{ color: tone }}>{title}</div>
                <p className="mt-1 text-[0.84rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
                  Judged on the spending it actually delivers — a year the rules trim counts as spending less, exactly
                  like a year the pots cannot fund. On that basis the structure is worth about{' '}
                  <b style={{ color: tone }}>{fmt(Math.abs(Math.round(w.ceGain)))} a year</b>{' '}
                  {w.ceGain >= 0 ? 'more' : 'less'} dependable spending, for life.
                </p>
              </div>
              <Cmp k="Dependable spending, every year"
                a={fmt(Math.round(w.on.ceSpend))} b={fmt(Math.round(w.off.ceSpend))} better={w.on.ceSpend - w.off.ceSpend}
                note={`The guaranteed amount that would leave you equally well off once the bad futures are counted alongside the good (risk aversion ${w.riskAversion}).`} />
              <Cmp k="Spending in the worst 1-in-10 futures"
                a={fmt(Math.round(w.on.spendP10))} b={fmt(Math.round(w.off.spendP10))}
                better={w.on.spendP10 - w.off.spendP10}
                note={Math.abs(w.on.spendP10 - w.off.spendP10) / Math.max(1, w.off.spendP10) < 0.02
                  ? 'Close to a tie on this measure — the difference shows up in how often, and how early, the lean years arrive.' : undefined} />
              <Cmp k="Leanest year, typical future"
                a={`${Math.round(w.on.worstYearRatioP50 * 100)}% of plan`}
                b={`${Math.round(w.off.worstYearRatioP50 * 100)}% of plan`}
                better={w.on.worstYearRatioP50 - w.off.worstYearRatioP50}
                note="A structured plan trims early and by choice; an unstructured one holds full spending until it cannot." />
              <Cmp k="Legacy left, typical future"
                a={fmtK(w.on.legacyP50Real)} b={fmtK(w.off.legacyP50Real)} better={w.legacyDelta}
                note={w.legacyDelta < 0
                  ? `This is the price: about ${fmtK(Math.abs(w.legacyDelta))} less passed on in the middle outcome. Dependable spending is bought with growth given up.`
                  : undefined} />
            </div>
            <div className="mt-3 rounded-3xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
              <div className="px-4 pt-3 pb-1 text-[0.72rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-ink-faint)' }}>What is doing the work</div>
              {w.drivers.map((d: any) => (
                <div key={d.key} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                  <span className="text-[0.85rem]">{d.label}</span>
                  <span className="tnum text-[0.9rem] font-bold" style={{ color: d.worth > 0 ? 'var(--color-sage-strong)' : 'var(--color-ink-faint)' }}>
                    {d.worth > 0 ? '+' : ''}{fmt(Math.round(d.worth))}/yr
                  </span>
                </div>
              ))}
              <p className="px-4 pb-3 text-[0.72rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
                Each figure is what you give up by removing that piece and leaving the rest in place, so they overlap
                rather than add up. Both plans are run through the same {w.paths} simulated markets.
              </p>
            </div>
          </div>
        );
      })()}

      {archCmp && (() => {
        return (
          <div>
            <h3 className="mt-5 text-[0.72rem] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-ink-faint)' }}>If the bad decade starts the day you stop</h3>
            <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid var(--color-hairline)' }}>
              {archCmp.stress.map((t: any, i: number) => (
                <div key={t.key} className="px-4 py-3" style={{ background: 'var(--color-surface)', borderTop: i ? '1px solid var(--color-hairline)' : 'none' }}>
                  <div className="text-[0.88rem] font-semibold">{t.label}</div>
                  <div className="mt-1 flex items-baseline justify-between gap-3 text-[0.8rem]">
                    <span style={{ color: 'var(--color-ink-dim)' }}>With your structure</span>
                    <span className="tnum font-semibold" style={{ color: 'var(--color-sage-strong)' }}>
                      {t.withArch.exhaustedAgeA ? `runs short at ${t.withArch.exhaustedAgeA}` : `holds · ${fmtK(t.withArch.endReal)} left`}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-[0.8rem]">
                    <span style={{ color: 'var(--color-ink-dim)' }}>Without it</span>
                    <span className="tnum font-semibold" style={{ color: 'var(--color-hope)' }}>
                      {t.without.exhaustedAgeA ? `runs short at ${t.without.exhaustedAgeA}` : `holds · ${fmtK(t.without.endReal)} left`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[0.75rem]" style={{ color: 'var(--color-ink-faint)' }}>
              Approximate historic real-return sequences replayed through your growth engine from the year you stop work
              — illustrative shapes of a bad decade, not precise history.
            </p>
          </div>
        );
      })()}

      {/* ── Stress tests: sequence risk made concrete, for every plan ── */}
      <div id="explore-stress"><StressTests plan={plan} plus={plus} onUpgrade={onUpgrade} /></div>

      {/* ── Public-sector pensions: when to take each tranche (Plus) ── */}
      <DbTiming plan={plan} plus={plus} onUpgrade={onUpgrade} />

      {/* ── Tax: which order to draw from ───────────────────────── */}
      {strat.length > 0 && !plus && (
        <Locked compact title="Withdrawal order & tax" onUpgrade={onUpgrade}
          line="Lifetime income tax under each of the three withdrawal orders, side by side, so the cheapest route is a fact rather than a guess." />
      )}
      {strat.length > 0 && plus && (
        <div id="explore-tax">
          <h3 className="text-[0.72rem] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-ink-faint)' }}>Withdrawal order & lifetime tax (today's money)</h3>
          <div className="space-y-2">
            {strat.map(s => {
              const active = s.id === plan.strategy, best = Math.abs(s.lifetimeTax - bestTax) < 1;
              return (
                <div key={s.id} className="flex items-center justify-between rounded-2xl px-4 py-3"
                     style={{ background: 'var(--color-canvas)', border: '1px solid ' + (active ? 'var(--color-calm)' : 'transparent') }}>
                  <div className="pr-3">
                    <div className="text-[0.86rem] font-semibold">{s.label}</div>
                    <div className="text-[0.72rem]" style={{ color: 'var(--color-ink-faint)' }}>
                      {active ? 'Your current choice' : 'Alternative'}{best ? ' · lowest lifetime tax' : ''}
                    </div>
                  </div>
                  <div className="tnum font-bold text-right" style={{ color: best ? 'var(--color-calm-strong)' : 'var(--color-ink)' }}>{fmtK(s.lifetimeTax)}</div>
                </div>
              );
            })}
          </div>
          <p className="text-[0.72rem] mt-1.5" style={{ color: 'var(--color-ink-faint)' }}>Lifetime income tax across the whole plan. Change the order in Details → Plan.</p>
        </div>
      )}

      {/* ── Year by year ────────────────────────────────────────── */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-[0.72rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-ink-faint)' }}>Year by year</h3>
        </div>
        {!plus ? (
          <Locked title="Every year, in full" onUpgrade={onUpgrade}
            line={`${table.length} years of retirement, opening to closing, per person or combined, with the tax paid each year.`}
            preview={<YearTable rows={table.slice(0, 4)} />} />
        ) : (<>
        <Segmented small value={tv} onChange={setTv} options={[
          { value: 'combined', label: 'Combined' },
          { value: 'A', label: plan.partnerA.name },
          ...(isSingle(plan) ? [] : [{ value: 'B' as const, label: plan.partnerB.name }]),
        ]} />
        <div id="explore-table"><YearTable rows={table} /></div>
        <p className="text-[0.72rem] mt-1.5" style={{ color: 'var(--color-ink-faint)' }}>
          Today's money. Start − Drawn + Return = Closing. {tv === 'combined' ? 'Both pots and ISAs together.' : `${tv === 'A' ? plan.partnerA.name : plan.partnerB.name}'s pension and ISA only — State Pension and DB income sit outside the pot.`}
        </p>
        </>)}
      </div>
    </div>
  );
}

// Decision support: every candidate action run through the plan and the
// seeded Monte Carlo, ranked by the confidence it buys. Free: the single best
// lever, in full. Plus: the whole list.
function Levers({ plan, plus, onUpgrade }: { plan: any; plus: boolean; onUpgrade: () => void }) {
  // Same 500 futures and seed as the confidence figure, so the base here is
  // the number the person has already seen. Computed after the sheet has
  // opened, so the eight simulations never block the animation.
  const [res, setRes] = useState<any>(null);
  useEffect(() => {
    let live = true;
    const id = setTimeout(() => { try { const r = (E as any).levers(plan, { paths: 500 }); if (live) setRes(r); } catch { if (live) setRes(null); } }, 60);
    return () => { live = false; clearTimeout(id); };
  }, [plan]);
  if (!res) {
    return (
      <div>
        <h3 className="text-[0.72rem] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-ink-faint)' }}>What moves the needle</h3>
        <div className="rounded-3xl px-4 py-5 text-[0.84rem]" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)', color: 'var(--color-ink-dim)' }}>
          Measuring each lever across the same simulated futures…
        </div>
      </div>
    );
  }
  if (!res.levers.length) return null;
  const top = res.levers[0];
  const pp = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d * 100))} pts`;
  const Row = ({ l, i }: { l: any; i: number }) => (
    <div className="px-4 py-3" style={{ borderTop: i ? '1px solid var(--color-hairline)' : 'none' }}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[0.9rem] font-semibold">{l.label}</div>
        <div className="tnum text-right shrink-0">
          <span className="block text-[0.95rem] font-extrabold" style={{ color: l.dConf > 0.004 ? 'var(--color-sage-strong)' : l.dConf < -0.004 ? 'var(--color-hope)' : 'var(--color-ink-dim)' }}>{pp(l.dConf)}</span>
          <span className="block text-[0.7rem]" style={{ color: 'var(--color-ink-faint)' }}>{l.dEnd >= 0 ? '+' : '−'}{fmtK(Math.abs(l.dEnd))} left at {plan.horizonAge}{Math.abs(l.dTax || 0) >= 1000 ? ` · ${l.dTax < 0 ? '−' : '+'}${fmtK(Math.abs(l.dTax))} tax` : ''}</span>
        </div>
      </div>
      <div className="mt-0.5 text-[0.78rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{l.detail}</div>
      {/* The bar: confidence gain, so the eye ranks before the mind reads. */}
      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-hairline)' }}>
        <div style={{ width: `${Math.min(100, Math.max(2, (Math.max(0, l.dConf) / Math.max(0.01, res.levers[0].dConf)) * 100))}%`, height: '100%', background: l.dConf > 0 ? 'var(--color-sage)' : 'transparent' }} />
      </div>
    </div>
  );
  return (
    <div>
      <h3 className="text-[0.72rem] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-ink-faint)' }}>What moves the needle</h3>
      <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
        <div className="px-4 pt-3 pb-1 text-[0.8rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          Today the plan holds in about <b className="tnum" style={{ color: 'var(--color-ink)' }}>{Math.round((res.base.conf || 0) * 20) * 5}%</b> of simulated futures.
          Each action below is run through the whole plan and the same {res.paths} futures; the first figure is how many more points of confidence it buys, give or take two.
        </div>
        <Row l={top} i={0} />
        {plus
          ? res.levers.slice(1).map((l: any, i: number) => <Row key={l.id} l={l} i={i + 1} />)
          : (res.levers.length > 1 && (
            <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-hairline)' }}>
              <button onClick={onUpgrade} className="w-full text-left flex items-start gap-2">
                <span className="text-[0.84rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
                  {res.levers.length - 1} more {res.levers.length === 2 ? 'lever' : 'levers'} measured — {res.levers.slice(1).filter((l: any) => !/^(npa:|order)/.test(l.id)).slice(0, 3).map((l: any) => l.label.toLowerCase()).join(', ')}{res.levers.length > 4 ? '…' : ''}.
                </span>
                <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[0.64rem] font-bold uppercase tracking-wider"
                  style={{ background: 'color-mix(in srgb, var(--color-calm) 18%, transparent)', color: 'var(--color-calm-strong)' }}>Plus</span>
              </button>
            </div>
          ))}
      </div>
      <p className="text-[0.72rem] mt-1.5 leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
        Each lever is measured on the same simulated futures, with about two points of sampling noise either way; the tax figure is from the central plan. Prompts to explore with an adviser — not advice.
      </p>
    </div>
  );
}

// Sequence-of-returns risk made concrete for every plan: named bad decades
// replayed from the day work stops, plus the plain shocks. Free: the headline.
// Plus: the full table.
function StressTests({ plan, plus, onUpgrade }: { plan: any; plus: boolean; onUpgrade: () => void }) {
  const st = useMemo(() => { try { return (E as any).stressTests(plan); } catch { return null; } }, [plan]);
  if (!st) return null;
  const s = st.summary;
  const gfc = st.tests.find((t: any) => /2008/.test(t.label));
  const headline = s.fails === 0
    ? `Holds in all ${s.total} stress tests — including 2008 striking the day you stop.`
    : `Holds in ${s.holds} of ${s.total} stress tests. ${gfc ? (gfc.holds ? 'Holds if 2008 strikes the day you stop' : `If 2008 strikes the day you stop, it runs short at ${gfc.exhaustedAgeA}`) : ''}${s.worst && (!gfc || s.worst.label !== gfc.label) ? `; the hardest is “${s.worst.label}”, short at ${s.worst.exhaustedAgeA}.` : '.'}`;
  return (
    <div>
      <h3 className="text-[0.72rem] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-ink-faint)' }}>Stress tests</h3>
      <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-baseline gap-3">
            <span className="tnum text-[1.7rem] font-extrabold tracking-tight" style={{ color: s.fails === 0 ? 'var(--color-sage-strong)' : s.holds >= s.total / 2 ? 'var(--color-calm-strong)' : 'var(--color-hope)' }}>{s.holds}/{s.total}</span>
            <span className="text-[0.86rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{headline}</span>
          </div>
        </div>
        {plus ? st.tests.map((t: any, i: number) => (
          <div key={t.label} className="px-4 py-2.5 flex items-baseline justify-between gap-3" style={{ borderTop: '1px solid var(--color-hairline)' }}>
            <div className="min-w-0">
              <div className="text-[0.86rem] font-semibold">{t.label}</div>
              <div className="text-[0.74rem] leading-snug" style={{ color: 'var(--color-ink-faint)' }}>{t.note}</div>
            </div>
            <div className="tnum text-right shrink-0">
              <span className="block text-[0.86rem] font-bold" style={{ color: t.holds ? 'var(--color-sage-strong)' : 'var(--color-hope)' }}>{t.holds ? 'holds' : `short at ${t.exhaustedAgeA}`}</span>
              <span className="block text-[0.7rem]" style={{ color: 'var(--color-ink-faint)' }}>{t.delta >= 0 ? '+' : '−'}{fmtK(Math.abs(t.delta))} vs plan</span>
            </div>
          </div>
        )) : (
          <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-hairline)' }}>
            <button onClick={onUpgrade} className="w-full text-left flex items-start gap-2">
              <span className="text-[0.84rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
                The full table — 2008 at retirement, a Japan-style lost two decades, 1970s stagflation, a 30% crash, low growth, 4% inflation, stopping early or late — with what each leaves at {plan.horizonAge}.
              </span>
              <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[0.64rem] font-bold uppercase tracking-wider"
                style={{ background: 'color-mix(in srgb, var(--color-calm) 18%, transparent)', color: 'var(--color-calm-strong)' }}>Plus</span>
            </button>
          </div>
        )}
      </div>
      <p className="text-[0.72rem] mt-1.5 leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
        Central outlook with one thing changed at a time. The historic shapes are approximate equity-market real-return sequences, replayed on everything you hold as if it were all in shares — a harsher test than a balanced portfolio would face. The order of returns, not just the average, is what breaks retirements.
      </p>
    </div>
  );
}

// Plus: for each public-sector tranche, what taking it at each possible age
// does to the whole plan — pension, lump sum, and where the plan ends up.
function DbTiming({ plan, plus, onUpgrade }: { plan: any; plus: boolean; onUpgrade: () => void }) {
  const items = useMemo(() => {
    const out: { who: any; key: 'partnerA' | 'partnerB'; t: any }[] = [];
    for (const key of ['partnerA', 'partnerB'] as const) {
      for (const t of (plan[key].dbSchemes || [])) if (t && (Number(t.pension) || 0) > 0 || (t?.accruing && t?.salary > 0)) out.push({ who: plan[key], key, t });
    }
    return out;
  }, [plan]);
  const cmp = useMemo(() => {
    if (!plus) return [];
    return items.map(it => { try { return (E as any).compareDbTiming(plan, it.key, it.t.id); } catch { return null; } });
  }, [plan, plus, items]);
  if (!items.length) return null;
  const horizonYear = (E as any).planEndYear(plan);
  if (!plus) {
    return <Locked compact title="When to take each public-sector pension" onUpgrade={onUpgrade}
      line={`${items.length === 1 ? 'One scheme pension' : `${items.length} scheme pensions`} in the plan. Plus runs the whole plan for every possible start age — the pension, the lump sum, and what is left at ${plan.horizonAge} — so the “take it early or wait” question is answered on your numbers.`} />;
  }
  return (
    <div className="space-y-4">
      <h3 className="text-[0.72rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-ink-faint)' }}>When to take each public-sector pension</h3>
      {items.map((it, i) => {
        const c = cmp[i]; if (!c) return null;
        const best = [...c.options].sort((a: any, b: any) => b.endWealthReal - a.endWealthReal)[0];
        return (
          <div key={it.t.id} className="rounded-3xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
            <div className="px-4 pt-3 pb-2">
              <div className="text-[0.9rem] font-bold">{it.who.name} · {c.tranche.label}</div>
              <p className="text-[0.76rem] leading-relaxed mt-0.5" style={{ color: 'var(--color-ink-dim)' }}>
                Unreduced at {c.tranche.npa}; planned at {c.tranche.takeAge}. Each row re-runs the whole plan with that start age.
                {best && best.age !== c.tranche.takeAge && <> On these figures, taking it at <b>{best.age}</b> leaves the most behind at {plan.horizonAge}.</>}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[0.74rem]" style={{ borderCollapse: 'collapse', minWidth: 360 }}>
                <thead><tr style={{ color: 'var(--color-ink-faint)' }}>
                  <th className="text-left font-semibold pl-4 pr-1 py-1.5">Age</th>
                  <th className="text-right font-semibold px-1 py-1.5">Pension/yr</th>
                  <th className="text-right font-semibold px-1 py-1.5">Lump sum</th>
                  <th className="text-right font-semibold px-1 py-1.5">Left at {plan.horizonAge}</th>
                  <th className="text-right font-semibold pl-1 pr-4 py-1.5">Lasts</th>
                </tr></thead>
                <tbody>
                  {c.options.map((o: any) => {
                    const cur = o.age === c.tranche.takeAge;
                    return (
                      <tr key={o.age} style={{ borderTop: '1px solid var(--color-hairline)', background: cur ? 'color-mix(in srgb, var(--color-calm) 12%, transparent)' : 'transparent' }}>
                        <td className="pl-4 pr-1 py-1.5 tnum font-semibold whitespace-nowrap">{o.age}<span className="text-[0.66rem]" style={{ color: 'var(--color-ink-faint)' }}> · {o.year}{o.age === c.tranche.npa ? ' · unreduced' : ''}</span></td>
                        <td className="px-1 py-1.5 tnum text-right whitespace-nowrap">{fmtK(o.pension)}</td>
                        <td className="px-1 py-1.5 tnum text-right whitespace-nowrap" style={{ color: 'var(--color-ink-dim)' }}>{o.lump > 0 ? fmtK(o.lump) : '—'}</td>
                        <td className="px-1 py-1.5 tnum text-right whitespace-nowrap font-bold" style={{ color: best && o.age === best.age ? 'var(--color-sage-strong)' : 'var(--color-ink)' }}>{fmtK(o.endWealthReal)}</td>
                        <td className="pl-1 pr-4 py-1.5 tnum text-right whitespace-nowrap" style={{ color: o.exhaustedAgeA ? 'var(--color-hope)' : 'var(--color-ink-dim)' }}>{o.exhaustedAgeA ? `to ${o.exhaustedAgeA}` : `${plan.horizonAge}+`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2.5 text-[0.72rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
              Today’s money, central outlook, to {horizonYear}. A reduced pension taken early is paid for longer; whether that wins depends on how long you live and what the pots earn meanwhile — this shows the trade on your plan, not a rule.
            </p>
          </div>
        );
      })}
    </div>
  );
}

type YearRow = { year: number; age: string | number; start: number; drawn: number; ret: number; tax: number; closing: number };
function YearTable({ rows }: { rows: YearRow[] }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-2xl" style={{ background: 'var(--color-canvas)' }}>
      <table className="w-full text-[0.72rem]" style={{ borderCollapse: 'collapse', minWidth: 348 }}>
        <thead>
          <tr style={{ color: 'var(--color-ink-faint)' }}>
            <th className="text-left font-semibold pl-2.5 pr-1 py-2">Year</th>
            <th className="text-right font-semibold px-1 py-2">Start</th>
            <th className="text-right font-semibold px-1 py-2">Drawn</th>
            <th className="text-right font-semibold px-1 py-2">Return</th>
            <th className="text-right font-semibold px-1 py-2">Tax</th>
            <th className="text-right font-semibold pl-1 pr-2.5 py-2">Closing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.year} style={{ borderTop: '1px solid var(--color-hairline)', background: i % 2 ? 'transparent' : 'color-mix(in srgb, var(--color-surface) 50%, transparent)' }}>
              <td className="pl-2.5 pr-1 py-2 tnum font-semibold whitespace-nowrap">{r.year}<span className="text-[0.64rem]" style={{ color: 'var(--color-ink-faint)' }}> ·{r.age}</span></td>
              <td className="px-1 py-2 tnum text-right whitespace-nowrap" style={{ color: 'var(--color-ink-dim)' }}>{fmtK(r.start)}</td>
              <td className="px-1 py-2 tnum text-right whitespace-nowrap" style={{ color: 'var(--color-hope)' }}>−{fmtK(r.drawn)}</td>
              <td className="px-1 py-2 tnum text-right whitespace-nowrap" style={{ color: r.ret >= 0 ? 'var(--color-calm-strong)' : 'var(--color-hope)' }}>{r.ret >= 0 ? '+' : '−'}{fmtK(Math.abs(r.ret))}</td>
              <td className="px-1 py-2 tnum text-right whitespace-nowrap" style={{ color: 'var(--color-ink-dim)' }}>{fmtK(r.tax)}</td>
              <td className="pl-1 pr-2.5 py-2 tnum text-right font-bold whitespace-nowrap" style={{ color: r.closing > 0 ? 'var(--color-ink)' : 'var(--color-hope)' }}>{fmtK(r.closing)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeaceBody({ plus, onUpgrade, plan, mc }: { plus: boolean; onUpgrade: () => void; plan: any; mc: MC | null }) {
  const rows = [
    ['Private by design', 'Every figure stays on this device. Nothing is uploaded, tracked, or shared. The only thing that ever leaves is a Plus licence key, if you buy one.'],
    ['One possible future', 'A projection on stated assumptions, tested across 2,000 simulated market histories and shown with its sampling range — a way to think, not a promise.'],
    ['Not financial advice', 'A calm place to explore your own numbers. For decisions, a good adviser is worth their fee.'],
    ['UK-aware', 'State Pension age and minimum pension age from your birth year, ISAs, pensions, tax-free cash, Scottish bands, the survivor’s position after a first death and inheritance tax. UK tax year 2026/27, thresholds frozen to April 2031 then indexed.'],
    ['Feels like an app', 'Add it to your Home Screen (Share → Add to Home Screen) for the full-screen experience — it works offline too.'],
  ];
  return (
    <div className="space-y-3 pb-2">
      <button onClick={() => plus ? window.print() : onUpgrade()}
        className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 font-bold text-[var(--color-ink)] active:scale-[0.98] transition-transform"
        style={{ background: 'var(--color-calm)' }}>
        {plus ? <Download size={18} /> : <Sparkles size={18} />} Save the full report (PDF){plus ? '' : ' · Plus'}
      </button>
      <p className="text-[0.82rem] leading-relaxed px-1" style={{ color: 'var(--color-ink-dim)' }}>
        A multi-page report you can read or take to an adviser — your holdings, the plan, year-by-year projections,
        the Monte-Carlo and tax analysis, and every assumption behind the numbers.
      </p>
      {rows.map(([t, d]) => (
        <div key={t} className="rounded-2xl p-4" style={{ background: 'var(--color-canvas)' }}>
          <div className="font-bold mb-0.5">{t}</div>
          <div className="text-[0.88rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{d}</div>
        </div>
      ))}
      <Assumptions plan={plan} mc={mc} />
      <button onClick={onUpgrade} className="w-full rounded-2xl p-4 text-left" style={{ background: 'var(--color-canvas)' }}>
        <div className="font-bold mb-0.5">{plus ? 'Someday Plus is on' : 'Someday Plus'}</div>
        <div className="text-[0.88rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          {plus ? 'Manage your licence, or move it to another device.' : 'The adviser-ready report, every year in full, tax compared, advanced detail and the estate picture.'}
        </div>
      </button>
      <div className="flex flex-col gap-1 pt-1 text-center">
        <a href="story.html" className="py-1.5 text-[0.9rem] font-semibold" style={{ color: 'var(--color-calm-strong)' }}>Why I built this →</a>
        <a href={PRODUCT.legalUrl} className="py-1.5 text-[0.85rem]" style={{ color: 'var(--color-ink-faint)' }}>Terms, disclaimer &amp; privacy →</a>
      </div>
    </div>
  );
}
