/**
 * RetireLens 2 - Retirement Readiness Score Engine
 * 
 * Calculate retirement readiness score (0-100) based on:
 * - Savings rate vs target
 * - Years to retirement
 * - Portfolio balance vs required amount
 * - Income replacement ratio
 * - Tax efficiency
 */

/**
 * Calculate retirement readiness score
 * 
 * @param {object} projectionData - Projection result from engine
 * @param {object} inputs - User inputs
 * @returns {object} Readiness score and breakdown
 */
export function calculateReadinessScore(projectionData, inputs) {
  const {
    currentAge,
    retirementAge,
    targetNetIncome,
    currentPension = 0,
    currentIsa = 0,
    annualPensionContribution = 0,
    annualIsaContribution = 0,
    yearByYear = []
  } = { ...projectionData, ...inputs };
  
  const yearsToRetirement = retirementAge - currentAge;
  const currentPot = currentPension + currentIsa;
  const totalContributions = annualPensionContribution + annualIsaContribution;
  
  // Component 1: Savings Rate (0-25 points)
  // Target: Save at least 15% of target retirement income annually
  const targetSavingsRate = targetNetIncome * 0.15;
  let savingsScore = 0;
  
  if (totalContributions >= targetSavingsRate) {
    savingsScore = 25;
  } else if (totalContributions > 0) {
    savingsScore = (totalContributions / targetSavingsRate) * 25;
  }
  
  // Component 2: Time to Retirement (0-20 points)
  // More time = easier to reach goal
  let timeScore = 0;
  if (yearsToRetirement >= 20) {
    timeScore = 20;
  } else if (yearsToRetirement >= 10) {
    timeScore = 15 + ((yearsToRetirement - 10) / 10) * 5;
  } else if (yearsToRetirement >= 5) {
    timeScore = 10 + ((yearsToRetirement - 5) / 5) * 5;
  } else if (yearsToRetirement > 0) {
    timeScore = (yearsToRetirement / 5) * 10;
  }
  
  // Component 3: Current Portfolio vs Target (0-30 points)
  // Using 25x rule: need 25x annual income at retirement
  const requiredPot = targetNetIncome * 25;
  
  // Calculate what current pot will grow to at retirement (assuming 4% real growth)
  const growthRate = 0.04;
  const futureValueCurrent = currentPot * Math.pow(1 + growthRate, yearsToRetirement);
  
  // Calculate future value of contributions
  const futureValueContributions = totalContributions * 
    ((Math.pow(1 + growthRate, yearsToRetirement) - 1) / growthRate);
  
  const projectedPot = futureValueCurrent + futureValueContributions;
  
  let potScore = 0;
  if (projectedPot >= requiredPot) {
    potScore = 30;
  } else {
    potScore = (projectedPot / requiredPot) * 30;
  }
  
  // Component 4: Income Sustainability (0-15 points)
  // Check if portfolio lasts until age 90
  const finalYear = yearByYear[yearByYear.length - 1];
  const finalBalance = finalYear ? finalYear.pensionBalance + finalYear.isaBalance : 0;
  
  let sustainabilityScore = 0;
  if (finalBalance > requiredPot * 0.5) {
    // Still have 50%+ of required pot at end
    sustainabilityScore = 15;
  } else if (finalBalance > 0) {
    sustainabilityScore = (finalBalance / (requiredPot * 0.5)) * 15;
  }
  
  // Component 5: Tax Efficiency (0-10 points)
  // Balance between pension and ISA
  const pensionPercentage = currentPot > 0 ? currentPension / currentPot : 0.5;
  
  let taxScore = 0;
  if (pensionPercentage >= 0.4 && pensionPercentage <= 0.8) {
    // Good balance
    taxScore = 10;
  } else if (pensionPercentage >= 0.2 && pensionPercentage <= 0.9) {
    // Acceptable balance
    taxScore = 7;
  } else {
    // Poor balance
    taxScore = 4;
  }
  
  const totalScore = Math.round(savingsScore + timeScore + potScore + sustainabilityScore + taxScore);
  
  // Determine readiness level
  let readinessLevel, readinessColor, readinessMessage;
  if (totalScore >= 80) {
    readinessLevel = 'Excellent';
    readinessColor = '#22c55e';
    readinessMessage = 'You are well-prepared for retirement';
  } else if (totalScore >= 60) {
    readinessLevel = 'Good';
    readinessColor = '#3b82f6';
    readinessMessage = 'You are on track with room for improvement';
  } else if (totalScore >= 40) {
    readinessLevel = 'Fair';
    readinessColor = '#f59e0b';
    readinessMessage = 'Action needed to improve retirement outlook';
  } else if (totalScore >= 20) {
    readinessLevel = 'Poor';
    readinessColor = '#ef4444';
    readinessMessage = 'Significant changes required';
  } else {
    readinessLevel = 'Critical';
    readinessColor = '#dc2626';
    readinessMessage = 'Immediate action required';
  }
  
  return {
    totalScore,
    readinessLevel,
    readinessColor,
    readinessMessage,
    breakdown: {
      savingsRate: {
        score: Math.round(savingsScore),
        maxScore: 25,
        value: totalContributions,
        target: targetSavingsRate,
        description: 'Annual savings vs target'
      },
      timeToRetirement: {
        score: Math.round(timeScore),
        maxScore: 20,
        value: yearsToRetirement,
        description: 'Years until retirement'
      },
      portfolioAdequacy: {
        score: Math.round(potScore),
        maxScore: 30,
        value: projectedPot,
        target: requiredPot,
        description: 'Projected pot vs required'
      },
      sustainability: {
        score: Math.round(sustainabilityScore),
        maxScore: 15,
        value: finalBalance,
        description: 'Portfolio longevity'
      },
      taxEfficiency: {
        score: Math.round(taxScore),
        maxScore: 10,
        value: pensionPercentage,
        description: 'Pension/ISA balance'
      }
    },
    metrics: {
      currentPot,
      requiredPot,
      projectedPot,
      shortfall: Math.max(0, requiredPot - projectedPot),
      percentOfTarget: (projectedPot / requiredPot) * 100
    }
  };
}

/**
 * Generate action plan based on readiness score
 * 
 * @param {object} readinessScore - Readiness score object
 * @returns {array} Array of action items
 */
export function generateActionPlan(readinessScore) {
  const actions = [];
  const { breakdown, metrics } = readinessScore;
  
  // Action 1: Increase savings if below target
  if (breakdown.savingsRate.score < 20) {
    const gap = breakdown.savingsRate.target - breakdown.savingsRate.value;
    actions.push({
      priority: 1,
      category: 'Savings',
      action: `Increase monthly contributions by £${Math.round(gap / 12)}`,
      reason: `Current savings rate is ${Math.round((breakdown.savingsRate.value / breakdown.savingsRate.target) * 100)}% of target`,
      impact: 'high'
    });
  }
  
  // Action 2: Portfolio shortfall
  if (breakdown.portfolioAdequacy.score < 25) {
    const shortfall = metrics.shortfall;
    const yearsLeft = breakdown.timeToRetirement.value;
    const monthlyNeeded = Math.round(shortfall / (yearsLeft * 12));
    
    actions.push({
      priority: 2,
      category: 'Portfolio',
      action: `Save additional £${monthlyNeeded}/month to meet retirement target`,
      reason: `Projected pot is £${Math.round(shortfall / 1000)}k below target`,
      impact: 'high'
    });
  }
  
  // Action 3: Time pressure
  if (breakdown.timeToRetirement.value < 10 && breakdown.portfolioAdequacy.score < 25) {
    actions.push({
      priority: 3,
      category: 'Timeline',
      action: 'Consider delaying retirement by 2-3 years',
      reason: `Only ${breakdown.timeToRetirement.value} years until retirement`,
      impact: 'medium'
    });
  }
  
  // Action 4: Tax efficiency
  if (breakdown.taxEfficiency.score < 7) {
    const pensionPct = Math.round(breakdown.taxEfficiency.value * 100);
    
    if (pensionPct > 90) {
      actions.push({
        priority: 4,
        category: 'Tax Efficiency',
        action: 'Divert some contributions to ISA for tax-free flexibility',
        reason: `${pensionPct}% of savings in pension may create tax issues`,
        impact: 'medium'
      });
    } else {
      actions.push({
        priority: 4,
        category: 'Tax Efficiency',
        action: 'Increase pension contributions to benefit from tax relief',
        reason: `Only ${pensionPct}% in pension - missing tax advantages`,
        impact: 'medium'
      });
    }
  }
  
  // Action 5: Sustainability concerns
  if (breakdown.sustainability.score < 10) {
    actions.push({
      priority: 5,
      category: 'Longevity',
      action: 'Reduce planned retirement spending or consider part-time work',
      reason: 'Portfolio may deplete before age 90',
      impact: 'high'
    });
  }
  
  // Action 6: Review investments
  if (breakdown.portfolioAdequacy.score < 20) {
    actions.push({
      priority: 6,
      category: 'Investment Strategy',
      action: 'Review investment allocation for optimal growth',
      reason: 'Higher returns could help close the funding gap',
      impact: 'medium'
    });
  }
  
  // Action 7: State pension check
  actions.push({
    priority: 7,
    category: 'State Pension',
    action: 'Check National Insurance record for gaps',
    reason: 'Maximize state pension entitlement',
    impact: 'low'
  });
  
  // Sort by priority and return top actions
  return actions.sort((a, b) => a.priority - b.priority);
}

/**
 * Calculate key retirement metrics
 * 
 * @param {object} projectionData - Projection data
 * @param {object} inputs - User inputs
 * @returns {object} Key metrics
 */
export function calculateRetirementMetrics(projectionData, inputs) {
  const {
    currentAge,
    retirementAge,
    targetNetIncome,
    currentPension = 0,
    currentIsa = 0,
    annualPensionContribution = 0,
    annualIsaContribution = 0,
    yearByYear = []
  } = { ...projectionData, ...inputs };
  
  const yearsToRetirement = retirementAge - currentAge;
  const currentPot = currentPension + currentIsa;
  const totalContributions = annualPensionContribution + annualIsaContribution;
  
  // Find retirement year
  const retirementYear = yearByYear.find(y => y.age === retirementAge);
  const retirementPot = retirementYear 
    ? retirementYear.pensionBalance + retirementYear.isaBalance 
    : 0;
  
  // Find final year
  const finalYear = yearByYear[yearByYear.length - 1];
  const finalBalance = finalYear 
    ? finalYear.pensionBalance + finalYear.isaBalance 
    : 0;
  
  // Calculate total income and tax
  const totalIncome = yearByYear.reduce((sum, y) => sum + (y.netIncome || 0), 0);
  const totalTax = yearByYear.reduce((sum, y) => sum + (y.totalTax || 0), 0);
  
  // Calculate effective withdrawal rate at retirement
  const firstYearIncome = retirementYear ? retirementYear.netIncome || 0 : 0;
  const withdrawalRate = retirementPot > 0 ? (firstYearIncome / retirementPot) * 100 : 0;
  
  return {
    currentPot,
    retirementPot,
    finalBalance,
    totalContributions: totalContributions * yearsToRetirement,
    totalIncome,
    totalTax,
    withdrawalRate,
    yearsToRetirement,
    yearsInRetirement: yearByYear.filter(y => y.age >= retirementAge).length,
    potGrowth: retirementPot - currentPot,
    taxDrag: totalTax > 0 ? (totalTax / totalIncome) * 100 : 0
  };
}
