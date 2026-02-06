/**
 * RetireLens Pro - Couples Input Tab Component
 * 
 * Unified "You / Partner" tab-based input UI for couples retirement planning.
 * Both tabs have identical sections for symmetric data collection.
 */

import { safeNumber } from '../utils/formatting.js';

/**
 * Create and render the couples input tabs component
 * 
 * @param {HTMLElement} containerEl - Container element to render into
 * @param {Function} onUpdate - Callback when data changes: onUpdate(householdData)
 * @param {Object} initialData - Initial household data
 */
export function renderCouplesInputTabs(containerEl, onUpdate, initialData = {}) {
  if (!containerEl) {
    throw new Error('Container element is required');
  }
  
  // Initialize household data
  const householdData = {
    householdType: initialData.householdType || 'couple',
    personA: createDefaultPerson(initialData.personA),
    personB: createDefaultPerson(initialData.personB),
    targetNetIncome: safeNumber(initialData.targetNetIncome, 40000)
  };
  
  let activeTab = 'you'; // 'you' or 'partner'
  
  // Render the component
  render();
  
  /**
   * Main render function
   */
  function render() {
    containerEl.innerHTML = `
      <div class="couples-input-container">
        <!-- Tab Headers -->
        <div class="couples-tabs">
          <button 
            class="couples-tab ${activeTab === 'you' ? 'tab-active' : ''}" 
            data-tab="you"
            type="button"
          >
            👤 You
          </button>
          <button 
            class="couples-tab ${activeTab === 'partner' ? 'tab-active' : ''}" 
            data-tab="partner"
            type="button"
          >
            👥 Partner
          </button>
        </div>
        
        <!-- Target Income (shared) -->
        <div class="couples-shared-section">
          <label class="couples-label">
            Combined household income target
            <span class="help-text">After-tax income you both need in retirement (annually)</span>
          </label>
          <div class="input-wrapper currency-input">
            <span class="currency-symbol">£</span>
            <input 
              type="number" 
              id="target-income-input"
              class="couples-input"
              value="${householdData.targetNetIncome}"
              min="0"
              step="1000"
              inputmode="numeric"
            />
          </div>
        </div>
        
        <!-- Tab Content -->
        <div class="couples-tab-content">
          ${renderTabContent(activeTab)}
        </div>
      </div>
    `;
    
    attachEventListeners();
  }
  
  /**
   * Render content for a specific tab
   */
  function renderTabContent(tab) {
    const person = tab === 'you' ? householdData.personA : householdData.personB;
    const personKey = tab === 'you' ? 'personA' : 'personB';
    const label = tab === 'you' ? 'your' : "your partner's";
    
    return `
      <!-- Ages Section -->
      <div class="couples-section">
        <h3 class="couples-section-title">Ages</h3>
        
        <label class="couples-label">
          Current age
        </label>
        <input 
          type="number" 
          class="couples-input"
          data-person="${personKey}"
          data-field="currentAge"
          value="${person.currentAge || ''}"
          min="18"
          max="100"
          inputmode="numeric"
        />
        
        <label class="couples-label">
          Target retirement age
        </label>
        <input 
          type="number" 
          class="couples-input"
          data-person="${personKey}"
          data-field="retirementAge"
          value="${person.retirementAge || ''}"
          min="50"
          max="100"
          inputmode="numeric"
        />
        
        <label class="couples-label">
          Life expectancy age
        </label>
        <input 
          type="number" 
          class="couples-input"
          data-person="${personKey}"
          data-field="lifeExpectancyAge"
          value="${person.lifeExpectancyAge || 90}"
          min="65"
          max="110"
          inputmode="numeric"
        />
      </div>
      
      <!-- DC Pension Section -->
      <div class="couples-section">
        <h3 class="couples-section-title">DC Pension (pot-based)</h3>
        <p class="help-text">Workplace pension, SIPP, or personal pension</p>
        
        <label class="couples-label">
          Current pot value
        </label>
        <div class="input-wrapper currency-input">
          <span class="currency-symbol">£</span>
          <input 
            type="number" 
            class="couples-input"
            data-person="${personKey}"
            data-field="dcPot"
            value="${person.dcPot || 0}"
            min="0"
            step="1000"
            inputmode="numeric"
          />
        </div>
        
        <label class="couples-label">
          Monthly contribution
        </label>
        <div class="input-wrapper currency-input">
          <span class="currency-symbol">£</span>
          <input 
            type="number" 
            class="couples-input"
            data-person="${personKey}"
            data-field="monthlyContribution"
            value="${person.monthlyContribution || 0}"
            min="0"
            step="50"
            inputmode="numeric"
          />
        </div>
        
        <label class="couples-label">
          Annual lump sum injection
          <span class="help-text">One-off or regular annual top-up (optional)</span>
        </label>
        <div class="input-wrapper currency-input">
          <span class="currency-symbol">£</span>
          <input 
            type="number" 
            class="couples-input"
            data-person="${personKey}"
            data-field="annualInjection"
            value="${person.annualInjection || 0}"
            min="0"
            step="1000"
            inputmode="numeric"
          />
        </div>
        
        <label class="couples-label">
          Contributions end at age
          <span class="help-text">Usually ${label} retirement age</span>
        </label>
        <input 
          type="number" 
          class="couples-input"
          data-person="${personKey}"
          data-field="contributionEndAge"
          value="${person.contributionEndAge || person.retirementAge || ''}"
          min="18"
          max="100"
          inputmode="numeric"
        />
      </div>
      
      <!-- DB Pension Section -->
      <div class="couples-section">
        <h3 class="couples-section-title">DB Pension (guaranteed income)</h3>
        <p class="help-text">Final salary or career-average pension</p>
        
        <label class="couples-label">
          Annual income (before tax)
        </label>
        <div class="input-wrapper currency-input">
          <span class="currency-symbol">£</span>
          <input 
            type="number" 
            class="couples-input"
            data-person="${personKey}"
            data-field="dbAnnualIncome"
            value="${person.dbAnnualIncome || 0}"
            min="0"
            step="1000"
            inputmode="numeric"
          />
        </div>
        
        <label class="couples-label">
          Start age
          <span class="help-text">When ${label} DB pension begins</span>
        </label>
        <input 
          type="number" 
          class="couples-input"
          data-person="${personKey}"
          data-field="dbStartAge"
          value="${person.dbStartAge || person.retirementAge || ''}"
          min="50"
          max="100"
          inputmode="numeric"
        />
        
        <label class="couples-label">
          Annual increase rate
        </label>
        <select 
          class="couples-input"
          data-person="${personKey}"
          data-field="escalationRate"
        >
          <option value="cpi" ${person.escalationRate === 'cpi' ? 'selected' : ''}>CPI (2.5% assumed)</option>
          <option value="fixed3" ${person.escalationRate === 'fixed3' ? 'selected' : ''}>Fixed 3%</option>
          <option value="fixed5" ${person.escalationRate === 'fixed5' ? 'selected' : ''}>Fixed 5%</option>
          <option value="none" ${person.escalationRate === 'none' ? 'selected' : ''}>No increase</option>
        </select>
      </div>
      
      <!-- ISA Section -->
      <div class="couples-section">
        <h3 class="couples-section-title">ISA Savings</h3>
        
        <label class="couples-label">
          Current ISA balance
        </label>
        <div class="input-wrapper currency-input">
          <span class="currency-symbol">£</span>
          <input 
            type="number" 
            class="couples-input"
            data-person="${personKey}"
            data-field="isaBalance"
            value="${person.isaBalance || 0}"
            min="0"
            step="1000"
            inputmode="numeric"
          />
        </div>
        
        <label class="couples-label">
          Monthly contribution
        </label>
        <div class="input-wrapper currency-input">
          <span class="currency-symbol">£</span>
          <input 
            type="number" 
            class="couples-input"
            data-person="${personKey}"
            data-field="isaMonthlyContribution"
            value="${person.isaMonthlyContribution || 0}"
            min="0"
            step="50"
            inputmode="numeric"
          />
        </div>
        
        <label class="couples-label">
          Annual lump sum injection
          <span class="help-text">One-off or regular annual top-up (optional)</span>
        </label>
        <div class="input-wrapper currency-input">
          <span class="currency-symbol">£</span>
          <input 
            type="number" 
            class="couples-input"
            data-person="${personKey}"
            data-field="isaAnnualInjection"
            value="${person.isaAnnualInjection || 0}"
            min="0"
            step="1000"
            inputmode="numeric"
          />
        </div>
      </div>
      
      <!-- State Pension Section -->
      <div class="couples-section">
        <h3 class="couples-section-title">State Pension</h3>
        
        <label class="couples-label">
          Start age
          <span class="help-text">When ${label} State Pension begins (usually 67)</span>
        </label>
        <input 
          type="number" 
          class="couples-input"
          data-person="${personKey}"
          data-field="statePensionStartAge"
          value="${person.statePensionStartAge || 67}"
          min="66"
          max="68"
          inputmode="numeric"
        />
        
        <label class="couples-label">
          Annual amount (before tax)
        </label>
        <div class="input-wrapper currency-input">
          <span class="currency-symbol">£</span>
          <input 
            type="number" 
            class="couples-input"
            data-person="${personKey}"
            data-field="statePensionAnnualIncome"
            value="${person.statePensionAnnualIncome || 11500}"
            min="0"
            step="100"
            inputmode="numeric"
          />
        </div>
      </div>
      
      <!-- Validation Messages -->
      <div class="couples-validation" data-person="${personKey}"></div>
    `;
  }
  
  /**
   * Attach event listeners
   */
  function attachEventListeners() {
    // Tab switching
    const tabButtons = containerEl.querySelectorAll('.couples-tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        render();
      });
    });
    
    // Input changes
    const inputs = containerEl.querySelectorAll('.couples-input');
    inputs.forEach(input => {
      input.addEventListener('input', handleInputChange);
      input.addEventListener('blur', handleInputBlur);
    });
    
    // Target income change
    const targetIncomeInput = containerEl.querySelector('#target-income-input');
    if (targetIncomeInput) {
      targetIncomeInput.addEventListener('input', (e) => {
        householdData.targetNetIncome = safeNumber(e.target.value, 0);
        notifyUpdate();
      });
    }
  }
  
  /**
   * Handle input change
   */
  function handleInputChange(e) {
    const personKey = e.target.dataset.person;
    const field = e.target.dataset.field;
    
    if (!personKey || !field) return;
    
    const value = e.target.type === 'number' 
      ? safeNumber(e.target.value, 0)
      : e.target.value;
    
    householdData[personKey][field] = value;
    
    // Auto-populate dependent fields
    if (field === 'retirementAge') {
      const contributionEndAgeInput = containerEl.querySelector(
        `[data-person="${personKey}"][data-field="contributionEndAge"]`
      );
      const dbStartAgeInput = containerEl.querySelector(
        `[data-person="${personKey}"][data-field="dbStartAge"]`
      );
      
      if (contributionEndAgeInput && !contributionEndAgeInput.value) {
        contributionEndAgeInput.value = value;
        householdData[personKey].contributionEndAge = value;
      }
      if (dbStartAgeInput && !dbStartAgeInput.value) {
        dbStartAgeInput.value = value;
        householdData[personKey].dbStartAge = value;
      }
    }
    
    notifyUpdate();
  }
  
  /**
   * Handle input blur (validation)
   */
  function handleInputBlur(e) {
    const personKey = e.target.dataset.person;
    const field = e.target.dataset.field;
    
    if (!personKey || !field) return;
    
    const errors = validatePerson(householdData[personKey], personKey);
    displayValidationErrors(personKey, errors);
  }
  
  /**
   * Validate person data
   */
  function validatePerson(person, personKey) {
    const errors = [];
    
    // Age validations
    if (person.currentAge && (person.currentAge < 18 || person.currentAge > 100)) {
      errors.push('Current age must be between 18 and 100');
    }
    
    if (person.retirementAge && person.currentAge && person.retirementAge <= person.currentAge) {
      errors.push('Retirement age must be after current age');
    }
    
    if (person.lifeExpectancyAge && person.retirementAge && person.lifeExpectancyAge <= person.retirementAge) {
      errors.push('Life expectancy must be after retirement age');
    }
    
    // Contribution end age
    if (person.contributionEndAge && person.currentAge && person.contributionEndAge < person.currentAge) {
      errors.push('Contribution end age must be in the future');
    }
    
    // DB start age
    if (person.dbStartAge && person.currentAge && person.dbStartAge < person.currentAge) {
      errors.push('DB pension start age must be in the future');
    }
    
    // State pension start age
    if (person.statePensionStartAge && (person.statePensionStartAge < 66 || person.statePensionStartAge > 68)) {
      errors.push('State Pension age is typically between 66 and 68');
    }
    
    return errors;
  }
  
  /**
   * Display validation errors
   */
  function displayValidationErrors(personKey, errors) {
    const validationEl = containerEl.querySelector(`.couples-validation[data-person="${personKey}"]`);
    if (!validationEl) return;
    
    if (errors.length > 0) {
      validationEl.innerHTML = errors.map(err => 
        `<div class="validation-error">⚠️ ${err}</div>`
      ).join('');
      validationEl.style.display = 'block';
    } else {
      validationEl.innerHTML = '';
      validationEl.style.display = 'none';
    }
  }
  
  /**
   * Notify parent of data update
   */
  function notifyUpdate() {
    if (typeof onUpdate === 'function') {
      onUpdate(householdData);
    }
  }
  
  /**
   * Public API: Get current data
   */
  return {
    getData: () => householdData,
    setActiveTab: (tab) => {
      activeTab = tab;
      render();
    }
  };
}

/**
 * Create default person object
 */
function createDefaultPerson(data = {}) {
  return {
    currentAge: safeNumber(data.currentAge, null),
    retirementAge: safeNumber(data.retirementAge, null),
    lifeExpectancyAge: safeNumber(data.lifeExpectancyAge, 90),
    
    // DC Pension
    dcPot: safeNumber(data.dcPot, 0),
    monthlyContribution: safeNumber(data.monthlyContribution, 0),
    annualInjection: safeNumber(data.annualInjection, 0),
    contributionEndAge: safeNumber(data.contributionEndAge, data.retirementAge || null),
    
    // DB Pension
    dbAnnualIncome: safeNumber(data.dbAnnualIncome, 0),
    dbStartAge: safeNumber(data.dbStartAge, data.retirementAge || null),
    escalationRate: data.escalationRate || 'cpi',
    
    // ISA
    isaBalance: safeNumber(data.isaBalance, 0),
    isaMonthlyContribution: safeNumber(data.isaMonthlyContribution, 0),
    isaAnnualInjection: safeNumber(data.isaAnnualInjection, 0),
    
    // State Pension
    statePensionStartAge: safeNumber(data.statePensionStartAge, 67),
    statePensionAnnualIncome: safeNumber(data.statePensionAnnualIncome, 11500)
  };
}
