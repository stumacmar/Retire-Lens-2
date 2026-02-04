/**
 * RetireLens 2 - Benchmark Data
 * 
 * Realistic simulated anonymized datasets for social benchmarking
 * IMPORTANT: These are illustrative datasets only - no real user data
 * 
 * Data is organized by:
 * - Age cohorts (50-54, 55-59, 60-64, 65+)
 * - Pot size bands (£0-100k, £100-250k, £250-500k, £500k+)
 */

/**
 * Pension pot benchmarks by age cohort
 * Values in £k, representing median values for each cohort
 */
export const POT_SIZE_BENCHMARKS = {
  '50-54': {
    count: 1000, // Sample size for illustration
    median: 85000,
    percentile25: 35000,
    percentile75: 180000,
    percentile90: 320000,
    distribution: {
      '0-100k': 0.58,
      '100-250k': 0.28,
      '250-500k': 0.10,
      '500k+': 0.04
    }
  },
  '55-59': {
    count: 1000,
    median: 142000,
    percentile25: 58000,
    percentile75: 285000,
    percentile90: 465000,
    distribution: {
      '0-100k': 0.45,
      '100-250k': 0.32,
      '250-500k': 0.16,
      '500k+': 0.07
    }
  },
  '60-64': {
    count: 1000,
    median: 198000,
    percentile25: 82000,
    percentile75: 385000,
    percentile90: 620000,
    distribution: {
      '0-100k': 0.35,
      '100-250k': 0.34,
      '250-500k': 0.21,
      '500k+': 0.10
    }
  },
  '65+': {
    count: 1000,
    median: 215000,
    percentile25: 95000,
    percentile75: 420000,
    percentile90: 680000,
    distribution: {
      '0-100k': 0.32,
      '100-250k': 0.33,
      '250-500k': 0.23,
      '500k+': 0.12
    }
  }
};

/**
 * Income target benchmarks by retirement age
 * Values in £k per year (net income)
 */
export const INCOME_BENCHMARKS = {
  '55-59': {
    count: 1000,
    median: 28000,
    percentile25: 18000,
    percentile75: 42000,
    percentile90: 58000,
    description: 'Early retirement cohort'
  },
  '60-64': {
    count: 1000,
    median: 32000,
    percentile25: 21000,
    percentile75: 48000,
    percentile90: 65000,
    description: 'Standard retirement age cohort'
  },
  '65-67': {
    count: 1000,
    median: 35000,
    percentile25: 23000,
    percentile75: 52000,
    percentile90: 72000,
    description: 'State pension age cohort'
  },
  '68+': {
    count: 1000,
    median: 30000,
    percentile25: 20000,
    percentile75: 45000,
    percentile90: 62000,
    description: 'Late retirement cohort'
  }
};

/**
 * Contribution rate benchmarks
 * Percentage of gross income contributed
 */
export const CONTRIBUTION_BENCHMARKS = {
  'under-30': {
    median: 0.08, // 8%
    percentile25: 0.05,
    percentile75: 0.12,
    percentile90: 0.18
  },
  '30-39': {
    median: 0.10,
    percentile25: 0.06,
    percentile75: 0.15,
    percentile90: 0.22
  },
  '40-49': {
    median: 0.12,
    percentile25: 0.08,
    percentile75: 0.18,
    percentile90: 0.25
  },
  '50-59': {
    median: 0.15,
    percentile25: 0.10,
    percentile75: 0.22,
    percentile90: 0.30
  },
  '60+': {
    median: 0.18,
    percentile25: 0.12,
    percentile75: 0.25,
    percentile90: 0.35
  }
};

/**
 * Success rate benchmarks (from Monte Carlo simulations)
 */
export const SUCCESS_RATE_BENCHMARKS = {
  'conservative': {
    label: 'Conservative (3% withdrawal)',
    median: 92,
    percentile25: 85,
    percentile75: 97,
    description: 'Low spending relative to pot'
  },
  'moderate': {
    label: 'Moderate (4% withdrawal)',
    median: 78,
    percentile25: 68,
    percentile75: 87,
    description: 'Standard 4% rule'
  },
  'aggressive': {
    label: 'Aggressive (5%+ withdrawal)',
    median: 58,
    percentile25: 45,
    percentile75: 70,
    description: 'High spending relative to pot'
  }
};

/**
 * Readiness score benchmarks
 */
export const READINESS_BENCHMARKS = {
  '5-10-years': {
    label: '5-10 years to retirement',
    median: 68,
    percentile25: 52,
    percentile75: 82,
    percentile90: 91
  },
  '10-15-years': {
    label: '10-15 years to retirement',
    median: 58,
    percentile25: 42,
    percentile75: 72,
    percentile90: 85
  },
  '15-20-years': {
    label: '15-20 years to retirement',
    median: 48,
    percentile25: 35,
    percentile75: 62,
    percentile90: 75
  },
  '20+-years': {
    label: '20+ years to retirement',
    median: 38,
    percentile25: 25,
    percentile75: 52,
    percentile90: 68
  }
};

/**
 * UK-specific retirement statistics for context
 */
export const UK_RETIREMENT_STATS = {
  medianRetirementAge: 65,
  medianPensionPot: 107000,
  averageStatePension: 10600, // Full new state pension
  minimalComfortableIncome: 31300, // PLSA moderate standard
  comfortableRetirementIncome: 43100, // PLSA comfortable standard
  luxuryRetirementIncome: 59000 // PLSA luxury standard
};

/**
 * Regional benchmarks (illustrative)
 */
export const REGIONAL_BENCHMARKS = {
  'london-southeast': {
    label: 'London & South East',
    medianPot: 235000,
    medianIncome: 42000,
    costAdjustment: 1.25
  },
  'midlands-north': {
    label: 'Midlands & North',
    medianPot: 175000,
    medianIncome: 32000,
    costAdjustment: 0.95
  },
  'scotland-wales-ni': {
    label: 'Scotland, Wales & NI',
    medianPot: 165000,
    medianIncome: 30000,
    costAdjustment: 0.90
  },
  'southwest': {
    label: 'South West',
    medianPot: 195000,
    medianIncome: 35000,
    costAdjustment: 1.05
  }
};

/**
 * Gets the appropriate age cohort for benchmarking
 */
export function getAgeCohort(age) {
  if (age < 55) return '50-54';
  if (age < 60) return '55-59';
  if (age < 65) return '60-64';
  return '65+';
}

/**
 * Gets the appropriate retirement age cohort
 */
export function getRetirementAgeCohort(retirementAge) {
  if (retirementAge < 60) return '55-59';
  if (retirementAge < 65) return '60-64';
  if (retirementAge < 68) return '65-67';
  return '68+';
}

/**
 * Gets the years-to-retirement cohort
 */
export function getYearsToRetirementCohort(years) {
  if (years < 10) return '5-10-years';
  if (years < 15) return '10-15-years';
  if (years < 20) return '15-20-years';
  return '20+-years';
}

/**
 * Gets contribution age cohort
 */
export function getContributionAgeCohort(age) {
  if (age < 30) return 'under-30';
  if (age < 40) return '30-39';
  if (age < 50) return '40-49';
  if (age < 60) return '50-59';
  return '60+';
}

/**
 * Disclaimer text for benchmarking
 */
export const BENCHMARK_DISCLAIMER = `
These benchmarks are illustrative only and based on simulated data representing typical UK pension holders.
They do NOT contain any real user data. Actual retirement outcomes vary significantly based on individual
circumstances, market performance, and personal choices. Use these comparisons as general guidance only.
`;
