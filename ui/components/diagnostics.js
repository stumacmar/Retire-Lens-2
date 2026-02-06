/**
 * RetireLens Pro - Timeline Diagnostics Panel
 * 
 * Dev-only toggleable panel showing per-age income streams for both people.
 * Helps verify timeline timing is correct.
 * 
 * Shows:
 * - Person A: active streams (DB/State/DC withdrawal) and totals
 * - Person B: same
 * - Household: net target, net achieved, surplus
 */

/**
 * Render diagnostics toggle button
 * @param {HTMLElement} containerEl - Container to append button to
 * @returns {HTMLElement} The toggle button element
 */
export function renderDiagnosticsToggle(containerEl) {
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'diagnostics-toggle';
  toggleBtn.className = 'diagnostics-toggle';
  toggleBtn.textContent = '🔬 Show Diagnostics';
  toggleBtn.setAttribute('aria-expanded', 'false');
  toggleBtn.setAttribute('aria-controls', 'diagnostics-panel');
  
  toggleBtn.addEventListener('click', () => {
    const panel = document.getElementById('diagnostics-panel');
    if (panel) {
      const isHidden = panel.getAttribute('aria-hidden') === 'true';
      panel.setAttribute('aria-hidden', !isHidden);
      toggleBtn.setAttribute('aria-expanded', isHidden);
      toggleBtn.textContent = isHidden ? '🔬 Hide Diagnostics' : '🔬 Show Diagnostics';
    }
  });
  
  containerEl.appendChild(toggleBtn);
  return toggleBtn;
}

/**
 * Render diagnostics panel
 * @param {HTMLElement} containerEl - Container to append panel to
 * @param {Array} timeline - Timeline data from projectHousehold()
 * @param {Object} plan - Household plan object
 * @returns {HTMLElement} The diagnostics panel element
 */
export function renderDiagnosticsPanel(containerEl, timeline, plan) {
  // Remove existing panel if present
  const existingPanel = document.getElementById('diagnostics-panel');
  if (existingPanel) {
    existingPanel.remove();
  }
  
  // Create panel container
  const panel = document.createElement('div');
  panel.id = 'diagnostics-panel';
  panel.className = 'diagnostics-panel';
  panel.setAttribute('aria-hidden', 'true');
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Timeline diagnostics');
  
  // Header
  const header = document.createElement('div');
  header.className = 'diagnostics-header';
  header.innerHTML = `
    <h3>🔬 Timeline Diagnostics</h3>
    <p class="diagnostics-subtitle">Verify income stream timing per age</p>
  `;
  panel.appendChild(header);
  
  // Table container (scrollable)
  const tableContainer = document.createElement('div');
  tableContainer.className = 'diagnostics-table-container';
  
  const table = document.createElement('table');
  table.className = 'diagnostics-table';
  
  // Table header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  const headers = [
    'Year',
    plan.householdType === 'couple' ? 'Person A Age' : 'Age',
    ...(plan.householdType === 'couple' ? ['Person B Age'] : []),
    ...(plan.householdType === 'couple' ? ['A: State', 'A: DB', 'A: DC', 'B: State', 'B: DB', 'B: DC'] : ['State', 'DB', 'DC']),
    'HH Net',
    'HH Target',
    'Surplus'
  ];
  
  headers.forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Table body
  const tbody = document.createElement('tbody');
  
  // Show every 5th year to keep it manageable
  const filteredTimeline = timeline.filter((_, idx) => idx % 5 === 0 || idx === timeline.length - 1);
  
  filteredTimeline.forEach(year => {
    const row = document.createElement('tr');
    
    // Highlight retired years
    if (year.anyRetired) {
      row.classList.add('retired-year');
    }
    
    // Highlight if target not met
    if (year.anyRetired && !year.targetMet) {
      row.classList.add('target-not-met');
    }
    
    const cells = [];
    
    // Year
    cells.push(year.year);
    
    // Ages
    cells.push(year.personAAge);
    if (plan.householdType === 'couple') {
      cells.push(year.personBAge || '-');
    }
    
    // Income streams
    if (plan.householdType === 'couple') {
      cells.push(formatCurrency(year.personAIncome.statePension));
      cells.push(formatCurrency(year.personAIncome.dbPension));
      cells.push(formatCurrency(year.personAIncome.dcWithdrawal));
      cells.push(formatCurrency(year.personBIncome.statePension));
      cells.push(formatCurrency(year.personBIncome.dbPension));
      cells.push(formatCurrency(year.personBIncome.dcWithdrawal));
    } else {
      cells.push(formatCurrency(year.personAIncome.statePension));
      cells.push(formatCurrency(year.personAIncome.dbPension));
      cells.push(formatCurrency(year.personAIncome.dcWithdrawal));
    }
    
    // Household
    cells.push(formatCurrency(year.householdNetIncome));
    cells.push(formatCurrency(plan.targetNetIncome));
    
    const surplus = year.householdNetIncome - plan.targetNetIncome;
    cells.push(formatCurrency(surplus, true)); // Show sign
    
    cells.forEach(content => {
      const td = document.createElement('td');
      td.textContent = content;
      row.appendChild(td);
    });
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  tableContainer.appendChild(table);
  panel.appendChild(tableContainer);
  
  // Footer notes
  const footer = document.createElement('div');
  footer.className = 'diagnostics-footer';
  footer.innerHTML = `
    <p><strong>Legend:</strong></p>
    <ul>
      <li>🟢 Retired years highlighted</li>
      <li>🔴 Target not met highlighted</li>
      <li>Showing every 5th year for clarity</li>
    </ul>
  `;
  panel.appendChild(footer);
  
  containerEl.appendChild(panel);
  return panel;
}

/**
 * Format currency for display
 * @param {number} value - Value to format
 * @param {boolean} showSign - Whether to show + sign for positive values
 * @returns {string} Formatted currency string
 */
function formatCurrency(value, showSign = false) {
  if (value === 0 || value === null || value === undefined) {
    return '-';
  }
  
  const formatted = `£${Math.round(value).toLocaleString()}`;
  if (showSign && value > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

/**
 * Update diagnostics panel with new data
 * @param {Array} timeline - Updated timeline data
 * @param {Object} plan - Updated household plan
 */
export function updateDiagnostics(timeline, plan) {
  const container = document.getElementById('diagnostics-container');
  if (!container) return;
  
  renderDiagnosticsPanel(container, timeline, plan);
}
