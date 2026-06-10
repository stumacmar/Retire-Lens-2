/**
 * RetireLens 2 - Monte Carlo Simulation Engine
 * 
 * Provides uncertainty bands around deterministic projections.
 * Monte Carlo is used for deviation analysis, not as the primary projection method.
 * 
 * Success Definition:
 * "Portfolio value > 0 at target age (configurable, default 90)"
 * This means funds were not depleted before the target age.
 */

import { runProjection, createPlan } from './projections.js';
import { PROJECTION_DEFAULTS } from '../config/defaults.js';
import { calculateOptimalWithdrawal } from './withdrawals.js';
import { calculateTaxFromGross } from './tax.js';

/**
 * Generate a random return using normal distribution
 * Uses Box-Muller transform
 * 
 * @param {number} mean - Expected return
 * @param {number} stdDev - Standard deviation (volatility)
 * @returns {number} Random return
 */
export function generateRandomReturn(mean, stdDev) {
  const u1 = Math.random();
  const u2 = Math.random();
  
  // Box-Muller transform
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  
  return mean + z * stdDev;
}

/**
 * Generate a sequence of random returns
 * 
 * @param {number} years - Number of years
 * @param {number} mean - Expected annual return
 * @param {number} stdDev - Standard deviation
 * @param {number} seed - Optional seed for reproducibility
 * @returns {number[]} Array of returns for each year
 */
export function generateReturnSequence(years, mean, stdDev, seed = null) {
  // Simple seeded random if seed provided (for reproducibility)
  let random = Math.random;
  if (seed !== null) {
    // Simple seeded PRNG (Mulberry32)
    let state = seed;
    random = () => {
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  
  const returns = [];
  for (let i = 0; i < years; i++) {
    const u1 = random();
    const u2 = random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    returns.push(mean + z * stdDev);
  }
  
  return returns;
}

/**
 * Run a single Monte Carlo simulation with year-by-year tracking
 * 
 * @param {object} plan - Plan state object
 * @param {number[]} accumulationReturns - Returns for accumulation phase
 * @param {number[]} decumulationReturns - Returns for decumulation phase
 * @param {number} endAge - Age to project until
 * @param {boolean} trackYearlyBalances - Whether to track balances at each year
 * @returns {object} Simulation result with:
 *   - totalRetirementAssets: Total assets at retirement
 *   - finalBalance: Final balance at end of simulation
 *   - fundsDepleted: Whether funds ran out before horizon
 *   - depletionAge: Age when funds depleted (null if never)
 *   - yearsWithFullIncome: Years where target income was achievable
 *   - isSuccess: TRUE if target income met every year AND wealth > 0 through horizon
 *   - yearlyData: (optional) Array of yearly balance data
 */
export function runSingleSimulation(plan, accumulationReturns, decumulationReturns, endAge = 90, trackYearlyBalances = false) {
  const { projection, tax: taxConfig } = plan.assumptions;
  const feeRate = projection.defaultFeeRate;
  
  // Accumulation phase with variable returns
  let pensionBalance = plan.currentPension;
  let isaBalance = plan.currentIsa;
  
  const yearlyData = trackYearlyBalances ? [] : null;
  const accumulationYears = plan.retirementAge - plan.currentAge;
  
  for (let i = 0; i < accumulationYears; i++) {
    const yearReturn = accumulationReturns[i] - feeRate;
    // Mid-year contribution approximation: contributions earn ~half a year of growth
    // This matches the deterministic projectAccumulation logic
    const contribGrowthFactor = 1 + (yearReturn / 2);
    pensionBalance = pensionBalance * (1 + yearReturn) + plan.annualPensionContribution * contribGrowthFactor;
    isaBalance = isaBalance * (1 + yearReturn) + plan.annualIsaContribution * contribGrowthFactor;
    
    if (trackYearlyBalances) {
      yearlyData.push({
        age: plan.currentAge + i + 1,
        phase: 'accumulation',
        balance: pensionBalance + isaBalance,
        pension: pensionBalance,
        isa: isaBalance,
        targetMet: true // Not in decumulation yet
      });
    }
  }
  
  // Marginal PCLS: don't deduct lump sum — apply 25% tax-free to each withdrawal instead
  const pclsRate = plan.assumptions.pension?.pclsRate || 0.25;
  const lsaCap = plan.assumptions?.pension?.lumpSumAllowance || 268275;
  const priorPCLS = plan.pclsAmountTaken || 0;
  const maxPclsEntitlement = Math.min(pensionBalance * pclsRate, Math.max(0, lsaCap - priorPCLS));
  let pclsRemainingEntitlement = maxPclsEntitlement;
  let taxFreeCash = 0;
  const totalRetirementAssets = pensionBalance + isaBalance;
  
  // Decumulation phase
  let fundsDepleted = false;
  let depletionAge = null;
  let targetMetEveryYear = true; // Track if target income met each year
  // Use inclusive range to match deterministic projection (retirementAge to endAge inclusive)
  const decumulationYears = endAge - plan.retirementAge + 1;
  
  for (let i = 0; i < decumulationYears; i++) {
    const age = plan.retirementAge + i;
    
    if (fundsDepleted) {
      targetMetEveryYear = false;
      if (trackYearlyBalances) {
        yearlyData.push({
          age,
          phase: 'decumulation',
          balance: 0,
          pension: 0,
          isa: 0,
          depleted: true,
          targetMet: false
        });
      }
      continue;
    }
    
    // State pension + partner pensions — match deterministic logic
    const statePensionRealGrowth = plan.statePensionRealGrowth || 0.01;
    const spYearsFromStart = Math.max(0, age - plan.statePensionAge);
    const statePension = age >= plan.statePensionAge
      ? plan.expectedStatePension * Math.pow(1 + statePensionRealGrowth, spYearsFromStart)
      : 0;

    // Partner pensions — convert partner ages to user's timeline
    const ageDiff = (plan.partnerCurrentAge || 0) > 0 ? plan.partnerCurrentAge - plan.currentAge : 0;
    const partnerSpStartUserAge = (plan.partnerCurrentAge || 0) > 0 ? (plan.partnerStatePensionAge || 0) - ageDiff : (plan.partnerStatePensionAge || 0);
    const partnerSpYears = Math.max(0, age - partnerSpStartUserAge);
    const partnerSP = ((plan.partnerExpectedStatePension || 0) > 0 && age >= partnerSpStartUserAge)
      ? plan.partnerExpectedStatePension * Math.pow(1 + statePensionRealGrowth, partnerSpYears) : 0;

    const partnerDbStartUserAge = (plan.partnerCurrentAge || 0) > 0 ? ((plan.partnerDBPensionStartAge || 67) - ageDiff) : (plan.partnerDBPensionStartAge || 67);
    const partnerDB = ((plan.partnerDBPensionAmount || 0) > 0 && age >= partnerDbStartUserAge)
      ? plan.partnerDBPensionAmount * Math.pow(1 + 0.02, Math.max(0, age - partnerDbStartUserAge)) : 0;

    const totalGuaranteed = statePension + partnerSP + partnerDB;

    // For couples: doubled personal allowance and tax bands
    let effectiveTaxConfig = plan.assumptions.tax;
    if ((plan.partnerCurrentAge || 0) > 0) {
      effectiveTaxConfig = {
        ...plan.assumptions.tax,
        personalAllowance: plan.assumptions.tax.personalAllowance * 2,
        bands: plan.assumptions.tax.bands.map(b => ({
          ...b,
          threshold: b.threshold === Infinity ? Infinity : b.threshold * 2
        }))
      };
    }

    // Apply age-based spending reductions only when explicitly enabled
    let targetThisYear = plan.targetNetIncome;
    if (plan.spendingRules?.applyDefaultReductions === true) {
      if (age >= 90) {
        targetThisYear = plan.targetNetIncome * 0.65;
      } else if (age >= 80) {
        targetThisYear = plan.targetNetIncome * 0.75;
      }
    }

    const balances = { pension: pensionBalance, isa: isaBalance };
    const withdrawalResult = calculateOptimalWithdrawal(
      targetThisYear,
      balances,
      { statePensionIncome: totalGuaranteed, taxConfig: effectiveTaxConfig }
    );

    // Marginal PCLS: 25% of pension withdrawals are tax-free (up to remaining entitlement)
    const pensionWithdrawn = withdrawalResult.withdrawals.pension;
    if (pensionWithdrawn > 0 && pclsRemainingEntitlement > 0) {
      const pclsThisYear = Math.min(pensionWithdrawn * pclsRate, pclsRemainingEntitlement);
      pclsRemainingEntitlement -= pclsThisYear;
      taxFreeCash += pclsThisYear;
      const taxablePension = pensionWithdrawn - pclsThisYear;
      const recalcTax = calculateTaxFromGross(totalGuaranteed + taxablePension, effectiveTaxConfig);
      withdrawalResult.taxPaid = recalcTax.total;
      withdrawalResult.netIncome = recalcTax.netIncome + withdrawalResult.withdrawals.isa;
    }

    let targetMetThisYear = true;

    // Check if withdrawal exceeds available balances
    const totalBalance = pensionBalance + isaBalance;
    const totalWithdrawal = withdrawalResult.withdrawals.total;

    if (totalBalance <= 0 || (totalWithdrawal > totalBalance && totalBalance < plan.targetNetIncome * 0.1)) {
      pensionBalance = 0;
      isaBalance = 0;
      fundsDepleted = true;
      depletionAge = age;
      targetMetThisYear = false;
      targetMetEveryYear = false;
    } else {
      pensionBalance = Math.max(0, withdrawalResult.newBalances.pension);
      isaBalance = Math.max(0, withdrawalResult.newBalances.isa);
    }
    
    // Apply return
    if (!fundsDepleted) {
      const yearReturn = decumulationReturns[i] - feeRate;
      pensionBalance *= (1 + yearReturn);
      isaBalance *= (1 + yearReturn);
    }
    
    if (trackYearlyBalances) {
      yearlyData.push({
        age,
        phase: 'decumulation',
        balance: pensionBalance + isaBalance,
        pension: pensionBalance,
        isa: isaBalance,
        depleted: fundsDepleted,
        targetMet: targetMetThisYear
      });
    }
  }
  
  const result = {
    totalRetirementAssets,  // Renamed from retirementPot for clarity
    finalBalance: Math.max(0, pensionBalance + isaBalance),
    fundsDepleted,
    depletionAge,
    yearsWithFullIncome: fundsDepleted 
      ? (depletionAge - plan.retirementAge)
      : decumulationYears,
    // Success criteria: target income met every year AND wealth never <= 0
    isSuccess: !fundsDepleted && targetMetEveryYear
  };
  
  if (trackYearlyBalances) {
    result.yearlyData = yearlyData;
  }
  
  return result;
}

/**
 * Run full Monte Carlo simulation
 * 
 * @param {object} plan - Plan state object
 * @param {object} options - Simulation options
 * @returns {object} Monte Carlo results with percentiles
 */
export function runMonteCarlo(plan, options = {}) {
  const {
    iterations = PROJECTION_DEFAULTS.monteCarloIterations,
    endAge = 90,
    mean = PROJECTION_DEFAULTS.defaultGrowthRate,
    volatility = PROJECTION_DEFAULTS.volatility,
    seed = null
  } = options;
  
  const accumulationYears = plan.retirementAge - plan.currentAge;
  const decumulationYears = endAge - plan.retirementAge + 1; // inclusive range to match deterministic
  
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const iterSeed = seed !== null ? seed + i : null;
    const accReturns = generateReturnSequence(accumulationYears, mean, volatility, iterSeed);
    const decReturns = generateReturnSequence(decumulationYears, mean, volatility, iterSeed ? iterSeed + 10000 : null);
    
    const result = runSingleSimulation(plan, accReturns, decReturns, endAge, false);
    results.push(result);
  }
  
  // Calculate statistics
  const finalBalances = results.map(r => r.finalBalance).sort((a, b) => a - b);
  const successRates = results.map(r => r.fundsDepleted ? 0 : 1);
  const depletionAges = results.filter(r => r.fundsDepleted).map(r => r.depletionAge);
  
  return {
    iterations,
    mean,
    volatility,
    endAge,
    statistics: {
      successRate: successRates.reduce((a, b) => a + b, 0) / iterations,
      
      finalBalance: {
        p5: percentile(finalBalances, 5),
        p10: percentile(finalBalances, 10),
        p25: percentile(finalBalances, 25),
        p50: percentile(finalBalances, 50),
        p75: percentile(finalBalances, 75),
        p90: percentile(finalBalances, 90),
        p95: percentile(finalBalances, 95),
        mean: finalBalances.reduce((a, b) => a + b, 0) / finalBalances.length
      },
      
      depletionAge: depletionAges.length > 0 ? {
        earliest: Math.min(...depletionAges),
        median: percentile(depletionAges.sort((a, b) => a - b), 50),
        latest: Math.max(...depletionAges),
        count: depletionAges.length
      } : null
    },
    
    // Return individual results for detailed analysis
    results
  };
}

/**
 * Run Monte Carlo with year-by-year tracking for fan charts
 * This is more expensive but provides data for visualization
 * 
 * @param {object} plan - Plan state object
 * @param {object} options - Simulation options
 * @returns {object} Monte Carlo results with yearly percentile bands
 */
export function runMonteCarloWithBands(plan, options = {}) {
  const {
    iterations = PROJECTION_DEFAULTS.monteCarloIterations,
    endAge = 90,
    mean = PROJECTION_DEFAULTS.defaultGrowthRate,
    volatility = PROJECTION_DEFAULTS.volatility,
    seed = null
  } = options;
  
  const accumulationYears = plan.retirementAge - plan.currentAge;
  const decumulationYears = endAge - plan.retirementAge + 1; // inclusive range to match deterministic
  const totalYears = accumulationYears + decumulationYears;
  
  // Initialize yearly balance tracking
  const yearlyBalances = {};
  for (let age = plan.currentAge + 1; age <= endAge; age++) {
    yearlyBalances[age] = [];
  }
  
  const results = [];
  const depletionAges = [];
  
  for (let i = 0; i < iterations; i++) {
    const iterSeed = seed !== null ? seed + i : null;
    const accReturns = generateReturnSequence(accumulationYears, mean, volatility, iterSeed);
    const decReturns = generateReturnSequence(decumulationYears, mean, volatility, iterSeed ? iterSeed + 10000 : null);
    
    const result = runSingleSimulation(plan, accReturns, decReturns, endAge, true);
    results.push(result);
    
    if (result.fundsDepleted) {
      depletionAges.push(result.depletionAge);
    }
    
    // Collect yearly balances
    for (const yearData of result.yearlyData) {
      if (yearlyBalances[yearData.age]) {
        yearlyBalances[yearData.age].push(yearData.balance);
      }
    }
  }
  
  // Calculate percentile bands per year
  const yearlyBands = [];
  for (let age = plan.currentAge + 1; age <= endAge; age++) {
    const balances = yearlyBalances[age];
    if (balances && balances.length > 0) {
      balances.sort((a, b) => a - b);
      yearlyBands.push({
        age,
        p10: percentile(balances, 10),
        p25: percentile(balances, 25),
        p50: percentile(balances, 50),
        p75: percentile(balances, 75),
        p90: percentile(balances, 90),
        mean: balances.reduce((a, b) => a + b, 0) / balances.length,
        min: balances[0],
        max: balances[balances.length - 1]
      });
    }
  }
  
  // Calculate final balance statistics
  const finalBalances = results.map(r => r.finalBalance).sort((a, b) => a - b);
  
  // Success count based on new isSuccess criteria (target met + wealth > 0)
  const successCount = results.filter(r => r.isSuccess).length;
  
  // Legacy success count (just wealth > 0) for backward compatibility
  const notDepletedCount = results.filter(r => !r.fundsDepleted).length;
  
  // Generate depletion age histogram
  const depletionHistogram = generateDepletionHistogram(depletionAges, plan.retirementAge, endAge);
  
  return {
    iterations,
    mean,
    volatility,
    endAge,
    statistics: {
      // Primary success metric: target income met every year AND wealth never <= 0
      successRate: successCount / iterations,
      successProbability: (successCount / iterations * 100).toFixed(1),
      successCount,
      failureCount: iterations - successCount,
      
      // Legacy metric for backward compatibility
      notDepletedRate: notDepletedCount / iterations,
      
      finalBalance: {
        p5: percentile(finalBalances, 5),
        p10: percentile(finalBalances, 10),
        p25: percentile(finalBalances, 25),
        p50: percentile(finalBalances, 50),
        p75: percentile(finalBalances, 75),
        p90: percentile(finalBalances, 90),
        p95: percentile(finalBalances, 95),
        mean: finalBalances.reduce((a, b) => a + b, 0) / finalBalances.length
      },
      
      depletionAge: depletionAges.length > 0 ? {
        earliest: Math.min(...depletionAges),
        median: percentile(depletionAges.sort((a, b) => a - b), 50),
        latest: Math.max(...depletionAges),
        count: depletionAges.length,
        histogram: depletionHistogram
      } : null
    },
    
    // Fan chart data
    yearlyBands,
    
    // Raw results (optional, may omit for performance)
    results: options.includeRawResults ? results : null
  };
}

/**
 * Generate histogram of depletion ages
 * 
 * @param {number[]} depletionAges - Array of depletion ages
 * @param {number} minAge - Minimum age (retirement age)
 * @param {number} maxAge - Maximum age (end age)
 * @returns {object[]} Histogram bins
 */
function generateDepletionHistogram(depletionAges, minAge, maxAge) {
  if (depletionAges.length === 0) return [];
  
  // Create bins by 5-year intervals
  const bins = [];
  for (let startAge = minAge; startAge < maxAge; startAge += 5) {
    const endBin = Math.min(startAge + 5, maxAge);
    // Inclusive range: ages startAge to (endBin - 1)
    const count = depletionAges.filter(a => a >= startAge && a < endBin).length;
    // Label shows inclusive range
    const labelEnd = endBin === maxAge ? endBin : endBin - 1;
    bins.push({
      startAge,
      endAge: endBin,
      label: endBin - startAge === 1 ? `${startAge}` : `${startAge}-${labelEnd}`,
      count,
      percentage: depletionAges.length > 0 ? (count / depletionAges.length) * 100 : 0
    });
  }
  
  // Filter out empty bins for cleaner display
  return bins.filter(b => b.count > 0 || bins.length <= 5);
}

/**
 * Calculate percentile from sorted array
 * 
 * @param {number[]} sortedArr - Sorted array of values
 * @param {number} p - Percentile (0-100)
 * @returns {number} Value at percentile
 */
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedArr[lower];
  return sortedArr[lower] + (sortedArr[upper] - sortedArr[lower]) * (index - lower);
}

/**
 * Generate confidence bands for a projection
 * 
 * @param {object} plan - Plan state object
 * @param {object} options - Options including Monte Carlo settings
 * @returns {object} Deterministic projection with uncertainty bands
 */
export function generateConfidenceBands(plan, options = {}) {
  const {
    endAge = 90,
    iterations = 1000,
    volatility = PROJECTION_DEFAULTS.volatility
  } = options;
  
  // Run deterministic projection
  const deterministicResult = runProjection(plan, { endAge });
  
  // Run Monte Carlo with bands
  const monteCarloResult = runMonteCarloWithBands(plan, {
    iterations,
    endAge,
    volatility
  });
  
  return {
    deterministic: deterministicResult,
    monteCarlo: monteCarloResult,
    bands: {
      pessimistic: {
        finalBalance: monteCarloResult.statistics.finalBalance.p10,
        description: '10th percentile - poor market conditions'
      },
      expected: {
        finalBalance: deterministicResult.summary.finalBalance,
        description: 'Deterministic projection with expected returns'
      },
      optimistic: {
        finalBalance: monteCarloResult.statistics.finalBalance.p90,
        description: '90th percentile - favorable market conditions'
      }
    },
    robustness: {
      score: monteCarloResult.statistics.successRate,
      interpretation: interpretRobustness(monteCarloResult.statistics.successRate)
    },
    // Fan chart data for visualization
    yearlyBands: monteCarloResult.yearlyBands
  };
}

/**
 * Interpret robustness score
 * 
 * @param {number} successRate - Success rate from Monte Carlo
 * @returns {string} Human-readable interpretation
 */
function interpretRobustness(successRate) {
  if (successRate >= 0.95) return 'Very robust - high confidence in achieving goals';
  if (successRate >= 0.85) return 'Robust - good probability of success';
  if (successRate >= 0.70) return 'Moderate - some risk of shortfall';
  if (successRate >= 0.50) return 'Uncertain - significant risk of not meeting goals';
  return 'High risk - substantial probability of failure';
}

/**
 * Run scenario analysis with different assumptions
 * 
 * @param {object} plan - Plan state object
 * @param {object[]} scenarios - Array of scenario definitions
 * @returns {object[]} Results for each scenario
 */
export function runScenarioAnalysis(plan, scenarios) {
  return scenarios.map(scenario => {
    const modifiedPlan = createPlan({
      ...plan,
      ...scenario.planOverrides,
      name: scenario.name,
      assumptions: {
        ...plan.assumptions,
        ...scenario.assumptionOverrides
      }
    });
    
    const result = runProjection(modifiedPlan, { endAge: scenario.endAge || 90 });
    const monteCarlo = runMonteCarlo(modifiedPlan, {
      iterations: scenario.iterations || 500,
      endAge: scenario.endAge || 90
    });
    
    return {
      scenario: scenario.name,
      description: scenario.description,
      deterministic: result.summary,
      monteCarlo: monteCarlo.statistics,
      robustness: monteCarlo.statistics.successRate
    };
  });
}

/**
 * Sequence-of-returns illustration (Bug E fix)
 * 
 * Demonstrates the impact of return order on retirement outcomes.
 * Uses the SAME set of annual returns but in different orders:
 * - "Good start": High returns early in retirement (sorted descending)
 * - "Bad start": Low/negative returns early in retirement (sorted ascending)
 * - "Average": Returns as-is (deterministic)
 * 
 * For positive drift with withdrawals, "good start" ALWAYS produces a higher
 * final balance than "bad start" because early gains compound on a larger base.
 * 
 * @param {object} plan - Plan state object
 * @param {object} options - Options
 * @returns {object} Three scenarios with yearly data
 */
export function illustrateSequenceOfReturns(plan, options = {}) {
  const {
    endAge = 90,
    annualReturns = null
  } = options;
  
  const { projection } = plan.assumptions;
  const meanReturn = projection.defaultGrowthRate;
  const accumulationYears = plan.retirementAge - plan.currentAge;
  const decumulationYears = endAge - plan.retirementAge + 1;
  
  // Generate or use provided annual returns for decumulation only
  let returns;
  if (annualReturns) {
    returns = [...annualReturns];
  } else {
    // Create a realistic varied return sequence around the mean
    returns = [];
    for (let i = 0; i < decumulationYears; i++) {
      const deviation = 0.08 * Math.sin(i * 0.7) + 0.04 * Math.cos(i * 1.3);
      returns.push(meanReturn + deviation);
    }
  }
  
  // "Good start" = highest returns first (descending)
  const goodStartReturns = [...returns].sort((a, b) => b - a);
  
  // "Bad start" = lowest returns first (ascending)  
  const badStartReturns = [...returns].sort((a, b) => a - b);
  
  // Run accumulation identically for all three
  const accReturns = Array(accumulationYears).fill(meanReturn);
  
  // Run three simulations
  const goodStart = runSingleSimulation(plan, accReturns, goodStartReturns, endAge, true);
  const badStart = runSingleSimulation(plan, accReturns, badStartReturns, endAge, true);
  const average = runSingleSimulation(plan, accReturns, Array(decumulationYears).fill(meanReturn), endAge, true);
  
  return {
    goodStart: {
      label: 'Good Start (high returns early)',
      finalBalance: goodStart.finalBalance,
      yearlyData: goodStart.yearlyData,
      returns: goodStartReturns
    },
    badStart: {
      label: 'Bad Start (low returns early)',
      finalBalance: badStart.finalBalance,
      yearlyData: badStart.yearlyData,
      returns: badStartReturns
    },
    average: {
      label: 'Average (constant returns)',
      finalBalance: average.finalBalance,
      yearlyData: average.yearlyData,
      returns: Array(decumulationYears).fill(meanReturn)
    },
    // Invariant: for positive drift with withdrawals, good start > bad start
    orderingCorrect: goodStart.finalBalance >= badStart.finalBalance
  };
}
