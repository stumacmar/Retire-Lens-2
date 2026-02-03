/**
 * RetireLens 2 - Touch Gesture Handler
 * 
 * Mobile-friendly swipe gestures for navigation
 */

const MIN_SWIPE_DISTANCE = 50;
const MAX_VERTICAL_DEVIATION = 100;
const SWIPE_TIMEOUT = 300;

/**
 * Touch gesture handler class
 */
export class TouchGestureHandler {
  constructor(element, options = {}) {
    this.element = element || document.body;
    this.options = {
      minSwipeDistance: options.minSwipeDistance || MIN_SWIPE_DISTANCE,
      maxVerticalDeviation: options.maxVerticalDeviation || MAX_VERTICAL_DEVIATION,
      swipeTimeout: options.swipeTimeout || SWIPE_TIMEOUT,
      ...options
    };

    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchEndX = 0;
    this.touchEndY = 0;
    this.touchStartTime = 0;

    this.onSwipeLeft = null;
    this.onSwipeRight = null;
    this.onSwipeUp = null;
    this.onSwipeDown = null;

    this.boundHandleTouchStart = this.handleTouchStart.bind(this);
    this.boundHandleTouchMove = this.handleTouchMove.bind(this);
    this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);

    this.init();
  }

  init() {
    this.element.addEventListener('touchstart', this.boundHandleTouchStart, { passive: true });
    this.element.addEventListener('touchmove', this.boundHandleTouchMove, { passive: true });
    this.element.addEventListener('touchend', this.boundHandleTouchEnd, { passive: true });
  }

  handleTouchStart(e) {
    this.touchStartX = e.changedTouches[0].screenX;
    this.touchStartY = e.changedTouches[0].screenY;
    this.touchStartTime = Date.now();
  }

  handleTouchMove(e) {
    this.touchEndX = e.changedTouches[0].screenX;
    this.touchEndY = e.changedTouches[0].screenY;
  }

  handleTouchEnd(e) {
    this.touchEndX = e.changedTouches[0].screenX;
    this.touchEndY = e.changedTouches[0].screenY;

    const elapsedTime = Date.now() - this.touchStartTime;
    if (elapsedTime > this.options.swipeTimeout) {
      return;
    }

    this.handleGesture();
  }

  handleGesture() {
    const deltaX = this.touchEndX - this.touchStartX;
    const deltaY = this.touchEndY - this.touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Horizontal swipe
    if (absDeltaX > this.options.minSwipeDistance && 
        absDeltaY < this.options.maxVerticalDeviation) {
      
      if (deltaX > 0) {
        this.triggerSwipeRight();
      } else {
        this.triggerSwipeLeft();
      }
    }
    // Vertical swipe
    else if (absDeltaY > this.options.minSwipeDistance && 
             absDeltaX < this.options.maxVerticalDeviation) {
      
      if (deltaY > 0) {
        this.triggerSwipeDown();
      } else {
        this.triggerSwipeUp();
      }
    }
  }

  triggerSwipeLeft() {
    if (this.onSwipeLeft) {
      this.onSwipeLeft({
        startX: this.touchStartX,
        startY: this.touchStartY,
        endX: this.touchEndX,
        endY: this.touchEndY,
        distance: Math.abs(this.touchEndX - this.touchStartX)
      });
    }
  }

  triggerSwipeRight() {
    if (this.onSwipeRight) {
      this.onSwipeRight({
        startX: this.touchStartX,
        startY: this.touchStartY,
        endX: this.touchEndX,
        endY: this.touchEndY,
        distance: Math.abs(this.touchEndX - this.touchStartX)
      });
    }
  }

  triggerSwipeUp() {
    if (this.onSwipeUp) {
      this.onSwipeUp({
        startX: this.touchStartX,
        startY: this.touchStartY,
        endX: this.touchEndX,
        endY: this.touchEndY,
        distance: Math.abs(this.touchEndY - this.touchStartY)
      });
    }
  }

  triggerSwipeDown() {
    if (this.onSwipeDown) {
      this.onSwipeDown({
        startX: this.touchStartX,
        startY: this.touchStartY,
        endX: this.touchEndX,
        endY: this.touchEndY,
        distance: Math.abs(this.touchEndY - this.touchStartY)
      });
    }
  }

  destroy() {
    this.element.removeEventListener('touchstart', this.boundHandleTouchStart);
    this.element.removeEventListener('touchmove', this.boundHandleTouchMove);
    this.element.removeEventListener('touchend', this.boundHandleTouchEnd);
  }
}

/**
 * Initialize navigation gestures
 * Swipe right = back, Swipe left = next
 */
export function initNavigationGestures(onBack, onNext) {
  const gestureHandler = new TouchGestureHandler(document.body);
  
  gestureHandler.onSwipeRight = (gesture) => {
    if (onBack) {
      onBack(gesture);
    }
  };
  
  gestureHandler.onSwipeLeft = (gesture) => {
    if (onNext) {
      onNext(gesture);
    }
  };
  
  return gestureHandler;
}

/**
 * Add visual feedback for swipe gestures
 */
export function addSwipeIndicator(direction) {
  const indicator = document.createElement('div');
  indicator.className = `swipe-indicator swipe-${direction}`;
  indicator.innerHTML = direction === 'left' ? '←' : '→';
  
  document.body.appendChild(indicator);
  
  setTimeout(() => {
    indicator.classList.add('active');
  }, 10);
  
  setTimeout(() => {
    indicator.classList.remove('active');
    setTimeout(() => indicator.remove(), 300);
  }, 200);
}

/**
 * Detect if device supports touch
 */
export function isTouchDevice() {
  return ('ontouchstart' in window) ||
         (navigator.maxTouchPoints > 0) ||
         (navigator.msMaxTouchPoints > 0);
}

/**
 * Inject swipe indicator styles
 */
export function injectSwipeStyles() {
  if (document.getElementById('swipe-styles')) return;

  const style = document.createElement('style');
  style.id = 'swipe-styles';
  style.textContent = `
    .swipe-indicator {
      position: fixed;
      top: 50%;
      font-size: 3rem;
      color: rgba(255, 255, 255, 0.8);
      background: rgba(0, 0, 0, 0.5);
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      pointer-events: none;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s, transform 0.3s;
      transform: translateY(-50%) scale(0.8);
    }

    .swipe-indicator.swipe-left {
      left: 20px;
    }

    .swipe-indicator.swipe-right {
      right: 20px;
    }

    .swipe-indicator.active {
      opacity: 1;
      transform: translateY(-50%) scale(1);
    }
  `;
  document.head.appendChild(style);
}

// Auto-inject styles when module loads
if (typeof document !== 'undefined') {
  injectSwipeStyles();
}
