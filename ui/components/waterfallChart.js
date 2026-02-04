/**
 * RetireLens 2 - Waterfall Chart for Income Sources
 * 
 * Waterfall chart showing:
 * - Pension withdrawal
 * - ISA withdrawal
 * - State pension
 * - Total gross income
 * - Tax paid
 * - Net income
 * 
 * Interactive drill-down by year
 */

/**
 * Format currency for display
 */
function formatCurrency(value) {
  if (value >= 1000000) {
    return '£' + (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return '£' + Math.round(value / 1000) + 'k';
  }
  return '£' + Math.round(value);
}

/**
 * Render waterfall chart for a specific year
 * 
 * @param {object} yearData - Data for specific year from projection
 * @param {string} canvasSelector - Canvas selector
 * @param {object} options - Chart options
 * @returns {object} Chart instance
 */
export function renderWaterfallChart(yearData, canvasSelector, options = {}) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas || typeof Chart === 'undefined') {
    console.warn('Chart.js not available or canvas not found');
    return null;
  }
  
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  const {
    age,
    pensionWithdrawal = 0,
    isaWithdrawal = 0,
    statePension = 0,
    totalTax = 0,
    netIncome = 0
  } = yearData;
  
  // Calculate gross income
  const grossIncome = pensionWithdrawal + isaWithdrawal + statePension;
  
  // Waterfall data: show cumulative build-up then deduction
  const labels = [
    'Pension',
    'ISA',
    'State Pension',
    'Gross Income',
    'Tax',
    'Net Income'
  ];
  
  // For waterfall effect, we need to calculate floating bars
  // Each bar starts where the previous ended
  let running = 0;
  const data = [];
  const backgrounds = [];
  const borders = [];
  
  // Pension withdrawal (positive)
  data.push([running, running + pensionWithdrawal]);
  backgrounds.push('rgba(139, 92, 246, 0.7)');
  borders.push('#8b5cf6');
  running += pensionWithdrawal;
  
  // ISA withdrawal (positive)
  data.push([running, running + isaWithdrawal]);
  backgrounds.push('rgba(34, 197, 94, 0.7)');
  borders.push('#22c55e');
  running += isaWithdrawal;
  
  // State pension (positive)
  data.push([running, running + statePension]);
  backgrounds.push('rgba(59, 130, 246, 0.7)');
  borders.push('#3b82f6');
  running += statePension;
  
  // Gross income (total marker)
  data.push([0, grossIncome]);
  backgrounds.push('rgba(156, 163, 175, 0.7)');
  borders.push('#9ca3af');
  
  // Tax (negative)
  data.push([running - totalTax, running]);
  backgrounds.push('rgba(239, 68, 68, 0.7)');
  borders.push('#ef4444');
  running -= totalTax;
  
  // Net income (final total)
  data.push([0, netIncome]);
  backgrounds.push('rgba(16, 185, 129, 0.7)');
  borders.push('#10b981');
  
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Amount',
        data,
        backgroundColor: backgrounds,
        borderColor: borders,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        title: {
          display: true,
          text: options.title || `Income Breakdown - Age ${age}`,
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.x;
              const dataIndex = context.dataIndex;
              
              // For floating bars, show the difference
              if (dataIndex < 3) {
                const [start, end] = context.raw;
                return formatCurrency(end - start);
              } else if (dataIndex === 4) {
                // Tax (show as negative)
                const [start, end] = context.raw;
                return '-' + formatCurrency(end - start);
              } else {
                // Total markers
                return formatCurrency(value);
              }
            }
          }
        },
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Amount (£)'
          },
          ticks: {
            callback: (value) => formatCurrency(value)
          },
          beginAtZero: true
        },
        y: {
          grid: {
            display: false
          }
        }
      }
    }
  });
  
  return chart;
}

/**
 * Create interactive waterfall with year selector
 * 
 * @param {object} projectionData - Full projection data
 * @param {string} containerId - Container element ID
 * @returns {HTMLElement} Container element
 */
export function createInteractiveWaterfall(projectionData, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Container not found:', containerId);
    return null;
  }
  
  const { yearByYear = [], retirementAge } = projectionData;
  
  // Filter to retirement years only
  const retirementYears = yearByYear.filter(y => y.age >= retirementAge);
  
  if (retirementYears.length === 0) {
    container.innerHTML = '<p style="color: #6b7280;">No retirement data available</p>';
    return container;
  }
  
  // Create HTML structure
  container.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 16px; color: #1f2937;">Income Sources Breakdown</h3>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label for="${containerId}-year-select" style="font-size: 14px; color: #6b7280;">Year:</label>
          <select 
            id="${containerId}-year-select" 
            style="padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;"
          >
            ${retirementYears.map((y, i) => `
              <option value="${i}" ${i === 0 ? 'selected' : ''}>
                Age ${y.age} (Year ${i + 1})
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      
      <div style="height: 400px; position: relative;">
        <canvas id="${containerId}-canvas"></canvas>
      </div>
      
      <div id="${containerId}-summary" style="margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 4px;">
        <!-- Summary will be populated by JavaScript -->
      </div>
    </div>
  `;
  
  const canvasId = `#${containerId}-canvas`;
  const selectId = `${containerId}-year-select`;
  const summaryId = `${containerId}-summary`;
  
  // Render initial chart
  renderWaterfallChart(retirementYears[0], canvasId);
  updateSummary(retirementYears[0], summaryId);
  
  // Add event listener for year selection
  const select = document.getElementById(selectId);
  select.addEventListener('change', (e) => {
    const yearIndex = parseInt(e.target.value);
    const yearData = retirementYears[yearIndex];
    renderWaterfallChart(yearData, canvasId);
    updateSummary(yearData, summaryId);
  });
  
  return container;
}

/**
 * Update summary information panel
 * 
 * @param {object} yearData - Year data
 * @param {string} summaryId - Summary element ID
 */
function updateSummary(yearData, summaryId) {
  const summary = document.getElementById(summaryId);
  if (!summary) return;
  
  const {
    pensionWithdrawal = 0,
    isaWithdrawal = 0,
    statePension = 0,
    totalTax = 0,
    netIncome = 0
  } = yearData;
  
  const grossIncome = pensionWithdrawal + isaWithdrawal + statePension;
  const effectiveTaxRate = grossIncome > 0 ? (totalTax / grossIncome * 100) : 0;
  
  summary.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
      <div>
        <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Gross Income</div>
        <div style="font-size: 18px; font-weight: 600; color: #1f2937;">${formatCurrency(grossIncome)}</div>
      </div>
      <div>
        <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Net Income</div>
        <div style="font-size: 18px; font-weight: 600; color: #10b981;">${formatCurrency(netIncome)}</div>
      </div>
      <div>
        <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Tax Paid</div>
        <div style="font-size: 18px; font-weight: 600; color: #ef4444;">${formatCurrency(totalTax)}</div>
      </div>
      <div>
        <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Effective Tax Rate</div>
        <div style="font-size: 18px; font-weight: 600; color: #6b7280;">${effectiveTaxRate.toFixed(1)}%</div>
      </div>
    </div>
    
    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">Income Sources</div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
          <span style="color: #8b5cf6;">● Pension</span>
          <span style="color: #1f2937; font-weight: 500;">${formatCurrency(pensionWithdrawal)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
          <span style="color: #22c55e;">● ISA</span>
          <span style="color: #1f2937; font-weight: 500;">${formatCurrency(isaWithdrawal)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
          <span style="color: #3b82f6;">● State Pension</span>
          <span style="color: #1f2937; font-weight: 500;">${formatCurrency(statePension)}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render multi-year comparison waterfall
 * 
 * @param {object} projectionData - Full projection data
 * @param {array} years - Array of ages to compare
 * @param {string} canvasSelector - Canvas selector
 * @param {object} options - Chart options
 * @returns {object} Chart instance
 */
export function renderMultiYearWaterfall(projectionData, years, canvasSelector, options = {}) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas || typeof Chart === 'undefined') {
    console.warn('Chart.js not available or canvas not found');
    return null;
  }
  
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  const { yearByYear = [] } = projectionData;
  
  // Get data for specified years
  const yearDataArray = years.map(age => 
    yearByYear.find(y => y.age === age)
  ).filter(Boolean);
  
  if (yearDataArray.length === 0) {
    console.warn('No data available for specified years');
    return null;
  }
  
  const labels = years.map(age => `Age ${age}`);
  
  const datasets = [
    {
      label: 'Pension',
      data: yearDataArray.map(y => y.pensionWithdrawal || 0),
      backgroundColor: 'rgba(139, 92, 246, 0.7)',
      borderColor: '#8b5cf6',
      borderWidth: 1
    },
    {
      label: 'ISA',
      data: yearDataArray.map(y => y.isaWithdrawal || 0),
      backgroundColor: 'rgba(34, 197, 94, 0.7)',
      borderColor: '#22c55e',
      borderWidth: 1
    },
    {
      label: 'State Pension',
      data: yearDataArray.map(y => y.statePension || 0),
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
      borderColor: '#3b82f6',
      borderWidth: 1
    },
    {
      label: 'Tax',
      data: yearDataArray.map(y => -(y.totalTax || 0)),
      backgroundColor: 'rgba(239, 68, 68, 0.7)',
      borderColor: '#ef4444',
      borderWidth: 1
    }
  ];
  
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: options.title || 'Income Comparison Across Years',
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = Math.abs(context.parsed.y);
              return context.dataset.label + ': ' + formatCurrency(value);
            }
          }
        },
        legend: {
          display: true,
          position: 'bottom'
        }
      },
      scales: {
        x: {
          stacked: true
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: 'Amount'
          },
          ticks: {
            callback: (value) => formatCurrency(Math.abs(value))
          }
        }
      }
    }
  });
  
  return chart;
}
