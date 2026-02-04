/**
 * RetireLens 2 - Inflation Adjustment Engine
 * 
 * Pure functions for inflation-adjusting income goals.
 * Allows users to express income goals in "today's money" or "future money".
 */

import { PROJECTION_DEFAULTS } from '../config/defaults.js';

/**
 * Calculate future value of income adjusted for inflation
 * 
 * @param {number} todayIncome - Income in today's money
 * @param {number} years - Years until retirement
 * @param {number} inflationRate - Annual inflation rate (default 2.5%)
 * @returns {number} Future value of income
 */
export function calculateFutureIncome(todayIncome, years, inflationRate = 0.025) {
  if (todayIncome < 0) {
    throw new Error('Income must be non-negative');
  }
  if (years < 0) {
    throw new Error('Years must be non-negative');
  }
  if (inflationRate < 0 || inflationRate > 0.2) {
    throw new Error('Inflation rate must be between 0% and 20%');
  }
  
  return todayIncome * Math.pow(1 + inflationRate, years);
}

/**
 * Calculate present value of future income
 * 
 * @param {number} futureIncome - Income in future money
 * @param {number} years - Years until retirement
 * @param {number} inflationRate - Annual inflation rate (default 2.5%)
 * @returns {number} Present value of income
 */
export function calculatePresentIncome(futureIncome, years, inflationRate = 0.025) {
  if (futureIncome < 0) {
    throw new Error('Income must be non-negative');
  }
  if (years < 0) {
    throw new Error('Years must be non-negative');
  }
  if (inflationRate < 0 || inflationRate > 0.2) {
    throw new Error('Inflation rate must be between 0% and 20%');
  }
  
  return futureIncome / Math.pow(1 + inflationRate, years);
}

/**
 * Create inflation-adjusted income configuration
 * 
 * @param {object} params - Configuration parameters
 * @returns {object} Inflation-adjusted income state
 */
export function createInflationAdjustedIncome(params) {
  const {
    income,
    isInTodaysMoney = true,
    currentAge,
    retirementAge,
    inflationRate = 0.025
  } = params;
  
  if (!income || income < 0) {
    throw new Error('Valid income amount required');
  }
  if (!currentAge || !retirementAge || retirementAge < currentAge) {
    throw new Error('Valid ages required');
  }
  
  const yearsToRetirement = retirementAge - currentAge;
  
  let todayIncome, futureIncome;
  
  if (isInTodaysMoney) {
    todayIncome = income;
    futureIncome = calculateFutureIncome(income, yearsToRetirement, inflationRate);
  } else {
    futureIncome = income;
    todayIncome = calculatePresentIncome(income, yearsToRetirement, inflationRate);
  }
  
  return {
    todayIncome,
    futureIncome,
    yearsToRetirement,
    inflationRate,
    isInTodaysMoney
  };
}

/**
 * Format inflation-adjusted income for display
 * 
 * @param {object} adjustedIncome - Output from createInflationAdjustedIncome
 * @param {number} retirementYear - The year of retirement
 * @returns {string} Formatted display string
 */
export function formatInflationDisplay(adjustedIncome, retirementYear) {
  const { todayIncome, futureIncome } = adjustedIncome;
  
  const todayFormatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(todayIncome);
  
  const futureFormatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(futureIncome);
  
  return `${todayFormatted} in today's money = ${futureFormatted} in ${retirementYear}`;
}

/**
 * Calculate the inflation impact over time
 * 
 * @param {number} baseAmount - Starting amount
 * @param {number} maxYears - Maximum years to project
 * @param {number} inflationRate - Annual inflation rate
 * @returns {Array} Array of {year, todayValue, futureValue}
 */
export function calculateInflationSeries(baseAmount, maxYears, inflationRate = 0.025) {
  const series = [];
  
  for (let year = 0; year <= maxYears; year++) {
    series.push({
      year,
      todayValue: baseAmount,
      futureValue: calculateFutureIncome(baseAmount, year, inflationRate),
      purchasingPowerLoss: 1 - (1 / Math.pow(1 + inflationRate, year))
    });
  }
  
  return series;
}

/**
 * Adjust a complete plan for inflation preference
 * 
 * @param {object} plan - Plan state object
 * @param {boolean} useRealTerms - If true, use today's money; if false, use nominal terms
 * @returns {object} Adjusted plan
 */
export function adjustPlanForInflation(plan, useRealTerms = true) {
  const inflationRate = plan.assumptions?.inflationRate || PROJECTION_DEFAULTS.inflationRate;
  const yearsToRetirement = plan.retirementAge - plan.currentAge;
  
  if (useRealTerms) {
    // Already in real terms, no adjustment needed
    return {
      ...plan,
      inflationAdjustment: {
        mode: 'real',
        todayIncome: plan.targetNetIncome,
        futureIncome: calculateFutureIncome(plan.targetNetIncome, yearsToRetirement, inflationRate),
        yearsToRetirement,
        inflationRate
      }
    };
  } else {
    // Convert to nominal terms
    const futureIncome = calculateFutureIncome(plan.targetNetIncome, yearsToRetirement, inflationRate);
    
    return {
      ...plan,
      targetNetIncome: futureIncome,
      inflationAdjustment: {
        mode: 'nominal',
        todayIncome: plan.targetNetIncome,
        futureIncome,
        yearsToRetirement,
        inflationRate
      }
    };
  }
}

/**
 * Validate inflation adjustment parameters
 * 
 * @param {object} params - Parameters to validate
 * @returns {object} Validation result with { valid, errors }
 */
export function validateInflationAdjustment(params) {
  const errors = [];
  
  if (typeof params.income !== 'number' || params.income < 0) {
    errors.push('Income must be a non-negative number');
  }
  
  if (typeof params.currentAge !== 'number' || params.currentAge < 18 || params.currentAge > 100) {
    errors.push('Current age must be between 18 and 100');
  }
  
  if (typeof params.retirementAge !== 'number' || params.retirementAge < params.currentAge) {
    errors.push('Retirement age must be greater than current age');
  }
  
  if (params.inflationRate !== undefined) {
    if (typeof params.inflationRate !== 'number' || params.inflationRate < 0 || params.inflationRate > 0.2) {
      errors.push('Inflation rate must be between 0% and 20%');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
