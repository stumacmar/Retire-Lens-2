import { useMemo } from 'react';
import { Download, Plus, RotateCcw, Upload, X, AlertTriangle } from 'lucide-react';
import Carousel, { type Page } from './Carousel';
import Group from './Group';
import Accordion from './Accordion';
import ArchitectureSection from './Architecture';
import SchemePensions from './SchemePensions';
import { Locked } from './Plus';
import { Card, MoneyField, NumField, PctField, TextField, Toggle, Segmented } from './Field';
import { E, exportPlanJson, importPlanJson } from '../lib/usePlan';
import { fmtK, pct } from '../lib/format';

/**
 * The whole form, as a carousel.
 *
 * One idea per page, a handful of questions each, swipe to move. You are
 * never handed a long list: the page you are on is the only thing on screen,
 * and the rail above names every other page so nothing is hidden behind a
 * scroll. Setup and editing run the same pages — setup shows the subset you
 * need before a chart means anything — so the interface is learned once.
 */

const isSingle = (plan: any) => plan.household === 'single';

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
    <div className="py-3 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.8rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>Pension schemes (DC)</span>
        {pots.length > 0 && (
          <span className="tnum text-[0.72rem] text-right" style={{ color: 'var(--color-ink-faint)' }}>
            total {fmtK(who.pension || 0)} · untouched {fmtK(Math.max(0, (who.pension || 0) - (who.crystallised || 0)))} · tax-free {Math.round((who.tfcRate ?? 0.25) * 100)}%
          </span>
        )}
      </div>
      {pots.map((q: any, i: number) => (
        <div key={i} className="rounded-xl px-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
          <div className="flex items-center gap-2 pt-2.5">
            <input className="flex-1 bg-transparent outline-none font-semibold text-[0.92rem]" value={q.label}
              onChange={e => edit(i, { label: e.target.value })} aria-label="Scheme name" />
            <button onClick={() => del(i)} aria-label="Remove scheme" style={{ color: 'var(--color-ink-faint)' }}><X size={15} /></button>
          </div>
          <MoneyField label="Value" value={q.value || 0} onChange={v => edit(i, { value: v })} />
          <MoneyField label="Already accessed" value={q.accessed || 0} onChange={v => edit(i, { accessed: v })} />
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

/** One person's pots: what they have, and what they are still paying in. */
function Pots({ plan, who, set, adv }: { plan: any; who: any; set: (patch: any) => void; adv: boolean }) {
  const hasPots = (who.pots || []).length > 0;
  return (
    <Group>
      {!(adv && hasPots) &&
        <MoneyField label="Workplace pension today (defined contribution)" value={who.pension}
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
        <NumField label={`Earliest pension access age (${(E as any).nmpaFor({ ...who, pensionAccessAge: null })} by law for a ${who.birthYear} birth; enter a protected age if you have one)`}
          value={(E as any).nmpaFor(who)} min={50} max={75}
          onChange={v => set({ pensionAccessAge: v === (E as any).nmpaFor({ ...who, pensionAccessAge: null }) ? null : v })} />
      </Accordion>
      <Accordion title="Already taken tax-free cash or accessed the pension?">
        <MoneyField label="Tax-free cash already taken" value={who.pclsTaken || 0} onChange={v => set({ pclsTaken: v })} />
        {adv && hasPots ? (
          <p style={{ color: 'var(--color-ink-faint)' }}>
            Accessed amounts come from your scheme list above ({fmtK(who.crystallised || 0)} in total).
          </p>
        ) : (
          <MoneyField label="Pension already accessed (crystallised)" value={who.crystallised || 0} onChange={v => set({ crystallised: v })} />
        )}
        <p style={{ color: 'var(--color-ink-faint)' }}>
          Only the untouched part of a pension can still pay 25% tax-free, and the lifetime cash cap
          (£268,275) is reduced by what you've already taken. New contributions rebuild the untouched part.
        </p>
      </Accordion>
    </Group>
  );
}

/** One person's guaranteed income: what arrives whatever markets do. */
function Promised({ plan, who, set, adv }: { plan: any; who: any; set: (patch: any) => void; adv: boolean }) {
  return (
    <>
      <Group>
        <NumField label={`State Pension age (${(E as any).spaFor(who.birthYear)} for a ${who.birthYear} birth; change only if you know otherwise)`}
          value={(E as any).spAgeOf(who)} min={60} max={75} onChange={v => set({ spAge: v === (E as any).spaFor(who.birthYear) ? 0 : v })} />
        <MoneyField label="State Pension a year (today's money; full new rate £12,548)" value={who.spAmount} onChange={v => set({ spAmount: v })} />
        <MoneyField label="Company or final-salary pension a year (defined benefit)" value={who.db}
          onChange={v => set({ db: v, dbStartYear: v > 0 && !(who.db > 0) ? plan.retireYear : who.dbStartYear })} />
        {who.db > 0 && <>
          <NumField label="…starts in (year)" value={who.dbStartYear} min={plan.startYear} max={plan.startYear + 60} onChange={v => set({ dbStartYear: v })} />
          <Toggle label="…rises with inflation" checked={!!who.dbIndexed} onChange={v => set({ dbIndexed: v })} />
          {adv && <MoneyField label="DB transfer value (CETV), if quoted" value={who.dbTransferValue || 0} onChange={v => set({ dbTransferValue: v })} />}
        </>}
        <Accordion title="How long to plan for">
          <NumField label={`Plan for ${who.name} to age (blank or 0 = the plan horizon; after this the survivor is modelled alone)`}
            value={who.deathAge || 0} min={0} max={110} onChange={v => set({ deathAge: v > 0 ? v : null })}
            hint="After a death: that State Pension stops, the survivor receives the scheme survivor pension, inherits the pots (tax-free when death is before 75), and spends the survivor share set on the first page." />
        </Accordion>
      </Group>
      <section>
        <h3 className="text-[0.76rem] font-bold tracking-wide mb-2 px-1" style={{ color: 'var(--color-ink-faint)' }}>
          Public-sector pensions
        </h3>
        <p className="text-[0.75rem] leading-[1.5] mb-2 px-1" style={{ color: 'var(--color-ink-faint)' }}>
          NHS, Teachers’, LGPS, Civil Service, Police, Fire, Forces.
        </p>
        <SchemePensions plan={plan} who={who} set={set} adv={adv} />
      </section>
    </>
  );
}

export default function PlanForm({ plan, update, reset, plus, onUpgrade, issues = [], mode = 'all', index, onIndex, footer, railBg }: {
  plan: any; update: (p: any) => void; reset?: () => void; plus: boolean; onUpgrade: () => void;
  issues?: { path: string; message: string; level: string }[];
  mode?: 'all' | 'setup'; index: number; onIndex: (i: number) => void; footer?: React.ReactNode;
  railBg?: string;
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
  const A = plan.partnerA, B = plan.partnerB;
  const setup = mode === 'setup';

  const pages = useMemo<Page[]>(() => {
    const list: Page[] = [];

    list.push({
      id: 'who', title: 'Who', blurb: 'Who the plan is for, and when they were born.',
      body: <>
        <Group title="The plan is for">
          <Segmented small value={single ? 'single' : 'couple'} onChange={(v: string) => update({ household: v })}
            options={[{ value: 'couple', label: 'A couple' }, { value: 'single', label: 'Just me' }]} />
          <p style={{ color: 'var(--color-ink-faint)' }}>
            {single ? 'One person: one State Pension, one allowance, one nil-rate band. Partner figures are ignored.' : 'Two people taxed as two individuals, planned to the later horizon, with the survivor modelled after a first death.'}
          </p>
          {!single && <PctField label="Survivor spends (share of the couple's spending)" value={plan.survivorSpend ?? 0.75} onChange={v => update({ survivorSpend: v })} />}
        </Group>
        <Group title="You">
          <TextField label="Your name" value={A.name === 'You' ? '' : A.name} placeholder="You" onChange={v => setA({ name: v || 'You' })} />
          <NumField label="Your birth year" value={A.birthYear} min={1920} max={plan.startYear - 16} onChange={v => setA({ birthYear: v })} />
        </Group>
        {!single && (
          <Group title="Your partner">
            <TextField label="Their name" value={B.name === 'Partner' ? '' : B.name} placeholder="Partner" onChange={v => setB({ name: v || 'Partner' })} />
            <NumField label="Their birth year" value={B.birthYear} min={1920} max={plan.startYear - 16} onChange={v => setB({ birthYear: v })} />
          </Group>
        )}
      </>,
    });

    list.push({
      id: 'someday', title: 'Someday', blurb: 'When you stop, and what you want to live on.',
      body: <Group>
        <NumField label="Retire in year" value={plan.retireYear} min={plan.startYear} max={plan.startYear + 50} onChange={v => update({ retireYear: v })} />
        <MoneyField label="Income you want each year (today's money)" value={plan.targetNet} onChange={v => update({ targetNet: v, spendingPlanOn: false })} />
        <NumField label="Plan through to age" value={plan.horizonAge} min={plan.retireYear - A.birthYear + 1} max={110} onChange={v => update({ horizonAge: v })} />
      </Group>,
    });

    const people: [any, (p: any) => void, boolean][] = single ? [[A, setA, true]] : [[A, setA, true], [B, setB, false]];
    for (const [who, set, first] of people) {
      // "You's pots" is not English: an unnamed person owns things in the
      // second person, a named one in the possessive.
      const own = (noun: string) =>
        who.name === 'You' ? `Your ${noun}` : who.name === 'Partner' ? `Their ${noun}` : `${who.name}’s ${noun}`;
      list.push({
        id: `pots-${first ? 'a' : 'b'}`, title: own('pots'),
        blurb: 'Pensions and ISAs — what is there today, and what is still going in.',
        body: <>
          {first && !setup && (plus ? (
            <Card>
              <Toggle label="Advanced — schemes, allowances & transfer values (several pensions with different histories, protected tax-free cash and the allowance taper)"
                checked={!!plan.advanced} onChange={v => update({ advanced: v })} />
            </Card>
          ) : (
            <Locked compact title="Advanced detail" onUpgrade={onUpgrade}
              line="Several pensions with different histories, protected tax-free cash, the allowance taper and DB transfer values." />
          ))}
          <Pots plan={plan} who={who} set={set} adv={adv} />
        </>,
      });
      list.push({
        id: `promised-${first ? 'a' : 'b'}`, title: own('guaranteed income'),
        blurb: 'What arrives whatever markets do. Check your State Pension forecast at gov.uk — most people are not on the full amount.',
        body: <Promised plan={plan} who={who} set={set} adv={adv} />,
      });
    }

    if (setup) return list;

    list.push({
      id: 'spending', title: 'Spending', blurb: 'Most people spend less later. These are measured against your full retirement spend.',
      body: <Group>
        <p style={{ color: 'var(--color-ink-dim)' }}>
          {pct(plan.phase2Cut, 0)} at {plan.phase2Age} means {pct(1 - plan.phase2Cut, 0)} of today's plan, not a cut on top of the first.
        </p>
        <Toggle label={`Ease spending from ${plan.phase1Age}`} checked={plan.phase1On} onChange={v => update({ phase1On: v })} />
        {plan.phase1On && <>
          <NumField label="From age" value={plan.phase1Age} onChange={v => update({ phase1Age: v })} />
          <PctField label="Spend less by" value={plan.phase1Cut} onChange={v => update({ phase1Cut: v })} />
        </>}
        <Toggle label={`A deeper step-down from ${plan.phase2Age}`} checked={plan.phase2On} onChange={v => update({ phase2On: v })} />
        {plan.phase2On && <>
          <NumField label="Then from age" value={plan.phase2Age} onChange={v => update({ phase2Age: v })} />
          <PctField label="Spend less by (total)" value={plan.phase2Cut} onChange={v => update({ phase2Cut: v })} />
        </>}
      </Group>,
    });

    list.push({
      id: 'events', title: 'Life events', blurb: 'The lumps that do not fit a yearly average.',
      body: <>
        <Group title="An inheritance">
          <Toggle label="Expect an inheritance" checked={plan.inherit?.on} onChange={v => setInherit({ on: v })} />
          {plan.inherit?.on && <>
            <NumField label="Year" value={plan.inherit.year} onChange={v => setInherit({ year: v })} />
            <MoneyField label="Amount" value={plan.inherit.amount} onChange={v => setInherit({ amount: v })} />
          </>}
        </Group>
        {(plan.lifeEvents || []).map((e: any, i: number) => (
          <Card key={i}>
            <div className="flex items-center gap-2 py-3">
              <input className="flex-1 bg-transparent outline-none font-semibold text-[0.95rem]" value={e.label}
                onChange={ev => setEvent(i, { label: ev.target.value })} aria-label="Event name" />
              <button onClick={() => delEvent(i)} aria-label="Remove event" style={{ color: 'var(--color-ink-faint)' }}><X size={16} /></button>
            </div>
            <NumField label="Year" value={e.year} onChange={v => setEvent(i, { year: v })} />
            <MoneyField label="Amount" value={e.amount} onChange={v => setEvent(i, { amount: v })} />
            <div role="group"><Segmented small value={e.kind} onChange={(v: string) => setEvent(i, { kind: v, invest: v === 'income' ? e.invest : false })}
              options={[{ value: 'cost', label: 'Cost' }, { value: 'income', label: 'Windfall' }, { value: 'earned', label: 'Earnings (taxed)' }]} /></div>
            {e.kind === 'earned' && !single && <div role="group"><Segmented small value={e.who || 'A'} onChange={(v: string) => setEvent(i, { who: v })}
              options={[{ value: 'A', label: `${A.name} earns it` }, { value: 'B', label: `${B.name} earns it` }]} /></div>}
          </Card>
        ))}
        <div className="flex gap-2">
          <button onClick={() => addEvent('cost')} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 min-h-[44px] text-[0.85rem] font-semibold"
            style={{ background: 'var(--color-canvas)', color: 'var(--color-calm-strong)', border: '1px solid var(--color-hairline)' }}><Plus size={15} /> Add a cost</button>
          <button onClick={() => addEvent('income')} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 min-h-[44px] text-[0.85rem] font-semibold"
            style={{ background: 'var(--color-canvas)', color: 'var(--color-calm-strong)', border: '1px solid var(--color-hairline)' }}><Plus size={15} /> Add a windfall</button>
        </div>
      </>,
    });

    list.push({
      id: 'invested', title: 'Investing', blurb: 'How the money is invested, and what it costs to run.',
      body: <Group>
        <div role="group"><Segmented small value={plan.riskPreset || 'custom'} onChange={(v: string) => update((p: any) => v === 'custom' ? { ...p, riskPreset: null } : (E as any).applyRiskPreset(p, v))}
          options={[{ value: 'cautious', label: 'Cautious', sub: '~40% shares' }, { value: 'balanced', label: 'Balanced', sub: '~70% shares' }, { value: 'adventurous', label: 'Adventurous', sub: 'all shares' }, { value: 'custom', label: 'Custom' }]} /></div>
        <p style={{ color: 'var(--color-ink-faint)' }}>
          Sets the Poor / Base / Positive growth lenses, the simulation’s spread and the share of your money the stress tests hit together. Custom keeps whatever you set on The lens.
        </p>
        <PctField label="Charges a year (platform and funds, taken off every return)" value={plan.fee || 0} onChange={v => update({ fee: v, riskPreset: plan.riskPreset })} />
      </Group>,
    });

    list.push({
      id: 'tax', title: 'Tax', blurb: 'Where you pay it, and whether the thresholds move.',
      body: <Group>
        <div role="group"><Segmented small value={plan.tax?.region || 'ruk'}
          onChange={(v: string) => update((p: any) => ({ ...p, tax: { ...p.tax, region: v } }))}
          options={[{ value: 'ruk', label: 'England, Wales & NI' }, { value: 'scotland', label: 'Scotland' }]} /></div>
        <p style={{ color: 'var(--color-ink-faint)' }}>
          Scottish income-tax bands differ (19%–48%). Every figure in the app recalculates on your choice.
        </p>
        <Toggle label="Tax thresholds rise with inflation from April 2031 (the announced freeze ends then)" checked={plan.tax?.indexation !== 'frozen'}
          onChange={v => update((p: any) => ({ ...p, tax: { ...p.tax, indexation: v ? 'cpi' : 'frozen' } }))} />
        <p style={{ color: 'var(--color-ink-faint)' }}>
          Off assumes the personal allowance and bands stay frozen for the whole plan, which overstates lifetime tax over thirty years.
        </p>
      </Group>,
    });

    list.push({
      id: 'draw', title: 'Drawing', blurb: 'How the money comes out — the decision that moves lifetime tax most.',
      body: <>
        <Group title="Tax-free cash">
          <div role="group"><Segmented small value={plan.pclsMode} onChange={(v: string) => update({ pclsMode: v })}
            options={[{ value: 'none', label: 'Take none' }, { value: 'phased', label: 'A little each year' }, { value: 'upfront', label: 'All at once' }]} /></div>
          <p style={{ color: 'var(--color-ink-faint)' }}>
            {plan.pclsMode === 'none' && 'Draws everything as taxable income and never uses the tax-free entitlement — the simplest, but usually the most tax paid.'}
            {plan.pclsMode === 'phased' && 'Crystallises a slice with each withdrawal, so a quarter of each draw is tax-free — often the most tax-efficient, if you still have untouched pension and cap.'}
            {plan.pclsMode === 'upfront' && 'Takes all available tax-free cash at retirement and reinvests it — certainty now, but future growth on it sits outside the pension wrapper.'}
            {' '}Capped at £268,275 across your lifetime, less anything already taken.
          </p>
        </Group>
        <Group title="Which pot first">
          <div role="group"><Segmented small value={plan.strategy} onChange={(v: string) => update({ strategy: v })}
            options={[{ value: 'sippfirst', label: 'Pensions' }, { value: 'isafirst', label: 'ISAs' }, { value: 'pafirst', label: 'Allowances' }]} /></div>
          <p style={{ color: 'var(--color-ink-faint)' }}>
            {plan.strategy === 'sippfirst' && 'Draws pensions up to the cheap tax bands first, topping up from ISAs — keeps ISAs growing tax-free for later.'}
            {plan.strategy === 'isafirst' && 'Spends ISAs first and defers pensions — can preserve pension tax shelter, at the cost of using up the tax-free pot early.'}
            {plan.strategy === 'pafirst' && 'Takes only what the free personal allowances cover from pensions, then ISAs — minimises tax now, draws pensions slowly.'}
            {' '}This is an advice-grade decision — compare the lifetime tax of all three in Explore, and talk it through with an adviser before acting.
          </p>
        </Group>
      </>,
    });

    list.push({
      id: 'lens', title: 'The lens', blurb: 'Three futures, not one guess. Most people leave these alone.',
      body: <Group>
        <PctField label="Poor" value={plan.growthBear} onChange={v => update({ growthBear: v, riskPreset: null })} />
        <PctField label="Base" value={plan.growthBase} onChange={v => update({ growthBase: v, riskPreset: null })} />
        <PctField label="Positive" value={plan.growthBull} onChange={v => update({ growthBull: v, riskPreset: null })} />
        <PctField label="Volatility (a year)" value={plan.mcSd} onChange={v => update({ mcSd: v, riskPreset: null })} />
        <PctField label="Share in shares (stress tests)" value={plan.equityShare ?? 1} onChange={v => update({ equityShare: v, riskPreset: null })} />
        <PctField label="Inflation" value={plan.inflation} onChange={v => update({ inflation: v })} />
      </Group>,
    });

    list.push({
      id: 'structure', title: 'Structure', blurb: 'A real plan is a shape, not one growth rate.',
      body: plus
        ? <ArchitectureSection plan={plan} update={update} />
        : <Locked title="Plan structure" onUpgrade={onUpgrade}
            line={(plan.architecture?.on
              ? 'Your plan runs the de-risking structure you chose — a gilt ladder, a growth engine and written spending rules. Plus lets you tune every part of it and measures whether it earns its keep.'
              : 'Model a gilt ladder, a growth engine and written spending rules instead of one growth rate — then see, measured on your own figures, whether the structure is worth it.')} />,
    });

    list.push({
      id: 'file', title: 'Plan file', blurb: 'Your figures, in your hands.',
      body: <>
        <Card>
          <div className="flex gap-2 py-3">
            <button onClick={() => {
                const blob = new Blob([exportPlanJson(plan)], { type: 'application/json' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `someday-plan-${new Date().toISOString().slice(0, 10)}.json`; a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 2000);
              }} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 min-h-[44px] text-[0.85rem] font-semibold"
              style={{ background: 'var(--color-surface)', color: 'var(--color-calm-strong)', border: '1px solid var(--color-hairline)' }}>
              <Download size={15} /> Export plan
            </button>
            <label className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 min-h-[44px] text-[0.85rem] font-semibold cursor-pointer"
              style={{ background: 'var(--color-surface)', color: 'var(--color-calm-strong)', border: '1px solid var(--color-hairline)' }}>
              <Upload size={15} /> Import plan
              <input type="file" accept="application/json,.json" className="sr-only" onChange={async e => {
                const file = e.target.files && e.target.files[0]; if (!file) return;
                try { const q = importPlanJson(await file.text()); update(() => q); }
                catch (err: any) { window.alert('That file is not a Someday plan: ' + (err && err.message || err)); }
                e.target.value = '';
              }} />
            </label>
          </div>
          <p style={{ color: 'var(--color-ink-faint)' }}>
            A plain JSON file, for your own backup or to move between devices. Nothing is uploaded anywhere.
          </p>
        </Card>
        {reset && (
          <div>
            <button onClick={reset}
              className="flex items-center justify-center gap-2 w-full rounded-2xl py-3 min-h-[44px] font-semibold text-[0.9rem] active:scale-[0.98] transition-transform"
              style={{ background: 'var(--color-canvas)', color: 'var(--color-hope)', border: '1px solid var(--color-hairline)' }}>
              <RotateCcw size={16} /> Start over — clear everything
            </button>
            <p className="mt-2 text-center text-[0.75rem]" style={{ color: 'var(--color-ink-faint)' }}>
              Wipes every figure on this device and returns to the welcome screen.
            </p>
          </div>
        )}
      </>,
    });

    return list;
  }, [plan, plus, adv, single, setup]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {issues.length > 0 && (
        <div className="rounded-2xl p-3 space-y-1 mb-4" role="alert"
             style={{ background: 'color-mix(in srgb, var(--color-hope) 12%, var(--color-canvas))', border: '1px solid color-mix(in srgb, var(--color-hope) 40%, transparent)' }}>
          {issues.map((it, k) => (
            <div key={k} className="flex items-start gap-2 text-[0.8rem] leading-snug" style={{ color: it.level === 'error' ? 'var(--color-hope)' : 'var(--color-ink-dim)' }}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{it.message}</span>
            </div>
          ))}
        </div>
      )}
      <Carousel pages={pages} index={index} onIndex={onIndex} footer={footer} railBg={railBg} />
    </div>
  );
}
