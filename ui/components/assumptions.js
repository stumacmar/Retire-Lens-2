/**
 * RetireLens 2 - Assumptions Panel Component
 * 
 * Transparent display of all assumptions used in calculations.
 */

import { TAX_CONFIG, PENSION_CONFIG, PROJECTION_DEFAULTS } from '../../config/defaults.js';

/**
 * Render assumptions panel
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
