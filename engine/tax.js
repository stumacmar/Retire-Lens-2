/**
 * RetireLens 2 - Tax Calculation Engine
 * 
 * Pure functions for UK income tax calculations.
 * All functions are deterministic with no side effects.
 */

import { TAX_CONFIG } from '../config/defaults.js';

/**
 * Calculate personal allowance after taper
 * 
 * Personal allowance is reduced by £1 for every £2 of income over £100,000
 * until it reaches zero at £125,140
 * 
 * @param {number} grossIncome - Total gross income for the year
 * @param {object} config - Tax configuration (optional, defaults to current config)
 * @returns {number} Available personal allowance
 */
export function calculatePersonalAllowance(grossIncome, config = TAX_CONFIG) {
  const { personalAllowance, personalAllowanceTaperThreshold, personalAllowanceTaperRate } = config;
  
  if (grossIncome <= personalAllowanceTaperThreshold) {
    return personalAllowance;
  }
  
  const reduction = Math.floor((grossIncome - personalAllowanceTaperThreshold) * personalAllowanceTaperRate);
  return Math.max(0, personalAllowance - reduction);
}

/**
 * Calculate income tax on taxable income
 * 
 * @param {number} taxableIncome - Income after personal allowance
 * @param {object} config - Tax configuration (optional)
 * @returns {object} Tax breakdown by band
 */
export function calculateIncomeTax(taxableIncome, config = TAX_CONFIG) {
  if (taxableIncome <= 0) {
    return {
      total: 0,
      byBand: [],
      effectiveRate: 0
    };
  }

  const { bands } = config;
  const byBand = [];
  let remaining = taxableIncome;
  let total = 0;
  let previousThreshold = 0;

  for (const band of bands) {
    if (remaining <= 0) break;
    
    const bandWidth = band.threshold - previousThreshold;
    const taxableInBand = Math.min(remaining, bandWidth);
    const taxInBand = taxableInBand * band.rate;
    
    if (taxableInBand > 0) {
      byBand.push({
        name: band.name,
        taxableAmount: taxableInBand,
        rate: band.rate,
        tax: taxInBand
      });
      total += taxInBand;
    }
    
    remaining -= taxableInBand;
    previousThreshold = band.threshold;
  }

  return {
    total,
    byBand,
    effectiveRate: taxableIncome > 0 ? total / taxableIncome : 0
  };
}

/**
 * Calculate full tax liability from gross income
 * 
 * @param {number} grossIncome - Total gross income
 * @param {object} config - Tax configuration (optional)
 * @returns {object} Complete tax calculation breakdown
 */
export function calculateTaxFromGross(grossIncome, config = TAX_CONFIG) {
  const personalAllowance = calculatePersonalAllowance(grossIncome, config);
  const taxableIncome = Math.max(0, grossIncome - personalAllowance);
  const taxCalculation = calculateIncomeTax(taxableIncome, config);
  
  return {
    grossIncome,
    personalAllowance,
    taxableIncome,
    ...taxCalculation,
    netIncome: grossIncome - taxCalculation.total
  };
}

/**
 * Calculate gross income needed to achieve target net income
 * 
 * Uses iterative approximation to find gross amount.
 * This is the inverse of calculateTaxFromGross.
 * 
 * @param {number} targetNetIncome - Desired net income after tax
 * @param {object} config - Tax configuration (optional)
 * @param {number} maxIterations - Maximum iterations for convergence
 * @returns {object} Gross amount and tax breakdown
 */
export function calculateGrossFromNet(targetNetIncome, config = TAX_CONFIG, maxIterations = 20) {
  // Initial estimate: assume ~25% average tax rate
  let gross = targetNetIncome * 1.25;
  const tolerance = 0.01; // Within 1p
  
  for (let i = 0; i < maxIterations; i++) {
    const result = calculateTaxFromGross(gross, config);
    const difference = result.netIncome - targetNetIncome;
    
    if (Math.abs(difference) < tolerance) {
      return {
        grossRequired: Math.ceil(gross * 100) / 100,
        ...result
      };
    }
    
    // Adjust gross based on marginal rate
    const marginalRate = getMarginalRate(gross, config);
    gross -= difference / (1 - marginalRate);
  }
  
  // Return best estimate even if not converged
  const finalResult = calculateTaxFromGross(gross, config);
  return {
    grossRequired: Math.ceil(gross * 100) / 100,
    converged: false,
    ...finalResult
  };
}

/**
 * Get marginal tax rate at a given income level
 * 
 * @param {number} grossIncome - Current gross income
 * @param {object} config - Tax configuration (optional)
 * @returns {number} Marginal rate (decimal)
 */
export function getMarginalRate(grossIncome, config = TAX_CONFIG) {
  const personalAllowance = calculatePersonalAllowance(grossIncome, config);
  const taxableIncome = Math.max(0, grossIncome - personalAllowance);
  
  // Check if in taper zone (effective 60% rate)
  const { personalAllowanceTaperThreshold, bands } = config;
  if (grossIncome > personalAllowanceTaperThreshold && personalAllowance > 0) {
    // In the taper zone, effective marginal rate is higher
    // For every £2 earned, lose £1 of allowance (taxed at 40% = extra 20%)
    // Plus the 40% on the income itself = 60% effective rate
    return 0.60;
  }
  
  // Find the band this income falls into
  let previousThreshold = 0;
  for (const band of bands) {
    if (taxableIncome <= band.threshold) {
      return band.rate;
    }
    previousThreshold = band.threshold;
  }
  
  // Above all thresholds
  return bands[bands.length - 1].rate;
}

/**
 * Calculate National Insurance (simplified - future extension)
 * Note: NI is not typically paid on pension income, only on employment income
 * 
 * @param {number} earnings - Employment earnings
 * @returns {object} NI calculation
 */
export function calculateNationalInsurance(earnings) {
  // Class 1 NI thresholds 2024/25
  const primaryThreshold = 12570;
  const upperEarningsLimit = 50270;
  const mainRate = 0.08; // Reduced from 12% in Jan 2024
  const upperRate = 0.02;
  
  if (earnings <= primaryThreshold) {
    return { total: 0, byBand: [] };
  }
  
  let total = 0;
  const byBand = [];
  
  // Main rate band
  const mainBandEarnings = Math.min(earnings, upperEarningsLimit) - primaryThreshold;
  if (mainBandEarnings > 0) {
    const mainNI = mainBandEarnings * mainRate;
    byBand.push({ name: 'Main Rate', amount: mainBandEarnings, rate: mainRate, ni: mainNI });
    total += mainNI;
  }
  
  // Upper rate
  if (earnings > upperEarningsLimit) {
    const upperBandEarnings = earnings - upperEarningsLimit;
    const upperNI = upperBandEarnings * upperRate;
    byBand.push({ name: 'Upper Rate', amount: upperBandEarnings, rate: upperRate, ni: upperNI });
    total += upperNI;
  }
  
  return { total, byBand };
}
