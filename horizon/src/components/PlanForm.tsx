import { useMemo, useState } from 'react';
import { ChevronRight, Download, Plus, RotateCcw, Upload, X, AlertTriangle } from 'lucide-react';
import Carousel, { type Page } from './Carousel';
import Group from './Group';
import Accordion from './Accordion';
import ArchitectureSection from './Architecture';
import SchemePensions from './SchemePensions';
import LivingStandards from './LivingStandards';
import { standardLine } from '../lib/livingStandards';
import { longevityLine } from '../lib/longevity';
import { Locked } from './Plus';
import { Card, MoneyField, NumField, PctField, TextField, Toggle, Segmented } from './Field';
import { E, exportPlanJson, importPlanJson } from '../lib/usePlan';
import { fmt, fmtK, pct } from '../lib/format';
import { extraRelief } from '../lib/relief';

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
        <span className="text-[0.875rem] font-semibold" style={{ color: 'var(--color-ink-dim)' }}>Pension schemes (DC)</span>
        {pots.length > 0 && (
          <span className="tnum text-[0.8125rem] text-right" style={{ color: 'var(--color-ink-dim)' }}>
            total {fmtK(who.pension || 0)} · untouched {fmtK(Math.max(0, (who.pension || 0) - (who.crystallised || 0)))} · tax-free {Math.round((who.tfcRate ?? 0.25) * 100)}%
          </span>
        )}
      </div>
      {pots.map((q: any, i: number) => (
        <div key={i} className="rounded-xl px-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
          <div className="flex items-center gap-2 pt-2.5">
            <input className="flex-1 bg-transparent outline-none font-semibold text-[1rem]" value={q.label}
              onChange={e => edit(i, { label: e.target.value })} aria-label="Scheme name" />
            <button onClick={() => del(i)} aria-label="Remove scheme" style={{ color: 'var(--color-ink-dim)' }}><X size={15} /></button>
          </div>
          <MoneyField label="Value" value={q.value || 0} onChange={v => edit(i, { value: v })} />
          <MoneyField label="Already accessed" value={q.accessed || 0} onChange={v => edit(i, { accessed: v })} />
          <NumField label="Tax-free entitlement (25 unless protected)" value={q.tfcPct ?? 25} suffix="%" onChange={v => edit(i, { tfcPct: v })} />
        </div>
      ))}
      <button onClick={add} className="flex items-center justify-center gap-1.5 w-full rounded-xl py-2.5 text-[0.875rem] font-semibold"
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
      {/* Whether this figure includes tax relief changes the answer by a
          fifth of every payment, so the choice sits right under it. Most UK
          calculators count it as the total going in (MoneyHelper, Standard
          Life); relief at source adds 25% to what leaves a bank account. */}
      <MoneyField label="Paying into pension monthly" value={who.monthlyPension} onChange={v => set({ monthlyPension: v })}
        hint={who.contribGrossUp
          ? `What you pay; with basic-rate tax relief added, ${fmt((Number(who.monthlyPension) || 0) * 1.25)} a month goes in. ${extraRelief(E, plan, who) > 0
            ? `On a salary of ${fmt(who.income)} you pay more than 20% tax on part of your pay, so you can claim about ${fmt(extraRelief(E, plan, who))} a year more back through Self Assessment (or by asking HMRC; claims go back four years). It comes to you, not into the pension, so the plan does not count it.`
            : 'Higher-rate relief comes back to you through your tax, not into the pot; enter your salary under "Still working, charges and relief" to see it.'}`
          : 'The total going in, tax relief included: yours and your employer’s, as on your payslip or pension statement.'} />
      <Toggle label="Paid from my bank account (the provider adds 25% basic-rate tax relief)" checked={!!who.contribGrossUp} onChange={v => set({ contribGrossUp: v })} />
      <MoneyField label="ISAs today" value={who.isa} onChange={v => set({ isa: v })} />
      <MoneyField label="Paying into ISAs monthly" value={who.monthlyIsa} onChange={v => set({ monthlyIsa: v })} />
      <Accordion title="Still working, charges and relief">
        <MoneyField label="Salary a year while still working (today's money)" value={who.income || 0} onChange={v => set({ income: v })}
          hint="Taxed as earnings in any year this person is still working after the household stop year." />
        <NumField label={`Stops work in (year; the household year is ${plan.retireYear})`} value={who.stopYear || plan.retireYear}
          min={plan.retireYear} max={plan.startYear + 60}
          onChange={v => set({ stopYear: v > plan.retireYear ? v : null })} />
        <NumField label={`Earliest pension access age (${(E as any).nmpaFor({ ...who, pensionAccessAge: null })} by law for a ${who.birthYear} birth; enter a protected age if you have one)`}
          value={(E as any).nmpaFor(who)} min={50} max={75}
          onChange={v => set({ pensionAccessAge: v === (E as any).nmpaFor({ ...who, pensionAccessAge: null }) ? null : v })} />
      </Accordion>
      <Accordion title="Already taken tax-free cash or accessed the pension?">
        <MoneyField label="Tax-free cash already taken" value={who.pclsTaken || 0} onChange={v => set({ pclsTaken: v })} />
        {adv && hasPots ? (
          <p style={{ color: 'var(--color-ink-dim)' }}>
            Accessed amounts come from your scheme list above ({fmtK(who.crystallised || 0)} in total).
          </p>
        ) : (
          <MoneyField label="Pension already accessed (crystallised)" value={who.crystallised || 0} onChange={v => set({ crystallised: v })} />
        )}
        <p style={{ color: 'var(--color-ink-dim)' }}>
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
        <NumField label={`State Pension age (${(E as any).spaFor(who.birthYear)} if born in ${who.birthYear})`}
          value={(E as any).spAgeOf(who)} min={60} max={75} onChange={v => set({ spAge: v === (E as any).spaFor(who.birthYear) ? 0 : v })} />
        <MoneyField label="State Pension a year (today's money; full new rate £12,548)" value={who.spAmount} onChange={v => set({ spAmount: v })} />
        {/* An annuity belongs here too: a fixed income for life, whoever pays it. */}
        <MoneyField label="Annuity, company or final-salary pension a year (guaranteed for life)" value={who.db}
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
        <h3 className="text-[0.8125rem] font-bold tracking-wide mb-2 px-1" style={{ color: 'var(--color-ink-dim)' }}>
          Public-sector pensions
        </h3>
        <SchemePensions plan={plan} who={who} set={set} adv={adv} />
      </section>
    </>
  );
}

/** What each page a layer down holds, said under its name on the More page. */
const MORE_LINE: Record<string, string> = {
  events: 'An inheritance, a windfall, a big cost',
  invested: 'How much is in shares, and charges',
  tax: 'Scotland, and frozen tax thresholds',
  draw: 'Tax-free cash, and which pot first',
  lens: 'The growth and inflation assumed',
  structure: 'Bonds for the early years, with spending rules',
  file: 'Save a copy, load one, or start over',
};

export default function PlanForm({ plan, update, reset, plus, onUpgrade, issues = [], mode = 'all', index, onIndex, footer, railBg, saved }: {
  plan: any; update: (p: any) => void; reset?: () => void; plus: boolean; onUpgrade: () => void;
  issues?: { path: string; message: string; level: string }[];
  mode?: 'all' | 'setup'; index: number; onIndex: (i: number) => void; footer?: React.ReactNode;
  railBg?: string;
  saved?: { at: number | null; error: string | null };
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
  // The pages most people need come first: who, when and how much, the pots,
  // the guaranteed income, spending. The rest are one layer down, behind a
  // page that lists them, and are not built until one is opened (Scout, 26
  // November 2026: fourteen pages and 86 controls met everyone who opened
  // Details). The list keeps its place, so a page's number never changes.
  const moreAt = (single ? 4 : 6) + 1;
  const [more, setMore] = useState(() => !setup && index > moreAt);

  const pages = useMemo<Page[]>(() => {
    const list: Page[] = [];

    list.push({
      id: 'who', title: 'Who',
      body: <>
        <Group title="The plan is for">
          <Segmented small value={single ? 'single' : 'couple'} onChange={(v: string) => update({ household: v })}
            options={[{ value: 'couple', label: 'A couple' }, { value: 'single', label: 'Just me' }]} />
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
      id: 'someday', title: 'Someday',
      body: <Group>
        <NumField label="Retire in year" value={plan.retireYear} min={plan.startYear} max={plan.startYear + 50} onChange={v => update({ retireYear: v })} />
        <MoneyField label="Income you want each year (today's money)" value={plan.targetNet} hint={`Today's money · ${standardLine(plan, plan.targetNet)}`} onChange={v => update({ targetNet: v, spendingPlanOn: false })} />
        <LivingStandards plan={plan} onPick={v => update({ targetNet: v, spendingPlanOn: false })} />
        <NumField label="Plan through to age" value={plan.horizonAge} min={plan.retireYear - A.birthYear + 1} max={110} hint={longevityLine(plan)} onChange={v => update({ horizonAge: v })} />
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
        body: <>
          {first && !setup && (plus ? (
            <Card>
              <Toggle label="Advanced (several pensions, protected tax-free cash, the allowance taper)"
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
        blurb: 'Check your State Pension forecast at gov.uk: most people are not on the full amount.',
        body: <Promised plan={plan} who={who} set={set} adv={adv} />,
      });
    }

    if (setup) return list;

    list.push({
      id: 'spending', title: 'Spending', blurb: 'Most people spend less later.',
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

    const rest: Page[] = [];
    rest.push({
      id: 'events', title: 'Life events',
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
              <input className="flex-1 bg-transparent outline-none font-semibold text-[1rem]" value={e.label}
                onChange={ev => setEvent(i, { label: ev.target.value })} aria-label="Event name" />
              <button onClick={() => delEvent(i)} aria-label="Remove event" style={{ color: 'var(--color-ink-dim)' }}><X size={16} /></button>
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
          <button onClick={() => addEvent('cost')} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 min-h-[44px] text-[0.875rem] font-semibold"
            style={{ background: 'var(--color-canvas)', color: 'var(--color-calm-strong)', border: '1px solid var(--color-hairline)' }}><Plus size={15} /> Add a cost</button>
          <button onClick={() => addEvent('income')} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 min-h-[44px] text-[0.875rem] font-semibold"
            style={{ background: 'var(--color-canvas)', color: 'var(--color-calm-strong)', border: '1px solid var(--color-hairline)' }}><Plus size={15} /> Add a windfall</button>
        </div>
      </>,
    });

    rest.push({
      id: 'invested', title: 'Investing',
      body: <Group>
        <div role="group"><Segmented small fit value={plan.riskPreset || 'custom'} onChange={(v: string) => update((p: any) => v === 'custom' ? { ...p, riskPreset: null } : (E as any).applyRiskPreset(p, v))}
          options={[{ value: 'cautious', label: 'Cautious', sub: '~40% shares' }, { value: 'balanced', label: 'Balanced', sub: '~70% shares' }, { value: 'adventurous', label: 'Adventurous', sub: 'all shares' }, { value: 'custom', label: 'Custom' }]} /></div>
        <p style={{ color: 'var(--color-ink-dim)' }}>
          Sets the growth rates and how far markets swing. Custom keeps what you set on Growth rates.
        </p>
        <PctField label="Charges a year (platform and funds, taken off every return)" value={plan.fee || 0} onChange={v => update({ fee: v, riskPreset: plan.riskPreset })}
          hint={(plan.fee || 0) < 0.001 ? 'No charges at all is rare: UK pensions and ISAs usually cost about 0.3% to 1% a year all in, and leaving them out flatters every figure. Your annual statement shows yours.' : undefined} />
      </Group>,
    });

    rest.push({
      id: 'tax', title: 'Tax',
      body: <Group>
        <div role="group"><Segmented small value={plan.tax?.region || 'ruk'}
          onChange={(v: string) => update((p: any) => ({ ...p, tax: { ...p.tax, region: v } }))}
          options={[{ value: 'ruk', label: 'England, Wales & NI' }, { value: 'scotland', label: 'Scotland' }]} /></div>
        <p style={{ color: 'var(--color-ink-dim)' }}>
          Scottish income-tax bands differ (19% to 48%).
        </p>
        <Toggle label="Tax thresholds rise with inflation from April 2031 (the announced freeze ends then)" checked={plan.tax?.indexation !== 'frozen'}
          onChange={v => update((p: any) => ({ ...p, tax: { ...p.tax, indexation: v ? 'cpi' : 'frozen' } }))} />
        <p style={{ color: 'var(--color-ink-dim)' }}>
          Off keeps them frozen for the whole plan, which overstates tax.
        </p>
      </Group>,
    });

    rest.push({
      id: 'draw', title: 'Drawing',
      body: <>
        <Group title="Tax-free cash">
          <div role="group"><Segmented small value={plan.pclsMode} onChange={(v: string) => update({ pclsMode: v })}
            options={[{ value: 'none', label: 'Take none' }, { value: 'phased', label: 'A little each year' }, { value: 'upfront', label: 'All at once' }]} /></div>
          <p style={{ color: 'var(--color-ink-dim)' }}>
            {plan.pclsMode === 'none' && 'Everything is drawn as taxable income: the simplest, and usually the most tax.'}
            {plan.pclsMode === 'phased' && 'A quarter of each withdrawal is tax-free: often the least tax.'}
            {plan.pclsMode === 'upfront' && 'All the tax-free cash is taken on the day you stop and reinvested outside the pension.'}
            {' '}Capped at £268,275 in a lifetime.
          </p>
        </Group>
        <Group title="Which pot first">
          <div role="group"><Segmented small value={plan.strategy} onChange={(v: string) => update({ strategy: v })}
            options={[{ value: 'sippfirst', label: 'Pensions' }, { value: 'isafirst', label: 'ISAs' }, { value: 'pafirst', label: 'Allowances' }]} /></div>
          <p style={{ color: 'var(--color-ink-dim)' }}>
            {plan.strategy === 'sippfirst' && 'Pensions up to the lower tax bands, then ISAs: keeps ISAs growing tax-free.'}
            {plan.strategy === 'isafirst' && 'ISAs first, pensions later: uses up the tax-free pot early.'}
            {plan.strategy === 'pafirst' && 'From pensions, only what the tax-free allowances cover, then ISAs: least tax now.'}
            {' '}Compare the lifetime tax of all three in Explore, and talk it through with an adviser before acting.
          </p>
        </Group>
      </>,
    });

    rest.push({
      id: 'lens', title: 'Growth rates', blurb: 'Most people leave these alone.',
      body: <Group>
        <PctField label="Poor" value={plan.growthBear} onChange={v => update({ growthBear: v, riskPreset: null })} />
        <PctField label="Base" value={plan.growthBase} onChange={v => update({ growthBase: v, riskPreset: null })} />
        <PctField label="Positive" value={plan.growthBull} onChange={v => update({ growthBull: v, riskPreset: null })} />
        {/* A spread too small for the share in shares flatters the futures count (review, 17 November 2026):
            world shares have swung by about 15–17% a year, so a portfolio's spread is roughly 16% × its share in shares. */}
        <PctField label="Volatility (a year)" value={plan.mcSd} onChange={v => update({ mcSd: v, riskPreset: null })}
          hint={(plan.mcSd || 0) < 0.144 * (plan.equityShare ?? 1) ? `Low for ${Math.round((plan.equityShare ?? 1) * 100)}% in shares: world shares have swung by about 15–17% a year, so about ${Math.round(16 * (plan.equityShare ?? 1))}% is more realistic. A smaller figure makes more futures look safe.` : undefined} />
        <PctField label="Share in shares (stress tests)" value={plan.equityShare ?? 1} onChange={v => update({ equityShare: v, riskPreset: null })} />
        <PctField label="Inflation" value={plan.inflation} onChange={v => update({ inflation: v })} />
      </Group>,
    });

    rest.push({
      id: 'structure', title: 'Safe ladder',
      body: plus
        ? <ArchitectureSection plan={plan} update={update} />
        : <Locked title="Safe ladder" onUpgrade={onUpgrade}
            line={(plan.architecture?.on
              ? 'Your plan runs a safe ladder — a gilt ladder, a growth engine and written spending rules. Plus lets you tune every part of it and measures whether it earns its keep.'
              : 'Model a gilt ladder, a growth engine and written spending rules instead of one growth rate — then see, measured on your own figures, whether the structure is worth it.')} />,
    });

    rest.push({
      id: 'file', title: 'Plan file',
      body: <>
        <Card>
          <div className="flex gap-2 py-3">
            <button onClick={() => {
                const blob = new Blob([exportPlanJson(plan)], { type: 'application/json' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `someday-plan-${new Date().toISOString().slice(0, 10)}.json`; a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 2000);
              }} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 min-h-[44px] text-[0.875rem] font-semibold"
              style={{ background: 'var(--color-surface)', color: 'var(--color-calm-strong)', border: '1px solid var(--color-hairline)' }}>
              <Download size={15} /> Export plan
            </button>
            <label className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 min-h-[44px] text-[0.875rem] font-semibold cursor-pointer"
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
          <p style={{ color: 'var(--color-ink-dim)' }}>
            A file for your own backup, or to move between devices. Nothing is uploaded anywhere.
          </p>
          {saved && (
            <p data-save-status role={saved.error ? 'alert' : undefined} className="pt-2" style={{ color: saved.error ? 'var(--color-hope)' : 'var(--color-ink-dim)', borderTop: '1px solid var(--color-hairline)' }}>
              {saved.error ? saved.error
                : saved.at ? `Saved on this device at ${new Date(saved.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Clearing site data, or another browser or device, starts blank: export a file to keep a copy.`
                : saved.at === 0 ? 'Saved on this device. Clearing site data, or another browser or device, starts blank: export a file to keep a copy.'
                : 'Not saved yet: change a figure and it is kept on this device.'}
            </p>
          )}
        </Card>
        {reset && (
          <div>
            <button onClick={reset}
              className="flex items-center justify-center gap-2 w-full rounded-2xl py-3 min-h-[44px] font-semibold text-[0.875rem] active:scale-[0.98] transition-transform"
              style={{ background: 'var(--color-canvas)', color: 'var(--color-hope)', border: '1px solid var(--color-hairline)' }}>
              <RotateCcw size={16} /> Start over — clear everything
            </button>
            <p className="mt-2 text-center text-[0.8125rem]" style={{ color: 'var(--color-ink-dim)' }}>
              Wipes every figure on this device and returns to the welcome screen.
            </p>
          </div>
        )}
      </>,
    });

    const restAt = list.length + 1;
    list.push({
      id: 'more', title: 'More', blurb: 'Most people leave these as they are.',
      body: <Card>
        {rest.map((r, k) => (
          <button key={r.id} type="button" data-more-row={r.title} onClick={() => { setMore(true); onIndex(restAt + k); }}
            className="w-full flex items-center gap-3 py-3 min-h-[56px] text-left" style={k ? { borderTop: '1px solid var(--color-hairline)' } : undefined}>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold" style={{ color: 'var(--color-ink)' }}>{r.title}</span>
              <span className="block text-[0.875rem] leading-snug" style={{ color: 'var(--color-ink-dim)' }}>{MORE_LINE[r.id]}</span>
            </span>
            <ChevronRight size={18} aria-hidden style={{ color: 'var(--color-ink-dim)' }} />
          </button>
        ))}
      </Card>,
    });
    if (more) list.push(...rest);

    return list;
  }, [plan, plus, adv, single, setup, more]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {issues.length > 0 && (
        <div className="rounded-2xl p-3 space-y-1 mb-4" role="alert"
             style={{ background: 'color-mix(in srgb, var(--color-hope) 12%, var(--color-canvas))', border: '1px solid color-mix(in srgb, var(--color-hope) 40%, transparent)' }}>
          {issues.map((it, k) => (
            <div key={k} className="flex items-start gap-2 text-[0.875rem] leading-snug" style={{ color: it.level === 'error' ? 'var(--color-hope)' : 'var(--color-ink-dim)' }}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{it.message}</span>
            </div>
          ))}
        </div>
      )}
      <Carousel pages={pages} index={index} onIndex={onIndex} footer={footer} railBg={railBg} />
    </div>
  );
}
