/**
 * RetireLens 2 - Healthcare Costs Engine
 * 
 * Pure functions for modeling late-life healthcare and care costs.
 * UK-specific assumptions for social care and private care costs.
 */

/**
 * Default healthcare cost assumptions for UK
 */
export const HEALTHCARE_DEFAULTS = {
  // Probability of requiring care
  probabilityOfCareByAge: {
    65: 0.05,
    70: 0.08,
    75: 0.15,
    80: 0.25,
    85: 0.30,
    90: 0.45,
    95: 0.60
  },
  
  // Average annual care costs (2024)
  homeCareCostAnnual: 25000,        // Home care/carers
  residentialCareCostAnnual: 40000,  // Care home without nursing
  nursingCareCostAnnual: 55000,      // Nursing home
  
  // Average duration of care need
  averageCareDurationYears: 3,
  
  // NHS Continuing Healthcare (fully funded)
  nhsContinuingHealthcareProbability: 0.15,
  
  // Local authority means testing thresholds
  capitalThresholdUpper: 23250,  // Above this, pay full cost
  capitalThresholdLower: 14250,  // Below this, fully covered
  propertyDisregardFirstResident: 100000,  // Property often disregarded initially
  
  // Care cap (currently proposed but not implemented)
  careCapLifetime: 86000  // Proposed cap on care costs
};

/**
 * Create a healthcare cost projection
 * 
 * @param {object} params - Configuration parameters
 * @returns {object} Healthcare cost state
 */
export function createHealthcarePlan(params) {
  const {
    careStartAge = 85,
    probabilityOfCare = 0.30,
    careType = 'residential',  // 'home', 'residential', 'nursing'
    careDuration = 3,
    hasCareInsurance = false,
    careInsuranceCoverage = 0,
    includeNHSProbability = true
  } = params;
  
  if (careStartAge < 60 || careStartAge > 100) {
    throw new Error('Care start age must be between 60 and 100');
  }
  
  if (probabilityOfCare < 0 || probabilityOfCare > 1) {
    throw new Error('Probability of care must be between 0 and 1');
  }
  
  if (careDuration < 0 || careDuration > 20) {
    throw new Error('Care duration must be between 0 and 20 years');
  }
  
  // Determine annual cost based on care type
  let annualCost;
  switch (careType) {
    case 'home':
      annualCost = HEALTHCARE_DEFAULTS.homeCareCostAnnual;
      break;
    case 'residential':
      annualCost = HEALTHCARE_DEFAULTS.residentialCareCostAnnual;
      break;
    case 'nursing':
      annualCost = HEALTHCARE_DEFAULTS.nursingCareCostAnnual;
      break;
    default:
      annualCost = HEALTHCARE_DEFAULTS.residentialCareCostAnnual;
  }
  
  const totalCost = annualCost * careDuration;
  const insuranceCoverage = hasCareInsurance ? careInsuranceCoverage : 0;
  const nhsProbability = includeNHSProbability ? HEALTHCARE_DEFAULTS.nhsContinuingHealthcareProbability : 0;
  
  // Expected cost accounting for probabilities
  const expectedCostWithoutNHS = totalCost * probabilityOfCare;
  const expectedCostWithNHS = expectedCostWithoutNHS * (1 - nhsProbability);
  const expectedNetCost = Math.max(0, expectedCostWithNHS - insuranceCoverage);
  
  return {
    careStartAge,
    careEndAge: careStartAge + careDuration,
    probabilityOfCare,
    careType,
    careDuration,
    annualCost,
    totalCost,
    hasCareInsurance,
    insuranceCoverage,
    nhsProbability,
    expectedCostWithoutNHS,
    expectedCostWithNHS,
    expectedNetCost
  };
}

/**
 * Calculate means-tested support for care costs
 * 
 * @param {number} totalAssets - Total assets including property
 * @param {number} annualCareCost - Annual cost of care
 * @param {boolean} includeProperty - Whether property is included in assessment
 * @returns {object} Means-tested support calculation
 */
export function calculateMeansTestedSupport(totalAssets, annualCareCost, includeProperty = true) {
  const assessableAssets = includeProperty 
    ? totalAssets 
    : Math.max(0, totalAssets - HEALTHCARE_DEFAULTS.propertyDisregardFirstResident);
  
  let localAuthorityContribution = 0;
  let personalContribution = annualCareCost;
  let contributionBasis = 'full-cost';
  
  if (assessableAssets < HEALTHCARE_DEFAULTS.capitalThresholdLower) {
    // Fully covered by local authority (subject to eligibility)
    localAuthorityContribution = annualCareCost;
    personalContribution = 0;
    contributionBasis = 'fully-covered';
  } else if (assessableAssets < HEALTHCARE_DEFAULTS.capitalThresholdUpper) {
    // Partial contribution based on tariff income (£1 per week per £250 over lower threshold)
    const excessCapital = assessableAssets - HEALTHCARE_DEFAULTS.capitalThresholdLower;
    const tariffIncomeWeekly = Math.floor(excessCapital / 250);
    const tariffIncomeAnnual = tariffIncomeWeekly * 52;
    
    personalContribution = Math.min(annualCareCost, tariffIncomeAnnual);
    localAuthorityContribution = annualCareCost - personalContribution;
    contributionBasis = 'partial-covered';
  }
  
  return {
    assessableAssets,
    annualCareCost,
    personalContribution,
    localAuthorityContribution,
    contributionBasis,
    propertyIncluded: includeProperty
  };
}

/**
 * Project healthcare costs over retirement
 * 
 * @param {object} healthcarePlan - Healthcare cost plan
 * @param {number} startAge - Starting age for projection
 * @param {number} endAge - Ending age for projection
 * @param {object} options - Additional options
 * @returns {Array} Year-by-year healthcare cost projection
 */
export function projectHealthcareCosts(healthcarePlan, startAge, endAge, options = {}) {
  const {
    inflationRate = 0.025,
    currentAssets = 0,
    includeProperty = false,
    propertyValue = 0
  } = options;
  
  const projection = [];
  let cumulativeCost = 0;
  
  for (let age = startAge; age <= endAge; age++) {
    const yearsSinceStart = age - startAge;
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsSinceStart);
    
    let yearCost = 0;
    let inCarePeriod = false;
    
    if (age >= healthcarePlan.careStartAge && age < healthcarePlan.careEndAge) {
      yearCost = healthcarePlan.annualCost * inflationMultiplier;
      inCarePeriod = true;
    }
    
    cumulativeCost += yearCost;
    
    // Calculate means-tested support if applicable
    const totalAssets = currentAssets + (includeProperty ? propertyValue : 0);
    const meansTest = yearCost > 0 
      ? calculateMeansTestedSupport(totalAssets, yearCost, includeProperty)
      : null;
    
    projection.push({
      age,
      yearCost,
      cumulativeCost,
      inCarePeriod,
      inflationMultiplier,
      meansTest
    });
  }
  
  return projection;
}

/**
 * Calculate care insurance premium estimate
 * 
 * @param {object} params - Insurance parameters
 * @returns {object} Insurance cost analysis
 */
export function estimateCareInsurance(params) {
  const {
    currentAge,
    coverageAmount = 100000,
    waitingPeriod = 90,  // days
    benefitPeriod = 3,   // years
    indexLinked = true
  } = params;
  
  // Rough premium estimates (£ per year) based on age
  // These are illustrative - actual premiums vary significantly by provider
  const premiumPerThousand = {
    50: 3.5,
    55: 4.5,
    60: 6.0,
    65: 8.5,
    70: 12.0,
    75: 18.0
  };
  
  // Find closest age bracket
  const ages = Object.keys(premiumPerThousand).map(Number).sort((a, b) => a - b);
  const closestAge = ages.reduce((prev, curr) => 
    Math.abs(curr - currentAge) < Math.abs(prev - currentAge) ? curr : prev
  );
  
  const baseRate = premiumPerThousand[closestAge] || 10;
  const annualPremium = (coverageAmount / 1000) * baseRate;
  
  // Adjust for inflation protection
  const adjustedPremium = indexLinked ? annualPremium * 1.3 : annualPremium;
  
  // Calculate total premiums paid until age 85 (typical claim age)
  const yearsToPay = Math.max(0, 85 - currentAge);
  const totalPremiumsPaid = adjustedPremium * yearsToPay;
  
  return {
    coverageAmount,
    annualPremium: adjustedPremium,
    totalPremiumsPaid,
    benefitPeriod,
    waitingPeriod,
    indexLinked,
    breakEvenProbability: totalPremiumsPaid / coverageAmount,
    valueForMoney: coverageAmount / totalPremiumsPaid
  };
}

/**
 * Calculate optimal care funding strategy
 * 
 * @param {object} healthcarePlan - Healthcare plan
 * @param {object} financialSituation - Current financial situation
 * @returns {object} Recommended strategy
 */
export function recommendCareFundingStrategy(healthcarePlan, financialSituation) {
  const {
    totalAssets,
    propertyValue = 0,
    liquidAssets,
    annualIncome
  } = financialSituation;
  
  const { expectedNetCost, totalCost } = healthcarePlan;
  
  const recommendations = [];
  let strategy = 'self-fund';
  
  // Check if eligible for means-tested support
  const meansTest = calculateMeansTestedSupport(totalAssets, healthcarePlan.annualCost, true);
  
  if (meansTest.contributionBasis === 'fully-covered' || meansTest.contributionBasis === 'partial-covered') {
    strategy = 'means-tested-support';
    recommendations.push({
      type: 'means-tested',
      priority: 'high',
      description: 'You may be eligible for local authority support',
      action: 'Contact your local authority for a care needs assessment'
    });
  }
  
  // Check if insurance makes sense
  if (liquidAssets < totalCost && propertyValue > totalCost) {
    recommendations.push({
      type: 'insurance',
      priority: 'medium',
      description: 'Care insurance could protect your estate',
      action: 'Consider pre-funded care insurance or immediate needs annuity'
    });
  }
  
  // Property planning
  if (propertyValue > HEALTHCARE_DEFAULTS.propertyDisregardFirstResident) {
    recommendations.push({
      type: 'property',
      priority: 'medium',
      description: 'Property may be assessed for care costs after 12 weeks',
      action: 'Consider deferred payment agreement or equity release'
    });
  }
  
  // Self-funding strategy
  if (liquidAssets >= totalCost) {
    strategy = 'self-fund';
    recommendations.push({
      type: 'self-fund',
      priority: 'high',
      description: 'You have sufficient liquid assets to self-fund care',
      action: 'Maintain accessible savings for potential care costs'
    });
  }
  
  return {
    strategy,
    expectedCost: expectedNetCost,
    totalWorstCase: totalCost,
    recommendations,
    meansTestResult: meansTest
  };
}

/**
 * Validate healthcare plan parameters
 * 
 * @param {object} params - Parameters to validate
 * @returns {object} Validation result with { valid, errors, warnings }
 */
export function validateHealthcarePlan(params) {
  const errors = [];
  const warnings = [];
  
  if (params.careStartAge < 60 || params.careStartAge > 100) {
    errors.push('Care start age must be between 60 and 100');
  }
  
  if (params.probabilityOfCare < 0 || params.probabilityOfCare > 1) {
    errors.push('Probability of care must be between 0 and 1');
  }
  
  if (params.careDuration < 0 || params.careDuration > 20) {
    errors.push('Care duration must be between 0 and 20 years');
  }
  
  if (!['home', 'residential', 'nursing'].includes(params.careType)) {
    errors.push('Care type must be home, residential, or nursing');
  }
  
  // Warnings
  if (params.probabilityOfCare > 0.5) {
    warnings.push('Probability of care is quite high - consider getting professional assessment');
  }
  
  if (params.careDuration > 10) {
    warnings.push('Care duration over 10 years is unusual - verify this assumption');
  }
  
  if (params.careStartAge < 70) {
    warnings.push('Care start age before 70 is early - this is a conservative assumption');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
