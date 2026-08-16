import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, ShieldCheck } from 'lucide-react';
import { E } from '../lib/usePlan';
import { fmt, fmtK } from '../lib/format';

/**
 * The choice that frames everything else: how should the money be run?
 *
 * Shown once, before the horizon, and never as a quiz — two honest ways to
 * fund a retirement, each with its cost stated. Where the plan has real
 * figures in it we measure the difference for THIS household rather than
 * describing it in the abstract, because the whole product's claim is that it
 * shows you the trade-off instead of asserting one.
 */
export const DERISKING_ARCHITECTURE = {
  on: true,
  ladderYears: 7, refill: 'whenUp', refillMin: 0,
  equityReal: 0.05, equitySd: 0.16, goldReal: 0.01, goldSd: 0.14, goldPct: 0.15,
  giltReal: 0.015,
  rulesOn: true, longevityAge: 95,
  cutBelow: 0.90, cutBy: 0.10, raiseAbove: 1.25, raiseBy: 0.05, raiseLagYears: 2,
  floorMult: 0.75, capMult: 1.25,
  parachuteOn: true, parachuteBelow: 0.75, parachuteFrom: 80, parachuteFraction: 0.5,
  annuityOn: false, careOn: false, stressPath: 'none', riskAversion: 4,
};

export default function Approach({ plan, update, onDone }: {
  plan: any; update: (p: any) => void; onDone: () => void;
}) {
  const A = plan.partnerA, B = plan.partnerB;
  const hasMoney = (A.pension + A.isa + A.monthlyPension + A.monthlyIsa + A.db
    + B.pension + B.isa + B.monthlyPension + B.monthlyIsa + B.db + (plan.cash || 0)) > 0;

  // Measured lazily, after the screen has painted — the choice must never
  // wait on a simulation.
  const [cmp, setCmp] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!hasMoney) return;
    const t = setTimeout(() => {
      try {
        setCmp((E as any).assessStructure(
          { ...plan, architecture: { ...(plan.architecture || {}), ...DERISKING_ARCHITECTURE } },
          { paths: 200, drivers: false },
        ));
      } catch { setFailed(true); }
    }, 60);
    return () => clearTimeout(t);
  }, [hasMoney]);   // once per visit to this screen

  const choose = (which: 'traditional' | 'derisking') => {
    update((p: any) => ({
      ...p,
      approach: which,
      architecture: which === 'derisking'
        ? { ...(p.architecture || {}), ...DERISKING_ARCHITECTURE }
        : { ...(p.architecture || {}), on: false },
    }));
    onDone();
  };

  const Card = ({ id, icon, title, line, points, cost, figure }: {
    id: 'traditional' | 'derisking'; icon: React.ReactNode; title: string;
    line: string; points: string[]; cost: string; figure?: React.ReactNode;
  }) => (
    <button onClick={() => choose(id)}
      className="w-full text-left rounded-3xl p-5 active:scale-[0.985] transition-transform"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)',
               boxShadow: '0 1px 2px rgba(60,50,35,0.05), 0 10px 28px rgba(60,50,35,0.06)' }}>
      <div className="flex items-center gap-2.5">
        <span style={{ color: id === 'derisking' ? 'var(--color-sage-strong)' : 'var(--color-calm-strong)' }}>{icon}</span>
        <h2 className="text-[1.15rem] font-extrabold tracking-tight">{title}</h2>
      </div>
      <p className="mt-1.5 text-[0.92rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{line}</p>
      <ul className="mt-3 space-y-1.5">
        {points.map(t => (
          <li key={t} className="flex gap-2 text-[0.85rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
            <span aria-hidden="true" style={{ color: 'var(--color-ink-faint)' }}>·</span>{t}
          </li>
        ))}
      </ul>
      {figure}
      <p className="mt-3 text-[0.8rem] font-semibold" style={{ color: 'var(--color-hope)' }}>{cost}</p>
    </button>
  );

  const Figure = ({ spend, legacy }: { spend: number; legacy: number }) => (
    <div className="mt-3 rounded-2xl px-4 py-3" style={{ background: 'var(--color-canvas)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.78rem]" style={{ color: 'var(--color-ink-dim)' }}>Dependable spending</span>
        <span className="tnum text-[1rem] font-extrabold">{fmt(Math.round(spend))}<span className="text-[0.72rem] font-semibold" style={{ color: 'var(--color-ink-faint)' }}>/yr</span></span>
      </div>
      <div className="flex items-baseline justify-between gap-3 mt-0.5">
        <span className="text-[0.78rem]" style={{ color: 'var(--color-ink-dim)' }}>Typically left over</span>
        <span className="tnum text-[0.9rem] font-bold" style={{ color: 'var(--color-ink-dim)' }}>{fmtK(legacy)}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-full mx-auto max-w-[560px] lg:max-w-[900px] px-5 pb-16"
         style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">How should the money be run?</h1>
        <p className="mt-2.5 text-[0.98rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          Two honest ways to fund a retirement. Neither is right for everyone, and you can switch whenever you like —
          the whole plan simply recalculates.
        </p>

        <div className="mt-6 space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
          <Card id="traditional"
            icon={<TrendingUp size={20} />}
            title="Traditional"
            line="One invested pot. You draw what you need and keep spending to plan."
            points={[
              'Everything grows at a single assumed rate',
              'Spending stays at your target, come what may',
              'Simplest to run, and usually leaves the most behind',
            ]}
            cost="The cost: a poor decade early on lands with full force."
            figure={cmp ? <Figure spend={cmp.off.ceSpend} legacy={cmp.off.legacyP50Real} /> : undefined}
          />

          <Card id="derisking"
            icon={<ShieldCheck size={20} />}
            title="De-risking"
            line="Safe money for the years just ahead, a growth engine behind it, and written rules."
            points={[
              'The next few years of spending held in index-linked gilts',
              'Topped up from growth only after a good year, so you never sell into a fall',
              'Spending trims automatically if the plan drifts off track',
              'The house kept back as a last resort, never core funding',
            ]}
            cost="The cost: safer income is bought with growth given up."
            figure={cmp ? <Figure spend={cmp.on.ceSpend} legacy={cmp.on.legacyP50Real} /> : undefined}
          />
        </div>

        {hasMoney && !cmp && !failed && (
          <p className="mt-5 text-center text-[0.82rem]" style={{ color: 'var(--color-ink-faint)' }}>
            Working out what each would mean for your numbers…
          </p>
        )}
        {cmp && (
          <p className="mt-5 text-[0.82rem] leading-relaxed text-center" style={{ color: 'var(--color-ink-faint)' }}>
            Measured on your own figures, both run through the same {cmp.paths} simulated markets.
            “Dependable spending” is the level you could count on every year once the bad futures are weighed
            alongside the good.
          </p>
        )}
        <p className="mt-4 text-center text-[0.78rem]" style={{ color: 'var(--color-ink-faint)' }}>
          A modelling illustration, not financial advice. Your figures never leave this device.
        </p>
      </motion.div>
    </div>
  );
}
