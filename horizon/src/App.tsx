import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sunrise, SlidersHorizontal, Compass, ShieldCheck, Plus, X } from 'lucide-react';
import { usePlan } from './lib/usePlan';
import type { Accum, Drawdown } from './engine/engine';
import { fmt, fmtK, pct, deflate } from './lib/format';
import { useCountUp } from './lib/useCountUp';
import HorizonViz from './components/HorizonViz';
import Sheet from './components/Sheet';
import Accordion from './components/Accordion';
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
  const { plan, dd, acc, ddBear, ddBull, mc, estate, lens, setLens, update } = S;
  const [sheet, setSheet] = useState<Tab | null>(null);

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
        <ExploreBody plan={plan} dd={dd} estate={estate} />
      </Sheet>
      <Sheet open={sheet === 'peace'} onClose={() => setSheet(null)} title="Peace of mind">
        <PeaceBody />
      </Sheet>
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

  return (
    <div className="space-y-6 pb-2">
      <Group title="Your Someday">
        <NumField label="Retire in year" value={plan.retireYear} onChange={v => update({ retireYear: v })} />
        <MoneyField label="Income you want each year" value={plan.targetNet} onChange={v => update({ targetNet: v, spendingPlanOn: false })} />
        <NumField label="Plan through to age" value={plan.horizonAge} onChange={v => update({ horizonAge: v })} />
      </Group>

      <PartnerCard p={plan} name="partnerA" set={setA} />
      <PartnerCard p={plan} name="partnerB" set={setB} />

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

      <Group title="How you draw it">
        <span className="block text-[0.8rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>Tax-free cash</span>
        <Segmented small value={plan.pclsMode} onChange={(v: string) => update({ pclsMode: v })}
          options={[{ value: 'none', label: 'Take none' }, { value: 'phased', label: 'A little each year' }, { value: 'upfront', label: 'All at once' }]} />
        <span className="block text-[0.8rem] font-semibold pt-1" style={{ color: 'var(--color-ink-dim)' }}>Which pot first</span>
        <Segmented small value={plan.strategy} onChange={(v: string) => update({ strategy: v })}
          options={[{ value: 'sippfirst', label: 'Pensions' }, { value: 'isafirst', label: 'ISAs' }, { value: 'pafirst', label: 'Allowances' }]} />
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

function ExploreBody({ plan, dd, estate }: { plan: any; dd: Drawdown; estate: any }) {
  const today = (v: number, year: number) => deflate(v, year, plan.startYear, plan.inflation);
  const lifeTax = (dd as any).lifetimeTaxReal ?? dd.lifetimeTax;
  return (
    <div className="space-y-4 pb-2">
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
      {rows.map(([t, d]) => (
        <div key={t} className="rounded-2xl p-4" style={{ background: 'var(--color-canvas)' }}>
          <div className="font-bold mb-0.5">{t}</div>
          <div className="text-[0.88rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{d}</div>
        </div>
      ))}
    </div>
  );
}
