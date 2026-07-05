/**
 * RetireLens - Beta Cross-Check
 *
 * Runs every persona through the real engine AND the independent reference
 * model (tests/reference-model.js), then reconciles the outputs. This is the
 * "parallel model as an accuracy check" — differential testing.
 *
 * Checks:
 *   1. Independent income tax vs engine, across an income sweep.
 *   2. Independent accumulation pot vs engine, per persona.
 *   3. Per-year net-income delivery: while solvent and topping up from the pot,
 *      the engine should deliver ~= the target net income.
 *   4. Per-year tax reconciliation from the engine's own reported withdrawals.
 *
 * Run: node tests/beta-cross-check.js
 */

import { createPlan, runProjection, projectAccumulation } from '../engine/projections.js';
import { calculateTaxFromGross } from '../engine/tax.js';
import { refTaxFromGross, refAccumulate, makePclsTracker } from './reference-model.js';
import { SINGLE_PERSONAS } from './beta-personas.js';

let pass = 0, fail = 0;
const findings = [];
function check(cond, name, detail = '') {
  if (cond) { pass++; }
  else { fail++; findings.push(`${name}${detail ? ' — ' + detail : ''}`); }
}

const rel = (a, b) => Math.abs(a - b) / Math.max(1, Math.abs(b));

console.log('═══════════════════════════════════════════════════════════════');
console.log('  BETA CROSS-CHECK — engine vs independent reference model');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── 1. Independent tax vs engine, across an income sweep ─────
console.log('1. Income tax: independent model vs engine');
{
  const cfg = createPlan({ currentAge: 50, retirementAge: 60, targetNetIncome: 1 })
    .assumptions.tax; // England/Wales/NI config
  let worst = 0;
  for (let gross = 0; gross <= 200000; gross += 2500) {
    const eng = calculateTaxFromGross(gross, cfg).total;
    const ref = refTaxFromGross(gross, cfg).tax;
    worst = Math.max(worst, Math.abs(eng - ref));
    check(Math.abs(eng - ref) < 0.01, `tax mismatch at £${gross}`, `engine=${eng.toFixed(2)} ref=${ref.toFixed(2)}`);
  }
  console.log(`   max tax difference across sweep: £${worst.toFixed(4)}\n`);
}

// ── 2 & 3 & 4. Per-persona ──────────────────────────────────
for (const persona of SINGLE_PERSONAS) {
  console.log(`Persona: ${persona.label}`);
  const plan = createPlan({ name: persona.id, ...persona.inputs });
  const cfg = plan.assumptions.tax;
  const proj = runProjection(plan, { endAge: 90 });

  // 2. Accumulation pot
  const ng = plan.assumptions.projection.defaultGrowthRate - plan.assumptions.projection.defaultFeeRate;
  const years = persona.inputs.retirementAge - persona.inputs.currentAge;
  const refPension = refAccumulate({ startPot: persona.inputs.currentPension, annualContribution: persona.inputs.annualPensionContribution, years, netGrowthRate: ng });
  const refIsa = refAccumulate({ startPot: persona.inputs.currentIsa, annualContribution: persona.inputs.annualIsaContribution, years, netGrowthRate: ng });
  const engAcc = projectAccumulation(plan).finalBalances;
  check(rel(engAcc.pension, refPension) < 1e-6, `[${persona.id}] accumulation pension pot`, `engine=${engAcc.pension.toFixed(0)} ref=${refPension.toFixed(0)}`);
  check(rel(engAcc.isa, refIsa) < 1e-6, `[${persona.id}] accumulation ISA pot`, `engine=${engAcc.isa.toFixed(0)} ref=${refIsa.toFixed(0)}`);
  console.log(`   pot at retirement: engine £${Math.round(engAcc.total).toLocaleString()} | ref £${Math.round(refPension + refIsa).toLocaleString()}`);

  // 3 & 4. Per-year net delivery + tax reconciliation
  const potAtRet = engAcc.pension; // pot the PCLS entitlement is based on
  const pcls = makePclsTracker(potAtRet, { pclsRate: plan.assumptions.pension?.pclsRate || 0.25 });
  let worstUnderDelivery = 0, worstUnderYear = null;
  let worstTaxRecon = 0;

  for (const yr of proj.decumulation.years) {
    if (yr.fundsDepleted) continue;
    const target = yr.targetSpending;
    const sp = yr.statePension || 0;
    const db = yr.dbPension || 0;
    const pensionW = yr.withdrawals?.pension || 0;
    const isaW = yr.withdrawals?.isa || 0;

    // Independent tax on this year's income, applying marginal PCLS ourselves
    const taxablePension = pcls.taxablePortion(pensionW);
    const refTax = refTaxFromGross(sp + db + taxablePension, cfg);

    // 4. Does the engine's reported tax match an independent recompute?
    const taxDiff = Math.abs((yr.taxPaid || 0) - refTax.tax);
    worstTaxRecon = Math.max(worstTaxRecon, taxDiff);
    check(taxDiff < 1.0, `[${persona.id}] year ${yr.age} tax reconciliation`, `engine=${(yr.taxPaid||0).toFixed(2)} ref=${refTax.tax.toFixed(2)}`);

    // 3. Net delivery: the retiree actually receives the FULL pension cash
    // (both the taxable and the tax-free PCLS portions), plus ISA, less tax.
    const trueNetDelivered = sp + db + pensionW + isaW - refTax.tax;
    const guaranteedNet = refTaxFromGross(sp + db, cfg).net;
    // Only meaningful in years the pot tops income up toward the target.
    if (guaranteedNet < target - 1 && pensionW > 0) {
      const under = target - trueNetDelivered;
      if (under > worstUnderDelivery) { worstUnderDelivery = under; worstUnderYear = yr.age; }
    }
    // The engine's OWN reported netIncome should also equal the true delivered net.
    check(rel(yr.netIncome || 0, trueNetDelivered) < 0.02 || Math.abs((yr.netIncome||0) - trueNetDelivered) < 50,
      `[${persona.id}] year ${yr.age} netIncome reflects full pension cash`,
      `engineNet=${(yr.netIncome||0).toFixed(0)} trueNet=${trueNetDelivered.toFixed(0)}`);
  }

  console.log(`   worst per-year tax reconciliation gap: £${worstTaxRecon.toFixed(2)}`);
  console.log(`   worst net under-delivery vs target: £${worstUnderDelivery.toFixed(0)}${worstUnderYear ? ` (age ${worstUnderYear})` : ''}`);
  check(worstUnderDelivery < 100, `[${persona.id}] delivers target net while topping up`, `short by £${worstUnderDelivery.toFixed(0)}`);
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(`  CROSS-CHECK: ${pass} passed, ${fail} failed`);
console.log('═══════════════════════════════════════════════════════════════');
if (findings.length) {
  console.log('\nDiscrepancies (first 15):');
  findings.slice(0, 15).forEach(f => console.log(`  • ${f}`));
}
if (fail > 0) process.exitCode = 1;
