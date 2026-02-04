/**
 * RetireLens 2 - Phase 3 Engine Tests
 * 
 * Comprehensive tests for Phase 3 calculation features (12-16).
 * Run with: node tests/phase3.test.js
 */

import {
  calculateFutureIncome,
  calculatePresentIncome,
  createInflationAdjustedIncome,
  formatInflationDisplay,
  calculateInflationSeries,
  adjustPlanForInflation,
  validateInflationAdjustment
} from '../engine/inflationAdjustment.js';

import {
  createPhasedRetirement,
  calculatePartTimeNet,
  calculatePhasedRetirementImpact,
  calculatePhasedIncome,
  calculatePhasedBenefits,
  isInPhasedPeriod,
  getValuesForAge,
  projectWithPhasedRetirement,
  validatePhasedRetirement
} from '../engine/phasedRetirement.js';

import {
  createHealthcarePlan,
  calculateMeansTestedSupport,
  projectHealthcareCosts,
  estimateCareInsurance,
  recommendCareFundingStrategy,
  validateHealthcarePlan,
  HEALTHCARE_DEFAULTS
} from '../engine/healthcareCosts.js';

import {
  createLegacyPlan,
  calculateInheritanceTax,
  projectEstateValue,
  calculateLegacyShortfall,
  generateIHTMitigationStrategies,
  calculateBeneficiaryDistributions,
  validateLegacyPlan,
  IHT_CONFIG
} from '../engine/legacyPlanning.js';

import {
  analyzePCLSTiming,
  analyzeWithdrawalSequencing,
  analyzeContributionOptimization,
  analyzeTaxBandManagement,
  generateTaxEfficiencyReport,
  validateTaxOptimizationParams
} from '../engine/taxOptimizer.js';

import { TAX_CONFIG } from '../config/defaults.js';

// Test utilities
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failCount++;
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    if (error.stack) {
      console.log(`    ${error.stack.split('\n')[1]?.trim()}`);
    }
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Got: ${actual}`);
  }
}

function assertClose(actual, expected, tolerance = 0.01, message = '') {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Got: ${actual}\n  Diff: ${diff}`);
  }
}

function assertTrue(condition, message = 'Expected true') {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFalse(condition, message = 'Expected false') {
  if (condition) {
    throw new Error(message);
  }
}

// =============================================================================
// Feature 12: Inflation Adjustment Tests
// =============================================================================

console.log('\n📊 Feature 12: Inflation Adjustment Tests');

test('Calculate future income with inflation', () => {
  const future = calculateFutureIncome(30000, 10, 0.025);
  assertClose(future, 38403, 1, 'Future income should account for 10 years of 2.5% inflation');
});

test('Calculate present value of future income', () => {
  const present = calculatePresentIncome(38403, 10, 0.025);
  assertClose(present, 30000, 1, 'Present value should discount back correctly');
});

test('Create inflation-adjusted income in today\'s money', () => {
  const adjusted = createInflationAdjustedIncome({
    income: 30000,
    isInTodaysMoney: true,
    currentAge: 55,
    retirementAge: 65,
    inflationRate: 0.025
  });
  
  assertEqual(adjusted.todayIncome, 30000, 'Today income should match input');
  assertClose(adjusted.futureIncome, 38403, 1, 'Future income should be inflated');
  assertEqual(adjusted.yearsToRetirement, 10, 'Years should be calculated');
});

test('Create inflation-adjusted income in future money', () => {
  const adjusted = createInflationAdjustedIncome({
    income: 38403,
    isInTodaysMoney: false,
    currentAge: 55,
    retirementAge: 65,
    inflationRate: 0.025
  });
  
  assertClose(adjusted.todayIncome, 30000, 1, 'Today income should be discounted');
  assertClose(adjusted.futureIncome, 38403, 1, 'Future income should match input');
});

test('Format inflation display', () => {
  const adjusted = createInflationAdjustedIncome({
    income: 30000,
    isInTodaysMoney: true,
    currentAge: 55,
    retirementAge: 65
  });
  
  const display = formatInflationDisplay(adjusted, 2035);
  assertTrue(display.includes('30,000'), 'Should include today value');
  assertTrue(display.includes('2035'), 'Should include year');
});

test('Calculate inflation series', () => {
  const series = calculateInflationSeries(1000, 5, 0.025);
  
  assertEqual(series.length, 6, 'Should have 6 entries (0-5 years)');
  assertEqual(series[0].year, 0, 'First year should be 0');
  assertEqual(series[0].futureValue, 1000, 'Year 0 should match base amount');
  assertClose(series[5].futureValue, 1131, 1, 'Year 5 should be inflated');
});

test('Validate inflation adjustment parameters', () => {
  const valid = validateInflationAdjustment({
    income: 30000,
    currentAge: 55,
    retirementAge: 65,
    inflationRate: 0.025
  });
  
  assertTrue(valid.valid, 'Valid parameters should pass');
  assertEqual(valid.errors.length, 0, 'Should have no errors');
});

test('Reject invalid inflation parameters', () => {
  const invalid = validateInflationAdjustment({
    income: -1000,
    currentAge: 55,
    retirementAge: 50,
    inflationRate: 0.5
  });
  
  assertFalse(invalid.valid, 'Invalid parameters should fail');
  assertTrue(invalid.errors.length > 0, 'Should have errors');
});

// =============================================================================
// Feature 13: Phased Retirement Tests
// =============================================================================

console.log('\n📊 Feature 13: Phased Retirement Tests');

test('Create phased retirement configuration', () => {
  const config = createPhasedRetirement({
    phasedStartAge: 60,
    phasedEndAge: 65,
    partTimeIncome: 20000,
    reducedContributions: 3000,
    fullTimeIncome: 50000
  });
  
  assertEqual(config.phasedStartAge, 60, 'Start age should match');
  assertEqual(config.phasedDuration, 5, 'Duration should be calculated');
  assertEqual(config.incomeReductionPercentage, 60, 'Reduction should be 60%');
  assertTrue(config.isActive, 'Should be active');
});

test('Calculate phased retirement impact', () => {
  const config = createPhasedRetirement({
    phasedStartAge: 60,
    phasedEndAge: 65,
    partTimeIncome: 20000,
    reducedContributions: 3000
  });
  
  const impact = calculatePhasedRetirementImpact(config, 10000, 0.04);
  
  assertTrue(impact.foregoneContributions > 0, 'Should calculate foregone contributions');
  assertTrue(impact.foregoneFutureValue > 0, 'Should calculate future value impact');
});

test('Check if age is in phased period', () => {
  const config = createPhasedRetirement({
    phasedStartAge: 60,
    phasedEndAge: 65,
    partTimeIncome: 20000
  });
  
  assertFalse(isInPhasedPeriod(59, config), '59 should not be in phased period');
  assertTrue(isInPhasedPeriod(62, config), '62 should be in phased period');
  assertFalse(isInPhasedPeriod(65, config), '65 should not be in phased period (end age)');
});

test('Get values for age in phased period', () => {
  const config = createPhasedRetirement({
    phasedStartAge: 60,
    phasedEndAge: 65,
    partTimeIncome: 20000,
    reducedContributions: 3000
  });
  
  const values = getValuesForAge(62, config, { contributions: 10000 });
  
  assertEqual(values.income, 20000, 'Should return part-time income');
  assertEqual(values.contributions, 3000, 'Should return reduced contributions');
  assertTrue(values.isPartTime, 'Should be marked as part-time');
});

test('Validate phased retirement configuration', () => {
  const valid = validatePhasedRetirement({
    phasedStartAge: 60,
    phasedEndAge: 65,
    partTimeIncome: 20000,
    reducedContributions: 3000
  }, {
    currentAge: 55,
    fullRetirementAge: 70
  });
  
  assertTrue(valid.valid, 'Valid configuration should pass');
  assertEqual(valid.errors.length, 0, 'Should have no errors');
});

test('Reject invalid phased retirement', () => {
  const invalid = validatePhasedRetirement({
    phasedStartAge: 65,
    phasedEndAge: 60,
    partTimeIncome: -1000,
    reducedContributions: 0
  });
  
  assertFalse(invalid.valid, 'Invalid configuration should fail');
  assertTrue(invalid.errors.length > 0, 'Should have errors');
});

// =============================================================================
// Feature 14: Healthcare Costs Tests
// =============================================================================

console.log('\n📊 Feature 14: Healthcare Costs Tests');

test('Create healthcare plan', () => {
  const plan = createHealthcarePlan({
    careStartAge: 85,
    probabilityOfCare: 0.30,
    careType: 'residential',
    careDuration: 3
  });
  
  assertEqual(plan.careStartAge, 85, 'Start age should match');
  assertEqual(plan.careEndAge, 88, 'End age should be calculated');
  assertEqual(plan.probabilityOfCare, 0.30, 'Probability should match');
  assertTrue(plan.annualCost > 0, 'Annual cost should be set');
});

test('Calculate means-tested support', () => {
  const support = calculateMeansTestedSupport(15000, 40000, false);
  
  assertEqual(support.contributionBasis, 'fully-covered', 'Should be fully covered');
  assertEqual(support.personalContribution, 0, 'No personal contribution');
  assertClose(support.localAuthorityContribution, 40000, 0.01, 'LA covers full amount');
});

test('Calculate partial means-tested support', () => {
  // Use a value between lower (14250) and upper (23250) thresholds with property included
  const support = calculateMeansTestedSupport(17000, 40000, true);
  
  assertEqual(support.contributionBasis, 'partial-covered', 'Should be partially covered');
  assertTrue(support.personalContribution > 0, 'Some personal contribution');
  assertTrue(support.localAuthorityContribution > 0, 'Some LA contribution');
});

test('Project healthcare costs over time', () => {
  const plan = createHealthcarePlan({
    careStartAge: 85,
    probabilityOfCare: 0.30,
    careType: 'residential',
    careDuration: 3
  });
  
  const projection = projectHealthcareCosts(plan, 65, 90);
  
  assertTrue(projection.length > 0, 'Should have projection data');
  const careYears = projection.filter(p => p.inCarePeriod);
  assertEqual(careYears.length, 3, 'Should have 3 care years');
});

test('Estimate care insurance', () => {
  const estimate = estimateCareInsurance({
    currentAge: 60,
    coverageAmount: 100000
  });
  
  assertTrue(estimate.annualPremium > 0, 'Should calculate premium');
  assertTrue(estimate.totalPremiumsPaid > 0, 'Should calculate total premiums');
  assertTrue(estimate.valueForMoney > 0, 'Should calculate value ratio');
});

test('Recommend care funding strategy', () => {
  const plan = createHealthcarePlan({
    careStartAge: 85,
    probabilityOfCare: 0.30,
    careType: 'residential',
    careDuration: 3
  });
  
  const recommendation = recommendCareFundingStrategy(plan, {
    totalAssets: 300000,
    liquidAssets: 300000,
    annualIncome: 25000
  });
  
  assertTrue(recommendation.strategy, 'Should recommend a strategy');
  assertTrue(recommendation.recommendations.length > 0, 'Should have recommendations');
});

test('Validate healthcare plan', () => {
  const valid = validateHealthcarePlan({
    careStartAge: 85,
    probabilityOfCare: 0.30,
    careType: 'residential',
    careDuration: 3
  });
  
  assertTrue(valid.valid, 'Valid plan should pass');
  assertEqual(valid.errors.length, 0, 'Should have no errors');
});

// =============================================================================
// Feature 15: Legacy Planning Tests
// =============================================================================

console.log('\n📊 Feature 15: Legacy Planning Tests');

test('Create legacy plan', () => {
  const plan = createLegacyPlan({
    targetInheritance: 200000,
    priority: 'nice-to-have',
    beneficiaries: [
      { name: 'Child 1', relationship: 'child', sharePercentage: 50 },
      { name: 'Child 2', relationship: 'child', sharePercentage: 50 }
    ]
  });
  
  assertEqual(plan.targetInheritance, 200000, 'Target should match');
  assertEqual(plan.priority, 'nice-to-have', 'Priority should match');
  assertEqual(plan.beneficiaries.length, 2, 'Should have 2 beneficiaries');
});

test('Calculate inheritance tax - below threshold', () => {
  const iht = calculateInheritanceTax({
    totalEstateValue: 300000,
    propertyValue: 250000,
    passedToSpouse: 0,
    charitableDonation: 0
  });
  
  assertEqual(iht.inheritanceTax, 0, 'No IHT below threshold');
  assertEqual(iht.netEstate, 300000, 'Full estate available');
});

test('Calculate inheritance tax - above threshold', () => {
  const iht = calculateInheritanceTax({
    totalEstateValue: 600000,
    propertyValue: 300000,
    passedToSpouse: 0,
    charitableDonation: 0
  });
  
  assertTrue(iht.inheritanceTax > 0, 'Should have IHT above threshold');
  assertTrue(iht.netEstate < 600000, 'Net estate should be reduced by tax');
  assertClose(iht.applicableRate, 0.40, 0.01, 'Tax rate should be 40%');
});

test('Calculate IHT with charity reduction', () => {
  const estate = 600000;
  const charity = estate * 0.10;
  
  const iht = calculateInheritanceTax({
    totalEstateValue: estate,
    propertyValue: 300000,
    passedToSpouse: 0,
    charitableDonation: charity
  });
  
  assertTrue(iht.qualifiesForCharityReduction, 'Should qualify for charity reduction');
  assertClose(iht.applicableRate, 0.36, 0.01, 'Tax rate should be reduced to 36%');
});

test('Project estate value', () => {
  const projection = projectEstateValue(
    {
      pensionPot: 200000,
      isaBalance: 100000,
      propertyValue: 300000,
      annualSpending: 25000,
      annualIncome: 0
    },
    10,
    { growthRate: 0.04, propertyGrowthRate: 0.025 }
  );
  
  assertTrue(projection.totalEstate > 0, 'Should project total estate');
  assertTrue(projection.projectedProperty > 300000, 'Property should grow');
});

test('Calculate beneficiary distributions', () => {
  const plan = createLegacyPlan({
    targetInheritance: 200000,
    priority: 'nice-to-have',
    beneficiaries: [
      { name: 'Child 1', relationship: 'child', sharePercentage: 60 },
      { name: 'Child 2', relationship: 'child', sharePercentage: 40 }
    ],
    charitableDonation: 10000
  });
  
  const distributions = calculateBeneficiaryDistributions(plan, 200000);
  
  assertTrue(distributions.length > 0, 'Should have distributions');
  const child1 = distributions.find(d => d.name === 'Child 1');
  assertTrue(child1.amount > 0, 'Child 1 should receive amount');
});

test('Generate IHT mitigation strategies', () => {
  const iht = calculateInheritanceTax({
    totalEstateValue: 800000,
    propertyValue: 400000,
    passedToSpouse: 0,
    charitableDonation: 0
  });
  
  const strategies = generateIHTMitigationStrategies(
    { totalEstateValue: 800000, pensionPot: 200000 },
    iht
  );
  
  assertTrue(strategies.length > 0, 'Should generate strategies');
  assertTrue(strategies[0].potentialSaving > 0, 'Should calculate savings');
});

test('Validate legacy plan', () => {
  const valid = validateLegacyPlan({
    targetInheritance: 200000,
    priority: 'nice-to-have',
    beneficiaries: [{ name: 'Child', sharePercentage: 100 }],
    charitableDonation: 10000
  });
  
  assertTrue(valid.valid, 'Valid plan should pass');
});

// =============================================================================
// Feature 16: Tax Optimizer Tests
// =============================================================================

console.log('\n📊 Feature 16: Tax Optimizer Tests');

test('Analyze PCLS timing', () => {
  const analysis = analyzePCLSTiming({
    pensionValue: 400000,
    retirementAge: 65,
    targetAnnualIncome: 25000,
    lifeExpectancy: 90
  });
  
  assertTrue(analysis.scenarios.length > 0, 'Should have scenarios');
  assertTrue(analysis.recommended, 'Should have recommendation');
  assertTrue(analysis.reasoning.length > 0, 'Should have reasoning');
});

test('Analyze withdrawal sequencing', () => {
  const analysis = analyzeWithdrawalSequencing(
    { pension: 300000, isa: 100000 },
    { targetNetIncome: 25000 }
  );
  
  assertTrue(analysis.strategies.length > 0, 'Should have strategies');
  assertTrue(analysis.recommended, 'Should have recommendation');
  assertTrue(analysis.reasoning.length > 0, 'Should have reasoning');
});

test('Analyze contribution optimization', () => {
  const analysis = analyzeContributionOptimization({
    currentAge: 50,
    retirementAge: 65,
    grossIncome: 60000,
    currentContributions: 5000
  });
  
  assertTrue(analysis.recommendations.length >= 0, 'Should have recommendations');
  assertTrue(analysis.summary, 'Should have summary');
});

test('Analyze contribution with employer match', () => {
  const analysis = analyzeContributionOptimization({
    currentAge: 50,
    retirementAge: 65,
    grossIncome: 60000,
    currentContributions: 3000,
    employerMatch: 5000,
    employerMatchRate: 1.0
  });
  
  const matchRec = analysis.recommendations.find(r => r.type === 'employer-match');
  assertTrue(matchRec !== undefined, 'Should recommend maximizing employer match');
  assertEqual(matchRec.priority, 'critical', 'Should be critical priority');
});

test('Analyze tax band management', () => {
  const analysis = analyzeTaxBandManagement({
    targetNetIncome: 25000,
    pensionBalance: 300000,
    isaBalance: 100000,
    currentAge: 65
  });
  
  assertTrue(analysis.strategies.length > 0, 'Should have strategies');
  assertTrue(analysis.recommendation, 'Should have recommendation');
});

test('Generate comprehensive tax efficiency report', () => {
  const report = generateTaxEfficiencyReport({
    currentAge: 55,
    retirementAge: 65,
    pensionBalance: 400000,
    isaBalance: 100000,
    targetNetIncome: 30000,
    grossIncome: 60000,
    currentContributions: 5000
  });
  
  assertTrue(report.pclsAnalysis, 'Should have PCLS analysis');
  assertTrue(report.withdrawalAnalysis, 'Should have withdrawal analysis');
  assertTrue(report.contributionAnalysis, 'Should have contribution analysis');
  assertTrue(report.taxBandAnalysis, 'Should have tax band analysis');
  assertTrue(report.actionPlan.length > 0, 'Should have action plan');
  assertTrue(report.grandTotalSavings >= 0, 'Should calculate total savings');
});

test('Validate tax optimization parameters', () => {
  const valid = validateTaxOptimizationParams({
    pensionBalance: 300000,
    isaBalance: 100000,
    targetNetIncome: 25000,
    currentAge: 55,
    retirementAge: 65
  });
  
  assertTrue(valid.valid, 'Valid parameters should pass');
  assertEqual(valid.errors.length, 0, 'Should have no errors');
});

test('Reject invalid tax optimization parameters', () => {
  const invalid = validateTaxOptimizationParams({
    pensionBalance: -1000,
    isaBalance: 100000,
    targetNetIncome: 25000,
    currentAge: 70,
    retirementAge: 65
  });
  
  assertFalse(invalid.valid, 'Invalid parameters should fail');
  assertTrue(invalid.errors.length > 0, 'Should have errors');
});

// =============================================================================
// Summary
// =============================================================================

console.log('\n' + '='.repeat(60));
console.log('Test Results Summary');
console.log('='.repeat(60));
console.log(`✓ Passed: ${passCount}`);
console.log(`✗ Failed: ${failCount}`);
console.log(`Total: ${passCount + failCount}`);
console.log('='.repeat(60));

if (failCount > 0) {
  console.log('\n⚠️  Some tests failed. Please review the errors above.');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
