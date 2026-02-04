/**
 * RetireLens 2 - Legacy Planning UI Screen
 * 
 * User interface for inheritance and legacy planning with IHT calculations.
 */

import {
  createLegacyPlan,
  calculateInheritanceTax,
  projectEstateValue,
  calculateLegacyShortfall,
  generateIHTMitigationStrategies,
  calculateBeneficiaryDistributions,
  validateLegacyPlan,
  IHT_CONFIG
} from '../../engine/legacyPlanning.js';

/**
 * Render legacy planning screen
 * 
 * @param {HTMLElement} container - Container element
 * @param {object} currentPlan - Current plan state
 * @param {Function} onUpdate - Callback when configuration changes
 */
export function renderLegacyPlanningScreen(container, currentPlan, onUpdate) {
  const existingPlan = currentPlan.legacyPlan || null;
  
  container.innerHTML = `
    <div class="screen legacy-screen">
      <h2>Inheritance & Legacy Planning</h2>
      <p class="subtitle">Plan for leaving money to beneficiaries and manage inheritance tax</p>
      
      <div class="info-box">
        <strong>UK Inheritance Tax (IHT) Basics:</strong>
        <ul>
          <li>Nil-rate band: £${IHT_CONFIG.nilRateBand.toLocaleString('en-GB')} per person</li>
          <li>Residence nil-rate band: £${IHT_CONFIG.residenceNilRateBand.toLocaleString('en-GB')} (for main residence)</li>
          <li>Tax rate: ${(IHT_CONFIG.taxRate * 100)}% on amount over threshold</li>
          <li>Spouse exemption: Unlimited transfers between spouses</li>
        </ul>
      </div>
      
      <form id="legacy-form" class="planning-form">
        <div class="form-section">
          <h3>Legacy Goals</h3>
          
          <div class="form-group">
            <label for="target-inheritance">Target Inheritance Amount</label>
            <div class="input-with-prefix">
              <span class="prefix">£</span>
              <input 
                type="number" 
                id="target-inheritance" 
                name="targetInheritance"
                min="0"
                step="10000"
                value="${existingPlan?.targetInheritance || 200000}"
                required
              />
            </div>
            <small>Amount you want to leave to beneficiaries (after tax)</small>
          </div>
          
          <div class="form-group">
            <label for="priority">Priority Level</label>
            <select id="priority" name="priority" required>
              <option value="nice-to-have" ${!existingPlan || existingPlan?.priority === 'nice-to-have' ? 'selected' : ''}>
                Nice to have - Won't compromise my lifestyle
              </option>
              <option value="must-have" ${existingPlan?.priority === 'must-have' ? 'selected' : ''}>
                Must have - Important goal to achieve
              </option>
            </select>
          </div>
          
          <div class="form-group">
            <label>
              <input 
                type="checkbox" 
                id="include-property" 
                name="includeProperty"
                ${existingPlan?.includeProperty ? 'checked' : ''}
              />
              Include property in estate for IHT calculation
            </label>
          </div>
          
          <div class="form-group" id="property-value-group" style="display: none;">
            <label for="property-value">Property Value</label>
            <div class="input-with-prefix">
              <span class="prefix">£</span>
              <input 
                type="number" 
                id="property-value" 
                name="propertyValue"
                min="0"
                step="10000"
                value="${existingPlan?.propertyValue || 300000}"
              />
            </div>
            <small>Current value of your property</small>
          </div>
        </div>
        
        <div class="form-section">
          <h3>Charitable Giving</h3>
          
          <div class="form-group">
            <label for="charitable-donation">Charitable Donation</label>
            <div class="input-with-prefix">
              <span class="prefix">£</span>
              <input 
                type="number" 
                id="charitable-donation" 
                name="charitableDonation"
                min="0"
                step="5000"
                value="${existingPlan?.charitableDonation || 0}"
              />
            </div>
            <small>Leaving 10%+ to charity reduces IHT rate from 40% to 36%</small>
          </div>
        </div>
        
        <div class="form-section">
          <h3>Spouse Information</h3>
          
          <div class="form-group">
            <label>
              <input 
                type="checkbox" 
                id="has-spouse" 
                name="hasSpouse"
                ${existingPlan?.hasSpouse ? 'checked' : ''}
              />
              I have a spouse/civil partner
            </label>
          </div>
          
          <div class="form-group" id="spouse-nil-rate-group" style="display: none;">
            <label for="spouse-nil-rate">Spouse's Nil-Rate Band Already Used</label>
            <div class="input-with-prefix">
              <span class="prefix">£</span>
              <input 
                type="number" 
                id="spouse-nil-rate" 
                name="spouseNilRateBandUsed"
                min="0"
                max="${IHT_CONFIG.nilRateBand}"
                step="10000"
                value="${existingPlan?.spouseNilRateBandUsed || 0}"
              />
            </div>
            <small>If deceased spouse used some nil-rate band</small>
          </div>
        </div>
        
        <div class="form-section">
          <h3>Beneficiaries</h3>
          <div id="beneficiaries-list">
            <!-- Beneficiaries will be added here -->
          </div>
          <button type="button" class="btn btn-secondary" id="add-beneficiary">+ Add Beneficiary</button>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Calculate Legacy Plan</button>
          <button type="button" class="btn btn-secondary" id="clear-legacy">Clear Plan</button>
        </div>
      </form>
      
      <div id="legacy-results" class="results-section" style="display: none;">
        <h3>Legacy Planning Analysis</h3>
        <div id="legacy-results-content"></div>
      </div>
    </div>
  `;
  
  // Setup form interactions
  const form = container.querySelector('#legacy-form');
  const includePropertyCheck = container.querySelector('#include-property');
  const propertyValueGroup = container.querySelector('#property-value-group');
  const hasSpouseCheck = container.querySelector('#has-spouse');
  const spouseNilRateGroup = container.querySelector('#spouse-nil-rate-group');
  const beneficiariesList = container.querySelector('#beneficiaries-list');
  const addBeneficiaryBtn = container.querySelector('#add-beneficiary');
  
  // Show/hide property value
  includePropertyCheck.addEventListener('change', () => {
    propertyValueGroup.style.display = includePropertyCheck.checked ? 'block' : 'none';
  });
  if (includePropertyCheck.checked) {
    propertyValueGroup.style.display = 'block';
  }
  
  // Show/hide spouse nil-rate band
  hasSpouseCheck.addEventListener('change', () => {
    spouseNilRateGroup.style.display = hasSpouseCheck.checked ? 'block' : 'none';
  });
  if (hasSpouseCheck.checked) {
    spouseNilRateGroup.style.display = 'block';
  }
  
  // Beneficiary management
  let beneficiaryCount = 0;
  
  function addBeneficiary(beneficiary = {}) {
    const id = beneficiaryCount++;
    const beneficiaryDiv = document.createElement('div');
    beneficiaryDiv.className = 'beneficiary-item';
    beneficiaryDiv.dataset.id = id;
    beneficiaryDiv.innerHTML = `
      <div class="beneficiary-header">
        <h4>Beneficiary ${id + 1}</h4>
        <button type="button" class="btn-remove" data-id="${id}">Remove</button>
      </div>
      <div class="beneficiary-fields">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="beneficiary_${id}_name" value="${beneficiary.name || ''}" required />
        </div>
        <div class="form-group">
          <label>Relationship</label>
          <select name="beneficiary_${id}_relationship" required>
            <option value="child" ${beneficiary.relationship === 'child' ? 'selected' : ''}>Child</option>
            <option value="grandchild" ${beneficiary.relationship === 'grandchild' ? 'selected' : ''}>Grandchild</option>
            <option value="spouse" ${beneficiary.relationship === 'spouse' ? 'selected' : ''}>Spouse</option>
            <option value="sibling" ${beneficiary.relationship === 'sibling' ? 'selected' : ''}>Sibling</option>
            <option value="other" ${beneficiary.relationship === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Share (%)</label>
          <input type="number" name="beneficiary_${id}_share" min="0" max="100" 
                 value="${beneficiary.sharePercentage || 0}" />
        </div>
        <div class="form-group">
          <label>Specific Bequest (£)</label>
          <input type="number" name="beneficiary_${id}_bequest" min="0" 
                 value="${beneficiary.specificBequest || 0}" />
        </div>
      </div>
    `;
    beneficiariesList.appendChild(beneficiaryDiv);
    
    // Remove button handler
    beneficiaryDiv.querySelector('.btn-remove').addEventListener('click', () => {
      beneficiaryDiv.remove();
    });
  }
  
  // Add initial beneficiaries if they exist
  if (existingPlan?.beneficiaries?.length > 0) {
    existingPlan.beneficiaries.forEach(b => addBeneficiary(b));
  } else {
    addBeneficiary(); // Add one default beneficiary
  }
  
  addBeneficiaryBtn.addEventListener('click', () => addBeneficiary());
  
  // Form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    
    // Parse beneficiaries
    const beneficiaries = [];
    const beneficiaryItems = beneficiariesList.querySelectorAll('.beneficiary-item');
    beneficiaryItems.forEach(item => {
      const id = item.dataset.id;
      beneficiaries.push({
        name: formData.get(`beneficiary_${id}_name`),
        relationship: formData.get(`beneficiary_${id}_relationship`),
        sharePercentage: parseFloat(formData.get(`beneficiary_${id}_share`)) || 0,
        specificBequest: parseFloat(formData.get(`beneficiary_${id}_bequest`)) || 0
      });
    });
    
    const legacyParams = {
      targetInheritance: parseFloat(formData.get('targetInheritance')),
      priority: formData.get('priority'),
      beneficiaries,
      includeProperty: formData.get('includeProperty') === 'on',
      propertyValue: parseFloat(formData.get('propertyValue')) || 0,
      charitableDonation: parseFloat(formData.get('charitableDonation')) || 0,
      hasSpouse: formData.get('hasSpouse') === 'on',
      spouseNilRateBandUsed: parseFloat(formData.get('spouseNilRateBandUsed')) || 0
    };
    
    // Validate
    const currentEstate = (currentPlan.currentPension || 0) + (currentPlan.currentIsa || 0);
    const validation = validateLegacyPlan(legacyParams, { currentEstateValue: currentEstate });
    
    if (!validation.valid) {
      alert('Validation errors:\n' + validation.errors.join('\n'));
      return;
    }
    
    if (validation.warnings.length > 0) {
      console.warn('Legacy plan warnings:', validation.warnings);
    }
    
    // Create legacy plan
    const legacyPlan = createLegacyPlan(legacyParams);
    
    // Project estate value
    const lifeExpectancy = currentPlan.assumptions?.lifeExpectancy || 90;
    const yearsToProject = lifeExpectancy - currentPlan.currentAge;
    
    const projectedEstate = projectEstateValue(
      {
        pensionPot: currentPlan.currentPension || 0,
        isaBalance: currentPlan.currentIsa || 0,
        otherAssets: 0,
        propertyValue: legacyParams.includeProperty ? legacyParams.propertyValue : 0,
        annualSpending: currentPlan.targetNetIncome || 0,
        annualIncome: 0
      },
      yearsToProject,
      {
        growthRate: currentPlan.assumptions?.growthRate || 0.04,
        propertyGrowthRate: 0.025
      }
    );
    
    // Calculate IHT
    const ihtCalc = calculateInheritanceTax({
      totalEstateValue: projectedEstate.totalEstate,
      propertyValue: legacyParams.includeProperty ? projectedEstate.projectedProperty : 0,
      charitableDonation: legacyParams.charitableDonation,
      passedToSpouse: 0,
      transferredNilRateBand: legacyParams.hasSpouse && legacyParams.spouseNilRateBandUsed === 0 
        ? IHT_CONFIG.nilRateBand : 0
    });
    
    // Calculate shortfall
    const shortfall = calculateLegacyShortfall(legacyPlan, projectedEstate);
    
    // Generate mitigation strategies
    const strategies = generateIHTMitigationStrategies(
      { 
        totalEstateValue: projectedEstate.totalEstate,
        pensionPot: projectedEstate.projectedInvestments * 0.6  // Rough estimate
      }, 
      ihtCalc
    );
    
    // Calculate beneficiary distributions
    const distributions = calculateBeneficiaryDistributions(legacyPlan, ihtCalc.netEstate);
    
    // Display results
    displayLegacyResults(container, legacyPlan, projectedEstate, ihtCalc, shortfall, strategies, distributions);
    
    // Update plan
    if (onUpdate) {
      onUpdate({ legacyPlan });
    }
  });
  
  // Clear button
  container.querySelector('#clear-legacy').addEventListener('click', () => {
    if (confirm('Clear legacy plan?')) {
      container.querySelector('#legacy-results').style.display = 'none';
      if (onUpdate) {
        onUpdate({ legacyPlan: null });
      }
    }
  });
}

/**
 * Display legacy planning results
 */
function displayLegacyResults(container, plan, estate, iht, shortfall, strategies, distributions) {
  const resultsSection = container.querySelector('#legacy-results');
  const resultsContent = container.querySelector('#legacy-results-content');
  
  const effectiveIHTRate = (iht.effectiveIHTRate * 100).toFixed(1);
  
  resultsContent.innerHTML = `
    <div class="results-grid">
      <div class="result-card">
        <h4>Projected Estate Value</h4>
        <p class="result-value">£${estate.totalEstate.toLocaleString('en-GB')}</p>
        <p class="result-label">At life expectancy</p>
      </div>
      
      <div class="result-card warning">
        <h4>Inheritance Tax</h4>
        <p class="result-value">£${iht.inheritanceTax.toLocaleString('en-GB')}</p>
        <p class="result-label">${effectiveIHTRate}% of estate</p>
      </div>
      
      <div class="result-card">
        <h4>Net Estate (After Tax)</h4>
        <p class="result-value">£${iht.netEstate.toLocaleString('en-GB')}</p>
        <p class="result-label">Available for beneficiaries</p>
      </div>
      
      <div class="result-card ${shortfall.meetsTarget ? 'positive' : 'warning'}">
        <h4>Target Achievement</h4>
        <p class="result-value">${shortfall.meetsTarget ? '✓ On Track' : '✗ Shortfall'}</p>
        <p class="result-label">
          ${shortfall.meetsTarget 
            ? `£${shortfall.shortfall.toLocaleString('en-GB')} surplus` 
            : `£${shortfall.shortfall.toLocaleString('en-GB')} short`}
        </p>
      </div>
    </div>
    
    <div class="iht-breakdown">
      <h4>Inheritance Tax Calculation</h4>
      <table class="breakdown-table">
        <tr>
          <td>Total estate value:</td>
          <td>£${iht.totalEstateValue.toLocaleString('en-GB')}</td>
        </tr>
        <tr>
          <td>Nil-rate band:</td>
          <td>£${iht.standardNilRateBand.toLocaleString('en-GB')}</td>
        </tr>
        <tr>
          <td>Residence nil-rate band:</td>
          <td>£${iht.residenceNilRateBand.toLocaleString('en-GB')}</td>
        </tr>
        <tr>
          <td>Total allowance:</td>
          <td>£${iht.totalAllowance.toLocaleString('en-GB')}</td>
        </tr>
        <tr>
          <td>Taxable estate:</td>
          <td>£${iht.taxableEstate.toLocaleString('en-GB')}</td>
        </tr>
        <tr>
          <td>Tax rate:</td>
          <td>${(iht.applicableRate * 100).toFixed(0)}%</td>
        </tr>
        <tr class="total-row">
          <td><strong>Inheritance tax:</strong></td>
          <td><strong>£${iht.inheritanceTax.toLocaleString('en-GB')}</strong></td>
        </tr>
      </table>
    </div>
    
    ${distributions.length > 0 ? `
      <div class="distributions-section">
        <h4>Beneficiary Distributions</h4>
        <table class="distributions-table">
          <thead>
            <tr>
              <th>Beneficiary</th>
              <th>Relationship</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${distributions.map(d => `
              <tr>
                <td>${d.name}</td>
                <td>${d.relationship}</td>
                <td>£${d.amount.toLocaleString('en-GB')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
    
    ${strategies.length > 0 ? `
      <div class="strategies-section">
        <h4>IHT Mitigation Strategies</h4>
        <p class="strategies-intro">Consider these strategies to reduce inheritance tax:</p>
        
        ${strategies.slice(0, 3).map((strategy, index) => `
          <div class="strategy-item">
            <div class="strategy-header">
              <span class="strategy-number">${index + 1}</span>
              <h5>${strategy.name}</h5>
              <span class="strategy-saving">Save £${strategy.potentialSaving.toLocaleString('en-GB')}</span>
            </div>
            <p class="strategy-description">${strategy.description}</p>
            <p class="strategy-implementation"><strong>How:</strong> ${strategy.implementation}</p>
            <div class="strategy-meta">
              <span class="complexity">Complexity: ${strategy.complexity}</span>
              <span class="timeframe">Timeframe: ${strategy.timeframe}</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}
    
    <div class="info-box">
      <strong>Important:</strong> This is an illustrative calculation only. Inheritance tax rules are 
      complex and professional advice is strongly recommended for estate planning.
    </div>
  `;
  
  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Initialize legacy planning screen
 */
export function initLegacyPlanningScreen() {
  // Add CSS styles if not already present
  if (!document.getElementById('legacy-styles')) {
    const style = document.createElement('style');
    style.id = 'legacy-styles';
    style.textContent = `
      .legacy-screen {
        max-width: 900px;
        margin: 0 auto;
        padding: 2rem;
      }
      
      .beneficiary-item {
        background: #f8f9fa;
        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 4px;
        border: 1px solid #dee2e6;
      }
      
      .beneficiary-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }
      
      .beneficiary-header h4 {
        margin: 0;
      }
      
      .btn-remove {
        background: #dc3545;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .beneficiary-fields {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1fr;
        gap: 1rem;
      }
      
      .distributions-table,
      .breakdown-table {
        width: 100%;
        margin-top: 1rem;
        border-collapse: collapse;
      }
      
      .distributions-table th {
        background: #f8f9fa;
        padding: 0.75rem;
        text-align: left;
        border-bottom: 2px solid #dee2e6;
      }
      
      .distributions-table td {
        padding: 0.75rem;
        border-bottom: 1px solid #dee2e6;
      }
      
      .strategy-item {
        background: #f8f9fa;
        padding: 1.5rem;
        margin-bottom: 1rem;
        border-radius: 4px;
        border-left: 4px solid #0066cc;
      }
      
      .strategy-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 0.5rem;
      }
      
      .strategy-number {
        background: #0066cc;
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
      }
      
      .strategy-header h5 {
        flex: 1;
        margin: 0;
      }
      
      .strategy-saving {
        background: #d4edda;
        color: #155724;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        font-weight: 600;
      }
      
      .strategy-meta {
        display: flex;
        gap: 2rem;
        margin-top: 0.5rem;
        font-size: 0.875rem;
        color: #6c757d;
      }
    `;
    document.head.appendChild(style);
  }
}
