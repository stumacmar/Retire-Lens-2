/**
 * RetireLens 2 - Default Configuration
 * UK Tax Year 2025/26 rates and thresholds
 * 
 * All monetary values in GBP
 * All rates as decimals (e.g., 0.20 = 20%)
 */
// Last updated: March 2026 - UK Tax Year 2025/26 rates
// Income tax bands frozen through 2027/28 (Autumn Statement 2022)
// Review annually each April

export const TAX_CONFIG = {
  // Personal Allowance
  personalAllowance: 12570,
  personalAllowanceTaperThreshold: 100000,
  personalAllowanceTaperRate: 0.5, // Lose £1 for every £2 over threshold

  // Income Tax Bands (England/Wales/NI)
  bands: [
    { name: 'Basic Rate', threshold: 37700, rate: 0.20 },
    { name: 'Higher Rate', threshold: 125140, rate: 0.40 },
    { name: 'Additional Rate', threshold: Infinity, rate: 0.45 }
  ],

  // Scotland has different rates (2025/26)
  scottishBands: [
    { name: 'Starter Rate', threshold: 2306, rate: 0.19 },
    { name: 'Basic Rate', threshold: 13991, rate: 0.20 },
    { name: 'Intermediate Rate', threshold: 31092, rate: 0.21 },
    { name: 'Higher Rate', threshold: 62430, rate: 0.42 },
    { name: 'Advanced Rate', threshold: 125140, rate: 0.45 },
    { name: 'Top Rate', threshold: Infinity, rate: 0.48 }
  ]
};

export const PENSION_CONFIG = {
  // Pension Commencement Lump Sum (PCLS / Tax-Free Cash)
  pclsRate: 0.25, // 25% tax-free

  // State Pension
  statePensionAge: 67,
  fullStatePensionWeekly: 230.25, // 2025/26 full new state pension (was £221.20 in 2024/25)

  // Lifetime Allowance abolished April 2024, but keeping for reference
  lifetimeAllowance: null, // No longer applicable

  // Annual Allowance
  annualAllowance: 60000,
  moneyPurchaseAnnualAllowance: 10000, // If flexibly accessed pension

  // Minimum Pension Age
  minPensionAge: 55, // Rising to 57 in 2028
  minPensionAgeFrom2028: 57
};

export const ISA_CONFIG = {
  // ISA annual allowance
  annualAllowance: 20000,
  
  // ISA withdrawals are tax-free
  taxRate: 0
};

export const PROJECTION_DEFAULTS = {
  // Growth rates (real, after inflation)
  defaultGrowthRate: 0.04, // 4% real growth
  conservativeGrowthRate: 0.02,
  aggressiveGrowthRate: 0.06,
  
  // Inflation assumption
  inflationRate: 0.02, // 2% long-term
  
  // Investment fees
  defaultFeeRate: 0.005, // 0.5% annual management charge
  
  // Withdrawal rate assumptions
  safeWithdrawalRate: 0.04, // 4% rule baseline
  
  // Life expectancy assumptions
  defaultLifeExpectancy: 90,
  
  // Monte Carlo settings
  monteCarloIterations: 1000,
  volatility: 0.15 // Standard deviation of returns
};

export const CONTRIBUTION_TIMING = {
  // When contributions are assumed to be made
  START_OF_YEAR: 'start',
  END_OF_YEAR: 'end',
  MONTHLY: 'monthly'
};

/**
 * Create a complete assumptions object with all configurable values
 */
export function createAssumptions(overrides = {}) {
  return {
    tax: { ...TAX_CONFIG, ...overrides.tax },
    pension: { ...PENSION_CONFIG, ...overrides.pension },
    isa: { ...ISA_CONFIG, ...overrides.isa },
    projection: { ...PROJECTION_DEFAULTS, ...overrides.projection },
    contributionTiming: overrides.contributionTiming || CONTRIBUTION_TIMING.END_OF_YEAR
  };
}

/**
 * Get current tax year info
 */
export function getCurrentTaxYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();
  
  // UK tax year runs 6 April to 5 April
  if (month < 3 || (month === 3 && day < 6)) {
    return {
      start: year - 1,
      end: year,
      label: `${year - 1}/${year.toString().slice(-2)}`
    };
  }
  return {
    start: year,
    end: year + 1,
    label: `${year}/${(year + 1).toString().slice(-2)}`
  };
}
