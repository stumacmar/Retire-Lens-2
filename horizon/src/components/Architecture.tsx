import { MoneyField, NumField, PctField, Toggle, Segmented } from './Field';
import Group from './Group';
import { rulesInPounds, rulesWords } from '../lib/rulesInPounds';


// ── Plan structure: the architecture controls ───────────────────────────
// A real plan is not one growth rate. It is a shape: safe money for the next
// few years, a growth engine behind it, and written rules for when to trim.
//
// Optional (owner, 17 November 2026: the ladder is "too specific to me for a
// UX that I could sell"). Every plan starts as one invested pot; the ladder is
// switched on here, never asked about during setup.
export const ARCH_PRESET = {
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

export default function ArchitectureSection({ plan, update }: { plan: any; update: (p: any) => void }) {
  const A = plan.architecture || {};
  // Keep the recorded approach in step with the switch, so the two can never
  // disagree about what the plan is doing.
  const set = (patch: any) => update((p: any) => ({
    ...p,
    ...(patch.on === undefined ? {} : { approach: patch.on ? 'derisking' : 'traditional' }),
    architecture: { ...p.architecture, ...patch },
  }));
  const on = !!A.on;
  return (
    <>
      <Group title="Safe ladder (optional)">
        <Toggle label="Use a safe ladder and spending rules" checked={on} onChange={v => set(v ? ARCH_PRESET : { on: false })} />
        <p className="text-[0.875rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          On, the next few years of spending are held in government bonds (gilts) and cash, the rest is left to grow, and written
          rules trim spending if the plan drifts off track. Explore measures whether it is worth it on your figures.
        </p>
      </Group>

      {on && <>
      <Group title="The gilt ladder (your envelopes)">
        <NumField label="Years of spending held in gilts" value={A.ladderYears ?? 7} onChange={v => set({ ladderYears: Math.max(0, Math.min(15, v)) })} />
        <span className="block text-[0.875rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>The conveyor belt</span>
        <Segmented small value={A.refill || 'whenUp'} onChange={(v: string) => set({ refill: v })}
          options={[{ value: 'whenUp', label: 'Top up only after a good year' }, { value: 'always', label: 'Top up every year' }]} />
        <p className="text-[0.875rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          Each envelope is sized to one year's spending after your guaranteed income. Spending comes out of the
          envelopes, so the engine is never sold into a fallen market. Index-linked gilts held to maturity are
          modelled as a known real return — which is the whole point of the ladder.
        </p>
        <PctField label="Gilt real return (after inflation)" value={A.giltReal ?? 0.015} onChange={v => set({ giltReal: v })} />
      </Group>

      <Group title="The growth engine">
        <PctField label="Equity real return" value={A.equityReal ?? 0.05} onChange={v => set({ equityReal: v })} />
        <PctField label="Equity volatility" value={A.equitySd ?? 0.16} onChange={v => set({ equitySd: v })} />
        <PctField label="Gold & diversifiers — share of the engine" value={A.goldPct ?? 0.15} onChange={v => set({ goldPct: v })} />
        <PctField label="Gold real return" value={A.goldReal ?? 0.01} onChange={v => set({ goldReal: v })} />
        <p className="text-[0.875rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          A single low-cost global all-world fund is the usual engine. Returns here are <b>real</b> — the Poor /
          Base / Positive lens shifts them all together.
        </p>
      </Group>

      <Group title="Written spending rules">
        <Toggle label="Trim and treat on a funded-ratio trigger" checked={A.rulesOn !== false} onChange={v => set({ rulesOn: v })} />
        <p className="text-[0.875rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          The funded ratio is everything you have, over everything you still need to a conservative age — so the
          rule fires on the plan's health, not on a market headline.
        </p>
        <NumField label="Longevity age used as the denominator" value={A.longevityAge ?? 95} onChange={v => set({ longevityAge: v })} />
        <PctField label="Trim spending when the ratio falls below" value={A.cutBelow ?? 0.9} onChange={v => set({ cutBelow: v })} />
        <PctField label="…trim by" value={A.cutBy ?? 0.1} onChange={v => set({ cutBy: v })} />
        <PctField label="Allow a treat when the ratio is above" value={A.raiseAbove ?? 1.25} onChange={v => set({ raiseAbove: v })} />
        <NumField label="…only after this many good years (the lag)" value={A.raiseLagYears ?? 2} onChange={v => set({ raiseLagYears: v })} />
        <PctField label="Never trim below this share of plan spending" value={A.floorMult ?? 0.75} onChange={v => set({ floorMult: v })} />
        {/* The same rules in pounds: what to watch for on a statement, and what changes when it happens. */}
        {(() => { const R = A.rulesOn !== false ? rulesInPounds(plan) : null; return R && (
          <p data-rules-pounds className="text-[0.875rem] leading-relaxed rounded-xl px-3 py-2" style={{ background: 'var(--color-canvas)', color: 'var(--color-ink)' }}>
            <b>On your figures.</b> {rulesWords(R)}
          </p>); })()}
      </Group>

      <Group title="The annuity review">
        <Toggle label="Buy guaranteed income at a planned date" checked={!!A.annuityOn} onChange={v => set({ annuityOn: v })} />
        {A.annuityOn && <>
          <NumField label="Year of the review" value={A.annuityYear ?? 2037} onChange={v => set({ annuityYear: v })} />
          <MoneyField label="Amount to convert (today's money)" value={A.annuityAmount ?? 150000} onChange={v => set({ annuityAmount: v })} />
          <PctField label="Annuity rate" value={A.annuityRate ?? 0.06} onChange={v => set({ annuityRate: v })} />
          <Toggle label="Rises with inflation" checked={A.annuityIndexed !== false} onChange={v => set({ annuityIndexed: v })} />
          <p className="text-[0.875rem]" style={{ color: 'var(--color-ink-dim)' }}>
            Converts part of the pension into taxable income for life. Rates quoted today are a guide only — an
            advice-grade decision to take with quotes in hand.
          </p>
        </>}
      </Group>

      <Group title="Care, and the house as a parachute">
        <Toggle label="Model a block of care costs" checked={!!A.careOn} onChange={v => set({ careOn: v })} />
        {A.careOn && <>
          <NumField label="From age" value={A.careFromAge ?? 85} onChange={v => set({ careFromAge: v })} />
          <MoneyField label="Cost a year (today's money)" value={A.careAnnual ?? 45000} onChange={v => set({ careAnnual: v })} />
          <NumField label="For how many years" value={A.careYears ?? 4} onChange={v => set({ careYears: v })} />
        </>}
        <Toggle label="Release housing wealth if the plan goes off track" checked={!!A.parachuteOn} onChange={v => set({ parachuteOn: v })} />
        {A.parachuteOn && <>
          <NumField label="Not before age" value={A.parachuteFrom ?? 80} onChange={v => set({ parachuteFrom: v })} />
          <PctField label="Only if the funded ratio falls below" value={A.parachuteBelow ?? 0.75} onChange={v => set({ parachuteBelow: v })} />
          <PctField label="Share of the house released" value={A.parachuteFraction ?? 0.5} onChange={v => set({ parachuteFraction: v })} />
        </>}
        <p className="text-[0.875rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          The house stays out of core funding — it is released once, late, and only if the plan is genuinely off track.
        </p>
      </Group>

      <Group title="How the verdict is judged">
        <span className="block text-[0.875rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>How much a lean year hurts</span>
        <Segmented small value={String(A.riskAversion ?? 4)} onChange={(v: string) => set({ riskAversion: Number(v) })}
          options={[{ value: '2', label: 'Relaxed' }, { value: '4', label: 'Typical' }, { value: '8', label: 'Cautious' }]} />
        <p className="text-[0.875rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          Explore answers <b>is the structure worth it</b> by comparing the spending each plan actually delivers, not
          by counting survivals — a rule that trims spending must not score as a win for cutting what you live on.
          This setting says how much more a lean year hurts than a plump one helps, which is what decides the verdict.
        </p>
      </Group>

      <Group title="Stress the sequence">
        <span className="block text-[0.875rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>Force a historic bad start</span>
        <Segmented small value={A.stressPath || 'none'} onChange={(v: string) => set({ stressPath: v })}
          options={[{ value: 'none', label: 'Normal' }, { value: 'japan', label: 'Japan 1990' },
                    { value: 'gfc', label: 'GFC 2008' }, { value: 'stagflation', label: '1970s' }]} />
        <p className="text-[0.875rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
          Replays an approximate historic real-return sequence through your growth engine from the year you stop
          work. Illustrative shapes of a bad decade, not precise history.
        </p>
      </Group>
      </>}
    </>
  );
}
