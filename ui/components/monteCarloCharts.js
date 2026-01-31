/**
 * RetireLens 2 - Monte Carlo Charts Component
 * 
 * Visualization components for Monte Carlo simulation results:
 * - Fan charts showing confidence bands over time
 * - Depletion age histogram
 * 
 * Requires Chart.js to be loaded (from CDN or npm).
 */

import { generateFanChartData } from '../../engine/monteCarlo.js';

/**
 * Render fan chart visualization
 * 
 * Shows portfolio balance confidence bands over time, with:
 * - 10th-90th percentile band (light shade)
 * - 25th-75th percentile band (medium shade)
 * - Median line (solid)
 * - Optional deterministic baseline (dashed)
 * 
 * @param {object} mcResult - Monte Carlo results with yearlyBands
 * @param {object} deterministicData - Optional deterministic projection for comparison
 * @param {string} canvasSelector - CSS selector for canvas element
 * @returns {Chart|null} Chart.js instance or null if Chart.js unavailable
 */
export function renderFanChart(mcResult, deterministicData = null, canvasSelector = '#fan-chart') {
  // Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded. Fan chart cannot be rendered.');
    return null;
  }
  
  const canvas = document.querySelector(canvasSelector);
  if (!canvas) {
    console.warn(`Canvas element not found: ${canvasSelector}`);
    return null;
  }
  
  const ctx = canvas.getContext('2d');
  const fanChartData = generateFanChartData(mcResult);
  const { labels, datasets } = fanChartData;
  
  // Prepare Chart.js datasets
  const chartDatasets = [];
  
  // Outer band (10th-90th percentile) - filled area
  chartDatasets.push({
    label: datasets.p10_p90.label,
    data: datasets.p10_p90.upper,
    fill: '+1', // Fill to next dataset
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'transparent',
    pointRadius: 0,
    tension: 0.4
  });
  chartDatasets.push({
    label: '10th percentile',
    data: datasets.p10_p90.lower,
    fill: false,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'transparent',
    pointRadius: 0,
    tension: 0.4
  });
  
  // Inner band (25th-75th percentile) - filled area
  chartDatasets.push({
    label: datasets.p25_p75.label,
    data: datasets.p25_p75.upper,
    fill: '+1',
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderColor: 'transparent',
    pointRadius: 0,
    tension: 0.4
  });
  chartDatasets.push({
    label: '25th percentile',
    data: datasets.p25_p75.lower,
    fill: false,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderColor: 'transparent',
    pointRadius: 0,
    tension: 0.4
  });
  
  // Median line
  chartDatasets.push({
    label: datasets.median.label,
    data: datasets.median.data,
    fill: false,
    borderColor: 'rgba(59, 130, 246, 1)',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.4
  });
  
  // Deterministic baseline (if provided)
  if (deterministicData && deterministicData.decumulation) {
    const deterministicLine = deterministicData.decumulation.years.map(y => 
      y.endBalances ? y.endBalances.total : 0
    );
    chartDatasets.push({
      label: 'Deterministic baseline',
      data: deterministicLine,
      fill: false,
      borderColor: 'rgba(107, 114, 128, 0.8)',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      tension: 0.4
    });
  }
  
  // Create chart
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: chartDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Portfolio Balance Over Time (Monte Carlo Confidence Bands)'
        },
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            filter: (item) => {
              // Only show meaningful legend items
              return ['Median outcome', 'Deterministic baseline', '25th-75th percentile', '10th-90th percentile'].includes(item.text);
            }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              const value = context.parsed.y;
              return `${context.dataset.label}: £${Math.round(value).toLocaleString()}`;
            }
          }
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
            text: 'Portfolio Balance (£)'
          },
          ticks: {
            callback: function(value) {
              if (value >= 1000000) {
                return '£' + (value / 1000000).toFixed(1) + 'M';
              }
              if (value >= 1000) {
                return '£' + (value / 1000).toFixed(0) + 'K';
              }
              return '£' + value;
            }
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  });
}

/**
 * Render depletion age histogram
 * 
 * Shows distribution of ages at which funds run out across simulations.
 * Only relevant when some simulations result in fund depletion.
 * 
 * @param {object} depletionAges - Depletion age data from Monte Carlo results
 * @param {string} canvasSelector - CSS selector for canvas element
 * @returns {Chart|null} Chart.js instance or null
 */
export function renderDepletionHistogram(depletionAges, canvasSelector = '#depletion-histogram') {
  // Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded. Histogram cannot be rendered.');
    return null;
  }
  
  const canvas = document.querySelector(canvasSelector);
  if (!canvas) {
    console.warn(`Canvas element not found: ${canvasSelector}`);
    return null;
  }
  
  const ctx = canvas.getContext('2d');
  const { histogram, count } = depletionAges;
  
  if (!histogram || histogram.length === 0) {
    // No depleted scenarios - show success message
    const container = canvas.parentElement;
    if (container) {
      container.innerHTML = `
        <div class="histogram-success">
          <span class="success-icon">✅</span>
          <p>In all simulations, your funds lasted the full projection period.</p>
        </div>
      `;
    }
    return null;
  }
  
  const labels = histogram.map(h => `Age ${h.age}`);
  const data = histogram.map(h => h.count);
  const percentages = histogram.map(h => h.percentage);
  
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Number of simulations',
        data,
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `When Might Funds Run Out? (${count} of ${depletionAges.count} simulations)`
        },
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const pct = percentages[index].toFixed(1);
              return `${context.parsed.y} simulations (${pct}% of failures)`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Depletion Age'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Number of Simulations'
          },
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

/**
 * Create HTML containers for Monte Carlo charts
 * 
 * @returns {string} HTML for chart containers
 */
export function createMonteCarloChartsContainer() {
  return `
    <div class="monte-carlo-charts">
      <section class="chart-section">
        <h3>Portfolio Balance Confidence Bands</h3>
        <p class="chart-description">
          This "fan chart" shows the range of possible outcomes based on 
          simulated market conditions. The darker band shows the middle 50% 
          of outcomes; the lighter band shows the middle 80%.
        </p>
        <div class="chart-wrapper" style="height: 300px;">
          <canvas id="fan-chart"></canvas>
        </div>
      </section>
      
      <section class="chart-section">
        <h3>Depletion Risk Distribution</h3>
        <p class="chart-description">
          When funds might run out in scenarios where depletion occurs.
        </p>
        <div class="chart-wrapper" style="height: 250px;">
          <canvas id="depletion-histogram"></canvas>
        </div>
      </section>
      
      <div id="confidence-explainer"></div>
    </div>
  `;
}

/**
 * Get CSS styles for Monte Carlo chart components
 * 
 * @returns {string} CSS styles
 */
export function getMonteCarloChartsStyles() {
  return `
    .monte-carlo-charts {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xl, 2rem);
    }
    
    .chart-section {
      background: var(--color-surface, #ffffff);
      border-radius: var(--radius-lg, 1rem);
      padding: var(--spacing-lg, 1.5rem);
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
    }
    
    .chart-section h3 {
      margin-bottom: var(--spacing-sm, 0.5rem);
      font-size: var(--font-size-lg, 1.125rem);
    }
    
    .chart-description {
      color: var(--color-text-light, #6b7280);
      font-size: var(--font-size-sm, 0.875rem);
      margin-bottom: var(--spacing-md, 1rem);
    }
    
    .chart-wrapper {
      position: relative;
    }
    
    .histogram-success {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      background: #d1fae5;
      border-radius: var(--radius-md, 0.5rem);
      text-align: center;
      padding: var(--spacing-lg, 1.5rem);
    }
    
    .histogram-success .success-icon {
      font-size: 3rem;
      margin-bottom: var(--spacing-md, 1rem);
    }
    
    .histogram-success p {
      color: #065f46;
      font-weight: 500;
    }
  `;
}
