/**
 * RetireLens 2 - Risk Visualization Dashboard
 * 
 * Monte Carlo uncertainty visualization:
 * - Probability cone chart with confidence bands
 * - Success probability gauge
 * - Histogram of outcomes
 * - Risk mitigation recommendations
 */

import { calculateRiskScore, generateRiskRecommendations } from '../../engine/riskScoring.js';

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
 * Render probability cone chart with confidence bands
 * 
 * @param {object} monteCarloResults - Monte Carlo results
 * @param {string} canvasSelector - Canvas selector
 * @param {object} options - Chart options
 * @returns {object} Chart instance
 */
export function renderProbabilityConeChart(monteCarloResults, canvasSelector, options = {}) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas || typeof Chart === 'undefined') {
    console.warn('Chart.js not available or canvas not found');
    return null;
  }
  
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  const { yearlyBands = [] } = monteCarloResults;
  
  if (yearlyBands.length === 0) {
    console.warn('No yearly bands data available');
    return null;
  }
  
  const ages = yearlyBands.map(b => b.age);
  const p10 = yearlyBands.map(b => b.p10);
  const p25 = yearlyBands.map(b => b.p25);
  const p50 = yearlyBands.map(b => b.p50);
  const p75 = yearlyBands.map(b => b.p75);
  const p90 = yearlyBands.map(b => b.p90);
  
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: ages,
      datasets: [
        {
          label: '10th-90th percentile',
          data: p10.map((val, i) => [val, p90[i]]),
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          fill: '+1',
          pointRadius: 0
        },
        {
          label: '25th-75th percentile',
          data: p25.map((val, i) => [val, p75[i]]),
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgba(59, 130, 246, 0.5)',
          borderWidth: 1,
          fill: '+1',
          pointRadius: 0
        },
        {
          label: 'Median (50th percentile)',
          data: p50,
          borderColor: '#3b82f6',
          backgroundColor: '#3b82f6',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.4
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
          text: options.title || 'Portfolio Value Uncertainty Cone',
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              if (context.datasetIndex === 2) {
                return 'Median: ' + formatCurrency(context.parsed.y);
              }
              return context.dataset.label;
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
  
  return chart;
}

/**
 * Render success probability gauge
 * 
 * @param {number} successRate - Success rate (0-1)
 * @param {string} containerId - Container element ID
 * @returns {HTMLElement} Gauge element
 */
export function renderSuccessProbabilityGauge(successRate, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Container not found:', containerId);
    return null;
  }
  
  const percentage = Math.round(successRate * 100);
  
  // Determine color based on success rate
  let color, status;
  if (percentage >= 80) {
    color = '#22c55e';
    status = 'Strong';
  } else if (percentage >= 60) {
    color = '#f59e0b';
    status = 'Moderate';
  } else {
    color = '#ef4444';
    status = 'Weak';
  }
  
  container.innerHTML = `
    <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">Success Probability</h3>
      <div style="position: relative; width: 200px; height: 200px; margin: 0 auto;">
        <svg viewBox="0 0 200 200" style="transform: rotate(-90deg);">
          <!-- Background circle -->
          <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" stroke-width="20"/>
          <!-- Progress circle -->
          <circle 
            cx="100" 
            cy="100" 
            r="80" 
            fill="none" 
            stroke="${color}" 
            stroke-width="20"
            stroke-dasharray="${2 * Math.PI * 80}"
            stroke-dashoffset="${2 * Math.PI * 80 * (1 - successRate)}"
            stroke-linecap="round"
            style="transition: stroke-dashoffset 1s ease-out;"
          />
        </svg>
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
          <div style="font-size: 36px; font-weight: bold; color: ${color};">${percentage}%</div>
          <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">${status}</div>
        </div>
      </div>
      <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 14px;">
        Probability of maintaining funds until age 90
      </p>
    </div>
  `;
  
  return container;
}

/**
 * Render histogram of final balances
 * 
 * @param {array} simulations - Array of simulation results
 * @param {string} canvasSelector - Canvas selector
 * @param {object} options - Chart options
 * @returns {object} Chart instance
 */
export function renderOutcomesHistogram(simulations, canvasSelector, options = {}) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas || typeof Chart === 'undefined') {
    console.warn('Chart.js not available or canvas not found');
    return null;
  }
  
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  if (!simulations || simulations.length === 0) {
    console.warn('No simulation data available');
    return null;
  }
  
  // Get final balances
  const finalBalances = simulations.map(s => s.finalBalance || 0);
  
  // Create histogram bins
  const min = Math.min(...finalBalances);
  const max = Math.max(...finalBalances);
  const binCount = 20;
  const binSize = (max - min) / binCount;
  
  const bins = Array(binCount).fill(0);
  const binLabels = [];
  
  for (let i = 0; i < binCount; i++) {
    binLabels.push(formatCurrency(min + i * binSize));
  }
  
  finalBalances.forEach(balance => {
    const binIndex = Math.min(Math.floor((balance - min) / binSize), binCount - 1);
    bins[binIndex]++;
  });
  
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: binLabels,
      datasets: [
        {
          label: 'Number of Scenarios',
          data: bins,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: '#3b82f6',
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
          text: options.title || 'Distribution of Final Portfolio Values',
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const total = bins.reduce((sum, val) => sum + val, 0);
              const percentage = ((context.parsed.y / total) * 100).toFixed(1);
              return `${context.parsed.y} scenarios (${percentage}%)`;
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
            text: 'Final Portfolio Value'
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          title: {
            display: true,
            text: 'Frequency'
          },
          beginAtZero: true
        }
      }
    }
  });
  
  return chart;
}

/**
 * Render risk mitigation recommendations
 * 
 * @param {object} riskScore - Risk score object
 * @param {object} projection - Deterministic projection
 * @param {string} containerId - Container element ID
 * @returns {HTMLElement} Recommendations element
 */
export function renderRiskRecommendations(riskScore, projection, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Container not found:', containerId);
    return null;
  }
  
  const recommendations = generateRiskRecommendations(riskScore, projection);
  const topThree = recommendations.slice(0, 3);
  
  if (topThree.length === 0) {
    container.innerHTML = `
      <div style="padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">Risk Mitigation</h3>
        <div style="padding: 16px; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px;">
          <p style="margin: 0; color: #166534; font-weight: 500;">No immediate concerns</p>
          <p style="margin: 8px 0 0 0; color: #15803d; font-size: 14px;">
            Your plan appears well-positioned to meet your retirement goals.
          </p>
        </div>
      </div>
    `;
    return container;
  }
  
  const recommendationHTML = topThree.map((rec, index) => {
    const priorityColors = ['#ef4444', '#f59e0b', '#3b82f6'];
    const color = priorityColors[index] || '#6b7280';
    
    return `
      <div style="margin-bottom: 16px; padding: 16px; background: #f9fafb; border-left: 4px solid ${color}; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: #1f2937;">${rec.category}</h4>
          <span style="padding: 2px 8px; background: ${color}; color: white; border-radius: 12px; font-size: 12px; font-weight: 500;">
            Priority ${rec.priority}
          </span>
        </div>
        <p style="margin: 8px 0; color: #4b5563; font-size: 14px;">
          <strong>Issue:</strong> ${rec.issue}
        </p>
        <p style="margin: 8px 0; color: #1f2937; font-size: 14px;">
          <strong>Recommendation:</strong> ${rec.recommendation}
        </p>
        <p style="margin: 8px 0 0 0; color: #059669; font-size: 13px; font-style: italic;">
          ${rec.impact}
        </p>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `
    <div style="padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">
        Risk Mitigation Recommendations
      </h3>
      ${recommendationHTML}
      ${recommendations.length > 3 ? `
        <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 13px; text-align: center;">
          +${recommendations.length - 3} more recommendations available
        </p>
      ` : ''}
    </div>
  `;
  
  return container;
}

/**
 * Create complete risk visualization dashboard
 * 
 * @param {object} monteCarloResults - Monte Carlo results
 * @param {object} projection - Deterministic projection
 * @param {string} containerId - Main container element ID
 * @returns {HTMLElement} Dashboard element
 */
export function createRiskDashboard(monteCarloResults, projection, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Container not found:', containerId);
    return null;
  }
  
  // Calculate risk score
  const riskScore = calculateRiskScore(monteCarloResults, projection);
  
  container.innerHTML = `
    <div style="padding: 20px; background: #f9fafb;">
      <h2 style="margin: 0 0 24px 0; font-size: 20px; color: #1f2937;">Risk Analysis Dashboard</h2>
      
      <!-- Risk Score Overview -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
        <div id="${containerId}-gauge"></div>
        <div style="padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">Overall Risk Score</h3>
          <div style="text-align: center;">
            <div style="font-size: 48px; font-weight: bold; color: ${riskScore.riskColor};">
              ${riskScore.totalScore}
            </div>
            <div style="font-size: 18px; color: ${riskScore.riskColor}; margin-top: 8px;">
              ${riskScore.riskLevel}
            </div>
          </div>
          <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <div style="margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                <span>Success Rate</span>
                <span>${riskScore.breakdown.successRate.score}/${riskScore.breakdown.successRate.maxScore}</span>
              </div>
              <div style="height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; background: #3b82f6; width: ${(riskScore.breakdown.successRate.score / riskScore.breakdown.successRate.maxScore) * 100}%;"></div>
              </div>
            </div>
            <div style="margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                <span>Depletion Age</span>
                <span>${riskScore.breakdown.depletionAge.score}/${riskScore.breakdown.depletionAge.maxScore}</span>
              </div>
              <div style="height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; background: #22c55e; width: ${(riskScore.breakdown.depletionAge.score / riskScore.breakdown.depletionAge.maxScore) * 100}%;"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                <span>Shortfall</span>
                <span>${riskScore.breakdown.shortfall.score}/${riskScore.breakdown.shortfall.maxScore}</span>
              </div>
              <div style="height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; background: #f59e0b; width: ${(riskScore.breakdown.shortfall.score / riskScore.breakdown.shortfall.maxScore) * 100}%;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Charts -->
      <div style="margin-bottom: 24px; background: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="height: 300px;">
          <canvas id="${containerId}-cone-chart"></canvas>
        </div>
      </div>
      
      <div style="margin-bottom: 24px; background: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="height: 300px;">
          <canvas id="${containerId}-histogram"></canvas>
        </div>
      </div>
      
      <!-- Recommendations -->
      <div id="${containerId}-recommendations"></div>
    </div>
  `;
  
  // Render components
  renderSuccessProbabilityGauge(monteCarloResults.successRate || 0, `${containerId}-gauge`);
  renderProbabilityConeChart(monteCarloResults, `#${containerId}-cone-chart`);
  renderOutcomesHistogram(monteCarloResults.simulations || [], `#${containerId}-histogram`);
  renderRiskRecommendations(riskScore, projection, `${containerId}-recommendations`);
  
  return container;
}
