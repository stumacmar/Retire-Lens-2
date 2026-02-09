    // Core projection engine (existing)
    import { createPlan, runProjection, comparePlans, generateDebugOutput } from './engine/projections.js';
    import { createAssumptions } from './config/defaults.js';
    
    // Import all engine modules with correct exports
    import { createUserAssumptions, SCENARIO_PRESETS, DEFAULT_ASSUMPTIONS } from './engine/assumptions.js';
    import { generateBenchmarkAnalysis } from './engine/benchmarking.js';
    import { createDBPension, calculateDBIncomeAtAge } from './engine/dbPension.js';
    import { createHealthcarePlan, projectHealthcareCosts } from './engine/healthcareCosts.js';
    import { createHousehold, createPerson } from './engine/household.js';
    import { calculateFutureIncome, calculatePresentIncome, calculateInflationSeries } from './engine/inflationAdjustment.js';
    import { generateInsights } from './engine/insightsEngine.js';
    import { createLegacyPlan, calculateInheritanceTax, projectEstateValue } from './engine/legacyPlanning.js';
    import { createMilestone, integrateMilestonesIntoSpending, calculateMilestoneImpact } from './engine/milestones.js';
    import { runMonteCarlo, runMonteCarloWithBands, generateConfidenceBands } from './engine/monteCarlo.js';
    import { createPhasedRetirement, calculatePhasedRetirementImpact } from './engine/phasedRetirement.js';
    import { calculateReadinessScore, generateActionPlan } from './engine/readinessScore.js';
    import { generateRecommendations, formatRecommendationsForDisplay } from './engine/recommendations.js';
    import { calculateRiskScore, generateRiskRecommendations } from './engine/riskScoring.js';
    import { calculateSpendingAtAge, createSpendingRules } from './engine/spendingPolicy.js';
    import { calculateIncomeTax, calculateTaxFromGross } from './engine/tax.js';
    import { analyzePCLSTiming, analyzeWithdrawalSequencing, generateTaxEfficiencyReport } from './engine/taxOptimizer.js';
    import { calculatePCLS, calculateOptimalWithdrawal, calculatePCLSStrategy, projectPCLSReinvestment, PCLS_STRATEGIES } from './engine/withdrawals.js';
    
    // Import config modules
    import { SCENARIOS, getScenarioById } from './config/scenarios.js';
    import { POT_SIZE_BENCHMARKS, INCOME_BENCHMARKS } from './config/benchmarkData.js';
    
    // Import UI components
    // Note: renderConfidenceExplainer is now in monteCarloCharts.js (consolidated from confidenceExplainer.js)
    import { renderFanChart, renderDepletionHistogram, renderAllCharts, renderConfidenceExplainer } from './ui/components/monteCarloCharts.js';
    
    // Import new UX modules
    import { FEATURE_FLAGS, isFeatureEnabled } from './src/ux/config.js';
    import { PATHFINDER_QUESTIONS, JOURNEYS, MODES, scoreToJourney, scoreToMode, getRouting } from './src/ux/pathfinder/questions.js';
    import { JOURNEY_CONFIG, getJourney, getJourneySteps } from './src/ux/journeys/journeys.js';
    import { MODE_CONFIG, getMode, getModeSteps, isFieldHidden } from './src/ux/modes/modes.js';
    import { estimatePreview, formatPreviewCurrency, formatGapSurplus } from './src/ux/preview/estimate.js';
    
    // Import enhanced tax engine with tests
    import { computeUKTax, runTaxTests } from './engine/tax.js';
    
    // Import couples-first household engine
    import { createInitialOnboardingState, validateOnboardingState, onboardingToHouseholdPlan, ONBOARDING_STEPS } from './src/ux/onboarding/flow.js';
    import { createHouseholdPlan, validateHouseholdPlan, HOUSEHOLD_TYPES, PENSION_TYPES } from './engine/householdPlan.js';
    import { generateTickerMessages, formatTickerDisplay } from './ui/components/bottomTicker.js';
    
    // Import couples input component
    import { renderCouplesInputTabs } from './ui/components/couplesInput.js';
    
    // ═══════════════════════════════════════════════════════════════
    // Configuration Constants
    // ═══════════════════════════════════════════════════════════════
    
    const MODEL_VERSION = 'v0.9.3';
    
    // ═══════════════════════════════════════════════════════════════
    // State Management
    // ═══════════════════════════════════════════════════════════════
    
    const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';
    
    const state = {
      currentScreen: 'household-type',  // REFACTOR: Changed from 'welcome' to 'household-type'
      formData: {},
      planA: null,
      projectionA: null,
      planB: null,
      projectionB: null,
      // New pathfinder state
      pathfinderAnswers: {},
      pathfinderCurrentQuestion: 0,
      journey: null,
      mode: 'full', // Default to full mode (was previously selected via mode-select screen)
      // Couples-first onboarding state
      onboardingState: null,
      // Track which person we're collecting pension types for (for couples)
      pensionTypesFor: 'personA', // 'personA' or 'personB'
      // Provisional plan tracking
      isProvisionalPlan: false,
      provisionalReason: null
    };
    
    // Initialize onboarding state on app start
    state.onboardingState = createInitialOnboardingState();
    
    function debugLog(category, message, data = null) {
      if (!DEBUG) return;
      console.log(`[${category}] ${message}`, data || '');
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Display Formatting Helpers
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Format impact value from recommendation object
     * Handles both string and object impact properties
     */
    function formatImpactValue(impact) {
      if (typeof impact === 'object' && impact !== null) {
        return impact.value || JSON.stringify(impact);
      }
      return impact;
    }
    
    /**
     * Extract readable text from recommendation object
     * Tries multiple fields: message, recommendation, title, or issue
     */
    function extractRecommendationText(rec) {
      if (typeof rec === 'object' && rec !== null) {
        return rec.message || rec.recommendation || rec.title || rec.issue || JSON.stringify(rec);
      }
      return rec;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Navigation - Updated with Pathfinder and Mode Select
    // ═══════════════════════════════════════════════════════════════
    
    // Base screen order (will be filtered based on mode)
    const ALL_SCREENS = [
      'welcome', 'pathfinder', 'mode-select', 
      'household-type', 'pension-types',  // NEW onboarding screens
      'age', 'retirement-age', 'income-target', 
      'pension-pot', 'contributions', 'isa-savings', 
      'state-pension', 'review', 'results', 'compare'
    ];
    
    // Get active screen order based on feature flags and mode
    function getActiveScreenOrder() {
      let screens = [];
      
      // REFACTOR: Start with household-type (no splash/welcome screen)
      screens.push('household-type');
      
      // REFACTOR: Skip pension-types screen - now collected in household details
      // Add couples input screen if household type is couple
      if (state.onboardingState?.householdType === HOUSEHOLD_TYPES.COUPLE || 
          state.onboardingState?.householdType === 'couple') {
        screens.push('couples-input');
        // For couples, they've entered everything in couples-input
        // Go directly to review
      } else {
        // For singles, add the normal wizard screens
        // Skip pathfinder and mode-select for now (can be re-enabled later)
        screens.push('age', 'retirement-age', 'income-target', 'pension-pot', 'contributions');
        
        // Optionally add ISA and state pension screens
        if (isFeatureEnabled('GUIDED_MODE') || state.mode === 'guided' || state.mode === 'full') {
          screens.push('isa-savings', 'state-pension');
        }
      }
      
      // Always add review, results, compare
      screens.push('review', 'results', 'compare');
      
      return screens;
    }
    
    // For backward compatibility
    let SCREEN_ORDER = getActiveScreenOrder();
    
    function showScreen(screenId) {
      debugLog('NAV', `Showing screen: ${screenId}`);
      
      document.querySelectorAll('.screen').forEach(el => {
        el.classList.remove('active');
        el.setAttribute('aria-hidden', 'true');
      });
      
      const screen = document.getElementById(`screen-${screenId}`);
      if (screen) {
        screen.classList.add('active');
        screen.setAttribute('aria-hidden', 'false');
        
        const input = screen.querySelector('input');
        if (input) input.focus();
      }
      
      // Update progress
      const progress = ((SCREEN_ORDER.indexOf(screenId) + 1) / SCREEN_ORDER.length) * 100;
      document.getElementById('progress-bar').style.width = `${progress}%`;
      
      state.currentScreen = screenId;
      
      // Show/hide preview card based on screen
      const previewCard = document.getElementById('answer-preview-card');
      const appContainer = document.querySelector('.app-container');
      const inputScreens = ['age', 'retirement-age', 'income-target', 'pension-pot', 'contributions', 'isa-savings', 'state-pension'];
      
      if (isFeatureEnabled('PREVIEW_CARD') && inputScreens.includes(screenId)) {
        previewCard?.classList.remove('hidden');
        appContainer?.classList.add('has-preview');
        updatePreviewCard();
      } else {
        previewCard?.classList.add('hidden');
        appContainer?.classList.remove('has-preview');
      }
      
      // Update ticker for onboarding screens
      updateTicker();
      
      // Update pension types screen content when shown
      if (screenId === 'pension-types') {
        updatePensionTypesScreen();
      }
      
      // Initialize couples input component when shown
      if (screenId === 'couples-input') {
        initializeCouplesInput();
      }
      
      // Hide advanced options for non-full modes
      if (screenId === 'review') {
        const advancedContainer = document.getElementById('advanced-options-container');
        const scenarioSelect = document.getElementById('scenario-select')?.closest('.input-group');
        
        if (state.mode === 'quick') {
          advancedContainer?.style && (advancedContainer.style.display = 'none');
          scenarioSelect?.style && (scenarioSelect.style.display = 'none');
        } else if (state.mode === 'guided') {
          advancedContainer?.style && (advancedContainer.style.display = 'none');
          scenarioSelect?.style && (scenarioSelect.style.display = 'block');
        } else {
          advancedContainer?.style && (advancedContainer.style.display = 'block');
          scenarioSelect?.style && (scenarioSelect.style.display = 'block');
        }
        
        renderReviewSummary();
      }
    }
    
    function nextScreen() {
      SCREEN_ORDER = getActiveScreenOrder();
      const currentIndex = SCREEN_ORDER.indexOf(state.currentScreen);
      if (currentIndex < SCREEN_ORDER.length - 1) {
        showScreen(SCREEN_ORDER[currentIndex + 1]);
      }
    }
    
    function prevScreen() {
      SCREEN_ORDER = getActiveScreenOrder();
      const currentIndex = SCREEN_ORDER.indexOf(state.currentScreen);
      if (currentIndex > 0) {
        showScreen(SCREEN_ORDER[currentIndex - 1]);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Bottom Ticker Update Function
    // ═══════════════════════════════════════════════════════════════
    
    function updateTicker() {
      const ticker = document.getElementById('bottom-ticker');
      const tickerMessages = document.getElementById('ticker-messages');
      
      if (!ticker || !tickerMessages) return;
      
      // Only show ticker during onboarding screens
      const onboardingScreens = ['household-type', 'pension-types', 'age', 'retirement-age', 'income-target', 'pension-pot'];
      const isOnboarding = onboardingScreens.includes(state.currentScreen);
      
      if (isOnboarding && state.onboardingState) {
        const { messages } = generateTickerMessages(state.onboardingState);
        const displayMessages = formatTickerDisplay(messages, 3);
        
        if (displayMessages.length > 0) {
          tickerMessages.innerHTML = displayMessages.join(' • ');
          ticker.classList.add('active');
        } else {
          ticker.classList.remove('active');
        }
      } else {
        ticker.classList.remove('active');
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Onboarding Handlers
    // ═══════════════════════════════════════════════════════════════
    
    function selectHouseholdType(type) {
      state.onboardingState.householdType = type;
      debugLog('ONBOARDING', `Household type selected: ${type}`);
      
      // Update UI
      document.querySelectorAll('.household-type-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.householdType === type);
      });
      
      // Initialize person objects if needed
      if (!state.onboardingState.personA) {
        state.onboardingState.personA = { pensionTypes: [] };
      }
      if (type === HOUSEHOLD_TYPES.COUPLE && !state.onboardingState.personB) {
        state.onboardingState.personB = { pensionTypes: [] };
      }
      
      // Auto-advance after short delay
      setTimeout(() => {
        // REFACTOR: Skip pension-types screen, go directly to appropriate next screen
        SCREEN_ORDER = getActiveScreenOrder();
        nextScreen();
      }, 400);
    }
    
    function updatePensionTypesScreen() {
      const title = document.getElementById('pension-types-title');
      const subtitle = document.getElementById('pension-types-subtitle');
      
      if (state.pensionTypesFor === 'personA') {
        if (state.onboardingState.householdType === HOUSEHOLD_TYPES.COUPLE) {
          title.textContent = 'Your pension type';
          subtitle.textContent = 'Select all that apply';
        } else {
          title.textContent = 'What type of pension do you have?';
          subtitle.textContent = 'Select all that apply';
        }
      } else if (state.pensionTypesFor === 'personB') {
        title.textContent = "Your partner's pension type";
        subtitle.textContent = 'Select all that apply';
      }
      
      // Clear existing selections
      document.querySelectorAll('input[name="pension-type"]').forEach(input => {
        input.checked = false;
      });
    }
    
    function handlePensionTypeChange() {
      const checkboxes = document.querySelectorAll('input[name="pension-type"]');
      const nextBtn = document.getElementById('pension-types-next-btn');
      
      // Handle "both" checkbox logic
      const bothCheckbox = document.getElementById('pension-both');
      const dcCheckbox = document.getElementById('pension-dc');
      const dbCheckbox = document.getElementById('pension-db');
      
      if (bothCheckbox.checked) {
        // If "both" is checked, automatically check DC and DB
        dcCheckbox.checked = true;
        dbCheckbox.checked = true;
      }
      
      // Get selected types after handling "both" logic
      const selectedTypes = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value)
        .filter(t => t !== 'both'); // Exclude 'both' from final list, keep dc and db
      
      // Enable next button if at least one type is selected
      nextBtn.disabled = selectedTypes.length === 0;
      
      // Store selections
      const person = state.pensionTypesFor === 'personA' ? 'personA' : 'personB';
      state.onboardingState[person].pensionTypes = selectedTypes;
      
      // Update partner follow-up fields visibility when selecting partner pension types
      if (state.pensionTypesFor === 'personB') {
        updatePartnerFollowupFields();
      }
      
      debugLog('ONBOARDING', `Pension types for ${person}: ${selectedTypes.join(', ')}`);
    }
    
    function advancePensionTypesScreen() {
      // If couple and we just finished Person A, show screen again for Person B
      if (state.onboardingState.householdType === HOUSEHOLD_TYPES.COUPLE && 
          state.pensionTypesFor === 'personA') {
        state.pensionTypesFor = 'personB';
        updatePensionTypesScreen();
        // Show partner follow-up fields
        updatePartnerFollowupFields();
        // Stay on same screen, just update content
        showScreen('pension-types');
      } else {
        // Save partner follow-up field values before moving on
        if (state.pensionTypesFor === 'personB') {
          savePartnerFollowupValues();
        }
        // Move to next screen (age)
        state.pensionTypesFor = 'personA'; // Reset for next time
        nextScreen();
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Pension Type Explainer Accordion
    // ═══════════════════════════════════════════════════════════════
    
    function togglePensionExplainer(type) {
      const explainer = document.getElementById(`explainer-${type}`);
      if (!explainer) return;
      
      // Close other explainers first (only one can be open)
      document.querySelectorAll('.pension-explainer-content.expanded').forEach(el => {
        if (el.id !== `explainer-${type}`) {
          el.classList.remove('expanded');
        }
      });
      
      // Toggle this explainer
      explainer.classList.toggle('expanded');
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Partner Follow-up Fields
    // ═══════════════════════════════════════════════════════════════
    
    function updatePartnerFollowupFields() {
      const followupContainer = document.getElementById('partner-followup-fields');
      const dcFields = document.getElementById('partner-dc-fields');
      const dbFields = document.getElementById('partner-db-fields');
      const spFields = document.getElementById('partner-sp-fields');
      const followupTitle = document.getElementById('partner-followup-title');
      
      if (!followupContainer) return;
      
      // Only show for partner (personB)
      if (state.pensionTypesFor !== 'personB') {
        followupContainer.classList.remove('visible');
        return;
      }
      
      // Always show partner followup fields when collecting personB info
      followupContainer.classList.add('visible');
      followupTitle.textContent = "Partner's details";
      
      const personB = state.onboardingState.personB;
      const pensionTypes = personB?.pensionTypes || [];
      
      const hasDC = pensionTypes.includes('dc') || pensionTypes.includes('both');
      const hasDB = pensionTypes.includes('db') || pensionTypes.includes('both');
      const hasAnyPension = pensionTypes.length > 0 && !pensionTypes.includes('notSure');
      
      // Show/hide specific pension field groups based on pension types selected
      dcFields.style.display = hasDC ? 'block' : 'none';
      dbFields.style.display = hasDB ? 'block' : 'none';
      spFields.style.display = hasAnyPension ? 'block' : 'none';
      
      // Set default DB start age to partner's retirement age if available
      const dbStartAgeInput = document.getElementById('input-partner-db-start-age');
      if (dbStartAgeInput && personB?.retirementAge) {
        dbStartAgeInput.value = personB.retirementAge;
      }
    }
    
    function savePartnerFollowupValues() {
      const personB = state.onboardingState.personB;
      if (!personB) return;
      
      // Save partner's basic age info
      personB.currentAge = getValue('input-partner-age', 0);
      personB.retirementAge = getValue('input-partner-retirement-age', 0);
      
      const pensionTypes = personB.pensionTypes || [];
      const hasDC = pensionTypes.includes('dc') || pensionTypes.includes('both');
      const hasDB = pensionTypes.includes('db') || pensionTypes.includes('both');
      
      // Save DC values
      if (hasDC) {
        personB.dcPot = getValue('input-partner-dc-pot', 0);
        personB.dcMonthlyContrib = getValue('input-partner-dc-contrib', 0);
        personB.dcAnnualContrib = personB.dcMonthlyContrib * 12;
      }
      
      // Save DB values
      if (hasDB) {
        personB.dbAnnualIncome = getValue('input-partner-db-amount', 0);
        personB.dbStartAge = getValue('input-partner-db-start-age', 67);
      }
      
      // Save State Pension values
      const spUnknown = document.getElementById('partner-sp-unknown')?.checked;
      if (spUnknown) {
        personB.statePensionUnknown = true;
        personB.expectedStatePension = 0;
      } else {
        personB.statePensionUnknown = false;
        personB.statePensionAge = getValue('input-partner-sp-age', 67);
        personB.expectedStatePension = getValue('input-partner-sp-amount', 11500);
      }
      
      debugLog('ONBOARDING', 'Saved partner follow-up values', personB);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Couples Input Tab Component Initialization
    // ═══════════════════════════════════════════════════════════════
    
    let couplesInputComponent = null;
    
    function initializeCouplesInput() {
      const container = document.getElementById('couples-input-container');
      if (!container) {
        console.error('Couples input container not found');
        return;
      }
      
      // Prepare initial data from onboarding state
      const initialData = {
        householdType: 'couple',
        personA: state.onboardingState?.personA || {},
        personB: state.onboardingState?.personB || {},
        targetNetIncome: state.onboardingState?.targetNetIncome || 40000
      };
      
      // Render the component
      couplesInputComponent = renderCouplesInputTabs(
        container,
        handleCouplesInputUpdate,
        initialData
      );
      
      debugLog('COUPLES_INPUT', 'Couples input component initialized');
    }
    
    function handleCouplesInputUpdate(householdData) {
      debugLog('COUPLES_INPUT', 'Data updated', householdData);
      
      // Update onboarding state with new data
      if (state.onboardingState) {
        state.onboardingState.personA = { ...state.onboardingState.personA, ...householdData.personA };
        state.onboardingState.personB = { ...state.onboardingState.personB, ...householdData.personB };
        state.onboardingState.targetNetIncome = householdData.targetNetIncome;
      }
      
      // Validate and enable/disable next button
      updateCouplesInputNextButton();
    }
    
    function updateCouplesInputNextButton() {
      const nextBtn = document.getElementById('couples-input-next-btn');
      if (!nextBtn) return;
      
      // Basic validation: check if both people have ages entered
      const personA = state.onboardingState?.personA;
      const personB = state.onboardingState?.personB;
      
      const isValid = 
        personA?.currentAge >= 18 &&
        personA?.retirementAge > personA.currentAge &&
        personB?.currentAge >= 18 &&
        personB?.retirementAge > personB.currentAge &&
        state.onboardingState?.targetNetIncome > 0;
      
      nextBtn.disabled = !isValid;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Calculate Button Validation and Gating
    // ═══════════════════════════════════════════════════════════════
    
    /**
     * Validate if we can calculate - returns { canCalculate, reason, isProvisional, provisionalReason }
     */
    function validateCanCalculate() {
      const result = {
        canCalculate: true,
        reason: null,
        isProvisional: false,
        provisionalReason: null
      };
      
      // Person A (main user) requirements
      const personA = state.onboardingState?.personA;
      const currentAge = getValue('input-current-age', 0);
      const retirementAge = getValue('input-retirement-age', 0);
      const targetIncome = getValue('input-target-income', 0);
      const pensionPot = getValue('input-pension-pot', 0);
      
      // Check Person A basic fields
      if (!currentAge || currentAge < 18 || currentAge > 100) {
        result.canCalculate = false;
        result.reason = "One more detail needed: your current age";
        return result;
      }
      
      if (!retirementAge || retirementAge <= currentAge) {
        result.canCalculate = false;
        result.reason = "One more detail needed: your target retirement age";
        return result;
      }
      
      if (!targetIncome || targetIncome <= 0) {
        result.canCalculate = false;
        result.reason = "One more detail needed: your target income";
        return result;
      }
      
      // Check pension type is selected for Person A
      // When the pension-types screen is skipped (single flow), default to 'dc'
      const personAPensionTypes = personA?.pensionTypes || [];
      if (personAPensionTypes.length === 0) {
        // Auto-assign 'dc' if pension pot was entered (pension-types screen was skipped)
        if (personA && pensionPot > 0) {
          personA.pensionTypes = ['dc'];
        } else if (personA) {
          personA.pensionTypes = ['dc'];
        } else {
          result.canCalculate = false;
          result.reason = "One more detail needed: your pension type";
          return result;
        }
      }
      
      // Check DC pot if Person A has DC
      const personAHasDC = personAPensionTypes.includes('dc') || personAPensionTypes.includes('both');
      if (personAHasDC && (pensionPot === undefined || pensionPot === null)) {
        result.canCalculate = false;
        result.reason = "One more detail needed: your pension pot value";
        return result;
      }
      
      // Check couples-specific requirements
      if (state.onboardingState?.householdType === HOUSEHOLD_TYPES.COUPLE) {
        const personB = state.onboardingState?.personB;
        
        // Partner age is required
        if (!personB?.currentAge || personB.currentAge < 18) {
          result.canCalculate = false;
          result.reason = "One more detail needed: partner's current age";
          return result;
        }
        
        // Partner pension type is required
        const personBPensionTypes = personB?.pensionTypes || [];
        if (personBPensionTypes.length === 0) {
          result.canCalculate = false;
          result.reason = "One more detail needed: partner's pension type";
          return result;
        }
        
        // Check if partner income amounts are unknown -> provisional
        const personBHasDC = personBPensionTypes.includes('dc') || personBPensionTypes.includes('both');
        const personBHasDB = personBPensionTypes.includes('db') || personBPensionTypes.includes('both');
        const personBNotSure = personBPensionTypes.includes('notSure');
        
        if (personBNotSure) {
          result.isProvisional = true;
          result.provisionalReason = "Provisional results — partner's pension type not specified.";
        } else if (personBHasDB && (!personB.dbAnnualIncome || personB.dbAnnualIncome === 0)) {
          result.isProvisional = true;
          result.provisionalReason = "Provisional results — partner's DB pension amount not yet included.";
        } else if (personBHasDC && (!personB.dcPot || personB.dcPot === 0) && (!personB.dcMonthlyContrib || personB.dcMonthlyContrib === 0)) {
          result.isProvisional = true;
          result.provisionalReason = "Provisional results — partner's DC pension details not yet included.";
        }
        
        if (personB.statePensionUnknown) {
          result.isProvisional = true;
          result.provisionalReason = result.provisionalReason || "Provisional results — partner's State Pension not specified.";
        }
      }
      
      return result;
    }
    
    /**
     * Update Calculate button state based on validation
     */
    function updateCalculateButtonState() {
      const calculateBtn = document.getElementById('calculate-btn');
      const reasonEl = document.getElementById('calculate-disabled-reason');
      
      if (!calculateBtn) return;
      
      const validation = validateCanCalculate();
      
      // Update button state
      calculateBtn.disabled = !validation.canCalculate;
      
      // Update reason message
      if (reasonEl) {
        if (!validation.canCalculate && validation.reason) {
          reasonEl.textContent = validation.reason;
          reasonEl.classList.add('visible');
        } else {
          reasonEl.textContent = '';
          reasonEl.classList.remove('visible');
        }
      }
      
      // Store provisional state for use when showing results
      state.isProvisionalPlan = validation.isProvisional;
      state.provisionalReason = validation.provisionalReason;
    }
    
    /**
     * Show/hide provisional banner on results screen
     */
    function updateProvisionalBanner() {
      const banner = document.getElementById('provisional-banner');
      const message = document.getElementById('provisional-banner-message');
      
      if (!banner) return;
      
      if (state.isProvisionalPlan && state.provisionalReason) {
        message.textContent = state.provisionalReason;
        banner.style.display = 'flex';
      } else {
        banner.style.display = 'none';
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Pathfinder Logic
    // ═══════════════════════════════════════════════════════════════
    
    function initPathfinder() {
      state.pathfinderAnswers = {};
      state.pathfinderCurrentQuestion = 0;
      renderPathfinderQuestion();
    }
    
    /**
     * Determine if a step should auto-advance (single-choice selection)
     * Auto-advance steps: pathfinder questions, mode selection cards
     * Non-auto-advance steps: numeric inputs, multi-field forms
     */
    function isAutoAdvanceStep(screenId) {
      const autoAdvanceScreens = ['pathfinder', 'mode-select'];
      return autoAdvanceScreens.includes(screenId);
    }
    
    function renderPathfinderQuestion() {
      const questionIndex = state.pathfinderCurrentQuestion;
      const question = PATHFINDER_QUESTIONS[questionIndex];
      
      if (!question) return;
      
      // Update question text
      document.getElementById('pathfinder-question-text').textContent = question.text;
      
      // Update progress dots
      const dots = document.querySelectorAll('.pathfinder-dot');
      dots.forEach((dot, i) => {
        dot.classList.remove('active', 'completed');
        if (i < questionIndex) dot.classList.add('completed');
        if (i === questionIndex) dot.classList.add('active');
      });
      
      // Render options
      const optionsContainer = document.getElementById('pathfinder-options');
      optionsContainer.innerHTML = question.options.map(opt => `
        <button type="button" class="pathfinder-option ${state.pathfinderAnswers[question.id] === opt.value ? 'selected' : ''}" 
                data-value="${opt.value}">
          ${opt.label}
        </button>
      `).join('');
      
      // Add click handlers
      optionsContainer.querySelectorAll('.pathfinder-option').forEach(btn => {
        btn.addEventListener('click', () => {
          selectPathfinderOption(question.id, btn.dataset.value);
        });
      });
      
      // Show/hide back button
      document.getElementById('pathfinder-back-btn').style.visibility = questionIndex > 0 ? 'visible' : 'hidden';
      
      // Hide Next button for auto-advance screens (tap option advances immediately)
      // Pathfinder is always an auto-advance screen (single-choice options)
      const nextBtn = document.getElementById('pathfinder-next-btn');
      if (isAutoAdvanceStep(state.currentScreen)) {
        nextBtn.style.display = 'none';
      } else {
        nextBtn.style.display = '';
        nextBtn.disabled = !state.pathfinderAnswers[question.id];
      }
    }
    
    function selectPathfinderOption(questionId, value) {
      state.pathfinderAnswers[questionId] = value;
      
      // Update UI
      document.querySelectorAll('.pathfinder-option').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.value === value);
      });
      
      // Auto-advance after short delay (Next button is hidden for auto-advance screens)
      setTimeout(() => {
        advancePathfinder();
      }, 200);
    }
    
    function advancePathfinder() {
      if (state.pathfinderCurrentQuestion < PATHFINDER_QUESTIONS.length - 1) {
        state.pathfinderCurrentQuestion++;
        renderPathfinderQuestion();
      } else {
        // Complete pathfinder - calculate routing
        const routing = getRouting(state.pathfinderAnswers, getValue('input-current-age', null));
        state.journey = routing.journey;
        state.mode = routing.mode;
        
        debugLog('PATHFINDER', 'Routing complete', routing);
        
        // Update screen order based on mode
        SCREEN_ORDER = getActiveScreenOrder();
        
        // Move to mode select
        showScreen('mode-select');
        initModeSelect();
      }
    }
    
    function goBackPathfinder() {
      if (state.pathfinderCurrentQuestion > 0) {
        state.pathfinderCurrentQuestion--;
        renderPathfinderQuestion();
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Mode Select Logic
    // ═══════════════════════════════════════════════════════════════
    
    function initModeSelect() {
      // Update journey badge
      const journey = getJourney(state.journey);
      document.getElementById('journey-emoji').textContent = journey.emoji;
      document.getElementById('journey-title').textContent = journey.title;
      
      // Mark recommended mode
      document.querySelectorAll('.mode-card[data-mode]').forEach(card => {
        card.classList.remove('selected', 'recommended');
        if (card.dataset.mode === journey.recommendedMode) {
          card.classList.add('recommended');
        }
        if (card.dataset.mode === state.mode) {
          card.classList.add('selected');
        }
      });
      
      // Hide Continue button - mode-select is now auto-advance (selecting a card advances immediately)
      const nextBtn = document.getElementById('mode-select-next-btn');
      if (nextBtn) {
        nextBtn.style.display = 'none';
      }
    }
    
    function selectMode(modeId) {
      state.mode = modeId;
      
      // Update screen order
      SCREEN_ORDER = getActiveScreenOrder();
      
      // Update UI
      document.querySelectorAll('.mode-card[data-mode]').forEach(card => {
        card.classList.toggle('selected', card.dataset.mode === modeId);
      });
      
      debugLog('MODE', `Selected mode: ${modeId}`);
      
      // Auto-advance after short delay (like pathfinder)
      // Hide the Continue button since auto-advance handles navigation
      const nextBtn = document.getElementById('mode-select-next-btn');
      if (nextBtn) {
        nextBtn.style.display = 'none';
      }
      
      setTimeout(() => {
        nextScreen();
      }, 300);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Answer Preview Card Logic
    // ═══════════════════════════════════════════════════════════════
    
    let previewDebounceTimer = null;
    
    function updatePreviewCard() {
      // Debounce updates
      clearTimeout(previewDebounceTimer);
      previewDebounceTimer = setTimeout(() => {
        const inputs = {
          currentAge: getValue('input-current-age', 0),
          retirementAge: getValue('input-retirement-age', 0),
          targetNetIncome: getValue('input-target-income', 0),
          currentPension: getValue('input-pension-pot', 0),
          annualPensionContribution: getValue('input-pension-contribution', 0) * 12,
          currentIsa: getValue('input-isa-balance', 0),
          annualIsaContribution: getValue('input-isa-contribution', 0),
          expectedStatePension: getValue('input-state-pension-amount', 0),
          statePensionAge: getValue('input-state-pension-age', 67)
        };
        
        const preview = estimatePreview(inputs);
        
        // Update retire age
        document.getElementById('preview-retire-age').textContent = 
          inputs.retirementAge ? inputs.retirementAge : '—';
        
        // Update target
        document.getElementById('preview-target').textContent = 
          inputs.targetNetIncome ? formatPreviewCurrency(inputs.targetNetIncome) : '—';
        
        if (preview.isComplete) {
          // Update projected pot
          document.getElementById('preview-pot').textContent = 
            formatPreviewCurrency(preview.projectedPotAtRetirement);
          
          // Update gap/surplus
          const gapEl = document.getElementById('preview-gap');
          const gapFormatted = formatGapSurplus(preview.gapOrSurplus);
          gapEl.textContent = gapFormatted.text;
          gapEl.className = `preview-value ${gapFormatted.class}`;
          
          // Hide hint
          document.getElementById('preview-hint').style.display = 'none';
        } else {
          // Show placeholder values
          document.getElementById('preview-pot').textContent = '—';
          document.getElementById('preview-gap').textContent = '—';
          document.getElementById('preview-gap').className = 'preview-value neutral';
          
          // Show hint if needed
          const hint = document.getElementById('preview-hint');
          if (preview.hint) {
            hint.textContent = preview.hint;
            hint.style.display = 'block';
          } else {
            hint.style.display = 'none';
          }
        }
      }, 150);
    }
    
    function togglePreviewTooltip() {
      const tooltip = document.getElementById('preview-tooltip');
      tooltip.classList.toggle('visible');
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Form Handling
    // ═══════════════════════════════════════════════════════════════
    
    function getValue(id, defaultVal = 0) {
      const el = document.getElementById(id);
      if (!el) return defaultVal;
      const val = parseFloat(el.value);
      return isNaN(val) ? defaultVal : val;
    }
    
    function getChecked(id) {
      const el = document.getElementById(id);
      return el ? el.checked : false;
    }
    
    function getSelectedValue(id, defaultVal = '') {
      const el = document.getElementById(id);
      return el ? el.value : defaultVal;
    }
    
    function collectFormData() {
      return {
        // Basic inputs
        currentAge: getValue('input-current-age'),
        retirementAge: getValue('input-retirement-age'),
        targetNetIncome: getValue('input-target-income'),
        currentPension: getValue('input-pension-pot', 0),
        annualPensionContribution: getValue('input-pension-contribution', 0) * 12,
        currentIsa: getValue('input-isa-balance', 0),
        annualIsaContribution: getValue('input-isa-contribution', 0),
        statePensionAge: getValue('input-state-pension-age', 67),
        expectedStatePension: getValue('input-state-pension-amount', 11500),
        
        // Advanced options
        scenario: getSelectedValue('scenario-select', 'moderate'),
        enableMonteCarlo: getChecked('enable-monte-carlo'),
        enableBenchmarking: getChecked('enable-benchmarking'),
        enableTaxOptimization: getChecked('enable-tax-optimization'),
        modelCareCosts: getChecked('model-care-costs'),
        
        // DB Pension
        hasDBPension: getChecked('has-db-pension'),
        dbPensionAmount: getValue('db-pension-amount', 0),
        dbPensionStartAge: getValue('db-pension-start-age', 65),
        
        // Couple mode - will be populated from onboarding state
        isCouple: false,
        householdType: null,
        personA: null,
        personB: null,
        
        // Phased retirement
        isPhasedRetirement: getChecked('is-phased-retirement'),
        phaseStartAge: getValue('phase-start-age', 0),
        reducedHours: getValue('reduced-hours', 50),
        
        // PCLS Strategy
        pclsStrategy: getSelectedValue('pcls-strategy', 'all_at_retirement'),
        pclsReinvest: getChecked('pcls-reinvest')
      };
    }
    
    function showError(message) {
      const el = document.getElementById('error-message');
      el.textContent = message;
      el.classList.add('visible');
      setTimeout(() => el.classList.remove('visible'), 3000);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Review Screen
    // ═══════════════════════════════════════════════════════════════
    
    function renderReviewSummary() {
      const data = collectFormData();
      state.formData = data;
      
      // Bridge onboarding state to the form data
      if (state.onboardingState?.personA) {
        state.onboardingState.personA.currentAge = data.currentAge;
        state.onboardingState.personA.retirementAge = data.retirementAge;
        state.onboardingState.personA.dcPot = data.currentPension;
        state.onboardingState.personA.dcMonthlyContrib = data.annualPensionContribution / 12;
        state.onboardingState.personA.dcAnnualContrib = data.annualPensionContribution;
        state.onboardingState.targetNetIncome = data.targetNetIncome;
      }
      
      // Include couple info if applicable
      let coupleHTML = '';
      if (state.onboardingState?.householdType === HOUSEHOLD_TYPES.COUPLE && state.onboardingState.personB) {
        const personB = state.onboardingState.personB;
        coupleHTML = `
          <div class="results-metrics" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border);">
            <div class="metric">
              <span class="metric-label">Partner Age</span>
              <span class="metric-value">${personB.currentAge || '—'}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Partner Pension</span>
              <span class="metric-value">${personB.pensionTypes?.join('+').toUpperCase() || '—'}</span>
            </div>
          </div>
        `;
      }
      
      const html = `
        <div class="results-metrics" style="margin-bottom: 1rem;">
          <div class="metric">
            <span class="metric-label">Current Age</span>
            <span class="metric-value">${data.currentAge}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Retire At</span>
            <span class="metric-value">${data.retirementAge}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Target Income</span>
            <span class="metric-value">£${data.targetNetIncome.toLocaleString()}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Pension Pot</span>
            <span class="metric-value">£${data.currentPension.toLocaleString()}</span>
          </div>
        </div>
        ${coupleHTML}
      `;
      
      document.getElementById('review-summary').innerHTML = html;
      
      // Update Calculate button state based on validation
      updateCalculateButtonState();
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Results Rendering
    // ═══════════════════════════════════════════════════════════════
    
    function formatCurrency(amount) {
      // Guard against null, undefined, NaN, and non-numbers
      if (amount === null || amount === undefined || typeof amount !== 'number' || isNaN(amount)) {
        return '—';
      }
      return '£' + Math.round(amount).toLocaleString();
    }
    
    function renderResults(projection) {
      const { summary, plan } = projection;
      const withdrawalRate = (plan.targetNetIncome / summary.retirementPot) * 100;
      
      let sustainability = { label: 'Sustainable', color: '#22c55e', emoji: '✅' };
      if (withdrawalRate > 6) sustainability = { label: 'High Risk', color: '#ef4444', emoji: '❌' };
      else if (withdrawalRate > 5) sustainability = { label: 'Higher Risk', color: '#f97316', emoji: '⚠️' };
      else if (withdrawalRate > 4) sustainability = { label: 'Moderate Risk', color: '#f59e0b', emoji: '⚠️' };
      
      const isSuccess = summary.successRate >= 1.0;
      
      const html = `
        <div class="results-hero">
          <div class="answer-badge ${isSuccess ? 'success' : 'partial'}">
            ${isSuccess ? '✅ YES' : '⚠️ MAYBE'}
          </div>
          
          <h2 class="results-question">
            Can I retire at age ${plan.retirementAge} with ${formatCurrency(plan.targetNetIncome)} net income?
          </h2>
          
          <p class="results-confidence">
            Confidence: <strong>${(summary.successRate * 100).toFixed(0)}%</strong>
          </p>
          
          <div class="sustainability-indicator" style="color: ${sustainability.color}">
            ${sustainability.emoji} Withdrawal rate: ${withdrawalRate.toFixed(1)}% 
            <span class="sustainability-label">(${sustainability.label})</span>
          </div>
        </div>
        
        <div class="results-metrics">
          <div class="metric">
            <span class="metric-label">Retirement Pot</span>
            <span class="metric-value">${formatCurrency(summary.retirementPot)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Tax-Free Cash</span>
            <span class="metric-value">${formatCurrency(summary.pclsTaken)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Years Supported</span>
            <span class="metric-value">${summary.yearsWithFullIncome}/${summary.totalYearsInRetirement}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Final Balance</span>
            <span class="metric-value">${formatCurrency(summary.finalBalance)}</span>
          </div>
        </div>
        
        ${!isSuccess && summary.depletionAge ? `
          <div class="results-suggestion">
            <strong>💡 Suggestion:</strong> Funds may run out at age ${summary.depletionAge}. 
            Consider increasing contributions or reducing target income.
          </div>
        ` : ''}
      `;
      
      document.getElementById('results-container').innerHTML = html;
      
      // Render chart
      renderCapitalChart(projection);
      
      // Debug output
      if (DEBUG) {
        document.getElementById('debug-output').style.display = 'block';
        document.getElementById('debug-output').innerHTML = 
          `<pre class="debug-table">${generateDebugOutput(projection)}</pre>`;
      }
    }
    
    function renderCapitalChart(projection) {
      const canvas = document.getElementById('capital-chart');
      if (!canvas || typeof Chart === 'undefined') return;
      
      const existingChart = Chart.getChart(canvas);
      if (existingChart) existingChart.destroy();
      
      const accData = projection.accumulation.years.map(y => ({ x: y.age, y: y.endBalances.total }));
      const decData = projection.decumulation.years
        .filter(y => y.endBalances)
        .map(y => ({ x: y.age, y: y.endBalances.total }));
      
      const allData = [...accData, ...decData];
      
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: allData.map(d => d.x),
          datasets: [{
            label: 'Total Wealth',
            data: allData.map(d => d.y),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => formatCurrency(ctx.parsed.y)
              }
            }
          },
          scales: {
            x: { title: { display: true, text: 'Age' }},
            y: { 
              title: { display: true, text: 'Total Wealth (£)' },
              ticks: { callback: (v) => formatCurrency(v) }
            }
          }
        }
      });
    }
    
    /**
     * Format currency in compact notation for chart labels
     */
    function formatCompactCurrency(value) {
      // Guard against null, undefined, NaN, and non-numbers
      if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
        return '—';
      }
      if (value >= 1000000) return '£' + (value / 1000000).toFixed(1) + 'm';
      if (value >= 1000) return '£' + (value / 1000).toFixed(0) + 'k';
      return '£' + Math.round(value);
    }
    
    /**
     * Render the Annual Net Cashflow Chart (stacked bars by income source)
     */
    function renderCashflowChart(projection, data) {
      const canvas = document.getElementById('cashflow-chart');
      if (!canvas || typeof Chart === 'undefined') return;
      
      const existingChart = Chart.getChart(canvas);
      if (existingChart) existingChart.destroy();
      
      const decYears = projection.decumulation.years.filter(y => !y.fundsDepleted || y.netIncome > 0);
      const labels = decYears.map(y => y.age);
      
      // Prepare data by income source (all NET amounts)
      // Use comprehensive tax calculation for each year to handle progressive bands correctly
      const datasets = [];
      
      const spAmount = data.expectedStatePension || 0;
      const dbAmount = (data.hasDBPension && data.dbPensionAmount > 0) ? data.dbPensionAmount : 0;
      const dbStartAge = data.dbPensionStartAge || 65;
      
      // Calculate net amounts for each year using full tax context
      const yearlyNetAmounts = decYears.map(y => {
        const age = y.age;
        const hasStatePension = y.statePension > 0;
        const hasDbPension = dbAmount > 0 && age >= dbStartAge;
        const pensionWithdrawal = y.withdrawals?.pension || 0;
        const isaWithdrawal = y.withdrawals?.isa || 0;
        
        // Calculate tax on all taxable income together (correct progressive calculation)
        const taxResult = computeUKTax({
          statePension: hasStatePension ? spAmount : 0,
          dbPension: hasDbPension ? dbAmount : 0,
          pensionWithdrawal: pensionWithdrawal,
          isaWithdrawal: isaWithdrawal
        });
        
        const totalTaxableGross = (hasStatePension ? spAmount : 0) + (hasDbPension ? dbAmount : 0) + pensionWithdrawal;
        const totalTax = taxResult.incomeTax || 0;
        
        // Distribute tax proportionally across taxable sources
        const effectiveRate = totalTaxableGross > 0 ? totalTax / totalTaxableGross : 0;
        
        return {
          age,
          statePensionNet: hasStatePension ? Math.max(0, spAmount * (1 - effectiveRate)) : 0,
          dbPensionNet: hasDbPension ? Math.max(0, dbAmount * (1 - effectiveRate)) : 0,
          pensionWithdrawalNet: Math.max(0, pensionWithdrawal * (1 - effectiveRate)),
          isaNet: isaWithdrawal, // Tax-free
          totalTax
        };
      });
      
      // State Pension (taxable but shown as net portion)
      const statePensionData = yearlyNetAmounts.map(y => y.statePensionNet);
      datasets.push({
        label: 'State Pension',
        data: statePensionData,
        backgroundColor: '#22c55e',
        stack: 'income'
      });
      
      // DB Pension if present
      if (dbAmount > 0) {
        const dbData = yearlyNetAmounts.map(y => y.dbPensionNet);
        datasets.push({
          label: 'DB Pension',
          data: dbData,
          backgroundColor: '#3b82f6',
          stack: 'income'
        });
      }
      
      // Pension Withdrawals (net)
      const pensionWithdrawals = yearlyNetAmounts.map(y => y.pensionWithdrawalNet);
      datasets.push({
        label: 'Pension Withdrawal (net)',
        data: pensionWithdrawals,
        backgroundColor: '#f59e0b',
        stack: 'income'
      });
      
      // ISA Withdrawals (tax-free)
      const isaWithdrawals = yearlyNetAmounts.map(y => y.isaNet);
      datasets.push({
        label: 'ISA (tax-free)',
        data: isaWithdrawals,
        backgroundColor: '#8b5cf6',
        stack: 'income'
      });
      
      // PCLS display: Do NOT show PCLS as income spike - it's a transfer, not income
      // PCLS goes into ISA/cash bucket and is SPENT from there over time
      // The income chart should show the spending from PCLS bucket if used for spending
      // Otherwise, PCLS should not appear at all in the income chart (it's a balance transfer)
      
      // Only show PCLS spending if user selected 'spend_over_years' strategy (or legacy behavior)
      // For now: spread any PCLS over 5 years as "PCLS Spending" instead of a spike
      const pclsTaken = projection.decumulation.pclsTaken || 0;
      if (pclsTaken > 0) {
        // Spread PCLS spending over 5 years to avoid spike
        const pclsSpreadYears = 5;
        const pclsAnnualSpend = pclsTaken / pclsSpreadYears;
        const pclsData = decYears.map((y, i) => (i < pclsSpreadYears && pclsTaken > 0) ? pclsAnnualSpend : 0);
        
        datasets.push({
          label: 'PCLS Spending (tax-free)',
          data: pclsData,
          backgroundColor: '#10b981',
          stack: 'income'
        });
      }
      
      // Target income line
      const targetLine = decYears.map(() => data.targetNetIncome);
      datasets.push({
        label: 'Target Net Income',
        data: targetLine,
        type: 'line',
        borderColor: '#ef4444',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        order: 0
      });
      
      new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              position: 'bottom',
              labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatCompactCurrency(ctx.parsed.y)}`
              }
            }
          },
          scales: {
            x: { 
              title: { display: true, text: 'Age' },
              stacked: true
            },
            y: { 
              title: { display: true, text: 'Net Annual Income (£)' },
              stacked: true,
              ticks: { callback: (v) => formatCompactCurrency(v) }
            }
          }
        }
      });
    }
    
    /**
     * Render Tax Paid Per Year chart
     */
    function renderTaxChart(projection) {
      const canvas = document.getElementById('tax-chart');
      if (!canvas || typeof Chart === 'undefined') return;
      
      const existingChart = Chart.getChart(canvas);
      if (existingChart) existingChart.destroy();
      
      const decYears = projection.decumulation.years.filter(y => !y.fundsDepleted);
      const labels = decYears.map(y => y.age);
      const taxData = decYears.map(y => y.taxPaid || 0);
      
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Tax Paid',
            data: taxData,
            backgroundColor: 'rgba(239, 68, 68, 0.6)',
            borderColor: '#ef4444',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Tax: ${formatCompactCurrency(ctx.parsed.y)}`
              }
            }
          },
          scales: {
            x: { title: { display: false }},
            y: { 
              ticks: { callback: (v) => formatCompactCurrency(v) },
              beginAtZero: true
            }
          }
        }
      });
    }
    
    /**
     * Render Guaranteed Income Timeline (DB + State Pension)
     */
    function renderGuaranteedIncomeChart(projection, data) {
      const canvas = document.getElementById('guaranteed-income-chart');
      if (!canvas || typeof Chart === 'undefined') return;
      
      const existingChart = Chart.getChart(canvas);
      if (existingChart) existingChart.destroy();
      
      const startAge = data.retirementAge;
      const endAge = 90;
      const labels = [];
      const spData = [];
      const dbData = [];
      
      for (let age = startAge; age <= endAge; age++) {
        labels.push(age);
        spData.push(age >= data.statePensionAge ? data.expectedStatePension : 0);
        dbData.push(data.hasDBPension && age >= data.dbPensionStartAge ? data.dbPensionAmount : 0);
      }
      
      const datasets = [
        {
          label: 'State Pension',
          data: spData,
          backgroundColor: '#22c55e',
          stack: 'guaranteed'
        }
      ];
      
      if (data.hasDBPension && data.dbPensionAmount > 0) {
        datasets.push({
          label: 'DB Pension',
          data: dbData,
          backgroundColor: '#3b82f6',
          stack: 'guaranteed'
        });
      }
      
      new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } }},
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatCompactCurrency(ctx.parsed.y)}`
              }
            }
          },
          scales: {
            x: { 
              title: { display: true, text: 'Age' },
              stacked: true
            },
            y: { 
              title: { display: true, text: 'Annual Income (£)' },
              stacked: true,
              ticks: { callback: (v) => formatCompactCurrency(v) }
            }
          }
        }
      });
      
      // Populate details panel
      const detailsEl = document.getElementById('guaranteed-income-details');
      if (detailsEl) {
        let html = '<div style="padding: 0.5rem;">';
        html += `<p><strong>State Pension:</strong> ${formatCurrency(data.expectedStatePension)}/year from age ${data.statePensionAge}</p>`;
        if (data.hasDBPension && data.dbPensionAmount > 0) {
          html += `<p><strong>DB Pension:</strong> ${formatCurrency(data.dbPensionAmount)}/year from age ${data.dbPensionStartAge}</p>`;
        }
        const totalGuaranteed = data.expectedStatePension + (data.hasDBPension ? data.dbPensionAmount : 0);
        html += `<p style="margin-top: 0.5rem; font-weight: 600;">Total Guaranteed: ${formatCurrency(totalGuaranteed)}/year (when all sources active)</p>`;
        html += '</div>';
        detailsEl.innerHTML = html;
      }
    }
    
    /**
     * Render Income Sources Breakdown Panel
     */
    function renderIncomeSourcesBreakdown(projection, data) {
      const el = document.getElementById('income-sources-breakdown');
      if (!el) return;
      
      // Get first year of retirement for breakdown
      const firstYear = projection.decumulation.years[0];
      if (!firstYear) {
        el.innerHTML = '<p style="color: #6b7280;">No retirement data available</p>';
        return;
      }
      
      const sources = [
        { name: 'Pension Withdrawal', amount: firstYear.withdrawals?.pension || 0, taxable: true, color: '#f59e0b' },
        { name: 'ISA Withdrawal', amount: firstYear.withdrawals?.isa || 0, taxable: false, color: '#8b5cf6' },
        { name: 'State Pension', amount: firstYear.statePension || 0, taxable: true, color: '#22c55e' }
      ];
      
      if (data.hasDBPension && data.dbPensionAmount > 0 && firstYear.age >= data.dbPensionStartAge) {
        sources.push({ name: 'DB Pension', amount: data.dbPensionAmount, taxable: true, color: '#3b82f6' });
      }
      
      // Show PCLS as annual spending amount (spread over 5 years), not lump sum
      // This prevents the "spike" issue in income tables
      const pclsTaken = projection.decumulation.pclsTaken || 0;
      if (pclsTaken > 0) {
        const pclsAnnualSpend = pclsTaken / 5; // Spread over 5 years
        sources.push({ 
          name: 'PCLS Spending (5yr)', 
          amount: pclsAnnualSpend, 
          taxable: false, 
          color: '#10b981',
          note: `(from ${formatCurrency(pclsTaken)} total)`
        });
      }
      
      let html = '<div style="padding: 0.5rem;">';
      html += '<table style="width: 100%; border-collapse: collapse;">';
      html += '<thead><tr style="border-bottom: 2px solid #e5e7eb;"><th style="text-align: left; padding: 0.5rem;">Source</th><th style="text-align: right; padding: 0.5rem;">Amount</th><th style="text-align: center; padding: 0.5rem;">Tax Status</th></tr></thead>';
      html += '<tbody>';
      
      sources.forEach(s => {
        if (s.amount > 0) {
          const taxBadge = s.taxable 
            ? '<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">Taxable</span>'
            : '<span style="background: #d1fae5; color: #065f46; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">Tax-Free</span>';
          html += `<tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 0.5rem;"><span style="display: inline-block; width: 12px; height: 12px; background: ${s.color}; border-radius: 2px; margin-right: 8px;"></span>${s.name}</td>
            <td style="text-align: right; padding: 0.5rem; font-weight: 600;">${formatCurrency(s.amount)}</td>
            <td style="text-align: center; padding: 0.5rem;">${taxBadge}</td>
          </tr>`;
        }
      });
      
      const totalGross = sources.reduce((sum, s) => sum + s.amount, 0);
      const taxPaid = firstYear.taxPaid || 0;
      const totalNet = firstYear.netIncome || (totalGross - taxPaid);
      
      html += '</tbody>';
      html += `<tfoot>
        <tr style="border-top: 2px solid #e5e7eb;">
          <td style="padding: 0.5rem; font-weight: 600;">Total Gross</td>
          <td style="text-align: right; padding: 0.5rem; font-weight: 600;">${formatCurrency(totalGross)}</td>
          <td></td>
        </tr>
        <tr style="color: #ef4444;">
          <td style="padding: 0.5rem;">Less Tax</td>
          <td style="text-align: right; padding: 0.5rem;">-${formatCurrency(taxPaid)}</td>
          <td></td>
        </tr>
        <tr style="background: #f0fdf4; font-weight: 700;">
          <td style="padding: 0.5rem;">Net Income</td>
          <td style="text-align: right; padding: 0.5rem;">${formatCurrency(totalNet)}</td>
          <td></td>
        </tr>
      </tfoot>`;
      html += '</table></div>';
      
      el.innerHTML = html;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Comparison
    // ═══════════════════════════════════════════════════════════════
    
    function renderComparison(projA, projB) {
      const comparison = comparePlans(projA, projB);
      const { deltas } = comparison;
      
      const formatDelta = (val, isCurrency = true) => {
        const sign = val >= 0 ? '+' : '';
        return isCurrency ? sign + formatCurrency(val) : sign + val.toFixed(1);
      };
      
      const html = `
        <div class="comparison-table">
          <p class="scroll-hint">👈 Swipe to view more 👉</p>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>${projA.plan.name}</th>
                <th>${projB.plan.name}</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Retirement Age</td>
                <td>${projA.plan.retirementAge}</td>
                <td>${projB.plan.retirementAge}</td>
                <td>${projB.plan.retirementAge - projA.plan.retirementAge} years</td>
              </tr>
              <tr>
                <td>Retirement Pot</td>
                <td>${formatCurrency(projA.summary.retirementPot)}</td>
                <td>${formatCurrency(projB.summary.retirementPot)}</td>
                <td class="${deltas.retirementPot >= 0 ? 'positive' : 'negative'}">${formatDelta(deltas.retirementPot)}</td>
              </tr>
              <tr>
                <td>PCLS Tax-Free</td>
                <td>${formatCurrency(projA.summary.pclsTaken)}</td>
                <td>${formatCurrency(projB.summary.pclsTaken)}</td>
                <td class="${deltas.pclsTaken >= 0 ? 'positive' : 'negative'}">${formatDelta(deltas.pclsTaken)}</td>
              </tr>
              <tr>
                <td>Total Net Income</td>
                <td>${formatCurrency(projA.summary.totalNetIncome)}</td>
                <td>${formatCurrency(projB.summary.totalNetIncome)}</td>
                <td class="${deltas.totalNetIncome >= 0 ? 'positive' : 'negative'}">${formatDelta(deltas.totalNetIncome)}</td>
              </tr>
              <tr>
                <td>Total Tax Paid</td>
                <td>${formatCurrency(projA.summary.totalTaxPaid)}</td>
                <td>${formatCurrency(projB.summary.totalTaxPaid)}</td>
                <td class="${deltas.totalTaxPaid <= 0 ? 'positive' : 'negative'}">${formatDelta(deltas.totalTaxPaid)}</td>
              </tr>
              <tr>
                <td>Final Balance</td>
                <td>${formatCurrency(projA.summary.finalBalance)}</td>
                <td>${formatCurrency(projB.summary.finalBalance)}</td>
                <td class="${deltas.finalBalance >= 0 ? 'positive' : 'negative'}">${formatDelta(deltas.finalBalance)}</td>
              </tr>
              <tr>
                <td>Success Rate</td>
                <td>${(projA.summary.successRate * 100).toFixed(0)}%</td>
                <td>${(projB.summary.successRate * 100).toFixed(0)}%</td>
                <td class="${deltas.successRate >= 0 ? 'positive' : 'negative'}">${(deltas.successRate * 100).toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
      
      document.getElementById('comparison-container').innerHTML = html;
      
      // Render comparison chart
      const canvas = document.getElementById('comparison-chart');
      if (!canvas || typeof Chart === 'undefined') return;
      
      const existingChart = Chart.getChart(canvas);
      if (existingChart) existingChart.destroy();
      
      const prepareData = (proj) => {
        const acc = proj.accumulation.years.map(y => ({ x: y.age, y: y.endBalances.total }));
        const dec = proj.decumulation.years.filter(y => y.endBalances).map(y => ({ x: y.age, y: y.endBalances.total }));
        return [...acc, ...dec];
      };
      
      const dataA = prepareData(projA);
      const dataB = prepareData(projB);
      
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: dataA.map(d => d.x),
          datasets: [
            {
              label: projA.plan.name,
              data: dataA.map(d => d.y),
              borderColor: '#3b82f6',
              fill: false,
              tension: 0.3,
              pointRadius: 0
            },
            {
              label: projB.plan.name,
              data: dataB.map(d => d.y),
              borderColor: '#10b981',
              fill: false,
              tension: 0.3,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { title: { display: true, text: 'Age' }},
            y: { 
              title: { display: true, text: 'Total Wealth (£)' },
              ticks: { callback: (v) => formatCurrency(v) }
            }
          }
        }
      });
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Advanced Visualizations Rendering
    // ═══════════════════════════════════════════════════════════════
    
    function renderAllVisualizations(results) {
      const { basicProjection, mcResult, readiness, insights, recommendations, 
              benchmarks, milestones, dbPension, careCosts, 
              taxOptimization, spendingRules, riskScore, riskRecommendations,
              legacyPlan, estateValue, ihtEstimate, phasedRetirement, household, data } = results;
      
      // Hide all sections by default except cashflow and income sources
      document.querySelectorAll('.result-card').forEach(card => {
        // Keep cashflow, income sources, and guaranteed income visible always
        const alwaysShowIds = ['cashflow-section', 'income-sources-section', 'guaranteed-income-section'];
        if (!alwaysShowIds.includes(card.id)) {
          card.style.display = 'none';
        }
      });
      
      // Show income breakdown sections (always visible)
      const cashflowSection = document.getElementById('cashflow-section');
      if (cashflowSection) cashflowSection.style.display = 'block';
      const incomeSourcesSection = document.getElementById('income-sources-section');
      if (incomeSourcesSection) incomeSourcesSection.style.display = 'block';
      const guaranteedIncomeSection = document.getElementById('guaranteed-income-section');
      if (guaranteedIncomeSection) guaranteedIncomeSection.style.display = 'block';
      
      // === Monte Carlo Visualization ===
      if (mcResult) {
        const section = document.getElementById('monte-carlo-section');
        if (section) {
          section.style.display = 'block';
          
          // Render confidence explainer with provisional state support
          const explainerContainer = document.getElementById('confidence-explainer-container');
          if (explainerContainer) {
            try {
              renderConfidenceExplainer(mcResult, '#confidence-explainer-container', {
                isProvisional: state.isProvisionalPlan,
                provisionalReason: state.provisionalReason
              });
            } catch (e) {
              console.warn('Confidence explainer render failed:', e);
              const successRate = mcResult.statistics ? mcResult.statistics.successRate : 0;
              const displayRate = state.isProvisionalPlan ? '— (provisional)' : `${(successRate * 100).toFixed(0)}%`;
              explainerContainer.innerHTML = `<p>Monte Carlo ran ${mcResult.iterations} simulations. Success rate: ${displayRate}</p>`;
            }
          }
          
          // Render fan chart
          if (mcResult.yearlyBands) {
            try {
              renderFanChart(mcResult.yearlyBands, basicProjection, '#fan-chart', { retirementAge: data.retirementAge });
            } catch (e) {
              console.warn('Fan chart render failed:', e);
            }
          }
          
          // Render depletion histogram
          if (mcResult.statistics && mcResult.statistics.depletionAge) {
            try {
              renderDepletionHistogram(mcResult.statistics.depletionAge, '#depletion-histogram');
            } catch (e) {
              console.warn('Depletion histogram render failed:', e);
            }
          }
        }
      }
      
      // === Readiness Score ===
      if (readiness) {
        const section = document.getElementById('readiness-section');
        if (section) {
          section.style.display = 'block';
          const gauge = document.getElementById('readiness-gauge');
          if (gauge) {
            const score = readiness.totalScore || 0;
            const level = readiness.readinessLevel || 'Good';
            const color = readiness.readinessColor || (score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444');
            const message = readiness.readinessMessage || 'Your retirement readiness assessment';
            
            gauge.innerHTML = `
              <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 4rem; font-weight: bold; color: ${color};">${Math.round(score)}</div>
                <div style="font-size: 1.5rem; color: #6b7280; margin-bottom: 0.5rem;">${level} Readiness</div>
                <p style="margin-top: 1rem; color: #4b5563;">${message}</p>
              </div>
            `;
          }
          
          const factors = document.getElementById('readiness-factors');
          if (factors && readiness.breakdown) {
            let factorsHtml = '<div style="padding: 1rem;"><h4 style="margin-bottom: 1rem;">Score Breakdown</h4>';
            for (const [key, factor] of Object.entries(readiness.breakdown)) {
              const percentage = (factor.score / factor.maxScore) * 100;
              factorsHtml += `
                <div style="margin-bottom: 1rem;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <strong>${factor.description}</strong>
                    <span>${factor.score}/${factor.maxScore}</span>
                  </div>
                  <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="background: ${readiness.readinessColor || '#3b82f6'}; width: ${percentage}%; height: 100%;"></div>
                  </div>
                </div>
              `;
            }
            factorsHtml += '</div>';
            factors.innerHTML = factorsHtml;
          }
        }
      }
      
      // === Insights & Recommendations ===
      if (insights || recommendations) {
        const section = document.getElementById('insights-section');
        if (section) {
          section.style.display = 'block';
          
          if (insights && Array.isArray(insights)) {
            const insightsList = document.getElementById('insights-list');
            if (insightsList) {
              let html = '<div style="padding: 0;">';
              insights.forEach(insight => {
                const iconMap = {
                  'strengths': '✅',
                  'opportunities': '📈',
                  'risks': '⚠️',
                  'suggestions': '💡'
                };
                const colorMap = {
                  'strengths': '#22c55e',
                  'opportunities': '#3b82f6',
                  'risks': '#f59e0b',
                  'suggestions': '#8b5cf6'
                };
                const icon = insight.icon || iconMap[insight.category] || '📌';
                const color = colorMap[insight.category] || '#3b82f6';
                
                html += `<div style="padding: 1rem; margin-bottom: 0.75rem; background: white; border-left: 4px solid ${color}; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <div style="font-weight: bold; margin-bottom: 0.5rem;">${icon} ${insight.title || 'Insight'}</div>
                  <div style="color: #4b5563;">${insight.description || insight.message || ''}</div>
                  ${insight.detail ? `<div style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280;">${insight.detail}</div>` : ''}
                </div>`;
              });
              html += '</div>';
              insightsList.innerHTML = html;
            }
          }
          
          if (recommendations && Array.isArray(recommendations)) {
            const recommendationsList = document.getElementById('recommendations-list');
            if (recommendationsList) {
              let html = '<div style="padding: 0;">';
              recommendations.forEach(rec => {
                const priority = rec.priority || 'medium';
                const priorityColors = {
                  'high': '#ef4444',
                  'medium': '#f59e0b',
                  'low': '#10b981'
                };
                const color = priorityColors[priority] || '#f59e0b';
                
                html += `<div style="padding: 1rem; margin-bottom: 0.75rem; background: #fffbeb; border-left: 4px solid ${color}; border-radius: 4px;">
                  <div style="font-weight: bold; margin-bottom: 0.5rem;">💡 ${rec.title || 'Recommendation'}</div>
                  <div>${rec.description || rec.message || rec}</div>
                  ${rec.impact ? `<div style="margin-top: 0.5rem; font-size: 0.875rem; color: #92400e;"><strong>Impact:</strong> ${formatImpactValue(rec.impact)}</div>` : ''}
                </div>`;
              });
              html += '</div>';
              recommendationsList.innerHTML = html;
            }
          }
        }
      }
      
      // === Benchmarking ===
      if (benchmarks) {
        const section = document.getElementById('benchmarking-section');
        if (section) {
          section.style.display = 'block';
          const details = document.getElementById('benchmark-details');
          if (details) {
            // Safely extract summary - handle object/string types
            let summaryHtml = '';
            
            if (benchmarks.summary) {
              if (typeof benchmarks.summary === 'string') {
                summaryHtml = `<p><strong>Summary:</strong> ${benchmarks.summary}</p>`;
              } else if (typeof benchmarks.summary === 'object') {
                // Handle structured benchmark summary with strengths/improvements
                const summary = benchmarks.summary;
                if (summary.strengths && Array.isArray(summary.strengths) && summary.strengths.length > 0) {
                  summaryHtml += '<p><strong>✅ Strengths:</strong></p><ul style="margin: 0.5rem 0 1rem 1rem;">';
                  summary.strengths.forEach(s => { summaryHtml += `<li>${s}</li>`; });
                  summaryHtml += '</ul>';
                }
                if (summary.improvementAreas && Array.isArray(summary.improvementAreas) && summary.improvementAreas.length > 0) {
                  summaryHtml += '<p><strong>📈 Areas to Improve:</strong></p><ul style="margin: 0.5rem 0 1rem 1rem;">';
                  summary.improvementAreas.forEach(s => { summaryHtml += `<li>${s}</li>`; });
                  summaryHtml += '</ul>';
                }
                if (summary.overallAssessment) {
                  const assessmentLabels = {
                    'above-average': '📊 Above Average',
                    'average': '📊 Average', 
                    'below-average': '📊 Below Average'
                  };
                  summaryHtml += `<p><strong>Overall:</strong> ${assessmentLabels[summary.overallAssessment] || summary.overallAssessment}</p>`;
                }
                if (!summaryHtml) {
                  summaryHtml = '<p>Benchmark analysis complete</p>';
                }
              }
            } else {
              summaryHtml = '<p>Benchmark analysis complete</p>';
            }
            
            let peerText = 'Good standing';
            if (benchmarks.peerComparison) {
              if (typeof benchmarks.peerComparison === 'string') {
                peerText = benchmarks.peerComparison;
              } else if (typeof benchmarks.peerComparison === 'object') {
                peerText = benchmarks.peerComparison.text || benchmarks.peerComparison.message || 'Good standing';
              }
            }
            
            details.innerHTML = `
              <div style="padding: 1rem;">
                ${summaryHtml}
                <p style="margin-top: 1rem;"><strong>Peer comparison:</strong> ${peerText}</p>
              </div>
            `;
          }
        }
      }
      
      // === Tax Optimization ===
      if (taxOptimization) {
        const section = document.getElementById('tax-optimization-section');
        if (section) {
          section.style.display = 'block';
          const resultsEl = document.getElementById('tax-optimization-results');
          if (resultsEl) {
            resultsEl.innerHTML = `
              <div style="padding: 1rem;">
                <p><strong>Tax efficiency report:</strong> Tax-optimized withdrawal strategy analyzed</p>
                ${taxOptimization.recommendations ? `<p>${taxOptimization.recommendations.join(', ')}</p>` : ''}
              </div>
            `;
          }
        }
      }
      
      // === Risk Assessment ===
      if (riskScore) {
        const section = document.getElementById('risk-section');
        if (section) {
          section.style.display = 'block';
          const profile = document.getElementById('risk-profile');
          if (profile) {
            profile.innerHTML = `
              <div style="padding: 1rem;">
                <p><strong>Risk level:</strong> ${riskScore.level || 'Moderate'}</p>
                <p><strong>Risk score:</strong> ${riskScore.score || 'N/A'}</p>
              </div>
            `;
          }
          
          const riskScoreEl = document.getElementById('portfolio-risk-score');
          if (riskScoreEl && riskRecommendations) {
            let recsHtml = '<div style="padding: 1rem;"><strong>Risk recommendations:</strong><ul>';
            if (Array.isArray(riskRecommendations)) {
              riskRecommendations.forEach(rec => {
                recsHtml += `<li>${extractRecommendationText(rec)}</li>`;
              });
            }
            recsHtml += '</ul></div>';
            riskScoreEl.innerHTML = recsHtml;
          }
        }
      }
      // === Spending Policy ===
      if (spendingRules) {
        const section = document.getElementById('spending-policy-section');
        if (section) {
          section.style.display = 'block';
          const adjustments = document.getElementById('spending-adjustments');
          if (adjustments) {
            adjustments.innerHTML = `
              <div style="padding: 1rem;">
                <p>Age-based spending rules configured to maintain purchasing power throughout retirement.</p>
              </div>
            `;
          }
        }
      }
      
      // === Milestones ===
      if (milestones) {
        const section = document.getElementById('milestones-section');
        if (section) {
          section.style.display = 'block';
          const timeline = document.getElementById('milestones-timeline');
          if (timeline && Array.isArray(milestones)) {
            let html = '<div style="padding: 1rem;">';
            milestones.forEach(milestone => {
              html += `<div style="padding: 0.75rem; margin-bottom: 0.5rem; background: #f9fafb; border-left: 4px solid #22c55e; border-radius: 4px;">
                <strong>${milestone.age || milestone.name}:</strong> ${milestone.description || milestone.name}
              </div>`;
            });
            html += '</div>';
            timeline.innerHTML = html;
          }
        }
      }
      
      // === Legacy Planning ===
      if (estateValue || legacyPlan) {
        const section = document.getElementById('legacy-section');
        if (section) {
          section.style.display = 'block';
          const projection = document.getElementById('legacy-projection');
          if (projection) {
            const finalBalance = basicProjection && basicProjection.summary ? basicProjection.summary.finalBalance : 0;
            // Safely calculate estate value - use estateValue if valid, else finalBalance, else show dash
            const isValidNumber = (v) => typeof v === 'number' && !isNaN(v) && v > 0;
            const displayValue = isValidNumber(estateValue) ? estateValue : (isValidNumber(finalBalance) ? finalBalance : null);
            
            projection.innerHTML = `
              <div style="padding: 1rem;">
                <p><strong>Estimated estate value:</strong> ${displayValue ? formatCurrency(displayValue) : '—'}</p>
              </div>
            `;
          }
          
          if (ihtEstimate) {
            const iht = document.getElementById('iht-estimate');
            if (iht) {
              let tax = ihtEstimate.tax || ihtEstimate.amount || 0;
              // Guard against NaN
              if (typeof tax !== 'number' || isNaN(tax)) {
                tax = 0;
              }
              let taxable = ihtEstimate.taxable;
              if (typeof taxable !== 'number' || isNaN(taxable)) {
                taxable = null;
              }
              iht.innerHTML = `
                <div style="padding: 1rem;">
                  <p><strong>Potential IHT liability:</strong> ${tax > 0 ? formatCurrency(tax) : '—'}</p>
                  ${taxable ? `<p><strong>Taxable estate:</strong> ${formatCurrency(taxable)}</p>` : ''}
                </div>
              `;
            }
          }
        }
      }
      
      // === Household Analysis ===
      if (household && household.isCouple) {
        const section = document.getElementById('household-section');
        if (section) {
          section.style.display = 'block';
          const details = document.getElementById('household-details');
          if (details) {
            details.innerHTML = `
              <div style="padding: 1rem;">
                <p><strong>Household type:</strong> Couple</p>
                <p><strong>Person 1:</strong> Age ${household.person1.age}, retires at ${household.person1.retirementAge}</p>
                <p><strong>Person 2:</strong> Age ${household.person2.age}, retires at ${household.person2.retirementAge}</p>
              </div>
            `;
          }
        }
      }
      
      // === DB Pension ===
      if (dbPension) {
        const section = document.getElementById('db-pension-section');
        if (section) {
          section.style.display = 'block';
          const details = document.getElementById('db-pension-details');
          if (details) {
            details.innerHTML = `
              <div style="padding: 1rem;">
                <p><strong>Annual DB pension:</strong> ${formatCurrency(data.dbPensionAmount || 0)}</p>
                <p><strong>Starts at age:</strong> ${data.dbPensionStartAge || 65}</p>
                <p><strong>Inflation linked:</strong> Yes</p>
              </div>
            `;
          }
        }
      }
      
      // === Care Costs ===
      if (careCosts) {
        const section = document.getElementById('care-costs-section');
        if (section) {
          section.style.display = 'block';
          const scenarios = document.getElementById('care-cost-scenarios');
          if (scenarios) {
            scenarios.innerHTML = `
              <div style="padding: 1rem;">
                <p>Potential care cost scenarios have been factored into the projection.</p>
                <p><strong>Estimated care need probability:</strong> ${careCosts.probability || '30%'}</p>
              </div>
            `;
          }
        }
      }
      
      // === Phased Retirement ===
      if (phasedRetirement) {
        const section = document.getElementById('phased-retirement-section');
        if (section) {
          section.style.display = 'block';
          const details = document.getElementById('phased-retirement-details');
          if (details) {
            details.innerHTML = `
              <div style="padding: 1rem;">
                <p><strong>Phase start age:</strong> ${data.phaseStartAge || 'N/A'}</p>
                <p><strong>Reduced hours:</strong> ${data.reducedHours || 50}%</p>
                <p><strong>Full retirement age:</strong> ${data.retirementAge || 'N/A'}</p>
              </div>
            `;
          }
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // Event Listeners
    // ═══════════════════════════════════════════════════════════════
    
    // Accordion toggle function (needs to be in global scope)
    window.toggleAccordion = function(header) {
      const group = header.closest('.accordion-group');
      group.classList.toggle('open');
    };
    
    document.addEventListener('DOMContentLoaded', () => {
      debugLog('INIT', 'App initializing');
      
      // Navigation buttons
      document.querySelectorAll('[data-action="next"]').forEach(btn => {
        btn.addEventListener('click', nextScreen);
      });
      
      document.querySelectorAll('[data-action="back"]').forEach(btn => {
        btn.addEventListener('click', prevScreen);
      });
      
      // ═══════════════════════════════════════════════════════════════
      // Pathfinder Event Handlers
      // ═══════════════════════════════════════════════════════════════
      
      document.getElementById('pathfinder-next-btn')?.addEventListener('click', advancePathfinder);
      document.getElementById('pathfinder-back-btn')?.addEventListener('click', goBackPathfinder);
      
      // Initialize pathfinder when welcome screen "Start" is clicked
      document.querySelector('#screen-welcome [data-action="next"]')?.addEventListener('click', (e) => {
        if (isFeatureEnabled('PATHFINDER')) {
          e.stopPropagation();
          showScreen('pathfinder');
          initPathfinder();
        }
      });
      
      // ═══════════════════════════════════════════════════════════════
      // Mode Select Event Handlers
      // ═══════════════════════════════════════════════════════════════
      
      document.querySelectorAll('.mode-card[data-mode]').forEach(card => {
        card.addEventListener('click', () => {
          selectMode(card.dataset.mode);
        });
      });
      
      document.getElementById('mode-select-next-btn')?.addEventListener('click', () => {
        SCREEN_ORDER = getActiveScreenOrder();
        nextScreen();
      });
      
      // ═══════════════════════════════════════════════════════════════
      // Onboarding Event Handlers
      // ═══════════════════════════════════════════════════════════════
      
      // Household type selection
      document.querySelectorAll('.household-type-card').forEach(card => {
        card.addEventListener('click', () => {
          selectHouseholdType(card.dataset.householdType);
        });
      });
      
      // Pension type checkboxes
      document.querySelectorAll('input[name="pension-type"]').forEach(checkbox => {
        checkbox.addEventListener('change', handlePensionTypeChange);
      });
      
      // Pension explainer toggle buttons
      document.querySelectorAll('.pension-explainer-toggle').forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const explainerType = button.dataset.explainer;
          if (explainerType) {
            togglePensionExplainer(explainerType);
          }
        });
      });
      
      // Pension types next button
      document.getElementById('pension-types-next-btn')?.addEventListener('click', advancePensionTypesScreen);
      
      // ═══════════════════════════════════════════════════════════════
      // Preview Card Event Handlers
      // ═══════════════════════════════════════════════════════════════
      
      document.getElementById('preview-info-btn')?.addEventListener('click', togglePreviewTooltip);
      
      // Update preview on input changes
      const inputFields = [
        'input-current-age', 'input-retirement-age', 'input-target-income',
        'input-pension-pot', 'input-pension-contribution', 
        'input-isa-balance', 'input-isa-contribution',
        'input-state-pension-age', 'input-state-pension-amount'
      ];
      
      inputFields.forEach(id => {
        document.getElementById(id)?.addEventListener('input', updatePreviewCard);
      });
      
      // ═══════════════════════════════════════════════════════════════
      // Toggle handlers for advanced options
      // ═══════════════════════════════════════════════════════════════
      
      document.getElementById('has-db-pension')?.addEventListener('change', (e) => {
        const inputs = document.getElementById('db-pension-inputs');
        if (inputs) inputs.style.display = e.target.checked ? 'block' : 'none';
      });
      
      document.getElementById('is-phased-retirement')?.addEventListener('change', (e) => {
        const inputs = document.getElementById('phased-inputs');
        if (inputs) inputs.style.display = e.target.checked ? 'block' : 'none';
      });
      
      // CRITICAL FIX: Add missing click handler for couples-input Next button
      document.getElementById('couples-input-next-btn')?.addEventListener('click', () => {
        debugLog('NAV', 'Couples input Next button clicked');
        
        // Validate before advancing
        const personA = state.onboardingState?.personA;
        const personB = state.onboardingState?.personB;
        
        const isValid = 
          personA?.currentAge >= 18 &&
          personA?.retirementAge > personA.currentAge &&
          personB?.currentAge >= 18 &&
          personB?.retirementAge > personB.currentAge &&
          state.onboardingState?.targetNetIncome > 0;
        
        if (!isValid) {
          // Show inline error with specific feedback
          let errorMsg = 'Please complete all required fields:';
          const errors = [];
          
          if (!personA?.currentAge || personA.currentAge < 18) errors.push('Your current age');
          if (!personA?.retirementAge || personA.retirementAge <= personA.currentAge) errors.push('Your retirement age (must be after current age)');
          if (!personB?.currentAge || personB.currentAge < 18) errors.push("Partner's current age");
          if (!personB?.retirementAge || personB.retirementAge <= personB.currentAge) errors.push("Partner's retirement age (must be after current age)");
          if (!state.onboardingState?.targetNetIncome || state.onboardingState.targetNetIncome <= 0) errors.push('Household income target');
          
          if (errors.length > 0) {
            errorMsg += '\n• ' + errors.join('\n• ');
          }
          
          showError(errorMsg);
          
          // Scroll to first invalid field
          const firstInvalidField = document.querySelector('#couples-input-container input:invalid, #couples-input-container input[value=""], #couples-input-container input[value="0"]');
          if (firstInvalidField) {
            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstInvalidField.focus();
          }
          
          return;
        }
        
        // Advance to next screen
        nextScreen();
      });
      
      // Calculate button - Enhanced with all 20 modules
      document.getElementById('calculate-btn')?.addEventListener('click', () => {
        try {
          // Validate before calculating
          const validation = validateCanCalculate();
          if (!validation.canCalculate) {
            showError(validation.reason || 'Please complete all required fields');
            return;
          }
          
          const data = collectFormData();
          state.formData = data;
          
          // Bridge onboarding state to formData if not already done
          if (state.onboardingState && state.onboardingState.householdType) {
            data.householdType = state.onboardingState.householdType;
            data.personA = state.onboardingState.personA;
            data.personB = state.onboardingState.personB;
            data.isCouple = state.onboardingState.householdType === HOUSEHOLD_TYPES.COUPLE;
          }
          
          // 1. Create assumptions from selected scenario
          const assumptions = createUserAssumptions(SCENARIO_PRESETS[data.scenario] || SCENARIO_PRESETS.moderate);
          
          // 2. Create household using new engine for couples, existing for singles
          let household = null;
          try {
            if (data.householdType === HOUSEHOLD_TYPES.COUPLE && state.onboardingState) {
              // Use new couples-first household engine
              const householdPlan = onboardingToHouseholdPlan(state.onboardingState);
              household = createHouseholdPlan(householdPlan);
              debugLog('HOUSEHOLD', 'Created couple household from onboarding', household);
            } else {
              // Use existing single person logic
              household = createHousehold({
                person1: { currentAge: data.currentAge, retirementAge: data.retirementAge },
                person2: null
              });
            }
          } catch (e) {
            console.warn('Household creation failed:', e);
            // Create default single household
            household = { person1: { currentAge: data.currentAge, retirementAge: data.retirementAge }, person2: null, isCouple: false };
          }
          
          // 3. Run basic deterministic projection (existing)
          const plan = createPlan({
            name: 'Plan A',
            ...data
          });
          const basicProjection = runProjection(plan, { endAge: 90 });
          
          state.planA = plan;
          state.projectionA = basicProjection;
          
          // Initialize results object
          const results = {
            basicProjection,
            household,
            assumptions,
            data,
            plan
          };
          
          // 4. Run Monte Carlo simulation if enabled
          if (data.enableMonteCarlo) {
            try {
              const mcResult = runMonteCarloWithBands(plan, { iterations: 1000, endAge: 90 });
              results.mcResult = mcResult;
            } catch (e) {
              console.warn('Monte Carlo failed:', e);
            }
          }
          
          // 5. Calculate readiness score
          try {
            const readiness = calculateReadinessScore(basicProjection, data);
            results.readiness = readiness;
          } catch (e) {
            console.warn('Readiness score failed:', e);
          }
          
          // 6. Generate insights & recommendations
          try {
            const insights = generateInsights(plan, basicProjection);
            results.insights = insights;
            
            const recommendations = generateRecommendations(basicProjection, data, results.mcResult);
            results.recommendations = recommendations;
          } catch (e) {
            console.warn('Insights/recommendations failed:', e);
          }
          
          // 7. Calculate benchmarks if enabled
          if (data.enableBenchmarking) {
            try {
              const benchmarks = generateBenchmarkAnalysis(plan, basicProjection);
              results.benchmarks = benchmarks;
            } catch (e) {
              console.warn('Benchmarking failed:', e);
            }
          }
          
          // 8. Track milestones
          try {
            const milestones = integrateMilestonesIntoSpending([], plan);
            results.milestones = milestones;
          } catch (e) {
            console.warn('Milestones tracking failed:', e);
          }
          
          // 9. Model DB pensions if applicable
          if (data.hasDBPension && data.dbPensionAmount > 0) {
            try {
              const dbPension = createDBPension({
                annualAmount: data.dbPensionAmount,
                startAge: data.dbPensionStartAge,
                inflationLinked: true
              });
              results.dbPension = dbPension;
            } catch (e) {
              console.warn('DB pension projection failed:', e);
            }
          }
          
          // 10. Estimate care costs if enabled
          if (data.modelCareCosts) {
            try {
              const healthcarePlan = createHealthcarePlan({
                startAge: data.currentAge,
                retirementAge: data.retirementAge
              });
              const careCosts = projectHealthcareCosts(healthcarePlan, data.retirementAge, 95);
              results.careCosts = careCosts;
            } catch (e) {
              console.warn('Care costs estimation failed:', e);
            }
          }
          
          // 11. Optimize tax efficiency if enabled
          if (data.enableTaxOptimization) {
            try {
              const taxReport = generateTaxEfficiencyReport({
                currentPot: data.currentPension,
                isaBalance: data.currentIsa || 0,
                targetIncome: data.targetNetIncome
              });
              results.taxOptimization = taxReport;
            } catch (e) {
              console.warn('Tax optimization failed:', e);
            }
          }
          
          // 12. Apply spending policy
          try {
            const spendingRules = createSpendingRules({});
            results.spendingRules = spendingRules;
          } catch (e) {
            console.warn('Spending policy failed:', e);
          }
          
          // 13. Assess risk
          if (results.mcResult) {
            try {
              const riskScore = calculateRiskScore(results.mcResult, basicProjection);
              const riskRecommendations = generateRiskRecommendations(riskScore, basicProjection);
              results.riskScore = riskScore;
              results.riskRecommendations = riskRecommendations;
            } catch (e) {
              console.warn('Risk assessment failed:', e);
            }
          }
          
          // 14. Calculate legacy
          try {
            const legacyPlan = createLegacyPlan({
              targetLegacy: 0,
              beneficiaries: []
            });
            const estateValue = projectEstateValue({
              currentWealth: basicProjection.summary.finalBalance
            }, 0);
            const ihtEstimate = calculateInheritanceTax(estateValue);
            results.legacyPlan = legacyPlan;
            results.estateValue = estateValue;
            results.ihtEstimate = ihtEstimate;
          } catch (e) {
            console.warn('Legacy planning failed:', e);
          }
          
          // 15. Model phased retirement if requested
          if (data.isPhasedRetirement && data.phaseStartAge > 0) {
            try {
              const phasedRetirement = createPhasedRetirement({
                fullRetirementAge: data.retirementAge,
                phaseStartAge: data.phaseStartAge,
                reducedHoursPercent: data.reducedHours
              });
              results.phasedRetirement = phasedRetirement;
            } catch (e) {
              console.warn('Phased retirement failed:', e);
            }
          }
          
          debugLog('CALC', 'Enhanced projection complete with all modules', results);
          
          // Update provisional banner if applicable
          updateProvisionalBanner();
          
          // Render basic results first
          renderResults(basicProjection);
          
          // Hide Calculate button and show View Results button
          document.getElementById('calculate-btn').style.display = 'none';
          const viewResultsBtn = document.getElementById('view-results-btn');
          if (viewResultsBtn) {
            viewResultsBtn.style.display = 'inline-block';
          }
          
          // Render new charts
          try {
            renderCashflowChart(basicProjection, data);
            renderTaxChart(basicProjection);
            renderGuaranteedIncomeChart(basicProjection, data);
            renderIncomeSourcesBreakdown(basicProjection, data);
          } catch (e) {
            console.warn('Chart rendering failed:', e);
          }
          
          // Then render all advanced visualizations
          renderAllVisualizations(results);
          
        } catch (error) {
          console.error(error);
          showError(error.message);
        }
      });
      
      // View Results button - navigate to results screen after calculation
      document.getElementById('view-results-btn')?.addEventListener('click', () => {
        nextScreen();
      });
      
      // Compare button
      document.getElementById('compare-btn')?.addEventListener('click', () => {
        try {
          const planBRetireAge = getValue('input-planb-retirement-age', 67);
          
          const planB = createPlan({
            name: 'Plan B',
            ...state.formData,
            retirementAge: planBRetireAge
          });
          
          const projectionB = runProjection(planB, { endAge: 90 });
          
          state.planB = planB;
          state.projectionB = projectionB;
          
          renderComparison(state.projectionA, projectionB);
          
        } catch (error) {
          console.error(error);
          showError(error.message);
        }
      });
      
      // Enter key advances
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
          e.preventDefault();
          nextScreen();
        }
      });
      
      // Run tax engine tests in DEBUG mode
      if (DEBUG) {
        const taxTestResults = runTaxTests();
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('  TAX ENGINE TESTS');
        console.log('═══════════════════════════════════════════════════════════════');
        taxTestResults.tests.forEach(t => {
          console.log(`  ${t.passed ? '✓' : '✗'} ${t.name}${t.details ? ' - ' + t.details : ''}`);
        });
        console.log(`  ${taxTestResults.passed}/${taxTestResults.total} tests passed`);
        if (!taxTestResults.allPassed) {
          console.warn('  ⚠️ Some tax tests failed!');
        }
      }
      
      debugLog('INIT', 'App ready');
    });
    
    // Expose for debugging
    if (DEBUG) {
      window.__RL_STATE__ = state;
      window.__RL_TAX_TESTS__ = runTaxTests;
    }
