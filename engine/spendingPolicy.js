/**
 * RetireLens 2 - Spending Policy Module
 * 
 * Models lifecycle spending behaviour including:
 * - Age-based spending reductions (go-go, slow-go, no-go phases)
 * - One-off expenses (car purchases, home repairs, etc.)
 * - Care cost shocks (late-life care scenarios)
 * - Bequest motives (minimum amount to leave behind)
 * 
 * Research shows retirement spending typically declines with age:
 * - Active phase (65-79): Full spending
 * - Slower phase (80-89): Reduced spending (~15% less)
 * - Final phase (90+): Further reduced (~25% less)
 * 
 * Care costs in the UK can be substantial:
 * - Residential care: £35,000-50,000/year
 * - Nursing care: £50,000-70,000/year
 * - Duration: Average 2-3 years, but can be 5+ years
 */

/**
 * Default age-based spending adjustments
 * Based on research showing natural decline in spending with age
 * 
 * Note: These are cumulative reduction percentages from base spending
 */
export const DEFAULT_AGE_ADJUSTMENTS = Object.freeze([
  { fromAge: 80, reductionPercent: 15, label: 'Slower phase (80+)' },
  { fromAge: 90, reductionPercent: 25, label: 'Final phase (90+)' }
]);

/**
 * Default care cost scenarios for UK
 * Based on Age UK and CMA research
 */
export const CARE_COST_SCENARIOS = Object.freeze({
  none: {
    id: 'none',
    name: 'No Care Costs',
    description: 'No additional care costs modelled',
    annualCost: 0,
    startAge: 0,
    duration: 0
  },
  moderate: {
    id: 'moderate',
    name: 'Moderate Care',
    description: 'Home care or residential care for 2 years',
    annualCost: 35000,
    startAge: 85,
    duration: 2
  },
  extended: {
    id: 'extended',
    name: 'Extended Care',
    description: 'Residential care for 4 years',
    annualCost: 45000,
    startAge: 85,
    duration: 4
  },
  intensive: {
    id: 'intensive',
    name: 'Intensive Nursing Care',
    description: 'Nursing home care for 3 years',
    annualCost: 60000,
    startAge: 85,
    duration: 3
  },
  custom: {
    id: 'custom',
    name: 'Custom Care Scenario',
    description: 'User-defined care costs',
    annualCost: 0,
    startAge: 85,
    duration: 0
  }
});

/**
 * Calculate spending at a given age, applying age-based reductions
 * 
 * @param {number} baseSpending - Target annual spending (net, in today's money)
 * @param {number} age - Age to calculate spending for
 * @param {object} options - Configuration options
 * @param {object[]} options.ageAdjustments - Custom age adjustments
 * @param {boolean} options.applyDefaultReductions - Whether to apply default reductions (default: true)
 * @returns {number} Adjusted spending for that age
 * 
 * @example
 * // Default reductions: -15% at 80, -25% at 90
 * calculateSpendingAtAge(30000, 75); // 30000 (no reduction)
 * calculateSpendingAtAge(30000, 82); // 25500 (-15%)
 * calculateSpendingAtAge(30000, 92); // 22500 (-25%)
 * 
 * @example
 * // Custom reductions
 * calculateSpendingAtAge(30000, 85, {
 *   ageAdjustments: [{ fromAge: 75, reductionPercent: 10 }]
 * }); // 27000 (-10%)
 */
export function calculateSpendingAtAge(baseSpending, age, options = {}) {
  const {
    ageAdjustments = [],
    applyDefaultReductions = true
  } = options;
  
  // Determine which adjustments to use
  const adjustments = ageAdjustments.length > 0
    ? ageAdjustments
    : (applyDefaultReductions ? DEFAULT_AGE_ADJUSTMENTS : []);
  
  // Find the maximum applicable reduction
  // Adjustments are not cumulative - take the highest applicable one
  let applicableReduction = 0;
  
  for (const adj of adjustments) {
    if (age >= adj.fromAge && adj.reductionPercent > applicableReduction) {
      applicableReduction = adj.reductionPercent;
    }
  }
  
  // Apply reduction
  return baseSpending * (1 - applicableReduction / 100);
}

/**
 * Create spending rules configuration
 * 
 * @param {object} options - Spending configuration
 * @param {number} options.baseSpending - Base annual spending target
 * @param {object[]} options.ageAdjustments - Custom age-based reductions
 * @param {boolean} options.applyDefaultReductions - Use default age reductions
 * @param {object[]} options.oneOffExpenses - One-time expenses
 * @param {number} options.minimumBequest - Minimum amount to leave behind
 * @param {string|object} options.careScenario - Care cost scenario ID or custom config
 * @returns {object} Frozen spending rules object
 * 
 * @example
 * const rules = createSpendingRules({
 *   baseSpending: 35000,
 *   applyDefaultReductions: true,
 *   oneOffExpenses: [
 *     { age: 70, amount: 25000, description: 'New car' }
 *   ],
 *   minimumBequest: 50000,
 *   careScenario: 'moderate'
 * });
 */
export function createSpendingRules(options = {}) {
  // Handle care scenario
  let careConfig = null;
  if (options.careScenario) {
    if (typeof options.careScenario === 'string') {
      // Preset scenario
      const preset = CARE_COST_SCENARIOS[options.careScenario];
      if (preset && preset.id !== 'none') {
        careConfig = { ...preset };
      }
    } else if (typeof options.careScenario === 'object') {
      // Custom scenario
      careConfig = {
        id: 'custom',
        name: options.careScenario.name || 'Custom Care',
        description: options.careScenario.description || 'Custom care costs',
        annualCost: options.careScenario.annualCost || 0,
        startAge: options.careScenario.startAge || 85,
        duration: options.careScenario.duration || 0
      };
    }
  }
  
  const rules = {
    baseSpending: options.baseSpending || 30000,
    ageAdjustments: options.ageAdjustments || [],
    applyDefaultReductions: options.applyDefaultReductions !== false,
    oneOffExpenses: (options.oneOffExpenses || []).map(exp => Object.freeze({
      age: exp.age,
      amount: exp.amount,
      description: exp.description || 'One-off expense'
    })),
    minimumBequest: options.minimumBequest || 0,
    careScenario: careConfig ? Object.freeze(careConfig) : null
  };
  
  return Object.freeze(rules);
}

/**
 * Get one-off expenses for a specific age
 * 
 * @param {object} spendingRules - Spending rules object
 * @param {number} age - Age to check
 * @returns {number} Total one-off expenses for that age
 */
export function getOneOffExpensesAtAge(spendingRules, age) {
  return spendingRules.oneOffExpenses
    .filter(exp => exp.age === age)
    .reduce((total, exp) => total + exp.amount, 0);
}

/**
 * Get care costs for a specific age
 * 
 * @param {object} spendingRules - Spending rules object
 * @param {number} age - Age to check
 * @returns {number} Care costs for that age (0 if outside care period)
 */
export function getCareCostsAtAge(spendingRules, age) {
  if (!spendingRules.careScenario) {
    return 0;
  }
  
  const { startAge, duration, annualCost } = spendingRules.careScenario;
  const endAge = startAge + duration;
  
  if (age >= startAge && age < endAge) {
    return annualCost;
  }
  
  return 0;
}

/**
 * Calculate total spending for a year including one-off expenses and care costs
 * 
 * @param {object} spendingRules - Spending rules object
 * @param {number} age - Current age
 * @returns {object} { regular: number, oneOff: number, care: number, total: number }
 */
export function calculateYearlySpending(spendingRules, age) {
  const regular = calculateSpendingAtAge(
    spendingRules.baseSpending,
    age,
    {
      ageAdjustments: spendingRules.ageAdjustments,
      applyDefaultReductions: spendingRules.applyDefaultReductions
    }
  );
  
  const oneOff = getOneOffExpensesAtAge(spendingRules, age);
  const care = getCareCostsAtAge(spendingRules, age);
  
  return {
    regular,
    oneOff,
    care,
    total: regular + oneOff + care
  };
}

/**
 * Get spending summary for display
 * 
 * @param {object} spendingRules - Spending rules object
 * @returns {object} Human-readable summary
 */
export function getSpendingRulesSummary(spendingRules) {
  const adjustments = spendingRules.applyDefaultReductions
    ? (spendingRules.ageAdjustments.length > 0 ? spendingRules.ageAdjustments : DEFAULT_AGE_ADJUSTMENTS)
    : spendingRules.ageAdjustments;
  
  const summary = {
    baseSpending: `£${spendingRules.baseSpending.toLocaleString()}`,
    hasAgeReductions: adjustments.length > 0,
    ageReductions: adjustments.map(adj => 
      `${adj.reductionPercent}% reduction from age ${adj.fromAge}`
    ),
    oneOffExpenses: spendingRules.oneOffExpenses.map(exp =>
      `£${exp.amount.toLocaleString()} at age ${exp.age} (${exp.description})`
    ),
    minimumBequest: spendingRules.minimumBequest > 0
      ? `£${spendingRules.minimumBequest.toLocaleString()}`
      : 'None'
  };
  
  // Add care scenario details
  if (spendingRules.careScenario) {
    summary.careScenario = {
      name: spendingRules.careScenario.name,
      description: spendingRules.careScenario.description,
      cost: `£${spendingRules.careScenario.annualCost.toLocaleString()}/year`,
      period: `Ages ${spendingRules.careScenario.startAge} to ${spendingRules.careScenario.startAge + spendingRules.careScenario.duration}`,
      totalCost: `£${(spendingRules.careScenario.annualCost * spendingRules.careScenario.duration).toLocaleString()}`
    };
  } else {
    summary.careScenario = null;
  }
  
  return summary;
}

/**
 * Get available care scenario options for UI
 * 
 * @returns {object[]} Array of care scenario options
 */
export function getCareScenarioOptions() {
  return Object.values(CARE_COST_SCENARIOS).map(scenario => ({
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    annualCost: scenario.annualCost,
    totalCost: scenario.annualCost * scenario.duration
  }));
}

/**
 * Validate spending rules
 * 
 * @param {object} spendingRules - Rules to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateSpendingRules(spendingRules) {
  const errors = [];
  
  if (typeof spendingRules.baseSpending !== 'number' || spendingRules.baseSpending <= 0) {
    errors.push('baseSpending must be a positive number');
  }
  
  for (const adj of spendingRules.ageAdjustments || []) {
    if (typeof adj.fromAge !== 'number' || adj.fromAge < 0) {
      errors.push('ageAdjustments.fromAge must be a non-negative number');
    }
    if (typeof adj.reductionPercent !== 'number' || adj.reductionPercent < 0 || adj.reductionPercent > 100) {
      errors.push('ageAdjustments.reductionPercent must be between 0 and 100');
    }
  }
  
  for (const exp of spendingRules.oneOffExpenses || []) {
    if (typeof exp.age !== 'number' || exp.age < 0) {
      errors.push('oneOffExpenses.age must be a non-negative number');
    }
    if (typeof exp.amount !== 'number' || exp.amount < 0) {
      errors.push('oneOffExpenses.amount must be a non-negative number');
    }
  }
  
  if (typeof spendingRules.minimumBequest !== 'number' || spendingRules.minimumBequest < 0) {
    errors.push('minimumBequest must be a non-negative number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
