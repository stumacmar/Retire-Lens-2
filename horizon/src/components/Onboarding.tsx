import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PlanForm from './PlanForm';

/**
 * Setup: a welcome, then the form carousel — the same one the Details screen
 * uses, cut down to the pages a chart actually needs. One idea per page,
 * swipe to move, never a list to wade through. The moment there is money in
 * the plan, the way out lights up: you are not held hostage to the last page.
 */
export default function Onboarding({ plan, update, onDone, onExample, plus, onUpgrade }: {
  plan: any; update: (p: any) => void; onDone: () => void; onExample: () => void;
  plus: boolean; onUpgrade: () => void;
}) {
  const [step, setStep] = useState(0);
  const [page, setPage] = useState(0);

  // A brand-new plan is one person until "Who" says otherwise, so somebody
  // planning alone never has to clear a partner's figures.
  useEffect(() => {
    const B = plan.partnerB || {};
    const partnerHasFigures = (B.pension || 0) + (B.isa || 0) + (B.db || 0) + (B.monthlyPension || 0) > 0
      || (B.dbSchemes || []).length > 0;
    if (!partnerHasFigures) update((q: any) => ({ ...q, household: 'single' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const A = plan.partnerA, B = plan.partnerB;
  const ready = (A.pension + A.isa + A.monthlyPension + A.monthlyIsa + A.db
    + (plan.household === 'single' ? 0 : B.pension + B.isa + B.monthlyPension + B.monthlyIsa + B.db)) > 0;

  return (
    <motion.div className="fixed inset-0 z-[60] overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: 'var(--color-canvas)' }}>
      <div className={`mx-auto max-w-[560px] px-6 min-h-full flex flex-col ${step === 0 ? 'justify-center' : 'justify-start'} py-[max(2rem,env(safe-area-inset-top))]`}>
        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.div key="welcome"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.3, ease: [0.2, 0.7, 0.3, 1] }} className="text-center">
              <svg width="54" height="54" viewBox="0 0 42 42" fill="none" className="mx-auto mb-3" aria-hidden="true">
                <path d="M9 27a12 12 0 0 1 24 0" stroke="var(--color-calm)" strokeWidth="2.6" strokeLinecap="round" />
                <circle cx="21" cy="27" r="4.5" stroke="var(--color-calm)" strokeWidth="2.6" />
                <path d="M4 32.5h34" stroke="var(--color-calm)" strokeWidth="2.6" strokeLinecap="round" opacity=".5" />
              </svg>
              <h1 className="text-[2rem] font-extrabold tracking-tight leading-tight">See the day<br />you can stop.</h1>
              <p className="mt-4 text-[1rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
                A private, calm look at your retirement. A few short pages — swipe through them — and
                everything stays on this device.
              </p>
              <button onClick={() => setStep(1)}
                className="mt-8 w-full rounded-2xl py-4 font-bold text-[1.05rem] text-[var(--color-ink)] active:scale-[0.98] transition-transform"
                style={{ background: 'var(--color-calm)' }}>Begin</button>
              <button onClick={onExample} className="mt-3 w-full py-2 font-semibold text-[0.95rem]" style={{ color: 'var(--color-calm-strong)' }}>
                Or see a worked example
              </button>
            </motion.div>
          ) : (
            <motion.div key="form"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.2, 0.7, 0.3, 1] }}>
              <PlanForm plan={plan} update={update} plus={plus} onUpgrade={onUpgrade}
                mode="setup" index={page} onIndex={setPage} railBg="var(--color-canvas)"
                footer={
                  <button onClick={onDone} disabled={!ready}
                    className="w-full rounded-2xl py-3.5 min-h-[46px] font-bold text-[0.98rem] active:scale-[0.98] transition-all"
                    style={{
                      background: ready ? 'var(--color-calm)' : 'var(--color-canvas)',
                      color: ready ? 'var(--color-ink)' : 'var(--color-ink-faint)',
                      border: ready ? 'none' : '1px solid var(--color-hairline)',
                      cursor: ready ? 'pointer' : 'not-allowed',
                    }}>
                    {ready ? 'See my horizon →' : 'Add a pension or ISA'}
                  </button>
                } />
              <button onClick={() => setStep(0)} className="mt-5 mx-auto block py-2 text-[0.9rem] font-medium"
                style={{ color: 'var(--color-ink-faint)' }}>← Welcome</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
