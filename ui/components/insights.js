/**
 * RetireLens 2 - Insights Component
 * 
 * Displays AI-generated insights as expandable cards with detailed explanations
 */

import { generateInsights, getCategoryMetadata } from '../../engine/insightsEngine.js';

/**
 * Renders the insights panel
 * @param {object} plan - The retirement plan
 * @param {object} projection - Projection results
 * @param {object} options - Additional options (monteCarloResults, readinessScore)
 * @returns {HTMLElement} The insights panel element
 */
export function renderInsights(plan, projection, options = {}) {
  const container = document.createElement('div');
  container.className = 'insights-panel';
  container.innerHTML = `
    <div class="insights-header">
      <h2>🧠 AI-Powered Insights</h2>
      <p class="insights-subtitle">Personalized analysis of your retirement plan</p>
    </div>
    <div id="insights-content" class="insights-content"></div>
  `;

  // Generate insights
  const insights = generateInsights(plan, projection, options);
  const contentDiv = container.querySelector('#insights-content');

  if (insights.length === 0) {
    contentDiv.innerHTML = '<p class="no-insights">No insights available. Complete your plan details to see personalized recommendations.</p>';
    return container;
  }

  // Group insights by category
  const categoryMetadata = getCategoryMetadata();
  const grouped = groupByCategory(insights);

  // Render each category
  Object.entries(grouped).forEach(([category, items]) => {
    if (items.length === 0) return;

    const meta = categoryMetadata[category];
    const categorySection = createCategorySection(category, meta, items);
    contentDiv.appendChild(categorySection);
  });

  return container;
}

/**
 * Group insights by category
 */
function groupByCategory(insights) {
  return {
    risks: insights.filter(i => i.category === 'risks'),
    opportunities: insights.filter(i => i.category === 'opportunities'),
    strengths: insights.filter(i => i.category === 'strengths'),
    suggestions: insights.filter(i => i.category === 'suggestions')
  };
}

/**
 * Create a category section with insights
 */
function createCategorySection(category, metadata, insights) {
  const section = document.createElement('div');
  section.className = `insights-category category-${category}`;
  
  const header = document.createElement('div');
  header.className = 'category-header';
  header.style.borderLeftColor = metadata.color;
  header.innerHTML = `
    <span class="category-icon">${metadata.icon}</span>
    <div class="category-info">
      <h3>${metadata.label}</h3>
      <p class="category-description">${metadata.description}</p>
    </div>
    <span class="category-count">${insights.length}</span>
  `;
  
  section.appendChild(header);

  // Create insight cards
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'insights-cards';

  insights.forEach(insight => {
    const card = createInsightCard(insight, metadata);
    cardsContainer.appendChild(card);
  });

  section.appendChild(cardsContainer);
  return section;
}

/**
 * Create an insight card
 */
function createInsightCard(insight, metadata) {
  const card = document.createElement('div');
  card.className = `insight-card impact-${insight.impact}`;
  
  card.innerHTML = `
    <div class="insight-header">
      <div class="insight-title-row">
        <span class="insight-icon">${insight.icon}</span>
        <h4 class="insight-title">${insight.title}</h4>
        <span class="impact-badge badge-${insight.impact}">${insight.impact.toUpperCase()}</span>
      </div>
      <button class="expand-btn" aria-label="Expand insight">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="insight-description">
      <p>${insight.description}</p>
    </div>
    <div class="insight-detail" style="display: none;">
      <div class="detail-content">
        <p>${insight.detail}</p>
      </div>
    </div>
  `;

  // Add expand/collapse functionality
  const expandBtn = card.querySelector('.expand-btn');
  const detailDiv = card.querySelector('.insight-detail');

  expandBtn.addEventListener('click', () => {
    const isExpanded = detailDiv.style.display !== 'none';
    detailDiv.style.display = isExpanded ? 'none' : 'block';
    expandBtn.classList.toggle('expanded', !isExpanded);
    card.classList.toggle('expanded', !isExpanded);
  });

  return card;
}

/**
 * Add insights styles to document
 */
export function addInsightsStyles() {
  if (document.getElementById('insights-styles')) return;

  const style = document.createElement('style');
  style.id = 'insights-styles';
  style.textContent = `
    .insights-panel {
      margin: 2rem 0;
      padding: 1.5rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .insights-header {
      margin-bottom: 1.5rem;
    }

    .insights-header h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.75rem;
      color: #1f2937;
    }

    .insights-subtitle {
      margin: 0;
      color: #6b7280;
      font-size: 0.95rem;
    }

    .insights-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .insights-category {
      border-radius: 8px;
      overflow: hidden;
    }

    .category-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: #f9fafb;
      border-left: 4px solid #3b82f6;
    }

    .category-icon {
      font-size: 1.5rem;
    }

    .category-info {
      flex: 1;
    }

    .category-info h3 {
      margin: 0 0 0.25rem 0;
      font-size: 1.1rem;
      color: #1f2937;
    }

    .category-description {
      margin: 0;
      font-size: 0.85rem;
      color: #6b7280;
    }

    .category-count {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      padding: 0 8px;
      background: white;
      border-radius: 14px;
      font-weight: 600;
      font-size: 0.85rem;
      color: #6b7280;
    }

    .insights-cards {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
    }

    .insight-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .insight-card:hover {
      border-color: #d1d5db;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .insight-card.expanded {
      border-color: #3b82f6;
    }

    .insight-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }

    .insight-title-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
    }

    .insight-icon {
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .insight-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #1f2937;
      flex: 1;
    }

    .impact-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      flex-shrink: 0;
    }

    .badge-high {
      background: #fee2e2;
      color: #991b1b;
    }

    .badge-medium {
      background: #fef3c7;
      color: #92400e;
    }

    .badge-low {
      background: #dbeafe;
      color: #1e40af;
    }

    .expand-btn {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: #6b7280;
      transition: transform 0.2s ease;
      flex-shrink: 0;
    }

    .expand-btn:hover {
      color: #3b82f6;
    }

    .expand-btn.expanded {
      transform: rotate(180deg);
    }

    .insight-description {
      margin-bottom: 0;
    }

    .insight-description p {
      margin: 0;
      color: #4b5563;
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .insight-detail {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid #e5e7eb;
    }

    .detail-content {
      background: #f9fafb;
      padding: 0.75rem;
      border-radius: 6px;
    }

    .detail-content p {
      margin: 0;
      color: #374151;
      font-size: 0.9rem;
      line-height: 1.6;
    }

    .no-insights {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
      font-style: italic;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .insights-panel {
        padding: 1rem;
      }

      .insights-header h2 {
        font-size: 1.5rem;
      }

      .category-header {
        padding: 0.75rem;
      }

      .insights-cards {
        padding: 0.75rem;
      }

      .insight-card {
        padding: 0.875rem;
      }

      .insight-title {
        font-size: 0.95rem;
      }

      .impact-badge {
        font-size: 0.65rem;
        padding: 0.2rem 0.4rem;
      }
    }
  `;

  document.head.appendChild(style);
}

// Auto-add styles when module loads
if (typeof document !== 'undefined') {
  addInsightsStyles();
}
