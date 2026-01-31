/**
 * RetireLens 2 - Screen Navigation
 * 
 * Mobile-first one-question-per-screen flow.
 * Progressive disclosure of complexity.
 */

import { AppState, updateState, debugLog } from '../state.js';

// Screen definitions
export const SCREENS = {
  welcome: {
    id: 'welcome',
    title: 'Welcome',
    next: 'age',
    prev: null
  },
  age: {
    id: 'age',
    title: 'Your Age',
    next: 'retirement-age',
    prev: 'welcome'
  },
  'retirement-age': {
    id: 'retirement-age',
    title: 'Retirement Age',
    next: 'income-target',
    prev: 'age'
  },
  'income-target': {
    id: 'income-target',
    title: 'Target Income',
    next: 'pension-pot',
    prev: 'retirement-age'
  },
  'pension-pot': {
    id: 'pension-pot',
    title: 'Pension Savings',
    next: 'contributions',
    prev: 'income-target'
  },
  contributions: {
    id: 'contributions',
    title: 'Contributions',
    next: 'isa-savings',
    prev: 'pension-pot'
  },
  'isa-savings': {
    id: 'isa-savings',
    title: 'ISA Savings',
    next: 'state-pension',
    prev: 'contributions'
  },
  'state-pension': {
    id: 'state-pension',
    title: 'State Pension',
    next: 'review',
    prev: 'isa-savings'
  },
  review: {
    id: 'review',
    title: 'Review',
    next: 'results',
    prev: 'state-pension'
  },
  results: {
    id: 'results',
    title: 'Results',
    next: 'compare',
    prev: 'review'
  },
  compare: {
    id: 'compare',
    title: 'Compare Plans',
    next: null,
    prev: 'results'
  }
};

/**
 * Navigate to a specific screen
 */
export function showScreen(screenId) {
  const screen = SCREENS[screenId];
  if (!screen) {
    console.error(`Unknown screen: ${screenId}`);
    return;
  }
  
  debugLog('STATE', `Navigating to screen: ${screenId}`);
  
  // Hide all screens
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active');
    el.setAttribute('aria-hidden', 'true');
  });
  
  // Show target screen
  const screenEl = document.getElementById(`screen-${screenId}`);
  if (screenEl) {
    screenEl.classList.add('active');
    screenEl.setAttribute('aria-hidden', 'false');
    
    // Focus first input for accessibility
    const firstInput = screenEl.querySelector('input, select, button');
    if (firstInput) {
      firstInput.focus();
    }
  }
  
  // Update progress indicator
  updateProgress(screenId);
  
  // Update state
  updateState({ currentScreen: screenId });
}

/**
 * Navigate to next screen
 */
export function nextScreen() {
  const current = SCREENS[AppState.currentScreen];
  if (current && current.next) {
    showScreen(current.next);
  }
}

/**
 * Navigate to previous screen
 */
export function prevScreen() {
  const current = SCREENS[AppState.currentScreen];
  if (current && current.prev) {
    showScreen(current.prev);
  }
}

/**
 * Update progress indicator
 */
function updateProgress(currentScreenId) {
  const progressBar = document.getElementById('progress-bar');
  if (!progressBar) return;
  
  const screenIds = Object.keys(SCREENS);
  const currentIndex = screenIds.indexOf(currentScreenId);
  const progress = ((currentIndex + 1) / screenIds.length) * 100;
  
  progressBar.style.width = `${progress}%`;
  progressBar.setAttribute('aria-valuenow', progress);
}

/**
 * Initialize navigation
 */
export function initNavigation() {
  // Handle keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      nextScreen();
    }
  });
  
  // Show initial screen
  showScreen('welcome');
  
  debugLog('STATE', 'Navigation initialized');
}
