/**
 * RetireLens 2 - PDF Export
 * 
 * Generate professional PDF reports using jsPDF and html2canvas
 * Note: Dependencies loaded via CDN or npm in production
 */

/**
 * Generates a PDF report from plan data
 * @param {object} plan - The retirement plan
 * @param {object} projection - Projection results
 * @param {object} options - Additional options (insights, monteCarloResults, etc.)
 * @returns {Promise<Blob>} PDF blob
 */
export async function generatePDF(plan, projection, options = {}) {
  // Check for jsPDF availability
  if (typeof window === 'undefined' || !window.jspdf) {
    throw new Error('jsPDF library not loaded. Please include jsPDF in your HTML.');
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  
  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (2 * margin);

  // Helper to check if we need a new page
  const checkPageBreak = (needed = 20) => {
    if (yPosition + needed > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Title Page
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('RetireLens 2 Report', pageWidth / 2, 25, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(plan.name || 'Retirement Plan', pageWidth / 2, 35, { align: 'center' });
  
  const date = new Date().toLocaleDateString('en-GB', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  });
  doc.text(`Generated: ${date}`, pageWidth / 2, 42, { align: 'center' });

  yPosition = 60;
  doc.setTextColor(0, 0, 0);

  // Executive Summary
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Executive Summary', margin, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  const summary = generateExecutiveSummary(plan, projection, options);
  const summaryLines = doc.splitTextToSize(summary, contentWidth);
  doc.text(summaryLines, margin, yPosition);
  yPosition += summaryLines.length * 5 + 10;

  checkPageBreak(40);

  // Key Metrics
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Key Metrics', margin, yPosition);
  yPosition += 10;

  const metrics = generateKeyMetrics(plan, projection, options);
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');

  const metricsPerRow = 2;
  const metricBoxWidth = contentWidth / metricsPerRow - 5;
  
  metrics.forEach((metric, index) => {
    const col = index % metricsPerRow;
    const row = Math.floor(index / metricsPerRow);
    const x = margin + col * (metricBoxWidth + 10);
    const y = yPosition + row * 25;

    if (row > 0 && row % 3 === 0) {
      checkPageBreak();
    }

    // Metric box
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, y, metricBoxWidth, 20, 2, 2, 'S');
    
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(metric.label, x + 3, y + 6);
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text(metric.value, x + 3, y + 14);
    doc.setFont(undefined, 'normal');
  });

  yPosition += Math.ceil(metrics.length / metricsPerRow) * 25 + 10;
  checkPageBreak();

  // Plan Details
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Plan Details', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  
  const details = [
    `Current Age: ${plan.currentAge}`,
    `Retirement Age: ${plan.retirementAge}`,
    `Target Net Income: £${(plan.targetNetIncome / 1000).toFixed(1)}k/year`,
    `Current Pension Pot: £${(plan.currentPension / 1000).toFixed(1)}k`,
    `Current ISA: £${(plan.currentIsa / 1000).toFixed(1)}k`,
    `Annual Pension Contribution: £${(plan.annualPensionContribution / 1000).toFixed(1)}k`,
    `Annual ISA Contribution: £${(plan.annualIsaContribution / 1000).toFixed(1)}k`,
    `State Pension Age: ${plan.statePensionAge}`,
    `Expected State Pension: £${(plan.expectedStatePension / 1000).toFixed(1)}k/year`
  ];

  details.forEach(detail => {
    doc.text(`• ${detail}`, margin + 5, yPosition);
    yPosition += 6;
  });

  yPosition += 5;
  checkPageBreak();

  // Projection Results
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Projection Results', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');

  if (projection.years && projection.years.length > 0) {
    const retirementYear = projection.years.find(y => y.age === plan.retirementAge);
    const finalYear = projection.years[projection.years.length - 1];

    const results = [
      `Pot at Retirement: £${((retirementYear?.totalPot || 0) / 1000).toFixed(0)}k`,
      `First Year Withdrawal: £${((retirementYear?.withdrawal || 0) / 1000).toFixed(1)}k`,
      `First Year Net Income: £${((retirementYear?.netIncome || 0) / 1000).toFixed(1)}k`,
      `Final Pot (Age ${finalYear.age}): £${((finalYear?.totalPot || 0) / 1000).toFixed(0)}k`
    ];

    if (options.monteCarloResults) {
      results.push(`Success Rate: ${options.monteCarloResults.successRate.toFixed(0)}%`);
    }

    results.forEach(result => {
      doc.text(`• ${result}`, margin + 5, yPosition);
      yPosition += 6;
    });
  }

  yPosition += 5;
  checkPageBreak();

  // Insights
  if (options.insights && options.insights.length > 0) {
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Key Insights', margin, yPosition);
    yPosition += 10;

    options.insights.slice(0, 5).forEach(insight => {
      checkPageBreak(25);
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`${insight.icon} ${insight.title}`, margin, yPosition);
      yPosition += 7;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      const descLines = doc.splitTextToSize(insight.description, contentWidth - 10);
      doc.text(descLines, margin + 5, yPosition);
      yPosition += descLines.length * 4 + 5;
    });
  }

  // Year-by-Year Table (sample first 10 years)
  checkPageBreak(60);
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Year-by-Year Analysis (Sample)', margin, yPosition);
  yPosition += 10;

  if (projection.years && projection.years.length > 0) {
    const sampleYears = projection.years.slice(0, 10);
    
    // Table headers
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    const colWidth = contentWidth / 5;
    
    ['Age', 'Pot (£k)', 'Income (£k)', 'Tax (£k)', 'Net (£k)'].forEach((header, i) => {
      doc.text(header, margin + i * colWidth, yPosition);
    });
    
    yPosition += 5;
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;

    // Table rows
    doc.setFont(undefined, 'normal');
    sampleYears.forEach(year => {
      checkPageBreak(8);
      
      const row = [
        year.age.toString(),
        (year.totalPot / 1000).toFixed(0),
        (year.grossIncome / 1000).toFixed(1),
        (year.totalTax / 1000).toFixed(1),
        (year.netIncome / 1000).toFixed(1)
      ];

      row.forEach((cell, i) => {
        doc.text(cell, margin + i * colWidth, yPosition);
      });

      yPosition += 5;
    });
  }

  // Footer on last page
  yPosition = pageHeight - 20;
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('RetireLens 2 - Generated client-side. Your data remains private.', pageWidth / 2, yPosition, { align: 'center' });

  // Generate blob
  return doc.output('blob');
}

/**
 * Downloads the PDF
 */
export async function downloadPDF(plan, projection, options = {}) {
  try {
    const blob = await generatePDF(plan, projection, options);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retirelens-${plan.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  }
}

/**
 * Generates executive summary text
 */
function generateExecutiveSummary(plan, projection, options) {
  const retirementYear = projection.years?.find(y => y.age === plan.retirementAge);
  const potAtRetirement = (retirementYear?.totalPot || 0) / 1000;
  const successRate = options.monteCarloResults?.successRate || null;

  let summary = `This retirement plan projects from age ${plan.currentAge} to ${plan.retirementAge}, `;
  summary += `targeting a net income of £${(plan.targetNetIncome / 1000).toFixed(1)}k per year. `;
  summary += `Based on current contributions and assumptions, your projected pot at retirement is £${potAtRetirement.toFixed(0)}k. `;
  
  if (successRate !== null) {
    if (successRate >= 80) {
      summary += `With a ${successRate.toFixed(0)}% success rate, your plan shows strong resilience to market volatility.`;
    } else if (successRate >= 60) {
      summary += `Your plan has a ${successRate.toFixed(0)}% success rate, indicating moderate resilience with room for improvement.`;
    } else {
      summary += `The ${successRate.toFixed(0)}% success rate suggests significant adjustments may be needed to improve plan sustainability.`;
    }
  }

  return summary;
}

/**
 * Generates key metrics array
 */
function generateKeyMetrics(plan, projection, options) {
  const metrics = [];
  const retirementYear = projection.years?.find(y => y.age === plan.retirementAge);
  const finalYear = projection.years?.[projection.years.length - 1];

  metrics.push({
    label: 'Retirement Age',
    value: plan.retirementAge.toString()
  });

  metrics.push({
    label: 'Target Income',
    value: `£${(plan.targetNetIncome / 1000).toFixed(0)}k/yr`
  });

  metrics.push({
    label: 'Pot at Retirement',
    value: `£${((retirementYear?.totalPot || 0) / 1000).toFixed(0)}k`
  });

  metrics.push({
    label: 'Final Pot',
    value: `£${((finalYear?.totalPot || 0) / 1000).toFixed(0)}k`
  });

  if (options.monteCarloResults) {
    metrics.push({
      label: 'Success Rate',
      value: `${options.monteCarloResults.successRate.toFixed(0)}%`
    });
  }

  if (options.readinessScore) {
    metrics.push({
      label: 'Readiness Score',
      value: `${options.readinessScore.overallScore.toFixed(0)}%`
    });
  }

  return metrics;
}

/**
 * Helper to load jsPDF dynamically if not available
 */
export async function ensureJsPDFLoaded() {
  if (typeof window !== 'undefined' && !window.jspdf) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}
