import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sheet from './Sheet';
import Constellation, { NODES, NodeEditor, Sky, clarityOf, nodeState, type NodeId } from './Constellation';

/**
 * Vision-first onboarding: a welcome, then your own sky.
 *
 * Instead of a long vertical form, setup IS the product's main visual — a
 * ghosted dawn horizon with four constellations on it. You fill them in any
 * order, each one sharpens the picture, and the moment there is enough to
 * draw a real future you are invited in. Same interface you will use to edit
 * the plan forever, so it is learned exactly once.
 */
export default function Onboarding({ plan, update, onDone, onExample, viz, horizonYear, lasts, plus, onUpgrade }: {
  plan: any; update: (p: any) => void; onDone: () => void; onExample: () => void;
  viz: any; horizonYear: number; lasts: boolean; plus: boolean; onUpgrade: () => void;
}) {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState<NodeId | null>(null);
  // A brand-new plan starts as one person, so somebody planning alone never
  // has to clear a partner's figures. "You & yours" makes the choice plainly.
  useEffect(() => {
    const B = plan.partnerB || {};
    const partnerHasFigures = (B.pension || 0) + (B.isa || 0) + (B.db || 0) + (B.monthlyPension || 0) > 0
      || (B.dbSchemes || []).length > 0;
    if (!partnerHasFigures) update((q: any) => ({ ...q, household: 'single' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const node = useMemo(() => NODES.find(n => n.id === open), [open]);
  const clarity = clarityOf(plan);
  const ready = nodeState(plan, 'saved') === 'done';     // a picture needs money in it
  const left = NODES.filter(n => !n.optional && nodeState(plan, n.id) !== 'done');

  const select = (id: NodeId) => {
    setOpen(id);
    update((p: any) => ({ ...p, reviewed: { ...(p.reviewed || {}), [id]: true } }));
  };

  return (
    <motion.div className="fixed inset-0 z-[60] overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: 'var(--color-canvas)' }}>
      <div className="mx-auto max-w-[560px] lg:max-w-[760px] px-6 min-h-full flex flex-col justify-center py-[max(2rem,env(safe-area-inset-top))]">
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
                A private, calm look at your retirement. You will build your own horizon, a piece at a time —
                and everything stays on this device.
              </p>
              <button onClick={() => setStep(1)}
                className="mt-8 w-full rounded-2xl py-4 font-bold text-[1.05rem] text-[var(--color-ink)] active:scale-[0.98] transition-transform"
                style={{ background: 'var(--color-calm)' }}>Begin</button>
              <button onClick={onExample} className="mt-3 w-full py-2 font-semibold text-[0.95rem]" style={{ color: 'var(--color-calm-strong)' }}>
                Or see a worked example
              </button>
            </motion.div>
          ) : (
            <motion.div key="sky"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.2, 0.7, 0.3, 1] }}>
              <h1 className="text-[1.6rem] font-extrabold tracking-tight">Build your sky.</h1>
              <p className="mt-2 text-[0.95rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
                Four points of light, in any order. Each one you fill brings your horizon into focus.
              </p>

              <div className="mt-2">
                <Sky plan={plan} viz={viz} horizonYear={horizonYear} lasts={lasts}
                     onSelect={select} height={340} />
              </div>

              {/* A quiet checklist — also the keyboard route to each constellation */}
              <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
                {NODES.filter(n => !n.optional).map(n => {
                  const st = nodeState(plan, n.id);
                  return (
                    <button key={n.id} onClick={() => select(n.id)}
                      className="flex items-center gap-1.5 text-[0.76rem] py-1"
                      style={{ color: st === 'done' ? 'var(--color-ink-dim)' : 'var(--color-ink-faint)' }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: 8, display: 'inline-block',
                        background: st === 'done' ? 'var(--color-sage-strong)' : 'transparent',
                        border: `1.5px solid ${st === 'done' ? 'var(--color-sage-strong)' : 'var(--color-calm)'}`,
                      }} />
                      {n.title}
                    </button>
                  );
                })}
              </div>

              <button onClick={onDone} disabled={!ready}
                className="mt-5 w-full rounded-2xl py-4 font-bold text-[1.05rem] active:scale-[0.98] transition-all"
                style={{
                  background: ready ? 'var(--color-calm)' : 'var(--color-canvas)',
                  color: ready ? 'var(--color-ink)' : 'var(--color-ink-faint)',
                  border: ready ? 'none' : '1px solid var(--color-hairline)',
                  cursor: ready ? 'pointer' : 'not-allowed',
                }}>
                {ready ? 'See my horizon →' : 'Add what you’ve saved to begin'}
              </button>
              {ready && left.length > 0 && (
                <p className="mt-2 text-center text-[0.78rem]" style={{ color: 'var(--color-ink-faint)' }}>
                  {Math.round(clarity * 100)}% in focus — you can fill the rest later.
                </p>
              )}
              <button onClick={() => setStep(0)} className="mt-3 mx-auto block py-2 text-[0.9rem] font-medium"
                style={{ color: 'var(--color-ink-faint)' }}>← Back</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Sheet open={!!node} onClose={() => setOpen(null)} title={node?.title}>
        {node && <>
          <p className="text-[0.84rem] -mt-2 mb-4" style={{ color: 'var(--color-ink-faint)' }}>{node.blurb}</p>
          <NodeEditor id={node.id} plan={plan} update={update} plus={plus} onUpgrade={onUpgrade} />
          <button onClick={() => setOpen(null)}
            className="mt-5 w-full rounded-2xl py-3.5 font-bold text-[1rem] text-[var(--color-ink)] active:scale-[0.98] transition-transform"
            style={{ background: 'var(--color-calm)' }}>Done</button>
        </>}
      </Sheet>
    </motion.div>
  );
}

// Re-exported so the app can share one interface between setup and editing.
export { Constellation };
