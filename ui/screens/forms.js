/**
 * RetireLens 2 - Form Handlers
 * 
 * Collect and validate user inputs.
 */

import { updateState, debugLog, deepClone } from '../state.js';
import { nextScreen, prevScreen } from './navigation.js';
import { createPlan } from '../../engine/projections.js';

// Form data storage
let formData = {
  currentAge: null,
  retirementAge: null,
  targetNetIncome: null,
  currentPension: 0,
  annualPensionContribution: 0,
  currentIsa: 0,
  annualIsaContribution: 0,
  statePensionAge: 67,
  expectedStatePension: 11500
};

/**
 * Get numeric value from input
 */
function getNumericValue(inputId, defaultValue = 0) {
  const el = document.getElementById(inputId);
  if (!el) return defaultValue;
  const value = parseFloat(el.value);
  return isNaN(value) ? defaultValue : value;
}

/**
 * Validate current screen inputs
 */
export function validateCurrentScreen(screenId) {
  switch (screenId) {
    case 'age':
      const age = getNumericValue('input-current-age');
      if (age < 18 || age > 100) {
        showError('Please enter an age between 18 and 100');
        return false;
      }
      formData.currentAge = age;
      return true;
      
    case 'retirement-age':
      const retireAge = getNumericValue('input-retirement-age');
      if (retireAge <= formData.currentAge || retireAge > 100) {
        showError('Retirement age must be after your current age');
        return false;
      }
      formData.retirementAge = retireAge;
      return true;
      
    case 'income-target':
      const income = getNumericValue('input-target-income');
      if (income <= 0) {
        showError('Please enter a target income');
        return false;
      }
      formData.targetNetIncome = income;
      return true;
      
    case 'pension-pot':
      formData.currentPension = getNumericValue('input-pension-pot', 0);
      return true;
      
    case 'contributions':
      // Convert monthly to annual contribution (monthly * 12)
      formData.annualPensionContribution = getNumericValue('input-pension-contribution', 0) * 12;
      return true;
      
    case 'isa-savings':
      formData.currentIsa = getNumericValue('input-isa-balance', 0);
      formData.annualIsaContribution = getNumericValue('input-isa-contribution', 0);
      return true;
      
    case 'state-pension':
      formData.statePensionAge = getNumericValue('input-state-pension-age', 67);
      formData.expectedStatePension = getNumericValue('input-state-pension-amount', 11500);
      return true;
      
    default:
      return true;
  }
}

/**
 * Show validation error
 */
function showError(message) {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('visible');
    setTimeout(() => errorEl.classList.remove('visible'), 3000);
  } else {
    alert(message);
  }
}

/**
 * Create plan from form data
 */
export function createPlanFromForm(name = 'Plan A') {
  debugLog('INPUT', 'Creating plan from form', formData);
  
  try {
    const plan = createPlan({
      name,
      ...deepClone(formData)
    });
    
    debugLog('CALCULATION', 'Plan created successfully', { name: plan.name });
    return plan;
  } catch (error) {
    debugLog('INPUT', 'Plan creation failed', { error: error.message });
    showError(error.message);
    return null;
  }
}

/**
 * Handle "Next" button click
 */
export function handleNext(screenId) {
  if (validateCurrentScreen(screenId)) {
    nextScreen();
  }
}

/**
 * Initialize form handlers
 */
export function initFormHandlers() {
  // Add event listeners to all "Next" buttons
  document.querySelectorAll('[data-action="next"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const screenId = btn.closest('.screen')?.id?.replace('screen-', '');
      handleNext(screenId);
    });
  });
  
  // Add event listeners to all "Back" buttons
  document.querySelectorAll('[data-action="back"]').forEach(btn => {
    btn.addEventListener('click', () => {
      prevScreen();
    });
  });
  
  debugLog('INPUT', 'Form handlers initialized');
}

/**
 * Get current form data
 */
export function getFormData() {
  return deepClone(formData);
}

/**
 * Set form data (for Plan B comparison)
 */
export function setFormData(data) {
  formData = deepClone(data);
}
