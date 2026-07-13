import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sunrise, SlidersHorizontal, Compass, ShieldCheck, Plus, X, Download } from 'lucide-react';
import { usePlan, hasSavedPlan, E } from './lib/usePlan';
import type { Accum, Drawdown, MC } from './engine/engine';
import { fmt, fmtK, pct, deflate } from './lib/format';
import { useCountUp } from './lib/useCountUp';
import HorizonViz from './components/HorizonViz';
import Sheet from './components/Sheet';
import Accordion from './components/Accordion';
import Onboarding from './components/Onboarding';
import { MoneyField, NumField, PctField, Toggle, Segmented } from './components/Field';

// Continuous wealth series (today → horizon) from the engine output.
function series(plan: any, acc: Accum, dd: Drawdown): [number, number][] {
  const start: [number, number] =
    [plan.startYear, plan.partnerA.pension + plan.partnerA.isa + plan.partnerB.pension + plan.partnerB.isa];
  const pre = acc.years.filter((y: any) => y.year < dd.rows[0].year)
    .map((y: any): [number, number] => [y.year, y.pensionA + y.isaA + y.pensionB + y.isaB + (y.cash || 0)]);
  const post = dd.rows.map((r: any): [number, number] => [r.year, r.wealth]);
  return [start, ...pre, ...post];
}

type Tab = 'horizon' | 'details' | 'explore' | 'peace';

export default function App() {
  const S = usePlan();
  const { plan, dd, acc, ddBear, ddBull, mc, estate, potsAtRet, lens, setLens, update } = S;
  const [sheet, setSheet] = useState<Tab | null>(null);
  const [onboarded, setOnboarded] = useState(hasSavedPlan());

  const horizonYear = plan.partnerA.birthYear + plan.horizonAge;
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

  // New visitor → the calm vision-first onboarding (all hooks run above first).
  if (!onboarded) {
    return (
      <Onboarding plan={plan} update={update}
        onDone={() => { update((p: any) => ({ ...p })); setOnboarded(true); }}
        onExample={() => { update(() => E.defaults()); setOnboarded(true); }} />
    );
  }

  return (
    <div className="min-h-full mx-auto max-w-[560px] px-5"
         style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>

      <header className="pt-[calc(env(safe-area-inset-top)+1.1rem)] pb-1 flex items-baseline gap-2">
        <span className="text-[1.15rem] font-extrabold tracking-tight">Someday</span>
        <span className="text-[0.75rem] italic" style={{ color: 'var(--color-ink-faint)' }}>see your horizon</span>
      </header>

      {/* The answer — the single most important line, instantly obvious. */}
      <section className="pt-3">
        <p className="text-[0.85rem] font-semibold tracking-wide" style={{ color: 'var(--color-ink-dim)' }}>
          {plan.partnerA.name} &amp; {plan.partnerB.name}
        </p>
        <h1 className="mt-1 text-[1.85rem] leading-[1.18] font-extrabold tracking-tight">
          {lasts ? (
            <>You can spend about{' '}
              <span className="tnum" style={{ color: 'var(--color-calm-strong)' }}>{fmtK(shownSpend)}</span>{' '}
              a year and stay comfortable into your {Math.floor(plan.horizonAge / 10) * 10}s.</>
          ) : (
            <>At <span className="tnum">{fmtK(shownSpend)}</span> a year, it gets tight around{' '}
              <span style={{ color: 'var(--color-hope)' }}>age {dd.exhaustedAgeA}</span>. A little less, or a little longer, holds it.</>
          )}
        </h1>
        <p className="mt-2.5 text-[0.95rem]" style={{ color: 'var(--color-ink-dim)' }}>
          Retiring {new Date(plan.retireYear, 3).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}, at {ageAtRetire}.
          {mc && <> In about <b className="tnum" style={{ color: 'var(--color-ink)' }}>{Math.round(confAnim)}%</b> of possible futures, it holds.</>}
        </p>
      </section>

      <div className="mt-4 -mx-1">
        <HorizonViz base={viz.base} low={viz.low} high={viz.high}
          startYear={plan.startYear} retireYear={plan.retireYear} horizonYear={horizonYear}
          retireWealth={viz.atRetire} lasts={lasts} dryYear={dd.exhaustedYear} />
      </div>

      <div className="mt-3">
        <Segmented value={lens} onChange={setLens} options={[
          { value: 'bear', label: 'Poor', sub: pct(plan.growthBear, 0) },
          { value: 'base', label: 'Base', sub: pct(plan.growthBase, 0) },
          { value: 'bull', label: 'Positive', sub: pct(plan.growthBull, 0) },
        ]} />
      </div>

      {/* Live "what if" — direct manipulation, immediate feedback. */}
      <section className="mt-5 rounded-3xl p-5"
               style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)',
                        boxShadow: '0 1px 2px rgba(20,30,26,0.04), 0 8px 24px rgba(20,30,26,0.05)' }}>
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
      </section>

      <p className="mt-4 text-center text-[0.8rem]" style={{ color: 'var(--color-ink-faint)' }}>
        One possible future, not a promise. Your figures never leave this device.
      </p>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around"
           style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.3rem)', paddingTop: '0.5rem',
                    background: 'color-mix(in srgb, var(--color-canvas) 82%, transparent)',
                    backdropFilter: 'saturate(180%) blur(22px)', WebkitBackdropFilter: 'saturate(180%) blur(22px)',
                    borderTop: '0.5px solid var(--color-hairline)' }}>
        <TabButton icon={<Sunrise size={24} />} label="Horizon" active={sheet === null} onClick={() => setSheet(null)} />
        <TabButton icon={<SlidersHorizontal size={24} />} label="Details" active={sheet === 'details'} onClick={() => setSheet('details')} />
        <TabButton icon={<Compass size={24} />} label="Explore" active={sheet === 'explore'} onClick={() => setSheet('explore')} />
        <TabButton icon={<ShieldCheck size={24} />} label="Peace" active={sheet === 'peace'} onClick={() => setSheet('peace')} />
      </nav>

      <Sheet open={sheet === 'details'} onClose={() => setSheet(null)} title="Your details">
        <DetailsBody plan={plan} update={update} />
      </Sheet>
      <Sheet open={sheet === 'explore'} onClose={() => setSheet(null)} title="Explore">
        <ExploreBody plan={plan} dd={dd} estate={estate} mc={mc} />
      </Sheet>
      <Sheet open={sheet === 'peace'} onClose={() => setSheet(null)} title="Peace of mind">
        <PeaceBody />
      </Sheet>

      {/* Print-only summary — a calm one-page PDF via the browser's Save as PDF. */}
      <div id="print-summary" aria-hidden="true">
        <h1>Someday — your plan</h1>
        <p className="ps-sub">{plan.partnerA.name} &amp; {plan.partnerB.name} · retiring {new Date(plan.retireYear, 3).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}, at {ageAtRetire}</p>
        <p className="ps-answer">{lasts
          ? `You can spend about ${fmtK(spendToday)} a year and stay comfortable into your ${Math.floor(plan.horizonAge / 10) * 10}s.`
          : `At ${fmtK(spendToday)} a year, the money gets tight around age ${dd.exhaustedAgeA}.`}</p>
        <div className="ps-grid">
          <div><b>{fmtK(spendToday)}</b><span>Spending a year (today's money)</span></div>
          <div><b>{mc ? pct(mc.successProb) : '—'}</b><span>Of futures it holds</span></div>
          <div><b>{fmtK(deflate(potsAtRet, plan.retireYear, plan.startYear, plan.inflation))}</b><span>Pots at retirement</span></div>
          <div><b>{lasts ? `${plan.horizonAge}+` : `age ${dd.exhaustedAgeA}`}</b><span>Money lasts to</span></div>
          <div><b>{fmtK((dd as any).lifetimeTaxReal ?? dd.lifetimeTax)}</b><span>Lifetime income tax</span></div>
          {estate && <div><b>{fmtK(deflate(estate.netToHeirs, estate.year, plan.startYear, plan.inflation))}</b><span>Left to family</span></div>}
        </div>
        <p className="ps-foot">One possible future, not a promise. A modelling tool, not financial advice. Prepared privately on your own device with Someday.</p>
      </div>
    </div>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 px-3 py-1"
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
             className="w-full mt-2" style={{ height: 28, accentColor: 'var(--color-calm)' }} aria-label={label} />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[0.72rem] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-ink-faint)' }}>{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function PartnerCard({ p, name, set }: { p: any; name: 'partnerA' | 'partnerB'; set: (patch: any) => void }) {
  const who = p[name];
  return (
    <Group title={who.name}>
      <MoneyField label="Pension pot today" value={who.pension} onChange={v => set({ pension: v })} />
      <MoneyField label="Paying in monthly" value={who.monthlyPension} onChange={v => set({ monthlyPension: v })} />
      <MoneyField label="ISAs today" value={who.isa} onChange={v => set({ isa: v })} />
      <Accordion title="More — State Pension, company pension">
        <NumField label="Birth year" value={who.birthYear} onChange={v => set({ birthYear: v })} />
        <NumField label="State Pension age" value={who.spAge} onChange={v => set({ spAge: v })} />
        <MoneyField label="State Pension a year" value={who.spAmount} onChange={v => set({ spAmount: v })} />
        <MoneyField label="Company (DB) pension a year" value={who.db} onChange={v => set({ db: v })} />
        <MoneyField label="Paying into ISAs monthly" value={who.monthlyIsa} onChange={v => set({ monthlyIsa: v })} />
      </Accordion>
    </Group>
  );
}

function DetailsBody({ plan, update }: { plan: any; update: (p: any) => void }) {
  const setA = (patch: any) => update((p: any) => ({ ...p, partnerA: { ...p.partnerA, ...patch } }));
  const setB = (patch: any) => update((p: any) => ({ ...p, partnerB: { ...p.partnerB, ...patch } }));
  const setInherit = (patch: any) => update((p: any) => ({ ...p, inherit: { ...p.inherit, ...patch } }));
  const addEvent = (kind: string) => update((p: any) => ({
    ...p, lifeEvents: [...(p.lifeEvents || []), { year: p.retireYear + 2, label: kind === 'cost' ? 'One-off cost' : 'Windfall', amount: kind === 'cost' ? 20000 : 40000, kind, invest: kind !== 'cost' }],
  }));
  const setEvent = (i: number, patch: any) => update((p: any) => ({ ...p, lifeEvents: p.lifeEvents.map((e: any, j: number) => j === i ? { ...e, ...patch } : e) }));
  const delEvent = (i: number) => update((p: any) => ({ ...p, lifeEvents: p.lifeEvents.filter((_: any, j: number) => j !== i) }));
  const [sect, setSect] = useState<'plan' | 'people' | 'later'>('plan');

  return (
    <div className="space-y-6 pb-2">
      {/* Segment the sheet so it's never one long scroll (UX audit fix). */}
      <div className="sticky top-0 z-10 -mx-6 px-6 pb-2" style={{ background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)' }}>
        <Segmented small value={sect} onChange={setSect}
          options={[{ value: 'plan', label: 'Plan' }, { value: 'people', label: 'People' }, { value: 'later', label: 'Later' }]} />
      </div>

      {sect === 'plan' && <>
      <Group title="Your Someday">
        <NumField label="Retire in year" value={plan.retireYear} onChange={v => update({ retireYear: v })} />
        <MoneyField label="Income you want each year" value={plan.targetNet} onChange={v => update({ targetNet: v, spendingPlanOn: false })} />
        <NumField label="Plan through to age" value={plan.horizonAge} onChange={v => update({ horizonAge: v })} />
      </Group>
      <Group title="How you draw it">
        <span className="block text-[0.8rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>Tax-free cash</span>
        <Segmented small value={plan.pclsMode} onChange={(v: string) => update({ pclsMode: v })}
          options={[{ value: 'none', label: 'Take none' }, { value: 'phased', label: 'A little each year' }, { value: 'upfront', label: 'All at once' }]} />
        <span className="block text-[0.8rem] font-semibold pt-1" style={{ color: 'var(--color-ink-dim)' }}>Which pot first</span>
        <Segmented small value={plan.strategy} onChange={(v: string) => update({ strategy: v })}
          options={[{ value: 'sippfirst', label: 'Pensions' }, { value: 'isafirst', label: 'ISAs' }, { value: 'pafirst', label: 'Allowances' }]} />
      </Group>
      </>}

      {sect === 'people' && <>
      <PartnerCard p={plan} name="partnerA" set={setA} />
      <PartnerCard p={plan} name="partnerB" set={setB} />
      </>}

      {sect === 'later' && <>
      <Group title="Spending as you age">
        <p className="text-[0.82rem]" style={{ color: 'var(--color-ink-dim)' }}>Most people spend less later. Two gentle step-downs.</p>
        <Toggle label={`Ease spending from ${plan.phase1Age}`} checked={plan.phase1On} onChange={v => update({ phase1On: v })} />
        {plan.phase1On && <div className="grid grid-cols-2 gap-3">
          <NumField label="From age" value={plan.phase1Age} onChange={v => update({ phase1Age: v })} />
          <PctField label="Spend less by" value={plan.phase1Cut} onChange={v => update({ phase1Cut: v })} />
        </div>}
        <Toggle label={`A further step-down from ${plan.phase2Age}`} checked={plan.phase2On} onChange={v => update({ phase2On: v })} />
        {plan.phase2On && <div className="grid grid-cols-2 gap-3">
          <NumField label="From age" value={plan.phase2Age} onChange={v => update({ phase2Age: v })} />
          <PctField label="A further" value={plan.phase2Cut} onChange={v => update({ phase2Cut: v })} />
        </div>}
      </Group>

      <Group title="The lens">
        <p className="text-[0.82rem]" style={{ color: 'var(--color-ink-dim)' }}>Three futures, not one guess. Most people leave these.</p>
        <div className="grid grid-cols-3 gap-2">
          <PctField label="Poor" value={plan.growthBear} onChange={v => update({ growthBear: v })} />
          <PctField label="Base" value={plan.growthBase} onChange={v => update({ growthBase: v })} />
          <PctField label="Positive" value={plan.growthBull} onChange={v => update({ growthBull: v })} />
        </div>
        <PctField label="Inflation" value={plan.inflation} onChange={v => update({ inflation: v })} />
      </Group>

      <Group title="Life events">
        <Toggle label="Expect an inheritance" checked={plan.inherit?.on} onChange={v => setInherit({ on: v })} />
        {plan.inherit?.on && <div className="grid grid-cols-2 gap-3">
          <NumField label="Year" value={plan.inherit.year} onChange={v => setInherit({ year: v })} />
          <MoneyField label="Amount" value={plan.inherit.amount} onChange={v => setInherit({ amount: v })} />
        </div>}
        {(plan.lifeEvents || []).map((e: any, i: number) => (
          <div key={i} className="rounded-2xl p-3" style={{ background: 'var(--color-canvas)' }}>
            <div className="flex items-center gap-2">
              <input className="flex-1 bg-transparent outline-none font-semibold text-[0.95rem]" value={e.label}
                onChange={ev => setEvent(i, { label: ev.target.value })} />
              <button onClick={() => delEvent(i)} style={{ color: 'var(--color-ink-faint)' }}><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <NumField label="Year" value={e.year} onChange={v => setEvent(i, { year: v })} />
              <MoneyField label="Amount" value={e.amount} onChange={v => setEvent(i, { amount: v })} />
            </div>
            <div className="mt-2"><Segmented small value={e.kind} onChange={(v: string) => setEvent(i, { kind: v })}
              options={[{ value: 'cost', label: 'Cost' }, { value: 'income', label: 'Windfall' }]} /></div>
          </div>
        ))}
        <div className="flex gap-2">
          <button onClick={() => addEvent('cost')} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[0.85rem] font-semibold"
            style={{ background: 'var(--color-canvas)', color: 'var(--color-calm-strong)' }}><Plus size={15} /> Add a cost</button>
          <button onClick={() => addEvent('income')} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[0.85rem] font-semibold"
            style={{ background: 'var(--color-canvas)', color: 'var(--color-calm-strong)' }}><Plus size={15} /> Add a windfall</button>
        </div>
      </Group>
      </>}
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
    ['State Pension', sp, 'var(--color-calm)'],
    ['Company pension', db, 'var(--color-dusk)'],
    ['Pension draws (after tax)', pen, 'var(--color-calm-strong)'],
    ['Tax-free cash', tfc, 'var(--color-hope)'],
    ['ISAs & cash', isa, '#9bb8ae'],
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
        <stop offset="0" stopColor="var(--color-calm)" stopOpacity="0.28" /><stop offset="1" stopColor="var(--color-calm)" stopOpacity="0.03" />
      </linearGradient></defs>
      <path d={g.area} fill="url(#mcband)" />
      <path d={g.mid} fill="none" stroke="var(--color-calm-strong)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function ExploreBody({ plan, dd, estate, mc }: { plan: any; dd: Drawdown; estate: any; mc: MC | null }) {
  const today = (v: number, year: number) => deflate(v, year, plan.startYear, plan.inflation);
  const lifeTax = (dd as any).lifetimeTaxReal ?? dd.lifetimeTax;
  const mix = fundingMix(dd);
  return (
    <div className="space-y-5 pb-2">
      {mc && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-canvas)' }}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[0.9rem] font-semibold">Range of futures</span>
            <span className="tnum text-[0.9rem] font-bold" style={{ color: 'var(--color-calm-strong)' }}>{pct(mc.successProb)} hold</span>
          </div>
          <McFan mc={mc} retireYear={plan.retireYear} />
          <p className="text-[0.72rem] mt-1" style={{ color: 'var(--color-ink-faint)' }}>
            {mc.nPaths} market histories · lucky to unlucky. Typical line in the middle.
          </p>
        </div>
      )}

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
        <StatCard label={dd.exhaustedAgeA == null ? 'Money lasts' : 'Runs short at'} value={dd.exhaustedAgeA == null ? `${plan.horizonAge}+` : `age ${dd.exhaustedAgeA}`} tone={dd.exhaustedAgeA == null ? 'calm' : 'hope'} />
      </div>
      {estate && (
        <div className="flex gap-3">
          <StatCard label="Left to your family" value={fmtK(today(estate.netToHeirs, estate.year))} tone="calm" />
          <StatCard label={estate.iht > 0 ? 'Inheritance tax — often reducible' : 'Inheritance tax'} value={fmtK(today(estate.iht, estate.year))} tone="ink" />
        </div>
      )}
      <div>
        <h3 className="text-[0.72rem] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-ink-faint)' }}>Year by year</h3>
        <div className="space-y-2">
          {dd.rows.filter((_: any, i: number) => i % 3 === 0 || i === dd.rows.length - 1).map((r: any) => {
            const pots = today(r.potA + r.potB + r.isaA + r.isaB + (r.cash || 0), r.year);
            return (
              <div key={r.year} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: 'var(--color-canvas)' }}>
                <div>
                  <div className="font-semibold tnum">{r.year} · age {r.ageA}</div>
                  <div className="text-[0.78rem]" style={{ color: 'var(--color-ink-faint)' }}>spend {fmtK(today(r.target, r.year))}</div>
                </div>
                <div className="tnum font-bold" style={{ color: pots > 0 ? 'var(--color-calm-strong)' : 'var(--color-hope)' }}>{fmtK(pots)} left</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PeaceBody() {
  const rows = [
    ['Private by design', 'Every figure stays on this device. Nothing is uploaded, tracked, or shared.'],
    ['One possible future', 'This shows a range of outcomes across 500+ market histories — a way to think, not a promise.'],
    ['Not financial advice', 'A calm place to explore your own numbers. For decisions, a good adviser is worth their fee.'],
    ['UK-aware', 'State Pension, ISAs, pensions, tax-free cash and inheritance tax, modelled for two people with different ages.'],
  ];
  return (
    <div className="space-y-3 pb-2">
      <button onClick={() => window.print()}
        className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 font-bold text-white active:scale-[0.98] transition-transform"
        style={{ background: 'var(--color-calm)' }}>
        <Download size={18} /> Save a summary (PDF)
      </button>
      {rows.map(([t, d]) => (
        <div key={t} className="rounded-2xl p-4" style={{ background: 'var(--color-canvas)' }}>
          <div className="font-bold mb-0.5">{t}</div>
          <div className="text-[0.88rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{d}</div>
        </div>
      ))}
    </div>
  );
}
