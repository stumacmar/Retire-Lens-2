/**
 * RetireLens 2 - Benchmarking Engine
 * 
 * Generates percentile comparisons against anonymized benchmark data
 * All data is hardcoded and illustrative - no real user data
 */

import {
  POT_SIZE_BENCHMARKS,
  INCOME_BENCHMARKS,
  SUCCESS_RATE_BENCHMARKS,
  READINESS_BENCHMARKS,
  CONTRIBUTION_BENCHMARKS,
  UK_RETIREMENT_STATS,
  getAgeCohort,
  getRetirementAgeCohort,
  getYearsToRetirementCohort,
  getContributionAgeCohort,
  BENCHMARK_DISCLAIMER
} from '../config/benchmarkData.js';

/**
 * Generates comprehensive benchmarking analysis for a plan
 * @param {object} plan - The retirement plan
 * @param {object} projection - Projection results
 * @param {object} options - Additional options (monteCarloResults, readinessScore)
 * @returns {object} Benchmarking analysis
 */
export function generateBenchmarkAnalysis(plan, projection, options = {}) {
  const analysis = {
    potSizeComparison: analyzePotSize(plan, projection),
    incomeComparison: analyzeIncome(plan),
    successRateComparison: analyzeSuccessRate(plan, projection, options),
    readinessComparison: analyzeReadiness(plan, options),
    contributionComparison: analyzeContributions(plan),
    summary: null,
    disclaimer: BENCHMARK_DISCLAIMER
  };

  // Generate overall summary
  analysis.summary = generateBenchmarkSummary(analysis);

  return analysis;
}

/**
 * Analyzes pension pot size against benchmarks
 */
function analyzePotSize(plan, projection) {
  const cohort = getAgeCohort(plan.currentAge);
  const benchmarks = POT_SIZE_BENCHMARKS[cohort];
  
  // Get pot at retirement or current pot
  const retirementYear = projection.years?.find(y => y.age === plan.retirementAge);
  const userPot = retirementYear?.totalPot || plan.currentPension + plan.currentIsa;

  const percentile = calculatePercentile(userPot, benchmarks);
  
  return {
    cohort: cohort,
    userValue: userPot,
    benchmarks: {
      median: benchmarks.median,
      percentile25: benchmarks.percentile25,
      percentile75: benchmarks.percentile75,
      percentile90: benchmarks.percentile90
    },
    percentile: percentile,
    comparison: getComparisonText(percentile),
    status: getComparisonStatus(percentile)
  };
}

/**
 * Analyzes target income against benchmarks
 */
function analyzeIncome(plan) {
  const cohort = getRetirementAgeCohort(plan.retirementAge);
  const benchmarks = INCOME_BENCHMARKS[cohort];
  
  const userIncome = plan.targetNetIncome;
  const percentile = calculatePercentile(userIncome, benchmarks);

  return {
    cohort: cohort,
    userValue: userIncome,
    benchmarks: {
      median: benchmarks.median,
      percentile25: benchmarks.percentile25,
      percentile75: benchmarks.percentile75,
      percentile90: benchmarks.percentile90
    },
    percentile: percentile,
    comparison: getComparisonText(percentile),
    status: getComparisonStatus(percentile),
    plsaComparison: compareToPLSAStandards(userIncome)
  };
}

/**
 * Analyzes success rate against benchmarks
 */
function analyzeSuccessRate(plan, projection, options) {
  if (!options.monteCarloResults) {
    return null;
  }

  const successRate = options.monteCarloResults.successRate;
  
  // Determine which category user falls into based on withdrawal rate
  const retirementYear = projection.years?.find(y => y.age === plan.retirementAge);
  const withdrawalRate = retirementYear ? 
    (retirementYear.withdrawal / retirementYear.totalPot) : 0.04;

  let category;
  if (withdrawalRate < 0.035) {
    category = 'conservative';
  } else if (withdrawalRate <= 0.045) {
    category = 'moderate';
  } else {
    category = 'aggressive';
  }

  const benchmarks = SUCCESS_RATE_BENCHMARKS[category];
  const percentile = calculatePercentile(successRate, {
    percentile25: benchmarks.percentile25,
    median: benchmarks.median,
    percentile75: benchmarks.percentile75
  });

  return {
    category: category,
    categoryLabel: benchmarks.label,
    userValue: successRate,
    benchmarks: {
      median: benchmarks.median,
      percentile25: benchmarks.percentile25,
      percentile75: benchmarks.percentile75
    },
    percentile: percentile,
    comparison: getComparisonText(percentile),
    status: getComparisonStatus(percentile)
  };
}

/**
 * Analyzes readiness score against benchmarks
 */
function analyzeReadiness(plan, options) {
  if (!options.readinessScore) {
    return null;
  }

  const yearsToRetirement = plan.retirementAge - plan.currentAge;
  const cohort = getYearsToRetirementCohort(yearsToRetirement);
  const benchmarks = READINESS_BENCHMARKS[cohort];

  const userScore = options.readinessScore.overallScore;
  const percentile = calculatePercentile(userScore, benchmarks);

  return {
    cohort: cohort,
    cohortLabel: benchmarks.label,
    userValue: userScore,
    benchmarks: {
      median: benchmarks.median,
      percentile25: benchmarks.percentile25,
      percentile75: benchmarks.percentile75,
      percentile90: benchmarks.percentile90
    },
    percentile: percentile,
    comparison: getComparisonText(percentile),
    status: getComparisonStatus(percentile)
  };
}

/**
 * Analyzes contribution levels against benchmarks
 */
function analyzeContributions(plan) {
  const cohort = getContributionAgeCohort(plan.currentAge);
  const benchmarks = CONTRIBUTION_BENCHMARKS[cohort];

  // Estimate contribution rate (assume £50k gross income as baseline)
  const estimatedGrossIncome = 50000;
  const totalContributions = plan.annualPensionContribution + plan.annualIsaContribution;
  const contributionRate = totalContributions / estimatedGrossIncome;

  const percentile = calculatePercentile(contributionRate, {
    percentile25: benchmarks.percentile25,
    median: benchmarks.median,
    percentile75: benchmarks.percentile75,
    percentile90: benchmarks.percentile90
  });

  return {
    cohort: cohort,
    userValue: contributionRate,
    userContributions: totalContributions,
    benchmarks: {
      median: benchmarks.median,
      percentile25: benchmarks.percentile25,
      percentile75: benchmarks.percentile75,
      percentile90: benchmarks.percentile90
    },
    percentile: percentile,
    comparison: getComparisonText(percentile),
    status: getComparisonStatus(percentile)
  };
}

/**
 * Calculates percentile rank for a value against benchmarks
 */
function calculatePercentile(value, benchmarks) {
  // Simple linear interpolation
  if (value <= benchmarks.percentile25) {
    // Between 0 and 25th percentile
    const ratio = value / benchmarks.percentile25;
    return Math.max(0, Math.min(25, ratio * 25));
  } else if (value <= benchmarks.median) {
    // Between 25th and 50th percentile
    const range = benchmarks.median - benchmarks.percentile25;
    const position = value - benchmarks.percentile25;
    return 25 + (position / range) * 25;
  } else if (value <= benchmarks.percentile75) {
    // Between 50th and 75th percentile
    const range = benchmarks.percentile75 - benchmarks.median;
    const position = value - benchmarks.median;
    return 50 + (position / range) * 25;
  } else if (benchmarks.percentile90 && value <= benchmarks.percentile90) {
    // Between 75th and 90th percentile
    const range = benchmarks.percentile90 - benchmarks.percentile75;
    const position = value - benchmarks.percentile75;
    return 75 + (position / range) * 15;
  } else {
    // Above 90th percentile
    return Math.min(99, 90 + 9);
  }
}

/**
 * Gets comparison text based on percentile
 */
function getComparisonText(percentile) {
  if (percentile >= 75) {
    return 'Well above average';
  } else if (percentile >= 60) {
    return 'Above average';
  } else if (percentile >= 40) {
    return 'Around average';
  } else if (percentile >= 25) {
    return 'Below average';
  } else {
    return 'Well below average';
  }
}

/**
 * Gets status indicator based on percentile
 */
function getComparisonStatus(percentile) {
  if (percentile >= 75) return 'excellent';
  if (percentile >= 60) return 'good';
  if (percentile >= 40) return 'average';
  if (percentile >= 25) return 'fair';
  return 'needs-improvement';
}

/**
 * Compares income to PLSA retirement living standards
 */
function compareToPLSAStandards(income) {
  const standards = {
    minimal: { threshold: 0, label: 'Minimum' },
    moderate: { threshold: UK_RETIREMENT_STATS.minimalComfortableIncome, label: 'Moderate' },
    comfortable: { threshold: UK_RETIREMENT_STATS.comfortableRetirementIncome, label: 'Comfortable' },
    luxury: { threshold: UK_RETIREMENT_STATS.luxuryRetirementIncome, label: 'Luxury' }
  };

  let standard;
  if (income >= standards.luxury.threshold) {
    standard = 'luxury';
  } else if (income >= standards.comfortable.threshold) {
    standard = 'comfortable';
  } else if (income >= standards.moderate.threshold) {
    standard = 'moderate';
  } else {
    standard = 'minimal';
  }

  return {
    standard: standard,
    label: standards[standard].label,
    standards: standards
  };
}

/**
 * Generates summary of benchmark analysis
 */
function generateBenchmarkSummary(analysis) {
  const strengths = [];
  const areas = [];

  // Check each comparison
  if (analysis.potSizeComparison) {
    if (analysis.potSizeComparison.percentile >= 60) {
      strengths.push('Pot size is above average for your age group');
    } else if (analysis.potSizeComparison.percentile < 40) {
      areas.push('Consider increasing contributions to build larger pot');
    }
  }

  if (analysis.incomeComparison) {
    if (analysis.incomeComparison.percentile >= 60) {
      strengths.push('Target income is above average');
    }
    
    const plsa = analysis.incomeComparison.plsaComparison;
    if (plsa.standard === 'comfortable' || plsa.standard === 'luxury') {
      strengths.push(`Income meets PLSA ${plsa.label} standard`);
    } else if (plsa.standard === 'minimal') {
      areas.push('Income below PLSA Moderate standard - consider increasing target');
    }
  }

  if (analysis.successRateComparison && analysis.successRateComparison.percentile >= 60) {
    strengths.push('Success rate is above average for your withdrawal strategy');
  }

  if (analysis.readinessComparison) {
    if (analysis.readinessComparison.percentile >= 60) {
      strengths.push('Readiness score is above average for your timeframe');
    } else if (analysis.readinessComparison.percentile < 40) {
      areas.push('Readiness score below average - focus on improving weak areas');
    }
  }

  if (analysis.contributionComparison && analysis.contributionComparison.percentile < 40) {
    areas.push('Contribution rate is below average for your age group');
  }

  return {
    strengths: strengths,
    improvementAreas: areas,
    overallAssessment: strengths.length > areas.length ? 'above-average' : 
                       strengths.length === areas.length ? 'average' : 'below-average'
  };
}
