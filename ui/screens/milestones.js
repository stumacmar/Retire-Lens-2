/**
 * RetireLens 2 - Milestones Screen
 * 
 * User interface for managing retirement milestones and one-time expenses
 */

import { 
  createMilestone, 
  getMilestoneCategories,
  calculateMilestoneImpact,
  validateMilestones,
  sortMilestonesByAge
} from '../../engine/milestones.js';

/**
 * Renders the milestones management screen
 * @param {Array} milestones - Current milestones
 * @param {object} plan - The retirement plan
 * @param {object} projection - Projection results
 * @param {Function} onUpdate - Callback when milestones change
 * @returns {HTMLElement} The milestones screen element
 */
export function renderMilestonesScreen(milestones = [], plan, projection, onUpdate) {
  const container = document.createElement('div');
  container.className = 'milestones-screen';

  // Header
  const header = document.createElement('div');
  header.className = 'milestones-header';
  header.innerHTML = `
    <h2>🎯 Retirement Milestones</h2>
    <p class="milestones-subtitle">Plan for major expenses and life goals in retirement</p>
  `;
  container.appendChild(header);

  // Impact summary
  if (milestones.length > 0 && plan && projection) {
    const impact = calculateMilestoneImpact(milestones, plan, projection);
    const impactPanel = createImpactPanel(impact);
    container.appendChild(impactPanel);
  }

  // Add milestone button
  const addButton = document.createElement('button');
  addButton.className = 'btn-primary add-milestone-btn';
  addButton.textContent = '+ Add Milestone';
  addButton.onclick = () => showMilestoneForm(null, milestones, plan, projection, onUpdate);
  container.appendChild(addButton);

  // Milestones list
  const listContainer = document.createElement('div');
  listContainer.className = 'milestones-list';
  
  if (milestones.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎯</div>
        <h3>No milestones yet</h3>
        <p>Add major expenses like holidays, car purchases, or home improvements to see their impact on your retirement plan.</p>
      </div>
    `;
  } else {
    const sortedMilestones = sortMilestonesByAge(milestones);
    sortedMilestones.forEach(milestone => {
      const card = createMilestoneCard(milestone, milestones, plan, projection, onUpdate);
      listContainer.appendChild(card);
    });
  }

  container.appendChild(listContainer);

  return container;
}

/**
 * Creates impact summary panel
 */
function createImpactPanel(impact) {
  const panel = document.createElement('div');
  panel.className = `impact-panel ${impact.feasible ? 'feasible' : 'warning'}`;
  
  panel.innerHTML = `
    <div class="impact-header">
      <h3>${impact.feasible ? '✅' : '⚠️'} Milestone Impact Analysis</h3>
    </div>
    <div class="impact-metrics">
      <div class="impact-metric">
        <span class="metric-label">Total Cost</span>
        <span class="metric-value">£${(impact.totalCost / 1000).toFixed(1)}k</span>
      </div>
      <div class="impact-metric">
        <span class="metric-label">Pot Impact</span>
        <span class="metric-value">${(impact.impactRatio * 100).toFixed(0)}%</span>
      </div>
      <div class="impact-metric">
        <span class="metric-label">Income Reduction</span>
        <span class="metric-value">£${(impact.incomeReduction / 1000).toFixed(1)}k/yr</span>
      </div>
    </div>
    ${impact.warnings.length > 0 ? `
      <div class="impact-warnings">
        ${impact.warnings.map(w => `
          <div class="warning-item severity-${w.severity}">
            <span class="warning-icon">${w.severity === 'high' ? '⚠️' : 'ℹ️'}</span>
            <span>${w.message}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  return panel;
}

/**
 * Creates a milestone card
 */
function createMilestoneCard(milestone, allMilestones, plan, projection, onUpdate) {
  const categories = getMilestoneCategories();
  const category = categories[milestone.category] || categories.other;
  
  const card = document.createElement('div');
  card.className = `milestone-card priority-${milestone.priority}`;
  
  card.innerHTML = `
    <div class="milestone-icon">${category.icon}</div>
    <div class="milestone-content">
      <div class="milestone-title-row">
        <h4 class="milestone-title">${milestone.description}</h4>
        <span class="priority-badge badge-${milestone.priority}">
          ${milestone.priority === 'essential' ? '⭐ Essential' : '💫 Nice-to-have'}
        </span>
      </div>
      <div class="milestone-details">
        <span class="detail-item">
          <span class="detail-icon">📅</span>
          <span>Age ${milestone.age}</span>
        </span>
        <span class="detail-item">
          <span class="detail-icon">💰</span>
          <span>£${(milestone.amount / 1000).toFixed(1)}k</span>
        </span>
        <span class="detail-item">
          <span class="detail-icon">🏷️</span>
          <span>${category.label}</span>
        </span>
      </div>
      ${milestone.notes ? `
        <div class="milestone-notes">
          <p>${milestone.notes}</p>
        </div>
      ` : ''}
    </div>
    <div class="milestone-actions">
      <button class="btn-icon edit-btn" title="Edit milestone">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
        </svg>
      </button>
      <button class="btn-icon delete-btn" title="Delete milestone">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>
  `;

  // Edit button
  const editBtn = card.querySelector('.edit-btn');
  editBtn.onclick = () => showMilestoneForm(milestone, allMilestones, plan, projection, onUpdate);

  // Delete button
  const deleteBtn = card.querySelector('.delete-btn');
  deleteBtn.onclick = () => {
    if (confirm(`Delete milestone "${milestone.description}"?`)) {
      const updated = allMilestones.filter(m => m.id !== milestone.id);
      onUpdate(updated);
    }
  };

  return card;
}

/**
 * Shows milestone form (add or edit)
 */
function showMilestoneForm(milestone, allMilestones, plan, projection, onUpdate) {
  const isEdit = !!milestone;
  const categories = getMilestoneCategories();

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  
  modal.innerHTML = `
    <div class="modal-content milestone-form-modal">
      <div class="modal-header">
        <h3>${isEdit ? 'Edit' : 'Add'} Milestone</h3>
        <button class="modal-close">&times;</button>
      </div>
      <form id="milestone-form" class="milestone-form">
        <div class="form-group">
          <label for="description">Description *</label>
          <input type="text" id="description" name="description" 
                 value="${milestone?.description || ''}" 
                 placeholder="e.g., Dream holiday to Japan" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="age">Age *</label>
            <input type="number" id="age" name="age" 
                   value="${milestone?.age || plan?.retirementAge || 65}" 
                   min="${plan?.retirementAge || 55}" max="100" required>
          </div>
          <div class="form-group">
            <label for="amount">Amount (£) *</label>
            <input type="number" id="amount" name="amount" 
                   value="${milestone?.amount || ''}" 
                   min="100" step="100" placeholder="10000" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="category">Category</label>
            <select id="category" name="category">
              ${Object.entries(categories).map(([key, cat]) => `
                <option value="${key}" ${milestone?.category === key ? 'selected' : ''}>
                  ${cat.icon} ${cat.label}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="priority">Priority</label>
            <select id="priority" name="priority">
              <option value="essential" ${milestone?.priority === 'essential' ? 'selected' : ''}>
                ⭐ Essential
              </option>
              <option value="nice-to-have" ${milestone?.priority !== 'essential' ? 'selected' : ''}>
                💫 Nice-to-have
              </option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="notes">Notes (optional)</label>
          <textarea id="notes" name="notes" rows="3" 
                    placeholder="Additional details...">${milestone?.notes || ''}</textarea>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary cancel-btn">Cancel</button>
          <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Add'} Milestone</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeModal = () => modal.remove();
  modal.querySelector('.modal-close').onclick = closeModal;
  modal.querySelector('.cancel-btn').onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  // Form submission
  const form = modal.querySelector('#milestone-form');
  form.onsubmit = (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const newMilestone = {
      description: formData.get('description'),
      age: parseInt(formData.get('age')),
      amount: parseFloat(formData.get('amount')),
      category: formData.get('category'),
      priority: formData.get('priority'),
      notes: formData.get('notes')
    };

    try {
      const created = createMilestone({
        ...newMilestone,
        id: milestone?.id
      });

      const updated = isEdit
        ? allMilestones.map(m => m.id === created.id ? created : m)
        : [...allMilestones, created];

      onUpdate(updated);
      closeModal();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };
}

/**
 * Add milestones screen styles
 */
export function addMilestonesStyles() {
  if (document.getElementById('milestones-styles')) return;

  const style = document.createElement('style');
  style.id = 'milestones-styles';
  style.textContent = `
    .milestones-screen {
      padding: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .milestones-header h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.75rem;
      color: #1f2937;
    }

    .milestones-subtitle {
      margin: 0 0 1.5rem 0;
      color: #6b7280;
    }

    .add-milestone-btn {
      margin-bottom: 1.5rem;
    }

    .impact-panel {
      background: white;
      border: 2px solid #10b981;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .impact-panel.warning {
      border-color: #ef4444;
      background: #fef2f2;
    }

    .impact-header h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      color: #1f2937;
    }

    .impact-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .impact-metric {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .metric-label {
      font-size: 0.85rem;
      color: #6b7280;
    }

    .metric-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1f2937;
    }

    .impact-warnings {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
    }

    .warning-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: #374151;
    }

    .milestones-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .milestone-card {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 1.25rem;
      transition: all 0.2s;
    }

    .milestone-card:hover {
      border-color: #3b82f6;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .milestone-card.priority-essential {
      border-left: 4px solid #f59e0b;
    }

    .milestone-icon {
      font-size: 2rem;
      flex-shrink: 0;
    }

    .milestone-content {
      flex: 1;
    }

    .milestone-title-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }

    .milestone-title {
      margin: 0;
      font-size: 1.1rem;
      color: #1f2937;
    }

    .priority-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .badge-essential {
      background: #fef3c7;
      color: #92400e;
    }

    .badge-nice-to-have {
      background: #dbeafe;
      color: #1e40af;
    }

    .milestone-details {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
      margin-bottom: 0.5rem;
    }

    .detail-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: #6b7280;
    }

    .detail-icon {
      font-size: 1rem;
    }

    .milestone-notes {
      margin-top: 0.75rem;
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 6px;
    }

    .milestone-notes p {
      margin: 0;
      font-size: 0.9rem;
      color: #4b5563;
      font-style: italic;
    }

    .milestone-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .btn-icon {
      background: none;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 0.5rem;
      cursor: pointer;
      color: #6b7280;
      transition: all 0.2s;
    }

    .btn-icon:hover {
      border-color: #3b82f6;
      color: #3b82f6;
    }

    .delete-btn:hover {
      border-color: #ef4444;
      color: #ef4444;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      background: white;
      border-radius: 8px;
      border: 2px dashed #e5e7eb;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      margin: 0 0 0.5rem 0;
      color: #1f2937;
    }

    .empty-state p {
      margin: 0;
      color: #6b7280;
    }

    .milestone-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-group label {
      font-weight: 600;
      font-size: 0.9rem;
      color: #374151;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      padding: 0.625rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.95rem;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    @media (max-width: 768px) {
      .form-row {
        grid-template-columns: 1fr;
      }

      .milestone-card {
        flex-direction: column;
      }

      .milestone-actions {
        width: 100%;
        justify-content: flex-end;
      }
    }
  `;

  document.head.appendChild(style);
}

// Auto-add styles when module loads
if (typeof document !== 'undefined') {
  addMilestonesStyles();
}
