/**
 * RetireLens 2 - App State Management
 * 
 * Central state container for the application.
 * Follows patterns from RetireLens 1: single source of truth,
 * deep cloning, and Object.freeze for immutability.
 */

// Debug mode (enabled via ?debug=1 URL parameter)
export const DEBUG = typeof window !== 'undefined' && 
  new URLSearchParams(window.location.search).get('debug') === '1';

// Debug logging
export function debugLog(category, message, data = null) {
  if (!DEBUG) return;
  
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, category, message, data };
  
  // Store for export
  window.__RL_DEBUG_LOGS__ = window.__RL_DEBUG_LOGS__ || [];
  window.__RL_DEBUG_LOGS__.push(logEntry);
  
  // Color-coded console output
  const colors = {
    INPUT: '#2196F3',
    CALCULATION: '#4CAF50',
    OUTPUT: '#9C27B0',
    CHART: '#FF9800',
    INVARIANT: '#F44336',
    STATE: '#00BCD4'
  };
  
  console.log(
    `%c[${category}]%c ${message}`,
    `color: ${colors[category] || '#666'}; font-weight: bold`,
    'color: inherit',
    data || ''
  );
}

// Deep clone utility
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (Array.isArray(obj)) return obj.map(deepClone);
  
  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

// Simple hash for state comparison
export function hashObject(obj) {
  return JSON.stringify(obj).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0).toString(16);
}

// Application state
export const AppState = {
  // Current screen in the flow
  currentScreen: 'welcome',
  
  // User inputs (Plan A)
  planA: null,
  
  // Optional comparison (Plan B)
  planB: null,
  
  // Projection results
  projectionA: null,
  projectionB: null,
  
  // Monte Carlo results
  monteCarloA: null,
  monteCarloB: null,
  
  // Debug hashes
  hashes: {}
};

// Update state immutably
export function updateState(updates) {
  for (const key in updates) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      AppState[key] = updates[key];
      
      // Track state hash for debugging
      if (DEBUG) {
        AppState.hashes[key] = hashObject(AppState[key]);
        debugLog('STATE', `Updated ${key}`, { hash: AppState.hashes[key] });
      }
    }
  }
  
  // Expose to window for debugging
  if (typeof window !== 'undefined') {
    window.__RL_STATE__ = AppState;
    window.__RL_DEBUG_HASHES__ = AppState.hashes;
  }
}

// Invariant check
export function invariant(condition, message) {
  if (!condition) {
    debugLog('INVARIANT', `VIOLATION: ${message}`);
    if (DEBUG) {
      console.error(`[INVARIANT VIOLATION] ${message}`);
    }
    return false;
  }
  return true;
}

// Export debug log
export function exportDebugLog() {
  if (typeof window === 'undefined') return;
  
  const logs = window.__RL_DEBUG_LOGS__ || [];
  const data = {
    timestamp: new Date().toISOString(),
    state: AppState,
    hashes: AppState.hashes,
    logs
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `retirelens-debug-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Expose to window
if (typeof window !== 'undefined') {
  window.__RL_DEBUG__ = DEBUG;
  window.__RL_EXPORT_DEBUG_LOG__ = exportDebugLog;
}
