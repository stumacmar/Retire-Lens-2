/**
 * RetireLens 2 - Mode Definitions
 * 
 * Defines Quick/Guided/Full modes and their configurations.
 */

/**
 * Mode identifiers
 */
export const MODES = {
  QUICK: 'quick',
  GUIDED: 'guided',
  FULL: 'full'
};

/**
 * Mode configurations
 */
export const MODE_CONFIG = {
  quick: {
    id: 'quick',
    name: 'Quick Estimate',
    description: '60 seconds • Get a fast answer',
    emoji: '⚡',
    duration: '~1 minute',
    // Required fields for this mode
    requiredFields: [
      'currentAge',
      'retirementAge',
      'targetNetIncome',
      'currentPension'
    ],
    // Optional fields (shown but not required)
    optionalFields: [
      'annualPensionContribution'
    ],
    // Fields NOT shown in this mode
    hiddenFields: [
      'currentIsa',
      'annualIsaContribution',
      'statePensionAge',
      'expectedStatePension'
    ],
    // Advanced options available
    advancedOptionsUnlocked: false,
    // Planning scenario dropdown visible
    showScenarioDropdown: false,
    // Monte Carlo default
    defaultMonteCarlo: false,
    // Show steps
    steps: ['age', 'retirement-age', 'income-target', 'pension-pot', 'contributions'],
    features: [
      'Basic retirement estimate',
      'Simple pot projection',
      'Quick sustainability check'
    ]
  },
  
  guided: {
    id: 'guided',
    name: 'Guided Plan',
    description: '3-5 minutes • Add ISA & State Pension',
    emoji: '📋',
    duration: '3-5 minutes',
    requiredFields: [
      'currentAge',
      'retirementAge',
      'targetNetIncome',
      'currentPension',
      'annualPensionContribution'
    ],
    optionalFields: [
      'currentIsa',
      'annualIsaContribution',
      'statePensionAge',
      'expectedStatePension'
    ],
    hiddenFields: [],
    advancedOptionsUnlocked: false,
    showScenarioDropdown: true,
    defaultMonteCarlo: false,
    steps: ['age', 'retirement-age', 'income-target', 'pension-pot', 'contributions', 'isa-savings', 'state-pension'],
    features: [
      'ISA savings included',
      'State Pension modeling',
      'Planning scenario selection',
      'Tax-efficient drawdown estimate'
    ]
  },
  
  full: {
    id: 'full',
    name: 'Full Analysis',
    description: '10 minutes • All advanced options',
    emoji: '🔬',
    duration: '~10 minutes',
    requiredFields: [
      'currentAge',
      'retirementAge',
      'targetNetIncome',
      'currentPension',
      'annualPensionContribution'
    ],
    optionalFields: [
      'currentIsa',
      'annualIsaContribution',
      'statePensionAge',
      'expectedStatePension'
    ],
    hiddenFields: [],
    advancedOptionsUnlocked: true,
    showScenarioDropdown: true,
    defaultMonteCarlo: true,
    steps: ['age', 'retirement-age', 'income-target', 'pension-pot', 'contributions', 'isa-savings', 'state-pension'],
    features: [
      'Monte Carlo simulation',
      'Peer benchmarks',
      'Tax efficiency optimization',
      'Couple planning',
      'DB pension modeling',
      'Care cost planning',
      'Phased retirement'
    ],
    // Advanced option groups for accordion display
    advancedGroups: [
      {
        id: 'risk',
        title: 'Risk & Uncertainty',
        emoji: '📊',
        options: [
          { id: 'enable-monte-carlo', label: 'Monte Carlo simulation (1000 scenarios)', helper: 'Models market uncertainty' },
          { id: 'enable-benchmarking', label: 'Compare to peer benchmarks', helper: 'See how you compare to others' }
        ]
      },
      {
        id: 'tax',
        title: 'Tax & Household',
        emoji: '💷',
        options: [
          { id: 'enable-tax-optimization', label: 'Optimize tax efficiency', helper: 'Maximize after-tax income' },
          { id: 'is-couple', label: 'Planning as a couple', helper: 'Joint retirement planning' },
          { id: 'has-db-pension', label: 'I have a Defined Benefit pension', helper: 'Include final salary pension' }
        ]
      },
      {
        id: 'life',
        title: 'Life Events',
        emoji: '🏥',
        options: [
          { id: 'model-care-costs', label: 'Model potential care costs', helper: 'Later-life care planning' },
          { id: 'is-phased-retirement', label: 'Model phased/graduated retirement', helper: 'Gradual transition from work' }
        ]
      }
    ]
  }
};

/**
 * Get mode configuration by ID
 * @param {string} modeId - Mode identifier
 * @returns {object} Mode configuration
 */
export function getMode(modeId) {
  return MODE_CONFIG[modeId] || MODE_CONFIG.guided;
}

/**
 * Get all mode options for display
 * @returns {object[]} Array of mode objects
 */
export function getAllModes() {
  return Object.values(MODE_CONFIG);
}

/**
 * Check if a field is required for a mode
 * @param {string} modeId - Mode identifier
 * @param {string} fieldName - Field name
 * @returns {boolean}
 */
export function isFieldRequired(modeId, fieldName) {
  const mode = getMode(modeId);
  return mode.requiredFields.includes(fieldName);
}

/**
 * Check if a field is hidden for a mode
 * @param {string} modeId - Mode identifier
 * @param {string} fieldName - Field name
 * @returns {boolean}
 */
export function isFieldHidden(modeId, fieldName) {
  const mode = getMode(modeId);
  return mode.hiddenFields.includes(fieldName);
}

/**
 * Get steps to show for a mode
 * @param {string} modeId - Mode identifier
 * @returns {string[]} Array of step IDs
 */
export function getModeSteps(modeId) {
  const mode = getMode(modeId);
  return mode.steps;
}
