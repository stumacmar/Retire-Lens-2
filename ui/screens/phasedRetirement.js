/**
 * RetireLens 2 - Phased Retirement UI Screen
 * 
 * User interface for configuring phased/partial retirement scenarios.
 */

import {
  createPhasedRetirement,
  calculatePhasedRetirementImpact,
  calculatePhasedBenefits,
  validatePhasedRetirement,
  projectWithPhasedRetirement
} from '../../engine/phasedRetirement.js';

/**
 * Render phased retirement configuration screen
 * 
 * @param {HTMLElement} container - Container element
 * @param {object} currentPlan - Current plan state
 * @param {Function} onUpdate - Callback when configuration changes
 */
export function renderPhasedRetirementScreen(container, currentPlan, onUpdate) {
  const existingConfig = currentPlan.phasedRetirement || null;
  
  container.innerHTML = `
    <div class="screen phased-retirement-screen">
      <h2>Phased Retirement Planning</h2>
      <p class="subtitle">Model a gradual transition from full-time work to full retirement</p>
      
      <div class="info-box">
        <strong>What is phased retirement?</strong>
        <p>Gradually reduce work hours while drawing on your pension, maintaining social connections 
        and easing into retirement over several years.</p>
      </div>
      
      <form id="phased-retirement-form" class="planning-form">
        <div class="form-section">
          <h3>Phased Period Timeline</h3>
          
          <div class="form-group">
            <label for="phased-start-age">Start Part-Time Work Age</label>
            <input 
              type="number" 
              id="phased-start-age" 
              name="phasedStartAge"
              min="${currentPlan.currentAge + 1}"
              max="75"
              value="${existingConfig?.phasedStartAge || currentPlan.retirementAge - 3}"
              required
            />
            <small>Age when you'll reduce to part-time work</small>
          </div>
          
          <div class="form-group">
            <label for="phased-end-age">Full Retirement Age</label>
            <input 
              type="number" 
              id="phased-end-age" 
              name="phasedEndAge"
              min="${currentPlan.currentAge + 2}"
              max="80"
              value="${existingConfig?.phasedEndAge || currentPlan.retirementAge}"
              required
            />
            <small>Age when you'll fully retire</small>
          </div>
          
          <div class="duration-display">
            <strong>Phased Period Duration:</strong> <span id="phased-duration">0</span> years
          </div>
        </div>
        
        <div class="form-section">
          <h3>Part-Time Income & Contributions</h3>
          
          <div class="form-group">
            <label for="part-time-income">Annual Part-Time Income (Gross)</label>
            <div class="input-with-prefix">
              <span class="prefix">£</span>
              <input 
                type="number" 
                id="part-time-income" 
                name="partTimeIncome"
                min="0"
                step="1000"
                value="${existingConfig?.partTimeIncome || 20000}"
                required
              />
            </div>
            <small>Expected gross income from part-time work</small>
          </div>
          
          <div class="form-group">
            <label for="reduced-contributions">Annual Pension Contributions</label>
            <div class="input-with-prefix">
              <span class="prefix">£</span>
              <input 
                type="number" 
                id="reduced-contributions" 
                name="reducedContributions"
                min="0"
                step="500"
                value="${existingConfig?.reducedContributions || 3000}"
              />
            </div>
            <small>Pension contributions during part-time period</small>
          </div>
          
          <div class="form-group">
            <label for="full-time-income">Current Full-Time Income (for comparison)</label>
            <div class="input-with-prefix">
              <span class="prefix">£</span>
              <input 
                type="number" 
                id="full-time-income" 
                name="fullTimeIncome"
                min="0"
                step="1000"
                value="${existingConfig?.fullTimeIncome || 50000}"
              />
            </div>
            <small>Your current full-time gross income</small>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Calculate Impact</button>
          <button type="button" class="btn btn-secondary" id="clear-phased">Clear Plan</button>
        </div>
      </form>
      
      <div id="phased-results" class="results-section" style="display: none;">
        <h3>Phased Retirement Analysis</h3>
        <div id="phased-results-content"></div>
      </div>
    </div>
  `;
  
  // Add event listeners
  const form = container.querySelector('#phased-retirement-form');
  const startAgeInput = container.querySelector('#phased-start-age');
  const endAgeInput = container.querySelector('#phased-end-age');
  const durationDisplay = container.querySelector('#phased-duration');
  
  // Update duration display
  const updateDuration = () => {
    const start = parseInt(startAgeInput.value) || 0;
    const end = parseInt(endAgeInput.value) || 0;
    const duration = Math.max(0, end - start);
    durationDisplay.textContent = duration;
  };
  
  startAgeInput.addEventListener('input', updateDuration);
  endAgeInput.addEventListener('input', updateDuration);
  updateDuration();
  
  // Form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const phasedConfig = {
      phasedStartAge: parseInt(formData.get('phasedStartAge')),
      phasedEndAge: parseInt(formData.get('phasedEndAge')),
      partTimeIncome: parseFloat(formData.get('partTimeIncome')),
      reducedContributions: parseFloat(formData.get('reducedContributions')),
      fullTimeIncome: parseFloat(formData.get('fullTimeIncome'))
    };
    
    // Validate
    const validation = validatePhasedRetirement(phasedConfig, {
      currentAge: currentPlan.currentAge,
      fullRetirementAge: currentPlan.retirementAge + 10
    });
    
    if (!validation.valid) {
      alert('Validation errors:\n' + validation.errors.join('\n'));
      return;
    }
    
    // Create configuration
    const config = createPhasedRetirement(phasedConfig);
    
    // Calculate impact
    const impact = calculatePhasedRetirementImpact(
      config,
      currentPlan.annualPensionContribution || 0,
      currentPlan.assumptions?.growthRate || 0.04
    );
    
    const benefits = calculatePhasedBenefits(config, currentPlan);
    
    // Display results
    displayPhasedResults(container, config, impact, benefits);
    
    // Update plan
    if (onUpdate) {
      onUpdate({ phasedRetirement: config });
    }
  });
  
  // Clear button
  container.querySelector('#clear-phased').addEventListener('click', () => {
    if (confirm('Clear phased retirement plan?')) {
      container.querySelector('#phased-results').style.display = 'none';
      if (onUpdate) {
        onUpdate({ phasedRetirement: null });
      }
    }
  });
}

/**
 * Display phased retirement results
 */
function displayPhasedResults(container, config, impact, benefits) {
  const resultsSection = container.querySelector('#phased-results');
  const resultsContent = container.querySelector('#phased-results-content');
  
  const incomeReduction = config.fullTimeIncome - config.partTimeIncome;
  const incomeReductionPct = config.incomeReductionPercentage.toFixed(1);
  
  resultsContent.innerHTML = `
    <div class="results-grid">
      <div class="result-card">
        <h4>Timeline</h4>
        <p class="result-value">${config.phasedDuration} years</p>
        <p class="result-label">Ages ${config.phasedStartAge} to ${config.phasedEndAge}</p>
      </div>
      
      <div class="result-card">
        <h4>Part-Time Income</h4>
        <p class="result-value">£${config.partTimeIncome.toLocaleString('en-GB')}</p>
        <p class="result-label">${incomeReductionPct}% reduction from full-time</p>
      </div>
      
      <div class="result-card">
        <h4>Total Part-Time Earnings</h4>
        <p class="result-value">£${benefits.additionalIncome.toLocaleString('en-GB')}</p>
        <p class="result-label">Over ${config.phasedDuration} years</p>
      </div>
      
      <div class="result-card ${impact.netPotImpact < 0 ? 'warning' : 'positive'}">
        <h4>Pension Pot Impact</h4>
        <p class="result-value">£${Math.abs(impact.foregoneFutureValue).toLocaleString('en-GB')}</p>
        <p class="result-label">${impact.netPotImpact < 0 ? 'Foregone growth' : 'Additional growth'}</p>
      </div>
    </div>
    
    <div class="benefits-section">
      <h4>Key Benefits</h4>
      <ul class="benefits-list">
        <li><strong>Financial:</strong> ${benefits.financialBenefit}</li>
        <li><strong>Pension:</strong> ${benefits.pensionBenefit}</li>
        <li><strong>Social:</strong> ${benefits.socialBenefit}</li>
        <li><strong>Health:</strong> ${benefits.healthBenefit}</li>
        <li><strong>Professional:</strong> ${benefits.skillsBenefit}</li>
      </ul>
    </div>
    
    <div class="impact-details">
      <h4>Financial Impact Details</h4>
      <table class="impact-table">
        <tr>
          <td>Foregone contributions:</td>
          <td>£${impact.foregoneContributions.toLocaleString('en-GB')}</td>
        </tr>
        <tr>
          <td>Future value of foregone contributions:</td>
          <td>£${impact.foregoneFutureValue.toLocaleString('en-GB')}</td>
        </tr>
        <tr>
          <td>Value of continued contributions:</td>
          <td>£${impact.contributionsBenefitValue.toLocaleString('en-GB')}</td>
        </tr>
        <tr class="total-row">
          <td><strong>Net pension pot impact:</strong></td>
          <td><strong>£${Math.abs(impact.netPotImpact).toLocaleString('en-GB')}</strong></td>
        </tr>
      </table>
    </div>
    
    <div class="info-box">
      <strong>Recommendation:</strong>
      <p>Working part-time for ${config.phasedDuration} years generates £${benefits.additionalIncome.toLocaleString('en-GB')} 
      in additional income, though pension growth will be reduced by approximately 
      £${Math.abs(impact.foregoneFutureValue).toLocaleString('en-GB')}. Consider the lifestyle 
      and wellbeing benefits alongside the financial impact.</p>
    </div>
  `;
  
  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Initialize phased retirement screen
 */
export function initPhasedRetirementScreen() {
  // Add CSS styles if not already present
  if (!document.getElementById('phased-retirement-styles')) {
    const style = document.createElement('style');
    style.id = 'phased-retirement-styles';
    style.textContent = `
      .phased-retirement-screen {
        max-width: 900px;
        margin: 0 auto;
        padding: 2rem;
      }
      
      .planning-form {
        background: #f8f9fa;
        padding: 2rem;
        border-radius: 8px;
        margin: 2rem 0;
      }
      
      .form-section {
        margin-bottom: 2rem;
        padding-bottom: 2rem;
        border-bottom: 1px solid #dee2e6;
      }
      
      .form-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
      }
      
      .form-group {
        margin-bottom: 1.5rem;
      }
      
      .form-group label {
        display: block;
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: #333;
      }
      
      .form-group input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 1rem;
      }
      
      .form-group small {
        display: block;
        margin-top: 0.25rem;
        color: #6c757d;
        font-size: 0.875rem;
      }
      
      .input-with-prefix {
        display: flex;
        align-items: center;
      }
      
      .input-with-prefix .prefix {
        padding: 0.75rem;
        background: #e9ecef;
        border: 1px solid #ced4da;
        border-right: none;
        border-radius: 4px 0 0 4px;
        font-weight: 600;
      }
      
      .input-with-prefix input {
        border-radius: 0 4px 4px 0;
      }
      
      .duration-display {
        background: #e7f3ff;
        padding: 1rem;
        border-radius: 4px;
        margin-top: 1rem;
        text-align: center;
        font-size: 1.1rem;
      }
      
      .duration-display span {
        font-weight: 700;
        color: #0066cc;
        font-size: 1.5rem;
      }
      
      .results-section {
        margin-top: 2rem;
        padding: 2rem;
        background: #fff;
        border: 1px solid #dee2e6;
        border-radius: 8px;
      }
      
      .results-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }
      
      .result-card {
        background: #f8f9fa;
        padding: 1.5rem;
        border-radius: 6px;
        text-align: center;
      }
      
      .result-card.positive {
        background: #d4edda;
        border: 1px solid #c3e6cb;
      }
      
      .result-card.warning {
        background: #fff3cd;
        border: 1px solid #ffeeba;
      }
      
      .result-value {
        font-size: 1.75rem;
        font-weight: 700;
        color: #333;
        margin: 0.5rem 0;
      }
      
      .result-label {
        color: #6c757d;
        font-size: 0.875rem;
        margin: 0;
      }
      
      .benefits-list {
        list-style: none;
        padding: 0;
      }
      
      .benefits-list li {
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        background: #f8f9fa;
        border-left: 3px solid #0066cc;
        border-radius: 4px;
      }
      
      .impact-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
      }
      
      .impact-table td {
        padding: 0.75rem;
        border-bottom: 1px solid #dee2e6;
      }
      
      .impact-table td:last-child {
        text-align: right;
        font-weight: 600;
      }
      
      .impact-table .total-row {
        border-top: 2px solid #333;
        font-size: 1.1rem;
      }
    `;
    document.head.appendChild(style);
  }
}
