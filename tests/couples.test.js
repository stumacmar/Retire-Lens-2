/**
 * RetireLens Pro - Couples, Tax & PCLS Tests
 * 
 * Test suites for:
 * - Tax function banding (per-person)
 * - Couples timeline phasing (state pension/DB start ages)
 * - PCLS strategy (prevents one-year income spike)
 */

import { 
  computeUKTax, 
  calculateCouplesTax,
  calculateTaxFromGross,
  calculatePersonalAllowance
} from '../engine/tax.js';
import { 
  createPerson, 
  createHousehold,
  calculateHouseholdIncomeAtAge,
  generateHouseholdTimeline
} from '../engine/household.js';
import { 
  calculatePCLSStrategy, 
  PCLS_STRATEGIES,
  PCLS_DESTINATIONS
} from '../engine/withdrawals.js';
import { TAX_CONFIG } from '../config/defaults.js';

console.log('🧪 Starting Couples, Tax & PCLS Tests...\n');

// Test counter
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertClose(actual, expected, tolerance = 1, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(message || `Expected ${expected} (±${tolerance}), got ${actual}`);
  }
}

// =============================================================================
// TAX FUNCTION BANDING TESTS
// =============================================================================

console.log('📊 Testing Tax Function Banding...');

test('computeUKTax returns zero tax for zero income', () => {
  const result = computeUKTax({ statePension: 0 });
  assert(result.incomeTax === 0, 'Tax should be 0');
  assert(!isNaN(result.incomeTax), 'Tax should not be NaN');
  assert(!isNaN(result.netIncome), 'Net income should not be NaN');
});

test('computeUKTax returns zero tax for income within personal allowance', () => {
  const result = computeUKTax({ statePension: 12570 });
  assert(result.incomeTax === 0, 'Tax should be 0 within PA');
  assert(result.netIncome === 12570, 'Net should equal gross within PA');
});

test('computeUKTax calculates basic rate band correctly', () => {
  // £30,000 income: £12,570 PA, £17,430 taxable at 20% = £3,486
  const result = computeUKTax({ pensionWithdrawal: 30000 });
  const expectedTax = (30000 - 12570) * 0.20;
  assertClose(result.incomeTax, expectedTax, 1, 'Basic rate calculation incorrect');
});

test('computeUKTax calculates higher rate band correctly', () => {
  // £60,000 income: £37,700 at 20% + remainder at 40%
  const result = computeUKTax({ pensionWithdrawal: 60000 });
  const taxableIncome = 60000 - 12570;
  const basicRateTax = 37700 * 0.20;
  const higherRateTax = (taxableIncome - 37700) * 0.40;
  const expectedTax = basicRateTax + higherRateTax;
  assertClose(result.incomeTax, expectedTax, 1, 'Higher rate calculation incorrect');
});

test('computeUKTax handles ISA as tax-free', () => {
  const result = computeUKTax({ isaWithdrawal: 50000 });
  assert(result.incomeTax === 0, 'ISA should be tax-free');
  assert(result.netIncome === 50000, 'ISA net should equal withdrawal');
});

test('computeUKTax handles PCLS as tax-free', () => {
  const result = computeUKTax({ pclsWithdrawal: 100000 });
  assert(result.incomeTax === 0, 'PCLS should be tax-free');
  assert(result.netIncome === 100000, 'PCLS net should equal withdrawal');
});

test('computeUKTax handles mixed income correctly', () => {
  // SP £11,500 + DB £5,000 + Pension £20,000 + ISA £5,000
  const result = computeUKTax({
    statePension: 11500,
    dbPension: 5000,
    pensionWithdrawal: 20000,
    isaWithdrawal: 5000
  });
  
  const taxableIncome = 11500 + 5000 + 20000; // 36,500
  const taxableAfterPA = taxableIncome - 12570; // 23,930
  const expectedTax = taxableAfterPA * 0.20; // 4,786
  
  assertClose(result.incomeTax, expectedTax, 1, 'Mixed income tax calculation incorrect');
  assertClose(result.netIncome, taxableIncome + 5000 - expectedTax, 1, 'Mixed income net incorrect');
});

test('computeUKTax provides band breakdown', () => {
  const result = computeUKTax({ pensionWithdrawal: 60000 });
  assert(result.taxByBand && result.taxByBand.length > 0, 'Should have band breakdown');
  assert(result.taxByBand[0].name === 'Basic Rate', 'First band should be Basic Rate');
});

test('calculateCouplesTax works for single person', () => {
  const person1Income = { statePension: 11500, pensionWithdrawal: 20000 };
  const result = calculateCouplesTax(person1Income, null);
  
  assert(result.person1, 'Should have person1 result');
  assert(result.person2 === null, 'Should have no person2');
  assert(result.household.totalTax === result.person1.incomeTax, 'Household tax should equal person1 tax');
});

test('calculateCouplesTax calculates two personal allowances', () => {
  const person1Income = { statePension: 11500, pensionWithdrawal: 10000 };
  const person2Income = { statePension: 11500, pensionWithdrawal: 10000 };
  const result = calculateCouplesTax(person1Income, person2Income);
  
  assert(result.person1, 'Should have person1 result');
  assert(result.person2, 'Should have person2 result');
  
  // Both incomes within PA, so total tax should be 0
  const person1Taxable = 11500 + 10000; // 21,500 - within PA of 12,570, so 8,930 taxable
  const person2Taxable = 11500 + 10000;
  
  // Each person pays tax only on amount above PA
  assert(result.household.totalTax >= 0, 'Household tax should be non-negative');
  assert(result.household.combinedPersonalAllowance === 12570 * 2, 'Combined PA should be 2x individual');
});

// =============================================================================
// COUPLES TIMELINE PHASING TESTS
// =============================================================================

console.log('\n👥 Testing Couples Timeline Phasing...');

test('createPerson creates valid person with DC/DB/ISA', () => {
  const person = createPerson({
    name: 'Person A',
    currentAge: 55,
    retirementAge: 60,
    statePensionAge: 67,
    expectedStatePension: 11500,
    dcPot: 580000,
    dcMonthlyContrib: 4000,
    dbAnnual: 0,
    isaBalance: 50000,
    isaAnnualContrib: 10000
  });
  
  assert(person.currentAge === 55, 'Age should be 55');
  assert(person.dcPot === 580000, 'DC pot should be 580000');
  assert(person.dcAnnualContrib === 48000, 'Annual contrib should be monthly * 12');
  assert(person.isaBalance === 50000, 'ISA balance should be 50000');
});

test('createPerson handles annual contribution alternative to monthly', () => {
  const person = createPerson({
    currentAge: 55,
    dcAnnualContrib: 24000 // Annual instead of monthly
  });
  
  assert(person.dcAnnualContrib === 24000, 'Annual contrib should be preserved');
  assert(person.dcMonthlyContrib === 0, 'Monthly should be 0 when annual provided');
});

test('createPerson with DB pension', () => {
  const person = createPerson({
    name: 'Person B',
    currentAge: 62,
    retirementAge: 67,
    statePensionAge: 67,
    expectedStatePension: 11500,
    dcPot: 0,
    dbAnnual: 15000,
    dbStartAge: 67
  });
  
  assert(person.dbAnnual === 15000, 'DB pension should be 15000');
  assert(person.dbStartAge === 67, 'DB start age should be 67');
});

test('createHousehold for couple', () => {
  const household = createHousehold({
    type: 'couple',
    person1: {
      name: 'Person A',
      currentAge: 55,
      retirementAge: 60,
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    person2: {
      name: 'Person B',
      currentAge: 62,
      retirementAge: 67,
      statePensionAge: 67,
      expectedStatePension: 11500,
      dbAnnual: 15000,
      dbStartAge: 67
    }
  });
  
  assert(household.type === 'couple', 'Should be couple');
  assert(household.person1.currentAge === 55, 'Person 1 age should be 55');
  assert(household.person2.currentAge === 62, 'Person 2 age should be 62');
  assert(household.person2.dbAnnual === 15000, 'Person 2 DB pension should be 15000');
});

test('calculateHouseholdIncomeAtAge shows phased income correctly', () => {
  const household = createHousehold({
    type: 'couple',
    person1: {
      name: 'Person A',
      currentAge: 55,
      retirementAge: 60,
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    person2: {
      name: 'Person B', 
      currentAge: 62,
      retirementAge: 67,
      statePensionAge: 67,
      expectedStatePension: 11500,
      dbAnnual: 15000,
      dbStartAge: 67
    }
  });
  
  // At Person A age 60 (Person B age 67), both should have started their income
  const incomeAt60 = calculateHouseholdIncomeAtAge(household, 60);
  
  // Person A at 60: not receiving SP (starts at 67)
  assert(incomeAt60.person1.isReceivingStatePension === false, 'Person A should not receive SP at 60');
  
  // Person B at 67: receiving both SP and DB
  assert(incomeAt60.person2.isReceivingStatePension === true, 'Person B should receive SP at their age 67');
  assert(incomeAt60.person2.isReceivingDbPension === true, 'Person B should receive DB at their age 67');
  assert(incomeAt60.person2.statePension === 11500, 'Person B SP should be 11500');
  assert(incomeAt60.person2.dbPension === 15000, 'Person B DB should be 15000');
  
  // Total guaranteed income
  assert(incomeAt60.total.statePension === 11500, 'Total SP should be from Person B only');
  assert(incomeAt60.total.dbPension === 15000, 'Total DB should be from Person B only');
});

test('calculateHouseholdIncomeAtAge shows Person A SP starting later', () => {
  const household = createHousehold({
    type: 'couple',
    person1: {
      name: 'Person A',
      currentAge: 55,
      retirementAge: 60,
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    person2: {
      name: 'Person B',
      currentAge: 62,
      retirementAge: 67,
      statePensionAge: 67,
      expectedStatePension: 11500,
      dbAnnual: 15000,
      dbStartAge: 67
    }
  });
  
  // At Person A age 67, both should have SP + Person B's DB
  const incomeAt67 = calculateHouseholdIncomeAtAge(household, 67);
  
  assert(incomeAt67.person1.isReceivingStatePension === true, 'Person A should receive SP at 67');
  assert(incomeAt67.person2.isReceivingStatePension === true, 'Person B should still receive SP');
  
  // Total should be both SPs + DB
  assert(incomeAt67.total.statePension === 23000, 'Total SP should be 11500 * 2');
  assert(incomeAt67.total.guaranteedIncome === 38000, 'Total guaranteed should be 23000 + 15000');
});

test('generateHouseholdTimeline creates correct timeline', () => {
  const household = createHousehold({
    type: 'couple',
    person1: {
      name: 'Person A',
      currentAge: 55,
      retirementAge: 60,
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    person2: {
      name: 'Person B',
      currentAge: 62,
      retirementAge: 67,
      statePensionAge: 67,
      expectedStatePension: 11500,
      dbAnnual: 15000,
      dbStartAge: 67
    }
  });
  
  const timeline = generateHouseholdTimeline(household, 75);
  
  assert(timeline.length > 0, 'Timeline should have entries');
  assert(timeline[0].person1Age === 55, 'First entry should start at Person A current age');
  
  // Find entry at Person A age 60 (when Person B turns 67)
  const entryAt60 = timeline.find(t => t.person1Age === 60);
  assert(entryAt60, 'Should have entry at age 60');
  assert(entryAt60.person2Age === 67, 'Person B should be 67 when Person A is 60');
  assert(entryAt60.statePension === 11500, 'SP at 60 should be Person B only');
  assert(entryAt60.dbPension === 15000, 'DB at 60 should be from Person B');
});

// =============================================================================
// PCLS STRATEGY TESTS (Prevents One-Year Income Spike)
// =============================================================================

console.log('\n💰 Testing PCLS Strategy...');

test('PCLS ALL_AT_RETIREMENT takes full 25%', () => {
  const result = calculatePCLSStrategy(400000, {
    strategy: PCLS_STRATEGIES.ALL_AT_RETIREMENT,
    retirementAge: 60
  });
  
  assert(result.totalPCLS === 100000, 'PCLS should be 25% = £100,000');
  assert(result.schedule.length === 1, 'Should have one withdrawal event');
  assert(result.schedule[0].age === 60, 'Should be at retirement age');
  assert(result.schedule[0].amount === 100000, 'Amount should be full PCLS');
});

test('PCLS PHASED spreads over multiple years', () => {
  const result = calculatePCLSStrategy(400000, {
    strategy: PCLS_STRATEGIES.PHASED,
    retirementAge: 60,
    phaseYears: 5
  });
  
  assert(result.totalPCLS === 100000, 'Total PCLS should be £100,000');
  assert(result.schedule.length === 5, 'Should have 5 withdrawal events');
  
  // Each year should be 1/5 of total
  const expectedAnnual = 100000 / 5;
  result.schedule.forEach((entry, i) => {
    assertClose(entry.amount, expectedAnnual, 1, `Year ${i} amount incorrect`);
    assert(entry.age === 60 + i, `Year ${i} age incorrect`);
  });
  
  // No single year has a "spike" - all amounts equal
  const maxAmount = Math.max(...result.schedule.map(s => s.amount));
  const minAmount = Math.min(...result.schedule.map(s => s.amount));
  assertClose(maxAmount, minAmount, 1, 'Phased PCLS should have equal amounts');
});

test('PCLS DEFERRED delays until specified age', () => {
  const result = calculatePCLSStrategy(400000, {
    strategy: PCLS_STRATEGIES.DEFERRED,
    retirementAge: 60,
    deferredAge: 67
  });
  
  assert(result.totalPCLS === 100000, 'Total PCLS should be £100,000');
  assert(result.schedule.length === 1, 'Should have one withdrawal event');
  assert(result.schedule[0].age === 67, 'Should be at deferred age, not retirement');
  assert(result.schedule[0].deferredFrom === 60, 'Should track original retirement age');
});

test('PCLS PARTIAL takes less than 25%', () => {
  const result = calculatePCLSStrategy(400000, {
    strategy: PCLS_STRATEGIES.PARTIAL,
    retirementAge: 60,
    partialPercent: 15
  });
  
  assert(result.totalPCLS === 60000, 'PCLS should be 15% = £60,000');
  assert(result.settings.partialPercent === 15, 'Should record partial percent');
});

test('PCLS NONE takes zero', () => {
  const result = calculatePCLSStrategy(400000, {
    strategy: PCLS_STRATEGIES.NONE,
    retirementAge: 60
  });
  
  assert(result.totalPCLS === 0, 'PCLS should be 0');
  assert(result.schedule.length === 0, 'Should have no withdrawal events');
});

test('PCLS with SPEND_OVER_YEARS destination creates spending schedule', () => {
  const result = calculatePCLSStrategy(400000, {
    strategy: PCLS_STRATEGIES.ALL_AT_RETIREMENT,
    retirementAge: 60,
    destination: PCLS_DESTINATIONS.SPEND_OVER_YEARS,
    spendOverYears: 5
  });
  
  assert(result.totalPCLS === 100000, 'Total PCLS should be £100,000');
  assert(result.spendingSchedule.length === 5, 'Should have 5 spending years');
  
  // Each year should spend 1/5
  result.spendingSchedule.forEach((entry, i) => {
    assertClose(entry.spendFromPCLS, 20000, 1, `Spending year ${i} incorrect`);
    assert(entry.age === 60 + i, `Spending year ${i} age incorrect`);
  });
});

test('PCLS does not show as income spike when used for spending', () => {
  const result = calculatePCLSStrategy(400000, {
    strategy: PCLS_STRATEGIES.PHASED,
    retirementAge: 60,
    phaseYears: 5,
    destination: PCLS_DESTINATIONS.SPEND_OVER_YEARS,
    spendOverYears: 5
  });
  
  // Key test: PCLS should NEVER appear as a single large income spike
  // It should be spread evenly
  const amounts = result.schedule.map(s => s.amount);
  const maxSpike = Math.max(...amounts);
  const avgAmount = result.totalPCLS / result.schedule.length;
  
  assertClose(maxSpike, avgAmount, 1, 'No single year should have a spike larger than average');
});

test('PCLS handles NaN pension value gracefully', () => {
  const result = calculatePCLSStrategy(NaN, {
    strategy: PCLS_STRATEGIES.ALL_AT_RETIREMENT,
    retirementAge: 60
  });
  
  assert(result.totalPCLS === 0, 'NaN pension should result in 0 PCLS');
  assert(!isNaN(result.totalPCLS), 'Result should not be NaN');
});

test('PCLS handles zero pension value', () => {
  const result = calculatePCLSStrategy(0, {
    strategy: PCLS_STRATEGIES.ALL_AT_RETIREMENT,
    retirementAge: 60
  });
  
  assert(result.totalPCLS === 0, 'Zero pension should result in 0 PCLS');
  assert(result.strategy === PCLS_STRATEGIES.NONE, 'Strategy should be NONE for zero pension');
});

// =============================================================================
// SUMMARY
// =============================================================================

console.log('\n' + '='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('='.repeat(60));

if (failed === 0) {
  console.log('\n🎉 All Couples, Tax & PCLS tests passed!');
} else {
  console.log(`\n⚠️  ${failed} test(s) failed`);
  process.exit(1);
}
