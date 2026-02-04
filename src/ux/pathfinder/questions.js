/**
 * RetireLens 2 - Pathfinder Questions & Scoring
 * 
 * Triage questions that route users to appropriate journeys.
 * ~30 seconds to complete.
 */

/**
 * Pathfinder question definitions
 */
export const PATHFINDER_QUESTIONS = [
  {
    id: 'stage',
    text: 'Which best describes you right now?',
    options: [
      { value: 'starting', label: 'Just starting / building basics', score: { journey: 0 } },
      { value: 'accelerating', label: "I've started saving, want to accelerate", score: { journey: 1 } },
      { value: 'nearRetire', label: "I'm within ~10 years of retirement", score: { journey: 2 } }
    ]
  },
  {
    id: 'goal',
    text: "What's your biggest goal?",
    options: [
      { value: 'knowAmount', label: 'Know what I need to save', score: { journey: 0 } },
      { value: 'pickAge', label: 'Pick a retirement age target', score: { journey: 1 } },
      { value: 'checkSoon', label: 'Check if I can retire soon', score: { journey: 2 } }
    ]
  },
  {
    id: 'confidence',
    text: 'How confident are you about your pension/ISA numbers?',
    options: [
      { value: 'notConfident', label: 'Not confident', score: { mode: 0 } },
      { value: 'roughly', label: 'Roughly', score: { mode: 1 } },
      { value: 'veryConfident', label: 'Very confident', score: { mode: 2 } }
    ]
  },
  {
    id: 'depth',
    text: 'Do you want a quick estimate or a detailed plan?',
    options: [
      { value: 'quick', label: 'Quick', score: { mode: 0, forceMode: 'quick' } },
      { value: 'guided', label: 'Guided', score: { mode: 1, forceMode: 'guided' } },
      { value: 'full', label: 'Full detail', score: { mode: 2, forceMode: 'full' } }
    ]
  }
];

/**
 * Journey types
 */
export const JOURNEYS = {
  STARTER: 'starter',
  BUILDER: 'builder',
  PRE_RETIRE: 'preRetire'
};

/**
 * Mode types
 */
export const MODES = {
  QUICK: 'quick',
  GUIDED: 'guided',
  FULL: 'full'
};

/**
 * Score pathfinder answers to determine journey
 * 
 * Routing rules:
 * - If Q1 indicates within 10 years OR age >= 55 (if known), journey = preRetire
 * - Else if goal = accelerate OR already started saving -> builder
 * - Else -> starter
 * 
 * @param {object} answers - Answers keyed by question id
 * @param {number} [currentAge] - User's current age if already known
 * @returns {string} Journey type: 'starter' | 'builder' | 'preRetire'
 */
export function scoreToJourney(answers, currentAge = null) {
  // If age >= 55, always route to preRetire
  if (currentAge !== null && currentAge >= 55) {
    return JOURNEYS.PRE_RETIRE;
  }
  
  // If Q1 (stage) indicates within 10 years of retirement
  if (answers.stage === 'nearRetire') {
    return JOURNEYS.PRE_RETIRE;
  }
  
  // If goal is to check if can retire soon -> preRetire
  if (answers.goal === 'checkSoon') {
    return JOURNEYS.PRE_RETIRE;
  }
  
  // If accelerating or already started saving -> builder
  if (answers.stage === 'accelerating' || answers.goal === 'pickAge') {
    return JOURNEYS.BUILDER;
  }
  
  // Default -> starter
  return JOURNEYS.STARTER;
}

/**
 * Determine recommended mode based on pathfinder answers
 * 
 * Mode selection rules:
 * - If Q4 says Quick -> Quick
 * - Else if Q3 is "Not confident" -> Guided
 * - Else -> Full
 * 
 * @param {object} answers - Answers keyed by question id
 * @returns {string} Mode: 'quick' | 'guided' | 'full'
 */
export function scoreToMode(answers) {
  // If user explicitly selected depth preference
  if (answers.depth === 'quick') {
    return MODES.QUICK;
  }
  
  if (answers.depth === 'guided') {
    return MODES.GUIDED;
  }
  
  if (answers.depth === 'full') {
    return MODES.FULL;
  }
  
  // Based on confidence level
  if (answers.confidence === 'notConfident') {
    return MODES.GUIDED;
  }
  
  if (answers.confidence === 'veryConfident') {
    return MODES.FULL;
  }
  
  // Default to guided
  return MODES.GUIDED;
}

/**
 * Get journey and mode from answers
 * @param {object} answers - Pathfinder answers
 * @param {number} [currentAge] - User's current age if known
 * @returns {{ journey: string, mode: string }}
 */
export function getRouting(answers, currentAge = null) {
  return {
    journey: scoreToJourney(answers, currentAge),
    mode: scoreToMode(answers)
  };
}
