import { fmt } from '../lib/format';
import { LS, standardsFor, whoText } from '../lib/livingStandards';

/**
 * The three Retirement Living Standards for this household, as tappable
 * reference points beside the income question. A reference, not a target:
 * the figures assume the home is paid off, so renters need more.
 */
export default function LivingStandards({ plan, onPick }: { plan: any; onPick: (net: number) => void }) {
  const S = standardsFor(plan);
  return (
    <div role="group" aria-label="Retirement Living Standards">
      <p className="text-[0.73rem] leading-snug" style={{ color: 'var(--color-ink-faint)' }}>
        What retirement costs for {whoText(plan)}, after tax, with the home paid off — Pensions UK Retirement Living Standards, {LS.asOf} edition. Tap one to use it.
      </p>
      <div className="flex gap-1.5 mt-2">
        {LS.tiers.map(t => {
          const v = S[t], on = Math.round(plan.targetNet || 0) === v;
          return (
            <button key={t} type="button" aria-pressed={on} onClick={() => onPick(v)}
              className="flex-1 min-w-0 rounded-[12px] min-h-[44px] px-1.5 py-1.5 text-center transition-colors active:scale-[0.97]"
              style={{
                background: on ? 'color-mix(in srgb, var(--color-calm) 16%, transparent)' : 'color-mix(in srgb, var(--color-ink) 5%, transparent)',
                border: `1px solid ${on ? 'var(--color-calm)' : 'var(--color-hairline)'}`,
                color: 'var(--color-ink)',
              }}>
              <span className="block text-[0.78rem] font-bold leading-tight">{LS.labels[t]}</span>
              <span className="block tnum text-[0.7rem] leading-tight mt-0.5" style={{ color: 'var(--color-ink-dim)' }}>{fmt(v / 12)} a month</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
