/**
 * RetireLens 2 - Scenario Presets Configuration
 * 
 * Pre-defined scenarios for quick selection.
 * Each scenario bundles assumptions for a particular planning outlook.
 */

import { SCENARIO_PRESETS } from '../engine/assumptions.js';

/**
 * Full scenario definitions with metadata and UI labels
 */
export const SCENARIOS = Object.freeze({
  conservative: {
    id: 'conservative',
    name: 'Conservative',
    shortDescription: 'Cautious assumptions',
    fullDescription: 'Lower growth, higher volatility - plan for worse-than-average markets',
    icon: '🛡️',
    assumptions: SCENARIO_PRESETS.conservative,
    recommendedFor: [
      'Risk-averse investors',
      'Those closer to retirement',
      'Stress-testing plans'
    ]
  },
  
  moderate: {
    id: 'moderate',
    name: 'Moderate',
    shortDescription: 'Balanced assumptions',
    fullDescription: 'Reasonable base case aligned with long-term historical averages',
    icon: '⚖️',
    assumptions: SCENARIO_PRESETS.moderate,
    recommendedFor: [
      'Most users',
      'Initial planning',
      'Diversified portfolios'
    ]
  },
  
  optimistic: {
    id: 'optimistic',
    name: 'Optimistic',
    shortDescription: 'Favorable assumptions',
    fullDescription: 'Higher growth, lower volatility - best-case market scenario',
    icon: '🚀',
    assumptions: SCENARIO_PRESETS.optimistic,
    recommendedFor: [
      'Understanding upside potential',
      'Younger savers',
      'Aggressive portfolios'
    ]
  }
});

/**
 * Default scenario to use
 */
export const DEFAULT_SCENARIO = 'moderate';

/**
 * Get scenario by ID
 * 
 * @param {string} id - Scenario ID
 * @returns {object} Scenario configuration or null
 */
export function getScenarioById(id) {
  return SCENARIOS[id] || null;
}

/**
 * Get all scenario IDs
 * 
 * @returns {string[]} Array of scenario IDs
 */
export function getScenarioIds() {
  return Object.keys(SCENARIOS);
}

/**
 * Get scenario options for UI selector
 * 
 * @returns {object[]} Array of { id, name, description } for dropdown/radio
 */
export function getScenarioOptions() {
  return Object.values(SCENARIOS).map(scenario => ({
    id: scenario.id,
    name: scenario.name,
    description: scenario.shortDescription,
    icon: scenario.icon
  }));
}

/**
 * Compare assumptions between two scenarios
 * 
 * @param {string} scenario1Id - First scenario ID
 * @param {string} scenario2Id - Second scenario ID
 * @returns {object} Comparison object with differences
 */
export function compareScenarios(scenario1Id, scenario2Id) {
  const s1 = SCENARIOS[scenario1Id];
  const s2 = SCENARIOS[scenario2Id];
  
  if (!s1 || !s2) {
    return null;
  }
  
  return {
    scenario1: { id: s1.id, name: s1.name },
    scenario2: { id: s2.id, name: s2.name },
    differences: {
      growthRate: {
        scenario1: s1.assumptions.growthRate,
        scenario2: s2.assumptions.growthRate,
        delta: s2.assumptions.growthRate - s1.assumptions.growthRate
      },
      volatility: {
        scenario1: s1.assumptions.volatility,
        scenario2: s2.assumptions.volatility,
        delta: s2.assumptions.volatility - s1.assumptions.volatility
      },
      inflationRate: {
        scenario1: s1.assumptions.inflationRate,
        scenario2: s2.assumptions.inflationRate,
        delta: s2.assumptions.inflationRate - s1.assumptions.inflationRate
      },
      feeRate: {
        scenario1: s1.assumptions.feeRate,
        scenario2: s2.assumptions.feeRate,
        delta: s2.assumptions.feeRate - s1.assumptions.feeRate
      }
    }
  };
}
