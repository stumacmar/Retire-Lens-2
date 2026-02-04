/**
 * RetireLens 2 - Insights Engine
 * 
 * Rules-based AI insights engine that analyzes projection results
 * and generates personalized natural language insights for the user.
 * 
 * Insight Categories:
 * - 📈 Opportunities: Positive findings and optimization possibilities
 * - ⚠️ Risks: Potential issues and concerns
 * - ✅ Strengths: What's working well in the plan
 * - 💡 Suggestions: Actionable recommendations
 */

/**
 * Generates insights from plan analysis
 * @param {object} plan - The retirement plan object
 * @param {object} projection - The projection results
 * @param {object} options - Additional analysis options
 * @returns {Array<object>} Array of insight objects
 */
export function generateInsights(plan, projection, options = {}) {
  const insights = [];
  const { monteCarloResults, readinessScore } = options;

  // Analyze different aspects of the plan
  insights.push(...analyzeSuccessRate(plan, projection, monteCarloResults));
  insights.push(...analyzePensionPot(plan, projection));
  insights.push(...analyzeWithdrawals(plan, projection));
  insights.push(...analyzeTaxEfficiency(plan, projection));
  insights.push(...analyzeStateAge(plan));
  insights.push(...analyzeContributions(plan));
  insights.push(...analyzeReadiness(readinessScore));
  insights.push(...analyzeLongevity(plan, projection));
  insights.push(...analyzeSpending(plan, projection));

  // Rank by impact and return top 5-8 insights
  return rankAndFilterInsights(insights);
}

/**
 * Analyze Monte Carlo success rate
 */
function analyzeSuccessRate(plan, projection, monteCarloResults) {
  const insights = [];
  
  if (!monteCarloResults) return insights;

  const successRate = monteCarloResults.successRate || 0;

  if (successRate >= 90) {
    insights.push({
      category: 'strengths',
      icon: '✅',
      title: 'Excellent Success Rate',
      description: `Your plan has a ${successRate.toFixed(0)}% success rate across 1,000 market scenarios. This indicates a highly robust retirement plan with excellent resilience to market volatility.`,
      impact: 'high',
      detail: 'Even in challenging market conditions, your plan maintains strong sustainability. This gives you significant flexibility for unexpected expenses or lifestyle changes.'
    });
  } else if (successRate >= 75) {
    insights.push({
      category: 'strengths',
      icon: '✅',
      title: 'Strong Plan Resilience',
      description: `With a ${successRate.toFixed(0)}% success rate, your plan shows good resilience to market variations. Most scenarios result in sustainable income throughout retirement.`,
      impact: 'medium',
      detail: 'Your plan can withstand typical market fluctuations. Consider minor adjustments to improve resilience further.'
    });
  } else if (successRate >= 60) {
    insights.push({
      category: 'risks',
      icon: '⚠️',
      title: 'Moderate Success Rate',
      description: `Your plan has a ${successRate.toFixed(0)}% success rate. While reasonable, there's room to improve plan robustness by reducing spending or increasing savings.`,
      impact: 'high',
      detail: 'In about 4 out of 10 scenarios, your plan may face sustainability challenges. Consider reducing target income by 10-15% or delaying retirement by 1-2 years.'
    });
  } else {
    insights.push({
      category: 'risks',
      icon: '⚠️',
      title: 'Low Success Rate - Action Needed',
      description: `Your ${successRate.toFixed(0)}% success rate indicates significant risk. Immediate adjustments are recommended to improve plan sustainability.`,
      impact: 'high',
      detail: 'Your plan is vulnerable to poor market conditions. Key actions: increase retirement age, reduce target income by 20%+, or significantly boost contributions.'
    });
  }

  return insights;
}

/**
 * Analyze pension pot size and trajectory
 */
function analyzePensionPot(plan, projection) {
  const insights = [];
  const potAtRetirement = projection.years?.find(y => y.age === plan.retirementAge)?.totalPot || 0;
  const targetMultiple = plan.targetNetIncome * 25; // 4% rule benchmark

  if (potAtRetirement >= targetMultiple * 1.3) {
    insights.push({
      category: 'strengths',
      icon: '✅',
      title: 'Strong Pension Pot Accumulation',
      description: `Your projected pot of £${(potAtRetirement / 1000).toFixed(0)}k at retirement exceeds the 25x income benchmark by over 30%, providing excellent financial security.`,
      impact: 'high',
      detail: 'This buffer gives you flexibility to increase spending, retire earlier, or leave a larger legacy. Consider phased retirement options.'
    });
  } else if (potAtRetirement < targetMultiple * 0.75) {
    insights.push({
      category: 'risks',
      icon: '⚠️',
      title: 'Pension Pot Below Target',
      description: `Your projected pot of £${(potAtRetirement / 1000).toFixed(0)}k falls short of the 25x income benchmark. Additional contributions or reduced spending targets recommended.`,
      impact: 'high',
      detail: `Target pot: £${(targetMultiple / 1000).toFixed(0)}k. Shortfall: £${((targetMultiple - potAtRetirement) / 1000).toFixed(0)}k. Consider increasing annual contributions.`
    });
  }

  // Check if pot will be depleted
  const finalPot = projection.years?.[projection.years.length - 1]?.totalPot || 0;
  const ageAtDepletion = projection.years?.find(y => y.totalPot <= 0)?.age;

  if (ageAtDepletion && ageAtDepletion < 90) {
    insights.push({
      category: 'risks',
      icon: '⚠️',
      title: 'Early Pot Depletion Risk',
      description: `Current projections show potential pot depletion around age ${ageAtDepletion}. This leaves ${90 - ageAtDepletion} years until age 90 with reduced financial security.`,
      impact: 'high',
      detail: 'Consider reducing withdrawal rates, increasing contributions, or building additional ISA reserves to extend pot longevity.'
    });
  }

  return insights;
}

/**
 * Analyze withdrawal strategy and rates
 */
function analyzeWithdrawals(plan, projection) {
  const insights = [];
  const retirementYear = projection.years?.find(y => y.age === plan.retirementAge);
  
  if (!retirementYear) return insights;

  const withdrawalRate = (retirementYear.withdrawal / retirementYear.totalPot) * 100;

  if (withdrawalRate > 5) {
    insights.push({
      category: 'risks',
      icon: '⚠️',
      title: 'High Initial Withdrawal Rate',
      description: `Your first-year withdrawal rate of ${withdrawalRate.toFixed(1)}% exceeds the sustainable 4% guideline, increasing longevity risk.`,
      impact: 'high',
      detail: 'High withdrawal rates deplete your pot faster and reduce compound growth potential. Consider reducing target income or increasing pot size.'
    });
  } else if (withdrawalRate < 3) {
    insights.push({
      category: 'opportunities',
      icon: '📈',
      title: 'Conservative Withdrawal Rate',
      description: `Your initial withdrawal rate of ${withdrawalRate.toFixed(1)}% is well below the 4% guideline, suggesting room to increase retirement income.`,
      impact: 'medium',
      detail: `You could potentially increase annual income by £${((retirementYear.totalPot * 0.04 - retirementYear.withdrawal) / 1000).toFixed(1)}k while maintaining sustainability.`
    });
  }

  return insights;
}

/**
 * Analyze tax efficiency
 */
function analyzeTaxEfficiency(plan, projection) {
  const insights = [];
  const retirementYears = projection.years?.filter(y => y.age >= plan.retirementAge) || [];
  
  if (retirementYears.length === 0) return insights;

  const avgTaxRate = retirementYears.reduce((sum, y) => 
    sum + (y.totalTax / y.grossIncome), 0) / retirementYears.length * 100;

  if (avgTaxRate > 25) {
    insights.push({
      category: 'opportunities',
      icon: '📈',
      title: 'Tax Optimization Opportunity',
      description: `Your average tax rate of ${avgTaxRate.toFixed(1)}% suggests potential for tax-efficient withdrawal strategies.`,
      impact: 'medium',
      detail: 'Consider spreading income more evenly, utilizing ISA withdrawals strategically, or optimizing PCLS timing to reduce tax burden.'
    });
  } else if (avgTaxRate < 15) {
    insights.push({
      category: 'strengths',
      icon: '✅',
      title: 'Tax-Efficient Plan',
      description: `Your low average tax rate of ${avgTaxRate.toFixed(1)}% indicates excellent tax efficiency in your retirement income strategy.`,
      impact: 'medium',
      detail: 'Your withdrawal strategy effectively minimizes tax burden while maintaining desired income levels.'
    });
  }

  // Check for higher rate tax
  const higherRateYears = retirementYears.filter(y => 
    y.grossIncome > 50270).length;
  
  if (higherRateYears > retirementYears.length / 2) {
    insights.push({
      category: 'suggestions',
      icon: '💡',
      title: 'Consider Income Smoothing',
      description: `You'll pay higher-rate tax in ${higherRateYears} years of retirement. Smoothing income could reduce overall tax burden.`,
      impact: 'medium',
      detail: 'Try to keep annual income below £50,270 where possible. Use ISA withdrawals to supplement pension income in higher-income years.'
    });
  }

  return insights;
}

/**
 * Analyze state pension timing
 */
function analyzeStateAge(plan) {
  const insights = [];
  const gapYears = plan.statePensionAge - plan.retirementAge;

  if (gapYears > 5) {
    insights.push({
      category: 'suggestions',
      icon: '💡',
      title: 'Long Gap Before State Pension',
      description: `You'll have ${gapYears} years between retirement and state pension. Ensure sufficient pot reserves for this period.`,
      impact: 'medium',
      detail: `Your pot needs to support higher withdrawals for ${gapYears} years before state pension income begins at age ${plan.statePensionAge}.`
    });
  }

  if (plan.expectedStatePension < 10000) {
    insights.push({
      category: 'suggestions',
      icon: '💡',
      title: 'State Pension Top-Up Available',
      description: `Your state pension projection of £${(plan.expectedStatePension / 1000).toFixed(1)}k is below the full amount. Check your National Insurance record.`,
      impact: 'medium',
      detail: 'You may have gaps in your NI contributions. Voluntary contributions could increase your state pension significantly.'
    });
  }

  return insights;
}

/**
 * Analyze contribution levels
 */
function analyzeContributions(plan) {
  const insights = [];
  const totalAnnual = plan.annualPensionContribution + plan.annualIsaContribution;
  const yearsToRetirement = plan.retirementAge - plan.currentAge;

  if (totalAnnual < 10000 && yearsToRetirement > 5) {
    insights.push({
      category: 'suggestions',
      icon: '💡',
      title: 'Consider Increasing Contributions',
      description: `Annual contributions of £${(totalAnnual / 1000).toFixed(1)}k may limit pot growth. Even small increases compound significantly over ${yearsToRetirement} years.`,
      impact: 'high',
      detail: `Increasing contributions by £100/month (£1,200/year) could add approximately £${((1200 * yearsToRetirement * 1.05) / 1000).toFixed(0)}k to your pot at retirement.`
    });
  }

  // Check ISA diversification
  const isaRatio = plan.annualIsaContribution / (totalAnnual || 1);
  if (isaRatio < 0.1 && totalAnnual > 0) {
    insights.push({
      category: 'suggestions',
      icon: '💡',
      title: 'Consider ISA Contributions',
      description: `Only ${(isaRatio * 100).toFixed(0)}% of your contributions go to ISAs. ISAs provide tax-free income in retirement and add flexibility.`,
      impact: 'medium',
      detail: 'ISAs can be accessed before pension age without penalties and provide tax-free withdrawals, complementing pension income.'
    });
  }

  return insights;
}

/**
 * Analyze readiness score
 */
function analyzeReadiness(readinessScore) {
  const insights = [];
  
  if (!readinessScore) return insights;

  const score = readinessScore.overallScore || 0;

  if (score >= 80) {
    insights.push({
      category: 'strengths',
      icon: '✅',
      title: 'Excellent Retirement Readiness',
      description: `Your readiness score of ${score}% indicates you're well-prepared for retirement with strong fundamentals across all areas.`,
      impact: 'high',
      detail: 'Your plan demonstrates solid preparation in pot size, contribution levels, time horizon, and risk management.'
    });
  } else if (score < 50) {
    insights.push({
      category: 'risks',
      icon: '⚠️',
      title: 'Retirement Readiness Needs Attention',
      description: `Your readiness score of ${score}% suggests significant improvements needed. Focus on the lowest-scoring areas first.`,
      impact: 'high',
      detail: 'Review each component of your readiness score and prioritize actions that have the biggest impact on your overall preparedness.'
    });
  }

  return insights;
}

/**
 * Analyze longevity considerations
 */
function analyzeLongevity(plan, projection) {
  const insights = [];
  const projectedAge = 95; // Standard longevity assumption
  const retirementDuration = projectedAge - plan.retirementAge;

  if (retirementDuration > 35) {
    insights.push({
      category: 'suggestions',
      icon: '💡',
      title: 'Long Retirement Period',
      description: `Planning for ${retirementDuration} years of retirement requires careful pot management and consideration of longevity risk.`,
      impact: 'medium',
      detail: 'Consider annuitizing a portion of your pot at age 75+ to guarantee income for life, protecting against outliving your savings.'
    });
  }

  return insights;
}

/**
 * Analyze spending patterns
 */
function analyzeSpending(plan, projection) {
  const insights = [];
  
  if (plan.applyAgeBasedSpendingReductions) {
    insights.push({
      category: 'strengths',
      icon: '✅',
      title: 'Age-Based Spending Enabled',
      description: 'You\'re using realistic age-based spending reductions, which improves plan sustainability and reflects typical retirement patterns.',
      impact: 'medium',
      detail: 'Spending typically decreases in later retirement years. This realistic modeling helps ensure your plan remains conservative and achievable.'
    });
  } else {
    insights.push({
      category: 'suggestions',
      icon: '💡',
      title: 'Consider Age-Based Spending',
      description: 'Enable age-based spending reductions to model more realistic retirement expenses and improve plan accuracy.',
      impact: 'low',
      detail: 'Research shows spending decreases 15-30% from age 75-85. Modeling this can reveal additional flexibility in your plan.'
    });
  }

  return insights;
}

/**
 * Rank insights by impact and filter to top 5-8
 */
function rankAndFilterInsights(insights) {
  // Impact scores for sorting
  const impactScores = { high: 3, medium: 2, low: 1 };

  // Sort by impact (high to low) and ensure diversity of categories
  const sorted = insights.sort((a, b) => 
    impactScores[b.impact] - impactScores[a.impact]);

  // Ensure at least one from each category if available
  const byCategory = {
    risks: sorted.filter(i => i.category === 'risks'),
    opportunities: sorted.filter(i => i.category === 'opportunities'),
    strengths: sorted.filter(i => i.category === 'strengths'),
    suggestions: sorted.filter(i => i.category === 'suggestions')
  };

  const result = [];
  
  // Add top risk if available
  if (byCategory.risks.length > 0) result.push(byCategory.risks[0]);
  
  // Add top opportunity if available
  if (byCategory.opportunities.length > 0) result.push(byCategory.opportunities[0]);
  
  // Add top strength if available
  if (byCategory.strengths.length > 0) result.push(byCategory.strengths[0]);

  // Fill remaining slots with highest impact insights
  for (const insight of sorted) {
    if (result.length >= 8) break;
    if (!result.includes(insight)) {
      result.push(insight);
    }
  }

  // Ensure at least 5 insights, max 8
  const minInsights = Math.min(5, result.length);
  return result.slice(0, Math.min(8, Math.max(minInsights, result.length)));
}

/**
 * Get insight category metadata
 */
export function getCategoryMetadata() {
  return {
    risks: {
      icon: '⚠️',
      label: 'Risks',
      color: '#ef4444',
      description: 'Areas requiring attention'
    },
    opportunities: {
      icon: '📈',
      label: 'Opportunities',
      color: '#3b82f6',
      description: 'Ways to optimize your plan'
    },
    strengths: {
      icon: '✅',
      label: 'Strengths',
      color: '#10b981',
      description: 'What\'s working well'
    },
    suggestions: {
      icon: '💡',
      label: 'Suggestions',
      color: '#f59e0b',
      description: 'Actionable recommendations'
    }
  };
}
