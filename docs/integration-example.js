/**
 * RetireLens 2 - Integration Example
 * 
 * This file demonstrates how to integrate all Phase 1 premium features
 */

// Import all feature modules
import { initAccessibility, announceToScreenReader } from './ui/components/accessibility.js';
import { initDashboard } from './ui/components/dashboard.js';
import { initLiveValidation } from './ui/components/liveValidation.js';
import { startTutorial, shouldShowTutorial } from './ui/components/tutorial.js';
import { 
  initPersistence, 
  startAutoSave, 
  stopAutoSave,
  loadAutoSave 
} from './ui/persistence.js';
import { 
  createScenarioManager,
  initScenarioManager 
} from './ui/screens/scenarioManager.js';
import { 
  initNavigationGestures, 
  isTouchDevice 
} from './ui/components/touchGestures.js';
import { createBottomSheet } from './ui/components/bottomSheet.js';

/**
 * Application state
 */
let formData = {
  currentAge: null,
  retirementAge: null,
  targetNetIncome: null,
  currentPension: null,
  currentIsa: null,
  annualPensionContribution: null,
  annualIsaContribution: null,
  statePensionAge: 67
};

let scenarioManager = null;
let gestureHandler = null;
let accessibilityFeatures = null;

/**
 * Initialize all Phase 1 features
 */
export async function initPhase1Features() {
  console.log('Initializing Phase 1 features...');

  try {
    // 1. Initialize Accessibility Features
    console.log('→ Initializing accessibility...');
    accessibilityFeatures = initAccessibility();
    
    // 2. Initialize Data Persistence
    console.log('→ Initializing persistence...');
    await initPersistence();
    
    // 3. Load auto-saved data (if exists)
    const autoSave = await loadAutoSave();
    if (autoSave && autoSave.data) {
      console.log('→ Restoring auto-saved data...');
      formData = { ...formData, ...autoSave.data };
      announceToScreenReader('Previous session restored');
    }
    
    // 4. Initialize Scenario Manager
    console.log('→ Initializing scenario manager...');
    scenarioManager = createScenarioManager();
    await scenarioManager.loadScenarios();
    
    // 5. Initialize Dashboard
    console.log('→ Initializing dashboard...');
    initDashboard(formData);
    
    // 6. Initialize Live Validation
    console.log('→ Initializing live validation...');
    initLiveValidation(formData);
    
    // 7. Start Auto-Save
    console.log('→ Starting auto-save...');
    startAutoSave(
      () => formData,
      (savedData) => {
        console.log('Auto-saved at', new Date(savedData.lastModified));
        // Optionally show a toast notification
      }
    );
    
    // 8. Initialize Touch Gestures (mobile only)
    if (isTouchDevice()) {
      console.log('→ Initializing touch gestures...');
      gestureHandler = initNavigationGestures(
        handleSwipeBack,
        handleSwipeNext
      );
    }
    
    // 9. Show Tutorial (first-time users)
    if (shouldShowTutorial()) {
      console.log('→ Starting tutorial...');
      setTimeout(() => {
        startTutorial({
          onComplete: () => {
            console.log('Tutorial completed');
            announceToScreenReader('Tutorial completed');
          },
          onSkip: () => {
            console.log('Tutorial skipped');
          }
        });
      }, 1000); // Delay to allow page to settle
    }
    
    console.log('✅ Phase 1 features initialized successfully');
    
  } catch (error) {
    console.error('Error initializing Phase 1 features:', error);
    // Continue despite errors - progressive enhancement
  }
}

/**
 * Handle swipe back gesture
 */
function handleSwipeBack(gesture) {
  console.log('Swipe back detected', gesture);
  // Navigate to previous screen
  // Example: window.history.back();
}

/**
 * Handle swipe next gesture
 */
function handleSwipeNext(gesture) {
  console.log('Swipe next detected', gesture);
  // Navigate to next screen
  // Example: navigateToNextScreen();
}

/**
 * Update form data
 */
export function updateFormData(field, value) {
  formData[field] = value;
  
  // Update dashboard
  initDashboard(formData);
  
  // Announce change to screen readers
  announceToScreenReader(`${field} updated to ${value}`);
}

/**
 * Get current form data
 */
export function getCurrentFormData() {
  return { ...formData };
}

/**
 * Open scenario manager
 */
export function openScenarioManager() {
  if (!scenarioManager) {
    console.error('Scenario manager not initialized');
    return;
  }
  
  const container = document.getElementById('scenario-manager-container');
  if (!container) {
    console.error('Scenario manager container not found');
    return;
  }
  
  initScenarioManager(scenarioManager, {
    onLoad: (scenario) => {
      formData = { ...formData, ...scenario.data };
      initDashboard(formData);
      initLiveValidation(formData);
      announceToScreenReader(`Scenario ${scenario.name} loaded`);
      closeScenarioManager();
    },
    onNew: () => {
      if (confirm('Create a new scenario? Current data will be saved.')) {
        saveCurrentScenario();
        formData = {
          currentAge: null,
          retirementAge: null,
          targetNetIncome: null,
          currentPension: null,
          currentIsa: null,
          annualPensionContribution: null,
          annualIsaContribution: null,
          statePensionAge: 67
        };
        initDashboard(formData);
        closeScenarioManager();
      }
    },
    onCompare: (scenarios) => {
      showScenarioComparison(scenarios);
    },
    onImport: () => {
      scenarioManager.loadScenarios().then(() => {
        openScenarioManager(); // Refresh
      });
    }
  });
  
  // Show the container
  container.style.display = 'block';
}

/**
 * Close scenario manager
 */
function closeScenarioManager() {
  const container = document.getElementById('scenario-manager-container');
  if (container) {
    container.style.display = 'none';
  }
}

/**
 * Save current scenario
 */
async function saveCurrentScenario() {
  const name = prompt('Enter a name for this scenario:');
  if (!name) return;
  
  try {
    await scenarioManager.saveScenario(name, formData);
    announceToScreenReader(`Scenario ${name} saved`);
    alert('Scenario saved successfully!');
  } catch (error) {
    console.error('Failed to save scenario:', error);
    alert('Failed to save scenario. Please try again.');
  }
}

/**
 * Show scenario comparison
 */
function showScenarioComparison(scenarios) {
  const sheet = createBottomSheet({
    title: 'Scenario Comparison',
    content: renderComparisonTable(scenarios),
    height: '80vh',
    onClose: () => {
      // Return to scenario manager
    }
  });
  
  sheet.open();
}

/**
 * Render comparison table
 */
function renderComparisonTable(scenarios) {
  if (scenarios.length < 2) {
    return '<p>Select at least 2 scenarios to compare</p>';
  }
  
  return `
    <table class="comparison-table">
      <thead>
        <tr>
          <th>Metric</th>
          ${scenarios.map(s => `<th>${s.name}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${renderComparisonRow('Current Age', scenarios, s => s.data.currentAge || '-')}
        ${renderComparisonRow('Retirement Age', scenarios, s => s.data.retirementAge || '-')}
        ${renderComparisonRow('Target Income', scenarios, s => 
          s.data.targetNetIncome ? `£${s.data.targetNetIncome.toLocaleString()}` : '-'
        )}
        ${renderComparisonRow('Current Pension', scenarios, s => 
          s.data.currentPension !== null ? `£${s.data.currentPension.toLocaleString()}` : '-'
        )}
        ${renderComparisonRow('Current ISA', scenarios, s => 
          s.data.currentIsa !== null ? `£${s.data.currentIsa.toLocaleString()}` : '-'
        )}
      </tbody>
    </table>
  `;
}

function renderComparisonRow(label, scenarios, valueFn) {
  return `
    <tr>
      <td><strong>${label}</strong></td>
      ${scenarios.map(s => `<td>${valueFn(s)}</td>`).join('')}
    </tr>
  `;
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
  stopAutoSave();
  
  if (gestureHandler) {
    gestureHandler.destroy();
  }
});

/**
 * Export public API
 */
export {
  formData,
  scenarioManager,
  accessibilityFeatures,
  openScenarioManager,
  updateFormData,
  getCurrentFormData
};
