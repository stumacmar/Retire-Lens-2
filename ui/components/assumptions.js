/**
 * RetireLens 2 - Assumptions Panel Component
 * 
 * Transparent display and editing of all assumptions used in calculations.
 * Supports both read-only view and editable mode.
 */

import { TAX_CONFIG, PENSION_CONFIG, PROJECTION_DEFAULTS } from '../../config/defaults.js';
import { SCENARIO_PRESETS, getDocumentedDefaults, createUserAssumptions } from '../../engine/assumptions.js';

/**
 * Render assumptions panel (read-only view)
 */
export function renderAssumptionsPanel(plan, containerSelector = '#assumptions-panel') {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  const { assumptions } = plan;
  const { tax, pension, projection } = assumptions;
  
  const html = `
    <details class="assumptions-panel">
      <summary>📋 Assumptions (click to expand)</summary>
      
      <div class="assumptions-content">
        <section class="assumption-section">
          <h4>Tax (2024/25)</h4>
          <dl>
            <dt>Personal Allowance</dt>
            <dd>£${tax.personalAllowance.toLocaleString()}</dd>
            
            <dt>Basic Rate (20%)</dt>
            <dd>Up to £${tax.bands[0].threshold.toLocaleString()}</dd>
            
            <dt>Higher Rate (40%)</dt>
            <dd>£${tax.bands[0].threshold.toLocaleString()} - £${tax.bands[1].threshold.toLocaleString()}</dd>
            
            <dt>PA Taper</dt>
            <dd>Above £${tax.personalAllowanceTaperThreshold.toLocaleString()}</dd>
          </dl>
        </section>
        
        <section class="assumption-section">
          <h4>Pension Rules</h4>
          <dl>
            <dt>Tax-Free Cash (PCLS)</dt>
            <dd>${(pension.pclsRate * 100).toFixed(0)}% of pension pot</dd>
            
            <dt>Minimum Pension Age</dt>
            <dd>${pension.minPensionAge} (${pension.minPensionAgeFrom2028} from 2028)</dd>
            
            <dt>State Pension Age</dt>
            <dd>${pension.statePensionAge}</dd>
            
            <dt>Full State Pension</dt>
            <dd>£${(pension.fullStatePensionWeekly * 52).toLocaleString()}/year</dd>
          </dl>
        </section>
        
        <section class="assumption-section">
          <h4>Investment Assumptions</h4>
          <dl>
            <dt>Real Growth Rate</dt>
            <dd>${(projection.defaultGrowthRate * 100).toFixed(1)}% after inflation</dd>
            
            <dt>Annual Fees</dt>
            <dd>${(projection.defaultFeeRate * 100).toFixed(2)}%</dd>
            
            <dt>Inflation</dt>
            <dd>${(projection.inflationRate * 100).toFixed(1)}% (assumed long-term)</dd>
            
            <dt>Safe Withdrawal Rate</dt>
            <dd>${(projection.safeWithdrawalRate * 100).toFixed(0)}% (baseline)</dd>
          </dl>
        </section>
        
        <section class="assumption-section">
          <h4>Monte Carlo Settings</h4>
          <dl>
            <dt>Simulations</dt>
            <dd>${projection.monteCarloIterations.toLocaleString()}</dd>
            
            <dt>Volatility (σ)</dt>
            <dd>${(projection.volatility * 100).toFixed(0)}%</dd>
            
            <dt>Life Expectancy</dt>
            <dd>Age ${projection.defaultLifeExpectancy}</dd>
          </dl>
        </section>
        
        <p class="assumptions-note">
          <strong>Note:</strong> All figures are in today's money (real terms).
          Tax rules and rates may change. This is for planning purposes only.
        </p>
      </div>
    </details>
  `;
  
  container.innerHTML = html;
}

/**
 * Create inline assumptions summary
 */
export function createAssumptionsSummary() {
  return `
    <div class="assumptions-summary">
      <span title="Real return after inflation">📈 ${(PROJECTION_DEFAULTS.defaultGrowthRate * 100).toFixed(0)}% growth</span>
      <span title="25% tax-free from pension">💰 ${(PENSION_CONFIG.pclsRate * 100).toFixed(0)}% PCLS</span>
      <span title="Personal Allowance 2024/25">🧾 £${TAX_CONFIG.personalAllowance.toLocaleString()} PA</span>
    </div>
  `;
}

/**
 * Render editable assumptions panel
 * 
 * @param {object} currentAssumptions - Current assumptions values
 * @param {function} onUpdate - Callback when assumptions change
 * @param {string} containerSelector - CSS selector for container
 */
export function renderAssumptionsEditor(currentAssumptions, onUpdate, containerSelector = '#assumptions-editor') {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  const defaults = getDocumentedDefaults();
  
  const html = `
    <div class="assumptions-editor">
      <h3>Economic Assumptions</h3>
      <p class="editor-intro">Adjust these assumptions to see how they affect your projections.</p>
      
      <!-- Scenario presets -->
      <div class="scenario-selector">
        <label>Quick Presets:</label>
        <div class="scenario-buttons">
          ${Object.entries(SCENARIO_PRESETS).map(([id, preset]) => `
            <button type="button" 
                    class="scenario-btn ${currentAssumptions.scenario === id ? 'active' : ''}"
                    data-scenario="${id}"
                    title="${preset.description}">
              ${preset.name}
            </button>
          `).join('')}
        </div>
      </div>
      
      <!-- Growth rate -->
      <div class="assumption-field">
        <label for="assumption-growth-rate">
          Real Growth Rate
          <span class="field-help" title="${defaults.growthRate.rationale}">ℹ️</span>
        </label>
        <div class="input-with-suffix">
          <input type="number" 
                 id="assumption-growth-rate" 
                 value="${(currentAssumptions.growthRate * 100).toFixed(1)}"
                 min="-5" max="15" step="0.5"
                 inputmode="decimal" />
          <span class="suffix">%</span>
        </div>
        <p class="field-description">${defaults.growthRate.description}</p>
      </div>
      
      <!-- Inflation rate -->
      <div class="assumption-field">
        <label for="assumption-inflation-rate">
          Inflation Rate
          <span class="field-help" title="${defaults.inflationRate.rationale}">ℹ️</span>
        </label>
        <div class="input-with-suffix">
          <input type="number" 
                 id="assumption-inflation-rate" 
                 value="${(currentAssumptions.inflationRate * 100).toFixed(1)}"
                 min="0" max="10" step="0.5"
                 inputmode="decimal" />
          <span class="suffix">%</span>
        </div>
        <p class="field-description">${defaults.inflationRate.description}</p>
      </div>
      
      <!-- Volatility -->
      <div class="assumption-field">
        <label for="assumption-volatility">
          Volatility (for Monte Carlo)
          <span class="field-help" title="${defaults.volatility.rationale}">ℹ️</span>
        </label>
        <div class="input-with-suffix">
          <input type="number" 
                 id="assumption-volatility" 
                 value="${(currentAssumptions.volatility * 100).toFixed(0)}"
                 min="0" max="40" step="1"
                 inputmode="numeric" />
          <span class="suffix">%</span>
        </div>
        <p class="field-description">${defaults.volatility.description}</p>
      </div>
      
      <!-- Fee rate -->
      <div class="assumption-field">
        <label for="assumption-fee-rate">
          Annual Fees
          <span class="field-help" title="${defaults.feeRate.rationale}">ℹ️</span>
        </label>
        <div class="input-with-suffix">
          <input type="number" 
                 id="assumption-fee-rate" 
                 value="${(currentAssumptions.feeRate * 100).toFixed(2)}"
                 min="0" max="3" step="0.05"
                 inputmode="decimal" />
          <span class="suffix">%</span>
        </div>
        <p class="field-description">${defaults.feeRate.description}</p>
      </div>
      
      <!-- Net growth summary -->
      <div class="assumption-summary">
        <strong>Net Growth Rate:</strong> 
        <span id="net-growth-rate">${((currentAssumptions.growthRate - currentAssumptions.feeRate) * 100).toFixed(2)}%</span>
        <small>(Growth minus fees)</small>
      </div>
      
      <!-- Apply button -->
      <div class="assumption-actions">
        <button type="button" class="btn btn-secondary" id="reset-assumptions">
          Reset to Defaults
        </button>
        <button type="button" class="btn btn-primary" id="apply-assumptions">
          Apply Changes
        </button>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Add event listeners
  initAssumptionsEditorEvents(currentAssumptions, onUpdate);
}

/**
 * Initialize event handlers for assumptions editor
 */
function initAssumptionsEditorEvents(currentAssumptions, onUpdate) {
  // Scenario buttons
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const scenarioId = btn.dataset.scenario;
      const preset = SCENARIO_PRESETS[scenarioId];
      if (preset) {
        // Update form fields
        document.getElementById('assumption-growth-rate').value = (preset.growthRate * 100).toFixed(1);
        document.getElementById('assumption-inflation-rate').value = (preset.inflationRate * 100).toFixed(1);
        document.getElementById('assumption-volatility').value = (preset.volatility * 100).toFixed(0);
        document.getElementById('assumption-fee-rate').value = (preset.feeRate * 100).toFixed(2);
        
        // Update active state
        document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        updateNetGrowthDisplay();
      }
    });
  });
  
  // Update net growth on input change
  const updateNetGrowthDisplay = () => {
    const growth = parseFloat(document.getElementById('assumption-growth-rate').value) / 100;
    const fees = parseFloat(document.getElementById('assumption-fee-rate').value) / 100;
    const netGrowth = growth - fees;
    document.getElementById('net-growth-rate').textContent = `${(netGrowth * 100).toFixed(2)}%`;
  };
  
  ['assumption-growth-rate', 'assumption-fee-rate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateNetGrowthDisplay);
    }
  });
  
  // Reset button
  const resetBtn = document.getElementById('reset-assumptions');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const defaults = createUserAssumptions();
      document.getElementById('assumption-growth-rate').value = (defaults.growthRate * 100).toFixed(1);
      document.getElementById('assumption-inflation-rate').value = (defaults.inflationRate * 100).toFixed(1);
      document.getElementById('assumption-volatility').value = (defaults.volatility * 100).toFixed(0);
      document.getElementById('assumption-fee-rate').value = (defaults.feeRate * 100).toFixed(2);
      
      document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-scenario="moderate"]')?.classList.add('active');
      
      updateNetGrowthDisplay();
    });
  }
  
  // Apply button
  const applyBtn = document.getElementById('apply-assumptions');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const newAssumptions = createUserAssumptions({
        growthRate: parseFloat(document.getElementById('assumption-growth-rate').value) / 100,
        inflationRate: parseFloat(document.getElementById('assumption-inflation-rate').value) / 100,
        volatility: parseFloat(document.getElementById('assumption-volatility').value) / 100,
        feeRate: parseFloat(document.getElementById('assumption-fee-rate').value) / 100,
        scenario: 'custom'
      });
      
      if (typeof onUpdate === 'function') {
        onUpdate(newAssumptions);
      }
    });
  }
}
