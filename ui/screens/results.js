/**
 * RetireLens 2 - Results Display
 * 
 * Renders projection results with clear answers.
 */

import { debugLog } from '../state.js';
import { runProjection, comparePlans, generateDebugOutput, canIRetire } from '../../engine/projections.js';
import { generateConfidenceBands } from '../../engine/monteCarlo.js';

/**
 * Calculate withdrawal rate for sustainability indicator
 */
function calculateWithdrawalRate(projection) {
  const { summary, decumulation } = projection;
  const retirementPot = summary.retirementPot;
  const targetIncome = projection.plan.targetNetIncome;
  
  // Simple withdrawal rate calculation
  const rate = (targetIncome / retirementPot) * 100;
  return rate;
}

/**
 * Get sustainability label and color
 */
function getSustainabilityIndicator(rate) {
  if (rate <= 3.5) {
    return { label: 'Very Sustainable', color: '#22c55e', emoji: '✅' };
  } else if (rate <= 4.0) {
    return { label: 'Sustainable', color: '#22c55e', emoji: '✅' };
  } else if (rate <= 5.0) {
    return { label: 'Moderate Risk', color: '#f59e0b', emoji: '⚠️' };
  } else if (rate <= 6.0) {
    return { label: 'Higher Risk', color: '#f97316', emoji: '⚠️' };
  } else {
    return { label: 'High Risk', color: '#ef4444', emoji: '❌' };
  }
}

/**
 * Format currency for display
 */
function formatCurrency(amount) {
  return '£' + Math.round(amount).toLocaleString();
}

/**
 * Render the main results screen
 */
export function renderResults(projection) {
  debugLog('OUTPUT', 'Rendering results', { 
    successRate: projection.summary.successRate,
    retirementPot: projection.summary.retirementPot
  });
  
  const container = document.getElementById('results-container');
  if (!container) return;
  
  const answer = canIRetire(projection.plan, 90);
  const withdrawalRate = calculateWithdrawalRate(projection);
  const sustainability = getSustainabilityIndicator(withdrawalRate);
  
  // Hero section
  const heroHtml = `
    <div class="results-hero">
      <div class="answer-badge ${answer.answer === 'YES' ? 'success' : 'partial'}">
        ${answer.answer === 'YES' ? '✅ YES' : '⚠️ MAYBE'}
      </div>
      
      <h2 class="results-question">${answer.question}</h2>
      
      <p class="results-confidence">
        Confidence: <strong>${(answer.confidence * 100).toFixed(0)}%</strong>
      </p>
      
      <div class="sustainability-indicator" style="color: ${sustainability.color}">
        ${sustainability.emoji} Withdrawal rate: ${withdrawalRate.toFixed(1)}% 
        <span class="sustainability-label">(${sustainability.label})</span>
      </div>
    </div>
  `;
  
  // Key metrics
  const metricsHtml = `
    <div class="results-metrics">
      <div class="metric">
        <span class="metric-label">Retirement Pot</span>
        <span class="metric-value">${formatCurrency(projection.summary.retirementPot)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Tax-Free Cash (PCLS)</span>
        <span class="metric-value">${formatCurrency(projection.summary.pclsTaken)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Years Supported</span>
        <span class="metric-value">${projection.summary.yearsWithFullIncome} of ${projection.summary.totalYearsInRetirement}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Final Balance</span>
        <span class="metric-value">${formatCurrency(projection.summary.finalBalance)}</span>
      </div>
    </div>
  `;
  
  // Suggestion
  let suggestionHtml = '';
  if (answer.suggestion) {
    suggestionHtml = `
      <div class="results-suggestion">
        <strong>💡 Suggestion:</strong> ${answer.suggestion}
      </div>
    `;
  }
  
  container.innerHTML = heroHtml + metricsHtml + suggestionHtml;
  
  // Render chart
  renderCapitalChart(projection);
}

/**
 * Render capital over time chart
 */
export function renderCapitalChart(projection) {
  debugLog('CHART', 'Rendering capital chart');
  
  const canvas = document.getElementById('capital-chart');
  if (!canvas || typeof Chart === 'undefined') {
    debugLog('CHART', 'Chart.js not available or canvas not found');
    return;
  }
  
  // Destroy existing chart
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  // Prepare data
  const accumulationData = projection.accumulation.years.map(y => ({
    x: y.age,
    y: y.endBalances.total
  }));
  
  const decumulationData = projection.decumulation.years
    .filter(y => !y.fundsDepleted || y.startBalances)
    .map(y => ({
      x: y.age,
      y: y.endBalances?.total || 0
    }));
  
  const allData = [...accumulationData, ...decumulationData];
  const labels = allData.map(d => d.x);
  const values = allData.map(d => d.y);
  
  // Find retirement age for annotation
  const retirementAge = projection.plan.retirementAge;
  
  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total Wealth',
        data: values,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 10
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
            label: (ctx) => formatCurrency(ctx.parsed.y)
          }
        },
        annotation: {
          annotations: {
            retirement: {
              type: 'line',
              xMin: retirementAge,
              xMax: retirementAge,
              borderColor: '#ef4444',
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                display: true,
                content: 'Retirement',
                position: 'start'
              }
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
            text: 'Total Wealth (£)'
          },
          ticks: {
            callback: (value) => formatCurrency(value)
          }
        }
      }
    }
  });
  
  debugLog('CHART', 'Capital chart rendered successfully');
}

/**
 * Render Plan A vs Plan B comparison
 */
export function renderComparison(projectionA, projectionB) {
  debugLog('OUTPUT', 'Rendering comparison');
  
  const container = document.getElementById('comparison-container');
  if (!container) return;
  
  const comparison = comparePlans(projectionA, projectionB);
  const { deltas, percentageChanges } = comparison;
  
  // Format delta with sign
  const formatDelta = (value, isCurrency = true) => {
    const sign = value >= 0 ? '+' : '';
    if (isCurrency) {
      return sign + formatCurrency(value);
    }
    return sign + value.toFixed(1);
  };
  
  // Comparison table
  const tableHtml = `
    <div class="comparison-table">
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>${projectionA.plan.name}</th>
            <th>${projectionB.plan.name}</th>
            <th>Difference</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Retirement Pot</td>
            <td>${formatCurrency(projectionA.summary.retirementPot)}</td>
            <td>${formatCurrency(projectionB.summary.retirementPot)}</td>
            <td class="${deltas.retirementPot >= 0 ? 'positive' : 'negative'}">${formatDelta(deltas.retirementPot)}</td>
          </tr>
          <tr>
            <td>PCLS (Tax-Free)</td>
            <td>${formatCurrency(projectionA.summary.pclsTaken)}</td>
            <td>${formatCurrency(projectionB.summary.pclsTaken)}</td>
            <td class="${deltas.pclsTaken >= 0 ? 'positive' : 'negative'}">${formatDelta(deltas.pclsTaken)}</td>
          </tr>
          <tr>
            <td>Total Net Income</td>
            <td>${formatCurrency(projectionA.summary.totalNetIncome)}</td>
            <td>${formatCurrency(projectionB.summary.totalNetIncome)}</td>
            <td class="${deltas.totalNetIncome >= 0 ? 'positive' : 'negative'}">${formatDelta(deltas.totalNetIncome)}</td>
          </tr>
          <tr>
            <td>Total Tax Paid</td>
            <td>${formatCurrency(projectionA.summary.totalTaxPaid)}</td>
            <td>${formatCurrency(projectionB.summary.totalTaxPaid)}</td>
            <td class="${deltas.totalTaxPaid <= 0 ? 'positive' : 'negative'}">${formatDelta(deltas.totalTaxPaid)}</td>
          </tr>
          <tr>
            <td>Final Balance</td>
            <td>${formatCurrency(projectionA.summary.finalBalance)}</td>
            <td>${formatCurrency(projectionB.summary.finalBalance)}</td>
            <td class="${deltas.finalBalance >= 0 ? 'positive' : 'negative'}">${formatDelta(deltas.finalBalance)}</td>
          </tr>
          <tr>
            <td>Success Rate</td>
            <td>${(projectionA.summary.successRate * 100).toFixed(0)}%</td>
            <td>${(projectionB.summary.successRate * 100).toFixed(0)}%</td>
            <td class="${deltas.successRate >= 0 ? 'positive' : 'negative'}">${formatDelta(deltas.successRate * 100, false)}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = tableHtml;
  
  // Render comparison chart
  renderComparisonChart(projectionA, projectionB);
}

/**
 * Render side-by-side comparison chart
 */
export function renderComparisonChart(projectionA, projectionB) {
  debugLog('CHART', 'Rendering comparison chart');
  
  const canvas = document.getElementById('comparison-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  
  // Destroy existing chart
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  
  // Prepare data for both plans
  const prepareData = (projection) => {
    const accData = projection.accumulation.years.map(y => ({
      x: y.age,
      y: y.endBalances.total
    }));
    const decData = projection.decumulation.years
      .filter(y => !y.fundsDepleted || y.startBalances)
      .map(y => ({
        x: y.age,
        y: y.endBalances?.total || 0
      }));
    return [...accData, ...decData];
  };
  
  const dataA = prepareData(projectionA);
  const dataB = prepareData(projectionB);
  
  // Use union of ages for labels
  const allAges = new Set([...dataA.map(d => d.x), ...dataB.map(d => d.x)]);
  const labels = Array.from(allAges).sort((a, b) => a - b);
  
  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: projectionA.plan.name,
          data: dataA.map(d => d.y),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: false,
          tension: 0.3,
          pointRadius: 0
        },
        {
          label: projectionB.plan.name,
          data: dataB.map(d => d.y),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: false,
          tension: 0.3,
          pointRadius: 0
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
            text: 'Total Wealth (£)'
          },
          ticks: {
            callback: (value) => formatCurrency(value)
          }
        }
      }
    }
  });
  
  debugLog('CHART', 'Comparison chart rendered successfully');
}

/**
 * Render debug output
 */
export function renderDebugOutput(projection) {
  const container = document.getElementById('debug-output');
  if (!container) return;
  
  const output = generateDebugOutput(projection);
  container.innerHTML = `<pre class="debug-table">${output}</pre>`;
}
