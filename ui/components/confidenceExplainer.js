/**
 * RetireLens 2 - Confidence Explainer Component
 * 
 * Provides clear, user-friendly explanations of Monte Carlo results
 * and what the confidence score means for retirement planning.
 * 
 * Key principles:
 * - Make uncertainty understandable to non-technical users
 * - Provide actionable interpretations
 * - Be transparent about model limitations
 */

import { getConfidenceInterpretation } from '../../engine/monteCarlo.js';

/**
 * Render confidence explainer panel
 * 
 * @param {object} mcResult - Monte Carlo results from runMonteCarloWithBands
 * @param {object} detResult - Deterministic results from runProjection
 * @param {string} containerSelector - DOM selector for container
 */
export function renderConfidenceExplainer(mcResult, detResult, containerSelector = '#confidence-explainer') {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  const { successRate, iterations, depletionAges } = mcResult;
  const interpretation = getConfidenceInterpretation(successRate);
  const percentage = Math.round(successRate * 100);
  
  const html = `
    <div class="confidence-explainer" style="--confidence-color: ${interpretation.color}">
      <div class="confidence-header">
        <div class="confidence-score">
          <span class="confidence-number">${percentage}%</span>
          <span class="confidence-label">${interpretation.label}</span>
        </div>
        <div class="confidence-indicator" style="background: ${interpretation.color}"></div>
      </div>
      
      <div class="confidence-body">
        <p class="confidence-description">
          ${interpretation.description}
        </p>
        
        <details class="confidence-details">
          <summary>What does this mean?</summary>
          <div class="explanation-content">
            <p>
              We ran <strong>${iterations.toLocaleString()} simulations</strong> of your retirement plan,
              each with a different random sequence of market returns.
            </p>
            <p>
              ${interpretation.interpretation}
            </p>
            ${depletionAges.count > 0 ? `
              <p class="depletion-info">
                In ${depletionAges.count} simulations where funds ran out, the typical depletion age was 
                <strong>${Math.round(depletionAges.median)}</strong>
                (ranging from ${depletionAges.earliest} to ${depletionAges.latest}).
              </p>
            ` : `
              <p class="success-info">
                In all ${iterations.toLocaleString()} simulations, your funds lasted the full projection period.
              </p>
            `}
          </div>
        </details>
        
        ${interpretation.recommendation ? `
          <div class="confidence-recommendation">
            <strong>💡 Recommendation:</strong> ${interpretation.recommendation}
          </div>
        ` : ''}
      </div>
      
      <details class="confidence-caveats">
        <summary>Important caveats</summary>
        <ul>
          <li><strong>Model limitations:</strong> Returns are assumed to follow a normal distribution. Real markets may have "fat tails" (more extreme events).</li>
          <li><strong>Sequence-of-returns risk:</strong> Poor returns early in retirement are particularly damaging. This is captured in the simulation.</li>
          <li><strong>Not financial advice:</strong> This tool provides projections for planning purposes only, not guarantees.</li>
          <li><strong>Assumptions may change:</strong> Tax rules, State Pension age, and inflation may differ from current assumptions.</li>
        </ul>
      </details>
    </div>
  `;
  
  container.innerHTML = html;
}

/**
 * Create confidence score badge for compact display
 * 
 * @param {number} successRate - Success rate from Monte Carlo (0-1)
 * @returns {string} HTML for confidence badge
 */
export function createConfidenceBadge(successRate) {
  const interpretation = getConfidenceInterpretation(successRate);
  const percentage = Math.round(successRate * 100);
  
  return `
    <span class="confidence-badge" style="background-color: ${interpretation.color}">
      ${percentage}% ${interpretation.label}
    </span>
  `;
}

/**
 * Create confidence meter visualization
 * 
 * @param {number} successRate - Success rate (0-1)
 * @returns {string} HTML for confidence meter
 */
export function createConfidenceMeter(successRate) {
  const interpretation = getConfidenceInterpretation(successRate);
  const percentage = Math.round(successRate * 100);
  
  return `
    <div class="confidence-meter">
      <div class="meter-label">Confidence Level</div>
      <div class="meter-track">
        <div class="meter-fill" style="width: ${percentage}%; background-color: ${interpretation.color}"></div>
      </div>
      <div class="meter-value">${percentage}%</div>
    </div>
  `;
}

/**
 * Get CSS styles for confidence explainer component
 * 
 * @returns {string} CSS styles
 */
export function getConfidenceExplainerStyles() {
  return `
    .confidence-explainer {
      background: var(--color-surface, #ffffff);
      border-radius: var(--radius-lg, 1rem);
      padding: var(--spacing-lg, 1.5rem);
      margin: var(--spacing-md, 1rem) 0;
      border-left: 4px solid var(--confidence-color, #3b82f6);
    }
    
    .confidence-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-md, 1rem);
    }
    
    .confidence-score {
      display: flex;
      flex-direction: column;
    }
    
    .confidence-number {
      font-size: var(--font-size-3xl, 2.5rem);
      font-weight: 700;
      line-height: 1;
      color: var(--confidence-color, #3b82f6);
    }
    
    .confidence-label {
      font-size: var(--font-size-sm, 0.875rem);
      color: var(--color-text-light, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .confidence-indicator {
      width: 16px;
      height: 16px;
      border-radius: 50%;
    }
    
    .confidence-description {
      font-size: var(--font-size-lg, 1.125rem);
      margin-bottom: var(--spacing-md, 1rem);
    }
    
    .confidence-details summary,
    .confidence-caveats summary {
      cursor: pointer;
      color: var(--color-primary, #3b82f6);
      font-weight: 500;
      margin-bottom: var(--spacing-sm, 0.5rem);
    }
    
    .explanation-content {
      padding: var(--spacing-md, 1rem);
      background: var(--color-background, #f9fafb);
      border-radius: var(--radius-md, 0.5rem);
      margin-top: var(--spacing-sm, 0.5rem);
    }
    
    .explanation-content p {
      margin-bottom: var(--spacing-sm, 0.5rem);
    }
    
    .depletion-info {
      color: var(--color-warning, #f59e0b);
    }
    
    .success-info {
      color: var(--color-success, #22c55e);
    }
    
    .confidence-recommendation {
      background: #fef3c7;
      padding: var(--spacing-md, 1rem);
      border-radius: var(--radius-md, 0.5rem);
      margin-top: var(--spacing-md, 1rem);
    }
    
    .confidence-caveats {
      margin-top: var(--spacing-lg, 1.5rem);
      font-size: var(--font-size-sm, 0.875rem);
      color: var(--color-text-light, #6b7280);
    }
    
    .confidence-caveats ul {
      padding-left: var(--spacing-lg, 1.5rem);
      margin-top: var(--spacing-sm, 0.5rem);
    }
    
    .confidence-caveats li {
      margin-bottom: var(--spacing-xs, 0.25rem);
    }
    
    .confidence-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: var(--radius-full, 9999px);
      color: white;
      font-size: var(--font-size-sm, 0.875rem);
      font-weight: 500;
    }
    
    .confidence-meter {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm, 0.5rem);
    }
    
    .meter-label {
      font-size: var(--font-size-sm, 0.875rem);
      color: var(--color-text-light, #6b7280);
      min-width: 100px;
    }
    
    .meter-track {
      flex: 1;
      height: 8px;
      background: var(--color-border, #e5e7eb);
      border-radius: var(--radius-full, 9999px);
      overflow: hidden;
    }
    
    .meter-fill {
      height: 100%;
      border-radius: var(--radius-full, 9999px);
      transition: width 0.3s ease;
    }
    
    .meter-value {
      font-weight: 600;
      min-width: 50px;
      text-align: right;
    }
  `;
}
