/**
 * RetireLens - "What could I change?" nudges
 *
 * Pure, DOM-free logic for the gentle levers shown on the results page. For a
 * plan with a shortfall it finds, for each lever, the SMALLEST change that makes
 * the money last the full horizon ("the gentlest fix"). For a plan already on
 * track it simply reports that, leaving the UI to offer a quiet "explore" path.
 *
 * Every lever is just a re-run of the deterministic projection with one input
 * tweaked — no new maths, and cheap enough to search a few increments.
 */

import { createPlan, runProjection } from './projections.js';

const RETIRE_STEPS = [1, 2, 3];        // extra years
const SAVE_STEPS = [50, 100, 200];     // extra £ per month
const TRIM_STEPS = [1000, 2000, 3000]; // £ per year off the target
const RETIRE_AGE_CAP = 70;

/**
 * @param {object} baseInputs - the inputs used to build the current plan
 *   (same shape passed to createPlan: currentAge, retirementAge,
 *    targetNetIncome, annualPensionContribution, expectedStatePension, …)
 * @param {object} options - { endAge, assumptions }
 * @returns {{onTrack, baselineDepletionAge, chips, deeperHelp}}
 */
export function computeNudges(baseInputs, options = {}) {
  const { endAge = 90, assumptions = {} } = options;

  const project = (override) => {
    const plan = createPlan({ ...baseInputs, ...override, assumptions });
    return runProjection(plan, { endAge }).summary;
  };

  // "Lasts the full plan" = income supported for the whole horizon. Using
  // successRate >= 1 (rather than the raw fundsDepleted flag) correctly treats
  // a plan that just reaches the final year as making it.
  const lasts = (summary) => summary.successRate >= 1;

  const base = project({});
  const onTrack = lasts(base);

  const currentAge = baseInputs.currentAge;
  const retirementAge = baseInputs.retirementAge;
  const alreadyRetired = currentAge >= retirementAge;
  const yearsToRetirement = retirementAge - currentAge;
  const statePension = baseInputs.expectedStatePension || 0;
  const incomeFloor = Math.max(12000, statePension + 3000);
  const baseContribAnnual = baseInputs.annualPensionContribution || 0;
  const target = baseInputs.targetNetIncome;

  // Walk a lever's increments smallest→largest; return the first that makes the
  // money last the full horizon, else the largest attempt (a partial help).
  function search(steps, makeOverride) {
    let partial = null;
    for (const step of steps) {
      const summary = project(makeOverride(step));
      const entry = { step, summary, closesGap: lasts(summary), override: makeOverride(step) };
      if (entry.closesGap) return entry;
      partial = entry; // keep the largest tried as the best partial
    }
    return partial;
  }

  const chips = [];

  // Retire a little later
  if (!alreadyRetired && retirementAge < RETIRE_AGE_CAP) {
    const steps = RETIRE_STEPS.filter(n => retirementAge + n <= RETIRE_AGE_CAP);
    const r = search(steps, n => ({ retirementAge: retirementAge + n }));
    if (r) chips.push(toChip('retireLater', r, { newRetirementAge: retirementAge + r.step }));
  }

  // Save a bit more each month (needs runway)
  if (!alreadyRetired && yearsToRetirement >= 2) {
    const r = search(SAVE_STEPS, m => ({ annualPensionContribution: baseContribAnnual + m * 12 }));
    if (r) chips.push(toChip('saveMore', r, { extraPerMonth: r.step }));
  }

  // Adjust the target income (respecting a floor)
  {
    const steps = TRIM_STEPS.filter(s => target - s >= incomeFloor);
    const r = search(steps, s => ({ targetNetIncome: target - s }));
    if (r) chips.push(toChip('trimIncome', r, { newTarget: target - r.step, reduction: r.step }));
  }

  const anyCloses = chips.some(c => c.closesGap);
  // If nothing fully closes the gap, keep only the single best partial (largest
  // depletion-age improvement) so we never show a wall of "not enough" chips.
  let finalChips = chips;
  if (!onTrack && !anyCloses && chips.length) {
    finalChips = [chips.slice().sort((a, b) =>
      (b.newDepletionAge || 0) - (a.newDepletionAge || 0))[0]];
  } else if (!onTrack) {
    finalChips = chips.filter(c => c.closesGap).slice(0, 3);
  } else {
    finalChips = []; // on track — the UI offers a quiet "explore" toggle instead
  }

  return {
    onTrack,
    baselineDepletionAge: base.depletionAge || null,
    deeperHelp: !onTrack && !anyCloses,
    chips: finalChips,
  };
}

function toChip(lever, result, display) {
  const s = result.summary;
  return {
    lever,
    increment: result.step,
    closesGap: result.closesGap,
    newDepletionAge: result.closesGap ? null : s.depletionAge,
    finalBalance: Math.max(0, Math.round((s.finalBalance || 0) / 10000) * 10000),
    tweakedInputs: result.override,
    ...display,
  };
}
