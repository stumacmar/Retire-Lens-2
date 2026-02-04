/**
 * RetireLens 2 - Journey Definitions
 * 
 * Defines journey metadata based on user routing.
 * Each journey determines which input steps to show.
 */

import { MODES } from '../modes/modes.js';

/**
 * Journey configuration
 */
export const JOURNEY_CONFIG = {
  starter: {
    id: 'starter',
    title: 'Getting Started',
    description: 'Build your foundation for retirement savings',
    subtitle: 'For those just beginning their retirement planning journey',
    emoji: '🌱',
    ageRange: '20s–40s',
    typicalProfile: 'Early career, building basics',
    defaultMode: MODES.QUICK,
    recommendedMode: MODES.GUIDED,
    // Steps visible in this journey
    availableSteps: ['age', 'retirement-age', 'income-target', 'pension-pot', 'contributions'],
    // Extended steps for Guided/Full modes
    extendedSteps: ['isa-savings', 'state-pension'],
    // Guidance messages
    tips: [
      'Start with your current pension balance',
      'Focus on building consistent savings habits',
      'Time is your biggest advantage'
    ]
  },
  
  builder: {
    id: 'builder',
    title: 'Accelerating Growth',
    description: 'Maximize your retirement savings potential',
    subtitle: 'For those actively building and optimizing their pension',
    emoji: '🚀',
    ageRange: '40s–50s',
    typicalProfile: 'Mid-career, accelerating savings',
    defaultMode: MODES.GUIDED,
    recommendedMode: MODES.GUIDED,
    // Steps visible in this journey
    availableSteps: ['age', 'retirement-age', 'income-target', 'pension-pot', 'contributions', 'isa-savings', 'state-pension'],
    extendedSteps: [],
    tips: [
      'Consider maximizing pension contributions',
      'Review your investment strategy',
      'Track multiple pension pots'
    ]
  },
  
  preRetire: {
    id: 'preRetire',
    title: 'Approaching Retirement',
    description: 'Plan your transition to retirement',
    subtitle: 'For those within 10 years of their target retirement date',
    emoji: '🎯',
    ageRange: '55+',
    typicalProfile: 'Pre-retirement, bridge to SPA & withdrawal planning',
    defaultMode: MODES.FULL,
    recommendedMode: MODES.FULL,
    // Steps visible in this journey
    availableSteps: ['age', 'retirement-age', 'income-target', 'pension-pot', 'contributions', 'isa-savings', 'state-pension'],
    extendedSteps: [],
    tips: [
      'Consider your State Pension timing',
      'Review withdrawal strategies',
      'Think about tax-efficient drawdown'
    ]
  }
};

/**
 * Get journey configuration by ID
 * @param {string} journeyId - Journey identifier
 * @returns {object} Journey configuration
 */
export function getJourney(journeyId) {
  return JOURNEY_CONFIG[journeyId] || JOURNEY_CONFIG.starter;
}

/**
 * Get steps for a journey based on mode
 * @param {string} journeyId - Journey identifier
 * @param {string} mode - Mode: quick | guided | full
 * @returns {string[]} Array of step IDs to show
 */
export function getJourneySteps(journeyId, mode) {
  const journey = getJourney(journeyId);
  
  if (mode === MODES.QUICK) {
    // Quick mode: only core steps
    return ['age', 'retirement-age', 'income-target', 'pension-pot', 'contributions'];
  }
  
  // Guided and Full modes: include all available steps
  return [...journey.availableSteps, ...journey.extendedSteps];
}

/**
 * Get all journey options for display
 * @returns {object[]} Array of journey objects
 */
export function getAllJourneys() {
  return Object.values(JOURNEY_CONFIG);
}
