/**
 * RetireLens 2 - Data Persistence Layer
 * 
 * IndexedDB with localStorage fallback for auto-save functionality
 */

const DB_NAME = 'RetireLensDB';
const DB_VERSION = 1;
const STORE_NAME = 'scenarios';
const AUTO_SAVE_KEY = 'retirelens_autosave';
const AUTO_SAVE_INTERVAL = 3000; // 3 seconds

let db = null;
let autoSaveTimer = null;

/**
 * Initialize IndexedDB
 */
export async function initDB() {
  if (!window.indexedDB) {
    console.warn('IndexedDB not supported, falling back to localStorage');
    return null;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('name', 'name', { unique: false });
        objectStore.createIndex('lastModified', 'lastModified', { unique: false });
      }
    };
  });
}

/**
 * Save scenario to IndexedDB
 */
export async function saveScenarioDB(scenario) {
  if (!db) {
    await initDB();
  }

  if (!db) {
    return saveScenarioLocalStorage(scenario);
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const scenarioData = {
      ...scenario,
      lastModified: Date.now()
    };
    
    const request = store.put(scenarioData);

    request.onsuccess = () => resolve(scenarioData);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load scenario from IndexedDB
 */
export async function loadScenarioDB(id) {
  if (!db) {
    await initDB();
  }

  if (!db) {
    return loadScenarioLocalStorage(id);
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * List all scenarios from IndexedDB
 */
export async function listScenariosDB() {
  if (!db) {
    await initDB();
  }

  if (!db) {
    return listScenariosLocalStorage();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const scenarios = request.result || [];
      scenarios.sort((a, b) => b.lastModified - a.lastModified);
      resolve(scenarios);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete scenario from IndexedDB
 */
export async function deleteScenarioDB(id) {
  if (!db) {
    await initDB();
  }

  if (!db) {
    return deleteScenarioLocalStorage(id);
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/**
 * LocalStorage fallback - Save scenario
 */
function saveScenarioLocalStorage(scenario) {
  try {
    const scenarios = listScenariosLocalStorage();
    const index = scenarios.findIndex(s => s.id === scenario.id);
    
    const scenarioData = {
      ...scenario,
      lastModified: Date.now()
    };

    if (index >= 0) {
      scenarios[index] = scenarioData;
    } else {
      scenarios.push(scenarioData);
    }

    localStorage.setItem(STORE_NAME, JSON.stringify(scenarios));
    return Promise.resolve(scenarioData);
  } catch (e) {
    console.error('LocalStorage save error:', e);
    return Promise.reject(e);
  }
}

/**
 * LocalStorage fallback - Load scenario
 */
function loadScenarioLocalStorage(id) {
  try {
    const scenarios = listScenariosLocalStorage();
    const scenario = scenarios.find(s => s.id === id);
    return Promise.resolve(scenario || null);
  } catch (e) {
    console.error('LocalStorage load error:', e);
    return Promise.reject(e);
  }
}

/**
 * LocalStorage fallback - List scenarios
 */
function listScenariosLocalStorage() {
  try {
    const data = localStorage.getItem(STORE_NAME);
    const scenarios = data ? JSON.parse(data) : [];
    scenarios.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    return scenarios;
  } catch (e) {
    console.error('LocalStorage list error:', e);
    return [];
  }
}

/**
 * LocalStorage fallback - Delete scenario
 */
function deleteScenarioLocalStorage(id) {
  try {
    const scenarios = listScenariosLocalStorage();
    const filtered = scenarios.filter(s => s.id !== id);
    localStorage.setItem(STORE_NAME, JSON.stringify(filtered));
    return Promise.resolve(true);
  } catch (e) {
    console.error('LocalStorage delete error:', e);
    return Promise.reject(e);
  }
}

/**
 * Auto-save functionality
 */
export function startAutoSave(getDataFn, onSaveFn) {
  stopAutoSave();

  autoSaveTimer = setInterval(async () => {
    const data = getDataFn();
    if (!data) return;

    try {
      const autoSaveScenario = {
        id: AUTO_SAVE_KEY,
        name: 'Auto-save',
        data: data,
        isAutoSave: true,
        lastModified: Date.now()
      };

      await saveScenarioDB(autoSaveScenario);
      
      if (onSaveFn) {
        onSaveFn(autoSaveScenario);
      }
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  }, AUTO_SAVE_INTERVAL);
}

/**
 * Stop auto-save
 */
export function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

/**
 * Load auto-saved data
 */
export async function loadAutoSave() {
  try {
    return await loadScenarioDB(AUTO_SAVE_KEY);
  } catch (e) {
    console.error('Failed to load auto-save:', e);
    return null;
  }
}

/**
 * Clear auto-save
 */
export async function clearAutoSave() {
  try {
    return await deleteScenarioDB(AUTO_SAVE_KEY);
  } catch (e) {
    console.error('Failed to clear auto-save:', e);
    return false;
  }
}

/**
 * Generate unique ID
 */
export function generateId() {
  return `scenario_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Export scenario to JSON
 */
export function exportScenario(scenario) {
  const dataStr = JSON.stringify(scenario, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${scenario.name || 'scenario'}_${Date.now()}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
}

/**
 * Import scenario from JSON
 */
export function importScenario(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const scenario = JSON.parse(e.target.result);
        scenario.id = generateId();
        scenario.lastModified = Date.now();
        resolve(scenario);
      } catch (error) {
        reject(new Error('Invalid scenario file'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Initialize persistence system
 */
export async function initPersistence() {
  try {
    await initDB();
    return true;
  } catch (e) {
    console.warn('Failed to initialize IndexedDB, using localStorage fallback');
    return false;
  }
}
