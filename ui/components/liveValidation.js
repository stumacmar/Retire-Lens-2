/**
 * RetireLens 2 - Live Validation & Feedback
 * 
 * Provides instant helpful feedback as users type with debounced validation
 */

import { calculateGrossFromNet } from '../../engine/tax.js';

/**
 * Debounce function
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
 * Validate age input
 */
export function validateAge(value, context = {}) {
  const age = parseFloat(value);
  
  if (isNaN(age)) {
    return {
      valid: false,
      type: 'error',
      message: 'Please enter a valid age'
    };
  }
  
  if (age < 18) {
    return {
      valid: false,
      type: 'error',
      message: 'Age must be 18 or older'
    };
  }
  
  if (age > 100) {
    return {
      valid: false,
      type: 'error',
      message: 'Age must be 100 or less'
    };
  }
  
  // Calculate years to state pension
  const statePensionAge = context.statePensionAge || 67;
  const yearsToStatePension = statePensionAge - age;
  
  if (yearsToStatePension > 0) {
    return {
      valid: true,
      type: 'success',
      message: `${yearsToStatePension} years until State Pension at ${statePensionAge}`
    };
  } else {
    return {
      valid: true,
      type: 'success',
      message: `You're ${age - statePensionAge} years past State Pension age`
    };
  }
}

/**
 * Validate retirement age
 */
export function validateRetirementAge(value, context = {}) {
  const retireAge = parseFloat(value);
  const currentAge = context.currentAge;
  
  if (isNaN(retireAge)) {
    return {
      valid: false,
      type: 'error',
      message: 'Please enter a valid retirement age'
    };
  }
  
  if (!currentAge) {
    return {
      valid: true,
      type: 'warning',
      message: 'Enter your current age first'
    };
  }
  
  if (retireAge <= currentAge) {
    return {
      valid: false,
      type: 'error',
      message: 'Retirement age must be after your current age'
    };
  }
  
  if (retireAge > 100) {
    return {
      valid: false,
      type: 'error',
      message: 'Retirement age must be 100 or less'
    };
  }
  
  const yearsToRetirement = retireAge - currentAge;
  const lifeExpectancy = 90;
  const retirementYears = lifeExpectancy - retireAge;
  
  return {
    valid: true,
    type: 'success',
    message: `That's ${yearsToRetirement} years from now. Approx ${retirementYears} years in retirement.`
  };
}

/**
 * Validate income target
 */
export function validateIncome(value, context = {}) {
  const income = parseFloat(value);
  
  if (isNaN(income)) {
    return {
      valid: false,
      type: 'error',
      message: 'Please enter a valid income amount'
    };
  }
  
  if (income <= 0) {
    return {
      valid: false,
      type: 'error',
      message: 'Income must be greater than zero'
    };
  }
  
  if (income > 200000) {
    return {
      valid: true,
      type: 'warning',
      message: 'This is a high income target. Ensure your pot size can support it.'
    };
  }
  
  // Quick projection: assume 4% withdrawal rate
  const requiredPot = income / 0.04;
  
  return {
    valid: true,
    type: 'success',
    message: `This requires approximately £${Math.round(requiredPot).toLocaleString()} pot to sustain (4% rule)`
  };
}

/**
 * Validate contribution amount
 */
export function validateContribution(value, context = {}) {
  const contribution = parseFloat(value);
  
  if (isNaN(contribution) || contribution < 0) {
    return {
      valid: false,
      type: 'error',
      message: 'Please enter a valid contribution amount (or 0)'
    };
  }
  
  const currentAge = context.currentAge;
  const retirementAge = context.retirementAge;
  
  if (!currentAge || !retirementAge) {
    return {
      valid: true,
      type: 'info',
      message: 'Enter your ages first to see projection'
    };
  }
  
  const yearsToRetirement = retirementAge - currentAge;
  
  if (yearsToRetirement <= 0) {
    return {
      valid: true,
      type: 'warning',
      message: 'You\'re at or past retirement age'
    };
  }
  
  // Simple projection: FV = PMT × ((1 + r)^n - 1) / r
  // Assuming 4% real growth
  const rate = 0.04;
  const futureValue = contribution * (Math.pow(1 + rate, yearsToRetirement) - 1) / rate;
  
  if (contribution === 0) {
    return {
      valid: true,
      type: 'info',
      message: 'No contributions planned'
    };
  }
  
  return {
    valid: true,
    type: 'success',
    message: `At this rate, you'll have approx £${Math.round(futureValue).toLocaleString()} extra by retirement (4% growth)`
  };
}

/**
 * Validate pot amount
 */
export function validatePotAmount(value) {
  const amount = parseFloat(value);
  
  if (isNaN(amount) || amount < 0) {
    return {
      valid: false,
      type: 'error',
      message: 'Please enter a valid amount (or 0)'
    };
  }
  
  if (amount === 0) {
    return {
      valid: true,
      type: 'info',
      message: 'Starting with no existing balance'
    };
  }
  
  if (amount > 1000000) {
    return {
      valid: true,
      type: 'success',
      message: `Well done! You have a strong foundation with £${amount.toLocaleString()}`
    };
  }
  
  return {
    valid: true,
    type: 'success',
    message: `Current balance: £${amount.toLocaleString()}`
  };
}

/**
 * Apply validation to input element
 */
export function applyValidation(inputElement, validatorFn, context = {}) {
  const feedbackEl = inputElement.parentElement.querySelector('.validation-feedback') ||
                     createFeedbackElement(inputElement);
  
  const debouncedValidate = debounce((value) => {
    const result = validatorFn(value, context);
    updateFeedback(feedbackEl, result);
    updateInputState(inputElement, result);
  }, 300);
  
  inputElement.addEventListener('input', (e) => {
    debouncedValidate(e.target.value);
  });
  
  // Validate immediately if there's already a value
  if (inputElement.value) {
    debouncedValidate(inputElement.value);
  }
}

/**
 * Create feedback element
 */
function createFeedbackElement(inputElement) {
  const feedback = document.createElement('div');
  feedback.className = 'validation-feedback';
  inputElement.parentElement.appendChild(feedback);
  return feedback;
}

/**
 * Update feedback element
 */
function updateFeedback(feedbackEl, result) {
  feedbackEl.textContent = result.message;
  feedbackEl.className = `validation-feedback validation-${result.type}`;
  
  // Add icon
  const icon = result.type === 'success' ? '✓' :
               result.type === 'error' ? '✗' :
               result.type === 'warning' ? '⚠' : 'ℹ';
  
  feedbackEl.innerHTML = `<span class="validation-icon">${icon}</span> ${result.message}`;
}

/**
 * Update input state
 */
function updateInputState(inputElement, result) {
  inputElement.classList.remove('input-success', 'input-error', 'input-warning');
  
  if (result.valid && result.type === 'success') {
    inputElement.classList.add('input-success');
  } else if (!result.valid || result.type === 'error') {
    inputElement.classList.add('input-error');
  } else if (result.type === 'warning') {
    inputElement.classList.add('input-warning');
  }
}

/**
 * Initialize live validation for all inputs
 */
export function initLiveValidation(formData = {}) {
  // Age inputs
  const currentAgeInput = document.getElementById('input-current-age');
  if (currentAgeInput) {
    applyValidation(currentAgeInput, validateAge, formData);
  }
  
  const retirementAgeInput = document.getElementById('input-retirement-age');
  if (retirementAgeInput) {
    applyValidation(retirementAgeInput, validateRetirementAge, formData);
  }
  
  // Income input
  const incomeInput = document.getElementById('input-target-income');
  if (incomeInput) {
    applyValidation(incomeInput, validateIncome, formData);
  }
  
  // Contribution inputs
  const pensionContribInput = document.getElementById('input-pension-contribution');
  if (pensionContribInput) {
    applyValidation(pensionContribInput, validateContribution, formData);
  }
  
  const isaContribInput = document.getElementById('input-isa-contribution');
  if (isaContribInput) {
    applyValidation(isaContribInput, validateContribution, formData);
  }
  
  // Pot amount inputs
  const currentPensionInput = document.getElementById('input-current-pension');
  if (currentPensionInput) {
    applyValidation(currentPensionInput, validatePotAmount);
  }
  
  const currentIsaInput = document.getElementById('input-current-isa');
  if (currentIsaInput) {
    applyValidation(currentIsaInput, validatePotAmount);
  }
}
