    // Core projection engine (existing)
    import { createPlan, runProjection, comparePlans, generateDebugOutput } from '../engine/projections.js';
    import { createAssumptions } from '../config/defaults.js';
    
    // Import all engine modules with correct exports
    import { createUserAssumptions, SCENARIO_PRESETS, DEFAULT_ASSUMPTIONS } from '../engine/assumptions.js';
    import { generateBenchmarkAnalysis } from '../engine/benchmarking.js';
    import { createDBPension, calculateDBIncomeAtAge } from '../engine/dbPension.js';
    import { createHealthcarePlan, projectHealthcareCosts } from '../engine/healthcareCosts.js';
    import { createHousehold, createPerson } from '../engine/household.js';
    import { calculateFutureIncome, calculatePresentIncome, calculateInflationSeries } from '../engine/inflationAdjustment.js';
    import { generateInsights } from '../engine/insightsEngine.js';
    import { createLegacyPlan, calculateInheritanceTax, projectEstateValue } from '../engine/legacyPlanning.js';
    import { createMilestone, integrateMilestonesIntoSpending, calculateMilestoneImpact } from '../engine/milestones.js';
    import { runMonteCarlo, runMonteCarloWithBands, generateConfidenceBands, illustrateSequenceOfReturns } from '../engine/monteCarlo.js';
    import { createPhasedRetirement, calculatePhasedRetirementImpact } from '../engine/phasedRetirement.js';
    import { calculateReadinessScore, generateActionPlan } from '../engine/readinessScore.js';
    import { generateRecommendations, formatRecommendationsForDisplay } from '../engine/recommendations.js';
    import { calculateRiskScore, generateRiskRecommendations } from '../engine/riskScoring.js';
    import { calculateSpendingAtAge, createSpendingRules } from '../engine/spendingPolicy.js';
    import { calculateIncomeTax, calculateTaxFromGross } from '../engine/tax.js';
    import { analyzePCLSTiming, analyzeWithdrawalSequencing, generateTaxEfficiencyReport } from '../engine/taxOptimizer.js';
    import { calculatePCLS, calculateOptimalWithdrawal, calculatePCLSStrategy, projectPCLSReinvestment, PCLS_STRATEGIES } from '../engine/withdrawals.js';
    
    // Import config modules
    import { SCENARIOS, getScenarioById } from '../config/scenarios.js';
    import { POT_SIZE_BENCHMARKS, INCOME_BENCHMARKS } from '../config/benchmarkData.js';
    
    // Import UI components
    // Note: renderConfidenceExplainer is now in monteCarloCharts.js (consolidated from confidenceExplainer.js)
    import { renderFanChart, renderDepletionHistogram, renderAllCharts, renderConfidenceExplainer } from '../ui/components/monteCarloCharts.js';
    
    // Import new UX modules
    import { FEATURE_FLAGS, isFeatureEnabled } from '../src/ux/config.js';
    import { PATHFINDER_QUESTIONS, JOURNEYS, MODES, scoreToJourney, scoreToMode, getRouting } from '../src/ux/pathfinder/questions.js';
    import { JOURNEY_CONFIG, getJourney, getJourneySteps } from '../src/ux/journeys/journeys.js';
    import { MODE_CONFIG, getMode, getModeSteps, isFieldHidden } from '../src/ux/modes/modes.js';
    import { estimatePreview, formatPreviewCurrency, formatGapSurplus } from '../src/ux/preview/estimate.js';
    
    // Import enhanced tax engine with tests
    import { computeUKTax, runTaxTests } from '../engine/tax.js';
    
    // Import couples-first household engine
    import { createInitialOnboardingState, validateOnboardingState, onboardingToHouseholdPlan, ONBOARDING_STEPS } from '../src/ux/onboarding/flow.js';
    import { createHouseholdPlan, projectHousehold, validateHouseholdPlan, HOUSEHOLD_TYPES, PENSION_TYPES } from '../engine/householdPlan.js';
    import { generateTickerMessages, formatTickerDisplay } from '../ui/components/bottomTicker.js';
    
    // Import couples input component
    import { renderCouplesInputTabs } from '../ui/components/couplesInput.js';

    // Import persistence layer for auto-save
    import { initPersistence, startAutoSave, loadAutoSave } from '../ui/persistence.js';
    
    // ═══════════════════════════════════════════════════════════════
    // Configuration Constants
    // ═══════════════════════════════════════════════════════════════
    
    const MODEL_VERSION = 'v1.0.0';

    // ═══ Global Chart.js Styling ═══
    if (typeof Chart !== 'undefined') {
      Chart.defaults.font.family = "'Inter', -apple-system, system-ui, sans-serif";
      Chart.defaults.font.size = 12;
      Chart.defaults.color = '#475569';
      Chart.defaults.plugins.legend.labels.usePointStyle = true;
      Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
      Chart.defaults.plugins.legend.labels.padding = 12;
      Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
      Chart.defaults.plugins.tooltip.cornerRadius = 8;
      Chart.defaults.plugins.tooltip.padding = 10;
    }
    
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

      screens.push('household-type');

      // Same wizard screens for BOTH singles and couples
      // For couples, each screen shows doubled-up inputs (you + partner)
      // Consolidated: age+retirement, income, pension+contributions, isa+state-pension
      screens.push('age', 'pension-pot');

      // ISA and state pension on one screen
      if (isFeatureEnabled('GUIDED_MODE') || state.mode === 'guided' || state.mode === 'full') {
        screens.push('isa-savings');
      }

      screens.push('results');

      return screens;
    }

    /**
     * For couples mode: inject a partner input below each wizard input.
     * Called by showScreen() when entering a wizard screen in couples mode.
     */
    function injectPartnerInputs(screenId) {
      const isCouple = state.onboardingState?.householdType === HOUSEHOLD_TYPES.COUPLE;

      // Map screen IDs to their partner input config
      const partnerInputConfig = {
        'age': null, // Custom handler: age + retirement age together
        'pension-pot': null, // Handled separately (DC + DB)
        'contributions': { id: 'input-partner-pension-contribution', label: "Partner's monthly contribution", placeholder: '0', min: 0, step: 50, currency: true },
        'isa-savings': null, // Handled separately (2 inputs)
        'state-pension': null // Handled separately (2 inputs)
      };

      const screen = document.getElementById(`screen-${screenId}`);
      if (!screen) return;

      // Remove any previously injected partner inputs
      screen.querySelectorAll('.partner-input-group').forEach(el => el.remove());

      if (!isCouple || !partnerInputConfig.hasOwnProperty(screenId)) return;

      const content = screen.querySelector('.screen-content');
      if (!content) return;

      // Special handling for screens with multiple inputs
      if (screenId === 'age') {
        const html = `
          <div class="partner-input-group" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid var(--color-primary-light, #e0e7ff);">
            <div style="font-weight: 600; color: var(--color-primary, #4f46e5); margin-bottom: 0.75rem; font-size: 0.9rem;">Partner</div>
            <div class="input-group">
              <label style="font-weight: 500;">Partner's current age</label>
              <div class="input-wrapper">
                <input type="text" inputmode="numeric" pattern="[0-9]*" id="input-partner-current-age" min="18" max="100" placeholder="63" inputmode="numeric" />
              </div>
            </div>
            <div class="input-group" style="margin-top: 0.75rem;">
              <label style="font-weight: 500;">Partner's retirement age</label>
              <div class="input-wrapper">
                <input type="text" inputmode="numeric" pattern="[0-9]*" id="input-partner-retirement-age" min="50" max="100" placeholder="67" inputmode="numeric" />
              </div>
            </div>
          </div>`;
        content.insertAdjacentHTML('beforeend', html);
        return;
      }

      // isa-savings: partner section is now permanent HTML, shown/hidden by showScreen
      if (screenId === 'isa-savings') {
        return;
      }

      // pension-pot: partner section is now permanent HTML, shown/hidden by showScreen
      if (screenId === 'pension-pot') {
        return;
      }

      if (screenId === 'state-pension') {
        const html = `
          <div class="partner-input-group" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid var(--color-primary-light, #e0e7ff);">
            <div style="font-weight: 600; color: var(--color-primary, #4f46e5); margin-bottom: 0.75rem; font-size: 0.9rem;">Partner's State Pension</div>
            <div class="input-group">
              <label>Partner's State Pension age</label>
              <div class="input-wrapper">
                <input type="text" inputmode="numeric" pattern="[0-9]*" id="input-partner-state-pension-age" min="60" max="75" value="67" inputmode="numeric" />
              </div>
            </div>
            <div class="input-group">
              <label>Partner's expected annual State Pension</label>
              <div class="input-wrapper">
                <span class="currency-symbol">£</span>
                <input type="text" inputmode="numeric" pattern="[0-9]*" id="input-partner-state-pension-amount" min="0" step="100" value="11973" inputmode="numeric" />
              </div>
            </div>
          </div>`;
        content.insertAdjacentHTML('beforeend', html);
        return;
      }

      // Standard single-input partner field
      const config = partnerInputConfig[screenId];
      if (!config) return;

      const currencyPrefix = config.currency ? '<span class="currency-symbol">£</span>' : '';
      const html = `
        <div class="partner-input-group" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid var(--color-primary-light, #e0e7ff);">
          <div style="font-weight: 600; color: var(--color-primary, #4f46e5); margin-bottom: 0.75rem; font-size: 0.9rem;">Partner</div>
          <div class="input-group">
            <label>${config.label}</label>
            <div class="input-wrapper">
              ${currencyPrefix}
              <input type="text" inputmode="numeric" pattern="[0-9]*" id="${config.id}" min="${config.min || 0}" ${config.max ? 'max="' + config.max + '"' : ''} ${config.step ? 'step="' + config.step + '"' : ''} placeholder="${config.placeholder}" inputmode="numeric" />
            </div>
          </div>
        </div>`;
      content.insertAdjacentHTML('beforeend', html);
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
      } else {
        console.error(`[ERROR] Screen not found: screen-${screenId}. Available screens:`, 
          Array.from(document.querySelectorAll('.screen')).map(s => s.id));
      }
      
      // For couples: inject partner input fields on wizard screens
      injectPartnerInputs(screenId);

      // Update pension-pot screen for singles vs couples (includes target income + PLSA)
      if (screenId === 'pension-pot') {
        const isCouple = state.onboardingState?.householdType === HOUSEHOLD_TYPES.COUPLE;
        const sub = document.getElementById('pension-pot-subtitle');
        if (sub) sub.textContent = isCouple ? 'Combined household income and pension details' : 'Target income and pension details';
        // Update PLSA card values for single vs couple
        const plsaValues = isCouple
          ? { min: 22400, mod: 43100, comf: 59000 }
          : { min: 14400, mod: 31300, comf: 43100 };
        const minEl = document.getElementById('plsa-min-val');
        const modEl = document.getElementById('plsa-mod-val');
        const comfEl = document.getElementById('plsa-comf-val');
        if (minEl) minEl.textContent = plsaValues.min.toLocaleString();
        if (modEl) modEl.textContent = plsaValues.mod.toLocaleString();
        if (comfEl) comfEl.textContent = plsaValues.comf.toLocaleString();

        // PLSA card click handlers
        document.querySelectorAll('.plsa-card').forEach(card => {
          card.addEventListener('click', () => {
            const type = card.dataset.plsa;
            const val = type === 'minimum' ? plsaValues.min : type === 'moderate' ? plsaValues.mod : plsaValues.comf;
            const input = document.getElementById('input-target-income');
            if (input) input.value = val;
            document.querySelectorAll('.plsa-card').forEach(c => {
              c.style.borderColor = 'var(--color-border)';
              c.style.background = 'var(--color-surface)';
            });
            card.style.borderColor = 'var(--color-primary)';
            card.style.background = 'var(--color-primary-subtle)';
          });
        });
      }

      // Show/hide partner sections for couples
      const isCouple = state.onboardingState?.householdType === HOUSEHOLD_TYPES.COUPLE;
      const partnerPensionSection = document.getElementById('partner-pension-section');
      if (partnerPensionSection) {
        partnerPensionSection.style.display = (screenId === 'pension-pot' && isCouple) ? 'block' : 'none';
      }
      const partnerIsaSection = document.getElementById('partner-isa-section');
      if (partnerIsaSection) {
        partnerIsaSection.style.display = (screenId === 'isa-savings' && isCouple) ? 'block' : 'none';
      }

      // Restore saved input values for this screen (including partner values)
      restoreScreenInputs(screenId);

      // Update progress
      const progress = ((SCREEN_ORDER.indexOf(screenId) + 1) / SCREEN_ORDER.length) * 100;
      document.getElementById('progress-bar').style.width = `${progress}%`;

      state.currentScreen = screenId;
      
      // Preview card removed
      
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
      
      // Review screen (kept for direct navigation / backward compat)
      if (screenId === 'review') {
        renderReviewSummary();
      }

      // Auto-calculate when entering results screen
      if (screenId === 'results') {
        // Always run fresh calculation when entering results
        setTimeout(() => runFullCalculation(), 100);
      }
    }
    
    /**
     * Save current screen's input values into onboardingState before navigating away.
     * This ensures data survives screen transitions and can be restored on revisit.
     */
    function saveCurrentScreenInputs() {
      if (!state.onboardingState) return;
      if (!state.onboardingState.personA) {
        state.onboardingState.personA = { pensionTypes: ['dc'] };
      }
      const personA = state.onboardingState.personA;
      const screen = state.currentScreen;

      // Save Person A (your) values
      switch (screen) {
        case 'age':
          personA.currentAge = getValue('input-current-age', 0);
          personA.retirementAge = getValue('input-retirement-age', 0);
          break;
        case 'income-target':
          state.onboardingState.targetNetIncome = getValue('input-target-income', 0);
          break;
        case 'pension-pot': {
          state.onboardingState.targetNetIncome = getValue('input-target-income', 0);
          personA.dcPot = getValue('input-pension-pot', 0);
          personA.dbAnnualIncome = getValue('input-your-db-income', 0);
          personA.dbStartAge = getValue('input-your-db-start', 65);
          const contribVal = getValue('input-pension-contribution', 0);
          personA.dcMonthlyContrib = contribVal;
          personA.dcAnnualContrib = contribVal * 12;
          personA.pclsTaken = document.getElementById('input-pcls-taken')?.checked || false;
          personA.pclsAmount = getValue('input-pcls-amount', 0);
          break;
        }
        case 'isa-savings': {
          personA.isaBalance = getValue('input-isa-balance', 0);
          personA.isaAnnualContrib = getValue('input-isa-contribution', 0);
          personA.statePensionAge = getValue('input-state-pension-age', 67);
          personA.statePensionAmount = getValue('input-state-pension-amount', 11973);
          personA.expectedStatePension = personA.statePensionAmount;
          break;
        }
      }

      // Save Person B (partner) values from injected partner inputs
      if (state.onboardingState?.householdType === HOUSEHOLD_TYPES.COUPLE) {
        if (!state.onboardingState.personB) {
          state.onboardingState.personB = { pensionTypes: ['dc'] };
        }
        const personB = state.onboardingState.personB;
        switch (screen) {
          case 'age':
            personB.currentAge = getValue('input-partner-current-age', 0);
            personB.retirementAge = getValue('input-partner-retirement-age', 0);
            break;
          case 'pension-pot':
            personB.dcPot = getValue('input-partner-pension-pot', 0);
            personB.dbAnnualIncome = getValue('input-partner-db-income', 0);
            personB.dbStartAge = getValue('input-partner-db-start', 67);
            const pv = getValue('input-partner-pension-contribution', 0);
            personB.dcMonthlyContrib = pv;
            personB.dcAnnualContrib = pv * 12;
            personB.salarySacrifice = document.getElementById('input-partner-salary-sacrifice')?.checked || false;
            personB.flexiAccessed = document.getElementById('input-partner-flexi-accessed')?.checked || false;
            personB.pclsTaken = document.getElementById('input-partner-pcls-taken')?.checked || false;
            personB.pclsAmount = getValue('input-partner-pcls-amount', 0);
            break;
          case 'isa-savings':
            personB.isaBalance = getValue('input-partner-isa-balance', 0);
            personB.isaAnnualContrib = getValue('input-partner-isa-contribution', 0);
            personB.statePensionAge = getValue('input-partner-state-pension-age', 67);
            personB.statePensionAmount = getValue('input-partner-state-pension-amount', 11973);
            personB.expectedStatePension = personB.statePensionAmount;
            break;
        }
      }
    }

    function restoreScreenInputs(screenId) {
      if (!state.onboardingState?.personA) return;
      const personA = state.onboardingState.personA;

      function setInput(id, value) {
        const el = document.getElementById(id);
        if (el && value != null && value !== 0) {
          el.value = value;
        }
      }

      // Restore Person A values
      switch (screenId) {
        case 'age':
          setInput('input-current-age', personA.currentAge);
          setInput('input-retirement-age', personA.retirementAge);
          break;
        case 'income-target':
          setInput('input-target-income', state.onboardingState.targetNetIncome);
          break;
        case 'pension-pot':
          setInput('input-target-income', state.onboardingState.targetNetIncome);
          setInput('input-pension-pot', personA.dcPot);
          setInput('input-your-db-income', personA.dbAnnualIncome);
          setInput('input-your-db-start', personA.dbStartAge);
          setInput('input-pension-contribution', personA.dcMonthlyContrib);
          // Restore PCLS state
          const pclsCheckbox = document.getElementById('input-pcls-taken');
          if (pclsCheckbox && personA.pclsTaken) {
            pclsCheckbox.checked = true;
            const pclsSection = document.getElementById('pcls-amount-section');
            if (pclsSection) pclsSection.style.display = 'block';
          }
          setInput('input-pcls-amount', personA.pclsAmount);
          break;
        case 'contributions':
          setInput('input-pension-contribution', personA.dcMonthlyContrib);
          break;
        case 'isa-savings':
          setInput('input-isa-balance', personA.isaBalance);
          setInput('input-isa-contribution', personA.isaAnnualContrib);
          setInput('input-state-pension-age', personA.statePensionAge);
          setInput('input-state-pension-amount', personA.statePensionAmount || personA.expectedStatePension);
          break;
      }

      // Restore Person B values into injected partner inputs
      if (state.onboardingState?.householdType === HOUSEHOLD_TYPES.COUPLE && state.onboardingState.personB) {
        const personB = state.onboardingState.personB;
        switch (screenId) {
          case 'age':
            setInput('input-partner-current-age', personB.currentAge);
            setInput('input-partner-retirement-age', personB.retirementAge);
            break;
          case 'pension-pot':
            setInput('input-partner-pension-pot', personB.dcPot);
            setInput('input-partner-db-income', personB.dbAnnualIncome);
            setInput('input-partner-db-start', personB.dbStartAge);
            setInput('input-partner-pension-contribution', personB.dcMonthlyContrib);
            if (personB.salarySacrifice) { const el = document.getElementById('input-partner-salary-sacrifice'); if (el) el.checked = true; }
            if (personB.flexiAccessed) { const el = document.getElementById('input-partner-flexi-accessed'); if (el) el.checked = true; }
            if (personB.pclsTaken) {
              const el = document.getElementById('input-partner-pcls-taken'); if (el) el.checked = true;
              const sec = document.getElementById('partner-pcls-amount-section'); if (sec) sec.style.display = 'block';
            }
            setInput('input-partner-pcls-amount', personB.pclsAmount);
            break;
          case 'isa-savings':
            setInput('input-partner-isa-balance', personB.isaBalance);
            setInput('input-partner-isa-contribution', personB.isaAnnualContrib);
            setInput('input-partner-state-pension-age', personB.statePensionAge);
            setInput('input-partner-state-pension-amount', personB.statePensionAmount || personB.expectedStatePension);
            break;
        }
      }
    }

    function nextScreen() {
      saveCurrentScreenInputs();
      SCREEN_ORDER = getActiveScreenOrder();
      const currentIndex = SCREEN_ORDER.indexOf(state.currentScreen);
      if (currentIndex < SCREEN_ORDER.length - 1) {
        showScreen(SCREEN_ORDER[currentIndex + 1]);
      }
    }

    function prevScreen() {
      saveCurrentScreenInputs();
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
      
      // Person A (main user) requirements — use onboarding state + live component for couples
      const personA = state.onboardingState?.personA;
      const isCouplesFlow = state.onboardingState?.householdType === HOUSEHOLD_TYPES.COUPLE;

      // For couples, also try live component data as fallback
      let cpA = null;
      let cpTarget = null;
      if (isCouplesFlow && couplesInputComponent) {
        try {
          const live = couplesInputComponent.getData();
          cpA = live?.personA;
          cpTarget = live?.targetNetIncome;
        } catch (e) { /* ignore */ }
      }

      const currentAge = isCouplesFlow ? (personA?.currentAge || cpA?.currentAge || 0) : getValue('input-current-age', 0);
      const retirementAge = isCouplesFlow ? (personA?.retirementAge || cpA?.retirementAge || 0) : getValue('input-retirement-age', 0);
      const targetIncome = isCouplesFlow ? (state.onboardingState?.targetNetIncome || cpTarget || 0) : getValue('input-target-income', 0);
      const pensionPot = isCouplesFlow ? (personA?.dcPot ?? cpA?.dcPot ?? 0) : getValue('input-pension-pot', 0);
      
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
        if (personA) {
          // Auto-assign 'dc' since pension-types screen was skipped
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

        // Auto-assign DC pension type for partner if not set (pension-types screen is skipped)
        if (personB && (!personB.pensionTypes || personB.pensionTypes.length === 0)) {
          personB.pensionTypes = ['dc'];
        }

        // Partner age is required
        if (!personB?.currentAge || personB.currentAge < 18) {
          result.canCalculate = false;
          result.reason = "One more detail needed: partner's current age";
          return result;
        }

        const personBPensionTypes = personB?.pensionTypes || ['dc'];
        
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
      // Preview card removed — bail out
      if (!document.getElementById('preview-retire-age')) return;
      clearTimeout(previewDebounceTimer);
      previewDebounceTimer = setTimeout(() => {
        // Include partner data for couples
        const partnerPension = getValue('input-partner-pension-pot', 0);
        const partnerContrib = getValue('input-partner-pension-contribution', 0) * 12;
        const partnerSP = state.onboardingState?.personB?.expectedStatePension || state.onboardingState?.personB?.statePensionAmount || 0;
        const partnerDB = state.onboardingState?.personB?.dbAnnualIncome || 0;

        const inputs = {
          currentAge: getValue('input-current-age', 0),
          retirementAge: getValue('input-retirement-age', 0),
          targetNetIncome: getValue('input-target-income', 0),
          currentPension: getValue('input-pension-pot', 0) + partnerPension,
          annualPensionContribution: (getValue('input-pension-contribution', 0) * 12) + partnerContrib,
          currentIsa: getValue('input-isa-balance', 0) + getValue('input-partner-isa-balance', 0),
          annualIsaContribution: getValue('input-isa-contribution', 0),
          expectedStatePension: getValue('input-state-pension-amount', 0) + partnerSP,
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
      // For couples flow, pull core values from onboarding state (not empty DOM inputs)
      const isCouplesFlow = state.onboardingState?.householdType === HOUSEHOLD_TYPES.COUPLE;
      const personA = isCouplesFlow ? state.onboardingState?.personA : null;

      // For couples, also check the live component data as fallback
      let couplesLiveData = null;
      if (isCouplesFlow && couplesInputComponent) {
        try { couplesLiveData = couplesInputComponent.getData(); } catch (e) { /* ignore */ }
      }
      const cpA = couplesLiveData?.personA;
      const cpTarget = couplesLiveData?.targetNetIncome;

      // Helper: get couples value with multiple fallback sources
      function cVal(stateVal, liveVal, fallback) {
        if (stateVal != null && stateVal !== 0 && stateVal !== '') return stateVal;
        if (liveVal != null && liveVal !== 0 && liveVal !== '') return liveVal;
        return fallback;
      }

      const result = {
        // Basic inputs — use onboarding state + live component for couples, DOM inputs for singles
        currentAge: isCouplesFlow ? cVal(personA?.currentAge, cpA?.currentAge, 0) : getValue('input-current-age'),
        retirementAge: isCouplesFlow ? cVal(personA?.retirementAge, cpA?.retirementAge, 0) : getValue('input-retirement-age'),
        targetNetIncome: isCouplesFlow ? cVal(state.onboardingState?.targetNetIncome, cpTarget, 0) : getValue('input-target-income'),
        currentPension: isCouplesFlow
          ? (cVal(personA?.dcPot, cpA?.dcPot, 0) + cVal(state.onboardingState?.personB?.dcPot, couplesLiveData?.personB?.dcPot, 0))
          : getValue('input-pension-pot', 0),
        annualPensionContribution: isCouplesFlow
          ? ((cVal(personA?.dcMonthlyContrib, cpA?.dcMonthlyContrib, 0) + cVal(state.onboardingState?.personB?.dcMonthlyContrib, couplesLiveData?.personB?.dcMonthlyContrib, 0)) * 12)
          : getValue('input-pension-contribution', 0) * 12,
        currentIsa: isCouplesFlow
          ? (cVal(personA?.isaBalance, cpA?.isaBalance, 0) + cVal(state.onboardingState?.personB?.isaBalance, couplesLiveData?.personB?.isaBalance, 0))
          : getValue('input-isa-balance', 0),
        annualIsaContribution: isCouplesFlow
          ? (cVal(personA?.isaAnnualContrib, cpA?.isaAnnualContrib, 0) + cVal(state.onboardingState?.personB?.isaAnnualContrib, couplesLiveData?.personB?.isaAnnualContrib, 0))
          : getValue('input-isa-contribution', 0),
        statePensionAge: isCouplesFlow ? cVal(personA?.statePensionAge, cpA?.statePensionAge, 67) : getValue('input-state-pension-age', 67),
        expectedStatePension: isCouplesFlow ? cVal(personA?.expectedStatePension, cpA?.expectedStatePension, 11500) : getValue('input-state-pension-amount', 11973),

        // Advanced options
        scenario: getSelectedValue('scenario-select', 'moderate'),
        enableMonteCarlo: getChecked('enable-monte-carlo'),
        enableBenchmarking: getChecked('enable-benchmarking'),
        enableTaxOptimization: getChecked('enable-tax-optimization'),
        modelCareCosts: getChecked('model-care-costs'),

        // DB Pension
        hasDBPension: (cVal(personA?.dbAnnualIncome, null, 0) || getValue('input-your-db-income', 0)) > 0,
        dbPensionAmount: cVal(personA?.dbAnnualIncome, null, 0) || getValue('input-your-db-income', 0),
        dbPensionStartAge: cVal(personA?.dbStartAge, null, 65) || getValue('input-your-db-start', 65),

        // Couple mode
        isCouple: isCouplesFlow,
        householdType: state.onboardingState?.householdType || null,
        personA: isCouplesFlow ? (personA || cpA || null) : null,
        personB: isCouplesFlow ? (state.onboardingState?.personB || couplesLiveData?.personB || null) : null,

        // Partner pensions (passed to createPlan for couples projection)
        partnerDCPot: isCouplesFlow ? cVal(state.onboardingState?.personB?.dcPot, couplesLiveData?.personB?.dcPot, 0) : 0,
        partnerCurrentAge: isCouplesFlow ? cVal(state.onboardingState?.personB?.currentAge, couplesLiveData?.personB?.currentAge, 0) : 0,
        partnerStatePensionAge: isCouplesFlow ? cVal(state.onboardingState?.personB?.statePensionAge, couplesLiveData?.personB?.statePensionAge, 0) : 0,
        partnerExpectedStatePension: isCouplesFlow ? cVal(state.onboardingState?.personB?.expectedStatePension, state.onboardingState?.personB?.statePensionAmount, 0) : 0,
        partnerDBPensionAmount: isCouplesFlow ? (
          cVal(state.onboardingState?.personB?.dbAnnualIncome, null, 0)
          || getValue('input-partner-db-income', 0)
        ) : 0,
        partnerDBPensionStartAge: isCouplesFlow ? (
          cVal(state.onboardingState?.personB?.dbStartAge, null, 67)
          || getValue('input-partner-db-start', 67)
        ) : 67,

        // Spending reductions in later life (always enabled)
        applyAgeBasedSpendingReductions: true,

        // Phased retirement
        isPhasedRetirement: getChecked('is-phased-retirement'),
        phaseStartAge: getValue('phase-start-age', 0),
        reducedHours: getValue('reduced-hours', 50),

        // PCLS Strategy
        pclsStrategy: getSelectedValue('pcls-strategy', 'all_at_retirement'),
        pclsReinvest: getChecked('pcls-reinvest'),
        pclsAlreadyTaken: getChecked('input-pcls-taken') || getChecked('pcls-already-taken') || (state.onboardingState?.personA?.pclsTaken || false),
        useGuardrails: getChecked('input-guardrails') || getChecked('results-guardrails'),
        pclsAmountTaken: getValue('input-pcls-amount', 0) || getValue('pcls-amount-taken', 0) || (state.onboardingState?.personA?.pclsAmount || 0),

        // Tax jurisdiction
        taxJurisdiction: getSelectedValue('tax-jurisdiction', 'england')
      };

      // Salary sacrifice: employer saves 13.8% NI and often passes it on
      if (getChecked('input-salary-sacrifice')) {
        result.annualPensionContribution = Math.round(result.annualPensionContribution * 1.138);
      }

      // MPAA enforcement: if user has flexibly accessed pension, cap contributions at 10,000/year
      if (getChecked('input-flexi-accessed') && result.annualPensionContribution > 10000) {
        result.annualPensionContribution = 10000;
      }

      return result;
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
      const isCouplesFlow = state.onboardingState?.householdType === HOUSEHOLD_TYPES.COUPLE;

      // For couples: read directly from the live component + onboarding state (the source of truth)
      // For singles: read directly from DOM inputs (the source of truth)
      // This avoids the fragile collectFormData() pipeline for display purposes
      let displayAge, displayRetire, displayIncome, displayPot;
      let personALabel = 'You';

      if (isCouplesFlow) {
        // Get live data directly from the couples component
        let liveA = state.onboardingState?.personA || {};
        let liveTarget = state.onboardingState?.targetNetIncome || 0;
        if (couplesInputComponent) {
          try {
            const live = couplesInputComponent.getData();
            if (live?.personA) liveA = { ...liveA, ...live.personA };
            if (live?.targetNetIncome) liveTarget = live.targetNetIncome;
            // Sync back to onboarding state so collectFormData() is also correct
            state.onboardingState.personA = { ...state.onboardingState.personA, ...live.personA };
            state.onboardingState.personB = { ...state.onboardingState.personB, ...live.personB };
            state.onboardingState.targetNetIncome = live.targetNetIncome;
          } catch (e) { /* use existing state */ }
        }
        displayAge = liveA.currentAge || 0;
        displayRetire = liveA.retirementAge || 0;
        displayIncome = liveTarget;
        displayPot = liveA.dcPot || 0;
      } else {
        displayAge = getValue('input-current-age', 0);
        displayRetire = getValue('input-retirement-age', 0);
        displayIncome = getValue('input-target-income', 0);
        displayPot = getValue('input-pension-pot', 0);

        // Bridge single-person DOM values into onboarding state
        if (state.onboardingState?.personA) {
          state.onboardingState.personA.currentAge = displayAge;
          state.onboardingState.personA.retirementAge = displayRetire;
          state.onboardingState.personA.dcPot = displayPot;
          state.onboardingState.personA.dcMonthlyContrib = getValue('input-pension-contribution', 0);
          state.onboardingState.personA.dcAnnualContrib = getValue('input-pension-contribution', 0) * 12;
          state.onboardingState.targetNetIncome = displayIncome;
        }
      }

      // Now also update formData via collectFormData for the calculate button
      const data = collectFormData();
      state.formData = data;

      // Format display values — show dash instead of zero for unfilled fields
      function showVal(v) { return (v && v > 0) ? v : '—'; }
      function showMoney(v) { return (v && v > 0) ? '£' + Math.round(v).toLocaleString() : '—'; }

      // Build the review HTML
      let html = '';

      if (isCouplesFlow) {
        // Couples review: show both persons side by side
        const pA = state.onboardingState?.personA || {};
        const pB = state.onboardingState?.personB || {};

        // Belt-and-braces: if partner retirement age wasn't saved, use partner's SP age as fallback
        if (!pB.retirementAge && pB.currentAge) {
          pB.retirementAge = pB.statePensionAge || 67;
        }

        html = `
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="font-size: var(--font-size-lg); font-weight: 600; color: var(--color-text-secondary);">Household Income Target</div>
            <div style="font-size: var(--font-size-2xl); font-weight: 700; color: var(--color-primary); margin-top: 0.25rem;">${showMoney(displayIncome)}<span style="font-size: var(--font-size-sm); font-weight: 400; color: var(--color-text-light);">/year</span></div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <!-- Person A (You) -->
            <div style="background: var(--color-surface); border-radius: var(--radius-lg); padding: 1rem; border: 1px solid var(--color-border-light, #f1f5f9);">
              <div style="font-weight: 600; margin-bottom: 0.75rem; color: var(--color-primary);">You</div>
              <div style="font-size: 0.8rem; color: var(--color-text-light); margin-bottom: 0.25rem;">Age</div>
              <div style="font-weight: 600; margin-bottom: 0.5rem;">${showVal(pA.currentAge)}</div>
              <div style="font-size: 0.8rem; color: var(--color-text-light); margin-bottom: 0.25rem;">Retire at</div>
              <div style="font-weight: 600; margin-bottom: 0.5rem;">${showVal(pA.retirementAge)}</div>
              <div style="font-size: 0.8rem; color: var(--color-text-light); margin-bottom: 0.25rem;">DC Pension</div>
              <div style="font-weight: 600; margin-bottom: 0.5rem;">${showMoney(pA.dcPot)}</div>
              <div style="font-size: 0.8rem; color: var(--color-text-light); margin-bottom: 0.25rem;">Monthly contrib</div>
              <div style="font-weight: 600;">${showMoney(pA.dcMonthlyContrib)}</div>
            </div>

            <!-- Person B (Partner) -->
            <div style="background: var(--color-surface); border-radius: var(--radius-lg); padding: 1rem; border: 1px solid var(--color-border-light, #f1f5f9);">
              <div style="font-weight: 600; margin-bottom: 0.75rem; color: var(--color-accent, #0d9488);">Partner</div>
              <div style="font-size: 0.8rem; color: var(--color-text-light); margin-bottom: 0.25rem;">Age</div>
              <div style="font-weight: 600; margin-bottom: 0.5rem;">${showVal(pB.currentAge)}</div>
              <div style="font-size: 0.8rem; color: var(--color-text-light); margin-bottom: 0.25rem;">Retire at</div>
              <div style="font-weight: 600; margin-bottom: 0.5rem;">${showVal(pB.retirementAge)}</div>
              <div style="font-size: 0.8rem; color: var(--color-text-light); margin-bottom: 0.25rem;">DC Pension</div>
              <div style="font-weight: 600; margin-bottom: 0.5rem;">${showMoney(pB.dcPot)}</div>
              <div style="font-size: 0.8rem; color: var(--color-text-light); margin-bottom: 0.25rem;">Monthly contrib</div>
              <div style="font-weight: 600;">${showMoney(pB.dcMonthlyContrib)}</div>
            </div>
          </div>
        `;
      } else {
        // Single person review: clean grid
        html = `
          <div class="results-metrics" style="margin-bottom: 1rem;">
            <div class="metric">
              <span class="metric-label">Current Age</span>
              <span class="metric-value">${showVal(displayAge)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Retire At</span>
              <span class="metric-value">${showVal(displayRetire)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Target Income</span>
              <span class="metric-value">${showMoney(displayIncome)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Pension Pot</span>
              <span class="metric-value">${showMoney(displayPot)}</span>
            </div>
          </div>
        `;
      }

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
    
    // ═══════════════════════════════════════════════════════════════
    // Live What-if Sliders — instant deterministic re-projection
    // ═══════════════════════════════════════════════════════════════
    let sliderDebounceTimer = null;
    const originalFormData = {};

    function initSliders() {
      if (!state.formData) return;
      Object.assign(originalFormData, state.formData);

      const ageSlider = document.getElementById('slider-retirement-age');
      const contribSlider = document.getElementById('slider-monthly-contribution');
      if (ageSlider) {
        ageSlider.value = state.formData.retirementAge || 60;
        document.getElementById('slider-retirement-age-value').textContent = ageSlider.value;
        updateSliderFill(ageSlider);
      }
      if (contribSlider) {
        const monthly = Math.round((state.formData.annualPensionContribution || 0) / 12);
        contribSlider.value = monthly;
        document.getElementById('slider-contribution-value').textContent = '£' + Number(monthly).toLocaleString();
        updateSliderFill(contribSlider);
      }
    }

    function updateSliderFill(slider) {
      if (!slider) return;
      const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
      slider.style.background = `linear-gradient(to right, var(--color-primary, #4f46e5) ${pct}%, var(--color-border, #e2e8f0) ${pct}%)`;
    }

    function runSliderProjection() {
      if (!state.formData || !state.planA) return;
      const ageSlider = document.getElementById('slider-retirement-age');
      const contribSlider = document.getElementById('slider-monthly-contribution');
      if (!ageSlider || !contribSlider) return;

      const newAge = parseInt(ageSlider.value);
      const newMonthly = parseInt(contribSlider.value);
      const newAnnualContrib = newMonthly * 12;

      document.getElementById('slider-retirement-age-value').textContent = newAge;
      document.getElementById('slider-contribution-value').textContent = '£' + Number(newMonthly).toLocaleString();
      updateSliderFill(ageSlider);
      updateSliderFill(contribSlider);

      clearTimeout(sliderDebounceTimer);
      sliderDebounceTimer = setTimeout(() => {
        try {
          const data = { ...state.formData, retirementAge: newAge, annualPensionContribution: newAnnualContrib };
          const scenarioPreset = SCENARIO_PRESETS[data.scenario] || SCENARIO_PRESETS.moderate;
          const altPlan = createPlan({
            ...data,
            assumptions: {
              projection: {
                defaultGrowthRate: scenarioPreset.growthRate || 0.04,
                defaultFeeRate: scenarioPreset.feeRate || 0.005
              }
            }
          });
          const altProjection = runProjection(altPlan, { endAge: 90 });

          state.formData.retirementAge = newAge;
          state.formData.annualPensionContribution = newAnnualContrib;
          state.planA = altPlan;
          state.projectionA = altProjection;

          updateHeroFromProjection(altProjection, null);

          renderSPBridge(altProjection, data);
          renderNarrativeSummary(altProjection, state.lastResults);
          renderCashflowChart(altProjection, data);
          renderCapitalChart(altProjection);
          renderDataTable(altProjection, data);
          try { initSankey(altProjection); } catch (e) { /* ok */ }

          const impactEl = document.getElementById('slider-impact');
          if (impactEl) {
            const origBalance = originalFormData._originalFinalBalance;
            const newBalance = altProjection.summary.finalBalance;
            if (origBalance != null) {
              const delta = newBalance - origBalance;
              const sign = delta >= 0 ? '+' : '';
              impactEl.style.display = 'block';
              impactEl.innerHTML = `vs original plan: <span style="color: ${delta >= 0 ? 'var(--color-success, #059669)' : 'var(--color-danger, #dc2626)'}; font-weight: 700;">${sign}${formatCurrency(delta)}</span> final balance`;
            }
          }
        } catch (e) {
          console.warn('Slider projection failed:', e);
        }
      }, 100);
    }

    // ═══════════════════════════════════════════════════════════════
    // Full Calculation — extracted so results screen can call it directly
    // ═══════════════════════════════════════════════════════════════
    function runFullCalculation() {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) overlay.style.display = 'flex';

      setTimeout(() => {
        try {
          const validation = validateCanCalculate();
          if (!validation.canCalculate) {
            showError(validation.reason || 'Please complete all required fields');
            if (overlay) overlay.style.display = 'none';
            return;
          }

          const data = collectFormData();
          state.formData = data;

          if (state.onboardingState && state.onboardingState.householdType) {
            data.householdType = state.onboardingState.householdType;
            data.personA = state.onboardingState.personA;
            data.personB = state.onboardingState.personB;
            data.isCouple = state.onboardingState.householdType === HOUSEHOLD_TYPES.COUPLE;
          }

          const assumptions = createUserAssumptions(SCENARIO_PRESETS[data.scenario] || SCENARIO_PRESETS.moderate);

          let household = null;
          try {
            if (data.householdType === HOUSEHOLD_TYPES.COUPLE && state.onboardingState) {
              const householdPlan = onboardingToHouseholdPlan(state.onboardingState);
              household = createHouseholdPlan(householdPlan);
            } else {
              household = createHousehold({
                person1: { currentAge: data.currentAge, retirementAge: data.retirementAge },
                person2: null
              });
            }
          } catch (e) {
            console.warn('Household creation failed:', e);
            household = { person1: { currentAge: data.currentAge, retirementAge: data.retirementAge }, person2: null, isCouple: false };
          }

          const scenarioPreset = SCENARIO_PRESETS[data.scenario] || SCENARIO_PRESETS.moderate;
          if (data.isCouple && state.onboardingState?.personB?.dbAnnualIncome > 0 && !data.partnerDBPensionAmount) {
            data.partnerDBPensionAmount = state.onboardingState.personB.dbAnnualIncome;
            data.partnerDBPensionStartAge = state.onboardingState.personB.dbStartAge || 67;
          }
          const plan = createPlan({
            name: 'Plan A',
            ...data,
            assumptions: {
              projection: {
                defaultGrowthRate: scenarioPreset.growthRate || 0.04,
                defaultFeeRate: scenarioPreset.feeRate || 0.005,
                volatility: scenarioPreset.volatility || 0.15
              }
            }
          });
          const basicProjection = runProjection(plan, { endAge: 90 });

          state.planA = plan;
          state.projectionA = basicProjection;

          const results = { basicProjection, household, assumptions, data, plan };

          if (data.isCouple && household && state.onboardingState) {
            try {
              const householdPlanInput = {
                householdType: 'couple',
                personA: {
                  name: 'You', currentAge: data.currentAge, retirementAge: data.retirementAge,
                  pensionTypes: state.onboardingState.personA?.pensionTypes || ['dc'],
                  dcPot: data.currentPension, dcMonthlyContrib: data.annualPensionContribution / 12,
                  isaBalance: data.currentIsa || 0, isaAnnualContrib: data.annualIsaContribution || 0,
                  statePensionAge: data.statePensionAge, expectedStatePension: data.expectedStatePension,
                  hasDB: data.hasDBPension, dbAnnualIncome: data.dbPensionAmount || 0, dbStartAge: data.dbPensionStartAge || 65
                },
                personB: {
                  name: 'Partner', currentAge: state.onboardingState.personB.currentAge,
                  retirementAge: state.onboardingState.personB.retirementAge,
                  pensionTypes: state.onboardingState.personB.pensionTypes || ['dc'],
                  dcPot: state.onboardingState.personB.dcPot || 0,
                  dcMonthlyContrib: state.onboardingState.personB.dcMonthlyContrib || 0,
                  isaBalance: 0, isaAnnualContrib: 0,
                  statePensionAge: state.onboardingState.personB.statePensionAge || 67,
                  expectedStatePension: state.onboardingState.personB.expectedStatePension || 11973,
                  hasDB: (state.onboardingState.personB.pensionTypes || []).includes('db'),
                  dbAnnualIncome: state.onboardingState.personB.dbAnnualIncome || 0,
                  dbStartAge: state.onboardingState.personB.dbStartAge || 67
                },
                targetNetIncome: data.targetNetIncome, planningHorizonAge: 95,
                growthRate: assumptions.growthRate || 0.04, feeRate: assumptions.feeRate || 0.005,
                inflationRate: assumptions.inflationRate || 0.02
              };
              const fullHouseholdPlan = createHouseholdPlan(householdPlanInput);
              const householdTimeline = projectHousehold(fullHouseholdPlan);
              results.householdTimeline = householdTimeline;
              results.fullHouseholdPlan = fullHouseholdPlan;
            } catch (e) {
              console.warn('Household projection failed, falling back to single-person:', e);
            }
          }

          if (data.enableMonteCarlo) {
            try {
              results.mcResult = runMonteCarloWithBands(plan, {
                iterations: 1000, endAge: 90,
                mean: scenarioPreset.growthRate || 0.04, volatility: scenarioPreset.volatility || 0.15,
                seed: 42
              });
            } catch (e) { console.warn('Monte Carlo failed:', e); }
          }

          try { results.readiness = calculateReadinessScore(basicProjection, data); } catch (e) { /* ok */ }
          try {
            results.insights = generateInsights(plan, basicProjection);
            results.recommendations = generateRecommendations(basicProjection, data, results.mcResult);
          } catch (e) { /* ok */ }
          if (data.enableBenchmarking) {
            try { results.benchmarks = generateBenchmarkAnalysis(plan, basicProjection); } catch (e) { /* ok */ }
          }
          try { results.milestones = integrateMilestonesIntoSpending([], plan); } catch (e) { /* ok */ }
          if (data.hasDBPension && data.dbPensionAmount > 0) {
            try { results.dbPension = createDBPension({ annualAmount: data.dbPensionAmount, startAge: data.dbPensionStartAge, inflationLinked: true }); } catch (e) { /* ok */ }
          }
          if (data.modelCareCosts) {
            try {
              const hp = createHealthcarePlan({ startAge: data.currentAge, retirementAge: data.retirementAge });
              results.careCosts = projectHealthcareCosts(hp, data.retirementAge, 95);
            } catch (e) { /* ok */ }
          }
          if (data.enableTaxOptimization) {
            try { results.taxOptimization = generateTaxEfficiencyReport({ currentPot: data.currentPension, isaBalance: data.currentIsa || 0, targetIncome: data.targetNetIncome }); } catch (e) { /* ok */ }
          }
          try { results.spendingRules = createSpendingRules({}); } catch (e) { /* ok */ }
          if (results.mcResult) {
            try {
              results.riskScore = calculateRiskScore(results.mcResult, basicProjection);
              results.riskRecommendations = generateRiskRecommendations(results.riskScore, basicProjection);
            } catch (e) { /* ok */ }
          }
          try {
            results.legacyPlan = createLegacyPlan({ targetLegacy: 0, beneficiaries: [] });
            results.estateValue = projectEstateValue({ currentWealth: basicProjection.summary.finalBalance }, 0);
            results.ihtEstimate = calculateInheritanceTax(results.estateValue);
          } catch (e) { /* ok */ }
          if (data.isPhasedRetirement && data.phaseStartAge > 0) {
            try { results.phasedRetirement = createPhasedRetirement({ fullRetirementAge: data.retirementAge, phaseStartAge: data.phaseStartAge, reducedHoursPercent: data.reducedHours }); } catch (e) { /* ok */ }
          }

          state.lastResults = results;
          updateProvisionalBanner();
          renderResults(basicProjection, results);

          try {
            renderIncomeGap(basicProjection, data);
            renderSPBridge(basicProjection, data);
            renderContributionImpact(basicProjection, data);
            renderCashflowChart(basicProjection, data);
            renderTaxChart(basicProjection);
            renderGuaranteedIncomeChart(basicProjection, data);
            renderIncomeSourcesBreakdown(basicProjection, data);
            renderDataTable(basicProjection, data);
            initSankey(basicProjection);
          } catch (e) { console.warn('Chart rendering failed:', e); }

          renderAllVisualizations(results);

        } catch (error) {
          console.error(error);
          showError(error.message);
        } finally {
          if (overlay) overlay.style.display = 'none';
        }
      }, 50);
    }

    // Surgical hero update from projection — used by sliders for instant feedback
    function updateHeroFromProjection(projection, results) {
      const { summary, plan } = projection;
      const isSuccess = summary.finalBalance > 0 && summary.successRate >= 1.0;
      const mcSuccess = results?.mcResult?.statistics?.successRate;
      let confidenceNum;
      if (mcSuccess != null) {
        // Full MC result available — use directly
        confidenceNum = Math.round(mcSuccess * 100);
      } else if (originalFormData._mcConfidence != null && originalFormData._originalFinalBalance != null) {
        // Slider change: scale MC confidence proportionally to balance change
        const origBalance = originalFormData._originalFinalBalance;
        const origConf = originalFormData._mcConfidence;
        if (origBalance > 0) {
          const ratio = summary.finalBalance / origBalance;
          confidenceNum = Math.min(100, Math.max(0, Math.round(origConf * Math.pow(ratio, 0.3))));
        } else {
          confidenceNum = summary.finalBalance > 0 ? 100 : 0;
        }
      } else {
        confidenceNum = summary.finalBalance > 0 ? 100 : Math.round(summary.successRate * 100);
      }
      let confidenceColor = '#059669';
      if (confidenceNum < 60) confidenceColor = '#dc2626';
      else if (confidenceNum < 85) confidenceColor = '#d97706';

      const monthly = Math.round(plan.targetNetIncome / 12);

      // Update question
      const question = document.querySelector('.results-question');
      if (question) question.innerHTML = `Can I retire at ${plan.retirementAge} on <span id="hero-income-amount" data-annual="${plan.targetNetIncome}">${formatCurrency(monthly)}/mo</span>?`;

      // Update gauge arc and score
      const arcEl = document.getElementById('confidence-arc');
      const scoreEl = document.getElementById('confidence-score');
      if (arcEl) { arcEl.setAttribute('stroke', confidenceColor); arcEl.setAttribute('stroke-dasharray', `${confidenceNum * 2.04} 999`); }
      if (scoreEl) { scoreEl.textContent = confidenceNum; scoreEl.setAttribute('fill', confidenceColor); }

      // Update metrics
      const metrics = document.querySelectorAll('.metric-value[data-metric]');
      metrics.forEach(el => {
        const key = el.dataset.metric;
        if (key === 'retirementPot') el.textContent = formatCurrency(summary.retirementPot);
        else if (key === 'confidence') { el.textContent = confidenceNum + '%'; el.style.color = confidenceColor; }
        else if (key === 'finalBalance') el.textContent = formatCurrency(summary.finalBalance);
        else if (key === 'pclsTaken') el.textContent = formatCurrency(summary.pclsTaken);
      });
    }

    function renderResults(projection, results = null) {
      const { summary, plan } = projection;

      const mcSuccess = results?.mcResult?.statistics?.successRate;
      const confidenceNum = mcSuccess != null ? Math.round(mcSuccess * 100) : Math.round(summary.successRate * 100);
      const isSuccess = confidenceNum >= 85;
      let confidenceColor = '#059669';
      if (confidenceNum < 60) { confidenceColor = '#dc2626'; }
      else if (confidenceNum < 85) { confidenceColor = '#d97706'; }

      const monthly = Math.round(plan.targetNetIncome / 12);

      const html = `
        <div class="card-hero">
          <h2 class="results-question tracking-tight">
            Can I retire at ${plan.retirementAge} on <span id="hero-income-amount" data-annual="${plan.targetNetIncome}">${formatCurrency(monthly)}/mo</span>?
          </h2>
          <button id="toggle-monthly" class="text-xs text-muted mt-xs" style="padding: 0.25rem 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-full); background: var(--color-surface); cursor: pointer; transition: all var(--transition-fast);">Show annual</button>

          <div class="gauge-wrapper">
            <svg width="160" height="100" viewBox="0 0 160 100" style="overflow: visible;">
              <defs>
                <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="${confidenceColor}" stop-opacity="0.6"/>
                  <stop offset="100%" stop-color="${confidenceColor}"/>
                </linearGradient>
              </defs>
              <path d="M 15 90 A 65 65 0 0 1 145 90" fill="none" stroke="var(--color-border-light)" stroke-width="12" stroke-linecap="round"/>
              <path id="confidence-arc" d="M 15 90 A 65 65 0 0 1 145 90" fill="none" stroke="url(#gauge-grad)" stroke-width="12" stroke-linecap="round"
                stroke-dasharray="${confidenceNum * 2.04} 999"
                style="transition: stroke-dasharray 0.8s cubic-bezier(0.16, 1, 0.3, 1);"/>
              <text id="confidence-score" x="80" y="72" text-anchor="middle" font-size="36" font-weight="700" fill="${confidenceColor}" font-family="Inter, system-ui">${confidenceNum}</text>
              <text x="80" y="92" text-anchor="middle" font-size="10" fill="var(--color-text-light)" font-family="Inter, system-ui" letter-spacing="0.03em">out of 100</text>
            </svg>
            <div class="gauge-label">market scenarios support your plan to age 90</div>
          </div>
        </div>

        <div class="results-metrics mb-md">
          <div class="metric">
            <span class="metric-label">Total Wealth</span>
            <span class="metric-value" data-metric="retirementPot">${formatCurrency(summary.retirementPot)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Tax-Free Cash</span>
            <span class="metric-value" data-metric="pclsTaken">${formatCurrency(summary.pclsTaken)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Confidence</span>
            <span class="metric-value text-${confidenceNum >= 85 ? 'success' : confidenceNum >= 60 ? 'warning' : 'danger'}" data-metric="confidence">${confidenceNum}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Surplus at 90</span>
            <span class="metric-value" data-metric="finalBalance">${formatCurrency(summary.finalBalance)}</span>
          </div>
        </div>

        <p class="text-xs text-muted text-center mt-md">
          For planning purposes only. Not regulated financial advice. Tax year 2025/26 rates.
        </p>
      `;

      document.getElementById('results-container').innerHTML = html;

      // Update sticky header with plan summary
      const headerSummary = document.getElementById('results-header-summary');
      if (headerSummary) headerSummary.textContent = `Age ${plan.retirementAge} · ${formatCurrency(monthly)}/mo · ${confidenceNum}%`;

      // Render narrative summary
      renderNarrativeSummary(projection, results);

      // Populate shareable summary card
      const shareCardEl = document.getElementById('share-card-content');
      if (shareCardEl) {
        const shareData = state.formData || {};
        const isCouple = shareData.isCouple || (plan.partnerCurrentAge > 0);
        const mcPct = results?.mcResult?.statistics?.successRate;
        const conf = mcPct != null ? Math.round(mcPct * 100) : Math.round(summary.successRate * 100);
        const who = isCouple ? 'We' : 'I';
        shareCardEl.innerHTML = `
          <div style="font-weight: 700; margin-bottom: 0.25rem;">${who} can retire at ${plan.retirementAge} on ${formatCurrency(monthly)}/mo (${formatCurrency(plan.targetNetIncome)}/yr)</div>
          <div>${conf} out of 100 market scenarios support this plan to age 90</div>
          <div>Final balance: ${formatCurrency(summary.finalBalance)} | ISA preserved</div>
          <div style="font-size: 0.7rem; color: var(--color-text-light); margin-top: 0.25rem;">RetireLens Pro | Not financial advice | ${new Date().toLocaleDateString()}</div>
        `;
      }

      // Copy share card button
      document.getElementById('copy-share-card')?.addEventListener('click', () => {
        const text = document.getElementById('share-card-content')?.textContent;
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('copy-share-card');
            if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy summary'; }, 2000); }
          }).catch(() => {});
        }
      });

      // Monthly/annual toggle — starts in monthly (income-first framing)
      let showAnnual = false;
      document.getElementById('toggle-monthly')?.addEventListener('click', () => {
        showAnnual = !showAnnual;
        const btn = document.getElementById('toggle-monthly');
        if (btn) btn.textContent = showAnnual ? 'Show monthly' : 'Show annual';
        const heroAmount = document.getElementById('hero-income-amount');
        if (heroAmount) {
          const annual = parseFloat(heroAmount.dataset.annual);
          if (!isNaN(annual)) heroAmount.textContent = showAnnual ? formatCurrency(annual) + '/yr' : formatCurrency(Math.round(annual / 12)) + '/mo';
        }
        document.querySelectorAll('[data-annual]').forEach(el => {
          if (el.id === 'hero-income-amount') return;
          const annual = parseFloat(el.dataset.annual);
          if (!isNaN(annual)) el.textContent = showAnnual ? formatCurrency(annual) : formatCurrency(Math.round(annual / 12)) + '/mo';
        });
      });

      // Initialize sliders and snapshot baseline for proportional slider confidence
      if (typeof originalFormData !== 'undefined' && state.formData) {
        state.formData._originalFinalBalance = summary.finalBalance;
        state.formData._mcConfidence = confidenceNum;
      }
      initSliders();

      // Populate input summary with inline editing
      const inputsSummaryEl = document.getElementById('inputs-summary');
      if (inputsSummaryEl) {
        const d = state.formData || {};
        function editCell(label, key, value, isCurrency) {
          const display = isCurrency ? formatCurrency(value) : value;
          return `<tr>
            <td>${label}</td>
            <td style="text-align: right;">
              <span class="inline-edit" data-key="${key}" data-currency="${isCurrency ? '1' : '0'}" title="Tap to edit">${display} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: -1px; opacity: 0.5;"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></span>
            </td>
          </tr>`;
        }
        let inputsHtml = '<table style="width: 100%; border-collapse: collapse;">';
        inputsHtml += editCell('Your age', 'currentAge', d.currentAge || plan.currentAge, false);
        inputsHtml += editCell('Retirement age', 'retirementAge', d.retirementAge || plan.retirementAge, false);
        inputsHtml += editCell('Target income', 'targetNetIncome', d.targetNetIncome || plan.targetNetIncome, true);
        inputsHtml += editCell('Pension pot', 'currentPension', d.currentPension, true);
        inputsHtml += editCell('Monthly contributions', 'monthlyContrib', Math.round((d.annualPensionContribution || 0) / 12), true);
        inputsHtml += editCell('ISA balance', 'currentIsa', d.currentIsa || 0, true);
        inputsHtml += editCell('State Pension age', 'statePensionAge', d.statePensionAge || 67, false);
        inputsHtml += editCell('State Pension', 'expectedStatePension', d.expectedStatePension || 11973, true);
        if (d.isCouple) {
          inputsHtml += `<tr><td style="padding-top: 0.5rem; font-weight: 600;" colspan="2">Partner</td></tr>`;
          inputsHtml += editCell('Partner age', 'partnerCurrentAge', d.partnerCurrentAge || 0, false);
          inputsHtml += editCell('Partner SP', 'partnerExpectedStatePension', d.partnerExpectedStatePension || 0, true);
          inputsHtml += editCell('Partner DB', 'partnerDBPensionAmount', d.partnerDBPensionAmount || 0, true);
        }
        if (d.hasDBPension) {
          inputsHtml += editCell('Your DB pension', 'dbPensionAmount', d.dbPensionAmount || 0, true);
        }
        if (d.pclsAlreadyTaken) {
          inputsHtml += editCell('PCLS taken', 'pclsAmountTaken', d.pclsAmountTaken || 0, true);
        }
        inputsHtml += '</table>';
        inputsHtml += '<p style="font-size: 0.65rem; color: var(--color-text-light); margin-top: 0.5rem;">Tap any value to edit. Changes recalculate instantly.</p>';
        inputsSummaryEl.innerHTML = inputsHtml;

        // Wire up inline editing
        inputsSummaryEl.querySelectorAll('.inline-edit').forEach(el => {
          el.addEventListener('click', () => {
            if (el.querySelector('input')) return;
            const key = el.dataset.key;
            const isCurrency = el.dataset.currency === '1';
            const raw = key === 'monthlyContrib'
              ? Math.round((state.formData.annualPensionContribution || 0) / 12)
              : (state.formData[key] || 0);
            const input = document.createElement('input');
            input.type = 'text';
            input.inputMode = 'numeric';
            input.value = raw;
            input.style.cssText = 'width: 5rem; text-align: right; font-size: inherit; font-weight: 600; border: 2px solid var(--color-primary); border-radius: 4px; padding: 2px 4px; outline: none;';
            el.textContent = '';
            el.appendChild(input);
            input.focus();
            input.select();

            function commit() {
              const newVal = parseFloat(input.value) || 0;
              if (key === 'monthlyContrib') {
                state.formData.annualPensionContribution = newVal * 12;
              } else {
                state.formData[key] = newVal;
              }
              // Sync to onboarding state for consistency
              if (state.onboardingState?.personA) {
                const pa = state.onboardingState.personA;
                if (key === 'currentAge') pa.currentAge = newVal;
                if (key === 'retirementAge') pa.retirementAge = newVal;
                if (key === 'currentPension') pa.dcPot = newVal;
                if (key === 'monthlyContrib') { pa.dcMonthlyContrib = newVal; pa.dcAnnualContrib = newVal * 12; }
                if (key === 'currentIsa') pa.isaBalance = newVal;
                if (key === 'statePensionAge') pa.statePensionAge = newVal;
                if (key === 'expectedStatePension') { pa.expectedStatePension = newVal; pa.statePensionAmount = newVal; }
              }
              // Also sync DOM inputs for collectFormData
              const domMap = {
                currentAge: 'input-current-age', retirementAge: 'input-retirement-age',
                targetNetIncome: 'input-target-income', currentPension: 'input-pension-pot',
                monthlyContrib: 'input-pension-contribution', currentIsa: 'input-isa-balance',
                statePensionAge: 'input-state-pension-age', expectedStatePension: 'input-state-pension-amount'
              };
              if (domMap[key]) {
                const domEl = document.getElementById(domMap[key]);
                if (domEl) domEl.value = newVal;
              }
              el.textContent = isCurrency ? formatCurrency(newVal) : newVal;
              // Re-run full calculation
              runFullCalculation();
            }
            input.addEventListener('blur', commit);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
          });
        });
      }

      // Populate assumptions detail
      const assumptionsEl = document.getElementById('assumptions-detail');
      if (assumptionsEl) {
        const growthRate = (plan.assumptions?.projection?.defaultGrowthRate * 100 || 4).toFixed(1);
        const feeRate = (plan.assumptions?.projection?.defaultFeeRate * 100 || 0.5).toFixed(1);
        const inflation = (plan.assumptions?.projection?.inflationRate * 100 || 2).toFixed(1);
        assumptionsEl.innerHTML = `
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td>Growth rate (real)</td><td style="text-align: right;">${growthRate}%</td></tr>
            <tr><td>Fee rate</td><td style="text-align: right;">${feeRate}%</td></tr>
            <tr><td>Inflation</td><td style="text-align: right;">${inflation}%</td></tr>
            <tr><td>Tax year</td><td style="text-align: right;">2025/26</td></tr>
            <tr><td>Personal Allowance</td><td style="text-align: right;">12,570${plan.partnerCurrentAge > 0 ? ' x 2' : ''}</td></tr>
            <tr><td>State Pension growth</td><td style="text-align: right;">1%/yr real (triple lock)</td></tr>
            <tr><td>DB escalation</td><td style="text-align: right;">2%/yr</td></tr>
            <tr><td>Spending at 80+</td><td style="text-align: right;">-25%</td></tr>
            <tr><td>Spending at 90+</td><td style="text-align: right;">-35%</td></tr>
            <tr><td>Withdrawal order</td><td style="text-align: right;">SP+DB, then pension, then ISA</td></tr>
            <tr><td>Monte Carlo</td><td style="text-align: right;">1,000 scenarios</td></tr>
            <tr><td>Planning horizon</td><td style="text-align: right;">Age 90</td></tr>
            <tr><td>LSA cap (tax-free lump sum)</td><td style="text-align: right;">268,275</td></tr>
          </table>`;
      }
      
      // Render chart
      renderCapitalChart(projection);
      
      // Debug output
      if (DEBUG) {
        document.getElementById('debug-output').style.display = 'block';
        document.getElementById('debug-output').innerHTML = 
          `<pre class="debug-table">${generateDebugOutput(projection)}</pre>`;
      }
    }
    
    function renderNarrativeSummary(projection, results) {
      const el = document.getElementById('narrative-summary');
      if (!el) return;

      const { summary, plan } = projection;
      const data = state.formData || {};
      const isCouple = data.isCouple || (plan.partnerCurrentAge > 0);
      const partnerDB = data.partnerDBPensionAmount || 0;
      const partnerSP = data.partnerExpectedStatePension || 0;
      const yourSP = plan.expectedStatePension || data.expectedStatePension || 11973;
      const yourDB = plan.dbPensionAmount || data.dbPensionAmount || 0;
      const retireAge = plan.retirementAge;
      const spAge = plan.statePensionAge || data.statePensionAge || 67;

      const milestones = [];
      const ageDiff = isCouple ? ((data.partnerCurrentAge || 0) - plan.currentAge) : 0;
      function partnerAgeAt(userAge) { return isCouple ? userAge + ageDiff : null; }
      function ageLabel(userAge) {
        const pAge = partnerAgeAt(userAge);
        return pAge ? `${userAge} (${pAge})` : `${userAge}`;
      }

      // Milestone: Retirement
      milestones.push({
        age: ageLabel(retireAge),
        sortAge: retireAge,
        label: 'Retire',
        color: 'var(--color-primary, #4f46e5)',
        detail: `${formatCurrency(Math.round(plan.targetNetIncome / 12))}/mo target`
      });

      // Milestone: DB starts (if after retirement)
      if (yourDB > 0 && plan.dbPensionStartAge > retireAge) {
        milestones.push({
          age: ageLabel(plan.dbPensionStartAge),
          sortAge: plan.dbPensionStartAge,
          label: 'DB starts',
          color: 'var(--color-accent, #0d9488)',
          detail: `+${formatCurrency(Math.round(yourDB / 12))}/mo guaranteed`
        });
      }

      // Milestone: SP starts
      if (spAge > retireAge) {
        milestones.push({
          age: ageLabel(spAge),
          sortAge: spAge,
          label: 'State Pension',
          color: '#22c55e',
          detail: `+${formatCurrency(Math.round(yourSP / 12))}/mo`
        });
      }

      // Milestone: Spending cut at 80
      milestones.push({
        age: ageLabel(80),
        sortAge: 80,
        label: 'Spend -25%',
        color: 'var(--color-warning, #d97706)',
        detail: `Target drops to ${formatCurrency(Math.round(plan.targetNetIncome * 0.75 / 12))}/mo`
      });

      // Milestone: Outcome at 90
      if (summary.successRate >= 1.0) {
        milestones.push({
          age: ageLabel(90),
          sortAge: 90,
          label: 'Plan succeeds',
          color: 'var(--color-success, #059669)',
          detail: `${formatCurrency(summary.finalBalance)} remaining`
        });
      } else {
        const deplAge = summary.depletionAge || 85;
        milestones.push({
          age: ageLabel(deplAge),
          sortAge: deplAge,
          label: 'Funds run out',
          color: 'var(--color-danger, #dc2626)',
          detail: 'Increase contributions or reduce target'
        });
      }

      // MC worst case
      const mcStats = results?.mcResult?.statistics;
      if (mcStats?.depletionAge?.earliest) {
        milestones.push({
          age: ageLabel(mcStats.depletionAge.earliest),
          sortAge: mcStats.depletionAge.earliest,
          label: 'Worst 10%',
          color: 'var(--color-danger, #dc2626)',
          detail: `Funds could run out in bad markets`
        });
      }

      milestones.sort((a, b) => a.sortAge - b.sortAge);

      // Build horizontal timeline
      const minAge = milestones[0]?.age || 55;
      const maxAge = Math.max(90, milestones[milestones.length - 1]?.age || 90);
      const range = maxAge - minAge || 1;

      let html = `<h3 class="section-title">Your retirement journey</h3>`;

      html += `<div class="timeline-scroll">`;
      html += `<div class="timeline-track" style="min-width: ${milestones.length * 5.5}rem;">`;
      html += `<div class="timeline-line"></div>`;

      milestones.forEach(m => {
        html += `
          <div class="timeline-milestone">
            <div class="timeline-age" style="color: ${m.color};">${m.age}</div>
            <div class="timeline-dot" style="background: ${m.color}; box-shadow: 0 0 0 1px ${m.color};"></div>
            <div class="timeline-label">${m.label}</div>
            <div class="timeline-detail">${m.detail}</div>
          </div>`;
      });

      html += `</div>`;
      if (milestones.length > 3) {
        html += `<div class="timeline-hint">Swipe →</div>`;
      }
      html += `</div>`;

      el.innerHTML = html;
    }

    // Tab switching for results page
    function initResultsTabs() {
      document.querySelectorAll('.results-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const targetTab = tab.dataset.resultsTab;

          // Update tab styles
          document.querySelectorAll('.results-tab').forEach(t => {
            t.classList.remove('active');
            t.style.color = 'var(--color-text-light, #6b7280)';
            t.style.borderBottomColor = 'transparent';
            t.style.fontWeight = '500';
          });
          tab.classList.add('active');
          tab.style.color = 'var(--color-primary, #4f46e5)';
          tab.style.borderBottomColor = 'var(--color-primary, #4f46e5)';
          tab.style.fontWeight = '600';

          // Show/hide tab content
          document.querySelectorAll('.results-tab-content').forEach(content => {
            content.style.display = 'none';
          });
          const target = document.getElementById('tab-' + targetTab);
          if (target) target.style.display = 'block';
        });
      });
    }

    function renderCapitalChart(projection) {
      const canvas = document.getElementById('capital-chart');
      if (!canvas || typeof Chart === 'undefined') return;

      const existingChart = Chart.getChart(canvas);
      if (existingChart) existingChart.destroy();

      // Build separate pension and ISA datasets
      const allYears = [
        ...projection.accumulation.years.map(y => ({ age: y.age, pension: y.endBalances.pension, isa: y.endBalances.isa })),
        ...projection.decumulation.years.filter(y => y.endBalances).map(y => ({ age: y.age, pension: y.endBalances.pension, isa: y.endBalances.isa }))
      ];

      new Chart(canvas, {
        type: 'line',
        data: {
          labels: allYears.map(d => d.age),
          datasets: [
            {
              label: 'Pension',
              data: allYears.map(d => d.pension),
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              fill: true,
              tension: 0.3,
              pointRadius: 0
            },
            {
              label: 'ISA',
              data: allYears.map(d => d.isa),
              borderColor: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              fill: true,
              tension: 0.3,
              pointRadius: 0
            },
            {
              label: 'Total Wealth',
              data: allYears.map(d => d.pension + d.isa),
              borderColor: '#4f46e5',
              borderDash: [5, 5],
              backgroundColor: 'transparent',
              fill: false,
              tension: 0.3,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatCompactCurrency(ctx.parsed.y)}`
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'Age' },
              ticks: {
                maxRotation: 0,
                callback: function(val, index) {
                  const age = allYears[index]?.age;
                  const plan = projection.plan;
                  if (age === plan.retirementAge) return age + ' Retire';
                  if (age === plan.statePensionAge) return age + ' SP';
                  if (age === 80) return '80 -25%';
                  if (age % 5 === 0) return age;
                  return '';
                },
                font: function(ctx) {
                  const age = allYears[ctx.index]?.age;
                  const plan = projection.plan;
                  if (age === plan.retirementAge || age === plan.statePensionAge || age === 80) {
                    return { weight: 'bold', size: 10 };
                  }
                  return { size: 9 };
                }
              }
            },
            y: {
              title: { display: true, text: 'Balance' },
              ticks: { callback: (v) => formatCompactCurrency(v) }
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
    
    // ═══════════════════════════════════════════════════════════════
    // UX Primitives: Income Gap, SP Bridge, Contribution Impact
    // ═══════════════════════════════════════════════════════════════

    function renderIncomeGap(projection, data) {
      const el = document.getElementById('income-gap-section');
      if (el) el.style.display = 'none';
      return;
      if (!el) return;

      const target = data.targetNetIncome || projection.plan.targetNetIncome;
      const firstDecYear = projection.decumulation.years[0];
      if (!firstDecYear) { el.style.display = 'none'; return; }

      const projected = firstDecYear.netIncome || 0;
      const pct = Math.min(100, Math.round((projected / target) * 100));
      const gap = target - projected;
      const isShortfall = gap > 0;
      const barColor = pct >= 100 ? 'var(--color-success, #059669)' : pct >= 80 ? 'var(--color-warning, #d97706)' : 'var(--color-danger, #dc2626)';

      el.style.display = 'block';
      el.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem;">
          <span style="font-size: 0.8125rem; font-weight: 600;">Year 1 Income vs Target</span>
          <span style="font-size: 0.8125rem; font-weight: 700; color: ${barColor};">${pct}%</span>
        </div>
        <div style="position: relative; height: 24px; background: var(--color-border-light, #f1f5f9); border-radius: 12px; overflow: hidden;">
          <div style="height: 100%; width: ${pct}%; background: ${barColor}; border-radius: 12px; transition: width 0.8s cubic-bezier(0.4,0,0.2,1);"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 0.375rem; font-size: 0.75rem; color: var(--color-text-light);">
          <span>Projected: <strong style="color: var(--color-text);">${formatCurrency(Math.round(projected / 12))}/mo</strong></span>
          <span>Target: <strong style="color: var(--color-text);">${formatCurrency(Math.round(target / 12))}/mo</strong></span>
        </div>
        ${isShortfall ? `<div style="margin-top: 0.5rem; padding: 0.5rem 0.625rem; background: var(--color-danger-light, #fee2e2); border-radius: var(--radius-md, 0.5rem); font-size: 0.75rem; color: var(--color-danger, #dc2626);">
          Shortfall of <strong>${formatCurrency(Math.round(gap / 12))}/mo</strong> (${formatCurrency(gap)}/yr). Use the sliders below to close the gap.
        </div>` : `<div style="margin-top: 0.5rem; padding: 0.5rem 0.625rem; background: var(--color-success-light, #d1fae5); border-radius: var(--radius-md, 0.5rem); font-size: 0.75rem; color: var(--color-success, #059669);">
          Your plan meets or exceeds your target income.
        </div>`}
      `;
    }

    function renderSPBridge(projection, data) {
      const el = document.getElementById('sp-bridge-section');
      if (el) el.style.display = 'none';
      return;
      if (!el) return;

      const plan = projection.plan;
      const retireAge = plan.retirementAge;
      const spAge = plan.statePensionAge || data.statePensionAge || 67;
      const sp = plan.expectedStatePension || data.expectedStatePension || 0;

      if (spAge <= retireAge || sp <= 0) { el.style.display = 'none'; return; }

      const bridgeYears = spAge - retireAge;
      const isCouple = data.isCouple || false;
      const partnerSP = data.partnerExpectedStatePension || 0;
      const partnerSpAge = data.partnerStatePensionAge || 67;
      const partnerCurrentAge = data.partnerCurrentAge || 0;
      const ageDiff = partnerCurrentAge - plan.currentAge;
      const partnerSpUserAge = partnerSpAge - ageDiff;

      const preSpDecYears = projection.decumulation.years.filter(y => y.age >= retireAge && y.age < spAge);
      const avgPreWithdrawal = preSpDecYears.length > 0 ? Math.round(preSpDecYears.reduce((s, y) => s + (y.withdrawals?.pension || 0) + (y.withdrawals?.isa || 0), 0) / preSpDecYears.length) : 0;

      const postSpDecYears = projection.decumulation.years.filter(y => y.age >= spAge && y.age < spAge + 3);
      const avgPostWithdrawal = postSpDecYears.length > 0 ? Math.round(postSpDecYears.reduce((s, y) => s + (y.withdrawals?.pension || 0) + (y.withdrawals?.isa || 0), 0) / postSpDecYears.length) : 0;

      const totalSP = sp + (isCouple && partnerSpUserAge <= spAge ? partnerSP : 0);
      const reduction = avgPreWithdrawal - avgPostWithdrawal;

      // Drawdown rate: annual withdrawal as % of pot at retirement (PCLS is a transfer, not a loss)
      const potAtRetire = projection.summary.retirementPot;
      const drawdownRate = potAtRetire > 0 ? ((avgPreWithdrawal / potAtRetire) * 100).toFixed(1) : 0;
      const drawdownRatePost = potAtRetire > 0 ? ((avgPostWithdrawal / potAtRetire) * 100).toFixed(1) : 0;

      // How much pot is consumed during bridge
      const bridgeCost = avgPreWithdrawal * bridgeYears;
      const pctPotConsumed = potAtRetire > 0 ? Math.round((bridgeCost / potAtRetire) * 100) : 0;

      el.style.display = 'block';
      el.innerHTML = `
        <h3 style="font-size: 1rem; margin-bottom: 0.75rem;">Bridge: ${bridgeYears} years before State Pension</h3>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
          <div style="flex: 1; padding: 0.75rem; background: var(--color-warning-light, #fef3c7); border-radius: var(--radius-md, 0.5rem); text-align: center;">
            <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--color-warning, #d97706); letter-spacing: 0.04em;">Age ${retireAge}-${spAge - 1}</div>
            <div style="font-size: 1.125rem; font-weight: 700; margin-top: 0.25rem;">${formatCurrency(Math.round(avgPreWithdrawal / 12))}/mo</div>
            <div style="font-size: 0.7rem; color: var(--color-text-light); margin-top: 0.125rem;">from pot (${drawdownRate}% drawdown)</div>
          </div>
          <div style="display: flex; align-items: center; font-size: 1.2rem; color: var(--color-text-light);">→</div>
          <div style="flex: 1; padding: 0.75rem; background: var(--color-success-light, #d1fae5); border-radius: var(--radius-md, 0.5rem); text-align: center;">
            <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--color-success, #059669); letter-spacing: 0.04em;">Age ${spAge}+</div>
            <div style="font-size: 1.125rem; font-weight: 700; margin-top: 0.25rem;">${formatCurrency(Math.round(avgPostWithdrawal / 12))}/mo</div>
            <div style="font-size: 0.7rem; color: var(--color-text-light); margin-top: 0.125rem;">from pot (${drawdownRatePost}% drawdown)</div>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; font-size: 0.75rem; margin-bottom: 0.5rem;">
          <div style="flex: 1; padding: 0.5rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md, 0.5rem); text-align: center;">
            <div style="color: var(--color-text-light);">Bridge cost</div>
            <div style="font-weight: 700;">${formatCurrency(bridgeCost)}</div>
            <div style="color: var(--color-warning); font-size: 0.6875rem;">${pctPotConsumed}% of your pot</div>
          </div>
          <div style="flex: 1; padding: 0.5rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md, 0.5rem); text-align: center;">
            <div style="color: var(--color-text-light);">SP relief</div>
            <div style="font-weight: 700; color: var(--color-success);">${formatCurrency(Math.round(totalSP / 12))}/mo</div>
            <div style="color: var(--color-success); font-size: 0.6875rem;">saves ${formatCurrency(totalSP * (90 - spAge))}/yr to 90</div>
          </div>
        </div>
      `;
    }

    function renderContributionImpact(projection, data) {
      const el = document.getElementById('contribution-impact-section');
      if (!el) return;

      const plan = projection.plan;
      const currentMonthly = Math.round((data.annualPensionContribution || 0) / 12);
      const yearsToRetire = (plan.retirementAge || 60) - (plan.currentAge || 56);
      if (yearsToRetire <= 0) { el.style.display = 'none'; return; }

      const scenarioPreset = SCENARIO_PRESETS[data.scenario] || SCENARIO_PRESETS.moderate;
      const growthRate = scenarioPreset.growthRate || 0.04;

      function extraPotValue(extraMonthly) {
        let pot = 0;
        for (let y = 0; y < yearsToRetire; y++) {
          pot = (pot + extraMonthly * 12) * (1 + growthRate);
        }
        return Math.round(pot);
      }

      // Dynamic: show +£200/mo and +£500/mo relative to CURRENT slider position
      const bump1 = 200, bump2 = 500;
      const extra1 = extraPotValue(bump1);
      const extra2 = extraPotValue(bump2);
      const income1 = Math.round(extra1 * 0.04 / 12);
      const income2 = Math.round(extra2 * 0.04 / 12);
      const isSalarySacrifice = document.getElementById('input-salary-sacrifice')?.checked;

      el.style.display = 'block';
      el.innerHTML = `
        <h3 style="font-size: 1rem; margin-bottom: 0.25rem;">Add more to your pension?</h3>
        <p style="font-size: 0.7rem; color: var(--color-text-light); margin-bottom: 0.75rem;">On top of your current ${formatCurrency(currentMonthly)}/mo over ${yearsToRetire} years</p>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
          <div style="flex: 1; padding: 0.75rem; background: var(--color-primary-subtle, #eef2ff); border-radius: var(--radius-md, 0.5rem); text-align: center;">
            <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--color-primary); letter-spacing: 0.04em;">+${formatCurrency(bump1)}/mo</div>
            <div style="font-size: 1.125rem; font-weight: 700; margin-top: 0.25rem;">+${formatCurrency(extra1)}</div>
            <div style="font-size: 0.7rem; color: var(--color-text-light); margin-top: 0.125rem;">extra at retirement</div>
            <div style="font-size: 0.75rem; font-weight: 600; color: var(--color-success); margin-top: 0.25rem;">+${formatCurrency(income1)}/mo income</div>
          </div>
          <div style="flex: 1; padding: 0.75rem; background: var(--color-primary-subtle, #eef2ff); border-radius: var(--radius-md, 0.5rem); text-align: center;">
            <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--color-primary); letter-spacing: 0.04em;">+${formatCurrency(bump2)}/mo</div>
            <div style="font-size: 1.125rem; font-weight: 700; margin-top: 0.25rem;">+${formatCurrency(extra2)}</div>
            <div style="font-size: 0.7rem; color: var(--color-text-light); margin-top: 0.125rem;">extra at retirement</div>
            <div style="font-size: 0.75rem; font-weight: 600; color: var(--color-success); margin-top: 0.25rem;">+${formatCurrency(income2)}/mo income</div>
          </div>
        </div>
        <div style="padding: 0.5rem 0.625rem; background: var(--color-accent-light, #ccfbf1); border-radius: var(--radius-md, 0.5rem); font-size: 0.75rem; color: var(--color-accent, #0d9488);">
          <strong>Tax relief:</strong> You pay £80, government adds £20 — £100 goes in.${isSalarySacrifice ? ' Salary sacrifice saves 13.8% employer NI too.' : ' Higher-rate taxpayers reclaim a further £20.'}
        </div>
      `;
    }

    function renderCashflowChart(projection, data) {
      const canvas = document.getElementById('cashflow-chart');
      if (!canvas || typeof Chart === 'undefined') return;
      
      const existingChart = Chart.getChart(canvas);
      if (existingChart) existingChart.destroy();
      
      // FIX 1.2: Read income sources directly from projection years (no recomputation)
      const decYears = projection.decumulation.years.filter(y => !y.fundsDepleted || y.netIncome > 0);
      const labels = decYears.map(y => y.age);
      
      // Build year-by-year data — scale sources to sum to actual netIncome
      const yearlyData = decYears.map(y => {
        const statePension = y.statePension || 0;
        const dbPension = y.dbPension || 0;
        const pensionWithdrawal = y.withdrawals?.pension || 0;
        const isaWithdrawal = y.withdrawals?.isa || 0;
        const netIncome = y.netIncome || 0;

        // Total gross from all sources
        const totalGross = statePension + dbPension + pensionWithdrawal + isaWithdrawal;
        // Scale each source proportionally so stacked total = netIncome
        const scale = totalGross > 0 ? netIncome / totalGross : 0;

        return {
          age: y.age,
          statePensionNet: Math.round(statePension * scale),
          dbPensionNet: Math.round(dbPension * scale),
          pensionWithdrawalNet: Math.round(pensionWithdrawal * scale),
          isaNet: Math.round(isaWithdrawal * scale),
          netIncome
        };
      });
      
      const datasets = [];
      
      // State Pension (net after proportional tax)
      datasets.push({
        label: 'State Pension',
        data: yearlyData.map(y => y.statePensionNet),
        backgroundColor: '#22c55e',
        stack: 'income'
      });
      
      // DB Pension if any year has it
      const hasDbInProjection = yearlyData.some(y => y.dbPensionNet > 0);
      if (hasDbInProjection) {
        datasets.push({
          label: 'DB Pension',
          data: yearlyData.map(y => y.dbPensionNet),
          backgroundColor: '#3b82f6',
          stack: 'income'
        });
      }
      
      // Pension Withdrawals (net)
      datasets.push({
        label: 'Pension Withdrawal (net)',
        data: yearlyData.map(y => y.pensionWithdrawalNet),
        backgroundColor: '#f59e0b',
        stack: 'income'
      });
      
      // ISA Withdrawals (tax-free)
      datasets.push({
        label: 'ISA (tax-free)',
        data: yearlyData.map(y => y.isaNet),
        backgroundColor: '#8b5cf6',
        stack: 'income'
      });
      
      // PCLS is a balance sheet event, NOT annual income — do not stack in income chart
      // It's already reflected in the reduced pension balance on the capital chart

      // Target income line
      // Step the target line down at spending reduction ages
      const targetLine = decYears.map(y => {
        const age = y.age;
        if (age >= 90) return data.targetNetIncome * 0.65;
        if (age >= 80) return data.targetNetIncome * 0.75;
        return data.targetNetIncome;
      });
      datasets.push({
        label: 'Target',
        data: targetLine,
        type: 'line',
        borderColor: '#ef4444',
        borderWidth: 3,
        borderDash: [8, 4],
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

      // Use projection engine values (which include real-terms growth) to match the cashflow chart
      const decYears = projection.decumulation?.years || [];
      for (let age = startAge; age <= endAge; age++) {
        labels.push(age);
        const yearData = decYears.find(y => y.age === age);
        if (yearData) {
          spData.push(yearData.statePension || 0);
          dbData.push(yearData.dbPension || 0);
        } else {
          // Fallback to form values if projection data not available
          spData.push(age >= data.statePensionAge ? data.expectedStatePension : 0);
          dbData.push(data.hasDBPension && age >= data.dbPensionStartAge ? data.dbPensionAmount : 0);
        }
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
      
      // Populate details panel — show starting values with growth note
      const detailsEl = document.getElementById('guaranteed-income-details');
      if (detailsEl) {
        let html = '<div style="padding: 0.5rem;">';
        html += `<p><strong>State Pension:</strong> ${formatCurrency(data.expectedStatePension)}/year from age ${data.statePensionAge} <span style="font-size: 0.8em; color: var(--color-text-light);">(grows ~1%/year in real terms)</span></p>`;
        if (data.hasDBPension && data.dbPensionAmount > 0) {
          html += `<p><strong>DB Pension:</strong> ${formatCurrency(data.dbPensionAmount)}/year from age ${data.dbPensionStartAge} <span style="font-size: 0.8em; color: var(--color-text-light);">(with inflation escalation)</span></p>`;
        }
        const totalGuaranteed = data.expectedStatePension + (data.hasDBPension ? data.dbPensionAmount : 0);
        html += `<p style="margin-top: 0.5rem; font-weight: 600;">Total Guaranteed: ${formatCurrency(totalGuaranteed)}/year at start (when all sources active)</p>`;
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
      
      // Build sources from engine data (not from form checkboxes)
      const yourSP = (firstYear.statePension || 0) - (firstYear.partnerStatePension || 0);
      const partnerSP = firstYear.partnerStatePension || 0;
      const partnerDB = firstYear.partnerDbPension || 0;
      const yourDB = (firstYear.dbPension || 0) - partnerDB;

      const sources = [
        { name: 'Pension Withdrawal', amount: firstYear.withdrawals?.pension || 0, taxable: true, color: '#f59e0b' },
        { name: 'ISA Withdrawal', amount: firstYear.withdrawals?.isa || 0, taxable: false, color: '#8b5cf6' }
      ];

      if (yourSP > 0) {
        sources.push({ name: 'Your State Pension', amount: yourSP, taxable: true, color: '#059669' });
      }
      if (partnerSP > 0) {
        sources.push({ name: 'Partner State Pension', amount: partnerSP, taxable: true, color: '#34d399' });
      }
      if (yourDB > 0) {
        sources.push({ name: 'Your DB Pension', amount: yourDB, taxable: true, color: '#2563eb' });
      }
      if (partnerDB > 0) {
        sources.push({ name: 'Partner DB Pension', amount: partnerDB, taxable: true, color: '#7c3aed' });
      }
      
      // PCLS is shown separately in the summary metrics, not as annual income
      
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
    // Year-by-Year Data Table
    // ═══════════════════════════════════════════════════════════════

    function renderDataTable(projection, data) {
      const el = document.getElementById('data-table-container');
      if (!el) return;

      const partnerAgeDiff = (data.partnerCurrentAge || 0) > 0 ? data.partnerCurrentAge - data.currentAge : 0;
      const currentYear = new Date().getFullYear();
      const birthYear = currentYear - (data.currentAge || 57);
      const thStyle = 'padding: 0.5rem 0.3rem; text-align: right; font-size: 0.65rem; white-space: nowrap;';
      const tdStyle = 'padding: 0.4rem 0.3rem; text-align: right; font-size: 0.7rem;';
      const ageStyle = 'padding: 0.4rem 0.2rem; text-align: center; font-weight: 600; position: sticky; left: 0; z-index: 1; font-size: 0.7rem;';

      let html = '<table style="width: 100%; border-collapse: collapse;">';
      html += '<thead><tr style="background: var(--color-background, #f8fafc); border-bottom: 2px solid #e5e7eb;">';
      html += '<th style="' + ageStyle + ' background: var(--color-background, #f8fafc);">Age</th>';
      if (partnerAgeDiff) html += '<th style="' + thStyle + ' text-align: center; font-size: 0.6rem;">Partner</th>';
      html += '<th style="' + thStyle + '">Start</th>';
      html += '<th style="' + thStyle + '">In/Out</th>';
      html += '<th style="' + thStyle + '">Return</th>';
      html += '<th class="hide-mobile" style="' + thStyle + '">SP+DB</th>';
      html += '<th class="hide-mobile" style="' + thStyle + '">Tax</th>';
      html += '<th class="hide-mobile" style="' + thStyle + '">Net</th>';
      html += '<th style="' + thStyle + ' font-weight: 700;">End</th>';
      html += '</tr></thead><tbody>';

      // Track running balance for start column
      let runningTotal = (data.currentPension || 0) + (data.currentIsa || 0);

      // Accumulation years
      for (const y of projection.accumulation.years) {
        const startBal = runningTotal;
        const growth = (y.growth?.pension || 0) + (y.growth?.isa || 0);
        const invested = (y.contributions?.pension || 0) + (y.contributions?.isa || 0);
        const endBal = y.endBalances.total;
        runningTotal = endBal;
        const displayAge = y.age + 1;
        const calYear = birthYear + displayAge;
        const partnerAge = partnerAgeDiff ? displayAge + partnerAgeDiff : '';

        html += '<tr style="border-bottom: 1px solid #f1f5f9;">';
        html += '<td style="' + ageStyle + ' background: white;"><div>' + displayAge + '</div><div style="font-size:0.55rem;font-weight:400;color:var(--color-text-light);">' + calYear + '</div></td>';
        if (partnerAgeDiff) html += '<td style="' + tdStyle + ' text-align: center; font-size: 0.65rem; color: var(--color-text-light);">' + partnerAge + '</td>';
        html += '<td style="' + tdStyle + '">' + formatCurrency(startBal) + '</td>';
        html += '<td style="' + tdStyle + ' color: #059669;">+' + formatCurrency(invested) + '</td>';
        html += '<td style="' + tdStyle + ' color: #059669;">' + formatCurrency(growth) + '</td>';
        html += '<td class="hide-mobile" style="' + tdStyle + '">—</td>';
        html += '<td class="hide-mobile" style="' + tdStyle + '">—</td>';
        html += '<td class="hide-mobile" style="' + tdStyle + '">—</td>';
        html += '<td style="' + tdStyle + ' font-weight: 700;">' + formatCurrency(endBal) + '</td>';
        html += '</tr>';
      }

      // Retirement row
      const pclsText = projection.decumulation.pclsTaken > 0 ? ' | PCLS: ' + formatCurrency(projection.decumulation.pclsTaken) : '';
      const colSpan = partnerAgeDiff ? 9 : 8;
      html += '<tr style="border: 3px solid var(--color-primary, #4f46e5); background: var(--color-primary-subtle, #eef2ff);">';
      html += '<td colspan="' + colSpan + '" style="padding: 0.5rem; text-align: center; font-weight: 700; color: var(--color-primary, #4f46e5);">RETIREMENT — Age ' + data.retirementAge + pclsText + '</td>';
      html += '</tr>';

      // PCLS is already reflected in decumulation pension balances — do not double-deduct

      // Decumulation years
      for (const y of projection.decumulation.years) {
        if (!y.endBalances) continue;
        const startBal = runningTotal;
        const growth = (y.growth?.pension || 0) + (y.growth?.isa || 0);
        const withdrawal = (y.withdrawals?.pension || 0) + (y.withdrawals?.isa || 0);
        const spDb = (y.statePension || 0) + (y.dbPension || 0);
        const endBal = (y.endBalances.pension || 0) + (y.endBalances.isa || 0);
        runningTotal = endBal;
        const partnerAge = partnerAgeDiff ? y.age + partnerAgeDiff : '';
        const calYear = birthYear + y.age;
        const isReduced = (y.targetSpending || 60000) < data.targetNetIncome;

        html += '<tr style="border-bottom: 1px solid #f1f5f9;' + (isReduced ? ' background: #fffbeb;' : '') + '">';
        html += '<td style="' + ageStyle + ' background:' + (isReduced ? '#fffbeb' : 'white') + ';"><div>' + y.age + '</div><div style="font-size:0.55rem;font-weight:400;color:var(--color-text-light);">' + calYear + '</div></td>';
        if (partnerAgeDiff) html += '<td style="' + tdStyle + ' text-align: center; font-size: 0.65rem; color: var(--color-text-light);">' + partnerAge + '</td>';
        html += '<td style="' + tdStyle + '">' + formatCurrency(startBal) + '</td>';
        html += '<td style="' + tdStyle + ' color: #dc2626;">-' + formatCurrency(withdrawal) + '</td>';
        html += '<td style="' + tdStyle + ' color: #059669;">' + formatCurrency(growth) + '</td>';
        html += '<td class="hide-mobile" style="' + tdStyle + ' color: #059669;">' + formatCurrency(spDb) + '</td>';
        html += '<td class="hide-mobile" style="' + tdStyle + ' color: #dc2626;">-' + formatCurrency(y.taxPaid || 0) + '</td>';
        html += '<td class="hide-mobile" style="' + tdStyle + ' font-weight: 600; color: ' + (isReduced ? '#d97706' : '#111827') + ';">' + formatCurrency(y.netIncome || 0) + '</td>';
        html += '<td style="' + tdStyle + ' font-weight: 700;">' + formatCurrency(endBal) + '</td>';
        html += '</tr>';
      }

      html += '</tbody></table>';
      html += '<p style="text-align: center; font-size: 0.65rem; color: var(--color-text-light); margin-top: 0.5rem;">Scroll horizontally for all columns</p>';
      el.innerHTML = html;
    }

    // ═══════════════════════════════════════════════════════════════
    // Comparison
    // ═══════════════════════════════════════════════════════════════
    
    // ═══════════════════════════════════════════════════════════════
    // Sankey Cash Flow Diagram
    // ═══════════════════════════════════════════════════════════════

    let sankeyYearIndex = 0;

    function renderSankey(projection, yearIndex) {
      const container = document.getElementById('sankey-container');
      const label = document.getElementById('sankey-year-label');
      if (!container) return;

      const decYears = projection.decumulation.years.filter(y => !y.fundsDepleted && y.withdrawals);
      if (decYears.length === 0) return;

      const idx = Math.max(0, Math.min(yearIndex, decYears.length - 1));
      sankeyYearIndex = idx;
      const y = decYears[idx];
      if (label) label.textContent = 'Age ' + y.age;

      // Income sources
      const sources = [];
      const yourSP = (y.statePension || 0) - (y.partnerStatePension || 0);
      const partnerSP = y.partnerStatePension || 0;
      const partnerDB = y.partnerDbPension || 0;
      const yourDB = (y.dbPension || 0) - partnerDB;
      const pensionW = y.withdrawals?.pension || 0;
      const isaW = y.withdrawals?.isa || 0;

      if (yourSP > 0) sources.push({ name: 'Your SP', value: yourSP, color: '#059669' });
      if (partnerSP > 0) sources.push({ name: 'Partner SP', value: partnerSP, color: '#34d399' });
      if (yourDB > 0) sources.push({ name: 'Your DB', value: yourDB, color: '#2563eb' });
      if (partnerDB > 0) sources.push({ name: 'Partner DB', value: partnerDB, color: '#7c3aed' });
      if (pensionW > 0) sources.push({ name: 'Pension', value: pensionW, color: '#f59e0b' });
      if (isaW > 0) sources.push({ name: 'ISA', value: isaW, color: '#8b5cf6' });

      const totalGross = sources.reduce((s, x) => s + x.value, 0);
      const tax = y.taxPaid || 0;
      const netIncome = y.netIncome || 0;

      // SVG Sankey
      const w = 320, h = 240;
      const leftX = 10, midX = 160, rightX = 280;
      const bandWidth = 60;

      // Calculate Y positions for left side (sources)
      let leftY = 20;
      const leftBands = sources.map(s => {
        const height = Math.max(8, (s.value / totalGross) * 180);
        const band = { ...s, y: leftY, height };
        leftY += height + 4;
        return band;
      });

      // Right side: tax + net
      const taxHeight = Math.max(8, (tax / totalGross) * 180);
      const netHeight = Math.max(8, (netIncome / totalGross) * 180);
      const rightStartY = 20;

      let svg = `<svg viewBox="0 0 ${w} ${h}" style="width: 100%; max-width: 400px; display: block; margin: 0 auto;">`;

      // Draw flow bands from each source to the right
      leftBands.forEach(band => {
        // Flow to net income (proportional)
        const netPortion = band.value * (1 - tax / totalGross);
        const taxPortion = band.value * (tax / totalGross);
        const netBandH = (netPortion / netIncome) * netHeight;
        const taxBandH = taxPortion > 0 ? (taxPortion / Math.max(1, tax)) * taxHeight : 0;

        // Main flow (to net)
        svg += `<path d="M ${leftX + bandWidth} ${band.y + band.height / 2} C ${midX} ${band.y + band.height / 2}, ${midX} ${rightStartY + netHeight / 2}, ${rightX} ${rightStartY + netHeight / 2}" fill="none" stroke="${band.color}" stroke-width="${Math.max(2, band.height * 0.6)}" opacity="0.3"/>`;

        // Tax flow (to tax)
        if (taxBandH > 1) {
          svg += `<path d="M ${leftX + bandWidth} ${band.y + band.height / 2} C ${midX} ${band.y + band.height / 2}, ${midX} ${rightStartY + netHeight + 10 + taxHeight / 2}, ${rightX} ${rightStartY + netHeight + 10 + taxHeight / 2}" fill="none" stroke="#ef4444" stroke-width="${Math.max(1, taxBandH * 0.5)}" opacity="0.2"/>`;
        }
      });

      // Left labels
      leftBands.forEach(band => {
        svg += `<rect x="${leftX}" y="${band.y}" width="${bandWidth}" height="${band.height}" rx="4" fill="${band.color}" opacity="0.8"/>`;
        if (band.height > 14) {
          svg += `<text x="${leftX + 4}" y="${band.y + band.height / 2 + 4}" font-size="9" fill="white" font-weight="600">${band.name}</text>`;
        }
      });

      // Right: Net income block
      svg += `<rect x="${rightX}" y="${rightStartY}" width="${bandWidth}" height="${netHeight}" rx="4" fill="#059669" opacity="0.8"/>`;
      svg += `<text x="${rightX + 4}" y="${rightStartY + netHeight / 2 + 4}" font-size="9" fill="white" font-weight="600">Net</text>`;

      // Right: Tax block
      if (tax > 0) {
        svg += `<rect x="${rightX}" y="${rightStartY + netHeight + 10}" width="${bandWidth}" height="${taxHeight}" rx="4" fill="#ef4444" opacity="0.8"/>`;
        svg += `<text x="${rightX + 4}" y="${rightStartY + netHeight + 10 + taxHeight / 2 + 4}" font-size="9" fill="white" font-weight="600">Tax ${formatCompactCurrency(tax)}</text>`;
      }

      // Value labels (right side)
      svg += `<text x="${rightX + bandWidth + 4}" y="${rightStartY + netHeight / 2 + 4}" font-size="10" fill="#059669" font-weight="600">${formatCompactCurrency(netIncome)}</text>`;
      if (tax > 0) {
        svg += `<text x="${rightX + bandWidth + 4}" y="${rightStartY + netHeight + 10 + taxHeight / 2 + 4}" font-size="10" fill="#ef4444" font-weight="600">${formatCompactCurrency(tax)}</text>`;
      }

      // Source value labels (left side)
      leftBands.forEach(band => {
        svg += `<text x="${leftX + bandWidth + 4}" y="${band.y + band.height / 2 + 4}" font-size="9" fill="${band.color}" font-weight="500">${formatCompactCurrency(band.value)}</text>`;
      });

      svg += '</svg>';
      container.innerHTML = svg;
    }

    function initSankey(projection) {
      renderSankey(projection, 0);
      document.getElementById('sankey-prev')?.addEventListener('click', () => {
        renderSankey(projection, sankeyYearIndex - 1);
      });
      document.getElementById('sankey-next')?.addEventListener('click', () => {
        renderSankey(projection, sankeyYearIndex + 1);
      });
    }

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
              ticks: { callback: (v) => formatCompactCurrency(v) }
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
      
      // Only show validated sections — hide everything else to prevent conflicting metrics
      // Single scrollable results -- no tabs needed
      
      // === Monte Carlo Visualization ===
      if (mcResult) {
        const section = document.getElementById('monte-carlo-section');
        if (section) {
          
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
      
      // === Readiness Score — DISABLED (produces conflicting metrics for couples) ===
      if (false && readiness) {
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
      
      // === Insights & Recommendations — DISABLED (broken for couples) ===
      if (false && (insights || recommendations)) {
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
    
    document.addEventListener('DOMContentLoaded', async () => {
      debugLog('INIT', 'App initializing');

      // Initialize persistence and restore auto-saved data
      try {
        await initPersistence();
        debugLog('INIT', 'Persistence layer initialized');

        // Try to restore auto-saved session
        const autoSaved = await loadAutoSave();
        if (autoSaved?.data) {
          debugLog('INIT', 'Restoring auto-saved session', autoSaved.data);
          // Restore onboarding state
          if (autoSaved.data.onboardingState) {
            state.onboardingState = autoSaved.data.onboardingState;
          }
          // Restore form input values to DOM
          if (autoSaved.data.formInputs) {
            const inputs = autoSaved.data.formInputs;
            Object.keys(inputs).forEach(id => {
              const el = document.getElementById(id);
              if (el && inputs[id] != null) {
                el.value = inputs[id];
              }
            });
          }
          // Restore screen position
          if (autoSaved.data.currentScreen && autoSaved.data.currentScreen !== 'household-type') {
            // Restore household type selection
            if (autoSaved.data.onboardingState?.householdType) {
              state.onboardingState.householdType = autoSaved.data.onboardingState.householdType;
            }
            showScreen(autoSaved.data.currentScreen);
          }
        }

        // Start auto-save every 3 seconds
        startAutoSave(() => {
          // Collect all DOM input values for persistence
          const formInputs = {};
          const inputIds = [
            'input-current-age', 'input-retirement-age', 'input-target-income',
            'input-pension-pot', 'input-pension-contribution',
            'input-isa-balance', 'input-isa-contribution',
            'input-state-pension-age', 'input-state-pension-amount'
          ];
          inputIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.value) {
              formInputs[id] = el.value;
            }
          });

          // Only save if there's meaningful data
          const hasData = Object.keys(formInputs).length > 0 ||
            state.onboardingState?.personA?.currentAge ||
            state.onboardingState?.targetNetIncome;
          if (!hasData) return null;

          return {
            onboardingState: state.onboardingState,
            formInputs,
            currentScreen: state.currentScreen,
            timestamp: Date.now()
          };
        });
        debugLog('INIT', 'Auto-save started');
      } catch (e) {
        console.warn('Persistence initialization failed, continuing without auto-save:', e);
      }
      
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
      
      // PCLS toggle on pension pot screen
      document.getElementById('input-pcls-taken')?.addEventListener('change', (e) => {
        const section = document.getElementById('pcls-amount-section');
        if (section) section.style.display = e.target.checked ? 'block' : 'none';
      });
      document.getElementById('input-partner-pcls-taken')?.addEventListener('change', (e) => {
        const section = document.getElementById('partner-pcls-amount-section');
        if (section) section.style.display = e.target.checked ? 'block' : 'none';
      });
      // Legacy PCLS toggle (review screen, if still present)
      document.getElementById('pcls-already-taken')?.addEventListener('change', (e) => {
        const inputs = document.getElementById('pcls-amount-taken-input');
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
      document.getElementById('calculate-btn')?.addEventListener('click', () => runFullCalculation());
      
      // View Results button - navigate to results screen after calculation
      document.getElementById('view-results-btn')?.addEventListener('click', () => {
        nextScreen();
      });
      
      // Slider event listeners — both input (live drag) and change (Safari release)
      document.getElementById('slider-retirement-age')?.addEventListener('input', runSliderProjection);
      document.getElementById('slider-retirement-age')?.addEventListener('change', runSliderProjection);
      document.getElementById('slider-monthly-contribution')?.addEventListener('input', runSliderProjection);
      document.getElementById('slider-monthly-contribution')?.addEventListener('change', runSliderProjection);

      // Scenario cards on results page — tap to change scenario and recalculate
      document.querySelectorAll('.scenario-card').forEach(card => {
        card.addEventListener('click', () => {
          const scenario = card.dataset.scenario;
          // Update hidden review select for collectFormData compatibility
          const select = document.getElementById('scenario-select');
          if (select) select.value = scenario;
          // Visual update
          document.querySelectorAll('.scenario-card').forEach(c => {
            c.style.borderColor = 'var(--color-border)';
            c.style.background = 'var(--color-surface)';
            c.classList.remove('selected');
          });
          card.style.borderColor = 'var(--color-primary)';
          card.style.background = 'var(--color-primary-subtle)';
          card.classList.add('selected');
          // Reset slider impact since we're recalculating baseline
          const impactEl = document.getElementById('slider-impact');
          if (impactEl) impactEl.style.display = 'none';
          // Re-run full calculation with new scenario
          runFullCalculation();
        });
      });

      // Guardrails toggle on results page
      document.getElementById('results-guardrails')?.addEventListener('change', (e) => {
        const reviewGuardrails = document.getElementById('input-guardrails');
        if (reviewGuardrails) reviewGuardrails.checked = e.target.checked;
        // Show before/after comparison
        if (state.formData && state.projectionA) {
          try {
            const prevBalance = state.projectionA.summary.finalBalance;
            const prevDepletion = state.projectionA.summary.fundsDepleted;
            state.formData.useGuardrails = e.target.checked;
            runFullCalculation();
            setTimeout(() => {
              if (state.projectionA) {
                const newBalance = state.projectionA.summary.finalBalance;
                const delta = newBalance - prevBalance;
                const impactEl = document.getElementById('slider-impact');
                if (impactEl && Math.abs(delta) > 100) {
                  const sign = delta >= 0 ? '+' : '';
                  impactEl.style.display = 'block';
                  impactEl.innerHTML = `Guardrails ${e.target.checked ? 'on' : 'off'}: <span style="color: ${delta >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}; font-weight: 700;">${sign}${formatCurrency(delta)}</span> to final balance`;
                  setTimeout(() => { impactEl.style.display = 'none'; }, 5000);
                }
              }
            }, 500);
          } catch (err) { runFullCalculation(); }
        } else {
          runFullCalculation();
        }
      });

      // Save/load scenarios
      document.getElementById('save-scenario-btn')?.addEventListener('click', () => {
        const name = prompt('Name this scenario:', 'Scenario ' + new Date().toLocaleDateString());
        if (!name) return;
        const scenarios = JSON.parse(localStorage.getItem('rl_scenarios') || '[]');
        scenarios.push({
          name,
          date: new Date().toISOString(),
          data: state.formData,
          summary: state.projectionA?.summary
        });
        localStorage.setItem('rl_scenarios', JSON.stringify(scenarios));
        renderSavedScenarios();
      });

      function renderSavedScenarios() {
        const el = document.getElementById('saved-scenarios');
        if (!el) return;
        const scenarios = JSON.parse(localStorage.getItem('rl_scenarios') || '[]');
        if (scenarios.length === 0) { el.innerHTML = ''; return; }
        let html = '<div style="font-weight: 600; margin-bottom: 0.5rem;">Saved Scenarios</div>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">';
        html += '<tr style="border-bottom: 1px solid #e5e7eb;"><th style="text-align: left; padding: 0.25rem;">Name</th><th style="text-align: right; padding: 0.25rem;">Retire</th><th style="text-align: right; padding: 0.25rem;">Target</th><th style="text-align: right; padding: 0.25rem;">Final</th></tr>';
        for (const s of scenarios) {
          html += `<tr style="border-bottom: 1px solid #f1f5f9;">`;
          html += `<td style="padding: 0.25rem;">${s.name}</td>`;
          html += `<td style="text-align: right; padding: 0.25rem;">${s.data?.retirementAge || '-'}</td>`;
          html += `<td style="text-align: right; padding: 0.25rem;">${formatCurrency(s.data?.targetNetIncome || 0)}</td>`;
          html += `<td style="text-align: right; padding: 0.25rem;">${formatCurrency(s.summary?.finalBalance || 0)}</td>`;
          html += `</tr>`;
        }
        html += '</table>';
        html += '<button onclick="localStorage.removeItem(\'rl_scenarios\');document.getElementById(\'saved-scenarios\').innerHTML=\'\';" style="margin-top: 0.5rem; font-size: 0.7rem; background: none; border: 1px solid #e5e7eb; border-radius: 4px; padding: 2px 8px; cursor: pointer;">Clear saved</button>';
        el.innerHTML = html;
      }
      renderSavedScenarios();

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
      
      // Initialize screen order and show first screen
      SCREEN_ORDER = getActiveScreenOrder();
      showScreen(state.currentScreen);
    });
    
    // Expose for debugging
    if (DEBUG) {
      window.__RL_STATE__ = state;
      window.__RL_TAX_TESTS__ = runTaxTests;
    }
