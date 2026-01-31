/**
 * RetireLens 2 - Monte Carlo Simulation Engine
 * 
 * Provides uncertainty bands around deterministic projections.
 * Monte Carlo is used for deviation analysis, not as the primary projection method.
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
 * Run a single Monte Carlo simulation
 * 
 * @param {object} plan - Plan state object
 * @param {number[]} accumulationReturns - Returns for accumulation phase
 * @param {number[]} decumulationReturns - Returns for decumulation phase
 * @param {number} endAge - Age to project until
 * @returns {object} Simulation result
 */
export function runSingleSimulation(plan, accumulationReturns, decumulationReturns, endAge = 90) {
  const { projection, tax: taxConfig } = plan.assumptions;
  const feeRate = projection.defaultFeeRate;
  
  // Accumulation phase with variable returns
  let pensionBalance = plan.currentPension;
  let isaBalance = plan.currentIsa;
  
  const accumulationYears = plan.retirementAge - plan.currentAge;
  for (let i = 0; i < accumulationYears; i++) {
    const yearReturn = accumulationReturns[i] - feeRate;
    pensionBalance = pensionBalance * (1 + yearReturn) + plan.annualPensionContribution;
    isaBalance = isaBalance * (1 + yearReturn) + plan.annualIsaContribution;
  }
  
  // Take PCLS
  const pclsRate = plan.assumptions.pension?.pclsRate || 0.25;
  const taxFreeCash = pensionBalance * pclsRate;
  pensionBalance = pensionBalance - taxFreeCash;
  
  // Decumulation phase
  let fundsDepleted = false;
  let depletionAge = null;
  const decumulationYears = endAge - plan.retirementAge;
  
  for (let i = 0; i < decumulationYears; i++) {
    if (fundsDepleted) continue;
    
    const age = plan.retirementAge + i;
    const statePension = age >= plan.statePensionAge ? plan.expectedStatePension : 0;
    
    // Simplified withdrawal - target net income minus state pension
    const neededFromPortfolio = Math.max(0, plan.targetNetIncome - statePension);
    
    // Withdraw proportionally (simplified)
    const totalBalance = pensionBalance + isaBalance;
    if (totalBalance <= neededFromPortfolio) {
      pensionBalance = 0;
      isaBalance = 0;
      fundsDepleted = true;
      depletionAge = age;
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
  }
  
  return {
    retirementPot: pensionBalance + isaBalance + taxFreeCash, // At retirement
    finalBalance: Math.max(0, pensionBalance + isaBalance),
    fundsDepleted,
    depletionAge,
    yearsWithFullIncome: fundsDepleted 
      ? (depletionAge - plan.retirementAge)
      : decumulationYears
  };
}

/**
 * Run a single Monte Carlo simulation with year-by-year tracking
 * Used for generating fan chart data
 * 
 * @param {object} plan - Plan state object
 * @param {number[]} accumulationReturns - Returns for accumulation phase
 * @param {number[]} decumulationReturns - Returns for decumulation phase
 * @param {number} endAge - Age to project until
 * @returns {object} Simulation result with yearly balance data
 */
export function runSingleSimulationWithTracking(plan, accumulationReturns, decumulationReturns, endAge = 90) {
  const { projection } = plan.assumptions;
  const feeRate = projection.defaultFeeRate;
  
  // Year-by-year balance tracking
  const yearlyData = [];
  
  // Accumulation phase with variable returns
  let pensionBalance = plan.currentPension;
  let isaBalance = plan.currentIsa;
  
  const accumulationYears = plan.retirementAge - plan.currentAge;
  for (let i = 0; i < accumulationYears; i++) {
    const age = plan.currentAge + i;
    const yearReturn = accumulationReturns[i] - feeRate;
    pensionBalance = pensionBalance * (1 + yearReturn) + plan.annualPensionContribution;
    isaBalance = isaBalance * (1 + yearReturn) + plan.annualIsaContribution;
    
    // Track accumulation phase balance
    yearlyData.push({
      age,
      balance: pensionBalance + isaBalance,
      phase: 'accumulation'
    });
  }
  
  // Take PCLS
  const pclsRate = plan.assumptions.pension?.pclsRate || 0.25;
  const taxFreeCash = pensionBalance * pclsRate;
  pensionBalance = pensionBalance - taxFreeCash;
  
  // Record balance at retirement (after PCLS)
  yearlyData.push({
    age: plan.retirementAge,
    balance: pensionBalance + isaBalance,
    phase: 'retirement'
  });
  
  // Decumulation phase
  let fundsDepleted = false;
  let depletionAge = null;
  const decumulationYears = endAge - plan.retirementAge;
  
  for (let i = 0; i < decumulationYears; i++) {
    const age = plan.retirementAge + i + 1; // +1 because we're tracking end-of-year
    
    if (fundsDepleted) {
      yearlyData.push({
        age,
        balance: 0,
        phase: 'depleted'
      });
      continue;
    }
    
    const statePension = (age - 1) >= plan.statePensionAge ? plan.expectedStatePension : 0;
    
    // Simplified withdrawal - target net income minus state pension
    const neededFromPortfolio = Math.max(0, plan.targetNetIncome - statePension);
    
    // Withdraw proportionally (simplified)
    const totalBalance = pensionBalance + isaBalance;
    if (totalBalance <= neededFromPortfolio) {
      pensionBalance = 0;
      isaBalance = 0;
      fundsDepleted = true;
      depletionAge = age - 1;
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
    
    yearlyData.push({
      age,
      balance: Math.max(0, pensionBalance + isaBalance),
      phase: fundsDepleted ? 'depleted' : 'decumulation'
    });
  }
  
  return {
    yearlyData,
    finalResult: {
      retirementPot: pensionBalance + isaBalance + taxFreeCash,
      finalBalance: Math.max(0, pensionBalance + isaBalance),
      fundsDepleted,
      depletionAge,
      yearsWithFullIncome: fundsDepleted 
        ? (depletionAge - plan.retirementAge)
        : decumulationYears
    }
  };
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
    
    const result = runSingleSimulation(plan, accReturns, decReturns, endAge);
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
 * Run Monte Carlo simulation with year-by-year tracking for fan charts
 * 
 * This enhanced version tracks portfolio balance at each age across all
 * simulations, enabling visualization of confidence bands over time.
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
  
  // Track balances at each age across all iterations
  const yearlyBalances = {};  // { age: [balance1, balance2, ...] }
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const iterSeed = seed !== null ? seed + i : null;
    const accReturns = generateReturnSequence(accumulationYears, mean, volatility, iterSeed);
    const decReturns = generateReturnSequence(decumulationYears, mean, volatility, iterSeed ? iterSeed + 10000 : null);
    
    const { yearlyData, finalResult } = runSingleSimulationWithTracking(plan, accReturns, decReturns, endAge);
    
    // Store balance at each age
    for (const { age, balance } of yearlyData) {
      yearlyBalances[age] = yearlyBalances[age] || [];
      yearlyBalances[age].push(balance);
    }
    
    results.push(finalResult);
  }
  
  // Calculate percentile bands per year
  const yearlyBands = Object.entries(yearlyBalances)
    .map(([age, balances]) => {
      const sorted = [...balances].sort((a, b) => a - b);
      return {
        age: parseInt(age, 10),
        p10: percentile(sorted, 10),
        p25: percentile(sorted, 25),
        p50: percentile(sorted, 50),
        p75: percentile(sorted, 75),
        p90: percentile(sorted, 90),
        mean: sorted.reduce((a, b) => a + b, 0) / sorted.length
      };
    })
    .sort((a, b) => a.age - b.age);
  
  // Calculate depletion age histogram
  const depletionAges = results.filter(r => r.fundsDepleted).map(r => r.depletionAge);
  const depletionHistogram = generateDepletionHistogram(depletionAges, plan.retirementAge, endAge);
  
  // Calculate final balance statistics
  const finalBalances = results.map(r => r.finalBalance).sort((a, b) => a - b);
  const successCount = results.filter(r => !r.fundsDepleted).length;
  
  return {
    iterations,
    seed,
    mean,
    volatility,
    
    // Success/failure metrics
    successRate: successCount / iterations,
    confidenceLevel: successCount / iterations,
    
    // Final balance statistics
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
    
    // Depletion age distribution (only for failed iterations)
    depletionAges: {
      count: depletionAges.length,
      earliest: depletionAges.length > 0 ? Math.min(...depletionAges) : null,
      median: depletionAges.length > 0 ? percentile([...depletionAges].sort((a, b) => a - b), 50) : null,
      latest: depletionAges.length > 0 ? Math.max(...depletionAges) : null,
      histogram: depletionHistogram
    },
    
    // Year-by-year percentile bands for fan charts
    yearlyBands,
    
    // Raw results (for detailed analysis)
    results
  };
}

/**
 * Generate histogram of depletion ages
 * 
 * Creates binned counts showing distribution of when funds run out.
 * Useful for visualizing the "when might my money run out?" question.
 * 
 * @param {number[]} depletionAges - Array of depletion ages from simulations
 * @param {number} startAge - Retirement age (start of histogram range)
 * @param {number} endAge - End age for projections
 * @returns {object[]} Array of { age, count, percentage }
 */
export function generateDepletionHistogram(depletionAges, startAge, endAge) {
  if (depletionAges.length === 0) {
    return [];
  }
  
  // Create bins for each year from retirement to end
  const histogram = [];
  const total = depletionAges.length;
  
  for (let age = startAge; age <= endAge; age++) {
    const count = depletionAges.filter(a => a === age).length;
    if (count > 0) {
      histogram.push({
        age,
        count,
        percentage: (count / total) * 100
      });
    }
  }
  
  return histogram;
}

/**
 * Generate fan chart data from Monte Carlo results
 * 
 * Formats yearly bands for use with Chart.js or similar charting libraries.
 * Returns data suitable for drawing filled area bands showing uncertainty.
 * 
 * @param {object} mcResult - Result from runMonteCarloWithBands
 * @returns {object} Fan chart data ready for visualization
 */
export function generateFanChartData(mcResult) {
  const { yearlyBands, successRate, iterations } = mcResult;
  
  // Separate ages from retirement onwards for charting
  const labels = yearlyBands.map(b => b.age);
  
  return {
    labels,
    datasets: {
      // Outer band (10th to 90th percentile) - lightest shade
      p10_p90: {
        upper: yearlyBands.map(b => b.p90),
        lower: yearlyBands.map(b => b.p10),
        label: '10th-90th percentile',
        description: '80% of simulations fall within this range'
      },
      // Inner band (25th to 75th percentile) - medium shade
      p25_p75: {
        upper: yearlyBands.map(b => b.p75),
        lower: yearlyBands.map(b => b.p25),
        label: '25th-75th percentile',
        description: '50% of simulations fall within this range'
      },
      // Median line
      median: {
        data: yearlyBands.map(b => b.p50),
        label: 'Median outcome'
      },
      // Mean line
      mean: {
        data: yearlyBands.map(b => b.mean),
        label: 'Average outcome'
      }
    },
    metadata: {
      iterations,
      successRate,
      confidenceDescription: `${Math.round(successRate * 100)}% of simulations did not deplete funds`
    }
  };
}

/**
 * Get interpretation text for a confidence score
 * 
 * @param {number} successRate - Success rate from Monte Carlo (0-1)
 * @returns {object} Interpretation with text, color, and recommendation
 */
export function getConfidenceInterpretation(successRate) {
  const percentage = Math.round(successRate * 100);
  
  if (successRate >= 0.95) {
    return {
      level: 'very_high',
      label: 'Very High Confidence',
      color: '#22c55e', // green
      description: `In ${percentage} out of 100 simulated market scenarios, your money lasts until your target age.`,
      recommendation: 'Your plan appears very robust. You may even have room to increase spending or retire earlier.',
      interpretation: 'Very robust - high probability of success in most market conditions'
    };
  }
  
  if (successRate >= 0.85) {
    return {
      level: 'high',
      label: 'High Confidence',
      color: '#22c55e', // green
      description: `In ${percentage} out of 100 simulated market scenarios, your money lasts until your target age.`,
      recommendation: 'Your plan is robust with a good safety margin.',
      interpretation: 'Robust - good probability of success'
    };
  }
  
  if (successRate >= 0.70) {
    return {
      level: 'moderate',
      label: 'Moderate Confidence',
      color: '#f59e0b', // amber
      description: `In ${percentage} out of 100 simulated market scenarios, your money lasts until your target age.`,
      recommendation: 'Consider building a larger buffer through increased savings, reduced spending, or later retirement.',
      interpretation: 'Moderate - some risk of shortfall in poor market conditions'
    };
  }
  
  if (successRate >= 0.50) {
    return {
      level: 'low',
      label: 'Low Confidence',
      color: '#ef4444', // red
      description: `In only ${percentage} out of 100 simulated market scenarios, your money lasts until your target age.`,
      recommendation: 'This plan has significant risk. Strongly consider adjusting your retirement age, target income, or savings rate.',
      interpretation: 'Uncertain - significant risk of not meeting goals'
    };
  }
  
  return {
    level: 'very_low',
    label: 'Very Low Confidence',
    color: '#ef4444', // red
    description: `In only ${percentage} out of 100 simulated market scenarios, your money lasts until your target age.`,
    recommendation: 'This plan is unlikely to succeed. Major adjustments to retirement timing, income expectations, or savings are needed.',
    interpretation: 'High risk - substantial probability of failure'
  };
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
  
  // Run Monte Carlo
  const monteCarloResult = runMonteCarlo(plan, {
    iterations,
    endAge,
    volatility
  });
  
  return {
    deterministic: deterministicResult,
    monteCarlo: monteCarloResult,
    bands: {
      pessimistic: {
        successRate: monteCarloResult.statistics.finalBalance.p10,
        description: '10th percentile - poor market conditions'
      },
      expected: {
        successRate: deterministicResult.summary.successRate,
        description: 'Deterministic projection with expected returns'
      },
      optimistic: {
        successRate: monteCarloResult.statistics.finalBalance.p90,
        description: '90th percentile - favorable market conditions'
      }
    },
    robustness: {
      score: monteCarloResult.statistics.successRate,
      interpretation: interpretRobustness(monteCarloResult.statistics.successRate)
    }
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
