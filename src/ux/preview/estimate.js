/**
 * RetireLens 2 - Preview Estimate Calculator
 * 
 * Single helper function for live preview estimates.
 * IMPORTANT: Simplified estimate only - no full tax/ISA/PCLS sequencing.
 */

/**
 * Default assumptions for preview
 */
const PREVIEW_DEFAULTS = {
  realReturnRate: 0.04,      // 4% real return (after inflation)
  safeWithdrawalRate: 0.04,  // 4% rule
  feeRate: 0.005             // 0.5% annual fees
};

/**
 * Calculate a simplified annuity factor approximation
 * This is a rough approximation for contribution growth
 * @param {number} rate - Annual growth rate
 * @param {number} years - Number of years
 * @returns {number} Annuity factor
 */
function annuityFactorApprox(rate, years) {
  if (rate === 0 || years <= 0) return years;
  return ((Math.pow(1 + rate, years) - 1) / rate);
}

/**
 * Calculate preview estimate based on current inputs
 * 
 * Simplified formula:
 *   projectedPot = pensionPot * (1 + realReturn)^years + contributions * annuityFactor
 *   incomeFromPot = projectedPot * safeWithdrawalRate (4%)
 *   gap = targetNet - incomeFromPot - statePensionEstimate
 * 
 * @param {object} inputs - Current form inputs
 * @param {number} inputs.currentAge - User's current age
 * @param {number} inputs.retirementAge - Target retirement age
 * @param {number} inputs.targetNetIncome - Target annual net income
 * @param {number} inputs.currentPension - Current pension pot value
 * @param {number} [inputs.annualPensionContribution=0] - Annual pension contribution
 * @param {number} [inputs.currentIsa=0] - Current ISA balance
 * @param {number} [inputs.annualIsaContribution=0] - Annual ISA contribution
 * @param {number} [inputs.expectedStatePension=0] - Expected state pension (annual)
 * @param {number} [inputs.statePensionAge=67] - State pension age
 * @returns {object} Preview estimate result
 */
export function estimatePreview(inputs) {
  const {
    currentAge = 0,
    retirementAge = 0,
    targetNetIncome = 0,
    currentPension = 0,
    annualPensionContribution = 0,
    currentIsa = 0,
    annualIsaContribution = 0,
    expectedStatePension = 0,
    statePensionAge = 67
  } = inputs;
  
  // Validate minimum inputs
  const errors = [];
  if (!currentAge || currentAge < 18) errors.push('age');
  if (!retirementAge || retirementAge <= currentAge) errors.push('retirementAge');
  
  // Calculate years to retirement
  const yearsToRetirement = retirementAge - currentAge;
  
  // If essential inputs missing, return incomplete state
  if (errors.length > 0 || yearsToRetirement <= 0) {
    return {
      isComplete: false,
      missingFields: errors,
      hint: 'Enter age and retirement age to see estimate',
      projectedPotAtRetirement: null,
      gapOrSurplus: null,
      incomeFromPot: null,
      note: 'Estimate only — full tax/ISA/PCLS sequencing in next phase.'
    };
  }
  
  // Net growth rate (after fees)
  const netGrowthRate = PREVIEW_DEFAULTS.realReturnRate - PREVIEW_DEFAULTS.feeRate;
  
  // Project pension pot growth
  const pensionGrowthFactor = Math.pow(1 + netGrowthRate, yearsToRetirement);
  const pensionFromExisting = currentPension * pensionGrowthFactor;
  const pensionFromContributions = annualPensionContribution * annuityFactorApprox(netGrowthRate, yearsToRetirement);
  const projectedPension = pensionFromExisting + pensionFromContributions;
  
  // Project ISA growth
  const isaGrowthFactor = Math.pow(1 + netGrowthRate, yearsToRetirement);
  const isaFromExisting = currentIsa * isaGrowthFactor;
  const isaFromContributions = annualIsaContribution * annuityFactorApprox(netGrowthRate, yearsToRetirement);
  const projectedIsa = isaFromExisting + isaFromContributions;
  
  // Total projected pot at retirement
  const projectedPotAtRetirement = projectedPension + projectedIsa;
  
  // Estimate income from pot using 4% rule
  const incomeFromPot = projectedPotAtRetirement * PREVIEW_DEFAULTS.safeWithdrawalRate;
  
  // State pension (only count if retirement age >= state pension age)
  const statePensionIncome = retirementAge >= statePensionAge ? expectedStatePension : 0;
  
  // Total projected income
  const totalProjectedIncome = incomeFromPot + statePensionIncome;
  
  // Calculate gap or surplus
  const gapOrSurplus = totalProjectedIncome - targetNetIncome;
  
  // Determine status
  let status;
  if (!targetNetIncome || targetNetIncome === 0) {
    status = 'Enter target income';
  } else if (gapOrSurplus >= 0) {
    status = 'on-track';
  } else if (gapOrSurplus >= -5000) {
    status = 'close';
  } else {
    status = 'gap';
  }
  
  return {
    isComplete: true,
    projectedPotAtRetirement: Math.round(projectedPotAtRetirement),
    projectedPension: Math.round(projectedPension),
    projectedIsa: Math.round(projectedIsa),
    incomeFromPot: Math.round(incomeFromPot),
    statePensionIncome: Math.round(statePensionIncome),
    totalProjectedIncome: Math.round(totalProjectedIncome),
    gapOrSurplus: Math.round(gapOrSurplus),
    status,
    yearsToRetirement,
    withdrawalRate: currentPension > 0 ? PREVIEW_DEFAULTS.safeWithdrawalRate * 100 : null,
    note: 'Estimate only — full tax/ISA/PCLS sequencing in next phase.',
    basis: '4% rule + your inputs'
  };
}

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export function formatPreviewCurrency(amount) {
  if (amount === null || amount === undefined) return '—';
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000000) {
    return '£' + (amount / 1000000).toFixed(1) + 'M';
  }
  if (absAmount >= 1000) {
    return '£' + Math.round(amount).toLocaleString();
  }
  return '£' + amount.toFixed(0);
}

/**
 * Format gap/surplus for display
 * @param {number} amount - Gap or surplus amount
 * @returns {{ text: string, class: string }} Display object
 */
export function formatGapSurplus(amount) {
  if (amount === null || amount === undefined) {
    return { text: '—', class: 'neutral' };
  }
  
  const formatted = formatPreviewCurrency(Math.abs(amount));
  
  if (amount >= 0) {
    return { text: `+${formatted}/yr surplus`, class: 'surplus' };
  } else {
    return { text: `-${formatted}/yr gap`, class: 'gap' };
  }
}
