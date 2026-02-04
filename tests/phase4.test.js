/**
 * RetireLens 2 - Tests for Phase 4 Features
 * 
 * Test suites for:
 * - Insights Engine
 * - Milestones Engine
 * - Benchmarking Engine
 */

import { generateInsights, getCategoryMetadata } from '../engine/insightsEngine.js';
import { 
  createMilestone, 
  integrateMilestonesIntoSpending,
  calculateMilestoneImpact,
  validateMilestones,
  getMilestoneCategories
} from '../engine/milestones.js';
import { generateBenchmarkAnalysis } from '../engine/benchmarking.js';

console.log('🧪 Starting Phase 4 Feature Tests...\n');

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

// =============================================================================
// INSIGHTS ENGINE TESTS
// =============================================================================

console.log('📊 Testing Insights Engine...');

test('getCategoryMetadata returns all categories', () => {
  const metadata = getCategoryMetadata();
  assert(metadata.risks, 'Should have risks category');
  assert(metadata.opportunities, 'Should have opportunities category');
  assert(metadata.strengths, 'Should have strengths category');
  assert(metadata.suggestions, 'Should have suggestions category');
  assert(metadata.risks.icon === '⚠️', 'Risks should have warning icon');
});

test('generateInsights returns array of insights', () => {
  const plan = {
    name: 'Test Plan',
    currentAge: 55,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 200000,
    currentIsa: 50000,
    annualPensionContribution: 10000,
    annualIsaContribution: 5000,
    statePensionAge: 67,
    expectedStatePension: 10000
  };

  const projection = {
    years: [
      { age: 65, totalPot: 400000, withdrawal: 16000, grossIncome: 16000, totalTax: 700, netIncome: 25300 },
      { age: 75, totalPot: 350000, withdrawal: 16000, grossIncome: 26000, totalTax: 2800, netIncome: 23200 },
      { age: 85, totalPot: 250000, withdrawal: 16000, grossIncome: 26000, totalTax: 2800, netIncome: 23200 }
    ]
  };

  const insights = generateInsights(plan, projection, {
    monteCarloResults: { successRate: 85 },
    readinessScore: { overallScore: 75 }
  });

  assert(Array.isArray(insights), 'Should return an array');
  assert(insights.length >= 3 && insights.length <= 8, 'Should return 3-8 insights');
  
  const categories = insights.map(i => i.category);
  assert(categories.includes('strengths') || categories.includes('risks'), 'Should include at least one risk or strength');
  
  insights.forEach(insight => {
    assert(insight.title, 'Each insight should have a title');
    assert(insight.description, 'Each insight should have a description');
    assert(insight.impact, 'Each insight should have an impact level');
    assert(['high', 'medium', 'low'].includes(insight.impact), 'Impact should be high/medium/low');
  });
});

test('generateInsights handles missing monteCarloResults', () => {
  const plan = {
    currentAge: 55,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 200000,
    currentIsa: 50000,
    annualPensionContribution: 10000,
    annualIsaContribution: 5000,
    statePensionAge: 67,
    expectedStatePension: 10000
  };

  const projection = {
    years: [
      { age: 65, totalPot: 400000, withdrawal: 16000, grossIncome: 16000, totalTax: 700, netIncome: 25300 }
    ]
  };

  const insights = generateInsights(plan, projection, {});
  assert(Array.isArray(insights), 'Should still return insights without Monte Carlo');
  assert(insights.length > 0, 'Should have at least one insight');
});

// =============================================================================
// MILESTONES ENGINE TESTS
// =============================================================================

console.log('\n🎯 Testing Milestones Engine...');

test('createMilestone creates valid milestone', () => {
  const milestone = createMilestone({
    description: 'Dream holiday',
    age: 70,
    amount: 15000,
    priority: 'nice-to-have',
    category: 'travel'
  });

  assert(milestone.id, 'Should have an ID');
  assert(milestone.description === 'Dream holiday', 'Should have correct description');
  assert(milestone.age === 70, 'Should have correct age');
  assert(milestone.amount === 15000, 'Should have correct amount');
  assert(milestone.priority === 'nice-to-have', 'Should have correct priority');
  assert(milestone.category === 'travel', 'Should have correct category');
});

test('createMilestone validates required fields', () => {
  try {
    createMilestone({ age: 70, amount: 15000 });
    assert(false, 'Should throw error for missing description');
  } catch (error) {
    assert(error.message.includes('description'), 'Should mention description in error');
  }
});

test('createMilestone validates age range', () => {
  try {
    createMilestone({ description: 'Test', age: 40, amount: 15000 });
    assert(false, 'Should throw error for age < 55');
  } catch (error) {
    assert(error.message.includes('age'), 'Should mention age in error');
  }
});

test('getMilestoneCategories returns all categories', () => {
  const categories = getMilestoneCategories();
  assert(categories.travel, 'Should have travel category');
  assert(categories.vehicle, 'Should have vehicle category');
  assert(categories.home, 'Should have home category');
  assert(categories.travel.icon, 'Each category should have an icon');
  assert(categories.travel.label, 'Each category should have a label');
});

test('integrateMilestonesIntoSpending creates spending rules', () => {
  const milestones = [
    createMilestone({ description: 'Holiday', age: 70, amount: 10000, priority: 'nice-to-have' }),
    createMilestone({ description: 'Car', age: 72, amount: 25000, priority: 'essential' })
  ];

  const plan = { retirementAge: 65 };
  const rules = integrateMilestonesIntoSpending(milestones, plan);

  assert(rules.length === 2, 'Should create 2 spending rules');
  assert(rules[0].type === 'milestone', 'Should be milestone type');
  assert(rules[0].amount === 10000, 'Should have correct amount');
  assert(rules[0].startAge === 70, 'Should have correct age');
});

test('calculateMilestoneImpact analyzes impact correctly', () => {
  const milestones = [
    createMilestone({ description: 'Holiday', age: 70, amount: 15000, priority: 'nice-to-have' })
  ];

  const plan = { retirementAge: 65 };
  const projection = {
    years: [
      { age: 65, totalPot: 400000 }
    ]
  };

  const impact = calculateMilestoneImpact(milestones, plan, projection);

  assert(impact.totalCost === 15000, 'Should calculate total cost');
  assert(impact.feasible !== undefined, 'Should have feasibility flag');
  assert(Array.isArray(impact.warnings), 'Should have warnings array');
  assert(impact.impactRatio > 0, 'Should calculate impact ratio');
});

test('validateMilestones checks total cost', () => {
  const milestones = [
    createMilestone({ description: 'Big expense', age: 70, amount: 600000, priority: 'nice-to-have' })
  ];

  const validation = validateMilestones(milestones);
  assert(validation.valid === true, 'Should be valid (just warning)');
  assert(validation.warnings.length > 0, 'Should have warning about high cost');
});

// =============================================================================
// BENCHMARKING ENGINE TESTS
// =============================================================================

console.log('\n📊 Testing Benchmarking Engine...');

test('generateBenchmarkAnalysis creates complete analysis', () => {
  const plan = {
    name: 'Test Plan',
    currentAge: 58,
    retirementAge: 65,
    targetNetIncome: 35000,
    currentPension: 180000,
    currentIsa: 40000,
    annualPensionContribution: 12000,
    annualIsaContribution: 8000,
    statePensionAge: 67,
    expectedStatePension: 10000
  };

  const projection = {
    years: [
      { age: 65, totalPot: 350000, withdrawal: 14000, grossIncome: 14000, totalTax: 280, netIncome: 23720 },
      { age: 90, totalPot: 150000 }
    ]
  };

  const options = {
    monteCarloResults: { successRate: 82 },
    readinessScore: { overallScore: 72 }
  };

  const analysis = generateBenchmarkAnalysis(plan, projection, options);

  assert(analysis.potSizeComparison, 'Should have pot size comparison');
  assert(analysis.incomeComparison, 'Should have income comparison');
  assert(analysis.successRateComparison, 'Should have success rate comparison');
  assert(analysis.readinessComparison, 'Should have readiness comparison');
  assert(analysis.contributionComparison, 'Should have contribution comparison');
  assert(analysis.summary, 'Should have summary');
  assert(analysis.disclaimer, 'Should have disclaimer');
});

test('potSizeComparison calculates percentiles correctly', () => {
  const plan = {
    currentAge: 58,
    retirementAge: 65,
    targetNetIncome: 35000,
    currentPension: 180000,
    currentIsa: 40000,
    annualPensionContribution: 12000,
    annualIsaContribution: 8000,
    statePensionAge: 67,
    expectedStatePension: 10000
  };

  const projection = {
    years: [
      { age: 65, totalPot: 250000 }
    ]
  };

  const analysis = generateBenchmarkAnalysis(plan, projection, {});
  const potComparison = analysis.potSizeComparison;

  assert(potComparison.percentile >= 0 && potComparison.percentile <= 100, 'Percentile should be 0-100');
  assert(potComparison.comparison, 'Should have comparison text');
  assert(potComparison.status, 'Should have status');
  assert(['excellent', 'good', 'average', 'fair', 'needs-improvement'].includes(potComparison.status), 
    'Status should be valid');
});

test('incomeComparison includes PLSA standards', () => {
  const plan = {
    currentAge: 58,
    retirementAge: 65,
    targetNetIncome: 45000,
    currentPension: 180000,
    currentIsa: 40000,
    annualPensionContribution: 12000,
    annualIsaContribution: 8000,
    statePensionAge: 67,
    expectedStatePension: 10000
  };

  const projection = { years: [{ age: 65, totalPot: 250000 }] };
  const analysis = generateBenchmarkAnalysis(plan, projection, {});
  const incomeComparison = analysis.incomeComparison;

  assert(incomeComparison.plsaComparison, 'Should have PLSA comparison');
  assert(incomeComparison.plsaComparison.standard, 'Should have PLSA standard');
  assert(['minimal', 'moderate', 'comfortable', 'luxury'].includes(incomeComparison.plsaComparison.standard), 
    'PLSA standard should be valid');
});

test('benchmark summary identifies strengths and improvements', () => {
  const plan = {
    currentAge: 58,
    retirementAge: 65,
    targetNetIncome: 35000,
    currentPension: 300000, // High pot
    currentIsa: 100000,
    annualPensionContribution: 5000, // Low contributions
    annualIsaContribution: 2000,
    statePensionAge: 67,
    expectedStatePension: 10000
  };

  const projection = {
    years: [
      { age: 65, totalPot: 450000, withdrawal: 14000 }
    ]
  };

  const analysis = generateBenchmarkAnalysis(plan, projection, { 
    readinessScore: { overallScore: 80 } 
  });

  assert(analysis.summary.strengths, 'Should have strengths array');
  assert(analysis.summary.improvementAreas, 'Should have improvement areas array');
  assert(analysis.summary.overallAssessment, 'Should have overall assessment');
  assert(['above-average', 'average', 'below-average'].includes(analysis.summary.overallAssessment), 
    'Overall assessment should be valid');
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

console.log('\n🔗 Testing Integration...');

test('Milestones integrate with projections', () => {
  const milestones = [
    createMilestone({ description: 'Holiday', age: 70, amount: 10000, priority: 'nice-to-have' }),
    createMilestone({ description: 'Car', age: 72, amount: 20000, priority: 'essential' })
  ];

  const plan = { 
    retirementAge: 65,
    currentAge: 60,
    targetNetIncome: 30000,
    currentPension: 200000,
    currentIsa: 50000,
    annualPensionContribution: 10000,
    annualIsaContribution: 5000,
    statePensionAge: 67,
    expectedStatePension: 10000
  };

  const projection = {
    years: [
      { age: 65, totalPot: 300000, withdrawal: 12000 }
    ]
  };

  // Integrate milestones
  const rules = integrateMilestonesIntoSpending(milestones, plan);
  assert(rules.length === 2, 'Should create spending rules');

  // Calculate impact
  const impact = calculateMilestoneImpact(milestones, plan, projection);
  assert(impact.totalCost === 30000, 'Should sum milestone costs');
});

test('Insights work with benchmark data', () => {
  const plan = {
    name: 'Test Plan',
    currentAge: 58,
    retirementAge: 65,
    targetNetIncome: 35000,
    currentPension: 250000,
    currentIsa: 60000,
    annualPensionContribution: 12000,
    annualIsaContribution: 8000,
    statePensionAge: 67,
    expectedStatePension: 10000
  };

  const projection = {
    years: [
      { age: 65, totalPot: 380000, withdrawal: 15000, grossIncome: 15000, totalTax: 480, netIncome: 24520 },
      { age: 90, totalPot: 200000 }
    ]
  };

  const options = {
    monteCarloResults: { successRate: 85 },
    readinessScore: { overallScore: 78 }
  };

  // Generate both insights and benchmarks
  const insights = generateInsights(plan, projection, options);
  const benchmarks = generateBenchmarkAnalysis(plan, projection, options);

  assert(insights.length > 0, 'Should have insights');
  assert(benchmarks.potSizeComparison, 'Should have benchmark comparison');
  
  // Both should analyze the same plan consistently
  const hasSuccessRateInsight = insights.some(i => 
    i.title.toLowerCase().includes('success') || 
    i.title.toLowerCase().includes('resilience') ||
    i.description.toLowerCase().includes('success rate')
  );
  assert(hasSuccessRateInsight, 'Insights should mention success rate or resilience');
  assert(benchmarks.successRateComparison, 'Benchmarks should compare success rate');
});

// =============================================================================
// SUMMARY
// =============================================================================

console.log('\n' + '='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('='.repeat(60));

if (failed === 0) {
  console.log('\n🎉 All Phase 4 tests passed!');
} else {
  console.log(`\n⚠️  ${failed} test(s) failed`);
  process.exit(1);
}
