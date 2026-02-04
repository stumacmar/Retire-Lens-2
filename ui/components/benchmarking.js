/**
 * RetireLens 2 - Benchmarking Component
 * 
 * Displays comparison visualizations against anonymized benchmark data
 */

import { generateBenchmarkAnalysis } from '../../engine/benchmarking.js';

/**
 * Renders the benchmarking panel
 * @param {object} plan - The retirement plan
 * @param {object} projection - Projection results
 * @param {object} options - Additional options (monteCarloResults, readinessScore)
 * @returns {HTMLElement} The benchmarking panel element
 */
export function renderBenchmarking(plan, projection, options = {}) {
  const container = document.createElement('div');
  container.className = 'benchmarking-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'benchmarking-header';
  header.innerHTML = `
    <h2>📊 How You Compare</h2>
    <p class="benchmarking-subtitle">Anonymous comparison with similar UK pension holders</p>
  `;
  container.appendChild(header);

  // Generate analysis
  const analysis = generateBenchmarkAnalysis(plan, projection, options);

  // Disclaimer
  const disclaimer = document.createElement('div');
  disclaimer.className = 'benchmark-disclaimer';
  disclaimer.innerHTML = `
    <div class="disclaimer-icon">ℹ️</div>
    <div class="disclaimer-text">
      <strong>Illustrative Data Only:</strong> These benchmarks are based on simulated data 
      representing typical UK pension holders. They do NOT contain any real user data. 
      Use as general guidance only.
    </div>
  `;
  container.appendChild(disclaimer);

  // Summary
  if (analysis.summary) {
    const summary = createSummarySection(analysis.summary);
    container.appendChild(summary);
  }

  // Comparisons
  const comparisons = document.createElement('div');
  comparisons.className = 'benchmark-comparisons';

  // Pot size comparison
  if (analysis.potSizeComparison) {
    const potCard = createComparisonCard(
      'Pension Pot Size',
      `Age ${analysis.potSizeComparison.cohort}`,
      analysis.potSizeComparison,
      value => `£${(value / 1000).toFixed(0)}k`
    );
    comparisons.appendChild(potCard);
  }

  // Income comparison
  if (analysis.incomeComparison) {
    const incomeCard = createComparisonCard(
      'Target Retirement Income',
      `Retiring at ${analysis.incomeComparison.cohort}`,
      analysis.incomeComparison,
      value => `£${(value / 1000).toFixed(0)}k/yr`
    );
    comparisons.appendChild(incomeCard);
  }

  // Success rate comparison
  if (analysis.successRateComparison) {
    const successCard = createComparisonCard(
      'Plan Success Rate',
      analysis.successRateComparison.categoryLabel,
      analysis.successRateComparison,
      value => `${value.toFixed(0)}%`
    );
    comparisons.appendChild(successCard);
  }

  // Readiness comparison
  if (analysis.readinessComparison) {
    const readinessCard = createComparisonCard(
      'Retirement Readiness',
      analysis.readinessComparison.cohortLabel,
      analysis.readinessComparison,
      value => `${value.toFixed(0)}%`
    );
    comparisons.appendChild(readinessCard);
  }

  // Contribution comparison
  if (analysis.contributionComparison) {
    const contribCard = createComparisonCard(
      'Contribution Rate',
      `Age ${analysis.contributionComparison.cohort}`,
      analysis.contributionComparison,
      value => `${(value * 100).toFixed(1)}%`
    );
    comparisons.appendChild(contribCard);
  }

  container.appendChild(comparisons);

  return container;
}

/**
 * Creates summary section
 */
function createSummarySection(summary) {
  const section = document.createElement('div');
  section.className = `benchmark-summary status-${summary.overallAssessment}`;

  const statusIcons = {
    'above-average': '🌟',
    'average': '✓',
    'below-average': '📊'
  };

  const statusLabels = {
    'above-average': 'Above Average',
    'average': 'Average',
    'below-average': 'Needs Attention'
  };

  section.innerHTML = `
    <div class="summary-header">
      <span class="summary-icon">${statusIcons[summary.overallAssessment]}</span>
      <h3>Overall Assessment: ${statusLabels[summary.overallAssessment]}</h3>
    </div>
    
    ${summary.strengths.length > 0 ? `
      <div class="summary-section">
        <h4>✅ Strengths</h4>
        <ul>
          ${summary.strengths.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    
    ${summary.improvementAreas.length > 0 ? `
      <div class="summary-section">
        <h4>📈 Areas for Improvement</h4>
        <ul>
          ${summary.improvementAreas.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;

  return section;
}

/**
 * Creates a comparison card with percentile visualization
 */
function createComparisonCard(title, cohort, comparison, formatter) {
  const card = document.createElement('div');
  card.className = `comparison-card status-${comparison.status}`;

  const percentile = comparison.percentile;
  const userValue = comparison.userValue;
  const benchmarks = comparison.benchmarks;

  card.innerHTML = `
    <div class="card-header">
      <h4>${title}</h4>
      <span class="cohort-label">${cohort}</span>
    </div>

    <div class="card-body">
      <div class="user-value">
        <span class="value-label">Your Value</span>
        <span class="value-number">${formatter(userValue)}</span>
        <span class="percentile-badge badge-${comparison.status}">
          ${percentile.toFixed(0)}th percentile
        </span>
      </div>

      <div class="percentile-bar">
        <div class="bar-fill" style="width: ${percentile}%"></div>
        <div class="bar-marker" style="left: ${percentile}%">
          <div class="marker-dot"></div>
          <div class="marker-label">You</div>
        </div>
      </div>

      <div class="benchmark-values">
        <div class="benchmark-item">
          <span class="benchmark-label">25th</span>
          <span class="benchmark-value">${formatter(benchmarks.percentile25)}</span>
        </div>
        <div class="benchmark-item">
          <span class="benchmark-label">Median</span>
          <span class="benchmark-value">${formatter(benchmarks.median)}</span>
        </div>
        <div class="benchmark-item">
          <span class="benchmark-label">75th</span>
          <span class="benchmark-value">${formatter(benchmarks.percentile75)}</span>
        </div>
      </div>

      <div class="comparison-text">
        <strong>${comparison.comparison}</strong> compared to similar pension holders
      </div>
    </div>
  `;

  return card;
}

/**
 * Add benchmarking styles
 */
export function addBenchmarkingStyles() {
  if (document.getElementById('benchmarking-styles')) return;

  const style = document.createElement('style');
  style.id = 'benchmarking-styles';
  style.textContent = `
    .benchmarking-panel {
      padding: 1.5rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin: 2rem 0;
    }

    .benchmarking-header h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.75rem;
      color: #1f2937;
    }

    .benchmarking-subtitle {
      margin: 0 0 1.5rem 0;
      color: #6b7280;
      font-size: 0.95rem;
    }

    .benchmark-disclaimer {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }

    .disclaimer-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .disclaimer-text strong {
      color: #92400e;
    }

    .benchmark-summary {
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      border: 2px solid #e5e7eb;
    }

    .benchmark-summary.status-above-average {
      background: #f0fdf4;
      border-color: #10b981;
    }

    .benchmark-summary.status-average {
      background: #f0f9ff;
      border-color: #3b82f6;
    }

    .benchmark-summary.status-below-average {
      background: #fef2f2;
      border-color: #ef4444;
    }

    .summary-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .summary-icon {
      font-size: 1.5rem;
    }

    .summary-header h3 {
      margin: 0;
      font-size: 1.2rem;
      color: #1f2937;
    }

    .summary-section {
      margin-top: 1rem;
    }

    .summary-section h4 {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
      color: #374151;
    }

    .summary-section ul {
      margin: 0;
      padding-left: 1.5rem;
    }

    .summary-section li {
      color: #4b5563;
      font-size: 0.9rem;
      line-height: 1.6;
    }

    .benchmark-comparisons {
      display: grid;
      gap: 1.5rem;
    }

    .comparison-card {
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 1.5rem;
      transition: all 0.2s;
    }

    .comparison-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .comparison-card.status-excellent {
      border-color: #10b981;
    }

    .comparison-card.status-good {
      border-color: #3b82f6;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .card-header h4 {
      margin: 0;
      font-size: 1.1rem;
      color: #1f2937;
    }

    .cohort-label {
      padding: 0.25rem 0.75rem;
      background: #f3f4f6;
      border-radius: 12px;
      font-size: 0.85rem;
      color: #6b7280;
      font-weight: 600;
    }

    .user-value {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .value-label {
      font-size: 0.85rem;
      color: #6b7280;
      margin-bottom: 0.25rem;
    }

    .value-number {
      font-size: 2rem;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 0.5rem;
    }

    .percentile-badge {
      padding: 0.375rem 0.875rem;
      border-radius: 16px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .badge-excellent {
      background: #d1fae5;
      color: #065f46;
    }

    .badge-good {
      background: #dbeafe;
      color: #1e40af;
    }

    .badge-average {
      background: #fef3c7;
      color: #92400e;
    }

    .badge-fair,
    .badge-needs-improvement {
      background: #fee2e2;
      color: #991b1b;
    }

    .percentile-bar {
      position: relative;
      height: 40px;
      background: linear-gradient(90deg, 
        #fee2e2 0%, 
        #fef3c7 25%, 
        #dbeafe 50%, 
        #bfdbfe 75%, 
        #d1fae5 100%
      );
      border-radius: 20px;
      margin-bottom: 1rem;
      overflow: visible;
    }

    .bar-marker {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
    }

    .marker-dot {
      width: 16px;
      height: 16px;
      background: #1f2937;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    .marker-label {
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      background: #1f2937;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .marker-label::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 4px solid transparent;
      border-top-color: #1f2937;
    }

    .benchmark-values {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
    }

    .benchmark-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .benchmark-label {
      font-size: 0.8rem;
      color: #6b7280;
      margin-bottom: 0.25rem;
    }

    .benchmark-value {
      font-size: 1.1rem;
      font-weight: 600;
      color: #1f2937;
    }

    .comparison-text {
      text-align: center;
      color: #4b5563;
      font-size: 0.95rem;
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 6px;
    }

    @media (max-width: 768px) {
      .benchmarking-panel {
        padding: 1rem;
      }

      .value-number {
        font-size: 1.5rem;
      }

      .benchmark-values {
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }

      .marker-label {
        font-size: 0.7rem;
        padding: 0.2rem 0.4rem;
      }
    }
  `;

  document.head.appendChild(style);
}

// Auto-add styles when module loads
if (typeof document !== 'undefined') {
  addBenchmarkingStyles();
}
