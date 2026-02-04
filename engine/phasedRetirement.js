/**
 * RetireLens 2 - Phased Retirement Engine
 * 
 * Pure functions for modeling phased/partial retirement scenarios.
 * Allows gradual transition from full-time work to full retirement.
 */

import { calculateTaxFromGross } from './tax.js';
import { PENSION_CONFIG } from '../config/defaults.js';

/**
 * Create a phased retirement configuration
 * 
 * @param {object} params - Configuration parameters
 * @returns {object} Phased retirement state
 */
export function createPhasedRetirement(params) {
  const {
    phasedStartAge,
    phasedEndAge,
    partTimeIncome,
    reducedContributions = 0,
    fullTimeIncome = 0
  } = params;
  
  if (!phasedStartAge || !phasedEndAge) {
    throw new Error('Phased start and end ages are required');
  }
  
  if (phasedEndAge <= phasedStartAge) {
    throw new Error('Phased end age must be after start age');
  }
  
  if (partTimeIncome < 0) {
    throw new Error('Part-time income must be non-negative');
  }
  
  if (reducedContributions < 0) {
    throw new Error('Contributions must be non-negative');
  }
  
  const phasedDuration = phasedEndAge - phasedStartAge;
  const incomeReductionPercentage = fullTimeIncome > 0 
    ? ((fullTimeIncome - partTimeIncome) / fullTimeIncome) * 100 
    : 0;
  
  return {
    phasedStartAge,
    phasedEndAge,
    phasedDuration,
    partTimeIncome,
    reducedContributions,
    fullTimeIncome,
    incomeReductionPercentage,
    isActive: true
  };
}

/**
 * Calculate net part-time income after tax
 * 
 * @param {number} grossPartTimeIncome - Gross part-time income
 * @param {object} taxConfig - Tax configuration
 * @returns {object} Net income breakdown
 */
export function calculatePartTimeNet(grossPartTimeIncome, taxConfig) {
  const taxResult = calculateTaxFromGross(grossPartTimeIncome, taxConfig);
  
  return {
    grossIncome: grossPartTimeIncome,
    tax: taxResult.totalTax,
    netIncome: grossPartTimeIncome - taxResult.totalTax,
    effectiveTaxRate: taxResult.effectiveRate
  };
}

/**
 * Calculate pension pot impact of phased retirement
 * 
 * @param {object} phasedConfig - Phased retirement configuration
 * @param {number} originalContributions - Original full-time contributions
 * @param {number} growthRate - Annual growth rate
 * @returns {object} Impact analysis
 */
export function calculatePhasedRetirementImpact(phasedConfig, originalContributions, growthRate = 0.04) {
  const { phasedDuration, reducedContributions } = phasedConfig;
  
  // Calculate foregone contributions
  const totalForegoneContributions = (originalContributions - reducedContributions) * phasedDuration;
  
  // Calculate future value of foregone contributions
  // Assuming contributions are made at start of each year
  let foregoneFutureValue = 0;
  for (let year = 0; year < phasedDuration; year++) {
    const yearsToGrow = phasedDuration - year;
    const contributionDifference = originalContributions - reducedContributions;
    foregoneFutureValue += contributionDifference * Math.pow(1 + growthRate, yearsToGrow);
  }
  
  // Calculate benefit of continued contributions
  let contributionsBenefitValue = 0;
  for (let year = 0; year < phasedDuration; year++) {
    const yearsToGrow = phasedDuration - year;
    contributionsBenefitValue += reducedContributions * Math.pow(1 + growthRate, yearsToGrow);
  }
  
  return {
    foregoneContributions: totalForegoneContributions,
    foregoneFutureValue,
    contributionsBenefitValue,
    netPotImpact: contributionsBenefitValue - foregoneFutureValue,
    percentageImpact: originalContributions > 0 
      ? (foregoneFutureValue / (originalContributions * phasedDuration * Math.pow(1 + growthRate, phasedDuration / 2))) * 100
      : 0
  };
}

/**
 * Calculate total income during phased retirement period
 * 
 * @param {object} phasedConfig - Phased retirement configuration
 * @param {object} options - Additional options
 * @returns {object} Total income analysis
 */
export function calculatePhasedIncome(phasedConfig, options = {}) {
  const {
    partTimeIncome,
    phasedDuration
  } = phasedConfig;
  
  const {
    pensionWithdrawals = 0,
    isaWithdrawals = 0,
    statePensionEligible = false,
    statePensionAmount = 0
  } = options;
  
  const totalPartTimeIncome = partTimeIncome * phasedDuration;
  const totalPensionWithdrawals = pensionWithdrawals * phasedDuration;
  const totalIsaWithdrawals = isaWithdrawals * phasedDuration;
  const totalStatePension = statePensionEligible ? statePensionAmount * phasedDuration : 0;
  
  const grandTotal = totalPartTimeIncome + totalPensionWithdrawals + totalIsaWithdrawals + totalStatePension;
  
  return {
    totalPartTimeIncome,
    totalPensionWithdrawals,
    totalIsaWithdrawals,
    totalStatePension,
    grandTotal,
    averageAnnualIncome: grandTotal / phasedDuration
  };
}

/**
 * Calculate quality of life benefits of phased retirement
 * 
 * @param {object} phasedConfig - Phased retirement configuration
 * @param {object} fullRetirementPlan - Full retirement comparison plan
 * @returns {object} Benefits analysis
 */
export function calculatePhasedBenefits(phasedConfig, fullRetirementPlan) {
  const { phasedDuration, partTimeIncome } = phasedConfig;
  
  // Additional income from part-time work
  const additionalIncome = partTimeIncome * phasedDuration;
  
  // Delayed full retirement means less pension drawdown
  const delayedYears = phasedDuration;
  
  // Social and health benefits (qualitative)
  const benefits = {
    additionalIncome,
    delayedYears,
    financialBenefit: `Working part-time for ${phasedDuration} years generates £${additionalIncome.toLocaleString('en-GB')} additional income`,
    pensionBenefit: `Delaying full retirement by ${delayedYears} years reduces pension drawdown pressure`,
    socialBenefit: 'Maintains social connections and routine',
    healthBenefit: 'Gradual transition may support better health outcomes',
    skillsBenefit: 'Keeps skills and professional networks active'
  };
  
  return benefits;
}

/**
 * Check if an age is within the phased retirement period
 * 
 * @param {number} age - Age to check
 * @param {object} phasedConfig - Phased retirement configuration (can be null)
 * @returns {boolean} True if age is in phased period
 */
export function isInPhasedPeriod(age, phasedConfig) {
  if (!phasedConfig || !phasedConfig.isActive) {
    return false;
  }
  
  return age >= phasedConfig.phasedStartAge && age < phasedConfig.phasedEndAge;
}

/**
 * Get income and contributions for a specific age
 * 
 * @param {number} age - Current age
 * @param {object} phasedConfig - Phased retirement configuration
 * @param {object} baseValues - Base full-time values { income, contributions }
 * @returns {object} Age-appropriate values
 */
export function getValuesForAge(age, phasedConfig, baseValues) {
  if (!isInPhasedPeriod(age, phasedConfig)) {
    return {
      income: 0,
      contributions: 0,
      isWorking: age < phasedConfig?.phasedStartAge,
      isFullyRetired: age >= (phasedConfig?.phasedEndAge || 0)
    };
  }
  
  return {
    income: phasedConfig.partTimeIncome,
    contributions: phasedConfig.reducedContributions,
    isWorking: true,
    isPartTime: true,
    isFullyRetired: false
  };
}

/**
 * Project pension pot with phased retirement
 * 
 * @param {object} params - Projection parameters
 * @returns {Array} Year-by-year projection
 */
export function projectWithPhasedRetirement(params) {
  const {
    currentAge,
    currentPot,
    phasedConfig,
    fullTimeContributions,
    retirementAge,
    growthRate = 0.04
  } = params;
  
  const projection = [];
  let pot = currentPot;
  
  for (let age = currentAge; age < retirementAge; age++) {
    const values = getValuesForAge(age, phasedConfig, {
      contributions: fullTimeContributions
    });
    
    const contributions = values.isWorking && age < (phasedConfig?.phasedStartAge || retirementAge)
      ? fullTimeContributions
      : values.contributions;
    
    pot = pot * (1 + growthRate) + contributions;
    
    projection.push({
      age,
      pot,
      contributions,
      income: values.income,
      isPartTime: values.isPartTime || false,
      isFullyRetired: values.isFullyRetired
    });
  }
  
  return projection;
}

/**
 * Validate phased retirement configuration
 * 
 * @param {object} phasedConfig - Configuration to validate
 * @param {object} context - Additional context { currentAge, fullRetirementAge }
 * @returns {object} Validation result with { valid, errors }
 */
export function validatePhasedRetirement(phasedConfig, context = {}) {
  const errors = [];
  
  if (!phasedConfig) {
    return { valid: true, errors: [] }; // Phased retirement is optional
  }
  
  const { phasedStartAge, phasedEndAge, partTimeIncome, reducedContributions } = phasedConfig;
  const { currentAge, fullRetirementAge } = context;
  
  if (currentAge && phasedStartAge < currentAge) {
    errors.push('Phased retirement start age must be in the future');
  }
  
  if (phasedStartAge < PENSION_CONFIG.minPensionAge) {
    errors.push(`Phased retirement cannot start before minimum pension age (${PENSION_CONFIG.minPensionAge})`);
  }
  
  if (phasedEndAge <= phasedStartAge) {
    errors.push('Phased retirement end age must be after start age');
  }
  
  if (fullRetirementAge && phasedEndAge > fullRetirementAge + 10) {
    errors.push('Phased retirement end age seems unreasonably late');
  }
  
  if (partTimeIncome < 0) {
    errors.push('Part-time income must be non-negative');
  }
  
  if (reducedContributions < 0) {
    errors.push('Contributions must be non-negative');
  }
  
  if (phasedEndAge - phasedStartAge > 20) {
    errors.push('Phased retirement period should not exceed 20 years');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
