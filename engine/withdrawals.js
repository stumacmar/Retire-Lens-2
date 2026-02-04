/**
 * RetireLens 2 - Withdrawal Strategy Engine
 * 
 * Pure functions for pension/ISA withdrawal calculations.
 * Implements UK-specific rules for PCLS, pension drawdown, and ISA withdrawals.
 */

import { calculateTaxFromGross, calculateGrossFromNet } from './tax.js';
import { PENSION_CONFIG, ISA_CONFIG, TAX_CONFIG } from '../config/defaults.js';

/**
 * Calculate Pension Commencement Lump Sum (PCLS / Tax-Free Cash)
 * 
 * @param {number} pensionValue - Total crystallised pension value
 * @param {number} rate - PCLS rate (default 25%)
 * @returns {object} PCLS breakdown
 */
export function calculatePCLS(pensionValue, rate = PENSION_CONFIG.pclsRate) {
  const taxFreeCash = pensionValue * rate;
  const remainingPension = pensionValue - taxFreeCash;
  
  return {
    pensionValue,
    taxFreeCash,
    remainingPension,
    rate
  };
}

/**
 * Calculate optimal withdrawal sequence for a given year
 * 
 * Priority order to minimize tax:
 * 1. Use Personal Allowance with pension income first
 * 2. Draw from ISA (tax-free) for amounts above PA
 * 3. Draw additional pension if ISA exhausted
 * 
 * @param {number} targetNetIncome - Desired annual net income
 * @param {object} balances - Current account balances { pension, isa }
 * @param {object} options - Additional options
 * @returns {object} Withdrawal plan and resulting balances
 */
export function calculateOptimalWithdrawal(targetNetIncome, balances, options = {}) {
  const {
    statePensionIncome = 0,
    otherTaxableIncome = 0,
    taxConfig = TAX_CONFIG
  } = options;
  
  // Income already received
  const existingTaxableIncome = statePensionIncome + otherTaxableIncome;
  const existingNetIncome = calculateTaxFromGross(existingTaxableIncome, taxConfig).netIncome;
  
  // How much more net income do we need?
  const additionalNetNeeded = Math.max(0, targetNetIncome - existingNetIncome);
  
  if (additionalNetNeeded === 0) {
    return createWithdrawalResult(0, 0, 0, balances, existingTaxableIncome, targetNetIncome, taxConfig);
  }
  
  // Personal allowance available after existing income
  const paUsed = Math.min(existingTaxableIncome, taxConfig.personalAllowance);
  const paRemaining = taxConfig.personalAllowance - paUsed;
  
  // Strategy: Fill up PA with pension first (taxed at 0%), then use ISA
  let pensionWithdrawal = 0;
  let isaWithdrawal = 0;
  let netFromPension = 0;
  let netFromIsa = 0;
  
  // Step 1: Use pension to fill Personal Allowance (tax-free portion)
  if (paRemaining > 0 && balances.pension > 0) {
    const pensionToPA = Math.min(paRemaining, balances.pension, additionalNetNeeded);
    pensionWithdrawal = pensionToPA;
    netFromPension = pensionToPA; // No tax within PA
  }
  
  let stillNeeded = additionalNetNeeded - netFromPension;
  
  // Step 2: Draw from ISA (always tax-free)
  if (stillNeeded > 0 && balances.isa > 0) {
    isaWithdrawal = Math.min(stillNeeded, balances.isa);
    netFromIsa = isaWithdrawal;
    stillNeeded -= netFromIsa;
  }
  
  // Step 3: Draw additional pension if still needed (will be taxed)
  if (stillNeeded > 0 && balances.pension > pensionWithdrawal) {
    const totalTaxableAfterPensionPA = existingTaxableIncome + pensionWithdrawal;
    
    // Calculate how much gross pension needed to get remaining net
    const grossNeeded = calculateGrossFromNet(
      stillNeeded + calculateTaxFromGross(totalTaxableAfterPensionPA, taxConfig).netIncome,
      taxConfig
    );
    
    const additionalPension = Math.min(
      grossNeeded.grossRequired - totalTaxableAfterPensionPA,
      balances.pension - pensionWithdrawal
    );
    
    if (additionalPension > 0) {
      pensionWithdrawal += additionalPension;
    }
  }
  
  // Calculate actual tax on combined income
  const totalTaxableIncome = existingTaxableIncome + pensionWithdrawal;
  const taxResult = calculateTaxFromGross(totalTaxableIncome, taxConfig);
  const actualNetIncome = taxResult.netIncome + isaWithdrawal;
  
  return createWithdrawalResult(
    pensionWithdrawal,
    isaWithdrawal,
    taxResult.total,
    balances,
    totalTaxableIncome,
    actualNetIncome,
    taxConfig
  );
}

/**
 * Create withdrawal result object
 */
function createWithdrawalResult(pensionWithdrawal, isaWithdrawal, taxPaid, originalBalances, totalTaxableIncome, netIncome, taxConfig) {
  return {
    withdrawals: {
      pension: pensionWithdrawal,
      isa: isaWithdrawal,
      total: pensionWithdrawal + isaWithdrawal
    },
    newBalances: {
      pension: originalBalances.pension - pensionWithdrawal,
      isa: originalBalances.isa - isaWithdrawal
    },
    taxPaid,
    totalTaxableIncome,
    netIncome,
    effectiveRate: totalTaxableIncome > 0 ? taxPaid / totalTaxableIncome : 0
  };
}

/**
 * Calculate withdrawal with pension-first strategy
 * (Alternative to optimal - use pension before ISA)
 * 
 * @param {number} targetNetIncome - Desired annual net income
 * @param {object} balances - Current account balances
 * @param {object} options - Additional options
 * @returns {object} Withdrawal result
 */
export function calculatePensionFirstWithdrawal(targetNetIncome, balances, options = {}) {
  const {
    statePensionIncome = 0,
    otherTaxableIncome = 0,
    taxConfig = TAX_CONFIG
  } = options;
  
  const existingIncome = statePensionIncome + otherTaxableIncome;
  const existingNet = calculateTaxFromGross(existingIncome, taxConfig).netIncome;
  const additionalNetNeeded = Math.max(0, targetNetIncome - existingNet);
  
  if (additionalNetNeeded === 0) {
    return createWithdrawalResult(0, 0, 0, balances, existingIncome, existingNet, taxConfig);
  }
  
  // Calculate gross pension needed for target net
  const targetTotalNet = existingNet + additionalNetNeeded;
  const grossResult = calculateGrossFromNet(targetTotalNet, taxConfig);
  const pensionNeeded = grossResult.grossRequired - existingIncome;
  
  let pensionWithdrawal = 0;
  let isaWithdrawal = 0;
  
  // Draw from pension first
  if (balances.pension >= pensionNeeded) {
    pensionWithdrawal = pensionNeeded;
  } else {
    // Use all pension, then ISA
    pensionWithdrawal = balances.pension;
    const netFromPension = calculateTaxFromGross(existingIncome + pensionWithdrawal, taxConfig).netIncome;
    isaWithdrawal = Math.min(
      targetNetIncome - netFromPension,
      balances.isa
    );
  }
  
  const totalTaxable = existingIncome + pensionWithdrawal;
  const taxResult = calculateTaxFromGross(totalTaxable, taxConfig);
  
  return createWithdrawalResult(
    pensionWithdrawal,
    isaWithdrawal,
    taxResult.total,
    balances,
    totalTaxable,
    taxResult.netIncome + isaWithdrawal,
    taxConfig
  );
}

/**
 * Calculate withdrawal with ISA-first strategy
 * (Preserve pension for later)
 * 
 * @param {number} targetNetIncome - Desired annual net income  
 * @param {object} balances - Current account balances
 * @param {object} options - Additional options
 * @returns {object} Withdrawal result
 */
export function calculateIsaFirstWithdrawal(targetNetIncome, balances, options = {}) {
  const {
    statePensionIncome = 0,
    otherTaxableIncome = 0,
    taxConfig = TAX_CONFIG
  } = options;
  
  const existingIncome = statePensionIncome + otherTaxableIncome;
  const existingNet = calculateTaxFromGross(existingIncome, taxConfig).netIncome;
  const additionalNetNeeded = Math.max(0, targetNetIncome - existingNet);
  
  if (additionalNetNeeded === 0) {
    return createWithdrawalResult(0, 0, 0, balances, existingIncome, existingNet, taxConfig);
  }
  
  let isaWithdrawal = 0;
  let pensionWithdrawal = 0;
  
  // Draw from ISA first (tax-free)
  if (balances.isa >= additionalNetNeeded) {
    isaWithdrawal = additionalNetNeeded;
  } else {
    // Use all ISA, then pension
    isaWithdrawal = balances.isa;
    const stillNeeded = additionalNetNeeded - isaWithdrawal;
    
    // Calculate gross pension for remaining need
    const currentNet = existingNet + isaWithdrawal;
    const targetWithPension = currentNet + stillNeeded;
    // We need net income of stillNeeded more, from pension
    // But pension income is taxable
    const grossNeeded = calculateGrossFromNet(existingNet + stillNeeded, taxConfig);
    pensionWithdrawal = Math.min(
      grossNeeded.grossRequired - existingIncome,
      balances.pension
    );
  }
  
  const totalTaxable = existingIncome + pensionWithdrawal;
  const taxResult = calculateTaxFromGross(totalTaxable, taxConfig);
  
  return createWithdrawalResult(
    pensionWithdrawal,
    isaWithdrawal,
    taxResult.total,
    balances,
    totalTaxable,
    taxResult.netIncome + isaWithdrawal,
    taxConfig
  );
}

/**
 * Calculate sustainable withdrawal rate
 * 
 * @param {number} portfolioValue - Total portfolio value
 * @param {number} years - Number of years to sustain
 * @param {number} realReturn - Expected real return (after inflation)
 * @returns {object} Sustainable withdrawal info
 */
export function calculateSustainableWithdrawal(portfolioValue, years, realReturn = 0.04) {
  // Using PMT formula for annuity
  // PMT = PV * (r * (1+r)^n) / ((1+r)^n - 1)
  
  if (realReturn === 0) {
    return {
      annualWithdrawal: portfolioValue / years,
      rate: 1 / years
    };
  }
  
  const r = realReturn;
  const n = years;
  const factor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const annualWithdrawal = portfolioValue * factor;
  
  return {
    annualWithdrawal: Math.round(annualWithdrawal * 100) / 100,
    rate: factor,
    portfolioValue,
    years,
    realReturn
  };
}

/**
 * Determine if PCLS should be taken and how much
 * 
 * @param {number} pensionValue - Pension pot value
 * @param {object} options - Strategy options
 * @returns {object} PCLS recommendation
 */
export function recommendPCLS(pensionValue, options = {}) {
  const {
    needsLumpSum = false,
    lumpSumAmount = 0,
    hasHigherRateTax = false
  } = options;
  
  const maxPCLS = pensionValue * PENSION_CONFIG.pclsRate;
  
  // If specific lump sum needed
  if (needsLumpSum && lumpSumAmount > 0) {
    const pclsToTake = Math.min(lumpSumAmount, maxPCLS);
    return {
      recommendation: 'partial',
      amount: pclsToTake,
      reason: `Take £${pclsToTake.toLocaleString()} to meet lump sum requirement`
    };
  }
  
  // If higher rate taxpayer, PCLS is usually beneficial
  if (hasHigherRateTax) {
    return {
      recommendation: 'full',
      amount: maxPCLS,
      reason: 'Take full PCLS to avoid 40%+ tax on this portion'
    };
  }
  
  // Default: consider taking PCLS if planning to draw down
  return {
    recommendation: 'consider',
    amount: maxPCLS,
    reason: 'Consider taking PCLS based on income needs and tax position'
  };
}

/**
 * PCLS Strategy types
 */
export const PCLS_STRATEGIES = {
  ALL_AT_RETIREMENT: 'all_at_retirement',
  PHASED: 'phased',
  DEFERRED: 'deferred'
};

/**
 * Calculate PCLS withdrawal schedule based on strategy
 * 
 * Strategies:
 * 1. ALL_AT_RETIREMENT - Take full 25% at retirement age
 * 2. PHASED - Spread PCLS over N years (default 5)
 * 3. DEFERRED - Defer until age X (e.g., state pension age)
 * 
 * @param {number} pensionValue - Total pension pot value at retirement
 * @param {object} options - Strategy configuration
 * @returns {object} PCLS schedule with year-by-year breakdown
 */
export function calculatePCLSStrategy(pensionValue, options = {}) {
  const {
    strategy = PCLS_STRATEGIES.ALL_AT_RETIREMENT,
    retirementAge = 60,
    phaseYears = 5,
    deferredAge = 67, // Default to state pension age
    reinvest = true,
    reinvestmentReturn = 0.04, // 4% real return for reinvested PCLS
    cashReturn = 0.0 // 0% for cash reserve
  } = options;
  
  const maxPCLS = pensionValue * PENSION_CONFIG.pclsRate;
  const schedule = [];
  
  // Ensure no NaN
  const safeMax = isNaN(maxPCLS) ? 0 : maxPCLS;
  
  switch (strategy) {
    case PCLS_STRATEGIES.ALL_AT_RETIREMENT:
      schedule.push({
        age: retirementAge,
        amount: safeMax,
        cumulative: safeMax,
        remaining: 0
      });
      break;
      
    case PCLS_STRATEGIES.PHASED:
      const annualPCLS = safeMax / phaseYears;
      let cumulative = 0;
      for (let i = 0; i < phaseYears; i++) {
        cumulative += annualPCLS;
        schedule.push({
          age: retirementAge + i,
          amount: annualPCLS,
          cumulative: cumulative,
          remaining: safeMax - cumulative
        });
      }
      break;
      
    case PCLS_STRATEGIES.DEFERRED:
      // Only include the actual PCLS event at the deferred age
      // No need for placeholder entries with amount: 0
      schedule.push({
        age: deferredAge,
        amount: safeMax,
        cumulative: safeMax,
        remaining: 0,
        deferredFrom: retirementAge // Track that this was deferred
      });
      break;
      
    default:
      // Default to all at retirement
      schedule.push({
        age: retirementAge,
        amount: safeMax,
        cumulative: safeMax,
        remaining: 0
      });
  }
  
  return {
    strategy,
    totalPCLS: safeMax,
    schedule,
    reinvest,
    reinvestmentReturn: reinvest ? reinvestmentReturn : cashReturn,
    settings: {
      retirementAge,
      phaseYears,
      deferredAge
    }
  };
}

/**
 * Project PCLS reinvestment growth over time
 * 
 * @param {object} pclsSchedule - Result from calculatePCLSStrategy
 * @param {number} endAge - Age to project until
 * @returns {object[]} Year-by-year PCLS balance (reinvested or cash)
 */
export function projectPCLSReinvestment(pclsSchedule, endAge = 90) {
  const { schedule, reinvestmentReturn, settings } = pclsSchedule;
  const { retirementAge } = settings;
  
  // Create a map for O(1) lookup instead of relying on sequential index
  // This handles unsorted schedules and gaps correctly
  const scheduleByAge = new Map();
  schedule.forEach(entry => {
    if (entry.amount > 0) {
      scheduleByAge.set(entry.age, entry.amount);
    }
  });
  
  const projection = [];
  let balance = 0;
  
  for (let age = retirementAge; age <= endAge; age++) {
    // Check if PCLS is taken this year using map lookup
    const pclsTakenThisYear = scheduleByAge.get(age) || 0;
    if (pclsTakenThisYear > 0) {
      balance += pclsTakenThisYear;
    }
    
    // Apply growth
    const growth = balance * reinvestmentReturn;
    balance += growth;
    
    projection.push({
      age,
      pclsTaken: pclsTakenThisYear,
      balance: Math.max(0, balance),
      growth
    });
  }
  
  return projection;
}
