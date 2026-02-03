/**
 * RetireLens 2 - Spotlight Effect for Tutorial
 * 
 * Visual overlay with spotlight highlighting specific elements
 */

/**
 * Spotlight class
 */
export class Spotlight {
  constructor(targetElement, options = {}) {
    this.target = targetElement;
    this.padding = options.padding || 10;
    this.borderRadius = options.borderRadius || 8;
    this.element = null;
    this.create();
  }

  create() {
    this.element = document.createElement('div');
    this.element.className = 'spotlight-overlay';
    this.element.setAttribute('aria-hidden', 'true');
    
    this.update();
    document.body.appendChild(this.element);

    // Update on window resize
    this.resizeHandler = () => this.update();
    window.addEventListener('resize', this.resizeHandler);
    
    // Update on scroll
    this.scrollHandler = () => this.update();
    window.addEventListener('scroll', this.scrollHandler, true);
  }

  update() {
    if (!this.target || !this.element) return;

    const rect = this.target.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    const top = rect.top + scrollTop - this.padding;
    const left = rect.left + scrollLeft - this.padding;
    const width = rect.width + (this.padding * 2);
    const height = rect.height + (this.padding * 2);

    // Create SVG mask for spotlight effect
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none';

    const defs = document.createElementNS(svgNS, 'defs');
    const mask = document.createElementNS(svgNS, 'mask');
    mask.setAttribute('id', 'spotlight-mask');

    // White background (visible area)
    const bgRect = document.createElementNS(svgNS, 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', 'white');
    mask.appendChild(bgRect);

    // Black cutout (spotlight area)
    const cutout = document.createElementNS(svgNS, 'rect');
    cutout.setAttribute('x', left.toString());
    cutout.setAttribute('y', top.toString());
    cutout.setAttribute('width', width.toString());
    cutout.setAttribute('height', height.toString());
    cutout.setAttribute('rx', this.borderRadius.toString());
    cutout.setAttribute('fill', 'black');
    mask.appendChild(cutout);

    defs.appendChild(mask);
    svg.appendChild(defs);

    // Apply mask to overlay
    const overlayRect = document.createElementNS(svgNS, 'rect');
    overlayRect.setAttribute('x', '0');
    overlayRect.setAttribute('y', '0');
    overlayRect.setAttribute('width', '100%');
    overlayRect.setAttribute('height', '100%');
    overlayRect.setAttribute('fill', 'rgba(0, 0, 0, 0.7)');
    overlayRect.setAttribute('mask', 'url(#spotlight-mask)');
    svg.appendChild(overlayRect);

    // Clear and update element
    this.element.innerHTML = '';
    this.element.appendChild(svg);

    // Add highlight border around spotlight
    const highlight = document.createElement('div');
    highlight.className = 'spotlight-highlight';
    highlight.style.position = 'absolute';
    highlight.style.top = `${top}px`;
    highlight.style.left = `${left}px`;
    highlight.style.width = `${width}px`;
    highlight.style.height = `${height}px`;
    highlight.style.borderRadius = `${this.borderRadius}px`;
    highlight.style.border = '2px solid rgba(255, 255, 255, 0.8)';
    highlight.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.5)';
    highlight.style.pointerEvents = 'none';
    highlight.style.animation = 'spotlight-pulse 2s infinite';
    this.element.appendChild(highlight);

    // Scroll element into view if needed
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      this.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  destroy() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler, true);
    }
  }
}

/**
 * Create spotlight for element
 */
export function createSpotlight(targetElement, options) {
  return new Spotlight(targetElement, options);
}

/**
 * Add spotlight CSS if not already present
 */
export function injectSpotlightStyles() {
  if (document.getElementById('spotlight-styles')) return;

  const style = document.createElement('style');
  style.id = 'spotlight-styles';
  style.textContent = `
    .spotlight-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9998;
      pointer-events: none;
    }

    @keyframes spotlight-pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }
  `;
  document.head.appendChild(style);
}

// Auto-inject styles when module loads
if (typeof document !== 'undefined') {
  injectSpotlightStyles();
}
