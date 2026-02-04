/**
 * RetireLens 2 - Household Module
 * 
 * Models single-person and couple households for retirement planning.
 * Handles different ages, retirement dates, and State Pension timings.
 * 
 * Key considerations for couples:
 * - Different ages mean different income patterns
 * - Two State Pensions may start at different times
 * - Two Personal Allowances for tax efficiency
 * - Survivor spending is typically lower (60-70% of joint)
 * 
 * Enhanced for RetireLens Pro:
 * - Full DC pension support (pot, monthly/annual contributions)
 * - DB pension support (annual amount, start age)
 * - ISA support (balance, annual contributions)
 */

/**
 * Default household configuration
 */
export const HOUSEHOLD_DEFAULTS = Object.freeze({
  statePensionAge: 67,
  expectedStatePension: 11500,  // Full new State Pension ~£11,500/year
  lifeExpectancy: 90,
  survivorSpendingRatio: 0.65   // Survivor needs ~65% of joint spending
});

/**
 * Safe number parsing - returns default if invalid
 * @param {*} value - Value to parse
 * @param {number} defaultVal - Default value if parsing fails
 * @returns {number} Parsed value or default
 */
function safeNumber(value, defaultVal = 0) {
  if (value === null || value === undefined) return defaultVal;
  const num = Number(value);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Create a person configuration with full financial details
 * 
 * @param {object} options - Person configuration
 * @param {string} [options.name='Person'] - Person's name
 * @param {number} options.currentAge - Current age (required, 18-100)
 * @param {number} [options.retirementAge] - Target retirement age
 * @param {number} [options.statePensionAge=67] - State pension start age
 * @param {number} [options.expectedStatePension=11500] - Annual state pension
 * @param {number} [options.lifeExpectancy=90] - Life expectancy for planning
 * @param {number} [options.dcPot=0] - Current DC pension pot value
 * @param {number} [options.dcMonthlyContrib=0] - Monthly DC pension contribution
 * @param {number} [options.dcAnnualContrib=0] - Annual DC pension contribution (alternative to monthly)
 * @param {number} [options.dbAnnual=0] - Annual DB pension amount
 * @param {number} [options.dbStartAge] - Age when DB pension starts (defaults to retirementAge)
 * @param {number} [options.isaBalance=0] - Current ISA balance
 * @param {number} [options.isaAnnualContrib=0] - Annual ISA contribution
 * @returns {object} Frozen person object
 */
export function createPerson(options = {}) {
  if (typeof options.currentAge !== 'number' || options.currentAge < 18 || options.currentAge > 100) {
    throw new Error('currentAge is required and must be between 18 and 100');
  }
  
  const retirementAge = safeNumber(options.retirementAge, Math.min(options.currentAge + 10, 67));
  
  // Calculate effective annual DC contribution (monthly * 12 or annual)
  const monthlyContrib = safeNumber(options.dcMonthlyContrib, 0);
  const annualContrib = safeNumber(options.dcAnnualContrib, 0);
  const effectiveDcAnnual = monthlyContrib > 0 ? monthlyContrib * 12 : annualContrib;
  
  return Object.freeze({
    name: options.name || 'Person',
    currentAge: options.currentAge,
    retirementAge: retirementAge,
    statePensionAge: safeNumber(options.statePensionAge, HOUSEHOLD_DEFAULTS.statePensionAge),
    expectedStatePension: safeNumber(options.expectedStatePension, HOUSEHOLD_DEFAULTS.expectedStatePension),
    lifeExpectancy: safeNumber(options.lifeExpectancy, HOUSEHOLD_DEFAULTS.lifeExpectancy),
    
    // DC pension
    dcPot: safeNumber(options.dcPot, 0),
    dcMonthlyContrib: monthlyContrib,
    dcAnnualContrib: effectiveDcAnnual,
    
    // DB pension
    dbAnnual: safeNumber(options.dbAnnual, 0),
    dbStartAge: safeNumber(options.dbStartAge, retirementAge),
    
    // ISA
    isaBalance: safeNumber(options.isaBalance, 0),
    isaAnnualContrib: safeNumber(options.isaAnnualContrib, 0)
  });
}

/**
 * Create household configuration
 * 
 * @param {object} options - Household configuration
 * @param {string} options.type - 'single' or 'couple'
 * @param {object} options.person1 - First person (required)
 * @param {object} options.person2 - Second person (required if couple)
 * @param {number} options.survivorSpendingRatio - Ratio of joint spending for survivor
 * @returns {object} Frozen household object
 * 
 * @example
 * // Single person
 * const household = createHousehold({
 *   type: 'single',
 *   person1: { currentAge: 55, retirementAge: 65 }
 * });
 * 
 * @example
 * // Couple with different ages
 * const household = createHousehold({
 *   type: 'couple',
 *   person1: { name: 'Alice', currentAge: 55, retirementAge: 65 },
 *   person2: { name: 'Bob', currentAge: 52, retirementAge: 63 },
 *   survivorSpendingRatio: 0.70
 * });
 */
export function createHousehold(options = {}) {
  const type = options.type || 'single';
  
  if (type !== 'single' && type !== 'couple') {
    throw new Error("Household type must be 'single' or 'couple'");
  }
  
  // For backward compatibility, support flat structure for single person
  const person1Data = options.person1 || {
    name: options.name || 'Person 1',
    currentAge: options.currentAge,
    retirementAge: options.retirementAge,
    statePensionAge: options.statePensionAge,
    expectedStatePension: options.expectedStatePension,
    lifeExpectancy: options.lifeExpectancy
  };
  
  const person1 = createPerson(person1Data);
  
  let person2 = null;
  if (type === 'couple') {
    if (!options.person2) {
      throw new Error('person2 is required for couple households');
    }
    person2 = createPerson(options.person2);
  }
  
  return Object.freeze({
    type,
    person1,
    person2,
    survivorSpendingRatio: options.survivorSpendingRatio ?? HOUSEHOLD_DEFAULTS.survivorSpendingRatio
  });
}

/**
 * Get the household's projection end age
 * For singles: person1's life expectancy
 * For couples: maximum of both life expectancies
 * 
 * @param {object} household - Household object
 * @returns {number} End age for projections
 */
export function getProjectionEndAge(household) {
  if (household.type === 'single') {
    return household.person1.lifeExpectancy;
  }
  
  // For couples, project until the last survivor
  return Math.max(
    household.person1.lifeExpectancy,
    household.person2.lifeExpectancy + (household.person1.currentAge - household.person2.currentAge)
  );
}

/**
 * Get the earliest retirement age in the household
 * 
 * @param {object} household - Household object
 * @returns {number} Earliest retirement age
 */
export function getEarliestRetirementAge(household) {
  if (household.type === 'single') {
    return household.person1.retirementAge;
  }
  
  // For couples with different ages, convert to common reference (person1's age)
  const person2RetireAtPerson1Age = household.person2.retirementAge + 
    (household.person1.currentAge - household.person2.currentAge);
  
  return Math.min(household.person1.retirementAge, person2RetireAtPerson1Age);
}

/**
 * Calculate household income (State Pensions) at a given reference age
 * 
 * @param {object} household - Household object
 * @param {number} referenceAge - Age of person1 (used as reference point)
 * @returns {object} { person1StatePension, person2StatePension, totalStatePension, bothReceivingStatePension }
 */
export function calculateHouseholdStatePension(household, referenceAge) {
  let person1StatePension = 0;
  let person2StatePension = 0;
  
  // Person 1 State Pension
  if (referenceAge >= household.person1.statePensionAge) {
    person1StatePension = household.person1.expectedStatePension;
  }
  
  // Person 2 State Pension (if couple)
  if (household.type === 'couple' && household.person2) {
    // Calculate person2's age based on person1's reference age
    const person2Age = referenceAge - (household.person1.currentAge - household.person2.currentAge);
    
    if (person2Age >= household.person2.statePensionAge) {
      person2StatePension = household.person2.expectedStatePension;
    }
  }
  
  return {
    person1StatePension,
    person2StatePension,
    totalStatePension: person1StatePension + person2StatePension,
    bothReceivingStatePension: household.type === 'single' 
      ? person1StatePension > 0
      : (person1StatePension > 0 && person2StatePension > 0)
  };
}

/**
 * Determine if this is a survivor year (after first death in couple)
 * Uses life expectancy as proxy for death
 * 
 * @param {object} household - Household object
 * @param {number} referenceAge - Age of person1
 * @returns {object} { isSurvivorYear, survivingPerson, deceasedPerson }
 */
export function getSurvivorStatus(household, referenceAge) {
  if (household.type === 'single') {
    const isDead = referenceAge > household.person1.lifeExpectancy;
    return {
      isSurvivorYear: false,
      survivingPerson: isDead ? null : 1,
      deceasedPerson: isDead ? 1 : null
    };
  }
  
  // For couples: calculate person2's equivalent age
  const person2Age = referenceAge - (household.person1.currentAge - household.person2.currentAge);
  
  const person1Dead = referenceAge > household.person1.lifeExpectancy;
  const person2Dead = person2Age > household.person2.lifeExpectancy;
  
  if (person1Dead && person2Dead) {
    return { isSurvivorYear: false, survivingPerson: null, deceasedPerson: 'both' };
  }
  
  if (person1Dead) {
    return { isSurvivorYear: true, survivingPerson: 2, deceasedPerson: 1 };
  }
  
  if (person2Dead) {
    return { isSurvivorYear: true, survivingPerson: 1, deceasedPerson: 2 };
  }
  
  return { isSurvivorYear: false, survivingPerson: null, deceasedPerson: null };
}

/**
 * Calculate spending target for a given year considering survivor status
 * 
 * @param {object} household - Household object
 * @param {number} baseJointSpending - Base annual spending for the household
 * @param {number} referenceAge - Age of person1
 * @returns {number} Spending target for the year
 */
export function calculateHouseholdSpending(household, baseJointSpending, referenceAge) {
  if (household.type === 'single') {
    return baseJointSpending;
  }
  
  const survivorStatus = getSurvivorStatus(household, referenceAge);
  
  if (survivorStatus.isSurvivorYear) {
    // Apply survivor spending ratio
    return baseJointSpending * household.survivorSpendingRatio;
  }
  
  return baseJointSpending;
}

/**
 * Get available Personal Allowances for tax planning
 * 
 * @param {object} household - Household object
 * @param {number} referenceAge - Age of person1
 * @param {number} personalAllowanceAmount - PA amount per person (default £12,570)
 * @returns {number} Total available Personal Allowance
 */
export function getAvailablePersonalAllowances(household, referenceAge, personalAllowanceAmount = 12570) {
  const survivorStatus = getSurvivorStatus(household, referenceAge);
  
  if (household.type === 'single' || survivorStatus.isSurvivorYear) {
    return personalAllowanceAmount;
  }
  
  // Both alive: two Personal Allowances
  return personalAllowanceAmount * 2;
}

/**
 * Get household summary for display
 * 
 * @param {object} household - Household object
 * @returns {object} Human-readable summary
 */
export function getHouseholdSummary(household) {
  const summary = {
    type: household.type,
    person1: {
      name: household.person1.name,
      currentAge: household.person1.currentAge,
      retirementAge: household.person1.retirementAge,
      statePensionAge: household.person1.statePensionAge,
      expectedStatePension: `£${household.person1.expectedStatePension.toLocaleString()}/year`,
      lifeExpectancy: household.person1.lifeExpectancy
    }
  };
  
  if (household.type === 'couple') {
    summary.person2 = {
      name: household.person2.name,
      currentAge: household.person2.currentAge,
      retirementAge: household.person2.retirementAge,
      statePensionAge: household.person2.statePensionAge,
      expectedStatePension: `£${household.person2.expectedStatePension.toLocaleString()}/year`,
      lifeExpectancy: household.person2.lifeExpectancy
    };
    summary.survivorSpendingRatio = `${(household.survivorSpendingRatio * 100).toFixed(0)}%`;
  }
  
  return summary;
}

/**
 * Validate household configuration
 * 
 * @param {object} household - Household to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateHousehold(household) {
  const errors = [];
  
  if (!household.type || (household.type !== 'single' && household.type !== 'couple')) {
    errors.push("type must be 'single' or 'couple'");
  }
  
  if (!household.person1) {
    errors.push('person1 is required');
  } else {
    if (household.person1.retirementAge <= household.person1.currentAge) {
      errors.push('person1.retirementAge must be greater than currentAge');
    }
    if (household.person1.lifeExpectancy <= household.person1.retirementAge) {
      errors.push('person1.lifeExpectancy must be greater than retirementAge');
    }
  }
  
  if (household.type === 'couple') {
    if (!household.person2) {
      errors.push('person2 is required for couple households');
    } else {
      if (household.person2.retirementAge <= household.person2.currentAge) {
        errors.push('person2.retirementAge must be greater than currentAge');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate comprehensive household income at a given reference age
 * Includes State Pension, DB pension, and indicates eligibility for each source
 * 
 * @param {object} household - Household object
 * @param {number} referenceAge - Age of person1 (used as reference point)
 * @returns {object} Detailed income breakdown by source and person
 */
export function calculateHouseholdIncomeAtAge(household, referenceAge) {
  const result = {
    person1: {
      age: referenceAge,
      statePension: 0,
      dbPension: 0,
      isRetired: referenceAge >= household.person1.retirementAge,
      isReceivingStatePension: referenceAge >= household.person1.statePensionAge,
      isReceivingDbPension: false
    },
    total: {
      statePension: 0,
      dbPension: 0,
      guaranteedIncome: 0
    }
  };
  
  // Person 1 State Pension
  if (result.person1.isReceivingStatePension) {
    result.person1.statePension = household.person1.expectedStatePension || 0;
  }
  
  // Person 1 DB Pension
  if (household.person1.dbAnnual > 0 && referenceAge >= household.person1.dbStartAge) {
    result.person1.dbPension = household.person1.dbAnnual;
    result.person1.isReceivingDbPension = true;
  }
  
  // Totals for single
  result.total.statePension = result.person1.statePension;
  result.total.dbPension = result.person1.dbPension;
  
  // Handle couples
  if (household.type === 'couple' && household.person2) {
    const ageDiff = household.person1.currentAge - household.person2.currentAge;
    const person2Age = referenceAge - ageDiff;
    
    result.person2 = {
      age: person2Age,
      statePension: 0,
      dbPension: 0,
      isRetired: person2Age >= household.person2.retirementAge,
      isReceivingStatePension: person2Age >= household.person2.statePensionAge,
      isReceivingDbPension: false
    };
    
    // Check if Person 2 is still alive
    const survivorStatus = getSurvivorStatus(household, referenceAge);
    if (!survivorStatus.isSurvivorYear || survivorStatus.person2Alive) {
      // Person 2 State Pension
      if (result.person2.isReceivingStatePension) {
        result.person2.statePension = household.person2.expectedStatePension || 0;
      }
      
      // Person 2 DB Pension
      if (household.person2.dbAnnual > 0 && person2Age >= household.person2.dbStartAge) {
        result.person2.dbPension = household.person2.dbAnnual;
        result.person2.isReceivingDbPension = true;
      }
      
      result.total.statePension += result.person2.statePension;
      result.total.dbPension += result.person2.dbPension;
    }
  }
  
  result.total.guaranteedIncome = result.total.statePension + result.total.dbPension;
  
  return result;
}

/**
 * Generate annual timeline for household from current age to horizon
 * Shows when each income source becomes active
 * 
 * @param {object} household - Household object
 * @param {number} [horizonAge=90] - End age for timeline
 * @returns {object[]} Array of year-by-year income data
 */
export function generateHouseholdTimeline(household, horizonAge = 90) {
  const startAge = Math.min(
    household.person1.currentAge,
    household.type === 'couple' && household.person2 
      ? household.person2.currentAge + (household.person1.currentAge - household.person2.currentAge)
      : household.person1.currentAge
  );
  
  const timeline = [];
  
  for (let age = startAge; age <= horizonAge; age++) {
    const income = calculateHouseholdIncomeAtAge(household, age);
    timeline.push({
      year: age - startAge,
      person1Age: age,
      person2Age: household.type === 'couple' && household.person2 
        ? age - (household.person1.currentAge - household.person2.currentAge)
        : null,
      ...income.total,
      details: income
    });
  }
  
  return timeline;
}
