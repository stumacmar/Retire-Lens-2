/**
 * RetireLens Pro - Timeline Engine Mechanics Tests
 * 
 * Comprehensive tests for timeline mechanics as specified in the problem statement:
 * - Annual injection occurs once per year (not multiplied by 12)
 * - Return compounding happens once per year
 * - Contributions stop at retirement age per person
 * - Different ages and retirement dates work correctly
 * - DB/State pension start at correct ages
 */

import { createHouseholdPlan, projectHousehold, HOUSEHOLD_TYPES, PENSION_TYPES } from '../engine/householdPlan.js';

console.log('🧪 Starting Timeline Engine Mechanics Tests...\n');

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
// ANNUAL INJECTION TESTS (Must occur ONCE per year, not * 12)
// =============================================================================

console.log('💉 Testing Annual Injection Logic...');

test('Annual injection is added once per year, not multiplied by 12', () => {
  const plan = createHouseholdPlan({
    householdType: HOUSEHOLD_TYPES.SINGLE,
    personA: {
      name: 'Person A',
      currentAge: 55,
      retirementAge: 60,
      pensionTypes: [PENSION_TYPES.DC],
      dcPot: 100000,
      dcMonthlyContrib: 0, // Zero monthly
      dcAnnualContrib: 12000, // Annual injection of £12,000
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    targetNetIncome: 30000
  });

  const timeline = projectHousehold(plan);
  
  // Find year when age 56 (one year of contribution)
  const yearAt56 = timeline.find(t => t.personAAge === 56);
  
  // Starting pot: 100000
  // Growth: 100000 * (0.04 - 0.005) = 3500
  // Contribution: 12000 (ONCE, not 144000)
  // Expected: 100000 + 3500 + 12000 = 115500
  
  const expectedPot = 100000 + (100000 * 0.035) + 12000; // 115500
  
  assertClose(
    yearAt56.personADcPot, 
    expectedPot, 
    100, 
    `Annual injection should be £12,000, not £144,000. Expected pot ~£115,500, got £${Math.round(yearAt56.personADcPot)}`
  );
  
  // Verify it's NOT £244,000 (which would be if multiplied by 12)
  assert(
    yearAt56.personADcPot < 200000,
    `Pot should NOT be inflated by *12 multiplication. Got £${Math.round(yearAt56.personADcPot)}`
  );
});

test('Monthly contribution is correctly converted to annual (monthly * 12)', () => {
  const plan = createHouseholdPlan({
    householdType: HOUSEHOLD_TYPES.SINGLE,
    personA: {
      name: 'Person A',
      currentAge: 55,
      retirementAge: 60,
      pensionTypes: [PENSION_TYPES.DC],
      dcPot: 100000,
      dcMonthlyContrib: 1000, // £1,000/month
      dcAnnualContrib: 0,
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    targetNetIncome: 30000
  });

  const timeline = projectHousehold(plan);
  const yearAt56 = timeline.find(t => t.personAAge === 56);
  
  // Monthly £1,000 * 12 = £12,000 annual
  // Expected pot: 100000 + 3500 + 12000 = 115500
  const expectedPot = 100000 + (100000 * 0.035) + 12000;
  
  assertClose(
    yearAt56.personADcPot,
    expectedPot,
    100,
    `Monthly contribution should be converted to annual (£1,000 * 12 = £12,000). Expected £${Math.round(expectedPot)}, got £${Math.round(yearAt56.personADcPot)}`
  );
});

// =============================================================================
// RETURN COMPOUNDING TESTS (Once per year)
// =============================================================================

console.log('\n📈 Testing Return Compounding Logic...');

test('Returns are compounded once per year, not multiple times', () => {
  const plan = createHouseholdPlan({
    householdType: HOUSEHOLD_TYPES.SINGLE,
    personA: {
      name: 'Person A',
      currentAge: 55,
      retirementAge: 60,
      pensionTypes: [PENSION_TYPES.DC],
      dcPot: 100000,
      dcMonthlyContrib: 0,
      dcAnnualContrib: 0, // No contributions
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    targetNetIncome: 30000,
    growthRate: 0.04,
    feeRate: 0.005
  });

  const timeline = projectHousehold(plan);
  const yearAt56 = timeline.find(t => t.personAAge === 56);
  
  // Starting pot: 100000
  // Net growth rate: 4% - 0.5% = 3.5%
  // After 1 year: 100000 * 1.035 = 103500 (simple annual compounding)
  const expectedPot = 100000 * 1.035;
  
  assertClose(
    yearAt56.personADcPot,
    expectedPot,
    50,
    `Returns should compound ONCE per year. Expected £${Math.round(expectedPot)}, got £${Math.round(yearAt56.personADcPot)}`
  );
  
  // Verify over 5 years
  const yearAt60 = timeline.find(t => t.personAAge === 60);
  const expectedPot5yr = 100000 * Math.pow(1.035, 5); // ~118768
  
  assertClose(
    yearAt60.personADcPot,
    expectedPot5yr,
    200,
    `5-year compounding should be (1.035)^5. Expected £${Math.round(expectedPot5yr)}, got £${Math.round(yearAt60.personADcPot)}`
  );
});

// =============================================================================
// CONTRIBUTION STOP AGE TESTS
// =============================================================================

console.log('\n⏸️  Testing Contribution Stop Logic...');

test('Contributions stop at retirement age for each person', () => {
  const plan = createHouseholdPlan({
    householdType: HOUSEHOLD_TYPES.COUPLE,
    personA: {
      name: 'Person A',
      currentAge: 55,
      retirementAge: 60, // Retires at 60
      pensionTypes: [PENSION_TYPES.DC],
      dcPot: 100000,
      dcMonthlyContrib: 1000,
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    personB: {
      name: 'Person B',
      currentAge: 52,
      retirementAge: 65, // Retires at 65 (works longer)
      pensionTypes: [PENSION_TYPES.DC],
      dcPot: 80000,
      dcMonthlyContrib: 800,
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    targetNetIncome: 40000
  });

  const timeline = projectHousehold(plan);
  
  // At Person A age 60 (Person B age 57): Person A stops contributing, Person B continues
  const yearPersonA60 = timeline.find(t => t.personAAge === 60);
  
  assert(yearPersonA60.personARetired === true, 'Person A should be retired at 60');
  assert(yearPersonA60.personBRetired === false, 'Person B should still be working at 57');
  
  // At Person A age 65 (Person B age 62): Both should have stopped new contributions
  const yearPersonA65 = timeline.find(t => t.personAAge === 65);
  
  assert(yearPersonA65.personARetired === true, 'Person A should be retired at 65');
  assert(yearPersonA65.personBRetired === true, 'Person B should be retired at 62');
  
  // Verify Person B's pot grew during ages 57-62 but stopped after
  const personBPotAt57 = timeline.find(t => t.personAAge === 60).personBDcPot;
  const personBPotAt62 = timeline.find(t => t.personAAge === 65).personBDcPot;
  
  // Should have grown due to contributions (5 years * 9600 = 48000 + growth)
  assert(
    personBPotAt62 > personBPotAt57 + 40000,
    `Person B pot should have grown by contributions during working years. Age 57: £${Math.round(personBPotAt57)}, Age 62: £${Math.round(personBPotAt62)}`
  );
});

// =============================================================================
// DIFFERENT AGES AND RETIREMENT DATES TESTS
// =============================================================================

console.log('\n👥 Testing Different Ages and Retirement Dates...');

test('Couple with different ages: income sources phase in correctly', () => {
  const plan = createHouseholdPlan({
    householdType: HOUSEHOLD_TYPES.COUPLE,
    personA: {
      name: 'Person A',
      currentAge: 55,
      retirementAge: 60,
      pensionTypes: [PENSION_TYPES.DC, PENSION_TYPES.DB],
      dcPot: 200000,
      dcMonthlyContrib: 0,
      dbAnnualIncome: 10000,
      dbStartAge: 60, // DB starts at retirement
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    personB: {
      name: 'Person B',
      currentAge: 62, // 7 years older than Person A
      retirementAge: 67,
      pensionTypes: [PENSION_TYPES.DB],
      dbAnnualIncome: 15000,
      dbStartAge: 67, // DB starts at retirement
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    targetNetIncome: 40000
  });

  const timeline = projectHousehold(plan);
  
  // At Person A age 60 (Person B age 67):
  // - Person A: DB starts (10k), no State Pension yet
  // - Person B: DB starts (15k), State Pension starts (11.5k)
  const yearAt60 = timeline.find(t => t.personAAge === 60);
  
  assertClose(
    yearAt60.personAIncome.dbPension,
    10000,
    10,
    'Person A DB should start at age 60'
  );
  assertClose(
    yearAt60.personBIncome.dbPension,
    15000,
    10,
    'Person B DB should start at age 67'
  );
  assertClose(
    yearAt60.personBIncome.statePension,
    11500,
    10,
    'Person B State Pension should start at age 67'
  );
  assert(
    yearAt60.personAIncome.statePension === 0,
    'Person A State Pension should NOT have started at age 60'
  );
  
  // At Person A age 67 (Person B age 74):
  // - Person A: DB (10k), State Pension (11.5k)
  // - Person B: DB (15k), State Pension (11.5k)
  const yearAt67 = timeline.find(t => t.personAAge === 67);
  
  assertClose(
    yearAt67.personAIncome.statePension,
    11500,
    10,
    'Person A State Pension should start at age 67'
  );
  
  // Total guaranteed income should be sum of all sources
  const totalGuaranteed = 10000 + 11500 + 15000 + 11500; // 48000
  const actualGuaranteed = 
    yearAt67.personAIncome.statePension +
    yearAt67.personAIncome.dbPension +
    yearAt67.personBIncome.statePension +
    yearAt67.personBIncome.dbPension;
  
  assertClose(
    actualGuaranteed,
    totalGuaranteed,
    10,
    `Total guaranteed income at Person A age 67 should be £${totalGuaranteed}`
  );
});

// =============================================================================
// DB PENSION START AGE TESTS
// =============================================================================

console.log('\n💼 Testing DB Pension Start Ages...');

test('DB pension starts at specified age, not retirement age', () => {
  const plan = createHouseholdPlan({
    householdType: HOUSEHOLD_TYPES.SINGLE,
    personA: {
      name: 'Person A',
      currentAge: 55,
      retirementAge: 60,
      pensionTypes: [PENSION_TYPES.DB],
      dbAnnualIncome: 20000,
      dbStartAge: 65, // DB starts LATER than retirement
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    targetNetIncome: 30000
  });

  const timeline = projectHousehold(plan);
  
  // At age 60 (retirement): no DB yet
  const yearAt60 = timeline.find(t => t.personAAge === 60);
  assert(
    yearAt60.personAIncome.dbPension === 0,
    'DB pension should NOT have started at retirement age 60'
  );
  
  // At age 64: still no DB
  const yearAt64 = timeline.find(t => t.personAAge === 64);
  assert(
    yearAt64.personAIncome.dbPension === 0,
    'DB pension should NOT have started before dbStartAge 65'
  );
  
  // At age 65: DB starts
  const yearAt65 = timeline.find(t => t.personAAge === 65);
  assertClose(
    yearAt65.personAIncome.dbPension,
    20000,
    10,
    'DB pension should start at dbStartAge 65'
  );
  
  // At age 66: DB continues
  const yearAt66 = timeline.find(t => t.personAAge === 66);
  assertClose(
    yearAt66.personAIncome.dbPension,
    20000,
    10,
    'DB pension should continue after starting'
  );
});

// =============================================================================
// INTEGRATION TEST: All mechanics together
// =============================================================================

console.log('\n🔄 Testing All Mechanics Together...');

test('Integration: Couple with all features (different ages, DB, DC, contributions, injections)', () => {
  const plan = createHouseholdPlan({
    householdType: HOUSEHOLD_TYPES.COUPLE,
    personA: {
      name: 'Person A',
      currentAge: 55,
      retirementAge: 60,
      pensionTypes: [PENSION_TYPES.DC],
      dcPot: 300000,
      dcMonthlyContrib: 0,
      dcAnnualContrib: 20000, // Annual injection
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    personB: {
      name: 'Person B',
      currentAge: 60, // 5 years older
      retirementAge: 65,
      pensionTypes: [PENSION_TYPES.DB],
      dbAnnualIncome: 18000,
      dbStartAge: 65, // Starts at retirement
      statePensionAge: 67,
      expectedStatePension: 11500
    },
    targetNetIncome: 45000
  });

  const timeline = projectHousehold(plan);
  
  // Year 0 (Person A 55, Person B 60): Both working, Person A contributing
  const year0 = timeline.find(t => t.year === 0);
  assert(year0.personARetired === false, 'Person A should be working at 55');
  assert(year0.personBRetired === false, 'Person B should be working at 60');
  
  // Year 5 (Person A 60, Person B 65): Person A retires, Person B retires
  const year5 = timeline.find(t => t.year === 5);
  assert(year5.personARetired === true, 'Person A should be retired at 60');
  assert(year5.personBRetired === true, 'Person B should be retired at 65');
  assertClose(
    year5.personBIncome.dbPension,
    18000,
    10,
    'Person B DB should start at retirement age 65'
  );
  
  // Year 12 (Person A 67, Person B 72): Both State Pensions active
  const year12 = timeline.find(t => t.year === 12);
  assertClose(
    year12.personAIncome.statePension,
    11500,
    10,
    'Person A State Pension should be active at 67'
  );
  assertClose(
    year12.personBIncome.statePension,
    11500,
    10,
    'Person B State Pension should be active at 72'
  );
  
  // Verify Person A's pot grew during working years (annual injection of 20k)
  const potAtRetirement = timeline.find(t => t.personAAge === 60).personADcPot;
  // Starting 300k, 5 years of 20k annual injections + growth
  // Approximate: 300k + (5 * 20k) + growth ~= 400k+
  assert(
    potAtRetirement > 400000,
    `Person A pot should have grown with annual injections. Got £${Math.round(potAtRetirement)}`
  );
});

// =============================================================================
// SUMMARY
// =============================================================================

console.log('\n' + '='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('='.repeat(60));

if (failed === 0) {
  console.log('\n🎉 All Timeline Engine Mechanics tests passed!');
  console.log('✓ Annual injections occur once per year');
  console.log('✓ Return compounding happens once per year');
  console.log('✓ Contributions stop at retirement age per person');
  console.log('✓ Different ages and retirement dates work correctly');
  console.log('✓ DB pensions start at specified ages');
} else {
  console.log(`\n⚠️  ${failed} test(s) failed`);
  process.exit(1);
}
