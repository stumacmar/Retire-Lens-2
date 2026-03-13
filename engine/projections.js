/**
 * RetireLens 2 - Projection Engine
 * 
 * Pure functions for deterministic financial projections.
 * All functions are stateless and side-effect free.
 */

import { calculateOptimalWithdrawal, calculatePCLS, calculatePCLSStrategy } from './withdrawals.js';
import { calculateTaxFromGross } from './tax.js';
import { createAssumptions, PENSION_CONFIG, TAX_CONFIG } from '../config/defaults.js';
import { calculateSpendingAtAge, createSpendingRules } from './spendingPolicy.js';

/**
 * Create a new plan state object
 * Plan A and Plan B are isolated state objects with no shared mutable state
 * 
 * @param {object} inputs - User inputs for the plan
 * @returns {object} Immutable plan state
 */
export function createPlan(inputs) {
  const {
    name = 'Plan A',
    currentAge,
    retirementAge,
    targetNetIncome,
    currentPension = 0,
    currentIsa = 0,
    annualPensionContribution = 0,
    annualIsaContribution = 0,
    statePensionAge = PENSION_CONFIG.statePensionAge,
    expectedStatePension = 0,
    assumptions = {},
    // New: optional spending rules
    spendingRules = null,
    applyAgeBasedSpendingReductions = false,
    // DB pension parameters
    hasDBPension = false,
    dbPensionAmount = 0,
    dbPensionStartAge = 65,
    dbPensionEscalation = 'cpi',
    dbPensionEscalationRate = 0.02,
    // State pension real growth (triple lock premium over CPI)
    statePensionRealGrowth = 0.01,
    // PCLS strategy
    pclsStrategy = 'all_at_retirement',
    pclsReinvest = true,
    // Tax jurisdiction
    taxJurisdiction = 'england'
  } = inputs;

  // Validate required fields
  if (typeof currentAge !== 'number' || currentAge < 18 || currentAge > 100) {
    throw new Error('Invalid currentAge: must be between 18 and 100');
  }
  if (typeof retirementAge !== 'number' || retirementAge < currentAge) {
    throw new Error('Invalid retirementAge: must be greater than currentAge');
  }
  if (typeof targetNetIncome !== 'number' || targetNetIncome < 0) {
    throw new Error('Invalid targetNetIncome: must be a positive number');
  }

  // Create spending rules if not provided
  const effectiveSpendingRules = spendingRules || createSpendingRules({
    baseSpending: targetNetIncome,
    applyDefaultReductions: applyAgeBasedSpendingReductions
  });

  // Build assumptions - apply Scottish tax bands if jurisdiction is Scotland
  const effectiveAssumptions = createAssumptions(assumptions);
  if (taxJurisdiction === 'scotland') {
    effectiveAssumptions.tax.bands = TAX_CONFIG.scottishBands;
  }

  return Object.freeze({
    name,
    currentAge,
    retirementAge,
    targetNetIncome,
    currentPension,
    currentIsa,
    annualPensionContribution,
    annualIsaContribution,
    statePensionAge,
    expectedStatePension,
    hasDBPension: Boolean(hasDBPension),
    dbPensionAmount: hasDBPension ? (dbPensionAmount || 0) : 0,
    dbPensionStartAge,
    dbPensionEscalation,
    dbPensionEscalationRate,
    statePensionRealGrowth,
    pclsStrategy,
    pclsReinvest,
    taxJurisdiction,
    assumptions: effectiveAssumptions,
    spendingRules: effectiveSpendingRules,
    createdAt: new Date().toISOString()
  });
}

/**
 * Project accumulation phase (before retirement)
 * 
 * @param {object} plan - Plan state object
 * @returns {object} Year-by-year accumulation projection
 */
export function projectAccumulation(plan) {
  const {
    currentAge,
    retirementAge,
    currentPension,
    currentIsa,
    annualPensionContribution,
    annualIsaContribution,
    assumptions
  } = plan;

  const { projection } = assumptions;
  const growthRate = projection.defaultGrowthRate;
  const feeRate = projection.defaultFeeRate;
  const netGrowthRate = growthRate - feeRate;

  const years = [];
  let pensionBalance = currentPension;
  let isaBalance = currentIsa;

  for (let age = currentAge; age < retirementAge; age++) {
    const yearStart = {
      age,
      pension: pensionBalance,
      isa: isaBalance,
      total: pensionBalance + isaBalance
    };

    // Apply growth
    const pensionGrowth = pensionBalance * netGrowthRate;
    const isaGrowth = isaBalance * netGrowthRate;

    // Add contributions with mid-year approximation (contributions earn ~half a year of growth)
    const contribGrowthFactor = 1 + (netGrowthRate / 2);
    pensionBalance = pensionBalance + pensionGrowth + (annualPensionContribution * contribGrowthFactor);
    isaBalance = isaBalance + isaGrowth + (annualIsaContribution * contribGrowthFactor);

    const yearEnd = {
      pension: pensionBalance,
      isa: isaBalance,
      total: pensionBalance + isaBalance
    };

    years.push({
      age,
      startBalances: yearStart,
      growth: {
        pension: pensionGrowth,
        isa: isaGrowth
      },
      contributions: {
        pension: annualPensionContribution,
        isa: annualIsaContribution
      },
      endBalances: yearEnd
    });
  }

  return {
    startAge: currentAge,
    endAge: retirementAge,
    years,
    finalBalances: {
      pension: pensionBalance,
      isa: isaBalance,
      total: pensionBalance + isaBalance
    },
    totalContributions: {
      pension: annualPensionContribution * (retirementAge - currentAge),
      isa: annualIsaContribution * (retirementAge - currentAge)
    }
  };
}

/**
 * Project decumulation phase (retirement)
 * 
 * @param {object} plan - Plan state object
 * @param {object} accumulationResult - Result from projectAccumulation
 * @param {number} endAge - Age to project until (default: 90)
 * @returns {object} Year-by-year decumulation projection
 */
export function projectDecumulation(plan, accumulationResult, endAge = 90) {
  const {
    retirementAge,
    targetNetIncome,
    statePensionAge,
    expectedStatePension,
    hasDBPension,
    dbPensionAmount,
    dbPensionStartAge,
    dbPensionEscalationRate,
    statePensionRealGrowth,
    pclsStrategy,
    pclsReinvest,
    assumptions,
    spendingRules
  } = plan;

  const { projection, tax: taxConfig } = assumptions;
  const growthRate = projection.defaultGrowthRate;
  const feeRate = projection.defaultFeeRate;
  const netGrowthRate = growthRate - feeRate;

  let pensionBalance = accumulationResult.finalBalances.pension;
  let isaBalance = accumulationResult.finalBalances.isa;

  // FIX 1.4: Use strategy-aware PCLS calculation
  const pclsScheduleResult = calculatePCLSStrategy(pensionBalance, {
    strategy: pclsStrategy || 'all_at_retirement',
    retirementAge,
    deferredAge: statePensionAge,
    reinvest: pclsReinvest !== false,
    phaseYears: 5
  });

  // For strategies that take PCLS immediately at retirement, deduct from pension balance now
  // For deferred/phased, we'll deduct year by year
  const pclsByAge = new Map();
  pclsScheduleResult.schedule.forEach(entry => {
    pclsByAge.set(entry.age, entry.amount);
  });

  // Handle immediate PCLS (all_at_retirement) upfront to keep backward compat
  let taxFreeCash = pclsScheduleResult.totalPCLS;
  if (pclsStrategy === 'all_at_retirement' || !pclsStrategy) {
    // Deduct full PCLS immediately
    pensionBalance -= taxFreeCash;
    // Clear the schedule since we've handled it
    pclsByAge.clear();
  } else {
    // For phased/deferred, PCLS will be deducted year-by-year
    // Don't deduct upfront - taxFreeCash tracks total taken
    taxFreeCash = 0;
  }

  const years = [];
  let fundsDepleted = false;
  let depletionAge = null;

  for (let age = retirementAge; age <= endAge; age++) {
    // Calculate age-adjusted spending target
    const ageAdjustedSpending = spendingRules 
      ? calculateSpendingAtAge(
          spendingRules.baseSpending,
          age,
          {
            ageAdjustments: spendingRules.ageAdjustments,
            applyDefaultReductions: spendingRules.applyDefaultReductions
          }
        )
      : targetNetIncome;

    // FIX 1.4: Apply PCLS for non-immediate strategies
    const pclsThisYear = pclsByAge.get(age) || 0;
    if (pclsThisYear > 0) {
      pensionBalance = Math.max(0, pensionBalance - pclsThisYear);
      taxFreeCash += pclsThisYear;
      // If reinvesting, add to ISA balance (capped at annual ISA limit £20k; excess held as cash)
      if (pclsReinvest !== false) {
        const isaAnnualCap = 20000;
        const toIsa = Math.min(pclsThisYear, isaAnnualCap);
        isaBalance += toIsa;
        // Excess beyond ISA cap is not modelled separately in this projection
        // (use projectPCLSReinvestment() for full ISA cap enforcement)
      }
    }

    if (fundsDepleted) {
      // FIX 1.3: State pension grows in real terms (triple lock premium) after depletion
      const spYearsFromStart = Math.max(0, age - statePensionAge);
      const depletedStatePension = age >= statePensionAge
        ? expectedStatePension * Math.pow(1 + (statePensionRealGrowth || 0.01), spYearsFromStart)
        : 0;
      // FIX 1.1: DB pension at depletion
      const depletedDbPension = (hasDBPension && age >= dbPensionStartAge)
        ? dbPensionAmount * Math.pow(1 + (dbPensionEscalationRate || 0.02), age - dbPensionStartAge)
        : 0;
      years.push({
        age,
        fundsDepleted: true,
        targetSpending: ageAdjustedSpending,
        statePension: depletedStatePension,
        dbPension: depletedDbPension,
        netIncome: depletedStatePension + depletedDbPension
      });
      continue;
    }

    // FIX 1.3: State pension grows at real growth rate (triple lock premium over CPI)
    const spYearsFromStart = Math.max(0, age - statePensionAge);
    const statePension = age >= statePensionAge
      ? expectedStatePension * Math.pow(1 + (statePensionRealGrowth || 0.01), spYearsFromStart)
      : 0;

    // FIX 1.1: DB pension income (escalated by inflation assumption)
    const dbPension = (hasDBPension && age >= dbPensionStartAge)
      ? dbPensionAmount * Math.pow(1 + (dbPensionEscalationRate || 0.02), age - dbPensionStartAge)
      : 0;

    const yearStart = {
      age,
      pension: pensionBalance,
      isa: isaBalance,
      total: pensionBalance + isaBalance
    };

    // FIX 1.1: Pass combined guaranteed income (SP + DB) to withdrawal calculator
    const withdrawalResult = calculateOptimalWithdrawal(
      ageAdjustedSpending,
      { pension: pensionBalance, isa: isaBalance },
      { statePensionIncome: statePension + dbPension, taxConfig }
    );

    // Update balances after withdrawal
    pensionBalance = withdrawalResult.newBalances.pension;
    isaBalance = withdrawalResult.newBalances.isa;

    // Apply growth to remaining balances
    const pensionGrowth = pensionBalance * netGrowthRate;
    const isaGrowth = isaBalance * netGrowthRate;
    pensionBalance += pensionGrowth;
    isaBalance += isaGrowth;

    // Check if funds depleted
    if (pensionBalance <= 0 && isaBalance <= 0) {
      fundsDepleted = true;
      depletionAge = age + 1;
    }

    const yearEnd = {
      pension: Math.max(0, pensionBalance),
      isa: Math.max(0, isaBalance),
      total: Math.max(0, pensionBalance) + Math.max(0, isaBalance)
    };

    years.push({
      age,
      startBalances: yearStart,
      statePension,
      dbPension,
      targetSpending: ageAdjustedSpending,
      withdrawals: withdrawalResult.withdrawals,
      taxPaid: withdrawalResult.taxPaid,
      netIncome: withdrawalResult.netIncome,
      growth: {
        pension: pensionGrowth,
        isa: isaGrowth
      },
      endBalances: yearEnd,
      fundsDepleted: false
    });
  }

  return {
    startAge: retirementAge,
    endAge,
    pclsTaken: taxFreeCash,
    years,
    fundsDepleted,
    depletionAge,
    finalBalances: {
      pension: Math.max(0, pensionBalance),
      isa: Math.max(0, isaBalance),
      total: Math.max(0, pensionBalance) + Math.max(0, isaBalance)
    }
  };
}

/**
 * Run complete projection for a plan
 * 
 * @param {object} plan - Plan state object
 * @param {object} options - Projection options
 * @returns {object} Complete projection results
 */
export function runProjection(plan, options = {}) {
  const { endAge = 90 } = options;

  const accumulation = projectAccumulation(plan);
  const decumulation = projectDecumulation(plan, accumulation, endAge);

  // Calculate summary metrics
  const totalYearsInRetirement = endAge - plan.retirementAge;
  const yearsWithFullIncome = decumulation.fundsDepleted 
    ? (decumulation.depletionAge - plan.retirementAge)
    : totalYearsInRetirement;

  const successRate = yearsWithFullIncome / totalYearsInRetirement;

  // Calculate total income received
  const totalNetIncome = decumulation.years.reduce((sum, year) => {
    return sum + (year.netIncome || 0);
  }, 0);

  // Calculate total tax paid
  const totalTaxPaid = decumulation.years.reduce((sum, year) => {
    return sum + (year.taxPaid || 0);
  }, 0);

  return {
    plan: {
      name: plan.name,
      currentAge: plan.currentAge,
      retirementAge: plan.retirementAge,
      targetNetIncome: plan.targetNetIncome
    },
    accumulation,
    decumulation,
    summary: {
      retirementPot: accumulation.finalBalances.total,
      pclsTaken: decumulation.pclsTaken,
      yearsWithFullIncome,
      totalYearsInRetirement,
      successRate,
      fundsDepleted: decumulation.fundsDepleted,
      depletionAge: decumulation.depletionAge,
      totalNetIncome,
      totalTaxPaid,
      averageNetIncome: totalNetIncome / totalYearsInRetirement,
      finalBalance: decumulation.finalBalances.total
    },
    assumptions: plan.assumptions
  };
}

/**
 * Compare two plans (Plan A vs Plan B)
 * 
 * @param {object} planA - First plan projection result
 * @param {object} planB - Second plan projection result
 * @returns {object} Comparison with numeric deltas
 */
export function comparePlans(planAResult, planBResult) {
  const a = planAResult.summary;
  const b = planBResult.summary;

  return {
    planA: planAResult,
    planB: planBResult,
    deltas: {
      retirementPot: b.retirementPot - a.retirementPot,
      pclsTaken: b.pclsTaken - a.pclsTaken,
      yearsWithFullIncome: b.yearsWithFullIncome - a.yearsWithFullIncome,
      successRate: b.successRate - a.successRate,
      totalNetIncome: b.totalNetIncome - a.totalNetIncome,
      totalTaxPaid: b.totalTaxPaid - a.totalTaxPaid,
      averageNetIncome: b.averageNetIncome - a.averageNetIncome,
      finalBalance: b.finalBalance - a.finalBalance
    },
    percentageChanges: {
      retirementPot: a.retirementPot > 0 ? ((b.retirementPot - a.retirementPot) / a.retirementPot) * 100 : null,
      totalNetIncome: a.totalNetIncome > 0 ? ((b.totalNetIncome - a.totalNetIncome) / a.totalNetIncome) * 100 : null,
      totalTaxPaid: a.totalTaxPaid > 0 ? ((b.totalTaxPaid - a.totalTaxPaid) / a.totalTaxPaid) * 100 : null
    }
  };
}

/**
 * Answer the core question: "Can I retire at age X with £Y net income?"
 * 
 * @param {object} plan - Plan state object
 * @param {number} endAge - Age to project until
 * @returns {object} Answer with confidence metrics
 */
export function canIRetire(plan, endAge = 90) {
  const projection = runProjection(plan, { endAge });
  const { summary } = projection;

  const answer = {
    question: `Can I retire at age ${plan.retirementAge} with £${plan.targetNetIncome.toLocaleString()} net income?`,
    answer: summary.successRate >= 1.0 ? 'YES' : 'PARTIAL',
    confidence: summary.successRate,
    details: {
      targetIncome: plan.targetNetIncome,
      yearsSupported: summary.yearsWithFullIncome,
      yearsRequired: summary.totalYearsInRetirement,
      shortfallAge: summary.depletionAge,
      retirementPot: summary.retirementPot,
      pclsTaken: summary.pclsTaken
    },
    projection
  };

  if (summary.successRate < 1.0) {
    answer.suggestion = summary.depletionAge
      ? `Funds may run out at age ${summary.depletionAge}. Consider increasing contributions or reducing target income.`
      : 'Consider adjusting your retirement plans.';
  }

  return answer;
}

/**
 * Generate debug output with full year-by-year tables
 * 
 * @param {object} projectionResult - Result from runProjection
 * @returns {string} Formatted debug output
 */
export function generateDebugOutput(projectionResult) {
  const { plan, accumulation, decumulation, summary } = projectionResult;
  
  let output = [];
  
  output.push('═══════════════════════════════════════════════════════════════');
  output.push(`  RETIRELENS 2 DEBUG OUTPUT - ${plan.name}`);
  output.push('═══════════════════════════════════════════════════════════════');
  output.push('');
  output.push('PLAN SUMMARY');
  output.push('─────────────────────────────────────────────────────────────────');
  output.push(`  Current Age:       ${plan.currentAge}`);
  output.push(`  Retirement Age:    ${plan.retirementAge}`);
  output.push(`  Target Net Income: £${plan.targetNetIncome.toLocaleString()}`);
  output.push('');
  
  output.push('ACCUMULATION PHASE');
  output.push('─────────────────────────────────────────────────────────────────');
  output.push('  Age  | Pension Start | Growth    | Contrib  | Pension End  | ISA End    | Total');
  output.push('  ─────┼───────────────┼───────────┼──────────┼──────────────┼────────────┼────────────');
  
  for (const year of accumulation.years) {
    const row = [
      String(year.age).padStart(4),
      `£${Math.round(year.startBalances.pension).toLocaleString().padStart(10)}`,
      `£${Math.round(year.growth.pension).toLocaleString().padStart(8)}`,
      `£${Math.round(year.contributions.pension).toLocaleString().padStart(7)}`,
      `£${Math.round(year.endBalances.pension).toLocaleString().padStart(10)}`,
      `£${Math.round(year.endBalances.isa).toLocaleString().padStart(9)}`,
      `£${Math.round(year.endBalances.total).toLocaleString().padStart(10)}`
    ];
    output.push(`  ${row.join(' | ')}`);
  }
  
  output.push('');
  output.push(`  Total at retirement: £${Math.round(accumulation.finalBalances.total).toLocaleString()}`);
  output.push(`  PCLS Taken: £${Math.round(decumulation.pclsTaken).toLocaleString()}`);
  output.push('');
  
  output.push('DECUMULATION PHASE');
  output.push('─────────────────────────────────────────────────────────────────');
  output.push('  Age  | Pension    | ISA        | State Pen | Withdrawal | Tax      | Net Income');
  output.push('  ─────┼────────────┼────────────┼───────────┼────────────┼──────────┼────────────');
  
  for (const year of decumulation.years) {
    if (year.fundsDepleted && !year.startBalances) {
      output.push(`  ${String(year.age).padStart(4)} | FUNDS DEPLETED - Income: £${Math.round(year.netIncome || 0).toLocaleString()}`);
      continue;
    }
    const row = [
      String(year.age).padStart(4),
      `£${Math.round(year.startBalances.pension).toLocaleString().padStart(9)}`,
      `£${Math.round(year.startBalances.isa).toLocaleString().padStart(9)}`,
      `£${Math.round(year.statePension).toLocaleString().padStart(8)}`,
      `£${Math.round(year.withdrawals.total).toLocaleString().padStart(9)}`,
      `£${Math.round(year.taxPaid).toLocaleString().padStart(7)}`,
      `£${Math.round(year.netIncome).toLocaleString().padStart(9)}`
    ];
    output.push(`  ${row.join(' | ')}`);
  }
  
  output.push('');
  output.push('OUTCOME SUMMARY');
  output.push('─────────────────────────────────────────────────────────────────');
  output.push(`  Success Rate:      ${(summary.successRate * 100).toFixed(1)}%`);
  output.push(`  Years Supported:   ${summary.yearsWithFullIncome} of ${summary.totalYearsInRetirement}`);
  output.push(`  Total Tax Paid:    £${Math.round(summary.totalTaxPaid).toLocaleString()}`);
  output.push(`  Total Net Income:  £${Math.round(summary.totalNetIncome).toLocaleString()}`);
  output.push(`  Final Balance:     £${Math.round(summary.finalBalance).toLocaleString()}`);
  
  if (summary.fundsDepleted) {
    output.push(`  ⚠️  Funds depleted at age ${summary.depletionAge}`);
  }
  
  output.push('═══════════════════════════════════════════════════════════════');
  
  return output.join('\n');
}
