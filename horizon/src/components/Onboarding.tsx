import { useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * The welcome. Setting up is the home itself — Begin goes straight to the
 * calculator with sensible defaults — so there is no separate form first.
 */
export default function Onboarding({ plan, update, onDone, onExample }: {
  plan: any; update: (p: any) => void; onDone: () => void; onExample: () => void;
  plus?: boolean; onUpgrade?: () => void;
}) {
  // A brand-new plan is one person until "About you" says otherwise, so
  // somebody planning alone never has to clear a partner's figures.
  useEffect(() => {
    const B = plan.partnerB || {};
    const partnerHasFigures = (B.pension || 0) + (B.isa || 0) + (B.db || 0) + (B.monthlyPension || 0) > 0
      || (B.dbSchemes || []).length > 0;
    if (!partnerHasFigures) update((q: any) => ({ ...q, household: 'single' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div className="fixed inset-0 z-[60] overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ background: 'linear-gradient(180deg, var(--color-dawn-1) 0%, var(--color-canvas) 55%)' }}>
      <div className="mx-auto max-w-[520px] px-6 min-h-full flex flex-col justify-center text-center py-[max(2rem,env(safe-area-inset-top))]">
        <svg width="56" height="56" viewBox="0 0 42 42" fill="none" className="mx-auto mb-4" aria-hidden="true">
          <path d="M9 27a12 12 0 0 1 24 0" stroke="var(--color-calm)" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="21" cy="27" r="4.5" stroke="var(--color-calm)" strokeWidth="2.4" />
          <path d="M4 32.5h34" stroke="var(--color-calm)" strokeWidth="2.4" strokeLinecap="round" opacity=".5" />
        </svg>
        <h1 className="serif text-[2.6rem] leading-[1.02]" style={{ color: 'var(--color-ink)' }}>See the day<br /><em style={{ color: 'var(--color-calm-strong)' }}>you can stop.</em></h1>
        <p className="mt-4 text-[1rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          A few sliders and you have your answer: what you could take home a month, after tax, for life — and what would help most.
          No sign-up. Everything stays on this device.
        </p>
        <button onClick={onDone} className="mt-8 w-full rounded-2xl py-4 font-semibold text-[1.05rem] active:scale-[0.98] transition-transform"
          style={{ background: 'var(--color-calm)', color: '#2C2C2C' }}>Begin</button>
        <button onClick={onExample} className="mt-3 w-full py-2 font-medium text-[0.95rem]" style={{ color: 'var(--color-ink-dim)' }}>
          Or see a worked example
        </button>
      </div>
    </motion.div>
  );
}
