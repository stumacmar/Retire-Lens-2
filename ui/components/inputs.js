/**
 * RetireLens 2 - Input Component
 * 
 * Reusable input components for the one-question-per-screen flow.
 */

/**
 * Create a currency input with formatting
 */
export function createCurrencyInput(config) {
  const {
    id,
    label,
    placeholder = '0',
    min = 0,
    max = 10000000,
    step = 100,
    helpText = ''
  } = config;
  
  return `
    <div class="input-group currency-input">
      <label for="${id}">${label}</label>
      <div class="input-wrapper">
        <span class="currency-symbol">£</span>
        <input 
          type="number" 
          id="${id}" 
          placeholder="${placeholder}"
          min="${min}"
          max="${max}"
          step="${step}"
          inputmode="numeric"
        />
      </div>
      ${helpText ? `<p class="help-text">${helpText}</p>` : ''}
    </div>
  `;
}

/**
 * Create an age input
 */
export function createAgeInput(config) {
  const {
    id,
    label,
    min = 18,
    max = 100,
    defaultValue = ''
  } = config;
  
  return `
    <div class="input-group age-input">
      <label for="${id}">${label}</label>
      <input 
        type="number" 
        id="${id}" 
        min="${min}"
        max="${max}"
        value="${defaultValue}"
        inputmode="numeric"
      />
      <span class="input-suffix">years old</span>
    </div>
  `;
}

/**
 * Create a percentage input
 */
export function createPercentInput(config) {
  const {
    id,
    label,
    min = 0,
    max = 100,
    step = 0.1,
    defaultValue = '',
    helpText = ''
  } = config;
  
  return `
    <div class="input-group percent-input">
      <label for="${id}">${label}</label>
      <div class="input-wrapper">
        <input 
          type="number" 
          id="${id}" 
          min="${min}"
          max="${max}"
          step="${step}"
          value="${defaultValue}"
          inputmode="decimal"
        />
        <span class="percent-symbol">%</span>
      </div>
      ${helpText ? `<p class="help-text">${helpText}</p>` : ''}
    </div>
  `;
}

/**
 * Create navigation buttons
 */
export function createNavButtons(config = {}) {
  const {
    showBack = true,
    nextLabel = 'Next',
    backLabel = 'Back'
  } = config;
  
  return `
    <div class="nav-buttons">
      ${showBack ? `<button type="button" class="btn btn-secondary" data-action="back">${backLabel}</button>` : '<div></div>'}
      <button type="button" class="btn btn-primary" data-action="next">${nextLabel}</button>
    </div>
  `;
}

/**
 * Create a slider input
 */
export function createSliderInput(config) {
  const {
    id,
    label,
    min = 0,
    max = 100,
    step = 1,
    defaultValue = 50,
    formatValue = (v) => v
  } = config;
  
  return `
    <div class="input-group slider-input">
      <label for="${id}">${label}</label>
      <div class="slider-wrapper">
        <input 
          type="range" 
          id="${id}" 
          min="${min}"
          max="${max}"
          step="${step}"
          value="${defaultValue}"
        />
        <output id="${id}-output">${formatValue(defaultValue)}</output>
      </div>
    </div>
  `;
}

/**
 * Initialize slider with live output update
 */
export function initSlider(id, formatValue = (v) => v) {
  const slider = document.getElementById(id);
  const output = document.getElementById(`${id}-output`);
  
  if (slider && output) {
    slider.addEventListener('input', () => {
      output.textContent = formatValue(slider.value);
    });
  }
}
