/**
 * RetireLens Pro - Household Plan Module
 * 
 * Couples-first retirement planning engine.
 * Single-person plans use the same structure (subset, not exception).
 * 
 * Core principle: No projections until household model is complete.
 * 
 * Data Contract:
 * - householdType: 'single' or 'couple' (MANDATORY first question)
 * - personA: always present
 * - personB: present if householdType === 'couple'
 * - pensionTypes: ['DC', 'DB', 'both', 'notSure'] per person (MANDATORY)
 * - targetNetIncome: household-level target
 */

import { createPerson, validateHousehold, getSurvivorStatus } from './household.js';
import { computeUKTax, calculateCouplesTax } from './tax.js';
import { PENSION_CONFIG, TAX_CONFIG, PROJECTION_DEFAULTS } from '../config/defaults.js';

/**
 * Pension types that can be selected
 */
export const PENSION_TYPES = Object.freeze({
  DC: 'dc',           // Defined Contribution (pots)
  DB: 'db',           // Defined Benefit (guaranteed income)
  BOTH: 'both',       // Has both DC and DB
  NOT_SURE: 'notSure' // User is uncertain
});

/**
 * Household types
 */
export const HOUSEHOLD_TYPES = Object.freeze({
  SINGLE: 'single',
  COUPLE: 'couple'
});

/**
 * PCLS strategies
 */
export const PCLS_STRATEGY = Object.freeze({
  ALL_AT_RETIREMENT: 'allAtRetirement',
  PHASED: 'phased',
  FIXED_ANNUAL: 'fixedAnnual',
  NONE: 'none'
});

/**
 * Validation status for household plan
 */
export const PLAN_STATUS = Object.freeze({
  INCOMPLETE: 'incomplete',
  PROVISIONAL: 'provisional',  // Has 'notSure' selections
  COMPLETE: 'complete'
});

/**
 * Create a person configuration for household planning
 * Enhanced to include pension type discovery
 * 
 * @param {object} options - Person configuration
 * @returns {object} Frozen person object with pension types
 */
export function createHouseholdPerson(options = {}) {
  if (typeof options.currentAge !== 'number' || options.currentAge < 18 || options.currentAge > 100) {
    throw new Error('currentAge is required and must be between 18 and 100');
  }

  // Determine pension types
  const pensionTypes = options.pensionTypes || [];
  const hasDC = pensionTypes.includes(PENSION_TYPES.DC) || pensionTypes.includes(PENSION_TYPES.BOTH);
  const hasDB = pensionTypes.includes(PENSION_TYPES.DB) || pensionTypes.includes(PENSION_TYPES.BOTH);
  const isUnsure = pensionTypes.includes(PENSION_TYPES.NOT_SURE);

  const retirementAge = safeNumber(options.retirementAge, Math.min(options.currentAge + 10, 67));
  
  // DC pension details
  const dcMonthlyContrib = safeNumber(options.dcMonthlyContrib, 0);
  const dcAnnualContrib = safeNumber(options.dcAnnualContrib, 0);
  const effectiveDcAnnual = dcMonthlyContrib > 0 ? dcMonthlyContrib * 12 : dcAnnualContrib;

  return Object.freeze({
    name: options.name || 'Person',
    currentAge: options.currentAge,
    retirementAge: retirementAge,
    
    // Pension type discovery (mandatory)
    pensionTypes: pensionTypes,
    hasDC: hasDC,
    hasDB: hasDB,
    isUnsure: isUnsure,
    
    // State Pension
    statePensionAge: safeNumber(options.statePensionAge, PENSION_CONFIG.statePensionAge),
    expectedStatePension: safeNumber(options.expectedStatePension, 11500),
    
    // DC pension (if applicable)
    dcPot: safeNumber(options.dcPot, 0),
    dcMonthlyContrib: dcMonthlyContrib,
    dcAnnualContrib: effectiveDcAnnual,
    dcAccessAge: safeNumber(options.dcAccessAge, PENSION_CONFIG.minPensionAge),
    
    // DB pension (if applicable)
    dbStartAge: safeNumber(options.dbStartAge, retirementAge),
    dbAnnualIncome: safeNumber(options.dbAnnualIncome, 0),
    dbEscalation: options.dbEscalation || 'cpi', // 'cpi', 'fixed', 'none'
    dbEscalationRate: safeNumber(options.dbEscalationRate, 0.02),
    
    // ISA
    isaBalance: safeNumber(options.isaBalance, 0),
    isaAnnualContrib: safeNumber(options.isaAnnualContrib, 0),
    
    // PCLS strategy (if DC)
    pclsStrategy: options.pclsStrategy || PCLS_STRATEGY.ALL_AT_RETIREMENT,
    pclsPhaseYears: safeNumber(options.pclsPhaseYears, 5),
    pclsFixedAnnual: safeNumber(options.pclsFixedAnnual, 0),
    
    // Personal allowance for tax
    personalAllowance: safeNumber(options.personalAllowance, TAX_CONFIG.personalAllowance),
    
    // Life expectancy for planning
    lifeExpectancy: safeNumber(options.lifeExpectancy, PROJECTION_DEFAULTS.defaultLifeExpectancy)
  });
}

/**
 * Safe number parsing helper
 */
function safeNumber(value, defaultVal = 0) {
  if (value === null || value === undefined) return defaultVal;
  const num = Number(value);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Create a household plan
 * 
 * @param {object} options - Household plan options
 * @returns {object} Frozen household plan object
 */
export function createHouseholdPlan(options = {}) {
  const householdType = options.householdType || HOUSEHOLD_TYPES.SINGLE;
  
  if (householdType !== HOUSEHOLD_TYPES.SINGLE && householdType !== HOUSEHOLD_TYPES.COUPLE) {
    throw new Error("householdType must be 'single' or 'couple'");
  }

  // Validate personA is provided
  if (!options.personA) {
    throw new Error('personA is required');
  }

  const personA = createHouseholdPerson(options.personA);
  
  // Validate personB for couples
  let personB = null;
  if (householdType === HOUSEHOLD_TYPES.COUPLE) {
    if (!options.personB) {
      throw new Error('personB is required for couple households');
    }
    personB = createHouseholdPerson(options.personB);
  }

  // Household-level settings
  const targetNetIncome = safeNumber(options.targetNetIncome, 0);
  const planningHorizonAge = safeNumber(options.planningHorizonAge, 95);

  return Object.freeze({
    householdType,
    personA,
    personB,
    targetNetIncome,
    planningHorizonAge,
    
    // Assumptions
    assumptions: Object.freeze({
      inflationRate: safeNumber(options.inflationRate, PROJECTION_DEFAULTS.inflationRate),
      growthRate: safeNumber(options.growthRate, PROJECTION_DEFAULTS.defaultGrowthRate),
      feeRate: safeNumber(options.feeRate, PROJECTION_DEFAULTS.defaultFeeRate),
      survivorSpendingRatio: safeNumber(options.survivorSpendingRatio, 0.65)
    }),
    
    // Metadata
    createdAt: new Date().toISOString(),
    version: '2.0'
  });
}

/**
 * Validate household plan completeness
 * Returns status indicating whether projections can run
 * 
 * @param {object} plan - Household plan to validate
 * @returns {object} { status, errors, warnings, tickerMessages }
 */
export function validateHouseholdPlan(plan) {
  const errors = [];
  const warnings = [];
  const tickerMessages = [];

  // Check household type
  if (!plan.householdType) {
    errors.push('Household type not specified');
  } else {
    tickerMessages.push(plan.householdType === HOUSEHOLD_TYPES.COUPLE 
      ? 'Planning for a couple ✔' 
      : 'Planning for individual ✔');
  }

  // Validate personA
  const personAValidation = validatePerson(plan.personA, 'Person A');
  errors.push(...personAValidation.errors);
  warnings.push(...personAValidation.warnings);
  tickerMessages.push(...personAValidation.tickerMessages);

  // Validate personB for couples
  if (plan.householdType === HOUSEHOLD_TYPES.COUPLE) {
    if (!plan.personB) {
      errors.push('Partner details required for couple planning');
      tickerMessages.push('Waiting for partner details…');
    } else {
      const personBValidation = validatePerson(plan.personB, 'Partner');
      errors.push(...personBValidation.errors);
      warnings.push(...personBValidation.warnings);
      tickerMessages.push(...personBValidation.tickerMessages);
    }
  }

  // Check target income
  if (!plan.targetNetIncome || plan.targetNetIncome <= 0) {
    errors.push('Target household net income required');
    tickerMessages.push('Waiting for income target…');
  } else {
    tickerMessages.push(`Target: £${plan.targetNetIncome.toLocaleString()}/year net ✔`);
  }

  // Determine status
  let status = PLAN_STATUS.COMPLETE;
  if (errors.length > 0) {
    status = PLAN_STATUS.INCOMPLETE;
  } else if (warnings.length > 0 || 
             plan.personA?.isUnsure || 
             plan.personB?.isUnsure) {
    status = PLAN_STATUS.PROVISIONAL;
  }

  // Add final ticker message
  if (status === PLAN_STATUS.COMPLETE) {
    tickerMessages.push('Household model complete ✔ Ready to project');
  } else if (status === PLAN_STATUS.PROVISIONAL) {
    tickerMessages.push('Provisional plan — some details marked "not sure"');
  }

  return {
    status,
    isComplete: status !== PLAN_STATUS.INCOMPLETE,
    canProject: status !== PLAN_STATUS.INCOMPLETE,
    errors,
    warnings,
    tickerMessages
  };
}

/**
 * Validate a single person's data
 */
function validatePerson(person, label) {
  const errors = [];
  const warnings = [];
  const tickerMessages = [];

  if (!person) {
    errors.push(`${label} details required`);
    return { errors, warnings, tickerMessages };
  }

  // Age validation
  if (!person.currentAge || person.currentAge < 18 || person.currentAge > 100) {
    errors.push(`${label}: Current age required (18-100)`);
  }

  if (!person.retirementAge || person.retirementAge < person.currentAge) {
    errors.push(`${label}: Retirement age must be at or after current age`);
  }

  // Pension type validation
  if (!person.pensionTypes || person.pensionTypes.length === 0) {
    errors.push(`${label}: Pension type required`);
    tickerMessages.push(`${label}: Pension type needed…`);
  } else {
    // Build pension type message
    const types = [];
    if (person.hasDC) types.push('DC');
    if (person.hasDB) types.push('DB');
    if (types.length > 0) {
      tickerMessages.push(`${label}: ${types.join(' + ')} pension${types.length > 1 ? 's' : ''} ✔`);
    }
    if (person.isUnsure) {
      warnings.push(`${label}: Pension type marked as "not sure" — results are provisional`);
      tickerMessages.push(`${label}: Pension type uncertain`);
    }
  }

  // DC-specific validation
  if (person.hasDC) {
    if (!person.dcPot && person.dcPot !== 0) {
      errors.push(`${label}: DC pension pot value required`);
    } else {
      tickerMessages.push(`${label}: DC pot £${person.dcPot.toLocaleString()} ✔`);
    }
  }

  // DB-specific validation
  if (person.hasDB) {
    if (!person.dbAnnualIncome || person.dbAnnualIncome <= 0) {
      errors.push(`${label}: DB pension annual income required`);
      tickerMessages.push(`${label}: DB pension — income needed…`);
    } else {
      tickerMessages.push(`${label}: DB £${person.dbAnnualIncome.toLocaleString()}/year from age ${person.dbStartAge} ✔`);
    }
  }

  // State pension
  if (person.statePensionAge && person.expectedStatePension > 0) {
    tickerMessages.push(`${label}: State Pension from age ${person.statePensionAge} ✔`);
  }

  return { errors, warnings, tickerMessages };
}

/**
 * Generate year-by-year projection for household
 * 
 * CRITICAL: This function applies tax PER PERSON, not per household
 * 
 * @param {object} plan - Validated household plan
 * @returns {object[]} Year-by-year projection
 */
export function projectHousehold(plan) {
  const validation = validateHouseholdPlan(plan);
  if (!validation.canProject) {
    throw new Error(`Cannot project: ${validation.errors.join(', ')}`);
  }

  const { personA, personB, householdType, targetNetIncome, planningHorizonAge, assumptions } = plan;
  
  // Determine start age (earliest current age)
  const startAge = householdType === HOUSEHOLD_TYPES.COUPLE && personB
    ? Math.min(personA.currentAge, personB.currentAge + (personA.currentAge - personB.currentAge))
    : personA.currentAge;

  const timeline = [];
  
  // Initialize DC pots (will change over time)
  let personADcPot = personA.dcPot || 0;
  let personBDcPot = personB?.dcPot || 0;
  
  // Initialize PCLS buckets
  let personAPclsBucket = 0;
  let personBPclsBucket = 0;
  
  // Track PCLS taken
  let personAPclsTaken = 0;
  let personBPclsTaken = 0;

  for (let personAAge = personA.currentAge; personAAge <= planningHorizonAge; personAAge++) {
    const year = personAAge - personA.currentAge;
    const personBAge = householdType === HOUSEHOLD_TYPES.COUPLE && personB
      ? personBAge_FromPersonA(personAAge, personA.currentAge, personB.currentAge)
      : null;

    // Determine if each person is retired
    const personARetired = personAAge >= personA.retirementAge;
    const personBRetired = personB ? personBAge >= personB.retirementAge : false;

    // ==== ACCUMULATION (pre-retirement) ====
    if (!personARetired && personA.hasDC) {
      const growth = personADcPot * (assumptions.growthRate - assumptions.feeRate);
      personADcPot += growth + personA.dcAnnualContrib;
    }
    if (personB && !personBRetired && personB.hasDC) {
      const growth = personBDcPot * (assumptions.growthRate - assumptions.feeRate);
      personBDcPot += growth + personB.dcAnnualContrib;
    }

    // ==== RETIREMENT TRIGGER: PCLS ====
    // PCLS is taken at retirement, treated as balance-sheet transfer to bucket
    if (personAAge === personA.retirementAge && personA.hasDC && personA.pclsStrategy !== PCLS_STRATEGY.NONE) {
      const pclsAmount = calculatePclsForPerson(personA, personADcPot);
      personAPclsBucket = pclsAmount;
      personAPclsTaken = pclsAmount;
      personADcPot -= pclsAmount;
    }
    if (personB && personBAge === personB.retirementAge && personB.hasDC && personB.pclsStrategy !== PCLS_STRATEGY.NONE) {
      const pclsAmount = calculatePclsForPerson(personB, personBDcPot);
      personBPclsBucket = pclsAmount;
      personBPclsTaken = pclsAmount;
      personBDcPot -= pclsAmount;
    }

    // ==== INCOME CALCULATION (post-retirement) ====
    let personAIncome = { statePension: 0, dbPension: 0, dcWithdrawal: 0, pclsSpend: 0 };
    let personBIncome = { statePension: 0, dbPension: 0, dcWithdrawal: 0, pclsSpend: 0 };

    // Person A income sources
    if (personARetired || personAAge >= personA.statePensionAge) {
      // State Pension
      if (personAAge >= personA.statePensionAge) {
        personAIncome.statePension = personA.expectedStatePension;
      }
      // DB Pension
      if (personA.hasDB && personAAge >= personA.dbStartAge) {
        personAIncome.dbPension = calculateDbIncomeAtAge(personA, personAAge, assumptions.inflationRate);
      }
    }

    // Person B income sources
    if (personB && (personBRetired || personBAge >= personB.statePensionAge)) {
      // State Pension
      if (personBAge >= personB.statePensionAge) {
        personBIncome.statePension = personB.expectedStatePension;
      }
      // DB Pension
      if (personB.hasDB && personBAge >= personB.dbStartAge) {
        personBIncome.dbPension = calculateDbIncomeAtAge(personB, personBAge, assumptions.inflationRate);
      }
    }

    // ==== GUARANTEED INCOME TOTALS ====
    const personAGuaranteed = personAIncome.statePension + personAIncome.dbPension;
    const personBGuaranteed = personBIncome.statePension + personBIncome.dbPension;
    const householdGuaranteed = personAGuaranteed + personBGuaranteed;

    // ==== CALCULATE DC WITHDRAWALS NEEDED ====
    // Only if either person is retired and we need more income
    const anyRetired = personARetired || personBRetired;
    let withdrawalNeeded = 0;
    let personAWithdrawal = 0;
    let personBWithdrawal = 0;
    let personAPclsUsed = 0;
    let personBPclsUsed = 0;

    if (anyRetired && targetNetIncome > 0) {
      // Calculate gross needed for household net target
      // First, what net do we get from guaranteed income?
      const personAGuaranteedTax = computeUKTax({ 
        statePension: personAIncome.statePension, 
        dbPension: personAIncome.dbPension 
      });
      const personBGuaranteedTax = personB ? computeUKTax({ 
        statePension: personBIncome.statePension, 
        dbPension: personBIncome.dbPension 
      }) : { netIncome: 0 };

      const guaranteedNet = personAGuaranteedTax.netIncome + personBGuaranteedTax.netIncome;
      const additionalNetNeeded = Math.max(0, targetNetIncome - guaranteedNet);

      if (additionalNetNeeded > 0) {
        // First, try to use PCLS bucket (tax-free, so 1:1 with net)
        const pclsAvailable = personAPclsBucket + personBPclsBucket;
        const pclsToUse = Math.min(pclsAvailable, additionalNetNeeded);
        
        // Split PCLS usage between buckets proportionally
        if (pclsToUse > 0 && pclsAvailable > 0) {
          personAPclsUsed = personAPclsBucket > 0 ? pclsToUse * (personAPclsBucket / pclsAvailable) : 0;
          personBPclsUsed = personBPclsBucket > 0 ? pclsToUse * (personBPclsBucket / pclsAvailable) : 0;
          personAPclsBucket -= personAPclsUsed;
          personBPclsBucket -= personBPclsUsed;
        }

        const stillNeeded = additionalNetNeeded - pclsToUse;

        // Then draw from DC pots (taxable)
        if (stillNeeded > 0) {
          // Split withdrawal between persons, prioritizing filling personal allowances
          const result = calculateOptimalCoupleWithdrawal(
            stillNeeded,
            { personADcPot, personBDcPot },
            { personAGuaranteedIncome: personAGuaranteed, personBGuaranteedIncome: personBGuaranteed },
            personA,
            personB
          );
          
          personAWithdrawal = result.personAWithdrawal;
          personBWithdrawal = result.personBWithdrawal;
          personADcPot -= personAWithdrawal;
          personBDcPot -= personBWithdrawal;
        }

        personAIncome.dcWithdrawal = personAWithdrawal;
        personBIncome.dcWithdrawal = personBWithdrawal;
        personAIncome.pclsSpend = personAPclsUsed;
        personBIncome.pclsSpend = personBPclsUsed;
      }
    }

    // ==== TAX CALCULATION (PER PERSON) ====
    const personATaxResult = computeUKTax({
      statePension: personAIncome.statePension,
      dbPension: personAIncome.dbPension,
      pensionWithdrawal: personAIncome.dcWithdrawal,
      pclsWithdrawal: personAIncome.pclsSpend // Tax-free
    });

    const personBTaxResult = personB ? computeUKTax({
      statePension: personBIncome.statePension,
      dbPension: personBIncome.dbPension,
      pensionWithdrawal: personBIncome.dcWithdrawal,
      pclsWithdrawal: personBIncome.pclsSpend // Tax-free
    }) : { netIncome: 0, incomeTax: 0 };

    const householdNetIncome = personATaxResult.netIncome + personBTaxResult.netIncome;
    const householdTax = personATaxResult.incomeTax + personBTaxResult.incomeTax;

    // ==== APPLY GROWTH TO REMAINING DC POTS (post-retirement) ====
    if (personARetired && personA.hasDC && personADcPot > 0) {
      const growth = personADcPot * (assumptions.growthRate - assumptions.feeRate);
      personADcPot += growth;
    }
    if (personB && personBRetired && personB.hasDC && personBDcPot > 0) {
      const growth = personBDcPot * (assumptions.growthRate - assumptions.feeRate);
      personBDcPot += growth;
    }

    // ==== WITHDRAWAL RATES ====
    // Peak withdrawal rate during bridge years (before all guaranteed income active)
    // Steady-state rate after State Pension kicks in
    const totalDcBalance = personADcPot + personBDcPot;
    const totalDcWithdrawal = personAWithdrawal + personBWithdrawal;
    const withdrawalRate = totalDcBalance > 0 ? (totalDcWithdrawal / totalDcBalance) : 0;

    const isBeforeAllStatePensions = (personAAge < personA.statePensionAge) ||
      (personB && personBAge < personB.statePensionAge);

    // ==== RECORD YEAR ====
    timeline.push({
      year,
      personAAge,
      personBAge,
      
      // Retirement status
      personARetired,
      personBRetired,
      anyRetired,
      
      // Income by source
      personAIncome,
      personBIncome,
      
      // Tax (per person)
      personATax: personATaxResult.incomeTax,
      personBTax: personBTaxResult.incomeTax,
      householdTax,
      
      // Net income
      personANetIncome: personATaxResult.netIncome,
      personBNetIncome: personBTaxResult.netIncome,
      householdNetIncome,
      targetMet: householdNetIncome >= targetNetIncome * 0.99, // 1% tolerance
      
      // Balances
      personADcPot: Math.max(0, personADcPot),
      personBDcPot: Math.max(0, personBDcPot),
      personAPclsBucket,
      personBPclsBucket,
      totalDcBalance: Math.max(0, personADcPot + personBDcPot),
      
      // Withdrawal metrics
      withdrawalRate,
      isBridgeYear: anyRetired && isBeforeAllStatePensions,
      
      // PCLS tracking
      personAPclsTaken: personAAge === personA.retirementAge ? personAPclsTaken : 0,
      personBPclsTaken: personB && personBAge === personB.retirementAge ? personBPclsTaken : 0
    });
  }

  return timeline;
}

/**
 * Helper: Calculate person B's age from person A's age
 */
function personBAge_FromPersonA(personAAge, personACurrentAge, personBCurrentAge) {
  const ageDiff = personACurrentAge - personBCurrentAge;
  return personAAge - ageDiff;
}

/**
 * Calculate PCLS amount based on strategy
 */
function calculatePclsForPerson(person, dcPot) {
  if (person.pclsStrategy === PCLS_STRATEGY.NONE) {
    return 0;
  }
  // Maximum is 25% of pot
  return dcPot * 0.25;
}

/**
 * Calculate DB income at a given age with escalation
 */
function calculateDbIncomeAtAge(person, age, inflationRate) {
  if (age < person.dbStartAge) return 0;
  
  const yearsReceiving = age - person.dbStartAge;
  let income = person.dbAnnualIncome;
  
  switch (person.dbEscalation) {
    case 'cpi':
      income = person.dbAnnualIncome * Math.pow(1 + inflationRate, yearsReceiving);
      break;
    case 'fixed':
      income = person.dbAnnualIncome * Math.pow(1 + person.dbEscalationRate, yearsReceiving);
      break;
    case 'none':
    default:
      income = person.dbAnnualIncome;
      break;
  }
  
  return Math.round(income * 100) / 100;
}

/**
 * Calculate optimal withdrawal split between couple
 * Prioritizes filling personal allowances to minimize tax
 */
function calculateOptimalCoupleWithdrawal(targetNet, pots, guaranteedIncome, personA, personB) {
  const { personADcPot, personBDcPot } = pots;
  const { personAGuaranteedIncome, personBGuaranteedIncome } = guaranteedIncome;
  
  // If single, all withdrawal from person A
  if (!personB) {
    // Calculate gross needed for net
    const paRemaining = Math.max(0, TAX_CONFIG.personalAllowance - personAGuaranteedIncome);
    let withdrawal = 0;
    
    if (targetNet <= paRemaining) {
      // Within PA, gross = net
      withdrawal = Math.min(targetNet, personADcPot);
    } else {
      // Need to gross up for tax
      withdrawal = Math.min(grossUpForTax(targetNet, personAGuaranteedIncome), personADcPot);
    }
    
    return {
      personAWithdrawal: withdrawal,
      personBWithdrawal: 0
    };
  }

  // For couples: try to use both personal allowances
  const personAPaRemaining = Math.max(0, TAX_CONFIG.personalAllowance - personAGuaranteedIncome);
  const personBPaRemaining = Math.max(0, TAX_CONFIG.personalAllowance - personBGuaranteedIncome);
  const totalPaRemaining = personAPaRemaining + personBPaRemaining;

  // First fill PAs (tax-free)
  const fillPaNet = Math.min(targetNet, totalPaRemaining);
  const stillNeededAfterPa = targetNet - fillPaNet;

  // Split PA fill proportionally
  let personAWithdrawal = totalPaRemaining > 0 
    ? fillPaNet * (personAPaRemaining / totalPaRemaining) 
    : 0;
  let personBWithdrawal = totalPaRemaining > 0 
    ? fillPaNet * (personBPaRemaining / totalPaRemaining) 
    : 0;

  // For amounts above PA, gross up and split between people
  if (stillNeededAfterPa > 0) {
    // Gross up assuming basic rate
    const grossNeeded = stillNeededAfterPa / (1 - 0.20);
    
    // Split proportionally based on available pots
    const totalPots = personADcPot + personBDcPot;
    if (totalPots > 0) {
      const additionalA = Math.min(grossNeeded * (personADcPot / totalPots), personADcPot - personAWithdrawal);
      const additionalB = Math.min(grossNeeded * (personBDcPot / totalPots), personBDcPot - personBWithdrawal);
      personAWithdrawal += Math.max(0, additionalA);
      personBWithdrawal += Math.max(0, additionalB);
    }
  }

  // Ensure we don't exceed available pots
  personAWithdrawal = Math.min(personAWithdrawal, personADcPot);
  personBWithdrawal = Math.min(personBWithdrawal, personBDcPot);

  return {
    personAWithdrawal: Math.max(0, personAWithdrawal),
    personBWithdrawal: Math.max(0, personBWithdrawal)
  };
}

/**
 * Gross up an amount to account for income tax
 */
function grossUpForTax(netNeeded, existingTaxableIncome) {
  const paRemaining = Math.max(0, TAX_CONFIG.personalAllowance - existingTaxableIncome);
  
  if (netNeeded <= paRemaining) {
    return netNeeded; // Within PA, no tax
  }
  
  const netWithinPa = paRemaining;
  const netAbovePa = netNeeded - paRemaining;
  
  // Assume basic rate for simplicity
  const grossAbovePa = netAbovePa / (1 - 0.20);
  
  return netWithinPa + grossAbovePa;
}

/**
 * Calculate withdrawal rate metrics from projection
 * Returns peak (bridge) and steady-state rates
 */
export function calculateWithdrawalRates(timeline) {
  const bridgeYears = timeline.filter(y => y.isBridgeYear && y.withdrawalRate > 0);
  const steadyYears = timeline.filter(y => !y.isBridgeYear && y.anyRetired && y.withdrawalRate > 0);

  const peakRate = bridgeYears.length > 0 
    ? Math.max(...bridgeYears.map(y => y.withdrawalRate))
    : 0;
    
  const steadyRates = steadyYears.map(y => y.withdrawalRate);
  const steadyStateRate = steadyRates.length > 0
    ? steadyRates.reduce((a, b) => a + b, 0) / steadyRates.length
    : 0;

  return {
    peakWithdrawalRate: peakRate,
    peakWithdrawalRatePercent: (peakRate * 100).toFixed(1),
    steadyStateWithdrawalRate: steadyStateRate,
    steadyStateWithdrawalRatePercent: (steadyStateRate * 100).toFixed(1),
    bridgeYearsCount: bridgeYears.length,
    explanation: bridgeYears.length > 0 
      ? `Peak ${(peakRate * 100).toFixed(1)}% during ${bridgeYears.length} bridge year(s), settling to ${(steadyStateRate * 100).toFixed(1)}% steady-state`
      : `Steady-state ${(steadyStateRate * 100).toFixed(1)}%`
  };
}

/**
 * Generate ticker messages for current plan state
 * Used for progressive bottom ticker UX
 */
export function generateTickerMessages(plan) {
  const validation = validateHouseholdPlan(plan);
  
  // Filter to unique, relevant messages
  const messages = validation.tickerMessages.filter((msg, idx, arr) => 
    arr.indexOf(msg) === idx && msg.length > 0
  );

  // Never show:
  // - Confidence percentages
  // - Withdrawal rates
  // - Sustainability verdicts
  
  return {
    messages,
    isComplete: validation.isComplete,
    status: validation.status
  };
}

/**
 * Summary of household plan for results display
 */
export function getHouseholdPlanSummary(plan, timeline) {
  const validation = validateHouseholdPlan(plan);
  const withdrawalRates = timeline ? calculateWithdrawalRates(timeline) : null;

  // Find first year of retirement
  const firstRetirementYear = timeline?.find(y => y.anyRetired);
  
  // Find year when all state pensions active
  const allStatePensionYear = timeline?.find(y => 
    y.anyRetired && 
    (!plan.personB || (y.personAAge >= plan.personA.statePensionAge && y.personBAge >= plan.personB.statePensionAge))
  );

  // Calculate total guaranteed income when fully active
  const maxGuaranteedIncome = timeline ? Math.max(...timeline.map(y => 
    (y.personAIncome?.statePension || 0) + (y.personAIncome?.dbPension || 0) +
    (y.personBIncome?.statePension || 0) + (y.personBIncome?.dbPension || 0)
  )) : 0;

  // Total PCLS
  const totalPcls = (timeline?.[0]?.personAPclsTaken || 0) + 
    (timeline?.find(y => y.personBPclsTaken > 0)?.personBPclsTaken || 0);

  return {
    householdType: plan.householdType,
    targetNetIncome: plan.targetNetIncome,
    
    // Pension types identified
    pensionsIdentified: {
      personA: plan.personA.pensionTypes.join(', '),
      personB: plan.personB?.pensionTypes.join(', ') || null
    },
    
    // Guaranteed income
    maxGuaranteedIncome,
    gapToTarget: Math.max(0, plan.targetNetIncome - maxGuaranteedIncome),
    
    // PCLS
    totalPcls,
    
    // Withdrawal rates (never single number)
    withdrawalRates,
    
    // Validation
    planStatus: validation.status,
    isComplete: validation.isComplete,
    errors: validation.errors,
    warnings: validation.warnings
  };
}
