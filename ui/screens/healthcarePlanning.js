/**
 * RetireLens 2 - Healthcare Planning UI Screen
 * 
 * User interface for modeling late-life healthcare and care costs.
 */

import {
  createHealthcarePlan,
  projectHealthcareCosts,
  calculateMeansTestedSupport,
  estimateCareInsurance,
  recommendCareFundingStrategy,
  validateHealthcarePlan,
  HEALTHCARE_DEFAULTS
} from '../../engine/healthcareCosts.js';

/**
 * Render healthcare planning screen
 * 
 * @param {HTMLElement} container - Container element
 * @param {object} currentPlan - Current plan state
 * @param {Function} onUpdate - Callback when configuration changes
 */
export function renderHealthcarePlanningScreen(container, currentPlan, onUpdate) {
  const existingPlan = currentPlan.healthcarePlan || null;
  
  container.innerHTML = `
    <div class="screen healthcare-screen">
      <h2>Healthcare & Care Cost Planning</h2>
      <p class="subtitle">Plan for potential late-life care costs</p>
      
      <div class="info-box">
        <strong>Why plan for care costs?</strong>
        <p>Around 30% of people will require significant care in later life. Care home costs 
        can exceed £50,000 per year. Planning ahead helps protect your savings and gives peace of mind.</p>
      </div>
      
      <form id="healthcare-form" class="planning-form">
        <div class="form-section">
          <h3>Care Requirements Assumptions</h3>
          
          <div class="form-group">
            <label for="care-start-age">Expected Care Start Age</label>
            <input 
              type="number" 
              id="care-start-age" 
              name="careStartAge"
              min="65"
              max="100"
              value="${existingPlan?.careStartAge || 85}"
              required
            />
            <small>Age when you might need care support (default: 85)</small>
          </div>
          
          <div class="form-group">
            <label for="probability-of-care">Probability of Requiring Care</label>
            <input 
              type="range" 
              id="probability-of-care" 
              name="probabilityOfCare"
              min="0"
              max="100"
              step="5"
              value="${(existingPlan?.probabilityOfCare || 0.30) * 100}"
            />
            <output for="probability-of-care" id="probability-display">30%</output>
            <small>Likelihood you'll need care (default: 30%)</small>
          </div>
          
          <div class="form-group">
            <label for="care-type">Type of Care</label>
            <select id="care-type" name="careType" required>
              <option value="home" ${existingPlan?.careType === 'home' ? 'selected' : ''}>
                Home Care (£${HEALTHCARE_DEFAULTS.homeCareCostAnnual.toLocaleString('en-GB')}/year)
              </option>
              <option value="residential" ${!existingPlan || existingPlan?.careType === 'residential' ? 'selected' : ''}>
                Residential Care Home (£${HEALTHCARE_DEFAULTS.residentialCareCostAnnual.toLocaleString('en-GB')}/year)
              </option>
              <option value="nursing" ${existingPlan?.careType === 'nursing' ? 'selected' : ''}>
                Nursing Home (£${HEALTHCARE_DEFAULTS.nursingCareCostAnnual.toLocaleString('en-GB')}/year)
              </option>
            </select>
            <small>Type and cost level of care</small>
          </div>
          
          <div class="form-group">
            <label for="care-duration">Expected Duration of Care (years)</label>
            <input 
              type="number" 
              id="care-duration" 
              name="careDuration"
              min="1"
              max="20"
              value="${existingPlan?.careDuration || 3}"
              required
            />
            <small>Average duration is 2-4 years</small>
          </div>
        </div>
        
        <div class="form-section">
          <h3>Care Funding Options</h3>
          
          <div class="form-group">
            <label>
              <input 
                type="checkbox" 
                id="has-care-insurance" 
                name="hasCareInsurance"
                ${existingPlan?.hasCareInsurance ? 'checked' : ''}
              />
              I have (or will have) care insurance
            </label>
          </div>
          
          <div class="form-group" id="insurance-coverage-group" style="display: none;">
            <label for="insurance-coverage">Insurance Coverage Amount</label>
            <div class="input-with-prefix">
              <span class="prefix">£</span>
              <input 
                type="number" 
                id="insurance-coverage" 
                name="careInsuranceCoverage"
                min="0"
                step="10000"
                value="${existingPlan?.careInsuranceCoverage || 100000}"
              />
            </div>
            <small>Total coverage provided by insurance</small>
          </div>
          
          <div class="form-group">
            <label>
              <input 
                type="checkbox" 
                id="include-nhs" 
                name="includeNHSProbability"
                checked
              />
              Include NHS Continuing Healthcare probability (~15%)
            </label>
            <small>Some people qualify for fully-funded NHS care</small>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Calculate Care Costs</button>
          <button type="button" class="btn btn-secondary" id="estimate-insurance">Estimate Insurance Cost</button>
        </div>
      </form>
      
      <div id="healthcare-results" class="results-section" style="display: none;">
        <h3>Healthcare Cost Analysis</h3>
        <div id="healthcare-results-content"></div>
      </div>
      
      <div id="insurance-estimate" class="results-section" style="display: none;">
        <h3>Care Insurance Estimate</h3>
        <div id="insurance-estimate-content"></div>
      </div>
    </div>
  `;
  
  // Add event listeners
  const form = container.querySelector('#healthcare-form');
  const probabilityInput = container.querySelector('#probability-of-care');
  const probabilityDisplay = container.querySelector('#probability-display');
  const insuranceCheckbox = container.querySelector('#has-care-insurance');
  const insuranceCoverageGroup = container.querySelector('#insurance-coverage-group');
  
  // Update probability display
  probabilityInput.addEventListener('input', () => {
    probabilityDisplay.textContent = probabilityInput.value + '%';
  });
  probabilityDisplay.textContent = probabilityInput.value + '%';
  
  // Show/hide insurance coverage
  insuranceCheckbox.addEventListener('change', () => {
    insuranceCoverageGroup.style.display = insuranceCheckbox.checked ? 'block' : 'none';
  });
  if (insuranceCheckbox.checked) {
    insuranceCoverageGroup.style.display = 'block';
  }
  
  // Form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const params = {
      careStartAge: parseInt(formData.get('careStartAge')),
      probabilityOfCare: parseFloat(formData.get('probabilityOfCare')) / 100,
      careType: formData.get('careType'),
      careDuration: parseInt(formData.get('careDuration')),
      hasCareInsurance: formData.get('hasCareInsurance') === 'on',
      careInsuranceCoverage: parseFloat(formData.get('careInsuranceCoverage')) || 0,
      includeNHSProbability: formData.get('includeNHSProbability') === 'on'
    };
    
    // Validate
    const validation = validateHealthcarePlan(params);
    
    if (!validation.valid) {
      alert('Validation errors:\n' + validation.errors.join('\n'));
      return;
    }
    
    if (validation.warnings.length > 0) {
      const proceed = confirm('Warnings:\n' + validation.warnings.join('\n') + '\n\nContinue anyway?');
      if (!proceed) return;
    }
    
    // Create plan
    const healthcarePlan = createHealthcarePlan(params);
    
    // Project costs
    const projection = projectHealthcareCosts(
      healthcarePlan,
      currentPlan.retirementAge || 65,
      Math.min(healthcarePlan.careEndAge + 5, 100),
      {
        inflationRate: currentPlan.assumptions?.inflationRate || 0.025,
        currentAssets: (currentPlan.currentPension || 0) + (currentPlan.currentIsa || 0),
        includeProperty: false,
        propertyValue: 0
      }
    );
    
    // Get funding recommendation
    const recommendation = recommendCareFundingStrategy(healthcarePlan, {
      totalAssets: (currentPlan.currentPension || 0) + (currentPlan.currentIsa || 0),
      propertyValue: 0,
      liquidAssets: (currentPlan.currentPension || 0) + (currentPlan.currentIsa || 0),
      annualIncome: currentPlan.targetNetIncome || 0
    });
    
    // Display results
    displayHealthcareResults(container, healthcarePlan, projection, recommendation);
    
    // Update plan
    if (onUpdate) {
      onUpdate({ healthcarePlan });
    }
  });
  
  // Insurance estimate button
  container.querySelector('#estimate-insurance').addEventListener('click', () => {
    const estimate = estimateCareInsurance({
      currentAge: currentPlan.currentAge,
      coverageAmount: 100000,
      waitingPeriod: 90,
      benefitPeriod: 3,
      indexLinked: true
    });
    
    displayInsuranceEstimate(container, estimate);
  });
}

/**
 * Display healthcare cost results
 */
function displayHealthcareResults(container, plan, projection, recommendation) {
  const resultsSection = container.querySelector('#healthcare-results');
  const resultsContent = container.querySelector('#healthcare-results-content');
  
  const totalCareYears = projection.filter(p => p.inCarePeriod).length;
  const totalCost = projection[projection.length - 1].cumulativeCost;
  
  resultsContent.innerHTML = `
    <div class="results-grid">
      <div class="result-card">
        <h4>Care Period</h4>
        <p class="result-value">${totalCareYears} years</p>
        <p class="result-label">Ages ${plan.careStartAge} to ${plan.careEndAge}</p>
      </div>
      
      <div class="result-card">
        <h4>Annual Care Cost</h4>
        <p class="result-value">£${plan.annualCost.toLocaleString('en-GB')}</p>
        <p class="result-label">${plan.careType} care</p>
      </div>
      
      <div class="result-card warning">
        <h4>Total Care Cost</h4>
        <p class="result-value">£${plan.totalCost.toLocaleString('en-GB')}</p>
        <p class="result-label">If care is needed</p>
      </div>
      
      <div class="result-card">
        <h4>Expected Cost</h4>
        <p class="result-value">£${plan.expectedNetCost.toLocaleString('en-GB')}</p>
        <p class="result-label">Probability-adjusted</p>
      </div>
    </div>
    
    <div class="probability-breakdown">
      <h4>Cost Probability Breakdown</h4>
      <table class="breakdown-table">
        <tr>
          <td>Probability of requiring care:</td>
          <td>${(plan.probabilityOfCare * 100).toFixed(0)}%</td>
        </tr>
        <tr>
          <td>Probability of NHS funding:</td>
          <td>${(plan.nhsProbability * 100).toFixed(0)}%</td>
        </tr>
        <tr>
          <td>Insurance coverage:</td>
          <td>${plan.hasCareInsurance ? '£' + plan.insuranceCoverage.toLocaleString('en-GB') : 'None'}</td>
        </tr>
        <tr class="total-row">
          <td><strong>Expected net cost to you:</strong></td>
          <td><strong>£${plan.expectedNetCost.toLocaleString('en-GB')}</strong></td>
        </tr>
      </table>
    </div>
    
    <div class="recommendation-section">
      <h4>Recommended Funding Strategy: ${recommendation.strategy.replace(/-/g, ' ').toUpperCase()}</h4>
      
      <div class="recommendations-list">
        ${recommendation.recommendations.map(rec => `
          <div class="recommendation-item priority-${rec.priority}">
            <div class="rec-header">
              <span class="rec-type">${rec.type.replace(/-/g, ' ').toUpperCase()}</span>
              <span class="rec-priority">${rec.priority} priority</span>
            </div>
            <p class="rec-description">${rec.description}</p>
            <p class="rec-action"><strong>Action:</strong> ${rec.action}</p>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="info-box">
      <strong>Important Notes:</strong>
      <ul>
        <li>Care costs vary significantly by location and care provider</li>
        <li>Local authority support is means-tested and subject to eligibility assessment</li>
        <li>Property value may be assessed after 12 weeks in a care home</li>
        <li>Consider consulting with a specialist care fees advisor</li>
      </ul>
    </div>
  `;
  
  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Display insurance estimate
 */
function displayInsuranceEstimate(container, estimate) {
  const estimateSection = container.querySelector('#insurance-estimate');
  const estimateContent = container.querySelector('#insurance-estimate-content');
  
  estimateContent.innerHTML = `
    <div class="results-grid">
      <div class="result-card">
        <h4>Coverage Amount</h4>
        <p class="result-value">£${estimate.coverageAmount.toLocaleString('en-GB')}</p>
        <p class="result-label">Total benefit</p>
      </div>
      
      <div class="result-card">
        <h4>Annual Premium</h4>
        <p class="result-value">£${estimate.annualPremium.toLocaleString('en-GB')}</p>
        <p class="result-label">Per year (estimated)</p>
      </div>
      
      <div class="result-card warning">
        <h4>Total Cost to Age 85</h4>
        <p class="result-value">£${estimate.totalPremiumsPaid.toLocaleString('en-GB')}</p>
        <p class="result-label">All premiums paid</p>
      </div>
      
      <div class="result-card">
        <h4>Value Ratio</h4>
        <p class="result-value">${estimate.valueForMoney.toFixed(2)}x</p>
        <p class="result-label">Coverage / premiums</p>
      </div>
    </div>
    
    <div class="insurance-details">
      <h4>Policy Details</h4>
      <ul>
        <li>Benefit period: ${estimate.benefitPeriod} years</li>
        <li>Waiting period: ${estimate.waitingPeriod} days</li>
        <li>Inflation protection: ${estimate.indexLinked ? 'Yes' : 'No'}</li>
        <li>Break-even probability: ${(estimate.breakEvenProbability * 100).toFixed(1)}%</li>
      </ul>
      
      <p class="insurance-note">
        <strong>Note:</strong> This is an indicative estimate only. Actual premiums vary significantly 
        by provider, health status, and policy features. Get quotes from multiple insurers.
      </p>
    </div>
  `;
  
  estimateSection.style.display = 'block';
  estimateSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Initialize healthcare planning screen
 */
export function initHealthcarePlanningScreen() {
  // Add CSS styles if not already present
  if (!document.getElementById('healthcare-styles')) {
    const style = document.createElement('style');
    style.id = 'healthcare-styles';
    style.textContent = `
      .healthcare-screen {
        max-width: 900px;
        margin: 0 auto;
        padding: 2rem;
      }
      
      .recommendation-item {
        background: #f8f9fa;
        padding: 1rem;
        margin-bottom: 1rem;
        border-left: 4px solid #6c757d;
        border-radius: 4px;
      }
      
      .recommendation-item.priority-critical,
      .recommendation-item.priority-high {
        background: #fff3cd;
        border-left-color: #ffc107;
      }
      
      .rec-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
      }
      
      .rec-type {
        font-weight: 600;
        color: #333;
      }
      
      .rec-priority {
        font-size: 0.875rem;
        color: #6c757d;
        text-transform: uppercase;
      }
      
      .rec-description {
        margin: 0.5rem 0;
      }
      
      .rec-action {
        margin: 0.5rem 0 0 0;
        color: #0066cc;
      }
      
      .breakdown-table {
        width: 100%;
        margin-top: 1rem;
        border-collapse: collapse;
      }
      
      .breakdown-table td {
        padding: 0.75rem;
        border-bottom: 1px solid #dee2e6;
      }
      
      .breakdown-table td:last-child {
        text-align: right;
        font-weight: 600;
      }
      
      .breakdown-table .total-row {
        border-top: 2px solid #333;
        font-size: 1.1rem;
      }
      
      .insurance-note {
        background: #e7f3ff;
        padding: 1rem;
        border-radius: 4px;
        margin-top: 1rem;
      }
    `;
    document.head.appendChild(style);
  }
}
