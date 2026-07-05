/**
 * RetireLens - "What could I change?" nudge tests
 * Run: node tests/nudges.test.js
 */

import { computeNudges } from '../engine/nudges.js';
import { createPlan, runProjection } from '../engine/projections.js';

let pass = 0, fail = 0;
const assert = (c, name, d = '') => c ? pass++ : (fail++, console.error(`  ✗ ${name}${d ? ' — ' + d : ''}`));

console.log('═══════════════════════════════════════════════════════════════');
console.log('  NUDGES — "What could I change?"');
console.log('═══════════════════════════════════════════════════════════════\n');

const lastsFull = (inputs) => runProjection(createPlan(inputs), { endAge: 90 }).summary.successRate >= 1;

// 1. On track → no fix chips, onTrack true
const onTrack = { currentAge: 56, retirementAge: 67, targetNetIncome: 20000, currentPension: 400000, currentIsa: 80000, annualPensionContribution: 12000, annualIsaContribution: 4000, expectedStatePension: 11973, statePensionAge: 67 };
{
  const n = computeNudges(onTrack, { endAge: 90 });
  assert(n.onTrack === true, 'on-track plan flagged onTrack');
  assert(n.chips.length === 0, 'on-track plan shows no fix chips', `got ${n.chips.length}`);
  assert(n.deeperHelp === false, 'on-track plan needs no deeper help');
}

// 2. Mild shortfall that a lever can fix → at least one closing chip
const mild = { currentAge: 55, retirementAge: 63, targetNetIncome: 29000, currentPension: 200000, currentIsa: 30000, annualPensionContribution: 7000, annualIsaContribution: 1500, expectedStatePension: 11973, statePensionAge: 67 };
{
  const n = computeNudges(mild, { endAge: 90 });
  assert(n.onTrack === false, 'mild shortfall not on track');
  const closers = n.chips.filter(c => c.closesGap);
  assert(closers.length >= 1, 'mild shortfall offers at least one closing lever', `chips=${n.chips.length}`);
  // Integrity: applying a closing chip's tweak really makes the plan last
  for (const c of closers) {
    assert(lastsFull({ ...mild, ...c.tweakedInputs }), `closing chip (${c.lever}) really closes the gap`);
  }
}

// 3. Already retired → no retireLater / saveMore chips
const retired = { currentAge: 68, retirementAge: 68, targetNetIncome: 30000, currentPension: 250000, currentIsa: 20000, annualPensionContribution: 0, annualIsaContribution: 0, expectedStatePension: 11973, statePensionAge: 67 };
{
  const n = computeNudges(retired, { endAge: 90 });
  assert(!n.chips.some(c => c.lever === 'retireLater'), 'retired: no "retire later" lever');
  assert(!n.chips.some(c => c.lever === 'saveMore'), 'retired: no "save more" lever');
}

// 4. Severe shortfall → deeperHelp, at most one (best partial) chip
const severe = { currentAge: 60, retirementAge: 62, targetNetIncome: 45000, currentPension: 90000, currentIsa: 10000, annualPensionContribution: 2000, annualIsaContribution: 0, expectedStatePension: 11973, statePensionAge: 67 };
{
  const n = computeNudges(severe, { endAge: 90 });
  assert(n.deeperHelp === true, 'severe shortfall flags deeper help');
  assert(n.chips.length <= 1, 'severe shortfall shows at most one (best-partial) chip', `got ${n.chips.length}`);
}

// 5. Trim lever never drops the target below the income floor
const trimFloor = { currentAge: 61, retirementAge: 63, targetNetIncome: 16000, currentPension: 70000, currentIsa: 5000, annualPensionContribution: 1000, annualIsaContribution: 0, expectedStatePension: 11973, statePensionAge: 67 };
{
  const n = computeNudges(trimFloor, { endAge: 90 });
  const trim = n.chips.find(c => c.lever === 'trimIncome');
  if (trim) assert(trim.newTarget >= Math.max(12000, 11973 + 3000), 'trim respects the income floor', `newTarget=${trim.newTarget}`);
  else assert(true, 'trim respects the income floor (no trim offered below floor)');
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
console.log('═══════════════════════════════════════════════════════════════');
if (fail > 0) process.exit(1);
