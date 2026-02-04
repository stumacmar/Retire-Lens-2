/**
 * RetireLens 2 - Pathfinder & UX Module Tests
 * 
 * Unit tests for pathfinder questions, journey routing, mode selection, and preview estimates.
 * Run with: node tests/pathfinder.test.js
 */

import { 
  PATHFINDER_QUESTIONS, 
  JOURNEYS, 
  MODES,
  scoreToJourney, 
  scoreToMode, 
  getRouting 
} from '../src/ux/pathfinder/questions.js';

import { 
  JOURNEY_CONFIG, 
  getJourney, 
  getJourneySteps 
} from '../src/ux/journeys/journeys.js';

import { 
  MODE_CONFIG, 
  getMode, 
  getModeSteps, 
  isFieldRequired, 
  isFieldHidden 
} from '../src/ux/modes/modes.js';

import { 
  estimatePreview, 
  formatPreviewCurrency, 
  formatGapSurplus 
} from '../src/ux/preview/estimate.js';

// Test utilities
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failCount++;
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toContain(item) {
      if (!actual.includes(item)) {
        throw new Error(`Expected array to contain ${item}`);
      }
    },
    toBeGreaterThan(expected) {
      if (actual <= expected) {
        throw new Error(`Expected > ${expected}, got ${actual}`);
      }
    },
    toBeLessThan(expected) {
      if (actual >= expected) {
        throw new Error(`Expected < ${expected}, got ${actual}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${actual}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, got ${actual}`);
      }
    }
  };
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  RETIRELENS 2 - PATHFINDER & UX MODULE TESTS');
console.log('═══════════════════════════════════════════════════════════════\n');

// ═══════════════════════════════════════════════════════════════
// PATHFINDER QUESTIONS
// ═══════════════════════════════════════════════════════════════

console.log('PATHFINDER QUESTIONS');
console.log('─────────────────────────────────────────────────────────────────');

test('Pathfinder has 4 questions', () => {
  expect(PATHFINDER_QUESTIONS.length).toBe(4);
});

test('Each question has id, text, and options', () => {
  PATHFINDER_QUESTIONS.forEach(q => {
    if (!q.id || !q.text || !q.options) {
      throw new Error(`Question missing required fields: ${JSON.stringify(q)}`);
    }
  });
});

test('Question IDs are unique', () => {
  const ids = PATHFINDER_QUESTIONS.map(q => q.id);
  const uniqueIds = [...new Set(ids)];
  expect(ids.length).toBe(uniqueIds.length);
});

// ═══════════════════════════════════════════════════════════════
// JOURNEY ROUTING
// ═══════════════════════════════════════════════════════════════

console.log('\nJOURNEY ROUTING');
console.log('─────────────────────────────────────────────────────────────────');

test('Routes to STARTER for just starting user', () => {
  const answers = { stage: 'starting', goal: 'knowAmount' };
  expect(scoreToJourney(answers)).toBe(JOURNEYS.STARTER);
});

test('Routes to BUILDER for accelerating user', () => {
  const answers = { stage: 'accelerating', goal: 'pickAge' };
  expect(scoreToJourney(answers)).toBe(JOURNEYS.BUILDER);
});

test('Routes to PRE_RETIRE for near-retirement user', () => {
  const answers = { stage: 'nearRetire', goal: 'checkSoon' };
  expect(scoreToJourney(answers)).toBe(JOURNEYS.PRE_RETIRE);
});

test('Routes to PRE_RETIRE if age >= 55', () => {
  const answers = { stage: 'starting', goal: 'knowAmount' };
  expect(scoreToJourney(answers, 55)).toBe(JOURNEYS.PRE_RETIRE);
});

test('Routes to PRE_RETIRE if goal is checkSoon', () => {
  const answers = { stage: 'accelerating', goal: 'checkSoon' };
  expect(scoreToJourney(answers)).toBe(JOURNEYS.PRE_RETIRE);
});

test('Routes to BUILDER if goal is pickAge', () => {
  const answers = { stage: 'starting', goal: 'pickAge' };
  expect(scoreToJourney(answers)).toBe(JOURNEYS.BUILDER);
});

// ═══════════════════════════════════════════════════════════════
// MODE SELECTION
// ═══════════════════════════════════════════════════════════════

console.log('\nMODE SELECTION');
console.log('─────────────────────────────────────────────────────────────────');

test('Returns QUICK mode when user selects quick', () => {
  const answers = { depth: 'quick', confidence: 'veryConfident' };
  expect(scoreToMode(answers)).toBe(MODES.QUICK);
});

test('Returns GUIDED mode when user selects guided', () => {
  const answers = { depth: 'guided', confidence: 'notConfident' };
  expect(scoreToMode(answers)).toBe(MODES.GUIDED);
});

test('Returns FULL mode when user selects full', () => {
  const answers = { depth: 'full', confidence: 'notConfident' };
  expect(scoreToMode(answers)).toBe(MODES.FULL);
});

test('Returns GUIDED mode for not confident users without explicit depth', () => {
  const answers = { confidence: 'notConfident' };
  expect(scoreToMode(answers)).toBe(MODES.GUIDED);
});

test('Returns FULL mode for very confident users without explicit depth', () => {
  const answers = { confidence: 'veryConfident' };
  expect(scoreToMode(answers)).toBe(MODES.FULL);
});

test('getRouting returns both journey and mode', () => {
  const answers = { stage: 'nearRetire', goal: 'checkSoon', depth: 'full', confidence: 'veryConfident' };
  const routing = getRouting(answers);
  expect(routing.journey).toBe(JOURNEYS.PRE_RETIRE);
  expect(routing.mode).toBe(MODES.FULL);
});

// ═══════════════════════════════════════════════════════════════
// JOURNEY CONFIGURATION
// ═══════════════════════════════════════════════════════════════

console.log('\nJOURNEY CONFIGURATION');
console.log('─────────────────────────────────────────────────────────────────');

test('All three journeys are defined', () => {
  expect(Object.keys(JOURNEY_CONFIG).length).toBe(3);
  expect(JOURNEY_CONFIG.starter).toBeTruthy();
  expect(JOURNEY_CONFIG.builder).toBeTruthy();
  expect(JOURNEY_CONFIG.preRetire).toBeTruthy();
});

test('getJourney returns correct config', () => {
  const starter = getJourney('starter');
  expect(starter.id).toBe('starter');
  expect(starter.title).toBe('Getting Started');
});

test('getJourney returns starter for unknown journey', () => {
  const unknown = getJourney('unknown');
  expect(unknown.id).toBe('starter');
});

test('getJourneySteps returns core steps for quick mode', () => {
  const steps = getJourneySteps('starter', 'quick');
  expect(steps).toContain('age');
  expect(steps).toContain('retirement-age');
  expect(steps).toContain('pension-pot');
});

// ═══════════════════════════════════════════════════════════════
// MODE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

console.log('\nMODE CONFIGURATION');
console.log('─────────────────────────────────────────────────────────────────');

test('All three modes are defined', () => {
  expect(Object.keys(MODE_CONFIG).length).toBe(3);
  expect(MODE_CONFIG.quick).toBeTruthy();
  expect(MODE_CONFIG.guided).toBeTruthy();
  expect(MODE_CONFIG.full).toBeTruthy();
});

test('Quick mode has advancedOptionsUnlocked = false', () => {
  expect(MODE_CONFIG.quick.advancedOptionsUnlocked).toBe(false);
});

test('Full mode has advancedOptionsUnlocked = true', () => {
  expect(MODE_CONFIG.full.advancedOptionsUnlocked).toBe(true);
});

test('Full mode has advancedGroups defined', () => {
  expect(MODE_CONFIG.full.advancedGroups.length).toBe(3);
});

test('isFieldRequired works correctly', () => {
  expect(isFieldRequired('quick', 'currentAge')).toBe(true);
  expect(isFieldRequired('quick', 'currentIsa')).toBe(false);
});

test('isFieldHidden works correctly', () => {
  expect(isFieldHidden('quick', 'currentIsa')).toBe(true);
  expect(isFieldHidden('guided', 'currentIsa')).toBe(false);
});

test('getModeSteps returns correct steps', () => {
  const quickSteps = getModeSteps('quick');
  const guidedSteps = getModeSteps('guided');
  expect(quickSteps.length).toBeLessThan(guidedSteps.length);
});

// ═══════════════════════════════════════════════════════════════
// PREVIEW ESTIMATES
// ═══════════════════════════════════════════════════════════════

console.log('\nPREVIEW ESTIMATES');
console.log('─────────────────────────────────────────────────────────────────');

test('estimatePreview returns incomplete for missing age', () => {
  const result = estimatePreview({ retirementAge: 65, currentPension: 100000 });
  expect(result.isComplete).toBe(false);
  expect(result.missingFields).toContain('age');
});

test('estimatePreview returns incomplete for missing retirement age', () => {
  const result = estimatePreview({ currentAge: 40, currentPension: 100000 });
  expect(result.isComplete).toBe(false);
  expect(result.missingFields).toContain('retirementAge');
});

test('estimatePreview calculates projected pot correctly', () => {
  const result = estimatePreview({
    currentAge: 40,
    retirementAge: 65,
    targetNetIncome: 30000,
    currentPension: 100000,
    annualPensionContribution: 10000
  });
  
  expect(result.isComplete).toBe(true);
  expect(result.projectedPotAtRetirement).toBeGreaterThan(100000);
  expect(result.yearsToRetirement).toBe(25);
});

test('estimatePreview includes ISA in projection', () => {
  const withoutIsa = estimatePreview({
    currentAge: 40,
    retirementAge: 65,
    currentPension: 100000
  });
  
  const withIsa = estimatePreview({
    currentAge: 40,
    retirementAge: 65,
    currentPension: 100000,
    currentIsa: 50000
  });
  
  expect(withIsa.projectedPotAtRetirement).toBeGreaterThan(withoutIsa.projectedPotAtRetirement);
});

test('estimatePreview calculates gap correctly', () => {
  const result = estimatePreview({
    currentAge: 40,
    retirementAge: 65,
    targetNetIncome: 100000,
    currentPension: 50000
  });
  
  expect(result.isComplete).toBe(true);
  expect(result.gapOrSurplus).toBeLessThan(0); // Should be a gap
});

test('estimatePreview calculates surplus correctly', () => {
  const result = estimatePreview({
    currentAge: 40,
    retirementAge: 65,
    targetNetIncome: 10000,
    currentPension: 500000
  });
  
  expect(result.isComplete).toBe(true);
  expect(result.gapOrSurplus).toBeGreaterThan(0); // Should be a surplus
});

test('estimatePreview includes state pension when eligible', () => {
  const withStatePension = estimatePreview({
    currentAge: 40,
    retirementAge: 67,
    targetNetIncome: 30000,
    currentPension: 100000,
    expectedStatePension: 11500,
    statePensionAge: 67
  });
  
  expect(withStatePension.statePensionIncome).toBe(11500);
});

test('estimatePreview excludes state pension when not eligible', () => {
  const earlyRetire = estimatePreview({
    currentAge: 40,
    retirementAge: 60,
    targetNetIncome: 30000,
    currentPension: 100000,
    expectedStatePension: 11500,
    statePensionAge: 67
  });
  
  expect(earlyRetire.statePensionIncome).toBe(0);
});

test('estimatePreview has required note', () => {
  const result = estimatePreview({
    currentAge: 40,
    retirementAge: 65,
    currentPension: 100000
  });
  
  expect(result.note).toBe('Estimate only — full tax/ISA/PCLS sequencing in next phase.');
});

// ═══════════════════════════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════

console.log('\nFORMAT HELPERS');
console.log('─────────────────────────────────────────────────────────────────');

test('formatPreviewCurrency handles null', () => {
  expect(formatPreviewCurrency(null)).toBe('—');
});

test('formatPreviewCurrency formats thousands', () => {
  const result = formatPreviewCurrency(50000);
  expect(result).toBe('£50,000');
});

test('formatPreviewCurrency formats millions', () => {
  const result = formatPreviewCurrency(1500000);
  expect(result).toBe('£1.5M');
});

test('formatGapSurplus handles surplus', () => {
  const result = formatGapSurplus(5000);
  expect(result.class).toBe('surplus');
  expect(result.text).toContain('+');
});

test('formatGapSurplus handles gap', () => {
  const result = formatGapSurplus(-5000);
  expect(result.class).toBe('gap');
  expect(result.text).toContain('-');
});

test('formatGapSurplus handles null', () => {
  const result = formatGapSurplus(null);
  expect(result.class).toBe('neutral');
  expect(result.text).toBe('—');
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (failCount > 0) {
  process.exit(1);
}
