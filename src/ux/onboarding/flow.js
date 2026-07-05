/**
 * RetireLens Pro - Onboarding Flow
 * 
 * Implements the mandatory couples-first data contract:
 * 1. "Who are you planning for?" (single/couple) - MANDATORY FIRST
 * 2. Pension type discovery per person (DC/DB/Both/Not sure) - MANDATORY
 * 3. Conditional inputs based on pension types
 * 
 * No projections until household model is valid.
 */

import { HOUSEHOLD_TYPES, PENSION_TYPES, PLAN_STATUS } from '../../../engine/householdPlan.js';

/**
 * Onboarding steps in order
 * Each step must be completed before projections can run
 */
export const ONBOARDING_STEPS = Object.freeze([
  {
    id: 'household-type',
    title: 'Who are you planning for?',
    mandatory: true,
    cannotSkip: true,
    order: 0
  },
  {
    id: 'person-a-pension-type',
    title: 'Your pension type',
    mandatory: true,
    cannotSkip: true,
    order: 1
  },
  {
    id: 'person-b-pension-type',
    title: "Your partner's pension type",
    mandatory: true,
    cannotSkip: true,
    showIf: (state) => state.householdType === HOUSEHOLD_TYPES.COUPLE,
    order: 2
  },
  {
    id: 'person-a-age',
    title: 'Your age',
    mandatory: true,
    order: 3
  },
  {
    id: 'person-b-age',
    title: "Your partner's age",
    mandatory: true,
    showIf: (state) => state.householdType === HOUSEHOLD_TYPES.COUPLE,
    order: 4
  },
  {
    id: 'person-a-retirement-age',
    title: 'Your target retirement age',
    mandatory: true,
    order: 5
  },
  {
    id: 'person-b-retirement-age',
    title: "Your partner's target retirement age",
    mandatory: true,
    showIf: (state) => state.householdType === HOUSEHOLD_TYPES.COUPLE,
    order: 6
  },
  {
    id: 'target-income',
    title: 'Your household income target',
    mandatory: true,
    order: 7
  },
  // Conditional DC steps
  {
    id: 'person-a-dc',
    title: 'Your DC pension details',
    mandatory: true,
    showIf: (state) => personHasDC(state, 'personA'),
    order: 8
  },
  {
    id: 'person-b-dc',
    title: "Your partner's DC pension details",
    mandatory: true,
    showIf: (state) => state.householdType === HOUSEHOLD_TYPES.COUPLE && personHasDC(state, 'personB'),
    order: 9
  },
  // Conditional DB steps
  {
    id: 'person-a-db',
    title: 'Your DB pension details',
    mandatory: true,
    showIf: (state) => personHasDB(state, 'personA'),
    order: 10
  },
  {
    id: 'person-b-db',
    title: "Your partner's DB pension details",
    mandatory: true,
    showIf: (state) => state.householdType === HOUSEHOLD_TYPES.COUPLE && personHasDB(state, 'personB'),
    order: 11
  },
  // State pension
  {
    id: 'person-a-state-pension',
    title: 'Your State Pension',
    mandatory: false,
    order: 12
  },
  {
    id: 'person-b-state-pension',
    title: "Your partner's State Pension",
    mandatory: false,
    showIf: (state) => state.householdType === HOUSEHOLD_TYPES.COUPLE,
    order: 13
  },
  // Review
  {
    id: 'review',
    title: 'Review your details',
    mandatory: true,
    order: 14
  }
]);

/**
 * Check if person has DC pension
 */
function personHasDC(state, personKey) {
  const types = state[personKey]?.pensionTypes || [];
  return types.includes(PENSION_TYPES.DC) || types.includes(PENSION_TYPES.BOTH);
}

/**
 * Check if person has DB pension
 */
function personHasDB(state, personKey) {
  const types = state[personKey]?.pensionTypes || [];
  return types.includes(PENSION_TYPES.DB) || types.includes(PENSION_TYPES.BOTH);
}

/**
 * Get steps to show based on current state
 */
export function getVisibleSteps(state) {
  return ONBOARDING_STEPS.filter(step => {
    if (step.showIf) {
      return step.showIf(state);
    }
    return true;
  });
}

/**
 * Get next step ID
 */
export function getNextStep(currentStepId, state) {
  const visibleSteps = getVisibleSteps(state);
  const currentIndex = visibleSteps.findIndex(s => s.id === currentStepId);
  
  if (currentIndex === -1 || currentIndex >= visibleSteps.length - 1) {
    return null;
  }
  
  return visibleSteps[currentIndex + 1].id;
}

/**
 * Get previous step ID
 */
export function getPrevStep(currentStepId, state) {
  const visibleSteps = getVisibleSteps(state);
  const currentIndex = visibleSteps.findIndex(s => s.id === currentStepId);
  
  if (currentIndex <= 0) {
    return null;
  }
  
  return visibleSteps[currentIndex - 1].id;
}

/**
 * Check if onboarding is complete
 */
export function isOnboardingComplete(state) {
  const visibleSteps = getVisibleSteps(state);
  const mandatorySteps = visibleSteps.filter(s => s.mandatory);
  
  for (const step of mandatorySteps) {
    if (!isStepComplete(step.id, state)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if a specific step is complete
 */
export function isStepComplete(stepId, state) {
  switch (stepId) {
    case 'household-type':
      return state.householdType === HOUSEHOLD_TYPES.SINGLE || 
             state.householdType === HOUSEHOLD_TYPES.COUPLE;
    
    case 'person-a-pension-type':
      return state.personA?.pensionTypes?.length > 0;
    
    case 'person-b-pension-type':
      return state.householdType !== HOUSEHOLD_TYPES.COUPLE || 
             state.personB?.pensionTypes?.length > 0;
    
    case 'person-a-age':
      return state.personA?.currentAge >= 18 && state.personA?.currentAge <= 100;
    
    case 'person-b-age':
      return state.householdType !== HOUSEHOLD_TYPES.COUPLE ||
             (state.personB?.currentAge >= 18 && state.personB?.currentAge <= 100);
    
    case 'person-a-retirement-age':
      return state.personA?.retirementAge > state.personA?.currentAge;
    
    case 'person-b-retirement-age':
      return state.householdType !== HOUSEHOLD_TYPES.COUPLE ||
             state.personB?.retirementAge > state.personB?.currentAge;
    
    case 'target-income':
      return state.targetNetIncome > 0;
    
    case 'person-a-dc':
      if (!personHasDC(state, 'personA')) return true;
      return state.personA?.dcPot !== undefined;
    
    case 'person-b-dc':
      if (!personHasDC(state, 'personB')) return true;
      return state.personB?.dcPot !== undefined;
    
    case 'person-a-db':
      if (!personHasDB(state, 'personA')) return true;
      return state.personA?.dbAnnualIncome > 0 && state.personA?.dbStartAge;
    
    case 'person-b-db':
      if (!personHasDB(state, 'personB')) return true;
      return state.personB?.dbAnnualIncome > 0 && state.personB?.dbStartAge;
    
    case 'person-a-state-pension':
    case 'person-b-state-pension':
      // Optional, always considered complete
      return true;
    
    case 'review':
      // Review is complete when user confirms
      return state.reviewConfirmed === true;
    
    default:
      return false;
  }
}

/**
 * Get incomplete mandatory steps
 */
export function getIncompleteSteps(state) {
  const visibleSteps = getVisibleSteps(state);
  return visibleSteps.filter(step => 
    step.mandatory && !isStepComplete(step.id, state)
  );
}

/**
 * Pension type options for selection
 */
export const PENSION_TYPE_OPTIONS = [
  {
    value: PENSION_TYPES.DC,
    label: 'Defined Contribution (DC)',
    description: 'Pension pot that I or my employer pays into',
    examples: 'Workplace pension, SIPP, personal pension'
  },
  {
    value: PENSION_TYPES.DB,
    label: 'Defined Benefit (DB)',
    description: 'Guaranteed income based on salary and service',
    examples: 'Final salary, career-average pension'
  },
  {
    value: PENSION_TYPES.BOTH,
    label: 'Both DC and DB',
    description: 'I have both types of pension',
    examples: 'Multiple employers or pension schemes'
  },
  {
    value: PENSION_TYPES.NOT_SURE,
    label: "I'm not sure",
    description: 'Mark as provisional - we can still estimate',
    examples: 'We\'ll treat as DC with default assumptions'
  }
];

/**
 * Education content for pension types (accordion)
 */
export const PENSION_TYPE_EDUCATION = {
  [PENSION_TYPES.DC]: {
    title: "What's a Defined Contribution (DC) pension?",
    content: `Defined Contribution pensions are pots of money.
You and/or your employer pay in, the money is invested, and the value can go up or down.
In retirement, you decide how and when to take money out.
Examples include workplace pensions, SIPPs, and personal pensions.`
  },
  [PENSION_TYPES.DB]: {
    title: "What's a Defined Benefit (DB) pension?",
    content: `Defined Benefit pensions pay a guaranteed income for life.
The amount is usually based on your salary and how long you worked for an employer.
It normally increases each year and is paid until you die.
Examples include final salary and career-average pensions.`
  }
};

/**
 * Household type options
 */
export const HOUSEHOLD_TYPE_OPTIONS = [
  {
    value: HOUSEHOLD_TYPES.SINGLE,
    label: 'Just me',
    description: 'Individual retirement planning'
  },
  {
    value: HOUSEHOLD_TYPES.COUPLE,
    label: 'Me and my partner',
    description: 'Joint household retirement planning'
  }
];

/**
 * Default State Pension values (UK 2024/25)
 */
export const STATE_PENSION_DEFAULTS = {
  age: 67,
  fullAmount: 11500,  // ~£221/week rounded to annual
  minAge: 66,
  maxAge: 68
};

/**
 * Initial onboarding state
 */
export function createInitialOnboardingState() {
  return {
    householdType: null,
    personA: {
      name: 'You',
      pensionTypes: [],
      currentAge: null,
      retirementAge: null,
      dcPot: null,
      dcMonthlyContrib: 0,
      dcAnnualContrib: 0,
      dbAnnualIncome: null,
      dbStartAge: null,
      dbEscalation: 'cpi',
      statePensionAge: STATE_PENSION_DEFAULTS.age,
      expectedStatePension: STATE_PENSION_DEFAULTS.fullAmount
    },
    personB: {
      name: 'Partner',
      pensionTypes: [],
      currentAge: null,
      retirementAge: null,
      dcPot: null,
      dcMonthlyContrib: 0,
      dcAnnualContrib: 0,
      dbAnnualIncome: null,
      dbStartAge: null,
      dbEscalation: 'cpi',
      statePensionAge: STATE_PENSION_DEFAULTS.age,
      expectedStatePension: STATE_PENSION_DEFAULTS.fullAmount
    },
    targetNetIncome: null,
    reviewConfirmed: false,
    currentStep: 'household-type'
  };
}

/**
 * Validate onboarding state and return status
 */
export function validateOnboardingState(state) {
  const incompleteSteps = getIncompleteSteps(state);
  const visibleSteps = getVisibleSteps(state);
  
  // Check for 'not sure' selections
  const hasUnsure = state.personA?.pensionTypes?.includes(PENSION_TYPES.NOT_SURE) ||
                    state.personB?.pensionTypes?.includes(PENSION_TYPES.NOT_SURE);
  
  const status = incompleteSteps.length > 0 
    ? PLAN_STATUS.INCOMPLETE 
    : (hasUnsure ? PLAN_STATUS.PROVISIONAL : PLAN_STATUS.COMPLETE);
  
  return {
    status,
    isComplete: status !== PLAN_STATUS.INCOMPLETE,
    canProject: status !== PLAN_STATUS.INCOMPLETE,
    incompleteSteps: incompleteSteps.map(s => s.id),
    totalSteps: visibleSteps.length,
    completedSteps: visibleSteps.length - incompleteSteps.length,
    progress: visibleSteps.length > 0 
      ? (visibleSteps.length - incompleteSteps.length) / visibleSteps.length 
      : 0,
    warnings: hasUnsure ? ['Pension type marked as "not sure" — results are provisional'] : []
  };
}

/**
 * Convert onboarding state to HouseholdPlan format
 */
export function onboardingToHouseholdPlan(state) {
  // Ensure we have minimum data
  if (!state.householdType || !state.personA?.currentAge) {
    throw new Error('Onboarding incomplete - cannot create household plan');
  }

  const plan = {
    householdType: state.householdType,
    personA: {
      name: state.personA.name || 'Person A',
      currentAge: state.personA.currentAge,
      retirementAge: state.personA.retirementAge || state.personA.currentAge + 10,
      pensionTypes: state.personA.pensionTypes || [],
      
      // State Pension
      statePensionAge: state.personA.statePensionAge || STATE_PENSION_DEFAULTS.age,
      expectedStatePension: state.personA.expectedStatePension || STATE_PENSION_DEFAULTS.fullAmount,
      
      // DC details
      dcPot: state.personA.dcPot || 0,
      dcMonthlyContrib: state.personA.dcMonthlyContrib || 0,
      dcAnnualContrib: state.personA.dcAnnualContrib || 0,
      
      // DB details
      dbAnnualIncome: state.personA.dbAnnualIncome || 0,
      dbStartAge: state.personA.dbStartAge || state.personA.retirementAge,
      dbEscalation: state.personA.dbEscalation || 'cpi'
    },
    targetNetIncome: state.targetNetIncome || 0
  };

  // Add personB for couples
  if (state.householdType === HOUSEHOLD_TYPES.COUPLE && state.personB) {
    plan.personB = {
      name: state.personB.name || 'Partner',
      currentAge: state.personB.currentAge,
      retirementAge: state.personB.retirementAge || state.personB.currentAge + 10,
      pensionTypes: state.personB.pensionTypes || [],
      
      // State Pension
      statePensionAge: state.personB.statePensionAge || STATE_PENSION_DEFAULTS.age,
      expectedStatePension: state.personB.expectedStatePension || STATE_PENSION_DEFAULTS.fullAmount,
      
      // DC details
      dcPot: state.personB.dcPot || 0,
      dcMonthlyContrib: state.personB.dcMonthlyContrib || 0,
      dcAnnualContrib: state.personB.dcAnnualContrib || 0,
      
      // DB details
      dbAnnualIncome: state.personB.dbAnnualIncome || 0,
      dbStartAge: state.personB.dbStartAge || state.personB.retirementAge,
      dbEscalation: state.personB.dbEscalation || 'cpi'
    };
  }

  return plan;
}
