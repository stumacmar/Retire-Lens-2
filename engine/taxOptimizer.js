/**
 * RetireLens 2 - Tax Efficiency Optimizer
 * 
 * Automated analysis and recommendations for optimal tax strategy.
 * Analyzes PCLS timing, withdrawal sequencing, and contribution optimization.
 */

import { calculatePCLS } from './withdrawals.js';
import { calculateTaxFromGross, calculatePersonalAllowance } from './tax.js';
import { TAX_CONFIG, PENSION_CONFIG, ISA_CONFIG } from '../config/defaults.js';

/**
 * Analyze optimal PCLS timing strategies
 * 
 * @param {object} params - Analysis parameters
 * @returns {object} PCLS timing analysis with recommendations
 */
export function analyzePCLSTiming(params) {
  const {
    pensionValue,
    retirementAge,
    targetAnnualIncome,
    lifeExpectancy = 90,
    growthRate = 0.04,
    inflationRate = 0.025
  } = params;
  
  if (!pensionValue || pensionValue <= 0) {
    throw new Error('Valid pension value required');
  }
  
  const scenarios = [];
  
  // Scenario 1: Take full PCLS at retirement
  const fullPCLSAtRetirement = calculatePCLS(pensionValue);
  const scenario1 = {
    name: 'Full PCLS at retirement',
    strategy: 'take-all-immediately',
    timing: retirementAge,
    pclsAmount: fullPCLSAtRetirement.taxFreeCash,
    remainingPension: fullPCLSAtRetirement.remainingPension,
    taxSaved: fullPCLSAtRetirement.taxFreeCash * TAX_CONFIG.bands[0].rate, // Conservative estimate
    description: 'Maximum tax-free cash immediately available'
  };
  scenarios.push(scenario1);
  
  // Scenario 2: Phased PCLS over 3 years
  const pclsPerYear = fullPCLSAtRetirement.taxFreeCash / 3;
  const scenario2 = {
    name: 'Phased PCLS over 3 years',
    strategy: 'phased-3-years',
    timing: `${retirementAge} to ${retirementAge + 3}`,
    pclsAmountPerYear: pclsPerYear,
    totalPCLS: fullPCLSAtRetirement.taxFreeCash,
    remainingPension: fullPCLSAtRetirement.remainingPension,
    growthBenefit: pclsPerYear * 2 * growthRate * 1.5, // Rough estimate of growth on deferred amount
    description: 'Spread PCLS to manage income and allow remaining pension to grow'
  };
  scenarios.push(scenario2);
  
  // Scenario 3: Delay PCLS until state pension starts (if applicable)
  const yearsToStatePension = Math.max(0, PENSION_CONFIG.statePensionAge - retirementAge);
  if (yearsToStatePension > 0) {
    const delayedPensionValue = pensionValue * Math.pow(1 + growthRate, yearsToStatePension);
    const delayedPCLS = calculatePCLS(delayedPensionValue);
    
    const scenario3 = {
      name: 'Delay PCLS until state pension',
      strategy: 'delay-to-state-pension',
      timing: PENSION_CONFIG.statePensionAge,
      pclsAmount: delayedPCLS.taxFreeCash,
      remainingPension: delayedPCLS.remainingPension,
      growthBenefit: delayedPCLS.taxFreeCash - fullPCLSAtRetirement.taxFreeCash,
      description: 'Maximize growth before crystallization, use PCLS when state pension reduces need for drawdown'
    };
    scenarios.push(scenario3);
  }
  
  // Recommendation based on circumstances
  let recommended = scenario1;
  let reasoning = [];
  
  if (targetAnnualIncome < TAX_CONFIG.personalAllowance) {
    recommended = scenario1;
    reasoning.push('Low income target suggests immediate PCLS unlikely to push into higher tax bracket');
  } else if (yearsToStatePension >= 3 && yearsToStatePension <= 7) {
    recommended = scenarios[2]; // Delay to state pension
    reasoning.push('Delaying allows pension to grow and coordinates with state pension start');
  } else {
    recommended = scenario2;
    reasoning.push('Phased approach balances immediate access with growth potential');
  }
  
  return {
    scenarios,
    recommended,
    reasoning,
    analysis: {
      pensionValue,
      maxPCLS: fullPCLSAtRetirement.taxFreeCash,
      yearsToStatePension
    }
  };
}

/**
 * Analyze optimal withdrawal sequencing
 * 
 * @param {object} balances - Current balances { pension, isa }
 * @param {object} incomeNeeds - Annual income requirements
 * @param {object} options - Analysis options
 * @returns {object} Withdrawal sequencing recommendations
 */
export function analyzeWithdrawalSequencing(balances, incomeNeeds, options = {}) {
  const {
    pension = 0,
    isa = 0,
    pclsAvailable = 0
  } = balances;
  
  const {
    targetNetIncome,
    statePensionIncome = 0,
    otherIncome = 0
  } = incomeNeeds;
  
  const {
    currentAge = 65,
    lifeExpectancy = 90,
    growthRate = 0.04
  } = options;
  
  const strategies = [];
  
  // Strategy 1: Pension-first (use personal allowance)
  const strategy1 = {
    name: 'Pension-first (tax-efficient)',
    priority: [
      '1. PCLS (tax-free)',
      '2. Pension drawdown (use personal allowance)',
      '3. ISA for amounts above personal allowance',
      '4. Additional pension if needed (higher rate tax)'
    ],
    taxEfficiency: 'high',
    description: 'Maximize use of personal allowance with pension income',
    suitableFor: 'Most retirees with moderate income needs',
    annualTaxSaved: Math.min(targetNetIncome, TAX_CONFIG.personalAllowance) * TAX_CONFIG.bands[0].rate
  };
  strategies.push(strategy1);
  
  // Strategy 2: ISA-first (preserve pension for growth)
  const isaYears = isa > 0 ? Math.floor(isa / targetNetIncome) : 0;
  const pensionGrowthBenefit = pension * (Math.pow(1 + growthRate, isaYears) - 1);
  
  const strategy2 = {
    name: 'ISA-first (growth preservation)',
    priority: [
      '1. PCLS (tax-free)',
      '2. ISA withdrawals (tax-free)',
      '3. Pension drawdown when ISA exhausted'
    ],
    taxEfficiency: 'medium',
    description: 'Preserve pension for growth and IHT efficiency',
    suitableFor: 'Those with adequate ISA funds and legacy goals',
    pensionGrowthBenefit,
    ihtBenefit: 'Pension preserved for beneficiaries (no IHT)'
  };
  strategies.push(strategy2);
  
  // Strategy 3: Balanced approach
  const strategy3 = {
    name: 'Balanced approach',
    priority: [
      '1. PCLS (tax-free)',
      '2. Pension up to personal allowance',
      '3. ISA for additional needs',
      '4. Alternate sources to manage tax bands'
    ],
    taxEfficiency: 'high',
    description: 'Balance tax efficiency with growth and flexibility',
    suitableFor: 'Most situations - good default strategy',
    annualTaxSaved: TAX_CONFIG.personalAllowance * TAX_CONFIG.bands[0].rate
  };
  strategies.push(strategy3);
  
  // Determine optimal strategy
  let recommended = strategy3; // Default to balanced
  let reasoning = [];
  
  if (isa > pension * 0.5 && isa > targetNetIncome * 5) {
    recommended = strategy2;
    reasoning.push('Substantial ISA balance supports ISA-first approach');
    reasoning.push('Preserves pension for growth and potential inheritance tax benefits');
  } else if (pension > isa * 3) {
    recommended = strategy1;
    reasoning.push('Pension-heavy portfolio benefits from tax-efficient drawdown');
    reasoning.push('Use personal allowance effectively');
  } else {
    reasoning.push('Balanced portfolio suits balanced withdrawal approach');
    reasoning.push('Provides flexibility while maintaining tax efficiency');
  }
  
  return {
    strategies,
    recommended,
    reasoning,
    balances,
    projectedTaxSavings: recommended.annualTaxSaved * (lifeExpectancy - currentAge)
  };
}

/**
 * Analyze pension contribution optimization
 * 
 * @param {object} params - Analysis parameters
 * @returns {object} Contribution optimization recommendations
 */
export function analyzeContributionOptimization(params) {
  const {
    currentAge,
    retirementAge,
    grossIncome,
    currentContributions,
    employerMatch = 0,
    employerMatchRate = 0,
    taxRelief = true
  } = params;
  
  if (!grossIncome || grossIncome <= 0) {
    throw new Error('Valid gross income required');
  }
  
  const yearsToRetirement = retirementAge - currentAge;
  const recommendations = [];
  
  // Calculate current tax relief
  const currentTaxBand = grossIncome > TAX_CONFIG.bands[1].threshold ? 'additional' :
                         grossIncome > TAX_CONFIG.bands[0].threshold ? 'higher' : 'basic';
  
  const currentTaxRate = currentTaxBand === 'additional' ? 0.45 :
                         currentTaxBand === 'higher' ? 0.40 : 0.20;
  
  const currentTaxRelief = currentContributions * currentTaxRate;
  
  // Recommendation 1: Maximize employer match
  if (employerMatch > currentContributions) {
    const additionalContribution = employerMatch - currentContributions;
    const additionalEmployerMoney = additionalContribution * employerMatchRate;
    
    recommendations.push({
      type: 'employer-match',
      priority: 'critical',
      title: 'Maximize employer match',
      currentContributions,
      recommendedContributions: employerMatch,
      additionalAmount: additionalContribution,
      benefit: additionalEmployerMoney,
      benefitDescription: `Gain £${additionalEmployerMoney.toLocaleString('en-GB')} per year in employer contributions`,
      action: `Increase contributions by £${additionalContribution.toLocaleString('en-GB')} per year`,
      reasoning: 'Employer match is free money - always maximize this first'
    });
  }
  
  // Recommendation 2: Tax band management
  if (grossIncome > TAX_CONFIG.personalAllowanceTaperThreshold) {
    const excessIncome = grossIncome - TAX_CONFIG.personalAllowanceTaperThreshold;
    const contributionToRestore = Math.min(excessIncome, TAX_CONFIG.personalAllowance * 2);
    const taxSaved = contributionToRestore * 0.6; // 40% tax + 20% personal allowance restoration
    
    recommendations.push({
      type: 'personal-allowance',
      priority: 'high',
      title: 'Restore personal allowance',
      currentIncome: grossIncome,
      recommendedContribution: contributionToRestore,
      benefit: taxSaved,
      effectiveTaxRelief: 0.6,
      benefitDescription: `Save £${taxSaved.toLocaleString('en-GB')} by restoring personal allowance`,
      action: `Increase pension contributions by £${contributionToRestore.toLocaleString('en-GB')}`,
      reasoning: 'Income over £100k loses personal allowance - 60% marginal rate'
    });
  }
  
  // Recommendation 3: Avoid higher rate tax
  if (grossIncome > TAX_CONFIG.bands[0].threshold && currentTaxBand === 'higher') {
    const excessIncome = grossIncome - TAX_CONFIG.bands[0].threshold;
    const contributionToAvoid = Math.min(excessIncome, grossIncome * 0.3);
    const taxSaved = contributionToAvoid * (0.40 - 0.20);
    
    recommendations.push({
      type: 'tax-band-management',
      priority: 'medium',
      title: 'Reduce higher rate tax',
      currentIncome: grossIncome,
      recommendedContribution: contributionToAvoid,
      benefit: taxSaved,
      effectiveTaxRelief: 0.40,
      benefitDescription: `Save £${taxSaved.toLocaleString('en-GB')} by avoiding higher rate tax`,
      action: `Increase pension contributions by £${contributionToAvoid.toLocaleString('en-GB')}`,
      reasoning: 'Reduce exposure to 40% tax rate'
    });
  }
  
  // Recommendation 4: Front-load contributions if close to retirement
  if (yearsToRetirement <= 10 && yearsToRetirement > 0) {
    const annualAllowanceRoom = PENSION_CONFIG.annualAllowance - currentContributions;
    
    if (annualAllowanceRoom > 0) {
      recommendations.push({
        type: 'front-loading',
        priority: 'medium',
        title: 'Front-load contributions before retirement',
        currentContributions,
        recommendedIncrease: annualAllowanceRoom * 0.5,
        benefit: annualAllowanceRoom * 0.5 * currentTaxRate,
        benefitDescription: `Maximize tax relief while still working`,
        action: `Consider using unused annual allowance (£${annualAllowanceRoom.toLocaleString('en-GB')} available)`,
        reasoning: `Only ${yearsToRetirement} years until retirement - maximize tax relief now`
      });
    }
  }
  
  // Calculate total potential benefit
  const totalPotentialBenefit = recommendations.reduce((sum, rec) => sum + (rec.benefit || 0), 0);
  const lifetimeBenefit = totalPotentialBenefit * yearsToRetirement;
  
  return {
    recommendations,
    summary: {
      currentContributions,
      currentTaxRelief,
      currentTaxBand,
      totalPotentialAnnualBenefit: totalPotentialBenefit,
      lifetimeBenefit,
      yearsToRetirement
    }
  };
}

/**
 * Analyze tax band management strategies
 * 
 * @param {object} params - Analysis parameters
 * @returns {object} Tax band management recommendations
 */
export function analyzeTaxBandManagement(params) {
  const {
    targetNetIncome,
    pensionBalance,
    isaBalance,
    statePensionIncome = 0,
    currentAge,
    lifeExpectancy = 90
  } = params;
  
  const retirementYears = lifeExpectancy - currentAge;
  
  // Calculate gross income needed for target net
  const personalAllowance = calculatePersonalAllowance(targetNetIncome);
  
  const strategies = [];
  
  // Strategy 1: Stay within personal allowance
  if (targetNetIncome <= TAX_CONFIG.personalAllowance) {
    strategies.push({
      strategy: 'stay-in-personal-allowance',
      priority: 'high',
      title: 'Maximize personal allowance usage',
      description: 'Draw exactly up to personal allowance each year',
      taxRate: 0,
      implementation: [
        `Draw £${TAX_CONFIG.personalAllowance.toLocaleString('en-GB')} from pension`,
        'Top up from ISA if needed',
        'Zero income tax paid'
      ],
      annualTaxSaved: TAX_CONFIG.personalAllowance * TAX_CONFIG.bands[0].rate,
      lifetimeSaving: TAX_CONFIG.personalAllowance * TAX_CONFIG.bands[0].rate * retirementYears
    });
  }
  
  // Strategy 2: Avoid higher rate band
  const higherRateThreshold = TAX_CONFIG.personalAllowance + TAX_CONFIG.bands[0].threshold;
  
  strategies.push({
    strategy: 'avoid-higher-rate',
    priority: 'medium',
    title: 'Stay in basic rate band',
    description: `Keep total income below £${higherRateThreshold.toLocaleString('en-GB')}`,
    maxGrossIncome: higherRateThreshold,
    taxRate: 0.20,
    implementation: [
      `Draw up to £${higherRateThreshold.toLocaleString('en-GB')} gross`,
      'Excess needs from tax-free ISA',
      'Avoid 40% higher rate'
    ],
    annualTaxSaved: (higherRateThreshold - TAX_CONFIG.personalAllowance) * (0.40 - 0.20),
    lifetimeSaving: (higherRateThreshold - TAX_CONFIG.personalAllowance) * (0.40 - 0.20) * retirementYears
  });
  
  // Strategy 3: Smooth income over years
  strategies.push({
    strategy: 'income-smoothing',
    priority: 'medium',
    title: 'Smooth income across years',
    description: 'Avoid spikes that push into higher bands',
    implementation: [
      'Avoid large one-off withdrawals',
      'Spread PCLS over multiple years',
      'Use ISA for lumpy expenses',
      'Consider timing of state pension start'
    ],
    benefit: 'Reduces years in higher tax bands',
    reasoning: 'Tax bands are marginal - smoothing reduces overall tax'
  });
  
  // Strategy 4: Coordinate state pension timing
  if (currentAge < PENSION_CONFIG.statePensionAge) {
    const fullStatePensionAnnual = PENSION_CONFIG.fullStatePensionWeekly * 52;
    
    strategies.push({
      strategy: 'state-pension-coordination',
      priority: 'high',
      title: 'Coordinate with state pension',
      description: 'Plan for state pension income impact on tax',
      implementation: [
        `State pension adds £${fullStatePensionAnnual.toLocaleString('en-GB')} taxable income`,
        `Reduce private pension drawdown by equivalent amount`,
        'Maintain same net income, reduce tax'
      ],
      taxImpact: fullStatePensionAnnual * TAX_CONFIG.bands[0].rate,
      reasoning: 'State pension is taxable - factor into withdrawal planning'
    });
  }
  
  return {
    strategies,
    currentSituation: {
      targetNetIncome,
      pensionBalance,
      isaBalance,
      personalAllowance
    },
    recommendation: strategies[0]
  };
}

/**
 * Generate comprehensive tax efficiency report
 * 
 * @param {object} planData - Complete plan data
 * @returns {object} Comprehensive tax efficiency analysis
 */
export function generateTaxEfficiencyReport(planData) {
  const {
    currentAge,
    retirementAge,
    pensionBalance,
    isaBalance,
    targetNetIncome,
    grossIncome = 0,
    currentContributions = 0,
    lifeExpectancy = 90
  } = planData;
  
  // Run all analyses
  const pclsAnalysis = analyzePCLSTiming({
    pensionValue: pensionBalance,
    retirementAge,
    targetAnnualIncome: targetNetIncome,
    lifeExpectancy
  });
  
  const withdrawalAnalysis = analyzeWithdrawalSequencing(
    { pension: pensionBalance, isa: isaBalance },
    { targetNetIncome },
    { currentAge, lifeExpectancy }
  );
  
  let contributionAnalysis = null;
  if (currentAge < retirementAge && grossIncome > 0) {
    contributionAnalysis = analyzeContributionOptimization({
      currentAge,
      retirementAge,
      grossIncome,
      currentContributions
    });
  }
  
  const taxBandAnalysis = analyzeTaxBandManagement({
    targetNetIncome,
    pensionBalance,
    isaBalance,
    currentAge,
    lifeExpectancy
  });
  
  // Calculate total potential savings
  const totalSavings = {
    pclsStrategy: pclsAnalysis.recommended.taxSaved || 0,
    withdrawalStrategy: withdrawalAnalysis.projectedTaxSavings || 0,
    contributionOptimization: contributionAnalysis?.summary.lifetimeBenefit || 0,
    taxBandManagement: taxBandAnalysis.strategies[0]?.lifetimeSaving || 0
  };
  
  const grandTotalSavings = Object.values(totalSavings).reduce((sum, val) => sum + val, 0);
  
  // Generate prioritized action plan
  const actionPlan = [];
  
  if (contributionAnalysis?.recommendations.length > 0) {
    actionPlan.push({
      priority: 1,
      category: 'Pre-retirement',
      action: contributionAnalysis.recommendations[0].title,
      benefit: contributionAnalysis.recommendations[0].benefitDescription,
      timeframe: 'Before retirement'
    });
  }
  
  actionPlan.push({
    priority: 2,
    category: 'At retirement',
    action: pclsAnalysis.recommended.name,
    benefit: pclsAnalysis.recommended.description,
    timeframe: 'At retirement'
  });
  
  actionPlan.push({
    priority: 3,
    category: 'During retirement',
    action: withdrawalAnalysis.recommended.name,
    benefit: withdrawalAnalysis.recommended.description,
    timeframe: 'Throughout retirement'
  });
  
  return {
    pclsAnalysis,
    withdrawalAnalysis,
    contributionAnalysis,
    taxBandAnalysis,
    totalSavings,
    grandTotalSavings,
    actionPlan,
    summary: {
      totalPotentialSavings: grandTotalSavings,
      primaryRecommendation: actionPlan[0],
      analysisDate: new Date().toISOString().split('T')[0]
    }
  };
}

/**
 * Validate tax optimization parameters
 * 
 * @param {object} params - Parameters to validate
 * @returns {object} Validation result
 */
export function validateTaxOptimizationParams(params) {
  const errors = [];
  
  if (params.pensionBalance !== undefined && params.pensionBalance < 0) {
    errors.push('Pension balance must be non-negative');
  }
  
  if (params.isaBalance !== undefined && params.isaBalance < 0) {
    errors.push('ISA balance must be non-negative');
  }
  
  if (params.targetNetIncome !== undefined && params.targetNetIncome < 0) {
    errors.push('Target income must be non-negative');
  }
  
  if (params.currentAge && params.retirementAge && params.retirementAge <= params.currentAge) {
    errors.push('Retirement age must be after current age');
  }
  
  if (params.grossIncome !== undefined && params.grossIncome < 0) {
    errors.push('Gross income must be non-negative');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
