/**
 * RetireLens 2 - Accessibility Enhancements (WCAG 2.1 AA)
 * 
 * Provides keyboard navigation, high contrast mode, focus traps, and skip-to-content
 */

const HIGH_CONTRAST_KEY = 'retirelens_high_contrast';
const FOCUSABLE_SELECTORS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard navigation handler
 */
export class KeyboardNavigationHandler {
  constructor() {
    this.listeners = new Map();
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.init();
  }

  init() {
    document.addEventListener('keydown', this.boundHandleKeyDown);
  }

  handleKeyDown(e) {
    const key = e.key;
    const handlers = this.listeners.get(key);
    
    if (handlers) {
      handlers.forEach(handler => {
        handler(e);
      });
    }

    // Global keyboard shortcuts
    if (key === 'Escape') {
      this.handleEscape(e);
    }
  }

  handleEscape(e) {
    // Close any open modals
    const openModals = document.querySelectorAll('.modal.open, .bottom-sheet.open');
    if (openModals.length > 0) {
      e.preventDefault();
      openModals.forEach(modal => {
        const closeBtn = modal.querySelector('.close-btn, .modal-close');
        if (closeBtn) {
          closeBtn.click();
        }
      });
    }
  }

  on(key, handler) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(handler);
  }

  off(key, handler) {
    const handlers = this.listeners.get(key);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.boundHandleKeyDown);
    this.listeners.clear();
  }
}

/**
 * High contrast mode manager
 */
export class HighContrastMode {
  constructor() {
    this.enabled = this.loadPreference();
    this.apply();
  }

  loadPreference() {
    try {
      return localStorage.getItem(HIGH_CONTRAST_KEY) === 'true';
    } catch (e) {
      return false;
    }
  }

  savePreference(enabled) {
    try {
      localStorage.setItem(HIGH_CONTRAST_KEY, enabled.toString());
    } catch (e) {
      console.warn('Failed to save high contrast preference');
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    this.savePreference(this.enabled);
    this.apply();
    return this.enabled;
  }

  apply() {
    if (this.enabled) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }

  isEnabled() {
    return this.enabled;
  }
}

/**
 * Focus trap for modal dialogs
 */
export class FocusTrap {
  constructor(element) {
    this.element = element;
    this.previousFocus = document.activeElement;
    this.focusableElements = [];
    this.firstFocusable = null;
    this.lastFocusable = null;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  activate() {
    this.updateFocusableElements();
    
    if (this.firstFocusable) {
      this.firstFocusable.focus();
    }
    
    this.element.addEventListener('keydown', this.handleKeyDown);
  }

  deactivate() {
    this.element.removeEventListener('keydown', this.handleKeyDown);
    
    if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
      this.previousFocus.focus();
    }
  }

  updateFocusableElements() {
    this.focusableElements = Array.from(
      this.element.querySelectorAll(FOCUSABLE_SELECTORS)
    ).filter(el => !el.disabled && el.offsetParent !== null);
    
    this.firstFocusable = this.focusableElements[0];
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1];
  }

  handleKeyDown(e) {
    if (e.key !== 'Tab') return;

    // Shift + Tab (backwards)
    if (e.shiftKey) {
      if (document.activeElement === this.firstFocusable) {
        e.preventDefault();
        this.lastFocusable.focus();
      }
    } 
    // Tab (forwards)
    else {
      if (document.activeElement === this.lastFocusable) {
        e.preventDefault();
        this.firstFocusable.focus();
      }
    }
  }
}

/**
 * Skip to content functionality
 */
export function initSkipToContent() {
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.className = 'skip-to-content';
  skipLink.textContent = 'Skip to main content';
  skipLink.setAttribute('aria-label', 'Skip to main content');
  
  skipLink.addEventListener('click', (e) => {
    e.preventDefault();
    const mainContent = document.getElementById('main-content') || 
                       document.querySelector('main') ||
                       document.querySelector('[role="main"]');
    
    if (mainContent) {
      mainContent.setAttribute('tabindex', '-1');
      mainContent.focus();
      mainContent.addEventListener('blur', () => {
        mainContent.removeAttribute('tabindex');
      }, { once: true });
    }
  });
  
  document.body.insertBefore(skipLink, document.body.firstChild);
}

/**
 * Create high contrast toggle button
 */
export function createHighContrastToggle(highContrastMode) {
  const toggle = document.createElement('button');
  toggle.className = 'high-contrast-toggle';
  toggle.setAttribute('aria-label', 'Toggle high contrast mode');
  toggle.setAttribute('type', 'button');
  
  const updateLabel = () => {
    toggle.textContent = highContrastMode.isEnabled() ? 'Disable High Contrast' : 'Enable High Contrast';
    toggle.setAttribute('aria-pressed', highContrastMode.isEnabled().toString());
  };
  
  updateLabel();
  
  toggle.addEventListener('click', () => {
    highContrastMode.toggle();
    updateLabel();
  });
  
  return toggle;
}

/**
 * Enhance form accessibility
 */
export function enhanceFormAccessibility(formElement) {
  // Ensure all inputs have labels
  const inputs = formElement.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    if (!input.id) {
      input.id = `input-${Math.random().toString(36).substring(2, 11)}`;
    }
    
    const label = formElement.querySelector(`label[for="${input.id}"]`);
    if (!label && !input.getAttribute('aria-label')) {
      console.warn(`Input ${input.id} has no associated label`);
    }
  });
  
  // Add ARIA live regions for validation feedback
  const feedbackElements = formElement.querySelectorAll('.validation-feedback');
  feedbackElements.forEach(el => {
    if (!el.getAttribute('role')) {
      el.setAttribute('role', 'alert');
      el.setAttribute('aria-live', 'polite');
    }
  });
}

/**
 * Announce to screen readers
 */
export function announceToScreenReader(message, priority = 'polite') {
  const announcer = document.getElementById('screen-reader-announcer') || createAnnouncer();
  announcer.setAttribute('aria-live', priority);
  announcer.textContent = message;
  
  // Clear after 1 second
  setTimeout(() => {
    announcer.textContent = '';
  }, 1000);
}

function createAnnouncer() {
  const announcer = document.createElement('div');
  announcer.id = 'screen-reader-announcer';
  announcer.className = 'sr-only';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  document.body.appendChild(announcer);
  return announcer;
}

/**
 * Initialize all accessibility features
 */
export function initAccessibility() {
  const keyboardNav = new KeyboardNavigationHandler();
  const highContrast = new HighContrastMode();
  
  initSkipToContent();
  
  // Add high contrast toggle to header/nav
  const header = document.querySelector('header, nav, .header');
  if (header) {
    const toggle = createHighContrastToggle(highContrast);
    header.appendChild(toggle);
  }
  
  // Enhance forms
  const forms = document.querySelectorAll('form');
  forms.forEach(form => enhanceFormAccessibility(form));
  
  return {
    keyboardNav,
    highContrast,
    announceToScreenReader,
    FocusTrap
  };
}
