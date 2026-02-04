/**
 * RetireLens 2 - Scenario Manager
 * 
 * Manage multiple named scenarios with comparison functionality
 */

import {
  listScenariosDB,
  saveScenarioDB,
  loadScenarioDB,
  deleteScenarioDB,
  generateId,
  exportScenario,
  importScenario
} from '../persistence.js';

/**
 * Scenario Manager class
 */
export class ScenarioManager {
  constructor() {
    this.scenarios = [];
    this.currentScenario = null;
    this.compareMode = false;
    this.selectedForComparison = [];
  }

  async loadScenarios() {
    try {
      this.scenarios = await listScenariosDB();
      return this.scenarios.filter(s => !s.isAutoSave);
    } catch (e) {
      console.error('Failed to load scenarios:', e);
      return [];
    }
  }

  async saveScenario(name, data) {
    const scenario = {
      id: generateId(),
      name: name,
      data: data,
      createdAt: Date.now(),
      lastModified: Date.now()
    };

    try {
      await saveScenarioDB(scenario);
      this.scenarios.push(scenario);
      return scenario;
    } catch (e) {
      console.error('Failed to save scenario:', e);
      throw e;
    }
  }

  async updateScenario(id, data) {
    try {
      const scenario = await loadScenarioDB(id);
      if (!scenario) {
        throw new Error('Scenario not found');
      }

      scenario.data = data;
      scenario.lastModified = Date.now();

      await saveScenarioDB(scenario);
      
      const index = this.scenarios.findIndex(s => s.id === id);
      if (index >= 0) {
        this.scenarios[index] = scenario;
      }

      return scenario;
    } catch (e) {
      console.error('Failed to update scenario:', e);
      throw e;
    }
  }

  async deleteScenario(id) {
    try {
      await deleteScenarioDB(id);
      this.scenarios = this.scenarios.filter(s => s.id !== id);
      
      if (this.currentScenario && this.currentScenario.id === id) {
        this.currentScenario = null;
      }
      
      return true;
    } catch (e) {
      console.error('Failed to delete scenario:', e);
      throw e;
    }
  }

  async loadScenario(id) {
    try {
      const scenario = await loadScenarioDB(id);
      this.currentScenario = scenario;
      return scenario;
    } catch (e) {
      console.error('Failed to load scenario:', e);
      throw e;
    }
  }

  toggleComparison(scenarioId) {
    const index = this.selectedForComparison.indexOf(scenarioId);
    
    if (index >= 0) {
      this.selectedForComparison.splice(index, 1);
    } else {
      if (this.selectedForComparison.length < 3) {
        this.selectedForComparison.push(scenarioId);
      } else {
        throw new Error('Maximum 3 scenarios can be compared at once');
      }
    }
    
    return this.selectedForComparison;
  }

  async getComparisonData() {
    const scenarios = await Promise.all(
      this.selectedForComparison.map(id => loadScenarioDB(id))
    );
    
    return scenarios.filter(s => s !== null);
  }

  clearComparison() {
    this.selectedForComparison = [];
  }

  exportScenario(id) {
    const scenario = this.scenarios.find(s => s.id === id);
    if (scenario) {
      exportScenario(scenario);
    }
  }

  async importScenario(file) {
    try {
      const scenario = await importScenario(file);
      await saveScenarioDB(scenario);
      this.scenarios.push(scenario);
      return scenario;
    } catch (e) {
      console.error('Failed to import scenario:', e);
      throw e;
    }
  }
}

/**
 * Render scenario list
 */
export function renderScenarioList(scenarios, manager) {
  if (!scenarios || scenarios.length === 0) {
    return `
      <div class="scenario-list-empty">
        <p>No saved scenarios yet.</p>
        <p>Create your first scenario to get started!</p>
      </div>
    `;
  }

  return `
    <div class="scenario-list">
      ${scenarios.map(scenario => renderScenarioCard(scenario, manager)).join('')}
    </div>
  `;
}

/**
 * Render individual scenario card
 */
function renderScenarioCard(scenario, manager) {
  const isSelected = manager.selectedForComparison.includes(scenario.id);
  const date = new Date(scenario.lastModified);
  const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

  return `
    <div class="scenario-card ${isSelected ? 'selected' : ''}" data-scenario-id="${scenario.id}">
      <div class="scenario-card-header">
        <h3 class="scenario-name">${escapeHtml(scenario.name)}</h3>
        <div class="scenario-actions">
          <button class="btn-icon scenario-load" data-id="${scenario.id}" title="Load">
            📂
          </button>
          <button class="btn-icon scenario-export" data-id="${scenario.id}" title="Export">
            💾
          </button>
          <button class="btn-icon scenario-delete" data-id="${scenario.id}" title="Delete">
            🗑️
          </button>
        </div>
      </div>
      <div class="scenario-card-body">
        <div class="scenario-meta">
          <span class="scenario-date">Last modified: ${dateStr}</span>
        </div>
        ${renderScenarioSummary(scenario)}
      </div>
      <div class="scenario-card-footer">
        <label class="scenario-compare-checkbox">
          <input 
            type="checkbox" 
            class="scenario-compare-input" 
            data-id="${scenario.id}"
            ${isSelected ? 'checked' : ''}
          />
          Compare
        </label>
      </div>
    </div>
  `;
}

/**
 * Render scenario summary
 */
function renderScenarioSummary(scenario) {
  const data = scenario.data || {};
  
  const items = [];
  
  if (data.currentAge) {
    items.push(`Age: ${data.currentAge}`);
  }
  
  if (data.retirementAge) {
    items.push(`Retirement: ${data.retirementAge}`);
  }
  
  if (data.targetNetIncome) {
    items.push(`Income: £${data.targetNetIncome.toLocaleString()}`);
  }
  
  if (data.currentPension !== null && data.currentPension !== undefined) {
    items.push(`Pension: £${data.currentPension.toLocaleString()}`);
  }
  
  if (data.currentIsa !== null && data.currentIsa !== undefined) {
    items.push(`ISA: £${data.currentIsa.toLocaleString()}`);
  }

  if (items.length === 0) {
    return '<p class="scenario-summary-empty">No data</p>';
  }

  return `
    <div class="scenario-summary">
      ${items.map(item => `<span class="scenario-summary-item">${item}</span>`).join('')}
    </div>
  `;
}

/**
 * Render scenario manager screen
 */
export function renderScenarioManager(manager) {
  return `
    <div class="scenario-manager">
      <div class="scenario-manager-header">
        <h2>Scenario Manager</h2>
        <div class="scenario-manager-actions">
          <button id="scenario-new-btn" class="btn-primary">
            New Scenario
          </button>
          <button id="scenario-import-btn" class="btn-secondary">
            Import
          </button>
          ${manager.selectedForComparison.length > 1 ? `
            <button id="scenario-compare-btn" class="btn-secondary">
              Compare (${manager.selectedForComparison.length})
            </button>
          ` : ''}
        </div>
      </div>
      
      <div class="scenario-manager-body">
        ${renderScenarioList(manager.scenarios.filter(s => !s.isAutoSave), manager)}
      </div>
      
      <input type="file" id="scenario-import-input" accept=".json" style="display: none;" />
    </div>
  `;
}

/**
 * Initialize scenario manager interactions
 */
export function initScenarioManager(manager, callbacks = {}) {
  const container = document.getElementById('scenario-manager-container');
  if (!container) return;

  container.innerHTML = renderScenarioManager(manager);

  // New scenario button
  const newBtn = document.getElementById('scenario-new-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      if (callbacks.onNew) callbacks.onNew();
    });
  }

  // Import button
  const importBtn = document.getElementById('scenario-import-btn');
  const importInput = document.getElementById('scenario-import-input');
  
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => {
      importInput.click();
    });
    
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          await manager.importScenario(file);
          if (callbacks.onImport) callbacks.onImport();
          await manager.loadScenarios();
          initScenarioManager(manager, callbacks);
        } catch (err) {
          alert('Failed to import scenario: ' + err.message);
        }
      }
      importInput.value = '';
    });
  }

  // Compare button
  const compareBtn = document.getElementById('scenario-compare-btn');
  if (compareBtn) {
    compareBtn.addEventListener('click', async () => {
      if (callbacks.onCompare) {
        const comparisonData = await manager.getComparisonData();
        callbacks.onCompare(comparisonData);
      }
    });
  }

  // Scenario cards
  document.querySelectorAll('.scenario-load').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        const scenario = await manager.loadScenario(id);
        if (callbacks.onLoad) callbacks.onLoad(scenario);
      } catch (err) {
        alert('Failed to load scenario: ' + err.message);
      }
    });
  });

  document.querySelectorAll('.scenario-export').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      manager.exportScenario(id);
    });
  });

  document.querySelectorAll('.scenario-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('Are you sure you want to delete this scenario?')) {
        try {
          await manager.deleteScenario(id);
          initScenarioManager(manager, callbacks);
        } catch (err) {
          alert('Failed to delete scenario: ' + err.message);
        }
      }
    });
  });

  document.querySelectorAll('.scenario-compare-input').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      try {
        manager.toggleComparison(id);
        initScenarioManager(manager, callbacks);
      } catch (err) {
        alert(err.message);
        e.target.checked = !e.target.checked;
      }
    });
  });
}

/**
 * Render scenario comparison view
 */
export function renderScenarioComparison(scenarios) {
  if (!scenarios || scenarios.length < 2) {
    return '<p>Select at least 2 scenarios to compare</p>';
  }

  return `
    <div class="scenario-comparison">
      <h2>Scenario Comparison</h2>
      
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            ${scenarios.map(s => `<th>${escapeHtml(s.name)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${renderComparisonRow('Current Age', scenarios, s => s.data.currentAge)}
          ${renderComparisonRow('Retirement Age', scenarios, s => s.data.retirementAge)}
          ${renderComparisonRow('Target Income', scenarios, s => s.data.targetNetIncome ? `£${s.data.targetNetIncome.toLocaleString()}` : '-')}
          ${renderComparisonRow('Current Pension', scenarios, s => s.data.currentPension !== null ? `£${s.data.currentPension.toLocaleString()}` : '-')}
          ${renderComparisonRow('Current ISA', scenarios, s => s.data.currentIsa !== null ? `£${s.data.currentIsa.toLocaleString()}` : '-')}
          ${renderComparisonRow('Total Pot', scenarios, s => {
            const pension = s.data.currentPension || 0;
            const isa = s.data.currentIsa || 0;
            return `£${(pension + isa).toLocaleString()}`;
          })}
        </tbody>
      </table>
      
      <button id="comparison-close-btn" class="btn-secondary">Close Comparison</button>
    </div>
  `;
}

function renderComparisonRow(label, scenarios, valueFn) {
  return `
    <tr>
      <td class="comparison-label">${label}</td>
      ${scenarios.map(s => `<td>${valueFn(s)}</td>`).join('')}
    </tr>
  `;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Create global scenario manager instance
 */
export function createScenarioManager() {
  return new ScenarioManager();
}
