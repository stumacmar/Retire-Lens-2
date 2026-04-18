/**
 * RetireLens 2 - User-Configurable Assumptions Module
 * 
 * Provides user control over economic assumptions used in projections.
 * Supports scenario presets and custom overrides.
 * 
 * All rates are annual decimals (0.04 = 4%)
 * 
 * Key concepts:
 * - Real returns: After inflation (purchasing power preserved)
 * - Nominal returns: Before inflation adjustment
 * - Pre-retirement: Typically higher equity allocation = higher growth/volatility
 * - Post-retirement: Typically lower risk = lower growth/volatility
 */

/**
 * Default economic assumptions
 * These are reasonable mid-range values for UK retirement planning.
 * 
 * Pre-retirement assumes 80/20 equity/bond allocation
 * Post-retirement assumes 60/40 equity/bond allocation (de-risked)
 */
export const DEFAULT_ASSUMPTIONS = Object.freeze({
  // Pre-retirement investment returns (real, after inflation)
  preRetirementReturn: 0.045,   // 4.5% real growth (higher equity allocation)
  preRetirementVolatility: 0.16, // 16% standard deviation
  
  // Post-retirement investment returns (real, after inflation)
  postRetirementReturn: 0.035,  // 3.5% real growth (de-risked allocation)
  postRetirementVolatility: 0.12, // 12% standard deviation
  
  // Legacy single growth rate (for backward compatibility)
  growthRate: 0.04,            // 4% real growth (blended default)
  
  // Economic assumptions
  inflationRate: 0.02,         // 2% long-term inflation (BoE target)
  volatility: 0.15,            // 15% standard deviation (blended default)
  feeRate: 0.005,              // 0.5% annual investment fees
  
  // Display mode
  useRealReturns: true,        // true = real (after inflation), false = nominal
  usePhaseBasedReturns: false, // true = use pre/post retirement rates, false = single rate
  
  // Scenario label
  scenario: 'moderate'
});

/**
 * Scenario presets for quick selection
 * 
 * Conservative: Lower growth, higher volatility - pessimistic view
 * Moderate: Balanced assumptions - reasonable base case
 * Optimistic: Higher growth, lower volatility - best case scenario
 * 
 * Each preset includes both single-rate and phase-based returns
 */
export const SCENARIO_PRESETS = Object.freeze({
  conservative: {
    name: 'Below Average',
    description: 'Lower growth, higher volatility - pessimistic assumptions',
    // Single rate (legacy)
    growthRate: 0.03,
    volatility: 0.18,
    // Phase-based rates
    preRetirementReturn: 0.035,
    preRetirementVolatility: 0.20,
    postRetirementReturn: 0.025,
    postRetirementVolatility: 0.15,
    // Other
    inflationRate: 0.025,
    feeRate: 0.006,
    scenario: 'conservative'
  },
  moderate: {
    name: 'Average',
    description: 'Balanced assumptions - reasonable base case',
    // Single rate (legacy)
    growthRate: 0.04,
    volatility: 0.15,
    // Phase-based rates
    preRetirementReturn: 0.045,
    preRetirementVolatility: 0.16,
    postRetirementReturn: 0.035,
    postRetirementVolatility: 0.12,
    // Other
    inflationRate: 0.02,
    feeRate: 0.005,
    scenario: 'moderate'
  },
  optimistic: {
    name: 'Above Average',
    description: 'Strong market performance (UK equities have averaged ~5% real long-term)',
    growthRate: 0.06,
    volatility: 0.12,
    preRetirementReturn: 0.065,
    preRetirementVolatility: 0.14,
    postRetirementReturn: 0.05,
    postRetirementVolatility: 0.10,
    inflationRate: 0.02,
    feeRate: 0.004,
    scenario: 'optimistic'
  }
});

/**
 * Create user-configurable assumptions object
 * 
 * @param {object} overrides - User-specified values (any key from DEFAULT_ASSUMPTIONS)
 * @returns {object} Complete frozen assumptions object with derived values
 * 
 * @example
 * // Use defaults
 * const assumptions = createUserAssumptions();
 * 
 * @example
 * // Override specific values
 * const assumptions = createUserAssumptions({ growthRate: 0.03, feeRate: 0.01 });
 * 
 * @example
 * // Use phase-based returns
 * const assumptions = createUserAssumptions({ 
 *   usePhaseBasedReturns: true,
 *   preRetirementReturn: 0.05,
 *   postRetirementReturn: 0.03
 * });
 */
export function createUserAssumptions(overrides = {}) {
  const base = { ...DEFAULT_ASSUMPTIONS, ...overrides };
  
  // Validate ranges
  if (base.growthRate < -0.1 || base.growthRate > 0.15) {
    console.warn('Growth rate outside typical range (-10% to 15%)');
  }
  if (base.volatility < 0 || base.volatility > 0.5) {
    console.warn('Volatility outside typical range (0% to 50%)');
  }
  if (base.feeRate < 0 || base.feeRate > 0.05) {
    console.warn('Fee rate outside typical range (0% to 5%)');
  }
  
  // Calculate derived values
  const netGrowthRate = base.growthRate - base.feeRate;
  const nominalGrowthRate = base.growthRate + base.inflationRate;
  
  // Phase-based derived values
  const netPreRetirementReturn = base.preRetirementReturn - base.feeRate;
  const netPostRetirementReturn = base.postRetirementReturn - base.feeRate;
  
  return Object.freeze({
    ...base,
    netGrowthRate,
    nominalGrowthRate,
    netPreRetirementReturn,
    netPostRetirementReturn
  });
}

/**
 * Get effective return rate for a given phase
 * 
 * @param {object} assumptions - Assumptions object
 * @param {string} phase - 'accumulation' | 'decumulation'
 * @returns {number} Effective return rate to use
 */
export function getEffectiveReturn(assumptions, phase) {
  if (!assumptions.usePhaseBasedReturns) {
    return assumptions.netGrowthRate;
  }
  
  if (phase === 'accumulation') {
    return assumptions.netPreRetirementReturn;
  } else {
    return assumptions.netPostRetirementReturn;
  }
}

/**
 * Get effective volatility for a given phase
 * 
 * @param {object} assumptions - Assumptions object
 * @param {string} phase - 'accumulation' | 'decumulation'
 * @returns {number} Effective volatility to use
 */
export function getEffectiveVolatility(assumptions, phase) {
  if (!assumptions.usePhaseBasedReturns) {
    return assumptions.volatility;
  }
  
  if (phase === 'accumulation') {
    return assumptions.preRetirementVolatility;
  } else {
    return assumptions.postRetirementVolatility;
  }
}

/**
 * Convert between real and nominal values
 * 
 * @param {number} realValue - Value in real terms
 * @param {number} years - Number of years
 * @param {number} inflationRate - Annual inflation rate
 * @returns {number} Nominal value
 */
export function realToNominal(realValue, years, inflationRate) {
  return realValue * Math.pow(1 + inflationRate, years);
}

/**
 * Convert nominal to real values
 * 
 * @param {number} nominalValue - Value in nominal terms
 * @param {number} years - Number of years
 * @param {number} inflationRate - Annual inflation rate
 * @returns {number} Real value
 */
export function nominalToReal(nominalValue, years, inflationRate) {
  return nominalValue / Math.pow(1 + inflationRate, years);
}

/**
 * Apply a scenario preset
 * 
 * @param {string} scenario - 'conservative' | 'moderate' | 'optimistic'
 * @returns {object} Assumptions object for that scenario
 * @throws {Error} If scenario name is not recognized
 * 
 * @example
 * const assumptions = applyScenarioPreset('conservative');
 */
export function applyScenarioPreset(scenario) {
  const preset = SCENARIO_PRESETS[scenario];
  
  if (!preset) {
    throw new Error(`Unknown scenario: ${scenario}. Use 'conservative', 'moderate', or 'optimistic'.`);
  }
  
  return createUserAssumptions(preset);
}

/**
 * Get assumptions summary for display
 * 
 * @param {object} assumptions - Assumptions object
 * @returns {object} Human-readable summary
 */
export function getAssumptionsSummary(assumptions) {
  const summary = {
    growthRate: `${(assumptions.growthRate * 100).toFixed(1)}%`,
    inflationRate: `${(assumptions.inflationRate * 100).toFixed(1)}%`,
    volatility: `${(assumptions.volatility * 100).toFixed(0)}%`,
    feeRate: `${(assumptions.feeRate * 100).toFixed(2)}%`,
    netGrowthRate: `${(assumptions.netGrowthRate * 100).toFixed(2)}%`,
    scenario: assumptions.scenario || 'custom',
    useRealReturns: assumptions.useRealReturns,
    usePhaseBasedReturns: assumptions.usePhaseBasedReturns
  };
  
  // Add phase-based details if enabled
  if (assumptions.usePhaseBasedReturns) {
    summary.preRetirementReturn = `${(assumptions.preRetirementReturn * 100).toFixed(1)}%`;
    summary.postRetirementReturn = `${(assumptions.postRetirementReturn * 100).toFixed(1)}%`;
    summary.preRetirementVolatility = `${(assumptions.preRetirementVolatility * 100).toFixed(0)}%`;
    summary.postRetirementVolatility = `${(assumptions.postRetirementVolatility * 100).toFixed(0)}%`;
  }
  
  return summary;
}

/**
 * Validate assumptions object
 * 
 * @param {object} assumptions - Assumptions to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateAssumptions(assumptions) {
  const errors = [];
  
  if (typeof assumptions.growthRate !== 'number') {
    errors.push('growthRate must be a number');
  }
  if (typeof assumptions.volatility !== 'number' || assumptions.volatility < 0) {
    errors.push('volatility must be a non-negative number');
  }
  if (typeof assumptions.feeRate !== 'number' || assumptions.feeRate < 0) {
    errors.push('feeRate must be a non-negative number');
  }
  if (typeof assumptions.inflationRate !== 'number') {
    errors.push('inflationRate must be a number');
  }
  
  // Validate phase-based returns if enabled
  if (assumptions.usePhaseBasedReturns) {
    if (typeof assumptions.preRetirementReturn !== 'number') {
      errors.push('preRetirementReturn must be a number when usePhaseBasedReturns is true');
    }
    if (typeof assumptions.postRetirementReturn !== 'number') {
      errors.push('postRetirementReturn must be a number when usePhaseBasedReturns is true');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get documented defaults with explanations
 * Useful for UI help text and tooltips
 * 
 * @returns {object} Documented defaults with explanations
 */
export function getDocumentedDefaults() {
  return {
    growthRate: {
      value: DEFAULT_ASSUMPTIONS.growthRate,
      label: 'Real Growth Rate',
      description: 'Expected annual return after inflation',
      rationale: 'Based on long-term equity/bond blend returns of 4-5% real'
    },
    inflationRate: {
      value: DEFAULT_ASSUMPTIONS.inflationRate,
      label: 'Inflation Rate',
      description: 'Long-term inflation assumption',
      rationale: 'Bank of England 2% target rate'
    },
    volatility: {
      value: DEFAULT_ASSUMPTIONS.volatility,
      label: 'Volatility (σ)',
      description: 'Standard deviation of annual returns for Monte Carlo',
      rationale: 'Typical for 60/40 portfolio based on historical data'
    },
    feeRate: {
      value: DEFAULT_ASSUMPTIONS.feeRate,
      label: 'Annual Fees',
      description: 'Total investment management fees',
      rationale: 'Low-cost index fund/ETF assumption'
    },
    preRetirementReturn: {
      value: DEFAULT_ASSUMPTIONS.preRetirementReturn,
      label: 'Pre-Retirement Return',
      description: 'Expected return before retirement (higher equity)',
      rationale: 'Assumes 80/20 equity/bond allocation'
    },
    postRetirementReturn: {
      value: DEFAULT_ASSUMPTIONS.postRetirementReturn,
      label: 'Post-Retirement Return',
      description: 'Expected return in retirement (de-risked)',
      rationale: 'Assumes 60/40 equity/bond allocation'
    }
  };
}
