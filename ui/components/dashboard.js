/**
 * RetireLens 2 - Progressive Disclosure Dashboard
 * 
 * Visual dashboard showing planning progress with 7 stages:
 * Age → Retirement Age → Income Target → Pension → Contributions → ISA → State Pension
 */

import { AppState } from '../state.js';
import { navigateToScreen } from '../screens/navigation.js';

/**
 * Dashboard stages configuration
 */
const DASHBOARD_STAGES = [
  { id: 'age', label: 'Current Age', screen: 'age', field: 'currentAge' },
  { id: 'retirement-age', label: 'Retirement Age', screen: 'retirement-age', field: 'retirementAge' },
  { id: 'income', label: 'Income Target', screen: 'income', field: 'targetNetIncome' },
  { id: 'pension', label: 'Pension', screen: 'pension', field: 'currentPension' },
  { id: 'contributions', label: 'Contributions', screen: 'contributions', field: 'annualPensionContribution' },
  { id: 'isa', label: 'ISA', screen: 'isa', field: 'currentIsa' },
  { id: 'state-pension', label: 'State Pension', screen: 'state-pension', field: 'statePensionAge' }
];

/**
 * Get stage status based on form data
 */
export function getStageStatus(stage, formData) {
  if (!formData) return 'not-started';
  
  const value = formData[stage.field];
  
  // Check if this field has been filled
  if (value !== null && value !== undefined && value !== '') {
    return 'complete';
  }
  
  // Check if we're currently on this screen
  if (AppState.currentScreen === stage.screen) {
    return 'in-progress';
  }
  
  return 'not-started';
}

/**
 * Get overall progress percentage
 */
export function getProgressPercentage(formData) {
  if (!formData) return 0;
  
  let completed = 0;
  DASHBOARD_STAGES.forEach(stage => {
    if (getStageStatus(stage, formData) === 'complete') {
      completed++;
    }
  });
  
  return Math.round((completed / DASHBOARD_STAGES.length) * 100);
}

/**
 * Render dashboard HTML
 */
export function renderDashboard(formData) {
  const progress = getProgressPercentage(formData);
  
  let html = `
    <div class="dashboard-container">
      <h2>Your Planning Progress</h2>
      
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${progress}%"></div>
        <span class="progress-text">${progress}% Complete</span>
      </div>
      
      <div class="dashboard-stages">
  `;
  
  DASHBOARD_STAGES.forEach((stage, index) => {
    const status = getStageStatus(stage, formData);
    const icon = status === 'complete' ? '✓' : 
                 status === 'in-progress' ? '⏳' : '⭕';
    
    const value = formData && formData[stage.field];
    const displayValue = value !== null && value !== undefined && value !== '' ?
      formatValue(stage.field, value) : '';
    
    html += `
      <div class="dashboard-stage ${status}" data-stage="${stage.id}">
        <div class="stage-icon">${icon}</div>
        <div class="stage-content">
          <div class="stage-label">${stage.label}</div>
          ${displayValue ? `<div class="stage-value">${displayValue}</div>` : ''}
        </div>
        ${status === 'complete' ? `
          <button class="stage-edit-btn" data-screen="${stage.screen}">Edit</button>
        ` : ''}
      </div>
    `;
  });
  
  html += `
      </div>
      
      <div class="dashboard-summary">
        <h3>Summary</h3>
        <div class="summary-cards">
          ${renderSummaryCards(formData)}
        </div>
      </div>
      
      <div class="dashboard-actions">
        <button id="dashboard-continue-btn" class="btn-primary">
          ${progress === 100 ? 'View Results' : 'Continue Planning'}
        </button>
      </div>
    </div>
  `;
  
  return html;
}

/**
 * Format value for display
 */
function formatValue(field, value) {
  if (field.includes('Age') || field === 'statePensionAge') {
    return `Age ${value}`;
  }
  if (field.includes('Income') || field.includes('Pension') || field.includes('Contribution') || field.includes('Isa')) {
    return `£${value.toLocaleString()}`;
  }
  return value;
}

/**
 * Render summary cards
 */
function renderSummaryCards(formData) {
  if (!formData) return '<p>No data entered yet</p>';
  
  const cards = [];
  
  if (formData.currentAge && formData.retirementAge) {
    const yearsToRetirement = formData.retirementAge - formData.currentAge;
    cards.push(`
      <div class="summary-card">
        <div class="card-label">Years to Retirement</div>
        <div class="card-value">${yearsToRetirement}</div>
      </div>
    `);
  }
  
  if (formData.targetNetIncome) {
    cards.push(`
      <div class="summary-card">
        <div class="card-label">Target Income</div>
        <div class="card-value">£${formData.targetNetIncome.toLocaleString()}/year</div>
      </div>
    `);
  }
  
  if (formData.currentPension !== null && formData.currentIsa !== null) {
    const totalPot = (formData.currentPension || 0) + (formData.currentIsa || 0);
    cards.push(`
      <div class="summary-card">
        <div class="card-label">Current Total Pot</div>
        <div class="card-value">£${totalPot.toLocaleString()}</div>
      </div>
    `);
  }
  
  return cards.join('') || '<p>Complete more stages to see your summary</p>';
}

/**
 * Initialize dashboard interactions
 */
export function initDashboard(formData) {
  // Render dashboard
  const dashboardEl = document.getElementById('screen-dashboard');
  if (dashboardEl) {
    dashboardEl.innerHTML = renderDashboard(formData);
  }
  
  // Add event listeners for edit buttons
  document.querySelectorAll('.stage-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const screen = e.target.dataset.screen;
      if (screen) {
        navigateToScreen(screen);
      }
    });
  });
  
  // Continue button
  const continueBtn = document.getElementById('dashboard-continue-btn');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      // Find first incomplete stage
      const firstIncomplete = DASHBOARD_STAGES.find(stage => 
        getStageStatus(stage, formData) !== 'complete'
      );
      
      if (firstIncomplete) {
        navigateToScreen(firstIncomplete.screen);
      } else {
        // All complete, go to results
        navigateToScreen('results');
      }
    });
  }
}

/**
 * Get next incomplete stage
 */
export function getNextIncompleteStage(formData) {
  return DASHBOARD_STAGES.find(stage => 
    getStageStatus(stage, formData) !== 'complete'
  );
}

/**
 * Check if all stages are complete
 */
export function allStagesComplete(formData) {
  return DASHBOARD_STAGES.every(stage => 
    getStageStatus(stage, formData) === 'complete'
  );
}
