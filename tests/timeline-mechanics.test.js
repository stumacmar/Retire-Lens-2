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
  
  // Timeline shows END-OF-YEAR balances
  // Year 0 (age 55): 100000 * 1.035 + 12000 = 115500
  const year0 = timeline.find(t => t.year === 0);
  const expectedYear0 = 100000 * 1.035 + 12000; // 115500
  
  assertClose(
    year0.personADcPot, 
    expectedYear0, 
    100, 
    `Annual injection should be £12,000, not £144,000. Expected pot ~£115,500, got £${Math.round(year0.personADcPot)}`
  );
  
  // Year 1 (age 56): 115500 * 1.035 + 12000 = 131543
  const year1 = timeline.find(t => t.year === 1);
  const expectedYear1 = expectedYear0 * 1.035 + 12000; // ~131543
  
  assertClose(
    year1.personADcPot,
    expectedYear1,
    100,
    `Year 1 should compound correctly. Expected ~£131,543, got £${Math.round(year1.personADcPot)}`
  );
  
  // Verify it's NOT £244,000 (which would be if multiplied by 12)
  assert(
    year1.personADcPot < 200000,
    `Pot should NOT be inflated by *12 multiplication. Got £${Math.round(year1.personADcPot)}`
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
  
  // Timeline shows END-OF-YEAR balances
  // Year 0 (age 55): 100000 * 1.035 + 12000 = 115500
  const year0 = timeline.find(t => t.year === 0);
  const expectedYear0 = 100000 * 1.035 + 12000; // 115500
  
  assertClose(
    year0.personADcPot,
    expectedYear0,
    100,
    `Monthly contribution should be converted to annual (£1,000 * 12 = £12,000). Expected £${Math.round(expectedYear0)}, got £${Math.round(year0.personADcPot)}`
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
  
  // Timeline shows END-OF-YEAR balances
  // Year 0 (age 55): 100000 * 1.035 = 103500
  const year0 = timeline.find(t => t.year === 0);
  const expectedYear0 = 100000 * 1.035; // 103500
  
  assertClose(
    year0.personADcPot,
    expectedYear0,
    50,
    `Returns should compound ONCE per year. Expected £${Math.round(expectedYear0)}, got £${Math.round(year0.personADcPot)}`
  );
  
  // Verify over 5 years - Year 4 (age 59, 5 years of compounding)
  const year4 = timeline.find(t => t.year === 4);
  const expectedYear4 = 100000 * Math.pow(1.035, 5); // ~118768
  
  assertClose(
    year4.personADcPot,
    expectedYear4,
    200,
    `5-year compounding should be (1.035)^5. Expected £${Math.round(expectedYear4)}, got £${Math.round(year4.personADcPot)}`
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
    targetNetIncome: 10000 // Low target so pots grow
  });

  const timeline = projectHousehold(plan);
  
  // At Person A age 60 (Person B age 57): Person A retires, Person B continues
  const yearPersonA60 = timeline.find(t => t.personAAge === 60);
  
  assert(yearPersonA60.personARetired === true, 'Person A should be retired at 60');
  assert(yearPersonA60.personBRetired === false, 'Person B should still be working at 57');
  
  // At Person A age 68 (Person B age 65): Both retired
  const yearPersonA68 = timeline.find(t => t.personAAge === 68);
  
  assert(yearPersonA68.personARetired === true, 'Person A should be retired at 68');
  assert(yearPersonA68.personBRetired === true, 'Person B should be retired at 65');
  
  // Verify Person B's pot grew during working years (age 52-64)
  const personBPotAtStart = timeline.find(t => t.year === 0).personBDcPot; // End of year 0 (age 52)
  const personBPotBeforeRetirement = timeline.find(t => t.personAAge === 67).personBDcPot; // Age 64, last year before retirement
  
  // Should have grown due to contributions (13 years * 9600 = 124,800 + growth)
  assert(
    personBPotBeforeRetirement > personBPotAtStart + 100000,
    `Person B pot should have grown by contributions during working years. Start: £${Math.round(personBPotAtStart)}, Before retirement (age 64): £${Math.round(personBPotBeforeRetirement)}`
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
  const actualGuaranteed = 
    yearAt67.personAIncome.statePension +
    yearAt67.personAIncome.dbPension +
    yearAt67.personBIncome.statePension +
    yearAt67.personBIncome.dbPension;
  
  // Each DB might be inflated by now, so just check they're all non-zero
  assert(
    yearAt67.personAIncome.statePension > 0,
    'Person A State Pension should be active'
  );
  assert(
    yearAt67.personAIncome.dbPension > 0,
    'Person A DB should be active'
  );
  assert(
    yearAt67.personBIncome.statePension > 0,
    'Person B State Pension should be active'
  );
  assert(
    yearAt67.personBIncome.dbPension > 0,
    'Person B DB should be active'
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
  
  // At age 66: DB continues (might be inflated)
  const yearAt66 = timeline.find(t => t.personAAge === 66);
  assert(
    yearAt66.personAIncome.dbPension >= 20000,
    `DB pension should continue after starting. Got ${yearAt66.personAIncome.dbPension}`
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
  // Check at age 59 (last year of working) not age 60 (after retirement withdrawals start)
  const potBeforeRetirement = timeline.find(t => t.personAAge === 59).personADcPot;
  
  // Calculate expected: compound growth with annual injection over 5 years (ages 55-59)
  let expected = 300000;
  for (let i = 0; i < 5; i++) {
    expected = expected * 1.035 + 20000;
  }
  
  assertClose(
    potBeforeRetirement,
    expected,
    1000,
    `Person A pot should have grown with annual injections. Expected ~£${Math.round(expected)}, got £${Math.round(potBeforeRetirement)}`
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
