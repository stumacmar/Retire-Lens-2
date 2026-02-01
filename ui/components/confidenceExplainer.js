/**
 * RetireLens 2 - Confidence Explainer Component
 * 
 * Provides plain-English explanations of Monte Carlo results.
 * Helps users understand what confidence scores mean in practical terms.
 * 
 * Key principle: No marketing language. Clear, defensible statements only.
 */

/**
 * Generate plain-English confidence explanation
 * 
 * @param {object} mcResult - Monte Carlo result object
 * @param {number} targetAge - Target age for success measurement (default: 90)
 * @returns {object} Confidence explanation with multiple components
 */
export function generateConfidenceExplanation(mcResult, targetAge = 90) {
  const successRate = mcResult.statistics.successRate;
  const successCount = Math.round(successRate * mcResult.iterations);
  const failureCount = mcResult.iterations - successCount;
  
  // Core explanation
  const coreExplanation = {
    percentage: (successRate * 100).toFixed(0),
    successCount,
    failureCount,
    iterations: mcResult.iterations,
    targetAge,
    
    // Plain English summary
    plainEnglish: generatePlainEnglishSummary(successRate, targetAge, mcResult.iterations),
    
    // Interpretation level
    level: getConfidenceLevel(successRate),
    
    // Action guidance
    guidance: getActionGuidance(successRate)
  };
  
  // Depletion age explanation (if applicable)
  let depletionExplanation = null;
  if (mcResult.statistics.depletionAge) {
    const depletion = mcResult.statistics.depletionAge;
    depletionExplanation = {
      count: depletion.count,
      earliest: depletion.earliest,
      median: depletion.median,
      latest: depletion.latest,
      plainEnglish: generateDepletionExplanation(depletion, failureCount)
    };
  }
  
  return {
    core: coreExplanation,
    depletion: depletionExplanation,
    caveats: getCaveats()
  };
}

/**
 * Generate plain English summary of confidence
 * 
 * @param {number} successRate - Success rate (0-1)
 * @param {number} targetAge - Target age
 * @param {number} iterations - Number of simulations
 * @returns {string} Plain English explanation
 */
function generatePlainEnglishSummary(successRate, targetAge, iterations) {
  const pct = Math.round(successRate * 100);
  
  if (pct >= 95) {
    return `In ${pct} out of 100 simulated market scenarios, your money lasts until age ${targetAge}. This is a very robust plan.`;
  } else if (pct >= 85) {
    return `In ${pct} out of 100 simulated market scenarios, your money lasts until age ${targetAge}. This is a robust plan with good probability of success.`;
  } else if (pct >= 70) {
    return `In ${pct} out of 100 simulated market scenarios, your money lasts until age ${targetAge}. There is moderate risk of shortfall - consider adjustments.`;
  } else if (pct >= 50) {
    return `In ${pct} out of 100 simulated market scenarios, your money lasts until age ${targetAge}. This plan has significant uncertainty - consider increasing savings or reducing spending.`;
  } else {
    return `In only ${pct} out of 100 simulated market scenarios does your money last until age ${targetAge}. This plan likely needs substantial changes.`;
  }
}

/**
 * Get confidence level classification
 * 
 * @param {number} successRate - Success rate (0-1)
 * @returns {object} Level classification with label and color
 */
function getConfidenceLevel(successRate) {
  if (successRate >= 0.95) {
    return {
      label: 'Very High',
      color: '#22c55e', // green
      emoji: '✅',
      description: 'Very robust - high probability of success'
    };
  } else if (successRate >= 0.85) {
    return {
      label: 'High',
      color: '#84cc16', // lime
      emoji: '✅',
      description: 'Robust - good probability of success'
    };
  } else if (successRate >= 0.70) {
    return {
      label: 'Moderate',
      color: '#f59e0b', // amber
      emoji: '⚠️',
      description: 'Moderate - some risk of shortfall'
    };
  } else if (successRate >= 0.50) {
    return {
      label: 'Low',
      color: '#f97316', // orange
      emoji: '⚠️',
      description: 'Uncertain - significant risk of not meeting goals'
    };
  } else {
    return {
      label: 'Very Low',
      color: '#ef4444', // red
      emoji: '❌',
      description: 'High risk - substantial probability of failure'
    };
  }
}

/**
 * Get action guidance based on confidence level
 * 
 * @param {number} successRate - Success rate (0-1)
 * @returns {string[]} Array of action suggestions
 */
function getActionGuidance(successRate) {
  if (successRate >= 0.85) {
    return [
      'Your plan appears sustainable under most market conditions.',
      'Consider reviewing annually as circumstances change.',
      'You may have room for increased spending or earlier retirement.'
    ];
  } else if (successRate >= 0.70) {
    return [
      'Your plan has moderate risk. Consider:',
      '• Increasing contributions by 10-20%',
      '• Delaying retirement by 1-2 years',
      '• Reducing target spending by 10-15%',
      'Any of these changes could significantly improve your confidence.'
    ];
  } else if (successRate >= 0.50) {
    return [
      'Your plan has significant risk. Recommended actions:',
      '• Increase contributions substantially',
      '• Consider delaying retirement by 3-5 years',
      '• Reduce target spending by 20%+',
      '• Explore part-time work in early retirement'
    ];
  } else {
    return [
      'Your plan needs substantial revision:',
      '• Current savings trajectory is unlikely to meet goals',
      '• Consider a comprehensive review with a financial adviser',
      '• Explore multiple levers: savings, retirement age, spending'
    ];
  }
}

/**
 * Generate depletion age explanation
 * 
 * @param {object} depletion - Depletion statistics
 * @param {number} failureCount - Number of failed simulations
 * @returns {string} Plain English explanation
 */
function generateDepletionExplanation(depletion, failureCount) {
  if (failureCount === 0) {
    return 'In all simulations, your money lasted to the target age.';
  }
  
  return `In the ${failureCount} scenarios where funds ran out, the earliest depletion was at age ${depletion.earliest}, ` +
         `the median was age ${Math.round(depletion.median)}, and the latest was age ${depletion.latest}.`;
}

/**
 * Get standard caveats for Monte Carlo results
 * 
 * @returns {string[]} Array of caveat statements
 */
function getCaveats() {
  return [
    'These projections assume returns follow a normal distribution; actual markets may be more volatile.',
    'Tax rules, State Pension age, and inflation may differ from assumptions.',
    'Past performance does not guarantee future results.',
    'This tool provides projections for planning purposes only - not financial advice.',
    'Consider consulting a regulated financial adviser for personalised guidance.'
  ];
}

/**
 * Render confidence explainer panel
 * 
 * @param {object} mcResult - Monte Carlo result object
 * @param {string} containerSelector - CSS selector for container
 * @param {number} targetAge - Target age (default: 90)
 */
export function renderConfidenceExplainer(mcResult, containerSelector, targetAge = 90) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  const explanation = generateConfidenceExplanation(mcResult, targetAge);
  const { core, depletion, caveats } = explanation;
  
  const html = `
    <div class="confidence-explainer">
      <div class="confidence-header">
        <span class="confidence-emoji">${core.level.emoji}</span>
        <div class="confidence-score" style="color: ${core.level.color}">
          <span class="score-value">${core.percentage}%</span>
          <span class="score-label">Confidence</span>
        </div>
      </div>
      
      <div class="confidence-summary">
        <p class="main-explanation">${core.plainEnglish}</p>
      </div>
      
      <div class="confidence-details">
        <div class="detail-item">
          <span class="detail-label">Simulations Run</span>
          <span class="detail-value">${core.iterations.toLocaleString()}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Successful Scenarios</span>
          <span class="detail-value">${core.successCount.toLocaleString()}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Scenarios with Shortfall</span>
          <span class="detail-value">${core.failureCount.toLocaleString()}</span>
        </div>
      </div>
      
      ${depletion ? `
        <div class="depletion-info">
          <h4>When Might Money Run Out?</h4>
          <p>${depletion.plainEnglish}</p>
        </div>
      ` : ''}
      
      <div class="confidence-guidance">
        <h4>What This Means</h4>
        <ul>
          ${core.guidance.map(g => `<li>${g}</li>`).join('')}
        </ul>
      </div>
      
      <details class="confidence-caveats">
        <summary>Important Notes</summary>
        <ul>
          ${caveats.map(c => `<li>${c}</li>`).join('')}
        </ul>
      </details>
    </div>
  `;
  
  container.innerHTML = html;
}

/**
 * Generate success definition text
 * 
 * @param {number} targetAge - Target age for success
 * @returns {string} Clear definition of success
 */
export function getSuccessDefinition(targetAge = 90) {
  return `Success is defined as: Portfolio value remains above £0 at age ${targetAge}. ` +
         `This means your investments and income sources can fund your target spending ` +
         `throughout retirement without running out of money before age ${targetAge}.`;
}
