import { E } from '../lib/usePlan';
import { fmt, pct } from '../lib/format';
import Accordion from './Accordion';

/**
 * Every assumption behind the numbers, generated from the plan and the engine
 * constants rather than typed in — so it can never drift from the maths.
 * Free, because trust is the product.
 */
export default function Assumptions({ plan, mc }: { plan: any; mc: any }) {
  const T = (E as any).taxFor(plan, plan.startYear);
  const indexed = T.indexation !== 'frozen';
  const scot = T.region === 'scotland';
  const schemes = (E as any).DB_SCHEMES as Record<string, any>;
  const rows: [string, string][] = [];
  const add = (k: string, v: string) => rows.push([k, v]);

  add('Money', 'Every figure is shown in today’s money. Growth, inflation and tax are applied year by year in nominal terms and deflated back.');
  add('Tax year', `UK ${T.taxYear || '2026/27'} · ${scot ? 'Scottish' : 'England, Wales & NI'} income-tax bands. Personal allowance ${fmt(T.personalAllowance)}, tapering £1 per £2 above ${fmt(T.taperStart)}.`);
  const scotBands = ((E as any).SCOT_BANDS as { upTo: number; rate: number }[]) || [];
  const scotNames = ['Starter', 'Basic', 'Intermediate', 'Higher', 'Advanced', 'Top'];
  add(scot ? 'Scottish bands' : 'Bands', scot
    ? scotBands.map((b, i) => `${scotNames[i] || ''} ${pct(b.rate, 0)}${Number.isFinite(b.upTo) ? ` to ${fmt(T.personalAllowance + b.upTo)} gross` : ' above'}`).join(' · ') + '.'
    : `Basic ${pct(T.basicRate, 0)} to ${fmt(T.higherThreshold)} · higher ${pct(T.higherRate, 0)} to ${fmt(T.additionalThreshold)} · additional ${pct(T.additionalRate, 0)} above.`);
  add('Thresholds over time', indexed ? `Frozen to April 2031 as announced, then the personal allowance, band edges and the taper point rise with your inflation assumption (${pct(plan.inflation, 1)}). The lump sum allowance (${fmt(T.pclsCap)}) and the ISA allowance stay fixed.` : 'Held frozen for the whole plan (your choice under Details), which overstates lifetime tax over a long retirement.');
  add('Tax-free cash', `25% of untouched pension, within one lump sum allowance of ${fmt(T.pclsCap)} per person shared across personal pensions and scheme lump sums in the order they are paid, less anything already taken; the excess is taxed as income. Mode: ${plan.pclsMode === 'none' ? 'none taken' : plan.pclsMode === 'phased' ? 'a slice with each draw' : 'all at once in the first year the pension can be accessed, up to the ISA allowance into the ISA and the rest invested in a general account that feeds the ISA each year'}.`);
  add('Pension access', `Personal and workplace pensions can be drawn from ${(E as any).nmpaFor(plan.partnerA)} for ${plan.partnerA.name}${plan.household === 'single' ? '' : ` and ${(E as any).nmpaFor(plan.partnerB)} for ${plan.partnerB.name}`} (55, rising to 57 from April 2028 for those born from 1973; protected ages honoured). Before that only ISAs, cash and earnings fund the plan.`);
  add('Withdrawal order', plan.strategy === 'sippfirst' ? 'Pensions to the cheap tax bands first, ISAs for the excess.' : plan.strategy === 'isafirst' ? 'ISAs first, pensions deferred.' : 'Pensions to the free allowances only, then ISAs.');
  add(plan.household === 'single' ? 'One person' : 'Couples', plan.household === 'single' ? 'One State Pension, one personal allowance, one nil-rate band.' : `Each partner is taxed on their own income with their own allowance and bands. Pension draws are allocated to whoever has the cheaper next pound. After a first death the survivor is modelled alone: one State Pension, the scheme survivor pension (half unless set otherwise), the pots inherited (tax-free when death is before 75, taxable after) and spending at ${pct(plan.survivorSpend ?? 0.75, 0)} of the couple's. Ages to plan for are set per person under People; otherwise both run to the horizon.`);
  add('State Pension', `${plan.partnerA.name}: ${fmt(plan.partnerA.spAmount)} a year from ${(E as any).spAgeOf(plan.partnerA)}${plan.household !== 'single' && plan.partnerB?.birthYear ? ` · ${plan.partnerB.name}: ${fmt(plan.partnerB.spAmount)} from ${(E as any).spAgeOf(plan.partnerB)}` : ''} (ages from birth year under current law unless overridden). Rises with inflation (today’s money held).`);
  add('Growth', `Poor ${pct(plan.growthBear, 1)} · Base ${pct(plan.growthBase, 1)} · Positive ${pct(plan.growthBull, 1)} a year, nominal, before charges of ${pct(plan.fee || 0, 2)} a year which come off every return, on pensions, ISAs and the general account. Cash ${pct(plan.cashGrowth || 0, 1)}.${plan.riskPreset ? ` Preset: ${plan.riskPreset}.` : ''}`);
  add('Inflation', `${pct(plan.inflation, 1)} a year, applied to spending, State Pensions and indexed pensions.`);
  add('Range of futures', `${(mc?.nPaths || 2000).toLocaleString()} simulated market histories from today, through the saving years as well as the spending years. Returns are drawn each year from a normal distribution with standard deviation ${pct(plan.mcSd, 1)} and an arithmetic mean set so the median path compounds at the chosen lens rate (${pct(plan.growthBase, 1)} under Base: mean ${pct((mc && mc.mcMean) != null ? mc.mcMean : plan.growthBase + plan.mcSd * plan.mcSd / 2, 2)} before charges); seed ${plan.mcSeed || 42} so the result repeats. Every path funds each year exactly as the central plan does. Confidence is the share of paths that paid the full planned spending every year, shown with its sampling range; a second figure weights each path by the chance the household is still here (a unisex Gompertz mortality curve fitted to ONS tables), which is the chance the money outlives you. No fat tails, no return-to-mean.`);
  add('Spending', `${fmt(plan.targetNet)} a year net${plan.phase1On ? `, easing ${pct(plan.phase1Cut, 0)} from ${plan.phase1Age}` : ''}${plan.phase2On ? `, ${pct(plan.phase2Cut, 0)} in total from ${plan.phase2Age}` : ''}. Planned to age ${plan.horizonAge} of the younger partner (${(E as any).planEndYear(plan)}), with both partners’ incomes and spending running to the end.`);
  add('Plan structure', plan.architecture?.on
    ? `On: a ${plan.architecture.ladderYears}-year gilt ladder (${pct(plan.architecture.giltReal, 1)} real), growth engine ${pct(plan.architecture.equityReal, 1)} real equity ± ${pct(plan.architecture.equitySd, 0)}, ${pct(plan.architecture.goldPct, 0)} diversifiers; rules ${plan.architecture.rulesOn ? 'on' : 'off'}.`
    : 'Off: one blended growth rate across all invested money.');
  for (const key of ['partnerA', 'partnerB']) {
    const who = plan[key];
    for (const t of (who?.dbSchemes || [])) {
      if (!t || !(Number(t.pension) > 0 || (t.accruing && t.salary > 0))) continue;
      const b = (E as any).trancheBenefits(plan, who, t);
      const sc = schemes[t.scheme] || schemes.custom;
      add(`${who.name} · ${b.label}`, `Normal pension age ${b.npa}; taken at ${b.takeAge}${b.early ? ` with ${pct(sc.earlyRate, 1)} a year compounded reduction (${pct(1 - b.factor, 0)} in total)` : b.late ? ` with ${pct(sc.lateRate, 1)} a year uplift` : ''}; lump sum ${b.autoMult}× automatic, commutation ${b.rate}:1 within the 25% limit; CPI-linked in deferment and payment${sc.revalReal ? `; in-service revaluation CPI + ${pct(sc.revalReal, 2)}` : ''}. Scheme factors as published to ${(E as any).DB_SCHEMES_ASOF}; your scheme’s own quote takes precedence.`);
    }
  }
  if (plan.iht) add('Inheritance tax', `Nil-rate band ${fmt(plan.iht.nilRateBand)} and residence band up to ${fmt(plan.iht.residenceNRB)} per person${plan.iht.couple ? ', doubled for a couple' : ''}, the residence band only against a home and never more than its value (and only when it passes to direct descendants), tapering above £2m; ${pct(plan.iht.rate, 0)} above; unused pensions in scope from ${plan.iht.pensionsInEstateFrom}.`);
  add('Stress tests', `Historic real-return shapes applied to the ${pct(plan.equityShare ?? 1, 0)} of your money in shares (the rest held at 1% real), replayed from the year you stop; with the plan structure on, the growth engine takes them in full.`);
  add('Not modelled', 'Random longevity (the age to plan for is a choice, not a draw); annuity pricing by age; dividend, savings-interest and capital-gains tax on the general account; benefits; care-cost means tests; scheme lump-sum reduction factors that differ from pension factors; contributions changing with pay; inherited State Pension.');

  return (
    <Accordion title="Every assumption behind your numbers">
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-canvas)' }}>
        {rows.map(([k, v], i) => (
          <div key={i} className="px-4 py-2.5" style={{ borderTop: i ? '1px solid var(--color-hairline)' : 'none' }}>
            <div className="text-[0.8rem] font-bold">{k}</div>
            <div className="text-[0.78rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{v}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[0.72rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
        Generated from the plan and the engine’s own constants, so this list cannot drift from the maths. Change any of it under Details.
      </p>
    </Accordion>
  );
}
