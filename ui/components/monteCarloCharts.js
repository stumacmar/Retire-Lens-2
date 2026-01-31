/**
 * RetireLens 2 - Monte Carlo Charts Component
 * 
 * Visualization components for Monte Carlo simulation results:
 * - Fan chart (portfolio value with confidence bands)
 * - Depletion age histogram
 * - Income sources over time
 * - Tax paid over time
 * - Withdrawals by source (stacked)
 * 
 * Uses Chart.js for rendering. Mobile-responsive design.
 */

/**
 * Format currency for chart labels
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
 * Render fan chart showing portfolio value with confidence bands
 * 
 * @param {object} yearlyBands - Yearly percentile bands from Monte Carlo
 * @param {object} deterministicData - Deterministic projection data
 * @param {string} canvasSelector - CSS selector for canvas element
 * @param {object} options - Chart options
 */
export function renderFanChart(yearlyBands, deterministicData, canvasSelector, options = {}) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas || typeof Chart === 'undefined') {
    console.warn('Chart.js not available or canvas not found');
    return;
  }
  
  // Destroy existing chart if present
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  const ages = yearlyBands.map(b => b.age);
  const p10 = yearlyBands.map(b => b.p10);
  const p25 = yearlyBands.map(b => b.p25);
  const p50 = yearlyBands.map(b => b.p50);
  const p75 = yearlyBands.map(b => b.p75);
  const p90 = yearlyBands.map(b => b.p90);
  
  // Get deterministic line data
  const deterministicValues = [];
  if (deterministicData) {
    // Combine accumulation and decumulation years
    const accYears = deterministicData.accumulation?.years || [];
    const decYears = deterministicData.decumulation?.years || [];
    
    for (const year of accYears) {
      deterministicValues.push({
        age: year.age + 1,
        value: year.endBalances.total
      });
    }
    for (const year of decYears) {
      if (year.endBalances) {
        deterministicValues.push({
          age: year.age + 1,
          value: year.endBalances.total
        });
      }
    }
  }
  
  // Find retirement age for annotation
  const retirementAge = options.retirementAge || deterministicData?.plan?.retirementAge;
  
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: ages,
      datasets: [
        // p10-p90 band (outer)
        {
          label: '10th-90th Percentile',
          data: p90,
          borderColor: 'rgba(59, 130, 246, 0.1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: '+4',
          tension: 0.3,
          pointRadius: 0,
          order: 5
        },
        // p25-p75 band (inner)
        {
          label: '25th-75th Percentile',
          data: p75,
          borderColor: 'rgba(59, 130, 246, 0.2)',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          fill: '+2',
          tension: 0.3,
          pointRadius: 0,
          order: 4
        },
        // p50 (median)
        {
          label: 'Median (p50)',
          data: p50,
          borderColor: 'rgba(59, 130, 246, 0.8)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          order: 2
        },
        // p25 (lower inner band edge)
        {
          label: '',
          data: p25,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          fill: false,
          pointRadius: 0,
          order: 6
        },
        // p10 (lower outer band edge)
        {
          label: '',
          data: p10,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          fill: false,
          pointRadius: 0,
          order: 7
        },
        // Deterministic line
        ...(deterministicValues.length > 0 ? [{
          label: 'Deterministic (Expected)',
          data: ages.map(age => {
            const match = deterministicValues.find(d => d.age === age);
            return match ? match.value : null;
          }),
          borderColor: '#ef4444',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          order: 1
        }] : [])
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            filter: (item) => item.text && item.text.length > 0
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.label) {
                return `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`;
              }
              return null;
            }
          }
        },
        title: {
          display: true,
          text: 'Portfolio Value Over Time (Monte Carlo Confidence Bands)'
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Age'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Portfolio Value'
          },
          ticks: {
            callback: (value) => formatCurrency(value)
          },
          beginAtZero: true
        }
      }
    }
  });
}

/**
 * Render depletion age histogram
 * 
 * @param {object} depletionStats - Depletion statistics from Monte Carlo
 * @param {string} canvasSelector - CSS selector for canvas element
 */
export function renderDepletionHistogram(depletionStats, canvasSelector) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas || typeof Chart === 'undefined') {
    console.warn('Chart.js not available or canvas not found');
    return;
  }
  
  // Destroy existing chart if present
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  if (!depletionStats || !depletionStats.histogram || depletionStats.histogram.length === 0) {
    // No depletion - show success message
    canvas.parentElement.innerHTML = `
      <div class="no-depletion-message">
        <span class="success-icon">✅</span>
        <p>In all simulations, funds lasted to the target age.</p>
      </div>
    `;
    return;
  }
  
  const histogram = depletionStats.histogram;
  const labels = histogram.map(h => h.label);
  const counts = histogram.map(h => h.count);
  const percentages = histogram.map(h => h.percentage);
  
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Number of Scenarios',
        data: counts,
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = percentages[ctx.dataIndex];
              return `${ctx.parsed.y} scenarios (${pct.toFixed(1)}%)`;
            }
          }
        },
        title: {
          display: true,
          text: 'When Might Money Run Out?'
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Age Range'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Number of Scenarios'
          },
          beginAtZero: true
        }
      }
    }
  });
}

/**
 * Render stacked chart showing withdrawals by source
 * 
 * @param {object} projection - Projection result with decumulation years
 * @param {string} canvasSelector - CSS selector for canvas element
 */
export function renderWithdrawalsBySource(projection, canvasSelector) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas || typeof Chart === 'undefined') {
    console.warn('Chart.js not available or canvas not found');
    return;
  }
  
  // Destroy existing chart if present
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  const decumulationYears = projection.decumulation.years.filter(y => !y.fundsDepleted);
  
  const ages = decumulationYears.map(y => y.age);
  const statePension = decumulationYears.map(y => y.statePension || 0);
  const pensionWithdrawals = decumulationYears.map(y => y.withdrawals?.pension || 0);
  const isaWithdrawals = decumulationYears.map(y => y.withdrawals?.isa || 0);
  
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ages,
      datasets: [
        {
          label: 'State Pension',
          data: statePension,
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          stack: 'income'
        },
        {
          label: 'Pension Drawdown',
          data: pensionWithdrawals,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          stack: 'income'
        },
        {
          label: 'ISA Withdrawal',
          data: isaWithdrawals,
          backgroundColor: 'rgba(168, 85, 247, 0.8)',
          stack: 'income'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
          }
        },
        title: {
          display: true,
          text: 'Income Sources by Year'
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Age'
          },
          stacked: true
        },
        y: {
          title: {
            display: true,
            text: 'Annual Income'
          },
          ticks: {
            callback: (value) => formatCurrency(value)
          },
          stacked: true,
          beginAtZero: true
        }
      }
    }
  });
}

/**
 * Render tax paid over time chart
 * 
 * @param {object} projection - Projection result with decumulation years
 * @param {string} canvasSelector - CSS selector for canvas element
 */
export function renderTaxOverTime(projection, canvasSelector) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas || typeof Chart === 'undefined') {
    console.warn('Chart.js not available or canvas not found');
    return;
  }
  
  // Destroy existing chart if present
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  const decumulationYears = projection.decumulation.years.filter(y => !y.fundsDepleted);
  
  const ages = decumulationYears.map(y => y.age);
  const taxPaid = decumulationYears.map(y => y.taxPaid || 0);
  
  // Calculate cumulative tax
  let cumulative = 0;
  const cumulativeTax = taxPaid.map(t => {
    cumulative += t;
    return cumulative;
  });
  
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: ages,
      datasets: [
        {
          label: 'Annual Tax Paid',
          data: taxPaid,
          borderColor: 'rgba(239, 68, 68, 0.8)',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          fill: true,
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          label: 'Cumulative Tax',
          data: cumulativeTax,
          borderColor: 'rgba(107, 114, 128, 0.8)',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          fill: false,
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
          }
        },
        title: {
          display: true,
          text: 'Tax Paid Over Time'
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Age'
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Annual Tax'
          },
          ticks: {
            callback: (value) => formatCurrency(value)
          },
          beginAtZero: true
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Cumulative Tax'
          },
          ticks: {
            callback: (value) => formatCurrency(value)
          },
          grid: {
            drawOnChartArea: false
          },
          beginAtZero: true
        }
      }
    }
  });
}

/**
 * Render all charts for a complete results view
 * 
 * @param {object} projection - Deterministic projection result
 * @param {object} mcResult - Monte Carlo result with yearly bands
 * @param {object} selectors - Object with canvas selectors
 */
export function renderAllCharts(projection, mcResult, selectors) {
  // Fan chart
  if (selectors.fanChart && mcResult.yearlyBands) {
    renderFanChart(mcResult.yearlyBands, projection, selectors.fanChart, {
      retirementAge: projection.plan.retirementAge
    });
  }
  
  // Depletion histogram
  if (selectors.depletionHistogram && mcResult.statistics.depletionAge) {
    renderDepletionHistogram(mcResult.statistics.depletionAge, selectors.depletionHistogram);
  }
  
  // Withdrawals by source
  if (selectors.withdrawalsBySource && projection.decumulation) {
    renderWithdrawalsBySource(projection, selectors.withdrawalsBySource);
  }
  
  // Tax over time
  if (selectors.taxOverTime && projection.decumulation) {
    renderTaxOverTime(projection, selectors.taxOverTime);
  }
}
