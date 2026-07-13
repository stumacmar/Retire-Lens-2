import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sunrise, SlidersHorizontal, Compass, ShieldCheck, ChevronRight } from 'lucide-react';
import { usePlan } from './lib/usePlan';
import type { Accum, Drawdown } from './engine/engine';
import { fmt, fmtK, pct, deflate } from './lib/format';
import HorizonViz from './components/HorizonViz';
import Sheet from './components/Sheet';
import { MoneyField, Segmented } from './components/Field';

// Build a continuous wealth series (today → horizon) from the engine output.
function series(plan: any, acc: Accum, dd: Drawdown): [number, number][] {
  const start: [number, number] =
    [plan.startYear, plan.partnerA.pension + plan.partnerA.isa + plan.partnerB.pension + plan.partnerB.isa];
  const pre = acc.years
    .filter((y: any) => y.year < dd.rows[0].year)
    .map((y: any): [number, number] => [y.year, y.pensionA + y.isaA + y.pensionB + y.isaB + (y.cash || 0)]);
  const post = dd.rows.map((r: any): [number, number] => [r.year, r.wealth]);
  return [start, ...pre, ...post];
}

type Tab = 'horizon' | 'details' | 'explore' | 'peace';

export default function App() {
  const S = usePlan();
  const { plan, dd, acc, ddBear, ddBull, mc, lens, setLens, update } = S;
  const [sheet, setSheet] = useState<Tab | null>(null);

  const horizonYear = plan.partnerA.birthYear + plan.horizonAge;
  const lasts = dd.exhaustedAgeA == null;
  const spendToday = Math.round(plan.targetNet);
  const conf = mc ? mc.successProb : (lasts ? 0.9 : 0.5);

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

      {/* Whisper-quiet wordmark — deference: chrome recedes. */}
      <header className="pt-[calc(env(safe-area-inset-top)+1.1rem)] pb-1 flex items-baseline gap-2">
        <span className="text-[1.15rem] font-extrabold tracking-tight">Someday</span>
        <span className="text-[0.75rem] italic" style={{ color: 'var(--color-ink-faint)' }}>see your horizon</span>
      </header>

      {/* ── The answer: the single most important line, instantly obvious ── */}
      <motion.section
        key={lens + lasts}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.7, 0.3, 1] }}
        className="pt-3"
      >
        <p className="text-[0.85rem] font-semibold tracking-wide" style={{ color: 'var(--color-ink-dim)' }}>
          {plan.partnerA.name} &amp; {plan.partnerB.name}
        </p>
        <h1 className="mt-1 text-[1.85rem] leading-[1.18] font-extrabold tracking-tight">
          {lasts ? (
            <>You can spend about{' '}
              <span style={{ color: 'var(--color-calm-strong)' }}>{fmtK(spendToday)}</span>{' '}
              a year and stay comfortable into your {Math.floor(plan.horizonAge / 10) * 10}s.</>
          ) : (
            <>At {fmtK(spendToday)} a year, it gets tight around{' '}
              <span style={{ color: 'var(--color-hope)' }}>age {dd.exhaustedAgeA}</span>. A little less, or a little longer, holds it.</>
          )}
        </h1>
        <p className="mt-2.5 text-[0.95rem]" style={{ color: 'var(--color-ink-dim)' }}>
          Retiring {new Date(plan.retireYear, 3).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}, at {ageAtRetire}.
          {mc && <> In about <b style={{ color: 'var(--color-ink)' }}>{pct(conf)}</b> of possible futures, it holds.</>}
        </p>
      </motion.section>

      {/* ── The Horizon ── */}
      <div className="mt-4 -mx-1">
        <HorizonViz
          base={viz.base} low={viz.low} high={viz.high}
          startYear={plan.startYear} retireYear={plan.retireYear} horizonYear={horizonYear}
          retireWealth={viz.atRetire} lasts={lasts}
        />
      </div>

      {/* Lens — Poor / Base / Positive, calm and inline */}
      <div className="mt-3">
        <Segmented
          value={lens}
          onChange={setLens}
          options={[
            { value: 'bear', label: 'Poor', sub: pct(plan.growthBear, 0) },
            { value: 'base', label: 'Base', sub: pct(plan.growthBase, 0) },
            { value: 'bull', label: 'Positive', sub: pct(plan.growthBull, 0) },
          ]}
        />
      </div>

      {/* ── Live "what if" — direct manipulation, immediate feedback ── */}
      <section className="mt-5 rounded-3xl p-5"
               style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)',
                        boxShadow: '0 1px 2px rgba(20,30,26,0.04), 0 8px 24px rgba(20,30,26,0.05)' }}>
        <h2 className="text-[0.72rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-ink-faint)' }}>What if…</h2>
        <WhatIf label="I retire in" out={`${plan.retireYear} · age ${ageAtRetire}`}
          min={plan.startYear + 1} max={plan.startYear + 25} step={1} value={plan.retireYear}
          onChange={v => update({ retireYear: v })} />
        <WhatIf label="I spend each year" out={fmt(spendToday)}
          min={20000} max={120000} step={1000} value={plan.targetNet}
          onChange={v => update({ targetNet: v, spendingPlanOn: false })} />
        <WhatIf label={`${plan.partnerA.name} saves monthly`} out={fmt(plan.partnerA.monthlyPension)}
          min={0} max={5000} step={50} value={plan.partnerA.monthlyPension}
          onChange={v => update(p => ({ ...p, partnerA: { ...p.partnerA, monthlyPension: v } }))} />
      </section>

      <p className="mt-4 text-center text-[0.8rem]" style={{ color: 'var(--color-ink-faint)' }}>
        One possible future, not a promise. Your figures never leave this device.
      </p>

      {/* ── Bottom tab bar ── */}
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

      {/* ── Sheets ── */}
      <Sheet open={sheet === 'details'} onClose={() => setSheet(null)} title="Your details">
        <DetailsBody plan={plan} update={update} />
      </Sheet>
      <Sheet open={sheet === 'explore'} onClose={() => setSheet(null)} title="Year by year">
        <ExploreBody plan={plan} dd={dd} />
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

function WhatIf({ label, out, min, max, step, value, onChange }: {
  label: string; out: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="mt-4 first:mt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[0.9rem] font-medium">{label}</span>
        <span className="tnum text-[0.95rem] font-bold" style={{ color: 'var(--color-calm-strong)' }}>{out}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(Number(e.target.value))}
             className="w-full mt-2 accent-[var(--color-calm)]"
             style={{ height: 28 }} aria-label={label} />
    </div>
  );
}

function DetailsBody({ plan, update }: { plan: any; update: (p: any) => void }) {
  const setA = (patch: any) => update((p: any) => ({ ...p, partnerA: { ...p.partnerA, ...patch } }));
  const setB = (patch: any) => update((p: any) => ({ ...p, partnerB: { ...p.partnerB, ...patch } }));
  return (
    <div className="space-y-6 pb-2">
      <Group title={plan.partnerA.name}>
        <MoneyField label="Pension pot today" value={plan.partnerA.pension} onChange={v => setA({ pension: v })} />
        <MoneyField label="Paying in monthly" value={plan.partnerA.monthlyPension} onChange={v => setA({ monthlyPension: v })} />
        <MoneyField label="ISAs today" value={plan.partnerA.isa} onChange={v => setA({ isa: v })} />
      </Group>
      <Group title={plan.partnerB.name}>
        <MoneyField label="Pension pot today" value={plan.partnerB.pension} onChange={v => setB({ pension: v })} />
        <MoneyField label="Paying in monthly" value={plan.partnerB.monthlyPension} onChange={v => setB({ monthlyPension: v })} />
        <MoneyField label="ISAs today" value={plan.partnerB.isa} onChange={v => setB({ isa: v })} />
      </Group>
      <Group title="The lens">
        <p className="text-[0.85rem]" style={{ color: 'var(--color-ink-dim)' }}>
          Three futures, not one guess — Poor, Base and Positive. Most people leave these as they are.
        </p>
        <Segmented value={String(plan.spendingPlanOn) as any} onChange={() => {}}
          options={[{ value: 'x' as any, label: `${pct(plan.growthBear)} · ${pct(plan.growthBase)} · ${pct(plan.growthBull)}` }]} />
      </Group>
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

function ExploreBody({ plan, dd }: { plan: any; dd: Drawdown }) {
  return (
    <div className="space-y-2 pb-2">
      <p className="text-[0.9rem] mb-2" style={{ color: 'var(--color-ink-dim)' }}>
        Every year of your retirement, in today's money. Calm figures, no spreadsheet.
      </p>
      {dd.rows.filter((_: any, i: number) => i % 3 === 0 || i === dd.rows.length - 1).map((r: any) => {
        const today = (v: number) => deflate(v, r.year, plan.startYear, plan.inflation);
        const pots = today(r.potA + r.potB + r.isaA + r.isaB + (r.cash || 0));
        return (
          <div key={r.year} className="flex items-center justify-between rounded-2xl px-4 py-3"
               style={{ background: 'var(--color-canvas)' }}>
            <div>
              <div className="font-semibold tnum">{r.year} · age {r.ageA}</div>
              <div className="text-[0.78rem]" style={{ color: 'var(--color-ink-faint)' }}>spend {fmtK(today(r.target))}</div>
            </div>
            <div className="tnum font-bold" style={{ color: pots > 0 ? 'var(--color-calm-strong)' : 'var(--color-hope)' }}>
              {fmtK(pots)} left
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PeaceBody() {
  const rows = [
    ['Private by design', 'Every figure stays on this device. Nothing is uploaded, tracked, or shared.'],
    ['One possible future', 'This shows a range of outcomes across 1,000 market histories — a way to think, not a promise.'],
    ['Not financial advice', 'A calm place to explore your own numbers. For decisions, a good adviser is worth their fee.'],
    ['UK-aware', 'State Pension, ISAs, pensions and tax-free cash are modelled for two people with different ages.'],
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
