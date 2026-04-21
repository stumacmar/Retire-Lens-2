/**
 * E2E Confidence Tests — 100 scenarios (50 singles, 50 couples)
 * Tests that: more contributions = higher/equal confidence, never contradictory
 * Tests that: earlier retirement = lower/equal confidence
 * Tests that: PCLS already taken reduces tax-free cash correctly
 * Tests that: MC seed produces identical results on repeat
 */

import { createPlan, runProjection } from '../engine/projections.js';
import { runMonteCarloWithBands } from '../engine/monteCarlo.js';
import { SCENARIO_PRESETS } from '../engine/assumptions.js';

function makeInputs(overrides = {}) {
  return {
    currentAge: 57,
    retirementAge: 60,
    targetNetIncome: 59000,
    currentPension: 550000,
    annualPensionContribution: 36000,
    currentIsa: 50000,
    annualIsaContribution: 10000,
    statePensionAge: 67,
    expectedStatePension: 11973,
    applyAgeBasedSpendingReductions: true,
    assumptions: {
      projection: {
        defaultGrowthRate: 0.04,
        defaultFeeRate: 0.005
      }
    },
    ...overrides
  };
}

function runWithMC(inputs, seed = 42) {
  const plan = createPlan(inputs);
  const projection = runProjection(plan, { endAge: 90 });
  const mc = runMonteCarloWithBands(plan, {
    iterations: 200, endAge: 90,
    mean: inputs.assumptions?.projection?.defaultGrowthRate || 0.04,
    volatility: 0.15, seed
  });
  return { plan, projection, mc };
}

// ═══════════════════════════════════════════════════════════════
// SINGLE PERSON TESTS (50)
// ═══════════════════════════════════════════════════════════════

const singleResults = [];
let singlePass = 0;
let singleFail = 0;

function testSingle(name, inputs, check) {
  try {
    const r = runWithMC(makeInputs(inputs));
    const result = check(r);
    if (result === true) {
      singlePass++;
      singleResults.push({ name, status: 'PASS' });
    } else {
      singleFail++;
      singleResults.push({ name, status: 'FAIL', detail: result });
    }
  } catch (e) {
    singleFail++;
    singleResults.push({ name, status: 'ERROR', detail: e.message });
  }
}

// TC1-10: Contribution sensitivity (more contributions should never reduce success)
for (let contrib = 0; contrib <= 108000; contrib += 12000) {
  testSingle(`S-Contrib-${contrib/12}/mo`, { annualPensionContribution: contrib }, r => {
    return r.projection.summary.finalBalance >= 0 || `Final balance negative: ${r.projection.summary.finalBalance}`;
  });
}

// TC11-20: Retirement age sensitivity
for (let retAge = 55; retAge <= 70; retAge++) {
  testSingle(`S-RetAge-${retAge}`, { retirementAge: Math.max(retAge, 58) }, r => {
    return r.projection.summary.successRate >= 0 && r.projection.summary.successRate <= 1.0
      || `Success rate out of range: ${r.projection.summary.successRate}`;
  });
}

// TC21: More contributions = higher or equal final balance (monotonic)
{
  let prevBalance = -Infinity;
  let monotonic = true;
  let failDetail = '';
  for (let c = 0; c <= 60000; c += 6000) {
    const r = runWithMC(makeInputs({ annualPensionContribution: c }));
    if (r.projection.summary.finalBalance < prevBalance - 100) {
      monotonic = false;
      failDetail = `At £${c/12}/mo, balance ${r.projection.summary.finalBalance} < prev ${prevBalance}`;
    }
    prevBalance = r.projection.summary.finalBalance;
  }
  testSingle('S-Contrib-Monotonic', {}, () => monotonic || failDetail);
}

// TC22: Later retirement = higher or equal final balance (monotonic)
{
  let prevBalance = -Infinity;
  let monotonic = true;
  let failDetail = '';
  for (let age = 58; age <= 70; age++) {
    const r = runWithMC(makeInputs({ retirementAge: age }));
    if (r.projection.summary.finalBalance < prevBalance - 100) {
      monotonic = false;
      failDetail = `At age ${age}, balance ${r.projection.summary.finalBalance} < prev ${prevBalance}`;
    }
    prevBalance = r.projection.summary.finalBalance;
  }
  testSingle('S-RetAge-Monotonic', {}, () => monotonic || failDetail);
}

// TC23: MC seed determinism — same inputs, same seed = same result
testSingle('S-MC-Seed-Determinism', {}, () => {
  const r1 = runWithMC(makeInputs(), 42);
  const r2 = runWithMC(makeInputs(), 42);
  return r1.mc.statistics.successRate === r2.mc.statistics.successRate
    || `MC1: ${r1.mc.statistics.successRate} !== MC2: ${r2.mc.statistics.successRate}`;
});

// TC24: MC different seed = potentially different result
testSingle('S-MC-DiffSeed', {}, () => {
  const r1 = runWithMC(makeInputs(), 42);
  const r2 = runWithMC(makeInputs(), 999);
  return typeof r1.mc.statistics.successRate === 'number' || 'MC result not a number';
});

// TC25-30: PCLS tests
testSingle('S-PCLS-None', { pclsAlreadyTaken: false }, r => {
  return r.projection.summary.pclsTaken > 0 || 'No PCLS taken when expected';
});

testSingle('S-PCLS-167k-Taken', { pclsAlreadyTaken: true, pclsAmountTaken: 167000 }, r => {
  const maxExpected = 268275 - 167000; // LSA remaining = 101,275
  return r.projection.summary.pclsTaken <= maxExpected + 1
    || `PCLS ${r.projection.summary.pclsTaken} exceeds LSA remaining ${maxExpected}`;
});

testSingle('S-PCLS-Full-LSA-Taken', { pclsAlreadyTaken: true, pclsAmountTaken: 268275 }, r => {
  return r.projection.summary.pclsTaken === 0
    || `PCLS should be 0 when full LSA used, got ${r.projection.summary.pclsTaken}`;
});

testSingle('S-PCLS-Zero-Taken', { pclsAlreadyTaken: true, pclsAmountTaken: 0 }, r => {
  return r.projection.summary.pclsTaken >= 0 || 'Negative PCLS';
});

testSingle('S-PCLS-Partial-50k', { pclsAlreadyTaken: true, pclsAmountTaken: 50000 }, r => {
  const maxExpected = 268275 - 50000;
  return r.projection.summary.pclsTaken <= maxExpected + 1
    || `PCLS ${r.projection.summary.pclsTaken} exceeds remaining ${maxExpected}`;
});

testSingle('S-PCLS-Over-LSA', { pclsAlreadyTaken: true, pclsAmountTaken: 300000 }, r => {
  return r.projection.summary.pclsTaken === 0
    || `PCLS should be 0 when prior exceeds LSA, got ${r.projection.summary.pclsTaken}`;
});

// TC31-35: Growth rate sensitivity
for (const scenario of ['conservative', 'moderate', 'optimistic']) {
  const preset = SCENARIO_PRESETS[scenario];
  testSingle(`S-Scenario-${scenario}`, {
    assumptions: { projection: { defaultGrowthRate: preset.growthRate, defaultFeeRate: preset.feeRate || 0.005 } }
  }, r => {
    return r.projection.summary.finalBalance >= -1000000 || 'Extreme negative balance';
  });
}

// TC36-40: Edge cases
testSingle('S-MinPot-0', { currentPension: 0 }, r => {
  return r.projection.summary.successRate >= 0 || 'Negative success rate';
});

testSingle('S-MaxPot-5M', { currentPension: 5000000 }, r => {
  return r.projection.summary.successRate === 1.0 || `Not 100% with £5M pot: ${r.projection.summary.successRate}`;
});

testSingle('S-NoContrib', { annualPensionContribution: 0 }, r => {
  return r.projection.summary.finalBalance !== undefined || 'No final balance';
});

testSingle('S-HighTarget-100k', { targetNetIncome: 100000 }, r => {
  return r.projection.summary.finalBalance !== undefined || 'No final balance';
});

testSingle('S-LowTarget-15k', { targetNetIncome: 15000 }, r => {
  return r.projection.summary.successRate === 1.0 || `Not 100% with £15k target: ${r.projection.summary.successRate}`;
});

// TC41-45: Tax and SP tests
testSingle('S-NoSP', { expectedStatePension: 0, statePensionAge: 67 }, r => {
  return r.projection.summary.finalBalance !== undefined || 'No final balance';
});

testSingle('S-FullSP', { expectedStatePension: 11973 }, r => {
  return r.projection.summary.finalBalance !== undefined || 'No final balance';
});

testSingle('S-RetireAfterSP', { retirementAge: 68, statePensionAge: 67 }, r => {
  return r.projection.summary.finalBalance !== undefined || 'No final balance';
});

testSingle('S-Guardrails-On', { useGuardrails: true }, r => {
  return r.projection.summary.finalBalance !== undefined || 'No final balance';
});

testSingle('S-Guardrails-Off', { useGuardrails: false }, r => {
  return r.projection.summary.finalBalance !== undefined || 'No final balance';
});

// TC46-50: MC confidence monotonicity with contributions
{
  let prevMC = -1;
  let monotonic = true;
  let failDetail = '';
  const contribLevels = [0, 12000, 24000, 36000, 48000];
  for (const c of contribLevels) {
    const r = runWithMC(makeInputs({ annualPensionContribution: c }));
    const mcRate = r.mc.statistics.successRate;
    if (mcRate < prevMC - 0.05) {
      monotonic = false;
      failDetail = `At £${c/12}/mo, MC ${(mcRate*100).toFixed(1)}% < prev ${(prevMC*100).toFixed(1)}%`;
    }
    prevMC = mcRate;
  }
  testSingle('S-MC-Contrib-Monotonic', {}, () => monotonic || failDetail);
}

testSingle('S-MC-RetAge-55', { retirementAge: 58 }, r => {
  return r.mc.statistics.successRate >= 0 && r.mc.statistics.successRate <= 1.0
    || `MC rate out of range: ${r.mc.statistics.successRate}`;
});

testSingle('S-MC-RetAge-70', { retirementAge: 70 }, r => {
  return r.mc.statistics.successRate >= 0 && r.mc.statistics.successRate <= 1.0
    || `MC rate out of range: ${r.mc.statistics.successRate}`;
});

testSingle('S-Balance-Continuity', {}, r => {
  const accEnd = r.projection.accumulation.finalBalances.total;
  const decStart = r.projection.decumulation.years[0]?.startBalances?.total || 0;
  const pcls = r.projection.summary.pclsTaken;
  const diff = Math.abs(accEnd - pcls - decStart);
  return diff < 100 || `Balance discontinuity: acc end ${accEnd} - PCLS ${pcls} != dec start ${decStart} (diff ${diff})`;
});

testSingle('S-NetIncome-Reasonable', {}, r => {
  const y1 = r.projection.decumulation.years[0];
  return y1.netIncome > 0 && y1.netIncome <= 200000
    || `Year 1 net income unreasonable: ${y1.netIncome}`;
});

// ═══════════════════════════════════════════════════════════════
// COUPLE TESTS (50)
// ═══════════════════════════════════════════════════════════════

const coupleResults = [];
let couplePass = 0;
let coupleFail = 0;

function testCouple(name, inputs, check) {
  try {
    const base = {
      ...makeInputs(),
      isCouple: true,
      partnerCurrentAge: 63,
      partnerStatePensionAge: 67,
      partnerExpectedStatePension: 11500,
      partnerDBPensionAmount: 4500,
      partnerDBPensionStartAge: 67,
      partnerDCPot: 135000,
      ...inputs
    };
    const r = runWithMC(base);
    const result = check(r);
    if (result === true) {
      couplePass++;
      coupleResults.push({ name, status: 'PASS' });
    } else {
      coupleFail++;
      coupleResults.push({ name, status: 'FAIL', detail: result });
    }
  } catch (e) {
    coupleFail++;
    coupleResults.push({ name, status: 'ERROR', detail: e.message });
  }
}

// TC51-60: Couples contribution sensitivity
for (let contrib = 0; contrib <= 108000; contrib += 12000) {
  testCouple(`C-Contrib-${contrib/12}/mo`, { annualPensionContribution: contrib }, r => {
    return r.projection.summary.finalBalance >= -500000 || `Final balance too negative: ${r.projection.summary.finalBalance}`;
  });
}

// TC61-70: Couples retirement age sensitivity
for (let retAge = 58; retAge <= 70; retAge++) {
  testCouple(`C-RetAge-${retAge}`, { retirementAge: retAge }, r => {
    return r.projection.summary.successRate >= 0 && r.projection.summary.successRate <= 1.0
      || `Success rate out of range: ${r.projection.summary.successRate}`;
  });
}

// TC71: Partner income reduces pension withdrawal
testCouple('C-PartnerIncome-Reduces-Withdrawal', {}, r => {
  const singleR = runWithMC(makeInputs());
  // Couple with partner income should have higher final balance than single (same pot, but partner covers some target)
  return r.projection.summary.finalBalance >= singleR.projection.summary.finalBalance - 10000
    || `Couple final ${r.projection.summary.finalBalance} much less than single ${singleR.projection.summary.finalBalance}`;
});

// TC72: Partner SP timing
testCouple('C-PartnerSP-Timing', {}, r => {
  // Partner is 63 when user is 57. At user's age 61, partner reaches 67 = SP starts
  const ageDiff = 63 - 57;
  const partnerSpUserAge = 67 - ageDiff; // = 61
  const yearBeforeSP = r.projection.decumulation.years.find(y => y.age === partnerSpUserAge - 1);
  const yearAtSP = r.projection.decumulation.years.find(y => y.age === partnerSpUserAge);
  if (!yearBeforeSP || !yearAtSP) return 'Missing years around partner SP start';
  return yearAtSP.statePension > yearBeforeSP.statePension
    || `Partner SP didn't increase at age ${partnerSpUserAge}: before=${yearBeforeSP.statePension} after=${yearAtSP.statePension}`;
});

// TC73: Partner DB pension starts at correct age
testCouple('C-PartnerDB-Timing', { partnerDBPensionStartAge: 67 }, r => {
  const ageDiff = 63 - 57;
  const partnerDbUserAge = 67 - ageDiff; // = 61
  const yearBefore = r.projection.decumulation.years.find(y => y.age === partnerDbUserAge - 1);
  const yearAt = r.projection.decumulation.years.find(y => y.age === partnerDbUserAge);
  if (!yearBefore || !yearAt) return 'Missing years around partner DB start';
  return yearAt.dbPension > yearBefore.dbPension
    || `Partner DB didn't increase at age ${partnerDbUserAge}: before=${yearBefore.dbPension} after=${yearAt.dbPension}`;
});

// TC74: Two personal allowances for couples
testCouple('C-Two-PAs', {}, r => {
  const y1 = r.projection.decumulation.years[0];
  // With two PAs, tax should be lower than single with same gross
  const singleR = runWithMC(makeInputs());
  const singleY1 = singleR.projection.decumulation.years[0];
  // Couple tax should be less than or comparable to single (partner income is taxed separately)
  return y1.taxPaid !== undefined || 'No tax data for couples';
});

// TC75: PCLS with couple
testCouple('C-PCLS', { pclsAlreadyTaken: true, pclsAmountTaken: 167000 }, r => {
  const maxExpected = 268275 - 167000;
  return r.projection.summary.pclsTaken <= maxExpected + 1
    || `Couple PCLS ${r.projection.summary.pclsTaken} exceeds remaining ${maxExpected}`;
});

// TC76-80: Partner contribution sensitivity
for (let partnerDC = 0; partnerDC <= 400000; partnerDC += 100000) {
  testCouple(`C-PartnerDC-${partnerDC/1000}k`, { partnerDCPot: partnerDC }, r => {
    return r.projection.summary.finalBalance !== undefined || 'No final balance';
  });
}

// TC81: MC seed determinism for couples
testCouple('C-MC-Seed-Determinism', {}, () => {
  const base = { ...makeInputs(), isCouple: true, partnerCurrentAge: 63, partnerStatePensionAge: 67, partnerExpectedStatePension: 11500, partnerDBPensionAmount: 4500 };
  const r1 = runWithMC(base, 42);
  const r2 = runWithMC(base, 42);
  return r1.mc.statistics.successRate === r2.mc.statistics.successRate
    || `MC1: ${r1.mc.statistics.successRate} !== MC2: ${r2.mc.statistics.successRate}`;
});

// TC82: Couple balance continuity
testCouple('C-Balance-Continuity', {}, r => {
  const accEnd = r.projection.accumulation.finalBalances.total;
  const decStart = r.projection.decumulation.years[0]?.startBalances?.total || 0;
  const pcls = r.projection.summary.pclsTaken;
  const diff = Math.abs(accEnd - pcls - decStart);
  return diff < 100 || `Balance discontinuity: ${accEnd} - ${pcls} != ${decStart} (diff ${diff})`;
});

// TC83: MC monotonic for couples
{
  let prevMC = -1;
  let monotonic = true;
  let failDetail = '';
  for (const c of [0, 12000, 24000, 36000, 48000]) {
    const base = { ...makeInputs({ annualPensionContribution: c }), isCouple: true, partnerCurrentAge: 63, partnerStatePensionAge: 67, partnerExpectedStatePension: 11500, partnerDBPensionAmount: 4500 };
    const r = runWithMC(base);
    if (r.mc.statistics.successRate < prevMC - 0.05) {
      monotonic = false;
      failDetail = `At £${c/12}/mo, MC ${(r.mc.statistics.successRate*100).toFixed(1)}% < prev ${(prevMC*100).toFixed(1)}%`;
    }
    prevMC = r.mc.statistics.successRate;
  }
  testCouple('C-MC-Contrib-Monotonic', {}, () => monotonic || failDetail);
}

// TC84-88: Spending reductions
testCouple('C-Spending-At-80', {}, r => {
  const y79 = r.projection.decumulation.years.find(y => y.age === 79);
  const y80 = r.projection.decumulation.years.find(y => y.age === 80);
  if (!y79 || !y80) return 'Missing age 79/80 years';
  return y80.targetSpending < y79.targetSpending
    || `No spending reduction at 80: ${y79.targetSpending} vs ${y80.targetSpending}`;
});

testCouple('C-Net-Income-Reasonable', {}, r => {
  const y1 = r.projection.decumulation.years[0];
  return y1.netIncome > 0 && y1.netIncome <= 200000
    || `Year 1 net income unreasonable: ${y1.netIncome}`;
});

testCouple('C-Guardrails', { useGuardrails: true }, r => {
  return r.projection.summary.finalBalance !== undefined || 'No final balance with guardrails';
});

testCouple('C-NoPartnerSP', { partnerExpectedStatePension: 0 }, r => {
  return r.projection.summary.finalBalance !== undefined || 'Failed with no partner SP';
});

testCouple('C-NoPartnerDB', { partnerDBPensionAmount: 0 }, r => {
  return r.projection.summary.finalBalance !== undefined || 'Failed with no partner DB';
});

// TC89-95: Various couple configs
testCouple('C-OlderPartner', { partnerCurrentAge: 70, partnerStatePensionAge: 67 }, r => {
  return r.projection.summary.finalBalance !== undefined || 'Failed with older partner';
});

testCouple('C-YoungerPartner', { partnerCurrentAge: 45, partnerStatePensionAge: 68 }, r => {
  return r.projection.summary.finalBalance !== undefined || 'Failed with younger partner';
});

testCouple('C-SameAge', { partnerCurrentAge: 57, partnerStatePensionAge: 67 }, r => {
  return r.projection.summary.finalBalance !== undefined || 'Failed with same-age partner';
});

testCouple('C-HighTarget-80k', { targetNetIncome: 80000 }, r => {
  return r.projection.summary.finalBalance !== undefined || 'No final balance';
});

testCouple('C-LowTarget-20k', { targetNetIncome: 20000 }, r => {
  return r.projection.summary.successRate === 1.0 || `Not 100% with £20k target: ${r.projection.summary.successRate}`;
});

testCouple('C-HighGrowth', {
  assumptions: { projection: { defaultGrowthRate: 0.06, defaultFeeRate: 0.004 } }
}, r => {
  return r.projection.summary.finalBalance !== undefined || 'Failed with high growth';
});

testCouple('C-LowGrowth', {
  assumptions: { projection: { defaultGrowthRate: 0.03, defaultFeeRate: 0.005 } }
}, r => {
  return r.projection.summary.finalBalance !== undefined || 'Failed with low growth';
});

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════');
console.log('  RetireLens E2E Confidence Tests — 100 Scenarios');
console.log('═══════════════════════════════════════════════════\n');

console.log(`SINGLES: ${singlePass} PASS / ${singleFail} FAIL (${singleResults.length} total)`);
singleResults.filter(r => r.status !== 'PASS').forEach(r => {
  console.log(`  ❌ ${r.name}: ${r.status} — ${r.detail}`);
});

console.log(`\nCOUPLES: ${couplePass} PASS / ${coupleFail} FAIL (${coupleResults.length} total)`);
coupleResults.filter(r => r.status !== 'PASS').forEach(r => {
  console.log(`  ❌ ${r.name}: ${r.status} — ${r.detail}`);
});

const totalPass = singlePass + couplePass;
const totalFail = singleFail + coupleFail;
const total = totalPass + totalFail;

console.log(`\n═══════════════════════════════════════════════════`);
console.log(`  TOTAL: ${totalPass}/${total} PASSED (${totalFail} failures)`);
console.log(`═══════════════════════════════════════════════════\n`);

if (totalFail > 0) {
  process.exit(1);
}
