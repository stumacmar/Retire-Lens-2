/**
 * RetireLens 2 - Spending Policy Module
 * 
 * Models lifecycle spending behaviour including:
 * - Age-based spending reductions (go-go, slow-go, no-go phases)
 * - One-off expenses (car purchases, home repairs, etc.)
 * - Bequest motives (minimum amount to leave behind)
 * 
 * Research shows retirement spending typically declines with age:
 * - Active phase (65-79): Full spending
 * - Slower phase (80-89): Reduced spending (~15% less)
 * - Final phase (90+): Further reduced (~25% less)
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
 * @returns {object} Frozen spending rules object
 * 
 * @example
 * const rules = createSpendingRules({
 *   baseSpending: 35000,
 *   applyDefaultReductions: true,
 *   oneOffExpenses: [
 *     { age: 70, amount: 25000, description: 'New car' }
 *   ],
 *   minimumBequest: 50000
 * });
 */
export function createSpendingRules(options = {}) {
  const rules = {
    baseSpending: options.baseSpending || 30000,
    ageAdjustments: options.ageAdjustments || [],
    applyDefaultReductions: options.applyDefaultReductions !== false,
    oneOffExpenses: (options.oneOffExpenses || []).map(exp => Object.freeze({
      age: exp.age,
      amount: exp.amount,
      description: exp.description || 'One-off expense'
    })),
    minimumBequest: options.minimumBequest || 0
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
 * Calculate total spending for a year including one-off expenses
 * 
 * @param {object} spendingRules - Spending rules object
 * @param {number} age - Current age
 * @returns {object} { regular: number, oneOff: number, total: number }
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
  
  return {
    regular,
    oneOff,
    total: regular + oneOff
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
  
  return {
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
