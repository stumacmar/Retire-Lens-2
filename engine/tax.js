/**
 * RetireLens 2 - Tax Calculation Engine
 * 
 * Pure functions for UK income tax calculations.
 * All functions are deterministic with no side effects.
 */

import { TAX_CONFIG } from '../config/defaults.js';

/**
 * Calculate personal allowance after taper
 * 
 * Personal allowance is reduced by £1 for every £2 of income over £100,000
 * until it reaches zero at £125,140
 * 
 * @param {number} grossIncome - Total gross income for the year
 * @param {object} config - Tax configuration (optional, defaults to current config)
 * @returns {number} Available personal allowance
 */
export function calculatePersonalAllowance(grossIncome, config = TAX_CONFIG) {
  const { personalAllowance, personalAllowanceTaperThreshold, personalAllowanceTaperRate } = config;
  
  if (grossIncome <= personalAllowanceTaperThreshold) {
    return personalAllowance;
  }
  
  const reduction = Math.floor((grossIncome - personalAllowanceTaperThreshold) * personalAllowanceTaperRate);
  return Math.max(0, personalAllowance - reduction);
}

/**
 * Calculate income tax on taxable income
 * 
 * @param {number} taxableIncome - Income after personal allowance
 * @param {object} config - Tax configuration (optional)
 * @returns {object} Tax breakdown by band
 */
export function calculateIncomeTax(taxableIncome, config = TAX_CONFIG) {
  if (taxableIncome <= 0) {
    return {
      total: 0,
      byBand: [],
      effectiveRate: 0
    };
  }

  const { bands } = config;
  const byBand = [];
  let remaining = taxableIncome;
  let total = 0;
  let previousThreshold = 0;

  for (const band of bands) {
    if (remaining <= 0) break;
    
    const bandWidth = band.threshold - previousThreshold;
    const taxableInBand = Math.min(remaining, bandWidth);
    const taxInBand = taxableInBand * band.rate;
    
    if (taxableInBand > 0) {
      byBand.push({
        name: band.name,
        taxableAmount: taxableInBand,
        rate: band.rate,
        tax: taxInBand
      });
      total += taxInBand;
    }
    
    remaining -= taxableInBand;
    previousThreshold = band.threshold;
  }

  return {
    total,
    byBand,
    effectiveRate: taxableIncome > 0 ? total / taxableIncome : 0
  };
}

/**
 * Calculate full tax liability from gross income
 * 
 * @param {number} grossIncome - Total gross income
 * @param {object} config - Tax configuration (optional)
 * @returns {object} Complete tax calculation breakdown
 */
export function calculateTaxFromGross(grossIncome, config = TAX_CONFIG) {
  const personalAllowance = calculatePersonalAllowance(grossIncome, config);
  const taxableIncome = Math.max(0, grossIncome - personalAllowance);
  const taxCalculation = calculateIncomeTax(taxableIncome, config);
  
  return {
    grossIncome,
    personalAllowance,
    taxableIncome,
    ...taxCalculation,
    netIncome: grossIncome - taxCalculation.total
  };
}

/**
 * Calculate gross income needed to achieve target net income
 * 
 * Uses iterative approximation to find gross amount.
 * This is the inverse of calculateTaxFromGross.
 * 
 * @param {number} targetNetIncome - Desired net income after tax
 * @param {object} config - Tax configuration (optional)
 * @param {number} maxIterations - Maximum iterations for convergence
 * @returns {object} Gross amount and tax breakdown
 */
export function calculateGrossFromNet(targetNetIncome, config = TAX_CONFIG, maxIterations = 20) {
  // Initial estimate: assume ~25% average tax rate
  let gross = targetNetIncome * 1.25;
  const tolerance = 0.01; // Within 1p
  
  for (let i = 0; i < maxIterations; i++) {
    const result = calculateTaxFromGross(gross, config);
    const difference = result.netIncome - targetNetIncome;
    
    if (Math.abs(difference) < tolerance) {
      return {
        grossRequired: Math.ceil(gross * 100) / 100,
        ...result
      };
    }
    
    // Adjust gross based on marginal rate
    const marginalRate = getMarginalRate(gross, config);
    gross -= difference / (1 - marginalRate);
  }
  
  // Return best estimate even if not converged
  const finalResult = calculateTaxFromGross(gross, config);
  return {
    grossRequired: Math.ceil(gross * 100) / 100,
    converged: false,
    ...finalResult
  };
}

/**
 * Get marginal tax rate at a given income level
 * 
 * @param {number} grossIncome - Current gross income
 * @param {object} config - Tax configuration (optional)
 * @returns {number} Marginal rate (decimal)
 */
export function getMarginalRate(grossIncome, config = TAX_CONFIG) {
  const personalAllowance = calculatePersonalAllowance(grossIncome, config);
  const taxableIncome = Math.max(0, grossIncome - personalAllowance);
  
  // Check if in taper zone (effective 60% rate)
  const { personalAllowanceTaperThreshold, bands } = config;
  if (grossIncome > personalAllowanceTaperThreshold && personalAllowance > 0) {
    // In the taper zone, effective marginal rate is higher
    // For every £2 earned, lose £1 of allowance (taxed at 40% = extra 20%)
    // Plus the 40% on the income itself = 60% effective rate
    return 0.60;
  }
  
  // Find the band this income falls into
  let previousThreshold = 0;
  for (const band of bands) {
    if (taxableIncome <= band.threshold) {
      return band.rate;
    }
    previousThreshold = band.threshold;
  }
  
  // Above all thresholds
  return bands[bands.length - 1].rate;
}

/**
 * Calculate National Insurance (simplified - future extension)
 * Note: NI is not typically paid on pension income, only on employment income
 * 
 * @param {number} earnings - Employment earnings
 * @returns {object} NI calculation
 */
export function calculateNationalInsurance(earnings) {
  // Class 1 NI thresholds 2024/25
  const primaryThreshold = 12570;
  const upperEarningsLimit = 50270;
  const mainRate = 0.08; // Reduced from 12% in Jan 2024
  const upperRate = 0.02;
  
  if (earnings <= primaryThreshold) {
    return { total: 0, byBand: [] };
  }
  
  let total = 0;
  const byBand = [];
  
  // Main rate band
  const mainBandEarnings = Math.min(earnings, upperEarningsLimit) - primaryThreshold;
  if (mainBandEarnings > 0) {
    const mainNI = mainBandEarnings * mainRate;
    byBand.push({ name: 'Main Rate', amount: mainBandEarnings, rate: mainRate, ni: mainNI });
    total += mainNI;
  }
  
  // Upper rate
  if (earnings > upperEarningsLimit) {
    const upperBandEarnings = earnings - upperEarningsLimit;
    const upperNI = upperBandEarnings * upperRate;
    byBand.push({ name: 'Upper Rate', amount: upperBandEarnings, rate: upperRate, ni: upperNI });
    total += upperNI;
  }
  
  return { total, byBand };
}

/**
 * Compute UK income tax for retirement income (IFA-grade)
 * 
 * This function handles mixed retirement income sources:
 * - State Pension (taxable)
 * - DB Pension (taxable)
 * - DC Pension withdrawals (taxable, except PCLS)
 * - ISA withdrawals (tax-free)
 * - PCLS (tax-free)
 * 
 * @param {object} params - Income parameters
 * @param {number} params.statePension - Annual state pension (taxable)
 * @param {number} params.dbPension - Annual DB pension (taxable)
 * @param {number} params.pensionWithdrawal - DC pension withdrawal (taxable portion)
 * @param {number} params.isaWithdrawal - ISA withdrawal (tax-free)
 * @param {number} params.pclsWithdrawal - PCLS tax-free cash (tax-free)
 * @param {number} params.otherTaxableIncome - Any other taxable income
 * @param {object} params.config - Tax configuration (optional)
 * @returns {object} Tax calculation breakdown
 */
export function computeUKTax(params = {}) {
  const {
    statePension = 0,
    dbPension = 0,
    pensionWithdrawal = 0,
    isaWithdrawal = 0,
    pclsWithdrawal = 0,
    otherTaxableIncome = 0,
    config = TAX_CONFIG
  } = params;
  
  // Ensure no NaN values - defensive programming
  const safeNumber = (val) => (typeof val === 'number' && !isNaN(val)) ? val : 0;
  
  const safeStatePension = safeNumber(statePension);
  const safeDbPension = safeNumber(dbPension);
  const safePensionWithdrawal = safeNumber(pensionWithdrawal);
  const safeIsaWithdrawal = safeNumber(isaWithdrawal);
  const safePclsWithdrawal = safeNumber(pclsWithdrawal);
  const safeOtherTaxable = safeNumber(otherTaxableIncome);
  
  // Calculate taxable income (SP + DB + DC pension withdrawals + other)
  const taxableIncome = safeStatePension + safeDbPension + safePensionWithdrawal + safeOtherTaxable;
  
  // Tax-free income (ISA + PCLS)
  const taxFreeIncome = safeIsaWithdrawal + safePclsWithdrawal;
  
  // Total gross income (for reference)
  const grossIncome = taxableIncome + taxFreeIncome;
  
  // Calculate personal allowance (with taper if applicable)
  const personalAllowance = calculatePersonalAllowance(taxableIncome, config);
  const allowanceUsed = Math.min(personalAllowance, taxableIncome);
  
  // Calculate taxable amount after personal allowance
  const taxableAfterAllowance = Math.max(0, taxableIncome - personalAllowance);
  
  // Calculate income tax on taxable portion
  const taxResult = calculateIncomeTax(taxableAfterAllowance, config);
  
  // Net income = gross - tax
  const netIncome = grossIncome - taxResult.total;
  
  // Build breakdown by source
  const incomeBreakdown = {
    taxable: {
      statePension: safeStatePension,
      dbPension: safeDbPension,
      pensionWithdrawal: safePensionWithdrawal,
      otherTaxable: safeOtherTaxable,
      total: taxableIncome
    },
    taxFree: {
      isaWithdrawal: safeIsaWithdrawal,
      pclsWithdrawal: safePclsWithdrawal,
      total: taxFreeIncome
    }
  };
  
  return {
    // Primary outputs (never NaN)
    incomeTax: taxResult.total || 0,
    netIncome: netIncome || 0,
    allowanceUsed: allowanceUsed || 0,
    
    // Detailed breakdown
    grossIncome: grossIncome || 0,
    taxableIncome: taxableIncome || 0,
    taxFreeIncome: taxFreeIncome || 0,
    personalAllowance: personalAllowance || 0,
    taxableAfterAllowance: taxableAfterAllowance || 0,
    effectiveRate: grossIncome > 0 ? (taxResult.total / grossIncome) : 0,
    marginalRate: getMarginalRate(taxableIncome, config),
    
    // Band breakdown
    taxByBand: taxResult.byBand || [],
    
    // Source breakdown
    incomeBreakdown
  };
}

/**
 * Run tax engine tests (executed only in DEBUG mode on page load)
 * 
 * These tests dynamically reference TAX_CONFIG values to ensure they
 * automatically adapt if the tax configuration is updated.
 * Current TAX_CONFIG uses 2024/25 UK rates.
 * 
 * @returns {object} Test results
 */
export function runTaxTests() {
  const tests = [];
  const assert = (condition, name, details = '') => {
    tests.push({ name, passed: condition, details });
    return condition;
  };
  
  // Tax thresholds dynamically loaded from TAX_CONFIG
  const PA = TAX_CONFIG.personalAllowance;
  const BASIC_RATE = TAX_CONFIG.bands[0].rate;
  const BASIC_BAND_WIDTH = TAX_CONFIG.bands[0].threshold;
  const HIGHER_RATE = TAX_CONFIG.bands[1].rate;
  
  // Test 1: Gross income of 0
  const test1 = computeUKTax({ statePension: 0, pensionWithdrawal: 0 });
  assert(test1.incomeTax === 0, 'Gross 0 → no tax', `Tax: ${test1.incomeTax}`);
  assert(test1.netIncome === 0, 'Gross 0 → net 0', `Net: ${test1.netIncome}`);
  assert(!isNaN(test1.incomeTax), 'Gross 0 → no NaN', `Tax: ${test1.incomeTax}`);
  
  // Test 2: Income = Personal Allowance
  const test2 = computeUKTax({ statePension: PA });
  assert(test2.incomeTax === 0, 'Income = PA → no tax', `Tax: ${test2.incomeTax}`);
  assert(test2.netIncome === PA, 'Income = PA → full net', `Net: ${test2.netIncome}`);
  
  // Test 3: Basic rate band (PA + basic rate)
  const basicIncome = 25000;
  const test3 = computeUKTax({ pensionWithdrawal: basicIncome });
  const expectedTax3 = (basicIncome - PA) * BASIC_RATE;
  assert(Math.abs(test3.incomeTax - expectedTax3) < 0.01, 'Basic rate band calculation', `Expected: ${expectedTax3}, Got: ${test3.incomeTax}`);
  
  // Test 4: Higher rate band
  const higherIncome = 60000;
  const test4 = computeUKTax({ pensionWithdrawal: higherIncome });
  const basicTax = BASIC_BAND_WIDTH * BASIC_RATE;
  const higherTax = (higherIncome - PA - BASIC_BAND_WIDTH) * HIGHER_RATE;
  const expectedTax4 = basicTax + higherTax;
  assert(Math.abs(test4.incomeTax - expectedTax4) < 0.01, 'Higher rate band calculation', `Expected: ${expectedTax4}, Got: ${test4.incomeTax}`);
  
  // Test 5: Mix of SP + DB + pension withdrawal
  const spTest5 = 11500;
  const dbTest5 = 5200;
  const pensionTest5 = 20000;
  const isaTest5 = 5000;
  const test5 = computeUKTax({
    statePension: spTest5,
    dbPension: dbTest5,
    pensionWithdrawal: pensionTest5,
    isaWithdrawal: isaTest5
  });
  // Taxable income and expected tax using TAX_CONFIG values
  const taxable5 = spTest5 + dbTest5 + pensionTest5;
  const taxableAfterPA5 = taxable5 - PA;
  const expectedTax5 = taxableAfterPA5 * BASIC_RATE; // All in basic band
  assert(Math.abs(test5.incomeTax - expectedTax5) < 0.01, 'SP + DB + pension mix', `Expected: ${expectedTax5}, Got: ${test5.incomeTax}`);
  // Net should include tax-free ISA
  const expectedNet5 = taxable5 + isaTest5 - expectedTax5;
  assert(Math.abs(test5.netIncome - expectedNet5) < 0.01, 'Net includes ISA', `Expected: ${expectedNet5}, Got: ${test5.netIncome}`);
  
  // Test 6: ISA only (tax-free)
  const test6 = computeUKTax({ isaWithdrawal: 50000 });
  assert(test6.incomeTax === 0, 'ISA only → no tax', `Tax: ${test6.incomeTax}`);
  assert(test6.netIncome === 50000, 'ISA only → full net', `Net: ${test6.netIncome}`);
  
  // Test 7: PCLS only (tax-free)
  const test7 = computeUKTax({ pclsWithdrawal: 100000 });
  assert(test7.incomeTax === 0, 'PCLS only → no tax', `Tax: ${test7.incomeTax}`);
  assert(test7.netIncome === 100000, 'PCLS only → full net', `Net: ${test7.netIncome}`);
  
  // Test 8: Personal allowance taper at £110k
  const test8 = computeUKTax({ pensionWithdrawal: 110000 });
  const taperThreshold = TAX_CONFIG.personalAllowanceTaperThreshold; // 100000
  const expectedPA8 = Math.max(0, PA - Math.floor((110000 - taperThreshold) * 0.5));
  assert(Math.abs(test8.personalAllowance - expectedPA8) < 0.01, 'PA taper at £110k', `PA: ${test8.personalAllowance}, Expected: ${expectedPA8}`);
  
  // Test 9: PA fully tapered at £125,140+
  const test9 = computeUKTax({ pensionWithdrawal: 130000 });
  assert(test9.personalAllowance === 0, 'PA fully tapered at £130k', `PA: ${test9.personalAllowance}`);
  
  // Test 10: DB + SP + DC withdrawal combined (2025/26: SP = £11,973)
  const test10 = computeUKTax({
    statePension: 11973,
    dbPension: 5000,
    pensionWithdrawal: 15000,
    isaWithdrawal: 10000
  });
  const taxable10 = 11973 + 5000 + 15000; // 31,973
  const taxableAfterPA10 = taxable10 - PA; // 31,973 - 12,570 = 19,403
  const expectedTax10 = taxableAfterPA10 * BASIC_RATE; // 19,403 * 0.20 = 3,880.60
  assert(Math.abs(test10.incomeTax - expectedTax10) < 0.01, 'SP+DB+DC mix (2025/26 rates)', `Expected: ${expectedTax10.toFixed(2)}, Got: ${test10.incomeTax.toFixed(2)}`);
  // Net = 31,973 + 10,000 - 3,880.60 = 38,092.40
  const expectedNet10 = taxable10 + 10000 - expectedTax10;
  assert(Math.abs(test10.netIncome - expectedNet10) < 0.01, 'SP+DB+DC+ISA net income', `Expected: ${expectedNet10.toFixed(2)}, Got: ${test10.netIncome.toFixed(2)}`);
  
  // Test 11: Couples tax (two personal allowances)
  const coupleTest = calculateCouplesTax(
    { statePension: 11973, pensionWithdrawal: 10000 },
    { statePension: 11973, dbPension: 5000 }
  );
  // Person 1: taxable 21,973, after PA 9,403, tax 1,880.60
  // Person 2: taxable 16,973, after PA 4,403, tax 880.60
  const expectedCoupleTax = ((21973 - PA) * BASIC_RATE) + ((16973 - PA) * BASIC_RATE);
  assert(Math.abs(coupleTest.household.totalTax - expectedCoupleTax) < 0.01, 'Couples tax calculation (two PAs)', `Expected: ${expectedCoupleTax.toFixed(2)}, Got: ${coupleTest.household.totalTax.toFixed(2)}`);
  
  // Summary
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  
  return {
    total: tests.length,
    passed,
    failed,
    tests,
    allPassed: failed === 0
  };
}

/**
 * Calculate tax for a couple (per-person calculation)
 * Each person has their own personal allowance and tax bands
 * 
 * @param {object} person1Income - Person 1 income breakdown
 * @param {object} person2Income - Person 2 income breakdown (optional for single)
 * @param {object} config - Tax configuration (optional)
 * @returns {object} Combined household tax calculation
 */
export function calculateCouplesTax(person1Income, person2Income = null, config = TAX_CONFIG) {
  // Calculate Person 1 tax
  const person1Tax = computeUKTax({
    statePension: person1Income.statePension || 0,
    dbPension: person1Income.dbPension || 0,
    pensionWithdrawal: person1Income.pensionWithdrawal || 0,
    isaWithdrawal: person1Income.isaWithdrawal || 0,
    pclsWithdrawal: person1Income.pclsWithdrawal || 0,
    otherTaxableIncome: person1Income.otherTaxableIncome || 0,
    config
  });
  
  // Single person - return immediately
  if (!person2Income) {
    return {
      household: {
        totalTax: person1Tax.incomeTax,
        totalNetIncome: person1Tax.netIncome,
        totalGrossIncome: person1Tax.grossIncome
      },
      person1: person1Tax,
      person2: null
    };
  }
  
  // Calculate Person 2 tax
  const person2Tax = computeUKTax({
    statePension: person2Income.statePension || 0,
    dbPension: person2Income.dbPension || 0,
    pensionWithdrawal: person2Income.pensionWithdrawal || 0,
    isaWithdrawal: person2Income.isaWithdrawal || 0,
    pclsWithdrawal: person2Income.pclsWithdrawal || 0,
    otherTaxableIncome: person2Income.otherTaxableIncome || 0,
    config
  });
  
  return {
    household: {
      totalTax: person1Tax.incomeTax + person2Tax.incomeTax,
      totalNetIncome: person1Tax.netIncome + person2Tax.netIncome,
      totalGrossIncome: person1Tax.grossIncome + person2Tax.grossIncome,
      combinedPersonalAllowance: person1Tax.personalAllowance + person2Tax.personalAllowance,
      combinedEffectiveRate: (person1Tax.grossIncome + person2Tax.grossIncome) > 0 
        ? (person1Tax.incomeTax + person2Tax.incomeTax) / (person1Tax.grossIncome + person2Tax.grossIncome)
        : 0
    },
    person1: person1Tax,
    person2: person2Tax
  };
}
