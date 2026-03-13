/**
 * RetireLens 2 - Withdrawal Strategy Engine
 * 
 * Pure functions for pension/ISA withdrawal calculations.
 * Implements UK-specific rules for PCLS, pension drawdown, and ISA withdrawals.
 */

import { calculateTaxFromGross, calculateGrossFromNet, getMarginalRate } from './tax.js';
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
  // FIX 2.2: Use marginal rate at current income level to avoid double-counting
  if (stillNeeded > 0 && balances.pension > pensionWithdrawal) {
    // Income already taxable: existing taxable income + PA-filling pension
    const currentTaxableIncome = existingTaxableIncome + pensionWithdrawal;
    
    // Get marginal rate at current income level
    const marginalRate = getMarginalRate(currentTaxableIncome, taxConfig);
    
    // Gross pension needed to produce stillNeeded net at this marginal rate
    const additionalGross = marginalRate < 1 ? stillNeeded / (1 - marginalRate) : stillNeeded;
    
    const additionalPension = Math.min(
      additionalGross,
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
 * Enhanced to support all configurable options from requirements
 */
export const PCLS_STRATEGIES = {
  ALL_AT_RETIREMENT: 'all_at_retirement',  // Take full 25% at retirement age (default)
  PARTIAL: 'partial',                       // Take a specific percentage (less than 25%)
  PHASED: 'phased',                        // Spread PCLS over N years
  DEFERRED: 'deferred',                    // Defer until age X (e.g., state pension age)
  NONE: 'none'                             // Do not take any PCLS
};

/**
 * PCLS Destination types - what to do with the tax-free cash
 */
export const PCLS_DESTINATIONS = {
  REINVEST_ISA: 'reinvest_isa',            // Reinvest into ISA (subject to annual cap)
  HOLD_CASH: 'hold_cash',                  // Hold as cash (cash return assumption)
  SPEND_OVER_YEARS: 'spend_over_years'     // Use as bridging bucket for spending
};

/**
 * Calculate PCLS withdrawal schedule based on strategy
 * 
 * Strategies:
 * 1. ALL_AT_RETIREMENT - Take full 25% at retirement age (default)
 * 2. PARTIAL - Take a specific percentage (less than 25%)
 * 3. PHASED - Spread PCLS over N years (default 5)
 * 4. DEFERRED - Defer until age X (e.g., state pension age)
 * 5. NONE - Do not take any PCLS
 * 
 * IMPORTANT: PCLS is NOT income - it's a transfer from pension to another pot.
 * It should not appear as income spike in charts. Instead, it goes to:
 * - ISA/GIA (subject to ISA cap) if reinvesting
 * - Cash reserve if holding cash
 * - Bridging bucket if spending over years
 * 
 * @param {number} pensionValue - Total pension pot value at retirement
 * @param {object} options - Strategy configuration
 * @param {string} options.strategy - PCLS strategy type
 * @param {number} options.retirementAge - Age at retirement
 * @param {number} options.partialPercent - Percentage to take (for PARTIAL strategy, max 25)
 * @param {number} options.phaseYears - Number of years to spread PCLS (for PHASED strategy)
 * @param {number} options.deferredAge - Age to take PCLS (for DEFERRED strategy)
 * @param {string} options.destination - What to do with PCLS (PCLS_DESTINATIONS)
 * @param {number} options.spendOverYears - Number of years to spread spending (for SPEND_OVER_YEARS)
 * @param {boolean} options.reinvest - Legacy: if true, reinvest; if false, hold cash
 * @param {number} options.reinvestmentReturn - Return rate when reinvested
 * @param {number} options.cashReturn - Return rate when held as cash
 * @param {number} options.isaAnnualCap - Annual ISA contribution cap (default £20,000)
 * @returns {object} PCLS schedule with year-by-year breakdown
 */
export function calculatePCLSStrategy(pensionValue, options = {}) {
  const {
    strategy = PCLS_STRATEGIES.ALL_AT_RETIREMENT,
    retirementAge = 60,
    partialPercent = 25,
    phaseYears = 5,
    deferredAge = 67,
    destination = PCLS_DESTINATIONS.REINVEST_ISA,
    spendOverYears = 5,
    reinvest = true,
    reinvestmentReturn = 0.04,
    cashReturn = 0.0,
    isaAnnualCap = 20000
  } = options;
  
  // Calculate max PCLS (25% of pension)
  const maxPclsPercent = PENSION_CONFIG.pclsRate; // 0.25
  const effectivePercent = strategy === PCLS_STRATEGIES.PARTIAL 
    ? Math.min(partialPercent / 100, maxPclsPercent)
    : maxPclsPercent;
  
  const maxPCLS = pensionValue * effectivePercent;
  const schedule = [];
  
  // Ensure no NaN
  const safeMax = isNaN(maxPCLS) ? 0 : maxPCLS;
  
  // Handle NONE strategy
  if (strategy === PCLS_STRATEGIES.NONE || safeMax <= 0) {
    return {
      strategy: PCLS_STRATEGIES.NONE,
      totalPCLS: 0,
      schedule: [],
      destination,
      reinvest: false,
      reinvestmentReturn: 0,
      spendingSchedule: [],
      settings: {
        retirementAge,
        phaseYears,
        deferredAge
      }
    };
  }
  
  switch (strategy) {
    case PCLS_STRATEGIES.ALL_AT_RETIREMENT:
      schedule.push({
        age: retirementAge,
        amount: safeMax,
        cumulative: safeMax,
        remaining: 0
      });
      break;
      
    case PCLS_STRATEGIES.PARTIAL:
      schedule.push({
        age: retirementAge,
        amount: safeMax,
        cumulative: safeMax,
        remaining: 0,
        percentTaken: effectivePercent * 100
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
      schedule.push({
        age: deferredAge,
        amount: safeMax,
        cumulative: safeMax,
        remaining: 0,
        deferredFrom: retirementAge
      });
      break;
      
    default:
      schedule.push({
        age: retirementAge,
        amount: safeMax,
        cumulative: safeMax,
        remaining: 0
      });
  }
  
  // Calculate spending schedule if PCLS is used for spending
  const spendingSchedule = [];
  if (destination === PCLS_DESTINATIONS.SPEND_OVER_YEARS) {
    const annualSpending = safeMax / spendOverYears;
    const startAge = schedule[0]?.age || retirementAge;
    for (let i = 0; i < spendOverYears; i++) {
      spendingSchedule.push({
        age: startAge + i,
        spendFromPCLS: annualSpending,
        remainingPCLS: safeMax - (annualSpending * (i + 1))
      });
    }
  }
  
  // Determine effective return rate based on destination
  let effectiveReturn = cashReturn;
  if (destination === PCLS_DESTINATIONS.REINVEST_ISA) {
    effectiveReturn = reinvestmentReturn;
  } else if (destination === PCLS_DESTINATIONS.SPEND_OVER_YEARS) {
    effectiveReturn = cashReturn; // Cash-like return while spending down
  }
  
  // Legacy support for reinvest boolean
  if (reinvest && destination === PCLS_DESTINATIONS.HOLD_CASH) {
    effectiveReturn = reinvestmentReturn;
  }
  
  return {
    strategy,
    totalPCLS: safeMax,
    schedule,
    destination,
    reinvest: destination === PCLS_DESTINATIONS.REINVEST_ISA || reinvest,
    reinvestmentReturn: effectiveReturn,
    spendingSchedule,
    isaAnnualCap,
    settings: {
      retirementAge,
      partialPercent: effectivePercent * 100,
      phaseYears,
      deferredAge,
      spendOverYears
    }
  };
}

/**
 * Project PCLS reinvestment growth over time
 * Enforces ISA annual contribution cap (£20,000).
 * Overflow from ISA cap is held in a cash bucket and transferred in subsequent years.
 * 
 * @param {object} pclsSchedule - Result from calculatePCLSStrategy
 * @param {number} endAge - Age to project until
 * @returns {object[]} Year-by-year PCLS balance (reinvested or cash)
 */
export function projectPCLSReinvestment(pclsSchedule, endAge = 90) {
  const { schedule, reinvestmentReturn, settings, isaAnnualCap = 20000 } = pclsSchedule;
  const { retirementAge } = settings;
  
  // Create a map for O(1) lookup instead of relying on sequential index
  const scheduleByAge = new Map();
  schedule.forEach(entry => {
    if (entry.amount > 0) {
      scheduleByAge.set(entry.age, entry.amount);
    }
  });
  
  const projection = [];
  let isaBalance = 0;
  let cashBalance = 0; // Overflow beyond ISA cap
  
  for (let age = retirementAge; age <= endAge; age++) {
    const pclsTakenThisYear = scheduleByAge.get(age) || 0;
    
    if (pclsTakenThisYear > 0) {
      // Transfer up to ISA cap, rest into cash bucket
      const totalAvailable = pclsTakenThisYear + cashBalance;
      const toIsa = Math.min(totalAvailable, isaAnnualCap);
      const toCash = Math.max(0, totalAvailable - toIsa); // FIX: clearer expression (same result)
      isaBalance += toIsa;
      cashBalance = toCash;
    } else if (cashBalance > 0) {
      // In subsequent years, transfer from cash to ISA up to annual cap
      const transfer = Math.min(cashBalance, isaAnnualCap);
      isaBalance += transfer;
      cashBalance -= transfer;
    }
    
    // Apply growth to ISA only (cash earns 0%)
    const isaGrowth = isaBalance * reinvestmentReturn;
    isaBalance += isaGrowth;
    // Cash earns 0% (conservative assumption)
    
    projection.push({
      age,
      pclsTaken: pclsTakenThisYear,
      isaBalance: Math.max(0, isaBalance),
      cashBalance: Math.max(0, cashBalance),
      balance: Math.max(0, isaBalance + cashBalance),
      growth: isaGrowth
    });
  }
  
  return projection;
}
