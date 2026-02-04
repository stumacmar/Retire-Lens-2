/**
 * RetireLens 2 - Onboarding Tutorial System
 * 
 * Interactive tutorial with localStorage persistence
 */

import { createSpotlight } from './spotlight.js';

const TUTORIAL_KEY = 'retirelens_hasSeenTutorial';

/**
 * Tutorial steps configuration
 */
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to RetireLens 2',
    content: 'Plan your retirement with confidence. This quick tour will help you understand the key concepts.',
    target: null,
    position: 'center'
  },
  {
    id: 'pcls',
    title: 'Pension Commencement Lump Sum (PCLS)',
    content: 'You can take up to 25% of your pension pot as a tax-free lump sum when you retire. This is often called the "25% tax-free cash".',
    target: '.pension-section, #input-current-pension',
    position: 'bottom'
  },
  {
    id: 'isa',
    title: 'ISA Advantages',
    content: 'Individual Savings Accounts (ISAs) offer tax-free growth and withdrawals. Unlike pensions, you can access your ISA at any age without penalties.',
    target: '.isa-section, #input-current-isa',
    position: 'bottom'
  },
  {
    id: 'state-pension',
    title: 'State Pension',
    content: 'The UK State Pension is currently £203.85/week (£10,600/year). You need 35 qualifying years of National Insurance contributions for the full amount.',
    target: '.state-pension-section, #input-state-pension-age',
    position: 'bottom'
  },
  {
    id: 'monte-carlo',
    title: 'Monte Carlo Simulation',
    content: 'We run 10,000 simulations of market conditions to show you the probability of your plan succeeding. This gives you confidence in your retirement strategy.',
    target: '.results-section, .monte-carlo-chart',
    position: 'top'
  }
];

/**
 * Tutorial manager class
 */
export class Tutorial {
  constructor() {
    this.currentStep = 0;
    this.steps = TUTORIAL_STEPS;
    this.spotlight = null;
    this.overlay = null;
    this.tooltip = null;
    this.onComplete = null;
    this.onSkip = null;
  }

  hasSeenTutorial() {
    try {
      return localStorage.getItem(TUTORIAL_KEY) === 'true';
    } catch (e) {
      return false;
    }
  }

  markAsSeen() {
    try {
      localStorage.setItem(TUTORIAL_KEY, 'true');
    } catch (e) {
      console.warn('Failed to save tutorial state');
    }
  }

  resetTutorial() {
    try {
      localStorage.removeItem(TUTORIAL_KEY);
    } catch (e) {
      console.warn('Failed to reset tutorial state');
    }
  }

  start() {
    if (this.hasSeenTutorial()) {
      return false;
    }

    this.currentStep = 0;
    this.createOverlay();
    this.showStep(0);
    return true;
  }

  startForced() {
    this.currentStep = 0;
    this.createOverlay();
    this.showStep(0);
  }

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'tutorial-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-label', 'Tutorial');
    document.body.appendChild(this.overlay);
  }

  showStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      this.complete();
      return;
    }

    this.currentStep = stepIndex;
    const step = this.steps[stepIndex];

    // Remove old spotlight
    if (this.spotlight) {
      this.spotlight.destroy();
      this.spotlight = null;
    }

    // Create spotlight for target element
    if (step.target) {
      const targetEl = document.querySelector(step.target);
      if (targetEl) {
        this.spotlight = createSpotlight(targetEl);
      }
    }

    // Show tooltip
    this.showTooltip(step);
  }

  showTooltip(step) {
    // Remove old tooltip
    if (this.tooltip) {
      this.tooltip.remove();
    }

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tutorial-tooltip';
    this.tooltip.setAttribute('role', 'dialog');
    this.tooltip.setAttribute('aria-labelledby', 'tutorial-title');

    const progress = `${this.currentStep + 1} / ${this.steps.length}`;
    
    this.tooltip.innerHTML = `
      <div class="tutorial-tooltip-header">
        <h3 id="tutorial-title">${step.title}</h3>
        <button class="tutorial-skip-btn" aria-label="Skip tutorial">✕</button>
      </div>
      <div class="tutorial-tooltip-content">
        <p>${step.content}</p>
      </div>
      <div class="tutorial-tooltip-footer">
        <div class="tutorial-progress">
          <span>${progress}</span>
          <div class="tutorial-progress-dots">
            ${this.steps.map((_, i) => 
              `<span class="dot ${i === this.currentStep ? 'active' : ''}" aria-label="Step ${i + 1}"></span>`
            ).join('')}
          </div>
        </div>
        <div class="tutorial-actions">
          ${this.currentStep > 0 ? '<button class="tutorial-back-btn">Back</button>' : ''}
          <button class="tutorial-next-btn">
            ${this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    `;

    // Position tooltip
    this.positionTooltip(this.tooltip, step);

    // Add event listeners
    const skipBtn = this.tooltip.querySelector('.tutorial-skip-btn');
    skipBtn.addEventListener('click', () => this.skip());

    const nextBtn = this.tooltip.querySelector('.tutorial-next-btn');
    nextBtn.addEventListener('click', () => this.next());

    const backBtn = this.tooltip.querySelector('.tutorial-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.previous());
    }

    this.overlay.appendChild(this.tooltip);

    // Focus the tooltip
    setTimeout(() => {
      nextBtn.focus();
    }, 100);
  }

  positionTooltip(tooltip, step) {
    if (step.position === 'center') {
      tooltip.style.position = 'fixed';
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const targetEl = document.querySelector(step.target);
    if (!targetEl) {
      // Fallback to center
      tooltip.style.position = 'fixed';
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    tooltip.style.position = 'fixed';

    switch (step.position) {
      case 'bottom':
        tooltip.style.top = `${rect.bottom + 20}px`;
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.transform = 'translateX(-50%)';
        break;
      case 'top':
        tooltip.style.bottom = `${window.innerHeight - rect.top + 20}px`;
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.transform = 'translateX(-50%)';
        break;
      case 'left':
        tooltip.style.top = `${rect.top + rect.height / 2}px`;
        tooltip.style.right = `${window.innerWidth - rect.left + 20}px`;
        tooltip.style.transform = 'translateY(-50%)';
        break;
      case 'right':
        tooltip.style.top = `${rect.top + rect.height / 2}px`;
        tooltip.style.left = `${rect.right + 20}px`;
        tooltip.style.transform = 'translateY(-50%)';
        break;
    }
  }

  next() {
    if (this.currentStep < this.steps.length - 1) {
      this.showStep(this.currentStep + 1);
    } else {
      this.complete();
    }
  }

  previous() {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  }

  skip() {
    this.cleanup();
    if (this.onSkip) {
      this.onSkip();
    }
  }

  complete() {
    this.markAsSeen();
    this.cleanup();
    if (this.onComplete) {
      this.onComplete();
    }
  }

  cleanup() {
    if (this.spotlight) {
      this.spotlight.destroy();
      this.spotlight = null;
    }
    
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    this.tooltip = null;
  }
}

/**
 * Create and start tutorial
 */
export function startTutorial(options = {}) {
  const tutorial = new Tutorial();
  
  if (options.onComplete) {
    tutorial.onComplete = options.onComplete;
  }
  
  if (options.onSkip) {
    tutorial.onSkip = options.onSkip;
  }

  if (options.force) {
    tutorial.startForced();
  } else {
    tutorial.start();
  }

  return tutorial;
}

/**
 * Check if tutorial should be shown
 */
export function shouldShowTutorial() {
  const tutorial = new Tutorial();
  return !tutorial.hasSeenTutorial();
}

/**
 * Reset tutorial (for testing/debugging)
 */
export function resetTutorial() {
  const tutorial = new Tutorial();
  tutorial.resetTutorial();
}
