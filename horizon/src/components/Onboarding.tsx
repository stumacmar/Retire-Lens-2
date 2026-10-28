import { useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * The welcome. Setting up is the cryptex itself — Begin goes straight to it,
 * locked, at night — so there is no separate form to fill in first.
 */
export default function Onboarding({ plan, update, onDone, onExample }: {
  plan: any; update: (p: any) => void; onDone: () => void; onExample: () => void;
  plus?: boolean; onUpgrade?: () => void;
}) {
  // A brand-new plan is one person until "You" on the code ring says otherwise,
  // so somebody planning alone never has to clear a partner's figures.
  useEffect(() => {
    const B = plan.partnerB || {};
    const partnerHasFigures = (B.pension || 0) + (B.isa || 0) + (B.db || 0) + (B.monthlyPension || 0) > 0
      || (B.dbSchemes || []).length > 0;
    if (!partnerHasFigures) update((q: any) => ({ ...q, household: 'single' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div className="cx fixed inset-0 z-[60] overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ background: 'radial-gradient(120% 80% at 50% 0%, #0e1620 0%, #070b10 62%)' }}>
      <div className="mx-auto max-w-[520px] px-6 min-h-full flex flex-col justify-center text-center py-[max(2rem,env(safe-area-inset-top))]">
        <svg width="56" height="56" viewBox="0 0 42 42" fill="none" className="mx-auto mb-4" aria-hidden="true">
          <path d="M9 27a12 12 0 0 1 24 0" stroke="#dcc08c" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="21" cy="27" r="4.5" stroke="#dcc08c" strokeWidth="2.4" />
          <path d="M4 32.5h34" stroke="#dcc08c" strokeWidth="2.4" strokeLinecap="round" opacity=".5" />
        </svg>
        <h1 className="cx-serif text-[2.6rem] leading-[1.02]">See the day<br /><em style={{ color: 'var(--cx-gold)' }}>you can stop.</em></h1>
        <p className="mt-4 text-[1rem] leading-relaxed" style={{ color: 'var(--cx-dim)' }}>
          Your plan is a code of six pieces. Set each one and it unlocks your answer. Everything stays on this device.
        </p>
        <button onClick={onDone} className="mt-8 w-full rounded-2xl py-4 font-semibold text-[1.05rem] active:scale-[0.98] transition-transform"
          style={{ background: 'rgba(220,192,140,.16)', border: '1px solid rgba(220,192,140,.6)', color: 'var(--cx-gold-hi)' }}>Begin</button>
        <button onClick={onExample} className="mt-3 w-full py-2 font-medium text-[0.95rem]" style={{ color: 'var(--cx-dim)' }}>
          Or see a worked example
        </button>
      </div>
    </motion.div>
  );
}
