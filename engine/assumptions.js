/**
 * RetireLens 2 - User-Configurable Assumptions Module
 * 
 * Provides user control over economic assumptions used in projections.
 * Supports scenario presets and custom overrides.
 * 
 * All rates are annual decimals (0.04 = 4%)
 */

/**
 * Default economic assumptions
 * These are reasonable mid-range values for UK retirement planning.
 */
export const DEFAULT_ASSUMPTIONS = Object.freeze({
  // Investment returns (real, after inflation)
  growthRate: 0.04,           // 4% real growth
  inflationRate: 0.02,        // 2% long-term inflation
  volatility: 0.15,           // 15% standard deviation
  feeRate: 0.005,             // 0.5% annual investment fees
  
  // Scenario label
  scenario: 'moderate'
});

/**
 * Scenario presets for quick selection
 * 
 * Conservative: Lower growth, higher volatility - pessimistic view
 * Moderate: Balanced assumptions - reasonable base case
 * Optimistic: Higher growth, lower volatility - best case scenario
 */
export const SCENARIO_PRESETS = Object.freeze({
  conservative: {
    name: 'Conservative',
    description: 'Lower growth, higher volatility - pessimistic assumptions',
    growthRate: 0.03,
    inflationRate: 0.025,
    volatility: 0.18,
    feeRate: 0.006,
    scenario: 'conservative'
  },
  moderate: {
    name: 'Moderate',
    description: 'Balanced assumptions - reasonable base case',
    growthRate: 0.04,
    inflationRate: 0.02,
    volatility: 0.15,
    feeRate: 0.005,
    scenario: 'moderate'
  },
  optimistic: {
    name: 'Optimistic',
    description: 'Higher growth, lower volatility - best case scenario',
    growthRate: 0.05,
    inflationRate: 0.02,
    volatility: 0.12,
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
  
  return Object.freeze({
    ...base,
    netGrowthRate,
    nominalGrowthRate
  });
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
  return {
    growthRate: `${(assumptions.growthRate * 100).toFixed(1)}%`,
    inflationRate: `${(assumptions.inflationRate * 100).toFixed(1)}%`,
    volatility: `${(assumptions.volatility * 100).toFixed(0)}%`,
    feeRate: `${(assumptions.feeRate * 100).toFixed(2)}%`,
    netGrowthRate: `${(assumptions.netGrowthRate * 100).toFixed(2)}%`,
    scenario: assumptions.scenario || 'custom'
  };
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
  
  return {
    valid: errors.length === 0,
    errors
  };
}
