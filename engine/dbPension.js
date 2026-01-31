/**
 * RetireLens 2 - Defined Benefit (DB) Pension Module
 * 
 * Models final salary and CARE scheme pensions for UK retirement planning.
 * 
 * Key features:
 * - Annual income from retirement or specified start age
 * - Optional inflation linking (CPI, fixed rate, or none)
 * - Support for multiple DB pensions per person
 * - Integration with tax calculations
 * 
 * DB pensions provide guaranteed income for life, unlike DC pensions
 * which depend on investment returns.
 */

/**
 * Inflation linking options for DB pensions
 */
export const INFLATION_LINKING = Object.freeze({
  CPI: {
    id: 'cpi',
    name: 'CPI Linked',
    description: 'Increases with Consumer Price Index (typically capped)',
    defaultRate: null  // Uses assumption inflation rate
  },
  FIXED: {
    id: 'fixed',
    name: 'Fixed Increase',
    description: 'Fixed annual percentage increase',
    defaultRate: 0.03  // 3% default
  },
  NONE: {
    id: 'none',
    name: 'No Increase',
    description: 'Level pension (no inflation protection)',
    defaultRate: 0
  }
});

/**
 * Create a DB pension configuration
 * 
 * @param {object} options - DB pension options
 * @param {string} options.name - Name/identifier for the pension
 * @param {number} options.annualIncome - Annual pension income at start
 * @param {number} options.startAge - Age when pension payments begin
 * @param {string} options.inflationLinking - 'cpi' | 'fixed' | 'none'
 * @param {number} options.fixedIncreaseRate - Rate if inflationLinking is 'fixed'
 * @param {number} options.cpiCap - Maximum annual increase if CPI linked (e.g., 0.05 for 5%)
 * @param {boolean} options.survivorBenefit - Whether spouse receives benefit on death
 * @param {number} options.survivorRate - Percentage of pension survivor receives (e.g., 0.5 for 50%)
 * @returns {object} Frozen DB pension configuration
 * 
 * @example
 * const dbPension = createDBPension({
 *   name: 'Company Final Salary',
 *   annualIncome: 15000,
 *   startAge: 65,
 *   inflationLinking: 'cpi',
 *   cpiCap: 0.025  // 2.5% cap
 * });
 */
export function createDBPension(options = {}) {
  if (typeof options.annualIncome !== 'number' || options.annualIncome <= 0) {
    throw new Error('annualIncome must be a positive number');
  }
  
  if (typeof options.startAge !== 'number' || options.startAge < 55 || options.startAge > 75) {
    throw new Error('startAge must be between 55 and 75');
  }
  
  const linking = options.inflationLinking || 'cpi';
  if (!['cpi', 'fixed', 'none'].includes(linking)) {
    throw new Error("inflationLinking must be 'cpi', 'fixed', or 'none'");
  }
  
  return Object.freeze({
    name: options.name || 'DB Pension',
    annualIncome: options.annualIncome,
    startAge: options.startAge,
    inflationLinking: linking,
    fixedIncreaseRate: linking === 'fixed' ? (options.fixedIncreaseRate || 0.03) : 0,
    cpiCap: linking === 'cpi' ? (options.cpiCap || null) : null,  // null = no cap
    survivorBenefit: options.survivorBenefit !== false,  // Default true
    survivorRate: options.survivorRate || 0.5  // 50% default survivor benefit
  });
}

/**
 * Calculate DB pension income at a given age
 * 
 * @param {object} dbPension - DB pension configuration
 * @param {number} currentAge - Current age to calculate income for
 * @param {number} inflationRate - Annual inflation rate (used for CPI linking)
 * @returns {number} Annual pension income at that age (0 if before start age)
 */
export function calculateDBIncomeAtAge(dbPension, currentAge, inflationRate = 0.02) {
  if (currentAge < dbPension.startAge) {
    return 0;
  }
  
  const yearsReceiving = currentAge - dbPension.startAge;
  let income = dbPension.annualIncome;
  
  // Apply inflation linking
  switch (dbPension.inflationLinking) {
    case 'cpi':
      // Apply CPI with optional cap
      let effectiveRate = inflationRate;
      if (dbPension.cpiCap !== null) {
        effectiveRate = Math.min(inflationRate, dbPension.cpiCap);
      }
      income = dbPension.annualIncome * Math.pow(1 + effectiveRate, yearsReceiving);
      break;
      
    case 'fixed':
      // Fixed annual increase
      income = dbPension.annualIncome * Math.pow(1 + dbPension.fixedIncreaseRate, yearsReceiving);
      break;
      
    case 'none':
    default:
      // Level pension, no increase
      income = dbPension.annualIncome;
      break;
  }
  
  return Math.round(income * 100) / 100;  // Round to nearest penny
}

/**
 * Calculate total DB pension income for a household at a given age
 * 
 * @param {object[]} person1DBPensions - Array of DB pensions for person 1
 * @param {object[]} person2DBPensions - Array of DB pensions for person 2 (null if single)
 * @param {number} person1Age - Person 1's current age
 * @param {number} person2Age - Person 2's current age (ignored if null)
 * @param {number} inflationRate - Inflation rate for CPI linking
 * @param {object} survivorStatus - Optional survivor status { isSurvivorYear, deceasedPerson }
 * @returns {object} { person1Total, person2Total, householdTotal, breakdown }
 */
export function calculateHouseholdDBIncome(
  person1DBPensions = [],
  person2DBPensions = null,
  person1Age,
  person2Age = null,
  inflationRate = 0.02,
  survivorStatus = null
) {
  let person1Total = 0;
  let person2Total = 0;
  const breakdown = [];
  
  // Person 1's own pensions
  for (const pension of person1DBPensions) {
    const income = calculateDBIncomeAtAge(pension, person1Age, inflationRate);
    if (income > 0) {
      person1Total += income;
      breakdown.push({
        person: 1,
        name: pension.name,
        income,
        type: 'own'
      });
    }
  }
  
  // Person 2's own pensions (if couple)
  if (person2DBPensions && person2Age !== null) {
    for (const pension of person2DBPensions) {
      const income = calculateDBIncomeAtAge(pension, person2Age, inflationRate);
      if (income > 0) {
        person2Total += income;
        breakdown.push({
          person: 2,
          name: pension.name,
          income,
          type: 'own'
        });
      }
    }
  }
  
  // Handle survivor benefits if one person has died
  if (survivorStatus && survivorStatus.isSurvivorYear) {
    if (survivorStatus.deceasedPerson === 1) {
      // Person 1 died - person 2 may receive survivor benefits from person 1's pensions
      for (const pension of person1DBPensions) {
        if (pension.survivorBenefit) {
          const fullIncome = calculateDBIncomeAtAge(pension, person1Age, inflationRate);
          const survivorIncome = fullIncome * pension.survivorRate;
          if (survivorIncome > 0) {
            person2Total += survivorIncome;
            breakdown.push({
              person: 2,
              name: `${pension.name} (Survivor)`,
              income: survivorIncome,
              type: 'survivor'
            });
          }
        }
      }
      // Person 1's direct income stops
      person1Total = 0;
    } else if (survivorStatus.deceasedPerson === 2 && person2DBPensions) {
      // Person 2 died - person 1 may receive survivor benefits
      for (const pension of person2DBPensions) {
        if (pension.survivorBenefit) {
          const fullIncome = calculateDBIncomeAtAge(pension, person2Age, inflationRate);
          const survivorIncome = fullIncome * pension.survivorRate;
          if (survivorIncome > 0) {
            person1Total += survivorIncome;
            breakdown.push({
              person: 1,
              name: `${pension.name} (Survivor)`,
              income: survivorIncome,
              type: 'survivor'
            });
          }
        }
      }
      // Person 2's direct income stops
      person2Total = 0;
    }
  }
  
  return {
    person1Total: Math.round(person1Total * 100) / 100,
    person2Total: Math.round(person2Total * 100) / 100,
    householdTotal: Math.round((person1Total + person2Total) * 100) / 100,
    breakdown
  };
}

/**
 * Validate DB pension configuration
 * 
 * @param {object} dbPension - DB pension to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateDBPension(dbPension) {
  const errors = [];
  
  if (typeof dbPension.annualIncome !== 'number' || dbPension.annualIncome <= 0) {
    errors.push('annualIncome must be a positive number');
  }
  
  if (typeof dbPension.startAge !== 'number' || dbPension.startAge < 55 || dbPension.startAge > 75) {
    errors.push('startAge must be between 55 and 75');
  }
  
  if (!['cpi', 'fixed', 'none'].includes(dbPension.inflationLinking)) {
    errors.push("inflationLinking must be 'cpi', 'fixed', or 'none'");
  }
  
  if (dbPension.inflationLinking === 'fixed' && 
      (typeof dbPension.fixedIncreaseRate !== 'number' || dbPension.fixedIncreaseRate < 0)) {
    errors.push('fixedIncreaseRate must be a non-negative number');
  }
  
  if (typeof dbPension.survivorRate !== 'number' || dbPension.survivorRate < 0 || dbPension.survivorRate > 1) {
    errors.push('survivorRate must be between 0 and 1');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get summary of DB pension for display
 * 
 * @param {object} dbPension - DB pension configuration
 * @returns {object} Human-readable summary
 */
export function getDBPensionSummary(dbPension) {
  let inflationDesc;
  switch (dbPension.inflationLinking) {
    case 'cpi':
      inflationDesc = dbPension.cpiCap 
        ? `CPI linked (capped at ${(dbPension.cpiCap * 100).toFixed(1)}%)`
        : 'CPI linked (no cap)';
      break;
    case 'fixed':
      inflationDesc = `Fixed ${(dbPension.fixedIncreaseRate * 100).toFixed(1)}% annual increase`;
      break;
    default:
      inflationDesc = 'Level (no increases)';
  }
  
  return {
    name: dbPension.name,
    annualIncome: `£${dbPension.annualIncome.toLocaleString()}/year`,
    startAge: `From age ${dbPension.startAge}`,
    inflationLinking: inflationDesc,
    survivorBenefit: dbPension.survivorBenefit 
      ? `${(dbPension.survivorRate * 100).toFixed(0)}% survivor benefit`
      : 'No survivor benefit'
  };
}

/**
 * Calculate lifetime value of DB pension
 * Useful for comparing to DC pot values
 * 
 * @param {object} dbPension - DB pension configuration
 * @param {number} startAge - Age pension starts
 * @param {number} endAge - Age to calculate to (e.g., life expectancy)
 * @param {number} discountRate - Discount rate for present value calculation
 * @param {number} inflationRate - Inflation rate for CPI linking
 * @returns {object} { totalNominal, presentValue, averageAnnual }
 */
export function calculateDBLifetimeValue(dbPension, startAge, endAge, discountRate = 0.03, inflationRate = 0.02) {
  let totalNominal = 0;
  let presentValue = 0;
  
  for (let age = startAge; age <= endAge; age++) {
    const income = calculateDBIncomeAtAge(dbPension, age, inflationRate);
    totalNominal += income;
    
    // Discount to present value
    const yearsFromNow = age - startAge;
    presentValue += income / Math.pow(1 + discountRate, yearsFromNow);
  }
  
  const years = endAge - startAge + 1;
  
  return {
    totalNominal: Math.round(totalNominal),
    presentValue: Math.round(presentValue),
    averageAnnual: Math.round(totalNominal / years),
    years
  };
}
