/**
 * RetireLens 2 - Risk Scoring Engine
 * 
 * Calculate risk score (0-100) based on:
 * - Success rate from Monte Carlo simulations
 * - Average shortfall amount
 * - Time to depletion
 * 
 * Lower score = higher risk
 * Higher score = lower risk
 */

/**
 * Calculate risk score from Monte Carlo results
 * 
 * @param {object} monteCarloResults - Results from Monte Carlo simulation
 * @param {object} deterministicProjection - Deterministic projection data
 * @param {number} targetAge - Target age for projection (default 90)
 * @returns {object} Risk score and breakdown
 */
export function calculateRiskScore(monteCarloResults, deterministicProjection, targetAge = 90) {
  const {
    successRate = 0,
    depletionAges = [],
    shortfalls = [],
    simulations = []
  } = monteCarloResults;
  
  const {
    retirementAge = 65,
    yearByYear = []
  } = deterministicProjection;
  
  // Component 1: Success Rate (0-40 points)
  // 100% success = 40 points, 0% success = 0 points
  const successRateScore = successRate * 40;
  
  // Component 2: Depletion Age Score (0-30 points)
  let depletionScore = 0;
  if (depletionAges.length > 0) {
    const avgDepletionAge = depletionAges.reduce((sum, age) => sum + age, 0) / depletionAges.length;
    const yearsToDepletion = avgDepletionAge - retirementAge;
    const targetYears = targetAge - retirementAge;
    
    // If average depletion is at or beyond target age, full points
    if (yearsToDepletion >= targetYears) {
      depletionScore = 30;
    } else {
      // Scale based on how far into retirement funds last
      depletionScore = (yearsToDepletion / targetYears) * 30;
    }
  } else {
    // No depletions = full points
    depletionScore = 30;
  }
  
  // Component 3: Shortfall Severity (0-30 points)
  let shortfallScore = 0;
  if (shortfalls.length > 0) {
    const avgShortfall = shortfalls.reduce((sum, s) => sum + s, 0) / shortfalls.length;
    
    // Calculate average total pot value at retirement
    const retirementYear = yearByYear.find(y => y.age === retirementAge);
    const retirementPot = retirementYear 
      ? retirementYear.pensionBalance + retirementYear.isaBalance 
      : 100000;
    
    // Shortfall as percentage of retirement pot
    const shortfallPercentage = avgShortfall / retirementPot;
    
    // If shortfall is less than 10% of pot, still get good score
    if (shortfallPercentage <= 0.1) {
      shortfallScore = 30;
    } else if (shortfallPercentage <= 0.5) {
      shortfallScore = 30 - ((shortfallPercentage - 0.1) / 0.4) * 15;
    } else {
      shortfallScore = 15 - Math.min((shortfallPercentage - 0.5) * 30, 15);
    }
  } else {
    // No shortfalls = full points
    shortfallScore = 30;
  }
  
  const totalScore = Math.round(successRateScore + depletionScore + shortfallScore);
  
  // Determine risk level
  let riskLevel, riskColor;
  if (totalScore >= 80) {
    riskLevel = 'Low Risk';
    riskColor = '#22c55e';
  } else if (totalScore >= 60) {
    riskLevel = 'Moderate Risk';
    riskColor = '#f59e0b';
  } else if (totalScore >= 40) {
    riskLevel = 'High Risk';
    riskColor = '#ef4444';
  } else {
    riskLevel = 'Very High Risk';
    riskColor = '#dc2626';
  }
  
  return {
    totalScore,
    riskLevel,
    riskColor,
    breakdown: {
      successRate: {
        score: Math.round(successRateScore),
        maxScore: 40,
        value: successRate,
        description: 'Probability of success'
      },
      depletionAge: {
        score: Math.round(depletionScore),
        maxScore: 30,
        value: depletionAges.length > 0 
          ? Math.round(depletionAges.reduce((sum, age) => sum + age, 0) / depletionAges.length)
          : targetAge,
        description: 'Average depletion age'
      },
      shortfall: {
        score: Math.round(shortfallScore),
        maxScore: 30,
        value: shortfalls.length > 0
          ? Math.round(shortfalls.reduce((sum, s) => sum + s, 0) / shortfalls.length)
          : 0,
        description: 'Average shortfall amount'
      }
    }
  };
}

/**
 * Generate risk mitigation recommendations
 * 
 * @param {object} riskScore - Risk score object from calculateRiskScore
 * @param {object} deterministicProjection - Deterministic projection data
 * @returns {array} Array of recommendation objects
 */
export function generateRiskRecommendations(riskScore, deterministicProjection) {
  const recommendations = [];
  const { breakdown } = riskScore;
  const { retirementAge, targetNetIncome, yearByYear = [] } = deterministicProjection;
  
  // Recommendation 1: Success rate is low
  if (breakdown.successRate.value < 0.7) {
    recommendations.push({
      priority: 1,
      category: 'Success Rate',
      issue: `Only ${Math.round(breakdown.successRate.value * 100)}% chance of success`,
      recommendation: 'Consider delaying retirement by 2-3 years or reducing income target by £5,000',
      impact: 'Could improve success rate by 15-25%'
    });
  }
  
  // Recommendation 2: Early depletion
  if (breakdown.depletionAge.value < 85 && breakdown.depletionAge.value > 0) {
    const yearsShort = 85 - breakdown.depletionAge.value;
    recommendations.push({
      priority: 2,
      category: 'Longevity Risk',
      issue: `Funds depleting at age ${breakdown.depletionAge.value}, ${yearsShort} years before age 85`,
      recommendation: 'Increase pension contributions by 20% or reduce retirement spending by 10%',
      impact: `Could extend funding by ${Math.round(yearsShort * 0.6)} years`
    });
  }
  
  // Recommendation 3: Large shortfall
  if (breakdown.shortfall.value > 50000) {
    recommendations.push({
      priority: 3,
      category: 'Funding Gap',
      issue: `Average shortfall of £${Math.round(breakdown.shortfall.value / 1000)}k in failed scenarios`,
      recommendation: 'Build emergency reserve or consider annuity for guaranteed income floor',
      impact: 'Provides downside protection in worst-case scenarios'
    });
  }
  
  // Recommendation 4: Underfunded at retirement
  const retirementYear = yearByYear.find(y => y.age === retirementAge);
  if (retirementYear) {
    const retirementPot = retirementYear.pensionBalance + retirementYear.isaBalance;
    const requiredMultiple = 25; // 4% withdrawal rule
    const requiredPot = targetNetIncome * requiredMultiple;
    
    if (retirementPot < requiredPot * 0.8) {
      const gap = requiredPot - retirementPot;
      recommendations.push({
        priority: 4,
        category: 'Retirement Pot',
        issue: `Retirement pot is £${Math.round(gap / 1000)}k below recommended level`,
        recommendation: 'Maximize pension contributions to get full employer match and tax relief',
        impact: `Need to save additional £${Math.round(gap / ((retirementAge - deterministicProjection.currentAge) * 1000))}k per year`
      });
    }
  }
  
  // Recommendation 5: Too much in one pot
  if (retirementYear) {
    const pensionPercentage = retirementYear.pensionBalance / (retirementYear.pensionBalance + retirementYear.isaBalance);
    
    if (pensionPercentage > 0.9) {
      recommendations.push({
        priority: 5,
        category: 'Tax Efficiency',
        issue: 'Over 90% of savings in pension - may face high tax charges',
        recommendation: 'Divert some contributions to ISA for tax-free flexibility',
        impact: 'Provides tax-free income source and IHT benefits'
      });
    } else if (pensionPercentage < 0.3) {
      recommendations.push({
        priority: 5,
        category: 'Tax Efficiency',
        issue: 'Under 30% in pension - missing out on tax relief',
        recommendation: 'Increase pension contributions to maximize tax benefits',
        impact: 'Gain 20-45% tax relief on contributions'
      });
    }
  }
  
  // Sort by priority and return top recommendations
  return recommendations.sort((a, b) => a.priority - b.priority);
}

/**
 * Calculate confidence interval percentiles for a given metric
 * 
 * @param {array} values - Array of values from simulations
 * @param {array} percentiles - Percentiles to calculate (e.g., [10, 25, 50, 75, 90])
 * @returns {object} Percentile values
 */
export function calculatePercentiles(values, percentiles = [10, 25, 50, 75, 90]) {
  if (!values || values.length === 0) {
    return {};
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const result = {};
  
  percentiles.forEach(p => {
    const index = Math.floor((p / 100) * sorted.length);
    result[`p${p}`] = sorted[Math.min(index, sorted.length - 1)];
  });
  
  return result;
}

/**
 * Analyze simulation results for risk metrics
 * 
 * @param {array} simulations - Array of simulation results
 * @param {number} targetAge - Target age for analysis
 * @returns {object} Risk metrics
 */
export function analyzeSimulationRisk(simulations, targetAge = 90) {
  if (!simulations || simulations.length === 0) {
    return null;
  }
  
  const successCount = simulations.filter(s => s.success).length;
  const successRate = successCount / simulations.length;
  
  const depletionAges = simulations
    .filter(s => !s.success && s.depletionAge)
    .map(s => s.depletionAge);
  
  const shortfalls = simulations
    .filter(s => !s.success && s.shortfall)
    .map(s => s.shortfall);
  
  // Percentiles for key metrics
  const finalBalances = simulations.map(s => s.finalBalance || 0);
  const balancePercentiles = calculatePercentiles(finalBalances);
  
  return {
    successRate,
    depletionAges,
    shortfalls,
    balancePercentiles,
    worstCase: Math.min(...finalBalances),
    bestCase: Math.max(...finalBalances),
    median: balancePercentiles.p50 || 0
  };
}
