import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronLeft, Download, Plus, Upload, X } from 'lucide-react';
import HorizonViz from './HorizonViz';
import Group from './Group';
import Accordion from './Accordion';
import ArchitectureSection from './Architecture';
import SchemePensions from './SchemePensions';
import { Locked } from './Plus';
import { MoneyField, NumField, PctField, Toggle, Segmented } from './Field';
import { E, exportPlanJson, importPlanJson } from '../lib/usePlan';
import { fmtK, pct } from '../lib/format';

/**
 * Build your sky.
 *
 * The setup screen and the editing screen are the same thing: your own dawn
 * horizon, ghosted and out of focus until it knows enough about you. Five
 * constellations sit on it at meaningful places — today on the left, the
 * moment you stop in the middle, the income that arrives later on the right —
 * and filling one brings that part of the picture into focus. The progress
 * indicator is not a bar; it is how sharp your future has become.
 *
 * Every figure the plan can hold lives behind exactly one point of light, so
 * nothing is reachable from two places and nothing is unreachable.
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
  { id: 'you',        title: 'You & yours',       blurb: 'Who the plan is for',           x: 19, y: 70 },
  { id: 'saved',      title: "What you've saved", blurb: 'Pensions, ISAs, savings',       x: 33, y: 36 },
  { id: 'someday',    title: 'Your someday',      blurb: 'When you stop, what you spend', x: 58, y: 18 },
  { id: 'guaranteed', title: "What's promised",   blurb: 'State & company pensions',      x: 74, y: 48, labelShift: -30 },
  { id: 'run',        title: "How it's run",      blurb: 'Tax, drawing, structure',       x: 50, y: 76, optional: true },
];

const isSingle = (plan: any) => plan.household === 'single';

/** Has this part of the plan got real information in it yet? */
export function nodeState(plan: any, id: NodeId): 'empty' | 'assumed' | 'done' {
  const A = plan.partnerA, B = plan.partnerB;
  const single = isSingle(plan);
  const seen = (plan.reviewed || {})[id];
  switch (id) {
    case 'you': {
      const named = A.name && A.name !== 'You';
      const born = A.birthYear > 1900;
      return named && born ? 'done' : (born ? 'assumed' : 'empty');
    }
    case 'saved': {
      const mine = A.pension + A.isa + A.monthlyPension + A.monthlyIsa;
      const theirs = single ? 0 : B.pension + B.isa + B.monthlyPension + B.monthlyIsa;
      return mine + theirs + (plan.cash || 0) > 0 ? 'done' : 'empty';
    }
    case 'guaranteed': {
      const any = A.spAmount > 0 || A.db > 0 || (E as any).hasAnyDb(A)
        || (!single && (B.spAmount > 0 || B.db > 0 || (E as any).hasAnyDb(B)));
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

/** What this person has built up, and what they are still paying in. */
function Saved({ plan, who, set, adv }: { plan: any; who: any; set: (patch: any) => void; adv: boolean }) {
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
      <Accordion title="Still working, charges and relief">
        <MoneyField label="Salary a year while still working (today's money)" value={who.income || 0} onChange={v => set({ income: v })}
          hint="Taxed as earnings in any year this person is still working after the household stop year." />
        <NumField label={`Stops work in (year; the household year is ${plan.retireYear})`} value={who.stopYear || plan.retireYear}
          min={plan.retireYear} max={plan.startYear + 60}
          onChange={v => set({ stopYear: v > plan.retireYear ? v : null })} />
        <Toggle label="Pension contributions entered after basic-rate relief (grossed up by 25%)" checked={!!who.contribGrossUp} onChange={v => set({ contribGrossUp: v })} />
      </Accordion>
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
      <Accordion title="When this pension can be touched">
        <NumField label={`Earliest pension access age (${(E as any).nmpaFor({ ...who, pensionAccessAge: null })} by law for a ${who.birthYear} birth; enter a protected age if you have one)`}
          value={(E as any).nmpaFor(who)} min={50} max={75}
          onChange={v => set({ pensionAccessAge: v === (E as any).nmpaFor({ ...who, pensionAccessAge: null }) ? null : v })} />
      </Accordion>
    </Group>
  );
}

/** Income that arrives whatever markets do. */
function Promised({ plan, who, set, adv, onUpgrade, plus }: {
  plan: any; who: any; set: (patch: any) => void; adv: boolean; plus: boolean; onUpgrade: () => void;
}) {
  return (
    <Group title={who.name}>
      <NumField label={`State Pension age (${(E as any).spaFor(who.birthYear)} for a ${who.birthYear} birth; change only if you know otherwise)`}
        value={(E as any).spAgeOf(who)} min={60} max={75} onChange={v => set({ spAge: v === (E as any).spaFor(who.birthYear) ? 0 : v })} />
      <MoneyField label="State Pension a year (today's money; full new rate £12,548)" value={who.spAmount} onChange={v => set({ spAmount: v })} />
      <MoneyField label="Company / final-salary (defined benefit) pension a year" value={who.db}
        onChange={v => set({ db: v,
          // First time a DB pension is entered, assume it starts when you stop
          // work — otherwise it silently sits on a default year in the past.
          dbStartYear: v > 0 && !(who.db > 0) ? plan.retireYear : who.dbStartYear })} />
      {who.db > 0 && <>
        <NumField label="…starts in (year)" value={who.dbStartYear} min={plan.startYear} max={plan.startYear + 60} onChange={v => set({ dbStartYear: v })} />
        <Toggle label="…rises with inflation" checked={!!who.dbIndexed} onChange={v => set({ dbIndexed: v })} />
        {!isSingle(plan) && <PctField label="…paid to a survivor at this share" value={who.dbSurvivorPct ?? 0.5} onChange={v => set({ dbSurvivorPct: v })} />}
        {adv && <MoneyField label="DB transfer value (CETV), if quoted" value={who.dbTransferValue || 0} onChange={v => set({ dbTransferValue: v })} />}
      </>}
      <div>
        <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>Public-sector pensions (NHS, Teachers’, LGPS, Civil Service, Police, Fire, Forces)</span>
        <SchemePensions plan={plan} who={who} set={set} adv={adv} />
      </div>
      {!plus && (who.db > 0 || (E as any).hasAnyDb(who)) && (
        <Locked compact title="When to take each public-sector pension" onUpgrade={onUpgrade}
          line="Compare taking a tranche early, on time or late — on your own figures, with the scheme's own reduction factors." />
      )}
    </Group>
  );
}

// ── The editors behind each constellation ──────────────────────────────────
export function NodeEditor({ id, plan, update, reset, plus, onUpgrade }: {
  id: NodeId; plan: any; update: (p: any) => void; reset?: () => void;
  plus: boolean; onUpgrade: () => void;
}) {
  const setA = (patch: any) => update((p: any) => ({ ...p, partnerA: { ...p.partnerA, ...patch } }));
  const setB = (patch: any) => update((p: any) => ({ ...p, partnerB: { ...p.partnerB, ...patch } }));
  const setInherit = (patch: any) => update((p: any) => ({ ...p, inherit: { ...p.inherit, ...patch } }));
  const addEvent = (kind: string) => update((p: any) => ({
    ...p, lifeEvents: [...(p.lifeEvents || []), { year: p.retireYear + 2, label: kind === 'cost' ? 'One-off cost' : 'Windfall', amount: kind === 'cost' ? 20000 : 40000, kind, invest: kind !== 'cost' }],
  }));
  const setEvent = (i: number, patch: any) => update((p: any) => ({ ...p, lifeEvents: p.lifeEvents.map((e: any, j: number) => j === i ? { ...e, ...patch } : e) }));
  const delEvent = (i: number) => update((p: any) => ({ ...p, lifeEvents: p.lifeEvents.filter((_: any, j: number) => j !== i) }));
  const single = isSingle(plan);
  const adv = plus && !!plan.advanced;
  const spendStyle = plan.phase2On ? 'gogo' : plan.phase1On ? 'slowgo' : 'nogo';

  if (id === 'you') return (
    <div className="space-y-6 pb-2">
      <Group title="Who the plan is for">
        <Segmented small value={single ? 'single' : 'couple'} onChange={(v: string) => update({ household: v })}
          options={[{ value: 'couple', label: 'A couple' }, { value: 'single', label: 'Just me' }]} />
        <p className="text-[0.78rem]" style={{ color: 'var(--color-ink-faint)' }}>
          {single ? 'One person: one State Pension, one allowance, one nil-rate band. Partner figures are ignored.' : 'Two people taxed as two individuals, planned to the later horizon, with the survivor modelled after a first death.'}
        </p>
        {!single && <PctField label="Survivor spends (share of the couple's spending)" value={plan.survivorSpend ?? 0.75} onChange={v => update({ survivorSpend: v })} />}
      </Group>
      <Group title={single ? 'You' : plan.partnerA.name}>
        <label className="block">
          <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>Your name</span>
          <input value={plan.partnerA.name === 'You' ? '' : plan.partnerA.name} placeholder="You"
            onChange={e => setA({ name: e.target.value || 'You' })}
            className="w-full rounded-2xl px-4 h-[52px] text-[1.15rem] font-semibold outline-none"
            style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }} />
        </label>
        <NumField label="Your birth year" value={plan.partnerA.birthYear} min={1920} max={plan.startYear - 16} onChange={v => setA({ birthYear: v })} />
        <NumField label="Plan for you to age (0 = the plan horizon)" value={plan.partnerA.deathAge || 0} min={0} max={110}
          onChange={v => setA({ deathAge: v > 0 ? v : null })}
          hint={single ? 'The plan simply ends at this age.' : 'After a death: that State Pension stops, the survivor receives the scheme survivor pension, inherits the pots (tax-free when death is before 75), and spends the survivor share set above.'} />
      </Group>
      {!single && (
        <Group title={plan.partnerB.name}>
          <label className="block">
            <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>Partner’s name</span>
            <input value={plan.partnerB.name === 'Partner' ? '' : plan.partnerB.name} placeholder="Partner"
              onChange={e => setB({ name: e.target.value || 'Partner' })}
              className="w-full rounded-2xl px-4 h-[52px] text-[1.15rem] font-semibold outline-none"
              style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }} />
          </label>
          <NumField label="Their birth year" value={plan.partnerB.birthYear} min={1920} max={plan.startYear - 16} onChange={v => setB({ birthYear: v })} />
          <NumField label="Plan for them to age (0 = the plan horizon)" value={plan.partnerB.deathAge || 0} min={0} max={110}
            onChange={v => setB({ deathAge: v > 0 ? v : null })} />
        </Group>
      )}
      <Group title="Your plan file">
        <div className="flex gap-2">
          <button onClick={() => {
              const blob = new Blob([exportPlanJson(plan)], { type: 'application/json' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = `someday-plan-${new Date().toISOString().slice(0, 10)}.json`; a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            }} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 min-h-[44px] text-[0.85rem] font-semibold"
            style={{ background: 'var(--color-canvas)', color: 'var(--color-calm-strong)', border: '1px solid var(--color-hairline)' }}>
            <Download size={15} /> Export plan
          </button>
          <label className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 min-h-[44px] text-[0.85rem] font-semibold cursor-pointer"
            style={{ background: 'var(--color-canvas)', color: 'var(--color-calm-strong)', border: '1px solid var(--color-hairline)' }}>
            <Upload size={15} /> Import plan
            <input type="file" accept="application/json,.json" className="sr-only" onChange={async e => {
              const file = e.target.files && e.target.files[0]; if (!file) return;
              try { const p = importPlanJson(await file.text()); update(() => p); }
              catch (err: any) { window.alert('That file is not a Someday plan: ' + (err && err.message || err)); }
              e.target.value = '';
            }} />
          </label>
        </div>
        <p className="text-[0.75rem]" style={{ color: 'var(--color-ink-faint)' }}>
          A plain JSON file, for your own backup or to move between devices. Nothing is uploaded anywhere.
        </p>
      </Group>
    </div>
  );

  if (id === 'saved') return (
    <div className="space-y-6 pb-2">
      {plus ? (
        <div>
          <Toggle label="Advanced — schemes, allowances & transfer values" checked={!!plan.advanced} onChange={v => update({ advanced: v })} />
          <p className="text-[0.78rem] mt-1" style={{ color: 'var(--color-ink-faint)' }}>
            For multiple pensions with different histories, protected tax-free cash, the allowance taper and DB transfer values.
          </p>
        </div>
      ) : (
        <Locked compact title="Advanced detail" onUpgrade={onUpgrade}
          line="Several pensions with different histories, protected tax-free cash, the allowance taper and DB transfer values." />
      )}
      <Saved plan={plan} who={plan.partnerA} set={setA} adv={adv} />
      {!single && <Saved plan={plan} who={plan.partnerB} set={setB} adv={adv} />}
      <Group title="Other savings">
        <MoneyField label="Cash & Premium Bonds" value={plan.cash || 0} onChange={v => update({ cash: v })} />
        <MoneyField label="Home value (for net worth and inheritance tax)" value={plan.house || 0} onChange={v => update({ house: v })} />
        <p className="text-[0.78rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
          Cash is spent after ISAs and grows at its own rate. The home is kept out of core funding — it only
          appears in the estate, and in the housing parachute if you switch one on under <b>How it’s run</b>.
        </p>
      </Group>
    </div>
  );

  if (id === 'guaranteed') return (
    <div className="space-y-6 pb-2">
      <p className="text-[0.86rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
        Income that arrives whatever markets do. Check your State Pension forecast at gov.uk — most people
        are not on the full amount, and it is the single biggest number in this section.
      </p>
      <Promised plan={plan} who={plan.partnerA} set={setA} adv={adv} plus={plus} onUpgrade={onUpgrade} />
      {!single && <Promised plan={plan} who={plan.partnerB} set={setB} adv={adv} plus={plus} onUpgrade={onUpgrade} />}
    </div>
  );

  if (id === 'someday') return (
    <div className="space-y-6 pb-2">
      <Group title="Your Someday">
        <NumField label="Retire in year" value={plan.retireYear} min={plan.startYear} max={plan.startYear + 50} onChange={v => update({ retireYear: v })} />
        <MoneyField label="Income you want each year (today's money)" value={plan.targetNet} onChange={v => update({ targetNet: v, spendingPlanOn: false })} />
        <NumField label="Plan through to age" value={plan.horizonAge} min={plan.retireYear - plan.partnerA.birthYear + 1} max={110} onChange={v => update({ horizonAge: v })} />
      </Group>
      <Group title="Spending as you age">
        <p className="text-[0.82rem]" style={{ color: 'var(--color-ink-dim)' }}>
          Most people spend less later. Both figures are measured against your full retirement spend — so{' '}
          {pct(plan.phase2Cut, 0)} at {plan.phase2Age} means {pct(1 - plan.phase2Cut, 0)} of today's plan, not a cut on top of the first.
        </p>
        <Segmented small value={spendStyle}
          onChange={(v: string) => update(v === 'gogo' ? { phase1On: true, phase2On: true }
            : v === 'slowgo' ? { phase1On: true, phase2On: false } : { phase1On: false, phase2On: false })}
          options={[{ value: 'gogo', label: 'Go-go', sub: `eases at ${plan.phase1Age} & ${plan.phase2Age}` },
                    { value: 'slowgo', label: 'Slow-go', sub: `eases from ${plan.phase1Age}` },
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
            <div className="mt-2"><Segmented small value={e.kind} onChange={(v: string) => setEvent(i, { kind: v, invest: v === 'income' ? e.invest : false })}
              options={[{ value: 'cost', label: 'Cost' }, { value: 'income', label: 'Windfall' }, { value: 'earned', label: 'Earnings (taxed)' }]} /></div>
            {e.kind === 'earned' && !single && <div className="mt-2"><Segmented small value={e.who || 'A'} onChange={(v: string) => setEvent(i, { who: v })}
              options={[{ value: 'A', label: `${plan.partnerA.name} earns it` }, { value: 'B', label: `${plan.partnerB.name} earns it` }]} /></div>}
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

  // 'run' — the machinery: how it is invested, taxed, drawn and structured.
  return (
    <div className="space-y-6 pb-2">
      <Group title="How your money is invested">
        <Segmented small value={plan.riskPreset || 'custom'} onChange={(v: string) => update((p: any) => v === 'custom' ? { ...p, riskPreset: null } : (E as any).applyRiskPreset(p, v))}
          options={[{ value: 'cautious', label: 'Cautious', sub: '~40% shares' }, { value: 'balanced', label: 'Balanced', sub: '~70% shares' }, { value: 'adventurous', label: 'Adventurous', sub: 'all shares' }, { value: 'custom', label: 'Custom' }]} />
        <p className="text-[0.78rem]" style={{ color: 'var(--color-ink-faint)' }}>
          Sets the Poor / Base / Positive growth lenses, the simulation’s spread and the share of your money the stress tests hit together. Custom keeps whatever you set in <b>The lens</b> below.
        </p>
        <PctField label="Charges a year (platform and funds, taken off every return)" value={plan.fee || 0} onChange={v => update({ fee: v, riskPreset: plan.riskPreset })} />
      </Group>
      <Group title="Where you pay income tax">
        <Segmented small value={plan.tax?.region || 'ruk'}
          onChange={(v: string) => update((p: any) => ({ ...p, tax: { ...p.tax, region: v } }))}
          options={[{ value: 'ruk', label: 'England, Wales & NI' }, { value: 'scotland', label: 'Scotland' }]} />
        <p className="text-[0.78rem]" style={{ color: 'var(--color-ink-faint)' }}>
          Scottish income-tax bands differ (19%–48%). Every figure in the app recalculates on your choice.
        </p>
        <Toggle label="Tax thresholds rise with inflation from April 2031 (the announced freeze ends then)" checked={plan.tax?.indexation !== 'frozen'}
          onChange={v => update((p: any) => ({ ...p, tax: { ...p.tax, indexation: v ? 'cpi' : 'frozen' } }))} />
        <p className="text-[0.78rem]" style={{ color: 'var(--color-ink-faint)' }}>
          Off assumes the personal allowance and bands stay frozen for the whole plan, which overstates lifetime tax over thirty years.
        </p>
      </Group>
      <Group title="How you draw it">
        <span className="block text-[0.8rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>Tax-free cash</span>
        <Segmented small value={plan.pclsMode} onChange={(v: string) => update({ pclsMode: v })}
          options={[{ value: 'none', label: 'Take none' }, { value: 'phased', label: 'A little each year' }, { value: 'upfront', label: 'All at once' }]} />
        <p className="text-[0.78rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
          {plan.pclsMode === 'none' && 'Draws everything as taxable income and never uses the tax-free entitlement — the simplest, but usually the most tax paid.'}
          {plan.pclsMode === 'phased' && 'Crystallises a slice with each withdrawal, so a quarter of each draw is tax-free — often the most tax-efficient, if you still have untouched pension and cap.'}
          {plan.pclsMode === 'upfront' && 'Takes all available tax-free cash at retirement and reinvests it — certainty now, but future growth on it sits outside the pension wrapper.'}
          {' '}Capped at £268,275 across your lifetime, less anything already taken (set under <b>What you’ve saved</b>).
        </p>
        <span className="block text-[0.8rem] font-semibold pt-1" style={{ color: 'var(--color-ink-dim)' }}>Which pot first</span>
        <Segmented small value={plan.strategy} onChange={(v: string) => update({ strategy: v })}
          options={[{ value: 'sippfirst', label: 'Pensions' }, { value: 'isafirst', label: 'ISAs' }, { value: 'pafirst', label: 'Allowances' }]} />
        <p className="text-[0.78rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
          {plan.strategy === 'sippfirst' && 'Draws pensions up to the cheap tax bands first, topping up from ISAs — keeps ISAs growing tax-free for later.'}
          {plan.strategy === 'isafirst' && 'Spends ISAs first and defers pensions — can preserve pension tax shelter, at the cost of using up the tax-free pot early.'}
          {plan.strategy === 'pafirst' && 'Takes only what the free personal allowances cover from pensions, then ISAs — minimises tax now, draws pensions slowly.'}
          {' '}This is an advice-grade decision — compare the lifetime tax of all three in Explore, and talk it through with an adviser before acting.
        </p>
      </Group>
      {plus
        ? <ArchitectureSection plan={plan} update={update} />
        : <Locked title="Plan structure" onUpgrade={onUpgrade}
            line={(plan.architecture?.on
              ? 'Your plan runs the de-risking structure you chose — a gilt ladder, a growth engine and written spending rules. Plus lets you tune every part of it and measures whether it earns its keep.'
              : 'Model a gilt ladder, a growth engine and written spending rules instead of one growth rate — then see, measured on your own figures, whether the structure is worth it.')} />}
      <Group title="The lens">
        <p className="text-[0.82rem]" style={{ color: 'var(--color-ink-dim)' }}>Three futures, not one guess. Most people leave these.</p>
        <div className="grid grid-cols-3 gap-2">
          <PctField label="Poor" value={plan.growthBear} onChange={v => update({ growthBear: v, riskPreset: null })} />
          <PctField label="Base" value={plan.growthBase} onChange={v => update({ growthBase: v, riskPreset: null })} />
          <PctField label="Positive" value={plan.growthBull} onChange={v => update({ growthBull: v, riskPreset: null })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <PctField label="Volatility (a year)" value={plan.mcSd} onChange={v => update({ mcSd: v, riskPreset: null })} />
          <PctField label="Share in shares (stress tests)" value={plan.equityShare ?? 1} onChange={v => update({ equityShare: v, riskPreset: null })} />
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
export default function Constellation({ plan, update, reset, viz, horizonYear, lasts, dryYear, height, plus, onUpgrade, issues = [] }: {
  plan: any; update: (p: any) => void; reset?: () => void;
  viz: any; horizonYear: number; lasts: boolean; dryYear?: number | null; height?: number;
  plus: boolean; onUpgrade: () => void; issues?: { path: string; message: string; level: string }[];
}) {
  const [open, setOpen] = useState<NodeId | null>(null);
  const node = useMemo(() => NODES.find(n => n.id === open), [open]);

  const select = (id: NodeId) => {
    setOpen(id);
    // Opening a constellation counts as having looked at it: that is what
    // turns an assumed figure into one you have actually checked.
    update((p: any) => ({ ...p, reviewed: { ...(p.reviewed || {}), [id]: true } }));
    document.querySelector('[data-sheet-scroll]')?.scrollTo({ top: 0 });
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
      <NodeEditor id={node.id} plan={plan} update={update} reset={reset} plus={plus} onUpgrade={onUpgrade} />
    </div>
  );

  const clarity = clarityOf(plan);
  const left = NODES.filter(n => !n.optional && nodeState(plan, n.id) !== 'done');
  return (
    <div>
      {issues.length > 0 && (
        <div className="rounded-2xl p-3 space-y-1 mb-4" role="alert"
             style={{ background: 'color-mix(in srgb, var(--color-hope) 12%, var(--color-canvas))', border: '1px solid color-mix(in srgb, var(--color-hope) 40%, transparent)' }}>
          {issues.map((i, k) => (
            <div key={k} className="flex items-start gap-2 text-[0.8rem] leading-snug" style={{ color: i.level === 'error' ? 'var(--color-hope)' : 'var(--color-ink-dim)' }}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{i.message}</span>
            </div>
          ))}
        </div>
      )}
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
