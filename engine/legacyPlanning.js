/**
 * RetireLens 2 - Legacy Planning Engine
 * 
 * Pure functions for inheritance and legacy planning.
 * UK-specific inheritance tax rules and estate planning.
 */

/**
 * UK Inheritance Tax Configuration (2024/25)
 */
export const IHT_CONFIG = {
  // Nil-rate band (standard allowance)
  nilRateBand: 325000,
  
  // Residence nil-rate band (for main residence)
  residenceNilRateBand: 175000,
  
  // Taper threshold for residence nil-rate band
  residenceTaperThreshold: 2000000,
  residenceTaperRate: 0.5,  // Lose £1 for every £2 over threshold
  
  // Inheritance tax rate
  taxRate: 0.40,  // 40% on amount over threshold
  
  // Reduced rate for charitable donations
  charityReducedRate: 0.36,  // 36% if 10%+ left to charity
  charityThreshold: 0.10,
  
  // Spouse exemption
  spouseExempt: true,
  
  // Transferable nil-rate bands
  transferableNilRateBand: true
};

/**
 * Create a legacy plan
 * 
 * @param {object} params - Configuration parameters
 * @returns {object} Legacy plan state
 */
export function createLegacyPlan(params) {
  const {
    targetInheritance = 0,
    priority = 'nice-to-have',  // 'must-have' or 'nice-to-have'
    beneficiaries = [],
    includeProperty = false,
    propertyValue = 0,
    charitableDonation = 0,
    hasSpouse = false,
    spouseNilRateBandUsed = 0
  } = params;
  
  if (targetInheritance < 0) {
    throw new Error('Target inheritance must be non-negative');
  }
  
  if (!['must-have', 'nice-to-have'].includes(priority)) {
    throw new Error('Priority must be "must-have" or "nice-to-have"');
  }
  
  if (charitableDonation < 0) {
    throw new Error('Charitable donation must be non-negative');
  }
  
  return {
    targetInheritance,
    priority,
    beneficiaries: beneficiaries.map(b => ({
      name: b.name || 'Unnamed',
      relationship: b.relationship || 'other',
      age: b.age,
      sharePercentage: b.sharePercentage || 0,
      specificBequest: b.specificBequest || 0
    })),
    includeProperty,
    propertyValue,
    charitableDonation,
    hasSpouse,
    spouseNilRateBandUsed,
    isActive: true
  };
}

/**
 * Calculate inheritance tax liability
 * 
 * @param {object} estate - Estate details
 * @param {object} ihtConfig - IHT configuration (optional)
 * @returns {object} IHT calculation breakdown
 */
export function calculateInheritanceTax(estate, ihtConfig = IHT_CONFIG) {
  const {
    totalEstateValue,
    propertyValue = 0,
    passedToSpouse = 0,
    charitableDonation = 0,
    transferredNilRateBand = 0,  // From deceased spouse
    transferredResidenceNilRateBand = 0
  } = estate;
  
  // Deduct spouse exemption
  const taxableBeforeExemptions = totalEstateValue - passedToSpouse;
  
  // Calculate residence nil-rate band
  let residenceNilRateBand = ihtConfig.residenceNilRateBand;
  
  // Taper if estate is large
  if (taxableBeforeExemptions > ihtConfig.residenceTaperThreshold) {
    const excess = taxableBeforeExemptions - ihtConfig.residenceTaperThreshold;
    const reduction = excess * ihtConfig.residenceTaperRate;
    residenceNilRateBand = Math.max(0, residenceNilRateBand - reduction);
  }
  
  // Apply residence nil-rate band only if property is included
  const effectiveResidenceNilRateBand = propertyValue > 0 
    ? Math.min(residenceNilRateBand, propertyValue) 
    : 0;
  
  // Total allowances
  const standardNilRateBand = ihtConfig.nilRateBand + transferredNilRateBand;
  const totalResidenceNilRateBand = effectiveResidenceNilRateBand + transferredResidenceNilRateBand;
  const totalAllowance = standardNilRateBand + totalResidenceNilRateBand;
  
  // Taxable estate after allowances
  const taxableEstate = Math.max(0, taxableBeforeExemptions - totalAllowance);
  
  // Check for charity reduced rate
  const charitablePercentage = totalEstateValue > 0 ? charitableDonation / totalEstateValue : 0;
  const qualifiesForCharityReduction = charitablePercentage >= ihtConfig.charityThreshold;
  const applicableRate = qualifiesForCharityReduction ? ihtConfig.charityReducedRate : ihtConfig.taxRate;
  
  // Calculate tax
  const inheritanceTax = taxableEstate * applicableRate;
  
  // Net estate after tax
  const netEstate = totalEstateValue - passedToSpouse - inheritanceTax - charitableDonation;
  
  return {
    totalEstateValue,
    passedToSpouse,
    charitableDonation,
    standardNilRateBand,
    residenceNilRateBand: totalResidenceNilRateBand,
    totalAllowance,
    taxableEstate,
    applicableRate,
    inheritanceTax,
    netEstate,
    effectiveIHTRate: totalEstateValue > 0 ? inheritanceTax / totalEstateValue : 0,
    qualifiesForCharityReduction
  };
}

/**
 * Project estate value at death
 * 
 * @param {object} currentPosition - Current financial position
 * @param {number} yearsToProjection - Years until projection date
 * @param {object} assumptions - Growth and spending assumptions
 * @returns {object} Projected estate value
 */
export function projectEstateValue(currentPosition, yearsToProjection, assumptions = {}) {
  const {
    pensionPot = 0,
    isaBalance = 0,
    otherAssets = 0,
    propertyValue = 0,
    annualSpending = 0,
    annualIncome = 0,
    growthRate = 0.04,
    propertyGrowthRate = 0.025
  } = { ...currentPosition, ...assumptions };
  
  // Project investment assets
  let projectedInvestments = pensionPot + isaBalance + otherAssets;
  
  for (let year = 0; year < yearsToProjection; year++) {
    const netCashFlow = annualIncome - annualSpending;
    projectedInvestments = projectedInvestments * (1 + growthRate) + netCashFlow;
    
    // Don't allow negative estate
    projectedInvestments = Math.max(0, projectedInvestments);
  }
  
  // Project property value
  const projectedProperty = propertyValue * Math.pow(1 + propertyGrowthRate, yearsToProjection);
  
  const totalEstate = projectedInvestments + projectedProperty;
  
  return {
    projectedInvestments,
    projectedProperty,
    totalEstate,
    yearsProjected: yearsToProjection,
    assumptions: {
      growthRate,
      propertyGrowthRate,
      annualSpending,
      annualIncome
    }
  };
}

/**
 * Calculate legacy shortfall/surplus
 * 
 * @param {object} legacyPlan - Legacy plan
 * @param {object} projectedEstate - Projected estate value
 * @param {object} ihtConfig - IHT configuration
 * @returns {object} Shortfall analysis
 */
export function calculateLegacyShortfall(legacyPlan, projectedEstate, ihtConfig = IHT_CONFIG) {
  const { targetInheritance, priority, charitableDonation, includeProperty, propertyValue } = legacyPlan;
  
  // Calculate IHT on projected estate
  const ihtCalc = calculateInheritanceTax({
    totalEstateValue: projectedEstate.totalEstate,
    propertyValue: includeProperty ? projectedEstate.projectedProperty : 0,
    charitableDonation
  }, ihtConfig);
  
  const netEstateAfterTax = ihtCalc.netEstate;
  const shortfall = targetInheritance - netEstateAfterTax;
  const surplusOrShortfall = shortfall < 0 ? 'surplus' : 'shortfall';
  
  return {
    targetInheritance,
    projectedEstate: projectedEstate.totalEstate,
    inheritanceTax: ihtCalc.inheritanceTax,
    netEstateAfterTax,
    shortfall: Math.abs(shortfall),
    surplusOrShortfall,
    meetsTarget: shortfall <= 0,
    priority,
    urgency: priority === 'must-have' && shortfall > 0 ? 'high' : 'low'
  };
}

/**
 * Generate IHT mitigation strategies
 * 
 * @param {object} estate - Estate details
 * @param {object} ihtCalc - IHT calculation result
 * @returns {Array} Array of strategies with potential savings
 */
export function generateIHTMitigationStrategies(estate, ihtCalc) {
  const strategies = [];
  
  // Strategy 1: Lifetime gifts
  if (ihtCalc.inheritanceTax > 0) {
    const potentialGifts = Math.min(estate.totalEstateValue * 0.2, ihtCalc.taxableEstate);
    const potentialSaving = potentialGifts * ihtCalc.applicableRate;
    
    strategies.push({
      strategy: 'lifetime-gifts',
      name: 'Make lifetime gifts',
      description: 'Gifts made 7+ years before death are IHT-free',
      potentialSaving,
      implementation: `Consider gifting £${potentialGifts.toLocaleString('en-GB')} over time`,
      complexity: 'medium',
      timeframe: '7+ years'
    });
  }
  
  // Strategy 2: Pension planning
  if (estate.pensionPot && estate.pensionPot > 100000) {
    strategies.push({
      strategy: 'pension-preservation',
      name: 'Preserve pension for beneficiaries',
      description: 'Pensions can be passed on tax-efficiently',
      potentialSaving: estate.pensionPot * ihtCalc.applicableRate,
      implementation: 'Draw from ISAs first, preserve pension for inheritance',
      complexity: 'low',
      timeframe: 'ongoing'
    });
  }
  
  // Strategy 3: Charitable donation
  if (!ihtCalc.qualifiesForCharityReduction && ihtCalc.inheritanceTax > 10000) {
    const charityAmount = estate.totalEstateValue * 0.10;
    const taxSaving = ihtCalc.taxableEstate * (ihtCalc.taxRate - IHT_CONFIG.charityReducedRate);
    const netBenefit = taxSaving - charityAmount * ihtCalc.taxRate;
    
    if (netBenefit > 0) {
      strategies.push({
        strategy: 'charitable-donation',
        name: 'Leave 10% to charity',
        description: 'Reduce IHT rate from 40% to 36%',
        potentialSaving: taxSaving,
        implementation: `Leave £${charityAmount.toLocaleString('en-GB')} to charity`,
        complexity: 'low',
        timeframe: 'immediate'
      });
    }
  }
  
  // Strategy 4: Trust planning
  if (estate.totalEstateValue > 1000000) {
    strategies.push({
      strategy: 'trust-planning',
      name: 'Use trust structures',
      description: 'Trusts can provide IHT benefits and control',
      potentialSaving: estate.totalEstateValue * 0.1 * ihtCalc.applicableRate,
      implementation: 'Consult solicitor about discretionary or life interest trusts',
      complexity: 'high',
      timeframe: 'long-term'
    });
  }
  
  // Strategy 5: Business Property Relief
  if (estate.totalEstateValue > 500000) {
    strategies.push({
      strategy: 'business-relief',
      name: 'Business Property Relief investments',
      description: 'AIM shares and business assets may qualify for 100% relief',
      potentialSaving: estate.totalEstateValue * 0.2 * ihtCalc.applicableRate,
      implementation: 'Consider BPR-qualifying investments (higher risk)',
      complexity: 'high',
      timeframe: '2+ years'
    });
  }
  
  // Sort by potential saving
  strategies.sort((a, b) => b.potentialSaving - a.potentialSaving);
  
  return strategies;
}

/**
 * Calculate optimal beneficiary distributions
 * 
 * @param {object} legacyPlan - Legacy plan
 * @param {number} netEstate - Net estate after IHT
 * @returns {Array} Distribution breakdown by beneficiary
 */
export function calculateBeneficiaryDistributions(legacyPlan, netEstate) {
  const { beneficiaries, charitableDonation } = legacyPlan;
  
  // Deduct charitable donation first
  const distributableEstate = netEstate - charitableDonation;
  
  const distributions = beneficiaries.map(beneficiary => {
    const { name, relationship, sharePercentage, specificBequest } = beneficiary;
    
    // Specific bequests come first
    let amount = specificBequest || 0;
    
    // Then percentage of remainder
    if (sharePercentage > 0) {
      const residualEstate = Math.max(0, distributableEstate - 
        beneficiaries.reduce((sum, b) => sum + (b.specificBequest || 0), 0));
      amount += (residualEstate * sharePercentage / 100);
    }
    
    return {
      name,
      relationship,
      amount,
      specificBequest: specificBequest || 0,
      residualShare: sharePercentage || 0
    };
  });
  
  // Add charitable donation
  if (charitableDonation > 0) {
    distributions.push({
      name: 'Charitable Donation',
      relationship: 'charity',
      amount: charitableDonation,
      specificBequest: charitableDonation,
      residualShare: 0
    });
  }
  
  return distributions;
}

/**
 * Validate legacy plan parameters
 * 
 * @param {object} legacyPlan - Legacy plan to validate
 * @param {object} financialContext - Current financial situation
 * @returns {object} Validation result with { valid, errors, warnings }
 */
export function validateLegacyPlan(legacyPlan, financialContext = {}) {
  const errors = [];
  const warnings = [];
  
  if (legacyPlan.targetInheritance < 0) {
    errors.push('Target inheritance must be non-negative');
  }
  
  if (!['must-have', 'nice-to-have'].includes(legacyPlan.priority)) {
    errors.push('Priority must be "must-have" or "nice-to-have"');
  }
  
  if (legacyPlan.charitableDonation < 0) {
    errors.push('Charitable donation must be non-negative');
  }
  
  // Validate beneficiaries
  const totalSharePercentage = legacyPlan.beneficiaries.reduce(
    (sum, b) => sum + (b.sharePercentage || 0), 0
  );
  
  if (totalSharePercentage > 100) {
    errors.push('Total beneficiary shares exceed 100%');
  }
  
  if (legacyPlan.beneficiaries.length > 0 && totalSharePercentage < 100) {
    warnings.push('Beneficiary shares total less than 100% - remainder will follow intestacy rules');
  }
  
  // Financial warnings
  if (financialContext.currentEstateValue) {
    if (legacyPlan.targetInheritance > financialContext.currentEstateValue * 2) {
      warnings.push('Target inheritance is very ambitious given current estate value');
    }
    
    if (legacyPlan.priority === 'must-have' && 
        legacyPlan.targetInheritance > financialContext.projectedEstateValue) {
      warnings.push('Must-have inheritance target exceeds projected estate value');
    }
  }
  
  if (legacyPlan.charitableDonation > legacyPlan.targetInheritance * 0.5) {
    warnings.push('Charitable donation is more than 50% of target inheritance');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
