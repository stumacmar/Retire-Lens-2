/**
 * RetireLens 2 - Readiness Gauge Component
 * 
 * Visual gauge component showing retirement readiness score
 * with color gradient and action items
 */

import { calculateReadinessScore, generateActionPlan } from '../../engine/readinessScore.js';

/**
 * Format currency for display
 */
function formatCurrency(value) {
  if (value >= 1000000) {
    return '£' + (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return '£' + Math.round(value / 1000) + 'k';
  }
  return '£' + Math.round(value);
}

/**
 * Render readiness gauge
 * 
 * @param {number} score - Readiness score (0-100)
 * @param {string} level - Readiness level
 * @param {string} color - Color for gauge
 * @param {string} containerId - Container element ID
 * @returns {HTMLElement} Gauge element
 */
export function renderReadinessGauge(score, level, color, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Container not found:', containerId);
    return null;
  }
  
  // Calculate gauge rotation (180 degrees for half circle)
  const rotation = (score / 100) * 180;
  
  container.innerHTML = `
    <div style="text-align: center; padding: 24px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h3 style="margin: 0 0 20px 0; font-size: 18px; color: #1f2937;">Retirement Readiness</h3>
      
      <!-- Semi-circular gauge -->
      <div style="position: relative; width: 240px; height: 120px; margin: 0 auto;">
        <!-- Background arc -->
        <svg width="240" height="120" viewBox="0 0 240 120">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#dc2626;stop-opacity:1" />
              <stop offset="25%" style="stop-color:#ef4444;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#f59e0b;stop-opacity:1" />
              <stop offset="75%" style="stop-color:#3b82f6;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#22c55e;stop-opacity:1" />
            </linearGradient>
          </defs>
          
          <!-- Background arc -->
          <path 
            d="M 20 120 A 100 100 0 0 1 220 120" 
            fill="none" 
            stroke="#e5e7eb" 
            stroke-width="20"
            stroke-linecap="round"
          />
          
          <!-- Progress arc -->
          <path 
            d="M 20 120 A 100 100 0 0 1 220 120" 
            fill="none" 
            stroke="url(#gaugeGradient)" 
            stroke-width="20"
            stroke-linecap="round"
            stroke-dasharray="${Math.PI * 100}"
            stroke-dashoffset="${Math.PI * 100 * (1 - score / 100)}"
            style="transition: stroke-dashoffset 1.5s ease-out;"
          />
        </svg>
        
        <!-- Needle -->
        <div style="
          position: absolute;
          bottom: 10px;
          left: 50%;
          width: 2px;
          height: 80px;
          background: #1f2937;
          transform-origin: bottom center;
          transform: translateX(-50%) rotate(${rotation - 90}deg);
          transition: transform 1.5s ease-out;
        ">
          <div style="
            width: 12px;
            height: 12px;
            background: #1f2937;
            border-radius: 50%;
            position: absolute;
            bottom: -6px;
            left: 50%;
            transform: translateX(-50%);
          "></div>
        </div>
        
        <!-- Center score -->
        <div style="position: absolute; bottom: 10px; left: 0; right: 0; text-align: center;">
          <div style="font-size: 40px; font-weight: bold; color: ${color};">${score}</div>
          <div style="font-size: 14px; color: #6b7280; margin-top: -4px;">out of 100</div>
        </div>
      </div>
      
      <!-- Level indicator -->
      <div style="margin-top: 20px; padding: 12px 24px; background: ${color}15; border-radius: 8px; display: inline-block;">
        <div style="font-size: 20px; font-weight: 600; color: ${color};">${level}</div>
      </div>
      
      <!-- Scale labels -->
      <div style="display: flex; justify-content: space-between; margin-top: 16px; padding: 0 20px; font-size: 12px; color: #6b7280;">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
    </div>
  `;
  
  return container;
}

/**
 * Render readiness breakdown
 * 
 * @param {object} readinessScore - Readiness score object
 * @param {string} containerId - Container element ID
 * @returns {HTMLElement} Breakdown element
 */
export function renderReadinessBreakdown(readinessScore, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Container not found:', containerId);
    return null;
  }
  
  const { breakdown } = readinessScore;
  
  const components = [
    {
      name: 'Savings Rate',
      data: breakdown.savingsRate,
      icon: '💰'
    },
    {
      name: 'Time to Retirement',
      data: breakdown.timeToRetirement,
      icon: '⏰'
    },
    {
      name: 'Portfolio Adequacy',
      data: breakdown.portfolioAdequacy,
      icon: '📊'
    },
    {
      name: 'Sustainability',
      data: breakdown.sustainability,
      icon: '🎯'
    },
    {
      name: 'Tax Efficiency',
      data: breakdown.taxEfficiency,
      icon: '💡'
    }
  ];
  
  container.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h3 style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937;">Score Breakdown</h3>
      
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${components.map(comp => {
          const percentage = (comp.data.score / comp.data.maxScore) * 100;
          let barColor;
          if (percentage >= 80) barColor = '#22c55e';
          else if (percentage >= 60) barColor = '#3b82f6';
          else if (percentage >= 40) barColor = '#f59e0b';
          else barColor = '#ef4444';
          
          return `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 20px;">${comp.icon}</span>
                  <span style="font-size: 14px; font-weight: 500; color: #1f2937;">${comp.name}</span>
                </div>
                <span style="font-size: 14px; font-weight: 600; color: #1f2937;">
                  ${comp.data.score}/${comp.data.maxScore}
                </span>
              </div>
              <div style="height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                <div style="
                  height: 100%;
                  background: ${barColor};
                  width: ${percentage}%;
                  transition: width 1s ease-out;
                "></div>
              </div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                ${comp.data.description}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  return container;
}

/**
 * Render action plan with top recommendations
 * 
 * @param {array} actions - Array of action items
 * @param {number} limit - Maximum number of actions to show
 * @param {string} containerId - Container element ID
 * @returns {HTMLElement} Action plan element
 */
export function renderActionPlan(actions, limit = 3, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Container not found:', containerId);
    return null;
  }
  
  const topActions = actions.slice(0, limit);
  
  if (topActions.length === 0) {
    container.innerHTML = `
      <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">Action Plan</h3>
        <div style="padding: 16px; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px;">
          <p style="margin: 0; color: #166534; font-weight: 500;">✓ No immediate actions needed</p>
          <p style="margin: 8px 0 0 0; color: #15803d; font-size: 14px;">
            Your retirement plan is on track. Keep monitoring your progress annually.
          </p>
        </div>
      </div>
    `;
    return container;
  }
  
  const impactColors = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#3b82f6'
  };
  
  const impactLabels = {
    high: 'High Impact',
    medium: 'Medium Impact',
    low: 'Low Impact'
  };
  
  container.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">
        Top ${topActions.length} Recommended Actions
      </h3>
      
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${topActions.map((action, index) => {
          const impactColor = impactColors[action.impact] || '#6b7280';
          
          return `
            <div style="
              padding: 16px;
              background: #f9fafb;
              border-left: 4px solid ${impactColor};
              border-radius: 4px;
            ">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="
                    width: 24px;
                    height: 24px;
                    background: ${impactColor};
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                  ">
                    ${index + 1}
                  </div>
                  <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: #1f2937;">
                    ${action.category}
                  </h4>
                </div>
                <span style="
                  padding: 2px 8px;
                  background: ${impactColor};
                  color: white;
                  border-radius: 12px;
                  font-size: 11px;
                  font-weight: 500;
                  white-space: nowrap;
                ">
                  ${impactLabels[action.impact]}
                </span>
              </div>
              
              <p style="margin: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">
                ${action.action}
              </p>
              
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 13px;">
                <em>${action.reason}</em>
              </p>
            </div>
          `;
        }).join('')}
      </div>
      
      ${actions.length > limit ? `
        <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 13px; text-align: center;">
          +${actions.length - limit} more recommendations available
        </p>
      ` : ''}
    </div>
  `;
  
  return container;
}

/**
 * Create complete readiness dashboard
 * 
 * @param {object} projectionData - Projection data
 * @param {object} inputs - User inputs
 * @param {string} containerId - Container element ID
 * @returns {HTMLElement} Dashboard element
 */
export function createReadinessDashboard(projectionData, inputs, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Container not found:', containerId);
    return null;
  }
  
  // Calculate readiness score
  const readinessScore = calculateReadinessScore(projectionData, inputs);
  const actions = generateActionPlan(readinessScore);
  
  container.innerHTML = `
    <div style="padding: 20px; background: #f9fafb;">
      <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #1f2937;">Retirement Readiness</h2>
      <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">
        ${readinessScore.readinessMessage}
      </p>
      
      <!-- Main gauge and key metrics -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div id="${containerId}-gauge"></div>
        
        <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">Key Metrics</h3>
          
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Current Pot</div>
              <div style="font-size: 20px; font-weight: 600; color: #1f2937;">
                ${formatCurrency(readinessScore.metrics.currentPot)}
              </div>
            </div>
            
            <div>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Projected at Retirement</div>
              <div style="font-size: 20px; font-weight: 600; color: #3b82f6;">
                ${formatCurrency(readinessScore.metrics.projectedPot)}
              </div>
            </div>
            
            <div>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Target Required</div>
              <div style="font-size: 20px; font-weight: 600; color: #6b7280;">
                ${formatCurrency(readinessScore.metrics.requiredPot)}
              </div>
            </div>
            
            ${readinessScore.metrics.shortfall > 0 ? `
              <div style="padding: 12px; background: #fef2f2; border-radius: 4px; border: 1px solid #fee2e2;">
                <div style="font-size: 12px; color: #991b1b; margin-bottom: 4px;">Shortfall</div>
                <div style="font-size: 18px; font-weight: 600; color: #dc2626;">
                  ${formatCurrency(readinessScore.metrics.shortfall)}
                </div>
              </div>
            ` : `
              <div style="padding: 12px; background: #f0fdf4; border-radius: 4px; border: 1px solid #dcfce7;">
                <div style="font-size: 12px; color: #166534; margin-bottom: 4px;">On Track</div>
                <div style="font-size: 14px; font-weight: 500; color: #15803d;">
                  ${Math.round(readinessScore.metrics.percentOfTarget)}% of target
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
      
      <!-- Breakdown -->
      <div style="margin-bottom: 16px;">
        <div id="${containerId}-breakdown"></div>
      </div>
      
      <!-- Action plan -->
      <div id="${containerId}-actions"></div>
    </div>
  `;
  
  // Render components
  renderReadinessGauge(
    readinessScore.totalScore,
    readinessScore.readinessLevel,
    readinessScore.readinessColor,
    `${containerId}-gauge`
  );
  
  renderReadinessBreakdown(readinessScore, `${containerId}-breakdown`);
  renderActionPlan(actions, 3, `${containerId}-actions`);
  
  return container;
}
