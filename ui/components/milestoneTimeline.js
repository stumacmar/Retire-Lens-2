/**
 * RetireLens 2 - Milestone Timeline Component
 * 
 * Visual timeline showing when each milestone occurs across retirement
 */

import { sortMilestonesByAge, getMilestoneCategories } from '../../engine/milestones.js';

/**
 * Renders a visual timeline of milestones
 * @param {Array} milestones - Array of milestone objects
 * @param {object} plan - The retirement plan
 * @returns {HTMLElement} The timeline element
 */
export function renderMilestoneTimeline(milestones, plan) {
  const container = document.createElement('div');
  container.className = 'milestone-timeline';

  if (!milestones || milestones.length === 0) {
    container.innerHTML = `
      <div class="timeline-empty">
        <p>No milestones to display. Add milestones to see them on the timeline.</p>
      </div>
    `;
    return container;
  }

  const sortedMilestones = sortMilestonesByAge(milestones);
  const categories = getMilestoneCategories();
  
  // Calculate timeline bounds
  const minAge = plan.retirementAge;
  const maxAge = Math.max(...sortedMilestones.map(m => m.age), minAge + 30);
  const ageRange = maxAge - minAge;

  // Create timeline header
  const header = document.createElement('div');
  header.className = 'timeline-header';
  header.innerHTML = `
    <h3>Milestone Timeline</h3>
    <p class="timeline-subtitle">Visual overview of your planned expenses across retirement</p>
  `;
  container.appendChild(header);

  // Create timeline visualization
  const timeline = document.createElement('div');
  timeline.className = 'timeline-visualization';

  // Age markers
  const ageMarkers = document.createElement('div');
  ageMarkers.className = 'age-markers';
  
  const step = ageRange > 40 ? 10 : 5;
  for (let age = minAge; age <= maxAge; age += step) {
    const marker = document.createElement('div');
    marker.className = 'age-marker';
    marker.style.left = `${((age - minAge) / ageRange) * 100}%`;
    marker.innerHTML = `<span class="age-label">${age}</span>`;
    ageMarkers.appendChild(marker);
  }
  timeline.appendChild(ageMarkers);

  // Timeline bar
  const timelineBar = document.createElement('div');
  timelineBar.className = 'timeline-bar';
  
  // Add milestone markers
  sortedMilestones.forEach((milestone, index) => {
    const position = ((milestone.age - minAge) / ageRange) * 100;
    const category = categories[milestone.category] || categories.other;
    
    const marker = document.createElement('div');
    marker.className = `milestone-marker priority-${milestone.priority}`;
    marker.style.left = `${position}%`;
    marker.setAttribute('data-milestone-id', milestone.id);
    
    marker.innerHTML = `
      <div class="marker-icon" title="${milestone.description}">${category.icon}</div>
      <div class="marker-line"></div>
    `;

    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'marker-tooltip';
    tooltip.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-icon">${category.icon}</span>
        <strong>${milestone.description}</strong>
      </div>
      <div class="tooltip-content">
        <div class="tooltip-row">
          <span>Age:</span>
          <span>${milestone.age}</span>
        </div>
        <div class="tooltip-row">
          <span>Amount:</span>
          <span>£${(milestone.amount / 1000).toFixed(1)}k</span>
        </div>
        <div class="tooltip-row">
          <span>Priority:</span>
          <span>${milestone.priority === 'essential' ? '⭐ Essential' : '💫 Nice-to-have'}</span>
        </div>
      </div>
    `;
    marker.appendChild(tooltip);

    // Show tooltip on hover
    marker.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block';
      // Position tooltip to avoid overflow
      const rect = marker.getBoundingClientRect();
      if (rect.left < 200) {
        tooltip.style.left = '0';
        tooltip.style.right = 'auto';
      } else if (window.innerWidth - rect.right < 200) {
        tooltip.style.right = '0';
        tooltip.style.left = 'auto';
      }
    });

    marker.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });

    timelineBar.appendChild(marker);
  });

  timeline.appendChild(timelineBar);
  container.appendChild(timeline);

  // Summary stats
  const stats = document.createElement('div');
  stats.className = 'timeline-stats';
  
  const totalCost = milestones.reduce((sum, m) => sum + m.amount, 0);
  const essentialCount = milestones.filter(m => m.priority === 'essential').length;
  const niceToHaveCount = milestones.length - essentialCount;

  stats.innerHTML = `
    <div class="stat-item">
      <span class="stat-value">${milestones.length}</span>
      <span class="stat-label">Total Milestones</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">£${(totalCost / 1000).toFixed(0)}k</span>
      <span class="stat-label">Total Cost</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${essentialCount}</span>
      <span class="stat-label">Essential</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${niceToHaveCount}</span>
      <span class="stat-label">Nice-to-have</span>
    </div>
  `;

  container.appendChild(stats);

  return container;
}

/**
 * Add milestone timeline styles
 */
export function addMilestoneTimelineStyles() {
  if (document.getElementById('milestone-timeline-styles')) return;

  const style = document.createElement('style');
  style.id = 'milestone-timeline-styles';
  style.textContent = `
    .milestone-timeline {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      margin: 1.5rem 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .timeline-header h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      color: #1f2937;
    }

    .timeline-subtitle {
      margin: 0 0 1.5rem 0;
      color: #6b7280;
      font-size: 0.9rem;
    }

    .timeline-visualization {
      position: relative;
      padding: 3rem 0 2rem 0;
      min-height: 120px;
    }

    .age-markers {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 100%;
      pointer-events: none;
    }

    .age-marker {
      position: absolute;
      top: 0;
      height: 100%;
      border-left: 1px dashed #d1d5db;
    }

    .age-label {
      position: absolute;
      top: -1.5rem;
      left: -1rem;
      font-size: 0.85rem;
      color: #6b7280;
      font-weight: 600;
    }

    .timeline-bar {
      position: relative;
      height: 8px;
      background: linear-gradient(90deg, #dbeafe 0%, #bfdbfe 100%);
      border-radius: 4px;
      margin-top: 2rem;
    }

    .milestone-marker {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      cursor: pointer;
      z-index: 10;
    }

    .marker-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: white;
      border: 3px solid #3b82f6;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    .milestone-marker.priority-essential .marker-icon {
      border-color: #f59e0b;
      background: #fffbeb;
    }

    .milestone-marker:hover .marker-icon {
      transform: scale(1.2);
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    }

    .marker-line {
      position: absolute;
      top: 100%;
      left: 50%;
      width: 2px;
      height: 20px;
      background: currentColor;
      transform: translateX(-50%);
    }

    .milestone-marker.priority-essential .marker-line {
      background: #f59e0b;
    }

    .milestone-marker:not(.priority-essential) .marker-line {
      background: #3b82f6;
    }

    .marker-tooltip {
      display: none;
      position: absolute;
      bottom: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%);
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.75rem;
      min-width: 200px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 100;
      pointer-events: none;
    }

    .marker-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: white;
    }

    .tooltip-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .tooltip-icon {
      font-size: 1.25rem;
    }

    .tooltip-header strong {
      color: #1f2937;
      font-size: 0.95rem;
    }

    .tooltip-content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .tooltip-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
    }

    .tooltip-row span:first-child {
      color: #6b7280;
    }

    .tooltip-row span:last-child {
      color: #1f2937;
      font-weight: 600;
    }

    .timeline-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e5e7eb;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 0.25rem;
    }

    .stat-label {
      font-size: 0.85rem;
      color: #6b7280;
    }

    .timeline-empty {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
      font-style: italic;
    }

    @media (max-width: 768px) {
      .milestone-timeline {
        padding: 1rem;
      }

      .timeline-visualization {
        padding: 2rem 0 1rem 0;
        overflow-x: auto;
      }

      .marker-tooltip {
        min-width: 160px;
        font-size: 0.85rem;
      }

      .timeline-stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `;

  document.head.appendChild(style);
}

// Auto-add styles when module loads
if (typeof document !== 'undefined') {
  addMilestoneTimelineStyles();
}
