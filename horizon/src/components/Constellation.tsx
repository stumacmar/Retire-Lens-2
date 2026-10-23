import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Plus, X } from 'lucide-react';
import HorizonViz from './HorizonViz';
import Group from './Group';
import Accordion from './Accordion';
import ArchitectureSection from './Architecture';
import { MoneyField, NumField, PctField, Toggle, Segmented } from './Field';
import { fmtK } from '../lib/format';

/**
 * Build your sky.
 *
 * The setup screen and the editing screen are the same thing: your own dawn
 * horizon, ghosted and out of focus until it knows enough about you. Four
 * constellations sit on it at meaningful places — today on the left, the
 * moment you stop in the middle, the income that arrives later on the right —
 * and filling one brings that part of the picture into focus. The progress
 * indicator is not a bar; it is how sharp your future has become.
 */

export type NodeId = 'you' | 'saved' | 'guaranteed' | 'someday' | 'run';

export interface NodeDef {
  id: NodeId; title: string; blurb: string;
  x: number; y: number;          // percentage position on the sky
  // Labels near an edge are nudged inward so they never clip; the dot itself
  // stays exactly where the data says it should be.
  labelShift?: number;           // percentage of the label's own width
  optional?: boolean;
}

// Position carries meaning: x is roughly time, y is roughly wealth — the same
// grammar as the chart underneath.
export const NODES: NodeDef[] = [
  { id: 'you',        title: 'You & yours',     blurb: 'Who the plan is for',           x: 19, y: 70 },
  { id: 'saved',      title: "What you've saved", blurb: 'Pensions, ISAs, savings',     x: 33, y: 36 },
  { id: 'someday',    title: 'Your someday',    blurb: 'When you stop, what you spend', x: 58, y: 18 },
  { id: 'guaranteed', title: "What's promised", blurb: 'State & company pensions',      x: 74, y: 48, labelShift: -30 },
  { id: 'run',        title: "How it's run",    blurb: 'Strategy, tax, structure',      x: 50, y: 76, optional: true },
];

/** Has this part of the plan got real information in it yet? */
export function nodeState(plan: any, id: NodeId): 'empty' | 'assumed' | 'done' {
  const A = plan.partnerA, B = plan.partnerB;
  const seen = (plan.reviewed || {})[id];
  switch (id) {
    case 'you': {
      const named = A.name && A.name !== 'You';
      const born = A.birthYear > 1900;
      return named && born ? 'done' : (born ? 'assumed' : 'empty');
    }
    case 'saved': {
      const pots = A.pension + A.isa + B.pension + B.isa
        + A.monthlyPension + A.monthlyIsa + B.monthlyPension + B.monthlyIsa + (plan.cash || 0);
      return pots > 0 ? 'done' : 'empty';
    }
    case 'guaranteed': {
      const any = A.spAmount > 0 || B.spAmount > 0 || A.db > 0 || B.db > 0;
      if (!any) return 'empty';
      return seen ? 'done' : 'assumed';
    }
    case 'someday': {
      if (!(plan.targetNet > 0)) return 'empty';
      return seen ? 'done' : 'assumed';
    }
    case 'run':
      return plan.approach ? 'done' : 'assumed';
  }
}

/** How sharply the horizon can be drawn, 0..1 — the real progress measure. */
export function clarityOf(plan: any): number {
  const core: NodeId[] = ['you', 'saved', 'someday', 'guaranteed'];
  const score = (s: string) => (s === 'done' ? 1 : s === 'assumed' ? 0.5 : 0);
  // Saved counts double: with no money in it there is no picture to draw.
  const weights: Record<string, number> = { you: 1, saved: 2, someday: 1, guaranteed: 1 };
  let got = 0, max = 0;
  for (const id of core) { got += score(nodeState(plan, id)) * weights[id]; max += weights[id]; }
  return Math.max(0, Math.min(1, got / max));
}

// ── The sky ────────────────────────────────────────────────────────────────
export function Sky({ plan, viz, horizonYear, lasts, dryYear, onSelect, height = 320 }: {
  plan: any; viz: any; horizonYear: number; lasts: boolean; dryYear?: number | null;
  onSelect: (id: NodeId) => void; height?: number;
}) {
  const clarity = clarityOf(plan);
  // Out of focus until it knows you: never fully hidden, never falsely sharp.
  const chart = { opacity: 0.34 + 0.66 * clarity, filter: `blur(${(1 - clarity) * 3.4}px)` };

  return (
    // The box takes the chart's own proportions, so a node at 58% x really
    // does sit where the chart's 58% is — position has to mean something.
    <div className="relative w-full mx-auto" style={{ aspectRatio: '400 / 250', maxWidth: height ? height * 1.6 : undefined }}>
      <div className="absolute inset-0 transition-all duration-700" style={chart} aria-hidden="true">
        <HorizonViz base={viz.base} low={viz.low} high={viz.high}
          startYear={plan.startYear} retireYear={plan.retireYear} horizonYear={horizonYear}
          retireWealth={viz.atRetire} lasts={lasts} dryYear={dryYear}
          inflation={plan.inflation} birthYear={plan.partnerA.birthYear} />
      </div>

      {NODES.map((n, i) => {
        const st = nodeState(plan, n.id);
        const done = st === 'done';
        const colour = n.optional ? 'var(--color-ocean)'
          : done ? 'var(--color-sage-strong)' : 'var(--color-calm)';
        return (
          <motion.button key={n.id}
            onClick={() => onSelect(n.id)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.06 * i, type: 'spring', stiffness: 300, damping: 22 }}
            className="absolute flex flex-col items-center"
            style={{ left: `${n.x}%`, top: `${n.y}%`, transform: 'translate(-50%,-50%)',
                     minWidth: 44, minHeight: 44, padding: 4 }}
            aria-label={`${n.title} — ${st === 'done' ? 'complete' : st === 'assumed' ? 'assumed, worth checking' : 'not filled in yet'}`}>
            <span className="relative flex items-center justify-center" style={{ width: 26, height: 26 }}>
              {/* a gentle beacon while it is still waiting for you */}
              {!done && (
                <motion.span className="absolute rounded-full"
                  style={{ width: 26, height: 26, background: colour }}
                  animate={{ opacity: [0.28, 0.06, 0.28], scale: [1, 1.7, 1] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }} />
              )}
              <span className="relative rounded-full" style={{
                width: done ? 15 : 12, height: done ? 15 : 12,
                background: done ? colour : 'transparent',
                border: `2px solid ${colour}`,
                boxShadow: done ? `0 0 14px ${colour}` : 'none',
                transition: 'all .4s',
              }} />
            </span>
            <span className="mt-1.5 text-[0.64rem] font-bold whitespace-nowrap px-1.5 py-0.5 rounded-full"
                  style={{ color: done ? 'var(--color-ink)' : 'var(--color-ink-dim)',
                           background: 'color-mix(in srgb, var(--color-canvas) 78%, transparent)',
                           transform: n.labelShift ? `translateX(${n.labelShift}%)` : undefined }}>
              {n.title}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Per-person field groups ────────────────────────────────────────────────
function aggregatePots(pots: any[]) {
  const val = (q: any) => Number(q.value) || 0;
  const acc = (q: any) => Math.min(Number(q.accessed) || 0, val(q));
  const unc = (q: any) => Math.max(0, val(q) - acc(q));
  const totalUnc = pots.reduce((s, q) => s + unc(q), 0);
  return {
    pension: pots.reduce((s, q) => s + val(q), 0),
    crystallised: pots.reduce((s, q) => s + acc(q), 0),
    tfcRate: totalUnc > 0
      ? pots.reduce((s, q) => s + ((Number(q.tfcPct) || 25) / 100) * unc(q), 0) / totalUnc : 0.25,
  };
}

function SchemeList({ who, set }: { who: any; set: (patch: any) => void }) {
  const pots = who.pots || [];
  const commit = (next: any[]) => set({ pots: next, ...aggregatePots(next) });
  const edit = (i: number, patch: any) => commit(pots.map((q: any, j: number) => (j === i ? { ...q, ...patch } : q)));
  const add = () => commit([...pots, pots.length === 0
    ? { label: 'Scheme 1', value: who.pension || 0, accessed: who.crystallised || 0, tfcPct: 25 }
    : { label: `Scheme ${pots.length + 1}`, value: 0, accessed: 0, tfcPct: 25 }]);
  const del = (i: number) => commit(pots.filter((_: any, j: number) => j !== i));
  return (
    <div className="rounded-2xl p-3 space-y-3" style={{ background: 'var(--color-canvas)' }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.8rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>Pension schemes (DC)</span>
        {pots.length > 0 && (
          <span className="tnum text-[0.72rem] text-right" style={{ color: 'var(--color-ink-faint)' }}>
            total {fmtK(who.pension || 0)} · untouched {fmtK(Math.max(0, (who.pension || 0) - (who.crystallised || 0)))} · tax-free {Math.round((who.tfcRate ?? 0.25) * 100)}%
          </span>
        )}
      </div>
      {pots.map((q: any, i: number) => (
        <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
          <div className="flex items-center gap-2">
            <input className="flex-1 bg-transparent outline-none font-semibold text-[0.92rem]" value={q.label}
              onChange={e => edit(i, { label: e.target.value })} aria-label="Scheme name" />
            <button onClick={() => del(i)} aria-label="Remove scheme" style={{ color: 'var(--color-ink-faint)' }}><X size={15} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MoneyField label="Value" value={q.value || 0} onChange={v => edit(i, { value: v })} />
            <MoneyField label="Already accessed" value={q.accessed || 0} onChange={v => edit(i, { accessed: v })} />
          </div>
          <NumField label="Tax-free entitlement (25 unless protected)" value={q.tfcPct ?? 25} suffix="%" onChange={v => edit(i, { tfcPct: v })} />
        </div>
      ))}
      <button onClick={add} className="flex items-center justify-center gap-1.5 w-full rounded-xl py-2.5 text-[0.85rem] font-semibold"
        style={{ background: 'var(--color-surface)', color: 'var(--color-calm-strong)', border: '1px solid var(--color-hairline)' }}>
        <Plus size={15} /> Add a scheme
      </button>
    </div>
  );
}

function Saved({ who, set, adv }: { who: any; set: (patch: any) => void; adv: boolean }) {
  const hasPots = (who.pots || []).length > 0;
  return (
    <Group title={who.name}>
      {!(adv && hasPots) &&
        <MoneyField label="Workplace pension (defined contribution) today" value={who.pension}
          onChange={v => set({ pension: v, pots: [], tfcRate: 0.25 })} />}
      {adv && <SchemeList who={who} set={set} />}
      <MoneyField label="Paying into pension monthly" value={who.monthlyPension} onChange={v => set({ monthlyPension: v })} />
      <MoneyField label="ISAs today" value={who.isa} onChange={v => set({ isa: v })} />
      <MoneyField label="Paying into ISAs monthly" value={who.monthlyIsa} onChange={v => set({ monthlyIsa: v })} />
      {adv && <MoneyField label="Annual income (for the pension-allowance taper)" value={who.income || 0} onChange={v => set({ income: v })} />}
      <Accordion title="Already taken tax-free cash or accessed the pension?">
        <MoneyField label="Tax-free cash already taken" value={who.pclsTaken || 0} onChange={v => set({ pclsTaken: v })} />
        {adv && hasPots ? (
          <p className="text-[0.78rem]" style={{ color: 'var(--color-ink-faint)' }}>
            Accessed amounts come from your scheme list above ({fmtK(who.crystallised || 0)} in total).
          </p>
        ) : (
          <MoneyField label="Pension already accessed (crystallised)" value={who.crystallised || 0} onChange={v => set({ crystallised: v })} />
        )}
        <p className="text-[0.78rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
          Only the untouched part of a pension can still pay 25% tax-free, and the lifetime cash cap
          (£268,275) is reduced by what you've already taken. New contributions rebuild the untouched part.
        </p>
      </Accordion>
    </Group>
  );
}

function Promised({ who, set, adv, retireYear }: { who: any; set: (patch: any) => void; adv: boolean; retireYear: number }) {
  return (
    <Group title={who.name}>
      <NumField label="State Pension age" value={who.spAge} onChange={v => set({ spAge: v })} />
      <MoneyField label="State Pension a year" value={who.spAmount} onChange={v => set({ spAmount: v })} />
      <MoneyField label="Company / final-salary (defined benefit) pension a year" value={who.db}
        onChange={v => set({ db: v,
          // First time a DB pension is entered, assume it starts when you stop
          // work — otherwise it silently sits on a default year in the past.
          dbStartYear: v > 0 && !(who.db > 0) ? retireYear : who.dbStartYear })} />
      {who.db > 0 && <>
        <NumField label="…starts in (year)" value={who.dbStartYear} onChange={v => set({ dbStartYear: v })} />
        <Toggle label="…rises with inflation" checked={!!who.dbIndexed} onChange={v => set({ dbIndexed: v })} />
        {adv && <MoneyField label="DB transfer value (CETV), if quoted" value={who.dbTransferValue || 0} onChange={v => set({ dbTransferValue: v })} />}
      </>}
    </Group>
  );
}

// ── The editors behind each constellation ──────────────────────────────────
export function NodeEditor({ id, plan, update, reset }: {
  id: NodeId; plan: any; update: (p: any) => void; reset?: () => void;
}) {
  const setA = (patch: any) => update((p: any) => ({ ...p, partnerA: { ...p.partnerA, ...patch } }));
  const setB = (patch: any) => update((p: any) => ({ ...p, partnerB: { ...p.partnerB, ...patch } }));
  const setInherit = (patch: any) => update((p: any) => ({ ...p, inherit: { ...p.inherit, ...patch } }));
  const addEvent = (kind: string) => update((p: any) => ({
    ...p, lifeEvents: [...(p.lifeEvents || []), { year: p.retireYear + 2, label: kind === 'cost' ? 'One-off cost' : 'Windfall', amount: kind === 'cost' ? 20000 : 40000, kind, invest: kind !== 'cost' }],
  }));
  const setEvent = (i: number, patch: any) => update((p: any) => ({ ...p, lifeEvents: p.lifeEvents.map((e: any, j: number) => j === i ? { ...e, ...patch } : e) }));
  const delEvent = (i: number) => update((p: any) => ({ ...p, lifeEvents: p.lifeEvents.filter((_: any, j: number) => j !== i) }));
  const adv = !!plan.advanced;
  const spendStyle = plan.phase2On ? 'gogo' : plan.phase1On ? 'slowgo' : 'nogo';

  if (id === 'you') return (
    <div className="space-y-6 pb-2">
      <Group title="You">
        <label className="block">
          <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>Your name</span>
          <input value={plan.partnerA.name === 'You' ? '' : plan.partnerA.name} placeholder="You"
            onChange={e => setA({ name: e.target.value || 'You' })}
            className="w-full rounded-2xl px-4 h-[52px] text-[1.15rem] font-semibold outline-none"
            style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }} />
        </label>
        <NumField label="Your birth year" value={plan.partnerA.birthYear} onChange={v => setA({ birthYear: v })} />
      </Group>
      <Group title="Your partner">
        <label className="block">
          <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>Partner's name</span>
          <input value={plan.partnerB.name === 'Partner' ? '' : plan.partnerB.name} placeholder="Partner"
            onChange={e => setB({ name: e.target.value || 'Partner' })}
            className="w-full rounded-2xl px-4 h-[52px] text-[1.15rem] font-semibold outline-none"
            style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }} />
        </label>
        <NumField label="Their birth year" value={plan.partnerB.birthYear} onChange={v => setB({ birthYear: v })} />
        <p className="text-[0.78rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
          Planning alone? Leave the partner blank and set their pots to zero — the plan then runs on your figures only.
        </p>
      </Group>
    </div>
  );

  if (id === 'saved') return (
    <div className="space-y-6 pb-2">
      <div>
        <Toggle label="Advanced — schemes, allowances & transfer values" checked={adv} onChange={v => update({ advanced: v })} />
        <p className="text-[0.78rem] mt-1" style={{ color: 'var(--color-ink-faint)' }}>
          For multiple pensions with different histories, protected tax-free cash and the allowance taper.
        </p>
      </div>
      <Saved who={plan.partnerA} set={setA} adv={adv} />
      <Saved who={plan.partnerB} set={setB} adv={adv} />
      <Group title="Other savings">
        <MoneyField label="Cash & Premium Bonds" value={plan.cash || 0} onChange={v => update({ cash: v })} />
        <MoneyField label="Home value (for net worth and inheritance tax)" value={plan.house || 0} onChange={v => update({ house: v })} />
      </Group>
    </div>
  );

  if (id === 'guaranteed') return (
    <div className="space-y-6 pb-2">
      <p className="text-[0.86rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
        Income that arrives whatever markets do. Check your State Pension forecast at gov.uk — most people
        are not on the full amount, and it is the single biggest number in this section.
      </p>
      <Promised who={plan.partnerA} set={setA} adv={adv} retireYear={plan.retireYear} />
      <Promised who={plan.partnerB} set={setB} adv={adv} retireYear={plan.retireYear} />
    </div>
  );

  if (id === 'someday') return (
    <div className="space-y-6 pb-2">
      <Group title="Your someday">
        <NumField label="Retire in year" value={plan.retireYear} onChange={v => update({ retireYear: v })} />
        <MoneyField label="Income you want each year (today's money)" value={plan.targetNet} onChange={v => update({ targetNet: v, spendingPlanOn: false })} />
        <NumField label="Plan through to age" value={plan.horizonAge} onChange={v => update({ horizonAge: v })} />
      </Group>
      <Group title="Spending style">
        <Segmented small value={spendStyle}
          onChange={(v: string) => update(v === 'gogo' ? { phase1On: true, phase2On: true }
            : v === 'slowgo' ? { phase1On: true, phase2On: false } : { phase1On: false, phase2On: false })}
          options={[{ value: 'gogo', label: 'Go-go', sub: 'eases at 75 & 82' },
                    { value: 'slowgo', label: 'Slow-go', sub: 'eases from 75' },
                    { value: 'nogo', label: 'No-go', sub: 'flat throughout' }]} />
        {plan.phase1On && <div className="grid grid-cols-2 gap-3">
          <NumField label="From age" value={plan.phase1Age} onChange={v => update({ phase1Age: v })} />
          <PctField label="Spend less by" value={plan.phase1Cut} onChange={v => update({ phase1Cut: v })} />
        </div>}
        {plan.phase2On && <div className="grid grid-cols-2 gap-3">
          <NumField label="Then from age" value={plan.phase2Age} onChange={v => update({ phase2Age: v })} />
          <PctField label="Spend less by (total)" value={plan.phase2Cut} onChange={v => update({ phase2Cut: v })} />
        </div>}
      </Group>
      <Group title="Life events">
        <Toggle label="Expect an inheritance" checked={plan.inherit?.on} onChange={v => setInherit({ on: v })} />
        {plan.inherit?.on && <div className="grid grid-cols-2 gap-3">
          <NumField label="Year" value={plan.inherit.year} onChange={v => setInherit({ year: v })} />
          <MoneyField label="Amount" value={plan.inherit.amount} onChange={v => setInherit({ amount: v })} />
        </div>}
        {(plan.lifeEvents || []).map((e: any, i: number) => (
          <div key={i} className="rounded-2xl p-3" style={{ background: 'var(--color-canvas)' }}>
            <div className="flex items-center gap-2">
              <input className="flex-1 bg-transparent outline-none font-semibold text-[0.95rem]" value={e.label}
                onChange={ev => setEvent(i, { label: ev.target.value })} aria-label="Event name" />
              <button onClick={() => delEvent(i)} aria-label="Remove event" style={{ color: 'var(--color-ink-faint)' }}><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <NumField label="Year" value={e.year} onChange={v => setEvent(i, { year: v })} />
              <MoneyField label="Amount" value={e.amount} onChange={v => setEvent(i, { amount: v })} />
            </div>
            <div className="mt-2"><Segmented small value={e.kind} onChange={(v: string) => setEvent(i, { kind: v })}
              options={[{ value: 'cost', label: 'Cost' }, { value: 'income', label: 'Windfall' }]} /></div>
          </div>
        ))}
        <div className="flex gap-2">
          <button onClick={() => addEvent('cost')} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[0.85rem] font-semibold"
            style={{ background: 'var(--color-canvas)', color: 'var(--color-calm-strong)' }}><Plus size={15} /> Add a cost</button>
          <button onClick={() => addEvent('income')} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[0.85rem] font-semibold"
            style={{ background: 'var(--color-canvas)', color: 'var(--color-calm-strong)' }}><Plus size={15} /> Add a windfall</button>
        </div>
      </Group>
    </div>
  );

  // 'run'
  return (
    <div className="space-y-6 pb-2">
      <Group title="Where you pay income tax">
        <Segmented small value={plan.tax?.region || 'ruk'}
          onChange={(v: string) => update((p: any) => ({ ...p, tax: { ...p.tax, region: v } }))}
          options={[{ value: 'ruk', label: 'England, Wales & NI' }, { value: 'scotland', label: 'Scotland' }]} />
        <p className="text-[0.78rem]" style={{ color: 'var(--color-ink-faint)' }}>
          Scottish income-tax bands differ (19%–48%). Every figure recalculates on your choice.
        </p>
      </Group>
      <Group title="How you draw it">
        <span className="block text-[0.8rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>Tax-free cash</span>
        <Segmented small value={plan.pclsMode} onChange={(v: string) => update({ pclsMode: v })}
          options={[{ value: 'none', label: 'Take none' }, { value: 'phased', label: 'A little each year' }, { value: 'upfront', label: 'All at once' }]} />
        <span className="block text-[0.8rem] font-semibold pt-1" style={{ color: 'var(--color-ink-dim)' }}>Which pot first</span>
        <Segmented small value={plan.strategy} onChange={(v: string) => update({ strategy: v })}
          options={[{ value: 'sippfirst', label: 'Pensions' }, { value: 'isafirst', label: 'ISAs' }, { value: 'pafirst', label: 'Allowances' }]} />
        <p className="text-[0.78rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
          An advice-grade decision — compare the lifetime tax of all three in Explore, and talk it through with
          an adviser before acting.
        </p>
      </Group>
      <ArchitectureSection plan={plan} update={update} />
      <Group title="The lens">
        <p className="text-[0.82rem]" style={{ color: 'var(--color-ink-dim)' }}>Three futures, not one guess. Most people leave these.</p>
        <div className="grid grid-cols-3 gap-2">
          <PctField label="Poor" value={plan.growthBear} onChange={v => update({ growthBear: v })} />
          <PctField label="Base" value={plan.growthBase} onChange={v => update({ growthBase: v })} />
          <PctField label="Positive" value={plan.growthBull} onChange={v => update({ growthBull: v })} />
        </div>
        <PctField label="Inflation" value={plan.inflation} onChange={v => update({ inflation: v })} />
      </Group>
      {reset && (
        <div className="pt-2">
          <button onClick={reset}
            className="w-full rounded-2xl py-3 font-semibold text-[0.9rem] active:scale-[0.98] transition-transform"
            style={{ background: 'var(--color-canvas)', color: 'var(--color-hope)', border: '1px solid var(--color-hairline)' }}>
            Start over — clear everything
          </button>
          <p className="mt-2 text-center text-[0.75rem]" style={{ color: 'var(--color-ink-faint)' }}>
            Wipes every figure on this device and returns to the welcome screen.
          </p>
        </div>
      )}
    </div>
  );
}

// ── The whole interface: sky, or one constellation opened ──────────────────
export default function Constellation({ plan, update, reset, viz, horizonYear, lasts, dryYear, height }: {
  plan: any; update: (p: any) => void; reset?: () => void;
  viz: any; horizonYear: number; lasts: boolean; dryYear?: number | null; height?: number;
}) {
  const [open, setOpen] = useState<NodeId | null>(null);
  const node = useMemo(() => NODES.find(n => n.id === open), [open]);

  const select = (id: NodeId) => {
    setOpen(id);
    // Opening a constellation counts as having looked at it: that is what
    // turns an assumed figure into one you have actually checked.
    update((p: any) => ({ ...p, reviewed: { ...(p.reviewed || {}), [id]: true } }));
  };

  if (node) return (
    <div>
      <button onClick={() => setOpen(null)}
        className="flex items-center gap-1 -ml-1 mb-3 py-1.5 text-[0.9rem] font-semibold"
        style={{ color: 'var(--color-calm-strong)' }}>
        <ChevronLeft size={18} /> All of it
      </button>
      <h3 className="text-[1.2rem] font-extrabold tracking-tight mb-1">{node.title}</h3>
      <p className="text-[0.84rem] mb-4" style={{ color: 'var(--color-ink-faint)' }}>{node.blurb}</p>
      <NodeEditor id={node.id} plan={plan} update={update} reset={reset} />
    </div>
  );

  const clarity = clarityOf(plan);
  const left = NODES.filter(n => !n.optional && nodeState(plan, n.id) !== 'done');
  return (
    <div>
      <Sky plan={plan} viz={viz} horizonYear={horizonYear} lasts={lasts} dryYear={dryYear}
           onSelect={select} height={height} />
      <p className="mt-2 text-center text-[0.82rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
        {clarity >= 0.999
          ? 'Your horizon is in focus. Tap any part of the sky to change it.'
          : left.length
            ? <>Tap a point of light to fill it in. <b style={{ color: 'var(--color-ink)' }}>{left[0].title}</b> would sharpen this the most.</>
            : 'Tap any part of the sky to change it.'}
      </p>
    </div>
  );
}
