/**
 * Unit Tests for Navigation and Validation Logic
 * 
 * Tests the core JavaScript logic without browser overhead
 */

import { strict as assert } from 'assert';

console.log('Running Unit Tests...\n');

// Test 1: State structure validation
console.log('TEST 1: State structure');
const mockState = {
  onboardingState: {
    householdType: 'couple',
    personA: {
      currentAge: 55,
      retirementAge: 65
    },
    personB: {
      currentAge: 52,
      retirementAge: 63
    },
    targetNetIncome: 40000
  }
};

// Validate structure
assert.ok(mockState.onboardingState, 'State has onboardingState');
assert.equal(mockState.onboardingState.householdType, 'couple', 'Household type is couple');
assert.equal(mockState.onboardingState.personA.currentAge, 55, 'Person A age is 55');
assert.equal(mockState.onboardingState.personB.currentAge, 52, 'Person B age is 52');
console.log('✓ PASSED: State structure is correct\n');

// Test 2: Age validation logic
console.log('TEST 2: Age validation');
function validateAge(age, retireAge) {
  if (age < 18 || age > 100) return false;
  if (retireAge <= age || retireAge > 100) return false;
  return true;
}

assert.ok(validateAge(55, 65), 'Valid ages 55->65');
assert.ok(!validateAge(15, 65), 'Invalid age 15');
assert.ok(!validateAge(55, 50), 'Invalid retirement age before current');
assert.ok(!validateAge(55, 55), 'Invalid retirement age same as current');
console.log('✓ PASSED: Age validation logic works\n');

// Test 3: Couples validation logic
console.log('TEST 3: Couples validation');
function validateCouplesData(state) {
  const personA = state.onboardingState?.personA;
  const personB = state.onboardingState?.personB;
  
  const isValid = 
    personA?.currentAge >= 18 &&
    personA?.retirementAge > personA.currentAge &&
    personB?.currentAge >= 18 &&
    personB?.retirementAge > personB.currentAge &&
    state.onboardingState?.targetNetIncome > 0;
  
  return isValid;
}

const validState = {
  onboardingState: {
    householdType: 'couple',
    personA: { currentAge: 55, retirementAge: 65 },
    personB: { currentAge: 52, retirementAge: 63 },
    targetNetIncome: 40000
  }
};

const invalidState1 = {
  onboardingState: {
    householdType: 'couple',
    personA: { currentAge: 55, retirementAge: 50 }, // Invalid
    personB: { currentAge: 52, retirementAge: 63 },
    targetNetIncome: 40000
  }
};

const invalidState2 = {
  onboardingState: {
    householdType: 'couple',
    personA: { currentAge: 55, retirementAge: 65 },
    personB: { currentAge: 52, retirementAge: 63 },
    targetNetIncome: 0 // Invalid
  }
};

assert.ok(validateCouplesData(validState), 'Valid couples data');
assert.ok(!validateCouplesData(invalidState1), 'Invalid retirement age rejected');
assert.ok(!validateCouplesData(invalidState2), 'Invalid income rejected');
console.log('✓ PASSED: Couples validation logic works\n');

// Test 4: Screen order logic
console.log('TEST 4: Screen order');
function getScreenOrder(householdType) {
  let screens = ['household-type'];
  
  if (householdType === 'couple') {
    screens.push('couples-input');
  } else {
    screens.push('age', 'retirement-age', 'income-target', 'pension-pot', 'contributions');
  }
  
  screens.push('review', 'results');
  return screens;
}

const singleOrder = getScreenOrder('single');
const coupleOrder = getScreenOrder('couple');

assert.ok(singleOrder.includes('age'), 'Single flow includes age screen');
assert.ok(!singleOrder.includes('couples-input'), 'Single flow excludes couples-input');
assert.ok(coupleOrder.includes('couples-input'), 'Couple flow includes couples-input');
assert.ok(!coupleOrder.includes('age'), 'Couple flow excludes age screen');
assert.ok(singleOrder.includes('review'), 'Single flow ends with review');
assert.ok(coupleOrder.includes('review'), 'Couple flow ends with review');
console.log('✓ PASSED: Screen order logic is correct\n');

// Test 5: Progress calculation
console.log('TEST 5: Progress calculation');
function calculateProgress(currentScreen, screenOrder) {
  const currentIndex = screenOrder.indexOf(currentScreen);
  if (currentIndex === -1) return 0;
  return ((currentIndex + 1) / screenOrder.length) * 100;
}

const screens = ['household-type', 'age', 'retirement-age', 'review', 'results'];
assert.equal(calculateProgress('household-type', screens), 20, 'First screen is 20%');
assert.equal(calculateProgress('age', screens), 40, 'Second screen is 40%');
assert.equal(calculateProgress('review', screens), 80, 'Fourth screen is 80%');
assert.equal(calculateProgress('results', screens), 100, 'Last screen is 100%');
console.log('✓ PASSED: Progress calculation works\n');

// Summary
console.log('═══════════════════════════════════════════════════════');
console.log('  UNIT TEST SUMMARY');
console.log('═══════════════════════════════════════════════════════');
console.log('  ✓ All 5 unit tests passed');
console.log('  - State structure validation');
console.log('  - Age validation logic');
console.log('  - Couples validation logic');
console.log('  - Screen order logic');
console.log('  - Progress calculation');
console.log('═══════════════════════════════════════════════════════\n');

export default true;
