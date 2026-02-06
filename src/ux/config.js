/**
 * RetireLens 2 - Feature Flags Configuration
 * 
 * Toggle features on/off for phased rollout.
 */

export const FEATURE_FLAGS = {
  // Enable the Pathfinder triage step at the start of the flow
  // DISABLED: These questions don't affect calculations and damage trust
  PATHFINDER: false,
  
  // Enable the live Answer Preview sticky card during input
  PREVIEW_CARD: true,
  
  // Enable mode selection (Quick/Guided/Full)
  // DISABLED: Mode selection doesn't affect calculations and damages trust
  MODE_SELECT: false
};

/**
 * Check if a feature is enabled
 * @param {string} feature - Feature name
 * @returns {boolean}
 */
export function isFeatureEnabled(feature) {
  return FEATURE_FLAGS[feature] === true;
}
