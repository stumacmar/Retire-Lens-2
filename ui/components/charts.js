/**
 * RetireLens 2 - Interactive Projection Charts
 * 
 * Multi-line charts with interactive features:
 * - Total pot value, pension balance, ISA balance, cumulative income
 * - Hover tooltips, zoom/pan, toggle series
 * - Vertical markers for today/retirement
 * - Stacked area chart for income sources
 * - Tax paid per year
 * - Chart export as PNG
 */

/**
 * Format currency for chart labels
 */
function formatCurrency(value) {
  // Guard against null, undefined, NaN, and non-numbers
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
    return '—';
  }
  if (value >= 1000000) {
    return '£' + (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return '£' + Math.round(value / 1000) + 'k';
  }
  return '£' + Math.round(value);
}

/**
 * Create vertical line annotation plugin for Chart.js
 */
const verticalLinePlugin = {
  id: 'verticalLine',
  afterDatasetsDraw(chart, args, options) {
    const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
    
    if (!options.lines) return;
    
    options.lines.forEach(line => {
      const xPos = x.getPixelForValue(line.value);
      
      ctx.save();
      ctx.strokeStyle = line.color || '#666';
      ctx.lineWidth = line.width || 2;
      ctx.setLineDash(line.dash || [5, 5]);
      
      ctx.beginPath();
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      ctx.stroke();
      
      // Draw label
      if (line.label) {
        ctx.fillStyle = line.color || '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(line.label, xPos, top - 5);
      }
      
      ctx.restore();
    });
  }
};

/**
 * Render multi-line projection chart
 * Shows: total pot, pension, ISA, cumulative income
 * 
 * @param {object} projectionData - Projection result from engine
 * @param {string} canvasSelector - CSS selector for canvas element
 * @param {object} options - Chart options
 * @returns {object} Chart instance
 */
export function renderProjectionChart(projectionData, canvasSelector, options = {}) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas || typeof Chart === 'undefined') {
    console.warn('Chart.js not available or canvas not found');
    return null;
  }
  
  // Destroy existing chart
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  const {
    currentAge,
    retirementAge,
    yearByYear = []
  } = projectionData;
  
  if (yearByYear.length === 0) {
    console.warn('No projection data available');
    return null;
  }
  
  const ages = yearByYear.map(y => y.age);
  const totalPot = yearByYear.map(y => y.pensionBalance + y.isaBalance);
  const pensionBalance = yearByYear.map(y => y.pensionBalance);
  const isaBalance = yearByYear.map(y => y.isaBalance);
  
  // Calculate cumulative income
  let cumulativeIncome = 0;
  const cumulativeIncomeData = yearByYear.map(y => {
    cumulativeIncome += (y.netIncome || 0);
    return cumulativeIncome;
  });
  
  // Vertical markers
  const markers = [
    {
      value: currentAge,
      label: 'Today',
      color: '#3b82f6',
      width: 2,
      dash: [5, 5]
    },
    {
      value: retirementAge,
      label: 'Retirement',
      color: '#22c55e',
      width: 2,
      dash: [5, 5]
    }
  ];
  
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: ages,
      datasets: [
        {
          label: 'Total Pot Value',
          data: totalPot,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.4,
          fill: false
        },
        {
          label: 'Pension Balance',
          data: pensionBalance,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.4,
          fill: false
        },
        {
          label: 'ISA Balance',
          data: isaBalance,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.4,
          fill: false
        },
        {
          label: 'Cumulative Income',
          data: cumulativeIncomeData,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.4,
          fill: false,
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
        title: {
          display: true,
          text: options.title || 'Projection Over Time',
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
            }
          }
        },
        legend: {
          display: true,
          position: 'bottom',
          onClick: (e, legendItem, legend) => {
            const index = legendItem.datasetIndex;
            const chart = legend.chart;
            const meta = chart.getDatasetMeta(index);
            meta.hidden = !meta.hidden;
            chart.update();
          }
        },
        verticalLine: {
          lines: markers
        },
        zoom: options.enableZoom ? {
          pan: {
            enabled: true,
            mode: 'x'
          },
          zoom: {
            wheel: {
              enabled: true
            },
            pinch: {
              enabled: true
            },
            mode: 'x'
          }
        } : undefined
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Age'
          },
          grid: {
            display: false
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
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Cumulative Income'
          },
          ticks: {
            callback: (value) => formatCurrency(value)
          },
          grid: {
            drawOnChartArea: false
          }
        }
      }
    },
    plugins: [verticalLinePlugin]
  });
  
  return chart;
}

/**
 * Render stacked area chart for income sources by year
 * 
 * @param {object} projectionData - Projection result from engine
 * @param {string} canvasSelector - CSS selector for canvas element
 * @param {object} options - Chart options
 * @returns {object} Chart instance
 */
export function renderIncomeSourcesChart(projectionData, canvasSelector, options = {}) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas || typeof Chart === 'undefined') {
    console.warn('Chart.js not available or canvas not found');
    return null;
  }
  
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  const { yearByYear = [], retirementAge } = projectionData;
  
  // Filter to retirement years only
  const retirementYears = yearByYear.filter(y => y.age >= retirementAge);
  
  if (retirementYears.length === 0) {
    console.warn('No retirement data available');
    return null;
  }
  
  const ages = retirementYears.map(y => y.age);
  const pensionWithdrawals = retirementYears.map(y => y.pensionWithdrawal || 0);
  const isaWithdrawals = retirementYears.map(y => y.isaWithdrawal || 0);
  const statePension = retirementYears.map(y => y.statePension || 0);
  
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: ages,
      datasets: [
        {
          label: 'Pension Withdrawal',
          data: pensionWithdrawals,
          backgroundColor: 'rgba(139, 92, 246, 0.7)',
          borderColor: '#8b5cf6',
          borderWidth: 1,
          fill: true
        },
        {
          label: 'ISA Withdrawal',
          data: isaWithdrawals,
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderColor: '#22c55e',
          borderWidth: 1,
          fill: true
        },
        {
          label: 'State Pension',
          data: statePension,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          fill: true
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
        title: {
          display: true,
          text: options.title || 'Income Sources Over Time',
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
            },
            footer: (tooltipItems) => {
              const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0);
              return 'Total: ' + formatCurrency(total);
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
          stacked: true,
          ticks: {
            callback: (value) => formatCurrency(value)
          },
          beginAtZero: true
        }
      }
    }
  });
  
  return chart;
}

/**
 * Render tax paid per year chart
 * 
 * @param {object} projectionData - Projection result from engine
 * @param {string} canvasSelector - CSS selector for canvas element
 * @param {object} options - Chart options
 * @returns {object} Chart instance
 */
export function renderTaxChart(projectionData, canvasSelector, options = {}) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas || typeof Chart === 'undefined') {
    console.warn('Chart.js not available or canvas not found');
    return null;
  }
  
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  const { yearByYear = [], retirementAge } = projectionData;
  
  const retirementYears = yearByYear.filter(y => y.age >= retirementAge);
  
  if (retirementYears.length === 0) {
    console.warn('No retirement data available');
    return null;
  }
  
  const ages = retirementYears.map(y => y.age);
  const taxPaid = retirementYears.map(y => y.totalTax || 0);
  
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ages,
      datasets: [
        {
          label: 'Tax Paid',
          data: taxPaid,
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: '#ef4444',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: options.title || 'Tax Paid Per Year',
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return 'Tax: ' + formatCurrency(context.parsed.y);
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
            text: 'Age'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Tax Paid'
          },
          ticks: {
            callback: (value) => formatCurrency(value)
          },
          beginAtZero: true
        }
      }
    }
  });
  
  return chart;
}

/**
 * Export chart as PNG image
 * 
 * @param {object} chart - Chart.js instance
 * @param {string} filename - Filename for download
 */
export function exportChartAsPNG(chart, filename = 'chart.png') {
  if (!chart || !chart.canvas) {
    console.warn('Invalid chart instance');
    return;
  }
  
  const url = chart.canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
}

/**
 * Create a container with chart and export button
 * 
 * @param {string} containerId - Container element ID
 * @param {string} canvasId - Canvas element ID
 * @param {string} title - Chart title
 * @returns {object} Container and canvas elements
 */
export function createChartContainer(containerId, canvasId, title) {
  let container = document.getElementById(containerId);
  
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.cssText = 'position: relative; margin: 20px 0; background: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
  }
  
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <h3 style="margin: 0; font-size: 16px; color: #1f2937;">${title}</h3>
      <button class="export-chart-btn" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
        Export PNG
      </button>
    </div>
    <div style="height: 300px; position: relative;">
      <canvas id="${canvasId}"></canvas>
    </div>
  `;
  
  const canvas = container.querySelector(`#${canvasId}`);
  const exportBtn = container.querySelector('.export-chart-btn');
  
  return { container, canvas, exportBtn };
}
