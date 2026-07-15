import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fmtK } from '../lib/format';
import { MoneyField, NumField, Toggle } from './Field';

/**
 * Vision-first onboarding. (HIG: a calm conversation, not a form — one idea per
 * screen, progressive, skippable.) Income-first: the life first, the numbers
 * second. Writes into the plan and hands back to the Horizon.
 */
export default function Onboarding({ plan, update, onDone, onExample }: {
  plan: any; update: (p: any) => void; onDone: () => void; onExample: () => void;
}) {
  const [step, setStep] = useState(0);
  const [addPartner, setAddPartner] = useState(false);
  const startYear = plan.startYear;
  const yearsToRetire = Math.max(1, plan.retireYear - startYear);
  const set = (patch: any) => update(patch);
  const setA = (patch: any) => update((p: any) => ({ ...p, partnerA: { ...p.partnerA, ...patch } }));
  const setB = (patch: any) => update((p: any) => ({ ...p, partnerB: { ...p.partnerB, ...patch } }));

  const next = () => setStep(s => s + 1);
  const dir = 1;

  const steps = [
    // 0 — Welcome
    <div key="w" className="text-center">
      <div className="text-[3rem] mb-2">🌅</div>
      <h1 className="text-[2rem] font-extrabold tracking-tight leading-tight">See the day<br />you can stop.</h1>
      <p className="mt-4 text-[1rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
        A private, calm look at your retirement — start with the life you want, and the numbers follow.
        Everything stays on this device.
      </p>
      <button onClick={next} className="mt-8 w-full rounded-2xl py-4 font-bold text-[1.05rem] text-white active:scale-[0.98] transition-transform"
        style={{ background: 'var(--color-calm)' }}>Begin</button>
      <button onClick={onExample} className="mt-3 w-full py-2 font-semibold text-[0.95rem]" style={{ color: 'var(--color-calm-strong)' }}>
        Or see a worked example
      </button>
    </div>,

    // 1 — Vision (income-first)
    <div key="v">
      <h1 className="text-[1.6rem] font-extrabold tracking-tight">Picture your Someday.</h1>
      <p className="mt-2 mb-5 text-[0.95rem]" style={{ color: 'var(--color-ink-dim)' }}>No wrong answers — you can change everything later.</p>
      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[0.9rem] font-medium">Stop work in</span>
          <span className="tnum font-bold" style={{ color: 'var(--color-calm-strong)' }}>{startYear + yearsToRetire} · {yearsToRetire} yr{yearsToRetire > 1 ? 's' : ''}</span>
        </div>
        <input type="range" min={1} max={30} value={yearsToRetire}
          onChange={e => set({ retireYear: startYear + Number(e.target.value) })}
          className="w-full" style={{ height: 30, accentColor: 'var(--color-calm)' }} aria-label="Years until you stop work" />
      </div>
      <span className="block text-[0.9rem] font-medium mb-2">What does “enough” look like each year?</span>
      <div className="flex gap-2 mb-3">
        {[[22400, 'Minimum'], [43100, 'Moderate'], [59000, 'Comfortable']].map(([v, l]) => {
          const on = Math.abs(plan.targetNet - (v as number)) < 1;
          return (
            <button key={l} onClick={() => set({ targetNet: v })}
              className="flex-1 rounded-2xl py-3 active:scale-[0.97] transition-transform"
              style={{ background: on ? 'var(--color-calm)' : 'var(--color-canvas)', color: on ? '#fff' : 'var(--color-ink)', border: '1px solid ' + (on ? 'var(--color-calm)' : 'var(--color-hairline)') }}>
              <span className="block text-[1.1rem] font-extrabold tnum">{fmtK(v as number)}</span>
              <span className="block text-[0.68rem] opacity-80">{l as string}</span>
            </button>
          );
        })}
      </div>
      <MoneyField label="Or your own figure, a year (today's money)" value={plan.targetNet} onChange={v => set({ targetNet: v })} />
      <button onClick={next} className="mt-7 w-full rounded-2xl py-4 font-bold text-[1.05rem] text-white active:scale-[0.98] transition-transform"
        style={{ background: 'var(--color-calm)' }}>Continue</button>
    </div>,

    // 2 — You (and optional partner)
    <div key="y">
      <h1 className="text-[1.6rem] font-extrabold tracking-tight">Where you’re starting from.</h1>
      <p className="mt-2 mb-5 text-[0.95rem]" style={{ color: 'var(--color-ink-dim)' }}>Honest beats hopeful — and it never leaves this device.</p>
      <div className="space-y-3">
        <label className="block">
          <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>Your name</span>
          <input value={plan.partnerA.name === 'You' ? '' : plan.partnerA.name} placeholder="You"
            onChange={e => setA({ name: e.target.value || 'You' })}
            className="w-full rounded-2xl px-4 h-[52px] text-[1.15rem] font-semibold outline-none"
            style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }} />
        </label>
        <NumField label="Your birth year" value={plan.partnerA.birthYear} onChange={v => setA({ birthYear: v })} />
        <MoneyField label="Workplace pension (defined contribution) today" value={plan.partnerA.pension} onChange={v => setA({ pension: v })} />
        <MoneyField label="Paying into your pension monthly" value={plan.partnerA.monthlyPension} onChange={v => setA({ monthlyPension: v })} />
        <MoneyField label="Company / final-salary (defined benefit) pension a year (0 if none)" value={plan.partnerA.db}
          onChange={v => update((q: any) => ({ ...q, partnerA: { ...q.partnerA, db: v, dbStartYear: v > 0 ? q.retireYear : q.partnerA.dbStartYear } }))} />
        {plan.partnerA.db > 0 && (
          <div className="pt-0.5"><Toggle label="…and it rises with inflation" checked={!!plan.partnerA.dbIndexed} onChange={v => setA({ dbIndexed: v })} /></div>
        )}
        <MoneyField label="ISAs today" value={plan.partnerA.isa} onChange={v => setA({ isa: v })} />
        <MoneyField label="Paying into ISAs monthly" value={plan.partnerA.monthlyIsa} onChange={v => setA({ monthlyIsa: v })} />
        <div className="pt-1"><Toggle label="Planning with a partner" checked={addPartner} onChange={setAddPartner} /></div>
        {addPartner && (
          <div className="space-y-3 pt-1">
            <label className="block">
              <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>Partner’s name</span>
              <input value={plan.partnerB.name === 'Partner' ? '' : plan.partnerB.name} placeholder="Partner"
                onChange={e => setB({ name: e.target.value || 'Partner' })}
                className="w-full rounded-2xl px-4 h-[52px] text-[1.15rem] font-semibold outline-none"
                style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }} />
            </label>
            <NumField label="Their birth year" value={plan.partnerB.birthYear} onChange={v => setB({ birthYear: v })} />
            <MoneyField label="Their workplace pension (defined contribution) today" value={plan.partnerB.pension} onChange={v => setB({ pension: v })} />
            <MoneyField label="Paying into their pension monthly" value={plan.partnerB.monthlyPension} onChange={v => setB({ monthlyPension: v })} />
            <MoneyField label="Their company / final-salary (defined benefit) pension a year (0 if none)" value={plan.partnerB.db}
              onChange={v => update((q: any) => ({ ...q, partnerB: { ...q.partnerB, db: v, dbStartYear: v > 0 ? q.retireYear : q.partnerB.dbStartYear } }))} />
            {plan.partnerB.db > 0 && (
              <div className="pt-0.5"><Toggle label="…and it rises with inflation" checked={!!plan.partnerB.dbIndexed} onChange={v => setB({ dbIndexed: v })} /></div>
            )}
            <MoneyField label="Their ISAs today" value={plan.partnerB.isa} onChange={v => setB({ isa: v })} />
            <MoneyField label="Paying into their ISAs monthly" value={plan.partnerB.monthlyIsa} onChange={v => setB({ monthlyIsa: v })} />
          </div>
        )}
      </div>
      <button onClick={onDone} className="mt-7 w-full rounded-2xl py-4 font-bold text-[1.05rem] text-white active:scale-[0.98] transition-transform"
        style={{ background: 'var(--color-calm)' }}>See my horizon →</button>
    </div>,
  ];

  return (
    <motion.div className="fixed inset-0 z-[60] overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: 'var(--color-canvas)' }}>
      <div className="mx-auto max-w-[480px] px-6 min-h-full flex flex-col justify-center py-[max(2rem,env(safe-area-inset-top))]">
        {/* progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2].map(i => (
            <span key={i} className="rounded-full transition-all" style={{
              width: i === step ? 22 : 7, height: 7,
              background: i <= step ? 'var(--color-calm)' : 'var(--color-hairline)',
            }} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 24 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 * dir }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.3, 1] }}>
            {steps[step]}
          </motion.div>
        </AnimatePresence>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="mt-5 mx-auto py-2 text-[0.9rem] font-medium" style={{ color: 'var(--color-ink-faint)' }}>← Back</button>
        )}
      </div>
    </motion.div>
  );
}
