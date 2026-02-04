/**
 * RetireLens 2 - Bottom Sheet Component
 * 
 * Mobile-optimized bottom sheet for inputs and selections
 */

import { FocusTrap } from './accessibility.js';

/**
 * Bottom Sheet class
 */
export class BottomSheet {
  constructor(options = {}) {
    this.options = {
      title: options.title || '',
      content: options.content || '',
      height: options.height || 'auto',
      closable: options.closable !== false,
      backdrop: options.backdrop !== false,
      onOpen: options.onOpen || null,
      onClose: options.onClose || null,
      ...options
    };

    this.element = null;
    this.backdrop = null;
    this.focusTrap = null;
    this.isOpen = false;
    this.startY = 0;
    this.currentY = 0;
    this.isDragging = false;
  }

  create() {
    if (this.element) return;

    // Create backdrop
    if (this.options.backdrop) {
      this.backdrop = document.createElement('div');
      this.backdrop.className = 'bottom-sheet-backdrop';
      this.backdrop.setAttribute('aria-hidden', 'true');
      
      if (this.options.closable) {
        this.backdrop.addEventListener('click', () => this.close());
      }
    }

    // Create bottom sheet
    this.element = document.createElement('div');
    this.element.className = 'bottom-sheet';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    
    if (this.options.title) {
      this.element.setAttribute('aria-labelledby', 'bottom-sheet-title');
    }

    // Build content
    this.element.innerHTML = `
      <div class="bottom-sheet-handle" aria-hidden="true"></div>
      
      ${this.options.title ? `
        <div class="bottom-sheet-header">
          <h3 id="bottom-sheet-title" class="bottom-sheet-title">${this.options.title}</h3>
          ${this.options.closable ? `
            <button class="bottom-sheet-close" aria-label="Close">✕</button>
          ` : ''}
        </div>
      ` : ''}
      
      <div class="bottom-sheet-content">
        ${this.options.content}
      </div>
    `;

    // Set height
    if (this.options.height !== 'auto') {
      this.element.style.height = this.options.height;
    }

    // Add event listeners
    const closeBtn = this.element.querySelector('.bottom-sheet-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Add drag handlers for mobile
    const handle = this.element.querySelector('.bottom-sheet-handle');
    if (handle) {
      handle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
      handle.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      handle.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    }
  }

  handleTouchStart(e) {
    this.startY = e.touches[0].clientY;
    this.isDragging = true;
    this.element.classList.add('dragging');
  }

  handleTouchMove(e) {
    if (!this.isDragging) return;

    this.currentY = e.touches[0].clientY;
    const deltaY = this.currentY - this.startY;

    // Only allow dragging down
    if (deltaY > 0) {
      e.preventDefault();
      this.element.style.transform = `translateY(${deltaY}px)`;
    }
  }

  handleTouchEnd(e) {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.element.classList.remove('dragging');

    const deltaY = this.currentY - this.startY;
    const threshold = 100;

    if (deltaY > threshold) {
      this.close();
    } else {
      this.element.style.transform = '';
    }
  }

  open() {
    if (this.isOpen) return;

    this.create();

    // Add to DOM
    if (this.backdrop) {
      document.body.appendChild(this.backdrop);
      setTimeout(() => this.backdrop.classList.add('open'), 10);
    }

    document.body.appendChild(this.element);
    document.body.style.overflow = 'hidden';

    // Animate in
    setTimeout(() => {
      this.element.classList.add('open');
    }, 10);

    // Setup focus trap
    this.focusTrap = new FocusTrap(this.element);
    this.focusTrap.activate();

    this.isOpen = true;

    if (this.options.onOpen) {
      this.options.onOpen(this);
    }
  }

  close() {
    if (!this.isOpen) return;

    // Animate out
    this.element.classList.remove('open');
    if (this.backdrop) {
      this.backdrop.classList.remove('open');
    }

    // Remove from DOM after animation
    setTimeout(() => {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      if (this.backdrop && this.backdrop.parentNode) {
        this.backdrop.parentNode.removeChild(this.backdrop);
      }
      document.body.style.overflow = '';
    }, 300);

    // Deactivate focus trap
    if (this.focusTrap) {
      this.focusTrap.deactivate();
      this.focusTrap = null;
    }

    this.isOpen = false;

    if (this.options.onClose) {
      this.options.onClose(this);
    }
  }

  setContent(content) {
    this.options.content = content;
    if (this.element) {
      const contentEl = this.element.querySelector('.bottom-sheet-content');
      if (contentEl) {
        contentEl.innerHTML = content;
      }
    }
  }

  destroy() {
    this.close();
    this.element = null;
    this.backdrop = null;
  }
}

/**
 * Create a bottom sheet
 */
export function createBottomSheet(options) {
  return new BottomSheet(options);
}

/**
 * Create a form bottom sheet
 */
export function createFormBottomSheet(title, fields, onSubmit) {
  const formHtml = `
    <form class="bottom-sheet-form">
      ${fields.map((field, index) => renderFormField(field, index)).join('')}
      <div class="bottom-sheet-form-actions">
        <button type="button" class="btn-cancel">Cancel</button>
        <button type="submit" class="btn-submit">Submit</button>
      </div>
    </form>
  `;

  const sheet = new BottomSheet({
    title: title,
    content: formHtml,
    height: '70vh',
    onOpen: (sheet) => {
      const form = sheet.element.querySelector('form');
      const cancelBtn = sheet.element.querySelector('.btn-cancel');
      
      cancelBtn.addEventListener('click', () => sheet.close());
      
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        if (onSubmit) {
          onSubmit(data, sheet);
        }
      });
    }
  });

  return sheet;
}

/**
 * Render form field
 */
function renderFormField(field, index) {
  const id = `field-${index}`;
  const required = field.required ? 'required' : '';

  switch (field.type) {
    case 'text':
    case 'number':
    case 'email':
      return `
        <div class="form-field">
          <label for="${id}">${field.label}${field.required ? '*' : ''}</label>
          <input 
            type="${field.type}" 
            id="${id}" 
            name="${field.name}"
            placeholder="${field.placeholder || ''}"
            value="${field.value || ''}"
            ${required}
          />
          ${field.help ? `<small class="field-help">${field.help}</small>` : ''}
        </div>
      `;
    
    case 'select':
      return `
        <div class="form-field">
          <label for="${id}">${field.label}${field.required ? '*' : ''}</label>
          <select id="${id}" name="${field.name}" ${required}>
            ${field.options.map(opt => 
              `<option value="${opt.value}" ${opt.value === field.value ? 'selected' : ''}>
                ${opt.label}
              </option>`
            ).join('')}
          </select>
          ${field.help ? `<small class="field-help">${field.help}</small>` : ''}
        </div>
      `;
    
    case 'textarea':
      return `
        <div class="form-field">
          <label for="${id}">${field.label}${field.required ? '*' : ''}</label>
          <textarea 
            id="${id}" 
            name="${field.name}"
            rows="${field.rows || 3}"
            placeholder="${field.placeholder || ''}"
            ${required}
          >${field.value || ''}</textarea>
          ${field.help ? `<small class="field-help">${field.help}</small>` : ''}
        </div>
      `;
    
    case 'checkbox':
      return `
        <div class="form-field form-field-checkbox">
          <label>
            <input 
              type="checkbox" 
              id="${id}" 
              name="${field.name}"
              ${field.checked ? 'checked' : ''}
              ${required}
            />
            <span>${field.label}${field.required ? '*' : ''}</span>
          </label>
          ${field.help ? `<small class="field-help">${field.help}</small>` : ''}
        </div>
      `;
    
    default:
      return '';
  }
}

/**
 * Create a picker bottom sheet (for selections)
 */
export function createPickerBottomSheet(title, items, onSelect) {
  const listHtml = `
    <ul class="bottom-sheet-picker-list">
      ${items.map((item, index) => `
        <li class="picker-item" data-index="${index}" data-value="${item.value}">
          ${item.icon ? `<span class="picker-icon">${item.icon}</span>` : ''}
          <span class="picker-label">${item.label}</span>
          ${item.description ? `<small class="picker-description">${item.description}</small>` : ''}
        </li>
      `).join('')}
    </ul>
  `;

  const sheet = new BottomSheet({
    title: title,
    content: listHtml,
    onOpen: (sheet) => {
      sheet.element.querySelectorAll('.picker-item').forEach(item => {
        item.addEventListener('click', () => {
          const index = parseInt(item.dataset.index);
          const value = item.dataset.value;
          
          if (onSelect) {
            onSelect(items[index], value, index, sheet);
          }
          
          sheet.close();
        });
      });
    }
  });

  return sheet;
}

/**
 * Inject bottom sheet styles
 */
export function injectBottomSheetStyles() {
  if (document.getElementById('bottom-sheet-styles')) return;

  const style = document.createElement('style');
  style.id = 'bottom-sheet-styles';
  style.textContent = `
    .bottom-sheet-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9998;
      opacity: 0;
      transition: opacity 0.3s;
    }

    .bottom-sheet-backdrop.open {
      opacity: 1;
    }

    .bottom-sheet {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      transform: translateY(100%);
      transition: transform 0.3s ease-out;
    }

    .bottom-sheet.open {
      transform: translateY(0);
    }

    .bottom-sheet.dragging {
      transition: none;
    }

    .bottom-sheet-handle {
      width: 40px;
      height: 4px;
      background: #ccc;
      border-radius: 2px;
      margin: 12px auto 8px;
      cursor: grab;
    }

    .bottom-sheet-handle:active {
      cursor: grabbing;
    }

    .bottom-sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #eee;
    }

    .bottom-sheet-title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .bottom-sheet-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: #666;
    }

    .bottom-sheet-close:hover {
      background: #f0f0f0;
    }

    .bottom-sheet-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .bottom-sheet-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .form-field label {
      font-weight: 500;
      color: #333;
    }

    .form-field input,
    .form-field select,
    .form-field textarea {
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 16px;
    }

    .form-field input:focus,
    .form-field select:focus,
    .form-field textarea:focus {
      outline: none;
      border-color: #007bff;
    }

    .field-help {
      color: #666;
      font-size: 0.875rem;
    }

    .form-field-checkbox label {
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }

    .bottom-sheet-form-actions {
      display: flex;
      gap: 12px;
      padding-top: 16px;
    }

    .bottom-sheet-form-actions button {
      flex: 1;
      padding: 14px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
    }

    .btn-cancel {
      background: #f0f0f0;
      color: #333;
    }

    .btn-submit {
      background: #007bff;
      color: white;
    }

    .bottom-sheet-picker-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .picker-item {
      padding: 16px;
      border-bottom: 1px solid #eee;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .picker-item:hover {
      background: #f8f9fa;
    }

    .picker-item:last-child {
      border-bottom: none;
    }

    .picker-icon {
      font-size: 1.5rem;
    }

    .picker-label {
      font-weight: 500;
      flex: 1;
    }

    .picker-description {
      display: block;
      color: #666;
      font-size: 0.875rem;
      margin-top: 4px;
    }

    @media (min-width: 768px) {
      .bottom-sheet {
        max-width: 600px;
        left: 50%;
        transform: translateX(-50%) translateY(100%);
      }

      .bottom-sheet.open {
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
}

// Auto-inject styles when module loads
if (typeof document !== 'undefined') {
  injectBottomSheetStyles();
}
