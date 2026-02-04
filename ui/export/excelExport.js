/**
 * RetireLens 2 - Excel Export
 * 
 * Generate Excel workbooks using SheetJS (xlsx)
 */

/**
 * Generates an Excel workbook from plan data
 * @param {object} plan - The retirement plan
 * @param {object} projection - Projection results
 * @param {object} options - Additional options
 * @returns {Promise<Blob>} Excel blob
 */
export async function generateExcel(plan, projection, options = {}) {
  // Check for XLSX availability
  if (typeof XLSX === 'undefined') {
    throw new Error('SheetJS (XLSX) library not loaded. Please include xlsx in your HTML.');
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summarySheet = createSummarySheet(plan, projection, options);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Sheet 2: Accumulation Phase (pre-retirement)
  const accumulationSheet = createAccumulationSheet(plan, projection);
  XLSX.utils.book_append_sheet(wb, accumulationSheet, 'Accumulation');

  // Sheet 3: Decumulation Phase (post-retirement)
  const decumulationSheet = createDecumulationSheet(plan, projection);
  XLSX.utils.book_append_sheet(wb, decumulationSheet, 'Decumulation');

  // Sheet 4: Full Year-by-Year
  const yearByYearSheet = createYearByYearSheet(projection);
  XLSX.utils.book_append_sheet(wb, yearByYearSheet, 'Year-by-Year');

  // Sheet 5: Assumptions
  const assumptionsSheet = createAssumptionsSheet(plan);
  XLSX.utils.book_append_sheet(wb, assumptionsSheet, 'Assumptions');

  // Generate binary string
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Downloads the Excel workbook
 */
export async function downloadExcel(plan, projection, options = {}) {
  try {
    const blob = await generateExcel(plan, projection, options);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retirelens-${plan.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Excel generation failed:', error);
    throw error;
  }
}

/**
 * Creates the summary sheet
 */
function createSummarySheet(plan, projection, options) {
  const data = [];
  
  // Header
  data.push(['RetireLens 2 - Retirement Plan Summary']);
  data.push([`Plan: ${plan.name}`]);
  data.push([`Generated: ${new Date().toLocaleDateString('en-GB')}`]);
  data.push([]);

  // Key Metrics
  data.push(['KEY METRICS']);
  data.push(['Current Age', plan.currentAge]);
  data.push(['Retirement Age', plan.retirementAge]);
  data.push(['State Pension Age', plan.statePensionAge]);
  data.push(['Years to Retirement', plan.retirementAge - plan.currentAge]);
  data.push([]);

  data.push(['FINANCIAL POSITION']);
  data.push(['Current Pension Pot', plan.currentPension, '£']);
  data.push(['Current ISA', plan.currentIsa, '£']);
  data.push(['Total Current Assets', plan.currentPension + plan.currentIsa, '£']);
  data.push([]);

  data.push(['CONTRIBUTIONS']);
  data.push(['Annual Pension Contribution', plan.annualPensionContribution, '£']);
  data.push(['Annual ISA Contribution', plan.annualIsaContribution, '£']);
  data.push(['Total Annual Contributions', plan.annualPensionContribution + plan.annualIsaContribution, '£']);
  data.push([]);

  data.push(['INCOME']);
  data.push(['Target Net Income', plan.targetNetIncome, '£/year']);
  data.push(['Expected State Pension', plan.expectedStatePension, '£/year']);
  data.push([]);

  // Projection Results
  if (projection.years && projection.years.length > 0) {
    const retirementYear = projection.years.find(y => y.age === plan.retirementAge);
    const finalYear = projection.years[projection.years.length - 1];

    data.push(['PROJECTION RESULTS']);
    data.push(['Pot at Retirement', retirementYear?.totalPot || 0, '£']);
    data.push(['First Year Withdrawal', retirementYear?.withdrawal || 0, '£']);
    data.push(['First Year Net Income', retirementYear?.netIncome || 0, '£']);
    data.push(['Final Pot', finalYear?.totalPot || 0, '£']);
    data.push([]);
  }

  // Monte Carlo Results
  if (options.monteCarloResults) {
    data.push(['MONTE CARLO ANALYSIS']);
    data.push(['Success Rate', `${options.monteCarloResults.successRate.toFixed(1)}%`]);
    data.push(['Median Final Pot', options.monteCarloResults.medianFinalPot, '£']);
    data.push(['10th Percentile', options.monteCarloResults.percentile10, '£']);
    data.push(['90th Percentile', options.monteCarloResults.percentile90, '£']);
    data.push([]);
  }

  // Readiness Score
  if (options.readinessScore) {
    data.push(['READINESS SCORE']);
    data.push(['Overall Score', `${options.readinessScore.overallScore.toFixed(0)}%`]);
    Object.entries(options.readinessScore.components || {}).forEach(([key, value]) => {
      data.push([key, `${value.toFixed(0)}%`]);
    });
  }

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Creates the accumulation phase sheet
 */
function createAccumulationSheet(plan, projection) {
  const data = [];
  
  data.push(['ACCUMULATION PHASE (Pre-Retirement)']);
  data.push([]);
  data.push(['Age', 'Year', 'Pension Pot (£)', 'ISA (£)', 'Total Pot (£)', 'Annual Contribution (£)', 'Growth (£)']);

  const accumulationYears = projection.years?.filter(y => y.age < plan.retirementAge) || [];
  
  accumulationYears.forEach(year => {
    const contribution = plan.annualPensionContribution + plan.annualIsaContribution;
    const growth = year.totalPot - (year.age === plan.currentAge ? 
      plan.currentPension + plan.currentIsa : 
      projection.years[projection.years.indexOf(year) - 1]?.totalPot || 0) - contribution;

    data.push([
      year.age,
      year.age - plan.currentAge + 1,
      year.pensionPot || 0,
      year.isa || 0,
      year.totalPot,
      contribution,
      growth
    ]);
  });

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Creates the decumulation phase sheet
 */
function createDecumulationSheet(plan, projection) {
  const data = [];
  
  data.push(['DECUMULATION PHASE (Retirement)']);
  data.push([]);
  data.push([
    'Age', 
    'Year', 
    'Pension Pot (£)', 
    'ISA (£)', 
    'Total Pot (£)', 
    'Withdrawal (£)', 
    'State Pension (£)',
    'Gross Income (£)',
    'Tax (£)',
    'Net Income (£)'
  ]);

  const decumulationYears = projection.years?.filter(y => y.age >= plan.retirementAge) || [];
  
  decumulationYears.forEach(year => {
    data.push([
      year.age,
      year.age - plan.retirementAge + 1,
      year.pensionPot || 0,
      year.isa || 0,
      year.totalPot,
      year.withdrawal || 0,
      year.statePension || 0,
      year.grossIncome || 0,
      year.totalTax || 0,
      year.netIncome || 0
    ]);
  });

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Creates the full year-by-year sheet
 */
function createYearByYearSheet(projection) {
  const data = [];
  
  data.push(['COMPLETE YEAR-BY-YEAR PROJECTION']);
  data.push([]);
  data.push([
    'Age',
    'Total Pot (£)',
    'Pension Pot (£)',
    'ISA (£)',
    'Withdrawal (£)',
    'State Pension (£)',
    'DB Pension (£)',
    'Gross Income (£)',
    'Tax (£)',
    'Net Income (£)',
    'PCLS Taken (£)'
  ]);

  projection.years?.forEach(year => {
    data.push([
      year.age,
      year.totalPot,
      year.pensionPot || 0,
      year.isa || 0,
      year.withdrawal || 0,
      year.statePension || 0,
      year.dbPension || 0,
      year.grossIncome || 0,
      year.totalTax || 0,
      year.netIncome || 0,
      year.pclsTaken || 0
    ]);
  });

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Creates the assumptions sheet
 */
function createAssumptionsSheet(plan) {
  const data = [];
  
  data.push(['PLAN ASSUMPTIONS']);
  data.push([]);

  const assumptions = plan.assumptions || {};

  data.push(['RETURNS']);
  data.push(['Pension Growth Rate', `${((assumptions.pensionGrowthRate || 0.05) * 100).toFixed(1)}%`]);
  data.push(['ISA Growth Rate', `${((assumptions.isaGrowthRate || 0.05) * 100).toFixed(1)}%`]);
  data.push([]);

  data.push(['INFLATION']);
  data.push(['Inflation Rate', `${((assumptions.inflationRate || 0.025) * 100).toFixed(2)}%`]);
  data.push([]);

  data.push(['TAX']);
  data.push(['Personal Allowance', assumptions.personalAllowance || 12570, '£']);
  data.push(['Basic Rate Threshold', assumptions.basicRateThreshold || 50270, '£']);
  data.push(['Basic Rate', `${((assumptions.basicRate || 0.20) * 100).toFixed(0)}%`]);
  data.push(['Higher Rate', `${((assumptions.higherRate || 0.40) * 100).toFixed(0)}%`]);
  data.push([]);

  data.push(['STATE PENSION']);
  data.push(['State Pension Age', plan.statePensionAge]);
  data.push(['Expected Annual Amount', plan.expectedStatePension, '£']);
  data.push([]);

  data.push(['SPENDING']);
  data.push(['Age-Based Reductions', plan.applyAgeBasedSpendingReductions ? 'Yes' : 'No']);
  if (plan.spendingRules && plan.spendingRules.length > 0) {
    data.push([]);
    data.push(['SPENDING RULES']);
    data.push(['Type', 'Start Age', 'End Age', 'Amount (£)']);
    plan.spendingRules.forEach(rule => {
      data.push([
        rule.type || 'standard',
        rule.startAge,
        rule.endAge,
        rule.amount
      ]);
    });
  }

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Helper to load XLSX dynamically if not available
 */
export async function ensureXLSXLoaded() {
  if (typeof window !== 'undefined' && typeof XLSX === 'undefined') {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.18.5/package/dist/xlsx.full.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}
