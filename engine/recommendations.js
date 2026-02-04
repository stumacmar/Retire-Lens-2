/**
 * RetireLens 2 - Recommendations Engine
 * 
 * Generate personalized retirement planning recommendations
 * based on user inputs, projections, and risk analysis
 */

/**
 * Format currency for display
 */
function formatCurrency(value) {
  if (value >= 1000000) {
    return '£' + (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return '£' + Math.round(value / 1000) + 'k';
  }
  return '£' + Math.round(value);
}

/**
 * Generate comprehensive recommendations
 * 
 * @param {object} projectionData - Projection result
 * @param {object} inputs - User inputs
 * @param {object} monteCarloResults - Monte Carlo results (optional)
 * @returns {array} Array of recommendation objects
 */
export function generateRecommendations(projectionData, inputs, monteCarloResults = null) {
  const recommendations = [];
  
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
  
  // Get retirement year data
  const retirementYear = yearByYear.find(y => y.age === retirementAge);
  const retirementPot = retirementYear 
    ? retirementYear.pensionBalance + retirementYear.isaBalance 
    : 0;
  
  // Get final year data
  const finalYear = yearByYear[yearByYear.length - 1];
  const finalBalance = finalYear 
    ? finalYear.pensionBalance + finalYear.isaBalance 
    : 0;
  
  // Category 1: Savings Recommendations
  const requiredPot = targetNetIncome * 25; // 4% rule
  if (retirementPot < requiredPot * 0.8) {
    const gap = requiredPot - retirementPot;
    const monthlyNeeded = Math.round(gap / (yearsToRetirement * 12 * 1.04)); // Assuming 4% growth
    
    recommendations.push({
      category: 'Savings',
      priority: 1,
      title: 'Increase Monthly Contributions',
      description: `Your projected retirement pot of ${formatCurrency(retirementPot)} falls short of the recommended ${formatCurrency(requiredPot)}.`,
      recommendation: `Increase monthly savings by £${monthlyNeeded} to close the gap.`,
      impact: {
        type: 'positive',
        metric: 'Retirement Pot',
        value: `+${formatCurrency(gap)}`
      },
      actionable: true,
      urgency: gap > requiredPot * 0.5 ? 'high' : 'medium'
    });
  }
  
  // Category 2: Tax Efficiency
  const pensionPercentage = currentPot > 0 ? (currentPension / currentPot) : 0.5;
  
  if (pensionPercentage > 0.9) {
    recommendations.push({
      category: 'Tax Efficiency',
      priority: 2,
      title: 'Diversify with ISA Contributions',
      description: 'Over 90% of your savings are in pensions, which may create tax issues in retirement.',
      recommendation: 'Consider splitting future contributions 70/30 between pension and ISA for flexibility.',
      impact: {
        type: 'positive',
        metric: 'Tax Flexibility',
        value: 'Improved'
      },
      actionable: true,
      urgency: 'medium'
    });
  } else if (pensionPercentage < 0.3) {
    recommendations.push({
      category: 'Tax Efficiency',
      priority: 2,
      title: 'Maximize Pension Tax Relief',
      description: 'Less than 30% of savings are in pensions - you may be missing out on valuable tax relief.',
      recommendation: 'Increase pension contributions to benefit from 20-45% tax relief on contributions.',
      impact: {
        type: 'positive',
        metric: 'Tax Savings',
        value: `£${Math.round(annualIsaContribution * 0.25)}/year`
      },
      actionable: true,
      urgency: 'medium'
    });
  }
  
  // Category 3: Timing Recommendations
  if (yearsToRetirement < 5 && retirementPot < requiredPot) {
    recommendations.push({
      category: 'Timeline',
      priority: 1,
      title: 'Consider Delaying Retirement',
      description: `With only ${yearsToRetirement} years until retirement, there's limited time to build your pot.`,
      recommendation: 'Delaying retirement by 2-3 years could significantly improve your financial security.',
      impact: {
        type: 'positive',
        metric: 'Portfolio Value',
        value: `+${formatCurrency(totalContributions * 2)}`
      },
      actionable: true,
      urgency: 'high'
    });
  }
  
  // Category 4: Income Sustainability
  if (finalBalance < retirementPot * 0.25) {
    recommendations.push({
      category: 'Sustainability',
      priority: 1,
      title: 'Adjust Retirement Spending',
      description: 'Your portfolio may be depleted or significantly reduced in later retirement.',
      recommendation: `Consider reducing planned spending by 10-15% (£${Math.round(targetNetIncome * 0.1 / 1000)}k) to improve sustainability.`,
      impact: {
        type: 'positive',
        metric: 'Portfolio Longevity',
        value: '+5-10 years'
      },
      actionable: true,
      urgency: 'high'
    });
  }
  
  // Category 5: State Pension
  if (retirementAge < 67) {
    recommendations.push({
      category: 'State Pension',
      priority: 3,
      title: 'Check State Pension Eligibility',
      description: 'State pension provides valuable guaranteed income in retirement.',
      recommendation: 'Check your National Insurance record for any gaps and consider voluntary contributions.',
      impact: {
        type: 'positive',
        metric: 'Annual Income',
        value: 'Up to £11,500/year'
      },
      actionable: true,
      urgency: 'low'
    });
  }
  
  // Category 6: Risk Management (if Monte Carlo data available)
  if (monteCarloResults && monteCarloResults.successRate < 0.7) {
    recommendations.push({
      category: 'Risk Management',
      priority: 1,
      title: 'Improve Success Probability',
      description: `Monte Carlo analysis shows only ${Math.round(monteCarloResults.successRate * 100)}% success rate.`,
      recommendation: 'Consider a combination of: higher contributions, delayed retirement, or reduced spending.',
      impact: {
        type: 'positive',
        metric: 'Success Rate',
        value: `+15-25%`
      },
      actionable: true,
      urgency: 'high'
    });
  }
  
  // Category 7: Investment Strategy
  if (yearsToRetirement > 10 && currentPot > 50000) {
    recommendations.push({
      category: 'Investment',
      priority: 3,
      title: 'Review Investment Allocation',
      description: 'With 10+ years to retirement, ensure your portfolio is appropriately allocated.',
      recommendation: 'Consider a diversified portfolio with appropriate equity exposure for your time horizon.',
      impact: {
        type: 'positive',
        metric: 'Expected Returns',
        value: '+1-2% annually'
      },
      actionable: false,
      urgency: 'low'
    });
  }
  
  // Category 8: Employer Contributions
  if (annualPensionContribution < targetNetIncome * 0.15) {
    recommendations.push({
      category: 'Employer Benefits',
      priority: 2,
      title: 'Maximize Employer Matching',
      description: 'Ensure you\'re getting the full employer pension match - it\'s free money.',
      recommendation: 'Check your employer\'s pension scheme and contribute enough to get the full match.',
      impact: {
        type: 'positive',
        metric: 'Annual Contributions',
        value: 'Up to £5,000/year'
      },
      actionable: true,
      urgency: 'medium'
    });
  }
  
  // Category 9: Tax Planning
  const totalTaxPaid = yearByYear
    .filter(y => y.age >= retirementAge)
    .reduce((sum, y) => sum + (y.totalTax || 0), 0);
  
  if (totalTaxPaid > targetNetIncome * 5) {
    recommendations.push({
      category: 'Tax Planning',
      priority: 2,
      title: 'Optimize Withdrawal Strategy',
      description: `You'll pay approximately ${formatCurrency(totalTaxPaid)} in tax during retirement.`,
      recommendation: 'Consider taking 25% tax-free lump sum and balancing pension/ISA withdrawals for tax efficiency.',
      impact: {
        type: 'positive',
        metric: 'Lifetime Tax',
        value: `Save up to ${formatCurrency(totalTaxPaid * 0.2)}`
      },
      actionable: false,
      urgency: 'low'
    });
  }
  
  // Category 10: Emergency Fund
  if (currentIsa < targetNetIncome * 0.5) {
    recommendations.push({
      category: 'Emergency Fund',
      priority: 3,
      title: 'Build Emergency Reserve',
      description: 'An emergency fund provides financial security and prevents early pension access.',
      recommendation: `Aim to build ${formatCurrency(targetNetIncome * 0.5)} in accessible ISA savings.`,
      impact: {
        type: 'positive',
        metric: 'Financial Security',
        value: 'Improved'
      },
      actionable: true,
      urgency: 'medium'
    });
  }
  
  // Sort by priority and urgency
  return recommendations.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });
}

/**
 * Filter recommendations by category
 * 
 * @param {array} recommendations - Array of recommendations
 * @param {string} category - Category to filter by
 * @returns {array} Filtered recommendations
 */
export function filterByCategory(recommendations, category) {
  return recommendations.filter(rec => rec.category === category);
}

/**
 * Get high priority recommendations only
 * 
 * @param {array} recommendations - Array of recommendations
 * @returns {array} High priority recommendations
 */
export function getHighPriorityRecommendations(recommendations) {
  return recommendations.filter(rec => rec.priority === 1);
}

/**
 * Get actionable recommendations only
 * 
 * @param {array} recommendations - Array of recommendations
 * @returns {array} Actionable recommendations
 */
export function getActionableRecommendations(recommendations) {
  return recommendations.filter(rec => rec.actionable);
}

/**
 * Format recommendations for display
 * 
 * @param {array} recommendations - Array of recommendations
 * @param {number} limit - Maximum number to return
 * @returns {array} Formatted recommendations
 */
export function formatRecommendationsForDisplay(recommendations, limit = 10) {
  return recommendations.slice(0, limit).map((rec, index) => ({
    ...rec,
    id: `rec-${index}`,
    displayOrder: index + 1
  }));
}

/**
 * Get recommendation categories summary
 * 
 * @param {array} recommendations - Array of recommendations
 * @returns {object} Summary by category
 */
export function getCategorySummary(recommendations) {
  const summary = {};
  
  recommendations.forEach(rec => {
    if (!summary[rec.category]) {
      summary[rec.category] = {
        count: 0,
        highPriority: 0,
        actionable: 0
      };
    }
    
    summary[rec.category].count++;
    if (rec.priority === 1) {
      summary[rec.category].highPriority++;
    }
    if (rec.actionable) {
      summary[rec.category].actionable++;
    }
  });
  
  return summary;
}
