/**
 * RetireLens 2 - Milestones Engine
 * 
 * Handles one-time expenses and major life goals during retirement.
 * Each milestone represents a significant financial event like:
 * - Dream holidays
 * - New car purchases
 * - Home renovations
 * - Helping children/grandchildren
 * - Other major expenses
 */

/**
 * Creates a new milestone
 * @param {object} milestone - Milestone configuration
 * @returns {object} Validated milestone object
 */
export function createMilestone(milestone) {
  const {
    id = generateMilestoneId(),
    description = '',
    age,
    amount,
    priority = 'nice-to-have',
    category = 'other',
    notes = ''
  } = milestone;

  // Validation
  if (!description || description.trim().length === 0) {
    throw new Error('Milestone description is required');
  }
  if (typeof age !== 'number' || age < 55 || age > 100) {
    throw new Error('Milestone age must be between 55 and 100');
  }
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Milestone amount must be positive');
  }
  if (!['essential', 'nice-to-have'].includes(priority)) {
    throw new Error('Priority must be "essential" or "nice-to-have"');
  }

  return {
    id,
    description: description.trim(),
    age,
    amount,
    priority,
    category,
    notes: notes.trim()
  };
}

/**
 * Generates a unique milestone ID
 */
function generateMilestoneId() {
  return `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Integrates milestones into spending rules
 * @param {Array} milestones - Array of milestone objects
 * @param {object} plan - The retirement plan
 * @returns {Array} Spending rules including milestone expenses
 */
export function integrateMilestonesIntoSpending(milestones, plan) {
  if (!milestones || milestones.length === 0) {
    return [];
  }

  // Filter milestones that occur during retirement
  const retirementMilestones = milestones.filter(m => 
    m.age >= plan.retirementAge && m.age <= 100
  );

  // Create one-off spending rules for each milestone
  return retirementMilestones.map(milestone => ({
    type: 'milestone',
    description: milestone.description,
    startAge: milestone.age,
    endAge: milestone.age,
    amount: milestone.amount,
    priority: milestone.priority,
    category: milestone.category,
    adjustForInflation: true,
    milestoneId: milestone.id
  }));
}

/**
 * Calculates the impact of milestones on sustainable income
 * @param {Array} milestones - Array of milestones
 * @param {object} plan - The retirement plan
 * @param {object} projection - Current projection results
 * @returns {object} Impact analysis
 */
export function calculateMilestoneImpact(milestones, plan, projection) {
  if (!milestones || milestones.length === 0) {
    return {
      totalCost: 0,
      avgAnnualImpact: 0,
      potImpact: 0,
      incomeReduction: 0,
      feasible: true,
      warnings: []
    };
  }

  const retirementMilestones = milestones.filter(m => 
    m.age >= plan.retirementAge && m.age <= 100
  );

  // Calculate total present value cost
  const totalCost = retirementMilestones.reduce((sum, m) => sum + m.amount, 0);
  
  // Calculate impact on pot
  const retirementDuration = 95 - plan.retirementAge;
  const avgAnnualImpact = totalCost / retirementDuration;

  // Estimate pot impact (rough approximation)
  const potImpact = totalCost * 1.2; // Account for lost growth

  // Calculate sustainable income reduction
  const withdrawalRate = 0.04;
  const incomeReduction = potImpact * withdrawalRate;

  // Check feasibility
  const warnings = [];
  const potAtRetirement = projection.years?.find(y => 
    y.age === plan.retirementAge)?.totalPot || 0;

  const impactRatio = potImpact / potAtRetirement;
  
  if (impactRatio > 0.3) {
    warnings.push({
      severity: 'high',
      message: `Milestones will consume ${(impactRatio * 100).toFixed(0)}% of your retirement pot. This significantly reduces sustainability.`
    });
  } else if (impactRatio > 0.15) {
    warnings.push({
      severity: 'medium',
      message: `Milestones will consume ${(impactRatio * 100).toFixed(0)}% of your retirement pot. Consider prioritizing essential milestones.`
    });
  }

  // Check for multiple milestones in same year
  const milestonesByYear = {};
  retirementMilestones.forEach(m => {
    if (!milestonesByYear[m.age]) milestonesByYear[m.age] = [];
    milestonesByYear[m.age].push(m);
  });

  Object.entries(milestonesByYear).forEach(([age, ms]) => {
    if (ms.length > 1) {
      const yearTotal = ms.reduce((sum, m) => sum + m.amount, 0);
      warnings.push({
        severity: 'medium',
        message: `Multiple milestones at age ${age} total £${(yearTotal / 1000).toFixed(0)}k. Consider spreading over multiple years.`
      });
    }
  });

  return {
    totalCost,
    avgAnnualImpact,
    potImpact,
    incomeReduction,
    feasible: impactRatio <= 0.3,
    warnings,
    impactRatio
  };
}

/**
 * Calculates success probability with Monte Carlo including milestones
 * @param {Array} milestones - Array of milestones
 * @param {object} plan - The retirement plan
 * @param {Function} runMonteCarloSimulation - Monte Carlo simulation function
 * @returns {object} Success probability analysis
 */
export function calculateMilestoneSuccessProbability(milestones, plan, runMonteCarloSimulation) {
  // Run baseline simulation without milestones
  const baselineResults = runMonteCarloSimulation(plan, { iterations: 1000 });

  // Create modified plan with milestones integrated
  const milestoneRules = integrateMilestonesIntoSpending(milestones, plan);
  const modifiedPlan = {
    ...plan,
    spendingRules: [...(plan.spendingRules || []), ...milestoneRules]
  };

  // Run simulation with milestones
  const withMilestonesResults = runMonteCarloSimulation(modifiedPlan, { iterations: 1000 });

  return {
    baselineSuccessRate: baselineResults.successRate,
    withMilestonesSuccessRate: withMilestonesResults.successRate,
    successRateDelta: baselineResults.successRate - withMilestonesResults.successRate,
    recommendation: getSuccessRateRecommendation(
      baselineResults.successRate,
      withMilestonesResults.successRate
    )
  };
}

/**
 * Gets recommendation based on success rate impact
 */
function getSuccessRateRecommendation(baseline, withMilestones) {
  const delta = baseline - withMilestones;

  if (withMilestones >= 80) {
    return {
      status: 'good',
      message: 'Your plan remains robust even with these milestones.'
    };
  } else if (withMilestones >= 65) {
    return {
      status: 'caution',
      message: 'Milestones reduce plan robustness. Consider deferring non-essential items.'
    };
  } else {
    return {
      status: 'warning',
      message: 'Milestones significantly impact plan sustainability. Reduce milestone spending or adjust income targets.'
    };
  }
}

/**
 * Gets milestone categories and their icons
 */
export function getMilestoneCategories() {
  return {
    travel: { icon: '✈️', label: 'Travel & Holidays' },
    vehicle: { icon: '🚗', label: 'Vehicle Purchase' },
    home: { icon: '🏠', label: 'Home Improvement' },
    family: { icon: '👨‍👩‍👧', label: 'Family Support' },
    health: { icon: '🏥', label: 'Healthcare' },
    celebration: { icon: '🎉', label: 'Celebration' },
    other: { icon: '📌', label: 'Other' }
  };
}

/**
 * Validates a collection of milestones
 * @param {Array} milestones - Array of milestones
 * @returns {object} Validation result with warnings
 */
export function validateMilestones(milestones) {
  const warnings = [];
  const errors = [];

  if (!Array.isArray(milestones)) {
    errors.push('Milestones must be an array');
    return { valid: false, errors, warnings };
  }

  // Check total cost
  const totalCost = milestones.reduce((sum, m) => sum + m.amount, 0);
  if (totalCost > 500000) {
    warnings.push('Total milestone cost exceeds £500k. This may significantly impact plan sustainability.');
  }

  // Check for milestones at very advanced ages
  const lateAgeMilestones = milestones.filter(m => m.age > 85);
  if (lateAgeMilestones.length > 0) {
    warnings.push(`${lateAgeMilestones.length} milestone(s) scheduled after age 85. Consider earlier timing for flexibility.`);
  }

  // Check for very expensive individual milestones
  const expensiveMilestones = milestones.filter(m => m.amount > 100000);
  if (expensiveMilestones.length > 0) {
    warnings.push(`${expensiveMilestones.length} milestone(s) exceed £100k. Ensure pot can accommodate these major expenses.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sorts milestones by age
 */
export function sortMilestonesByAge(milestones) {
  return [...milestones].sort((a, b) => a.age - b.age);
}

/**
 * Filters milestones by priority
 */
export function filterMilestonesByPriority(milestones, priority) {
  return milestones.filter(m => m.priority === priority);
}

/**
 * Gets milestones within an age range
 */
export function getMilestonesInRange(milestones, startAge, endAge) {
  return milestones.filter(m => m.age >= startAge && m.age <= endAge);
}
