import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { PRODUCT } from '../config/product';

const KEY = 'someday-disclaimer-v1';

export function disclaimerAccepted(): boolean {
  try { return localStorage.getItem(KEY) === PRODUCT.disclaimerVersion; } catch { return false; }
}
export function acceptDisclaimer() {
  try { localStorage.setItem(KEY, PRODUCT.disclaimerVersion); } catch { /* private mode */ }
}

/**
 * Accepted once, before the first horizon. Calm, plain, and legally explicit:
 * guidance, not regulated advice; estimates, not promises; private by design.
 */
export default function Disclaimer({ onAccept }: { onAccept: () => void }) {
  const rows: [string, string][] = [
    ['Guidance, not advice', 'Someday is an educational planning tool. It is not regulated financial advice and not a personal recommendation.'],
    ['Estimates, not promises', 'Projections rest on assumptions you can change. Real markets, tax rules and your own life will differ.'],
    ['Private by design', 'Your figures stay on this device. The only thing Someday ever sends anywhere is a Plus licence key, if you buy one.'],
    ['For decisions, a person', 'Before acting, talk to an adviser authorised by the Financial Conduct Authority. Bring the report — that is what it is for.'],
  ];
  return (
    <motion.div className="fixed inset-0 z-[60] overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ background: 'var(--color-canvas)' }}>
      <div className="mx-auto max-w-[480px] px-6 min-h-full flex flex-col justify-center py-[max(2rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--color-sage-strong)' }}>
          <ShieldCheck size={20} />
          <span className="text-[0.78rem] font-bold uppercase tracking-widest">Before you start</span>
        </div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight leading-tight">A calm place to think — not a verdict.</h1>
        <div className="mt-5 space-y-2.5">
          {rows.map(([t, d]) => (
            <div key={t} className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
              <div className="font-bold text-[0.95rem]">{t}</div>
              <div className="mt-0.5 text-[0.86rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{d}</div>
            </div>
          ))}
        </div>
        <button onClick={() => { acceptDisclaimer(); onAccept(); }}
          className="mt-7 w-full rounded-2xl py-4 font-bold text-[1.05rem] text-white active:scale-[0.98] transition-transform"
          style={{ background: 'var(--color-calm)' }}>
          I understand — show me my horizon
        </button>
        <p className="mt-3 text-center text-[0.78rem]" style={{ color: 'var(--color-ink-faint)' }}>
          By continuing you accept the{' '}
          <a href={PRODUCT.legalUrl} target="_blank" rel="noopener" className="underline">terms, disclaimer and privacy notice</a>.
          UK tax year 2026/27.
        </p>
      </div>
    </motion.div>
  );
}
