/**
 * RetireLens Pro - Centralized Formatting Utilities
 * 
 * SINGLE SOURCE OF TRUTH for all display formatting.
 * Import this module instead of defining formatting functions locally.
 * 
 * SSOT for:
 * - Currency formatting (GBP)
 * - Percentage formatting
 * - Safe number parsing
 * - Compact number notation
 */

/**
 * Format currency as GBP
 * Guards against null, undefined, NaN, and non-numbers
 * 
 * @param {number} value - The value to format
 * @param {object} options - Formatting options
 * @param {boolean} options.compact - Use compact notation (k/M) for large numbers
 * @param {boolean} options.showDecimals - Show decimal places
 * @param {number} options.decimals - Number of decimal places (default: 0)
 * @returns {string} Formatted currency string or placeholder
 */
export function formatGBP(value, options = {}) {
  const { compact = false, showDecimals = false, decimals = 0 } = options;
  
  // Guard against invalid values
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
    return '—';
  }
  
  if (compact) {
    if (Math.abs(value) >= 1000000) {
      return '£' + (value / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(value) >= 1000) {
      return '£' + Math.round(value / 1000) + 'k';
    }
  }
  
  if (showDecimals) {
    return '£' + value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  return '£' + Math.round(value).toLocaleString();
}

/**
 * Alias for formatGBP for backward compatibility
 * @deprecated Use formatGBP instead
 */
export function formatCurrency(value, options = {}) {
  return formatGBP(value, options);
}

/**
 * Format value as percentage
 * 
 * @param {number} value - The value to format (0.75 = 75%)
 * @param {object} options - Formatting options
 * @param {number} options.decimals - Number of decimal places (default: 1)
 * @param {boolean} options.isAlreadyPercent - Value is already in percent form (75 not 0.75)
 * @returns {string} Formatted percentage string
 */
export function formatPct(value, options = {}) {
  const { decimals = 1, isAlreadyPercent = false } = options;
  
  // Guard against invalid values
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
    return '—';
  }
  
  const pctValue = isAlreadyPercent ? value : value * 100;
  return pctValue.toFixed(decimals) + '%';
}

/**
 * Safe number parsing helper
 * Returns the default value if the input is null, undefined, or NaN
 * 
 * @param {any} value - The value to parse
 * @param {number} defaultVal - Default value if parsing fails (default: 0)
 * @returns {number} Parsed number or default
 */
export function safeNumber(value, defaultVal = 0) {
  if (value === null || value === undefined) return defaultVal;
  const num = Number(value);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Format a number with compact notation for charts
 * 
 * @param {number} value - The value to format
 * @returns {string} Compact formatted string
 */
export function formatCompact(value) {
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
    return '—';
  }
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1000000000) {
    return sign + '£' + (absValue / 1000000000).toFixed(1) + 'B';
  } else if (absValue >= 1000000) {
    return sign + '£' + (absValue / 1000000).toFixed(1) + 'M';
  } else if (absValue >= 1000) {
    return sign + '£' + Math.round(absValue / 1000) + 'k';
  }
  return sign + '£' + Math.round(absValue);
}

/**
 * Format a delta/change value (positive shows +, negative shows -)
 * 
 * @param {number} value - The delta value
 * @param {object} options - Formatting options
 * @returns {string} Formatted delta string
 */
export function formatDelta(value, options = {}) {
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
    return '—';
  }
  
  const prefix = value > 0 ? '+' : '';
  return prefix + formatGBP(value, options);
}

/**
 * Format years as a human-readable string
 * 
 * @param {number} years - Number of years
 * @returns {string} Formatted string
 */
export function formatYears(years) {
  if (years === null || years === undefined || typeof years !== 'number' || isNaN(years)) {
    return '—';
  }
  
  const rounded = Math.round(years);
  return rounded === 1 ? '1 year' : `${rounded} years`;
}

/**
 * Format age as ordinal
 * 
 * @param {number} age - Age value
 * @returns {string} Formatted string (e.g., "Age 65")
 */
export function formatAge(age) {
  if (age === null || age === undefined || typeof age !== 'number' || isNaN(age)) {
    return '—';
  }
  
  return `Age ${Math.round(age)}`;
}
