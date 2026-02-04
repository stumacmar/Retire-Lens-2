/**
 * RetireLens Pro - Bottom Ticker Component
 * 
 * Progressive disclosure UX feature that:
 * - Builds excitement and reinforces progress
 * - Shows "what we know so far"
 * - Indicates why missing data matters
 * - Fixed at bottom of screen (mobile-safe)
 * 
 * NEVER shows:
 * - Confidence percentages
 * - Withdrawal rates
 * - Sustainability verdicts
 * 
 * It is a NARRATIVE device, not a calculator.
 */

import { HOUSEHOLD_TYPES, PENSION_TYPES, PLAN_STATUS } from '../../engine/householdPlan.js';

/**
 * Generate ticker messages based on current state
 * Messages should be encouraging and clear about what's known/needed
 * 
 * @param {object} state - Current onboarding/plan state
 * @returns {object} { messages: string[], status: string, isComplete: boolean }
 */
export function generateTickerMessages(state) {
  const messages = [];
  let allComplete = true;

  // === HOUSEHOLD TYPE ===
  if (!state.householdType) {
    messages.push('Start by telling us who you\'re planning for…');
    allComplete = false;
  } else if (state.householdType === HOUSEHOLD_TYPES.COUPLE) {
    messages.push('Planning for a couple ✔');
  } else {
    messages.push('Planning for individual ✔');
  }

  // === PENSION TYPES ===
  const personATypes = state.personA?.pensionTypes || [];
  const personBTypes = state.personB?.pensionTypes || [];

  if (personATypes.length === 0 && state.householdType) {
    messages.push('Your pension type needed…');
    allComplete = false;
  } else if (personATypes.length > 0) {
    const typeLabel = getPensionTypeLabel(personATypes);
    if (personATypes.includes(PENSION_TYPES.NOT_SURE)) {
      messages.push('Your pension type: uncertain (provisional)');
    } else {
      messages.push(`Your pension: ${typeLabel} ✔`);
    }
  }

  if (state.householdType === HOUSEHOLD_TYPES.COUPLE) {
    if (personBTypes.length === 0) {
      messages.push('Partner pension type needed…');
      allComplete = false;
    } else {
      const typeLabel = getPensionTypeLabel(personBTypes);
      if (personBTypes.includes(PENSION_TYPES.NOT_SURE)) {
        messages.push('Partner pension type: uncertain (provisional)');
      } else {
        messages.push(`Partner pension: ${typeLabel} ✔`);
      }
    }
  }

  // === AGES ===
  if (state.personA?.currentAge) {
    messages.push(`Your age: ${state.personA.currentAge} ✔`);
  } else if (state.householdType && personATypes.length > 0) {
    messages.push('Your current age needed…');
    allComplete = false;
  }

  if (state.householdType === HOUSEHOLD_TYPES.COUPLE) {
    if (state.personB?.currentAge) {
      messages.push(`Partner age: ${state.personB.currentAge} ✔`);
    } else if (personBTypes.length > 0) {
      messages.push('Partner age needed…');
      allComplete = false;
    }
  }

  // === RETIREMENT AGES ===
  if (state.personA?.retirementAge) {
    messages.push(`Your retirement target: age ${state.personA.retirementAge} ✔`);
  }

  if (state.householdType === HOUSEHOLD_TYPES.COUPLE && state.personB?.retirementAge) {
    messages.push(`Partner retirement target: age ${state.personB.retirementAge} ✔`);
  }

  // === TARGET INCOME ===
  if (state.targetNetIncome > 0) {
    messages.push(`Target: £${state.targetNetIncome.toLocaleString()}/year net ✔`);
  } else if (state.personA?.retirementAge) {
    messages.push('Household income target needed…');
    allComplete = false;
  }

  // === DC PENSION DETAILS ===
  const personAHasDC = personATypes.includes(PENSION_TYPES.DC) || personATypes.includes(PENSION_TYPES.BOTH);
  const personBHasDC = personBTypes.includes(PENSION_TYPES.DC) || personBTypes.includes(PENSION_TYPES.BOTH);

  if (personAHasDC) {
    if (state.personA?.dcPot !== null && state.personA?.dcPot !== undefined) {
      messages.push(`Your DC pot: £${(state.personA.dcPot || 0).toLocaleString()} ✔`);
    } else if (state.targetNetIncome > 0) {
      messages.push('Your DC pension pot needed…');
      allComplete = false;
    }
  }

  if (state.householdType === HOUSEHOLD_TYPES.COUPLE && personBHasDC) {
    if (state.personB?.dcPot !== null && state.personB?.dcPot !== undefined) {
      messages.push(`Partner DC pot: £${(state.personB.dcPot || 0).toLocaleString()} ✔`);
    } else if (state.targetNetIncome > 0) {
      messages.push('Partner DC pension pot needed…');
      allComplete = false;
    }
  }

  // === DB PENSION DETAILS ===
  const personAHasDB = personATypes.includes(PENSION_TYPES.DB) || personATypes.includes(PENSION_TYPES.BOTH);
  const personBHasDB = personBTypes.includes(PENSION_TYPES.DB) || personBTypes.includes(PENSION_TYPES.BOTH);

  if (personAHasDB) {
    if (state.personA?.dbAnnualIncome > 0) {
      messages.push(`Guaranteed income: £${state.personA.dbAnnualIncome.toLocaleString()}/year from age ${state.personA.dbStartAge} ✔`);
    } else if (state.targetNetIncome > 0) {
      messages.push('DB pension details needed…');
      allComplete = false;
    }
  }

  if (state.householdType === HOUSEHOLD_TYPES.COUPLE && personBHasDB) {
    if (state.personB?.dbAnnualIncome > 0) {
      messages.push(`Partner guaranteed income: £${state.personB.dbAnnualIncome.toLocaleString()}/year ✔`);
    } else if (state.targetNetIncome > 0) {
      messages.push('Partner DB pension details needed…');
      allComplete = false;
    }
  }

  // === STATE PENSION ===
  if (state.personA?.expectedStatePension > 0 && state.personA?.statePensionAge) {
    messages.push(`State Pension: age ${state.personA.statePensionAge} ✔`);
  }

  if (state.householdType === HOUSEHOLD_TYPES.COUPLE && 
      state.personB?.expectedStatePension > 0 && 
      state.personB?.statePensionAge) {
    messages.push(`Partner State Pension: age ${state.personB.statePensionAge} ✔`);
  }

  // === SPECIAL MESSAGES ===
  // Early retirement bridge detection
  if (state.personA?.retirementAge && state.personA?.statePensionAge) {
    const gapYears = state.personA.statePensionAge - state.personA.retirementAge;
    if (gapYears > 0) {
      messages.push(`Early retirement bridge: ${gapYears} year${gapYears > 1 ? 's' : ''} identified`);
    }
  }

  // === FINAL STATUS MESSAGE ===
  const hasUnsure = personATypes.includes(PENSION_TYPES.NOT_SURE) || 
                    personBTypes.includes(PENSION_TYPES.NOT_SURE);

  let status = PLAN_STATUS.COMPLETE;
  if (!allComplete) {
    status = PLAN_STATUS.INCOMPLETE;
  } else if (hasUnsure) {
    status = PLAN_STATUS.PROVISIONAL;
    messages.push('Provisional plan — some details uncertain');
  }

  if (allComplete && !hasUnsure) {
    messages.push('Household model complete ✔ Ready to project');
  }

  return {
    messages,
    status,
    isComplete: allComplete,
    canProject: allComplete
  };
}

/**
 * Get human-readable pension type label
 */
function getPensionTypeLabel(types) {
  if (types.includes(PENSION_TYPES.BOTH)) {
    return 'DC + DB';
  }
  const labels = [];
  if (types.includes(PENSION_TYPES.DC)) labels.push('DC');
  if (types.includes(PENSION_TYPES.DB)) labels.push('DB');
  if (types.includes(PENSION_TYPES.NOT_SURE)) labels.push('type uncertain');
  return labels.join(' + ') || 'unknown';
}

/**
 * Format ticker message for display
 * Returns the most recent/relevant messages for compact display
 */
export function formatTickerDisplay(messages, maxMessages = 3) {
  // Prioritize: incomplete items first, then complete items, then status
  const waiting = messages.filter(m => m.includes('needed') || m.includes('Start'));
  const complete = messages.filter(m => m.includes('✔') && !m.includes('Ready'));
  const status = messages.filter(m => m.includes('Ready') || m.includes('Provisional'));

  // Show waiting items first (up to 2), then most recent complete, then status
  const display = [];
  
  if (waiting.length > 0) {
    display.push(...waiting.slice(0, 2));
  }
  
  if (display.length < maxMessages && complete.length > 0) {
    display.push(...complete.slice(-Math.min(maxMessages - display.length, 2)));
  }
  
  if (display.length < maxMessages && status.length > 0) {
    display.push(...status.slice(0, 1));
  }

  return display;
}

/**
 * CSS classes for ticker styling
 */
export const TICKER_STYLES = {
  container: 'fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 safe-area-inset-bottom',
  inner: 'max-w-lg mx-auto px-4 py-3',
  message: 'text-sm text-gray-700',
  messageComplete: 'text-sm text-green-700',
  messageWaiting: 'text-sm text-amber-600',
  statusComplete: 'text-sm font-medium text-green-600',
  statusIncomplete: 'text-sm font-medium text-amber-600',
  statusProvisional: 'text-sm font-medium text-blue-600'
};

/**
 * Get appropriate style class for a message
 */
export function getMessageStyle(message) {
  if (message.includes('✔')) {
    return TICKER_STYLES.messageComplete;
  }
  if (message.includes('needed') || message.includes('…')) {
    return TICKER_STYLES.messageWaiting;
  }
  return TICKER_STYLES.message;
}

/**
 * Generate HTML for ticker (for vanilla JS use)
 */
export function generateTickerHTML(state) {
  const { messages, status, isComplete } = generateTickerMessages(state);
  const displayMessages = formatTickerDisplay(messages);
  
  const statusClass = isComplete 
    ? TICKER_STYLES.statusComplete 
    : TICKER_STYLES.statusIncomplete;

  let html = `<div class="${TICKER_STYLES.container}">`;
  html += `<div class="${TICKER_STYLES.inner}">`;
  
  for (const msg of displayMessages) {
    const msgClass = getMessageStyle(msg);
    html += `<div class="${msgClass}">${escapeHtml(msg)}</div>`;
  }
  
  html += '</div></div>';
  
  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }
  // Fallback for Node.js
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
