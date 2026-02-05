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
 * @returns {object} Simulation result with optional yearly data
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
    pensionBalance = pensionBalance * (1 + yearReturn) + plan.annualPensionContribution;
    isaBalance = isaBalance * (1 + yearReturn) + plan.annualIsaContribution;
    
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
  
  // Take PCLS
  const pclsRate = plan.assumptions.pension?.pclsRate || 0.25;
  const taxFreeCash = pensionBalance * pclsRate;
  pensionBalance = pensionBalance - taxFreeCash;
  // Total retirement assets = pension after PCLS + ISA + tax-free cash taken
  const totalRetirementAssets = pensionBalance + isaBalance + taxFreeCash;
  
  // Decumulation phase
  let fundsDepleted = false;
  let depletionAge = null;
  let targetMetEveryYear = true; // Track if target income met each year
  const decumulationYears = endAge - plan.retirementAge;
  
  for (let i = 0; i < decumulationYears; i++) {
    const age = plan.retirementAge + i;
    
    if (fundsDepleted) {
      targetMetEveryYear = false;
      if (trackYearlyBalances) {
        yearlyData.push({
          age: age + 1,
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
    
    const statePension = age >= plan.statePensionAge ? plan.expectedStatePension : 0;
    
    // Simplified withdrawal - target net income minus state pension
    const neededFromPortfolio = Math.max(0, plan.targetNetIncome - statePension);
    
    // Withdraw proportionally (simplified)
    const totalBalance = pensionBalance + isaBalance;
    let targetMetThisYear = true;
    
    if (totalBalance <= neededFromPortfolio) {
      pensionBalance = 0;
      isaBalance = 0;
      fundsDepleted = true;
      depletionAge = age;
      targetMetThisYear = false;
      targetMetEveryYear = false;
    } else {
      const withdrawalRatio = neededFromPortfolio / totalBalance;
      pensionBalance -= pensionBalance * withdrawalRatio;
      isaBalance -= isaBalance * withdrawalRatio;
    }
    
    // Apply return
    if (!fundsDepleted) {
      const yearReturn = decumulationReturns[i] - feeRate;
      pensionBalance *= (1 + yearReturn);
      isaBalance *= (1 + yearReturn);
    }
    
    if (trackYearlyBalances) {
      yearlyData.push({
        age: age + 1,
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
  const decumulationYears = endAge - plan.retirementAge;
  
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
  const decumulationYears = endAge - plan.retirementAge;
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
