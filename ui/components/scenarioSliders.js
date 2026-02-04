/**
 * RetireLens 2 - What-If Scenario Sliders
 * 
 * Interactive sliders for sensitivity analysis:
 * - Retirement age (±5 years)
 * - Target income (±£10k)
 * - Contributions (±50%)
 * - Growth rate (1-7%)
 * 
 * Features:
 * - Debounced recalculation (500ms)
 * - Live chart updates with smooth transitions
 * - Show delta values
 * - Side-by-side comparison
 */

import { createPlan, runProjection } from '../../engine/projections.js';

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
 * Format percentage change
 */
function formatDelta(current, baseline, isInverse = false) {
  const diff = current - baseline;
  const percentage = baseline !== 0 ? ((diff / baseline) * 100) : 0;
  
  const isPositive = isInverse ? diff < 0 : diff > 0;
  const color = isPositive ? '#22c55e' : '#ef4444';
  const arrow = diff > 0 ? '↑' : '↓';
  
  if (Math.abs(diff) < 0.01) {
    return '<span style="color: #6b7280;">—</span>';
  }
  
  return `<span style="color: ${color}; font-weight: 500;">${arrow} ${Math.abs(percentage).toFixed(1)}%</span>`;
}

/**
 * Debounce function for delayed execution
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Create scenario slider component
 * 
 * @param {object} baselineInputs - Original user inputs
 * @param {string} containerId - Container element ID
 * @param {function} onScenarioChange - Callback when scenario changes
 * @returns {HTMLElement} Container element
 */
export function createScenarioSliders(baselineInputs, containerId, onScenarioChange) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Container not found:', containerId);
    return null;
  }
  
  // Store baseline and current scenario
  const state = {
    baseline: { ...baselineInputs },
    current: { ...baselineInputs },
    baselineResults: null,
    currentResults: null
  };
  
  // Calculate baseline
  const baselinePlan = createPlan(state.baseline);
  state.baselineResults = runProjection(baselinePlan);
  
  // Create UI
  container.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h3 style="margin: 0 0 20px 0; font-size: 18px; color: #1f2937;">What-If Scenario Analysis</h3>
      
      <!-- Sliders -->
      <div style="display: flex; flex-direction: column; gap: 24px; margin-bottom: 24px;">
        
        <!-- Retirement Age -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label style="font-size: 14px; font-weight: 500; color: #1f2937;">
              Retirement Age
            </label>
            <span id="${containerId}-retirementAge-value" style="font-size: 16px; font-weight: 600; color: #3b82f6;">
              ${state.baseline.retirementAge}
            </span>
          </div>
          <input 
            type="range" 
            id="${containerId}-retirementAge" 
            min="${state.baseline.retirementAge - 5}" 
            max="${state.baseline.retirementAge + 5}" 
            value="${state.baseline.retirementAge}"
            step="1"
            style="width: 100%;"
          />
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-top: 4px;">
            <span>${state.baseline.retirementAge - 5}</span>
            <span>Baseline: ${state.baseline.retirementAge}</span>
            <span>${state.baseline.retirementAge + 5}</span>
          </div>
        </div>
        
        <!-- Target Income -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label style="font-size: 14px; font-weight: 500; color: #1f2937;">
              Target Income
            </label>
            <span id="${containerId}-income-value" style="font-size: 16px; font-weight: 600; color: #3b82f6;">
              ${formatCurrency(state.baseline.targetNetIncome)}
            </span>
          </div>
          <input 
            type="range" 
            id="${containerId}-income" 
            min="${state.baseline.targetNetIncome - 10000}" 
            max="${state.baseline.targetNetIncome + 10000}" 
            value="${state.baseline.targetNetIncome}"
            step="1000"
            style="width: 100%;"
          />
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-top: 4px;">
            <span>${formatCurrency(state.baseline.targetNetIncome - 10000)}</span>
            <span>Baseline: ${formatCurrency(state.baseline.targetNetIncome)}</span>
            <span>${formatCurrency(state.baseline.targetNetIncome + 10000)}</span>
          </div>
        </div>
        
        <!-- Pension Contributions -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label style="font-size: 14px; font-weight: 500; color: #1f2937;">
              Pension Contributions
            </label>
            <span id="${containerId}-pension-value" style="font-size: 16px; font-weight: 600; color: #3b82f6;">
              ${formatCurrency(state.baseline.annualPensionContribution || 0)}
            </span>
          </div>
          <input 
            type="range" 
            id="${containerId}-pension" 
            min="${Math.max(0, (state.baseline.annualPensionContribution || 0) * 0.5)}" 
            max="${(state.baseline.annualPensionContribution || 1000) * 1.5}" 
            value="${state.baseline.annualPensionContribution || 0}"
            step="500"
            style="width: 100%;"
          />
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-top: 4px;">
            <span>-50%</span>
            <span>Baseline: ${formatCurrency(state.baseline.annualPensionContribution || 0)}</span>
            <span>+50%</span>
          </div>
        </div>
        
        <!-- Growth Rate -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label style="font-size: 14px; font-weight: 500; color: #1f2937;">
              Growth Rate
            </label>
            <span id="${containerId}-growth-value" style="font-size: 16px; font-weight: 600; color: #3b82f6;">
              ${((state.baseline.assumptions?.projection?.realReturn || 0.04) * 100).toFixed(1)}%
            </span>
          </div>
          <input 
            type="range" 
            id="${containerId}-growth" 
            min="1" 
            max="7" 
            value="${(state.baseline.assumptions?.projection?.realReturn || 0.04) * 100}"
            step="0.5"
            style="width: 100%;"
          />
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-top: 4px;">
            <span>1%</span>
            <span>Baseline: ${((state.baseline.assumptions?.projection?.realReturn || 0.04) * 100).toFixed(1)}%</span>
            <span>7%</span>
          </div>
        </div>
        
      </div>
      
      <!-- Reset Button -->
      <div style="text-align: center; margin-bottom: 24px;">
        <button 
          id="${containerId}-reset" 
          style="padding: 8px 24px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;"
        >
          Reset to Baseline
        </button>
      </div>
      
      <!-- Comparison Table -->
      <div style="border-top: 2px solid #e5e7eb; padding-top: 20px;">
        <h4 style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">Impact Summary</h4>
        <div id="${containerId}-comparison" style="overflow-x: auto;">
          <!-- Comparison will be populated by JavaScript -->
        </div>
      </div>
      
      <!-- Calculation Status -->
      <div id="${containerId}-status" style="margin-top: 16px; text-align: center; font-size: 13px; color: #6b7280;">
        Ready
      </div>
    </div>
  `;
  
  // Debounced recalculation function
  const recalculate = debounce(() => {
    const statusEl = document.getElementById(`${containerId}-status`);
    statusEl.textContent = 'Calculating...';
    statusEl.style.color = '#3b82f6';
    
    try {
      // Create new plan with current values
      const currentPlan = createPlan(state.current);
      state.currentResults = runProjection(currentPlan);
      
      // Update comparison
      updateComparison();
      
      // Notify callback
      if (onScenarioChange) {
        onScenarioChange(state.currentResults, state.baselineResults);
      }
      
      statusEl.textContent = 'Updated';
      statusEl.style.color = '#22c55e';
      setTimeout(() => {
        statusEl.textContent = 'Ready';
        statusEl.style.color = '#6b7280';
      }, 2000);
    } catch (error) {
      console.error('Scenario calculation error:', error);
      statusEl.textContent = 'Error calculating scenario';
      statusEl.style.color = '#ef4444';
    }
  }, 500);
  
  // Update comparison table
  function updateComparison() {
    const comparisonEl = document.getElementById(`${containerId}-comparison`);
    if (!comparisonEl || !state.baselineResults || !state.currentResults) return;
    
    const baseline = state.baselineResults;
    const current = state.currentResults;
    
    // Calculate key metrics
    const baselineRetirementPot = baseline.yearByYear.find(y => y.age === baseline.retirementAge);
    const currentRetirementPot = current.yearByYear.find(y => y.age === current.retirementAge);
    
    const baselinePot = baselineRetirementPot 
      ? baselineRetirementPot.pensionBalance + baselineRetirementPot.isaBalance 
      : 0;
    const currentPot = currentRetirementPot 
      ? currentRetirementPot.pensionBalance + currentRetirementPot.isaBalance 
      : 0;
    
    const baselineFinal = baseline.yearByYear[baseline.yearByYear.length - 1];
    const currentFinal = current.yearByYear[current.yearByYear.length - 1];
    
    const baselineFinalBalance = baselineFinal 
      ? baselineFinal.pensionBalance + baselineFinal.isaBalance 
      : 0;
    const currentFinalBalance = currentFinal 
      ? currentFinal.pensionBalance + currentFinal.isaBalance 
      : 0;
    
    // Calculate total tax paid
    const baselineTotalTax = baseline.yearByYear.reduce((sum, y) => sum + (y.totalTax || 0), 0);
    const currentTotalTax = current.yearByYear.reduce((sum, y) => sum + (y.totalTax || 0), 0);
    
    comparisonEl.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="border-bottom: 2px solid #e5e7eb;">
            <th style="text-align: left; padding: 12px 8px; color: #6b7280; font-weight: 500;">Metric</th>
            <th style="text-align: right; padding: 12px 8px; color: #6b7280; font-weight: 500;">Baseline</th>
            <th style="text-align: right; padding: 12px 8px; color: #6b7280; font-weight: 500;">Scenario</th>
            <th style="text-align: right; padding: 12px 8px; color: #6b7280; font-weight: 500;">Change</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 12px 8px; color: #1f2937;">Retirement Pot</td>
            <td style="padding: 12px 8px; text-align: right; color: #1f2937;">${formatCurrency(baselinePot)}</td>
            <td style="padding: 12px 8px; text-align: right; color: #1f2937; font-weight: 600;">${formatCurrency(currentPot)}</td>
            <td style="padding: 12px 8px; text-align: right;">${formatDelta(currentPot, baselinePot)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 12px 8px; color: #1f2937;">Final Balance (Age ${currentFinal.age})</td>
            <td style="padding: 12px 8px; text-align: right; color: #1f2937;">${formatCurrency(baselineFinalBalance)}</td>
            <td style="padding: 12px 8px; text-align: right; color: #1f2937; font-weight: 600;">${formatCurrency(currentFinalBalance)}</td>
            <td style="padding: 12px 8px; text-align: right;">${formatDelta(currentFinalBalance, baselineFinalBalance)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 12px 8px; color: #1f2937;">Lifetime Tax Paid</td>
            <td style="padding: 12px 8px; text-align: right; color: #1f2937;">${formatCurrency(baselineTotalTax)}</td>
            <td style="padding: 12px 8px; text-align: right; color: #1f2937; font-weight: 600;">${formatCurrency(currentTotalTax)}</td>
            <td style="padding: 12px 8px; text-align: right;">${formatDelta(currentTotalTax, baselineTotalTax, true)}</td>
          </tr>
          <tr>
            <td style="padding: 12px 8px; color: #1f2937;">Years in Retirement</td>
            <td style="padding: 12px 8px; text-align: right; color: #1f2937;">${baseline.yearsInRetirement || 0}</td>
            <td style="padding: 12px 8px; text-align: right; color: #1f2937; font-weight: 600;">${current.yearsInRetirement || 0}</td>
            <td style="padding: 12px 8px; text-align: right;">${formatDelta(current.yearsInRetirement || 0, baseline.yearsInRetirement || 0)}</td>
          </tr>
        </tbody>
      </table>
    `;
  }
  
  // Add event listeners for sliders
  const retirementAgeSlider = document.getElementById(`${containerId}-retirementAge`);
  const incomeSlider = document.getElementById(`${containerId}-income`);
  const pensionSlider = document.getElementById(`${containerId}-pension`);
  const growthSlider = document.getElementById(`${containerId}-growth`);
  const resetBtn = document.getElementById(`${containerId}-reset`);
  
  retirementAgeSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    document.getElementById(`${containerId}-retirementAge-value`).textContent = value;
    state.current.retirementAge = value;
    recalculate();
  });
  
  incomeSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    document.getElementById(`${containerId}-income-value`).textContent = formatCurrency(value);
    state.current.targetNetIncome = value;
    recalculate();
  });
  
  pensionSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    document.getElementById(`${containerId}-pension-value`).textContent = formatCurrency(value);
    state.current.annualPensionContribution = value;
    recalculate();
  });
  
  growthSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById(`${containerId}-growth-value`).textContent = value.toFixed(1) + '%';
    state.current.assumptions = state.current.assumptions || {};
    state.current.assumptions.projection = state.current.assumptions.projection || {};
    state.current.assumptions.projection.realReturn = value / 100;
    recalculate();
  });
  
  resetBtn.addEventListener('click', () => {
    // Reset all sliders
    state.current = { ...state.baseline };
    
    retirementAgeSlider.value = state.baseline.retirementAge;
    document.getElementById(`${containerId}-retirementAge-value`).textContent = state.baseline.retirementAge;
    
    incomeSlider.value = state.baseline.targetNetIncome;
    document.getElementById(`${containerId}-income-value`).textContent = formatCurrency(state.baseline.targetNetIncome);
    
    pensionSlider.value = state.baseline.annualPensionContribution || 0;
    document.getElementById(`${containerId}-pension-value`).textContent = formatCurrency(state.baseline.annualPensionContribution || 0);
    
    const baselineGrowth = (state.baseline.assumptions?.projection?.realReturn || 0.04) * 100;
    growthSlider.value = baselineGrowth;
    document.getElementById(`${containerId}-growth-value`).textContent = baselineGrowth.toFixed(1) + '%';
    
    recalculate();
  });
  
  // Initial comparison
  updateComparison();
  
  return container;
}

/**
 * Get current scenario state
 * 
 * @param {string} containerId - Container element ID
 * @returns {object} Current scenario inputs and results
 */
export function getScenarioState(containerId) {
  // This would need to be stored in a state management system
  // For now, return null
  return null;
}
