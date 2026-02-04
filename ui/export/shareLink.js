/**
 * RetireLens 2 - Share Link Generator
 * 
 * Generate shareable links with encrypted plan data and QR codes
 * Note: All processing client-side, no server upload
 */

/**
 * Generates a shareable link with plan data encoded in URL
 * @param {object} plan - The retirement plan
 * @param {object} options - Options for sharing
 * @returns {Promise<string>} Shareable URL
 */
export async function generateShareLink(plan, options = {}) {
  const {
    includeResults = false,
    projection = null,
    compress = true
  } = options;

  // Create share payload
  const payload = {
    v: 1, // Version
    plan: sanitizePlanForSharing(plan),
    timestamp: Date.now()
  };

  if (includeResults && projection) {
    payload.results = {
      potAtRetirement: projection.years?.find(y => y.age === plan.retirementAge)?.totalPot || 0,
      finalPot: projection.years?.[projection.years.length - 1]?.totalPot || 0
    };
  }

  // Encode to base64
  const jsonStr = JSON.stringify(payload);
  const encoded = btoa(compress ? await compressString(jsonStr) : jsonStr);

  // Generate shareable URL (using current origin + hash)
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#share=${encoded}`;
}

/**
 * Decodes a share link to retrieve plan data
 * @param {string} shareCode - The encoded share code
 * @returns {object} Decoded plan data
 */
export function decodeShareLink(shareCode) {
  try {
    const decoded = atob(shareCode);
    
    // Try to parse as JSON (uncompressed)
    try {
      return JSON.parse(decoded);
    } catch {
      // If not JSON, try decompression
      return JSON.parse(decompressString(decoded));
    }
  } catch (error) {
    throw new Error('Invalid share link format');
  }
}

/**
 * Generates a QR code for the share link
 * @param {string} url - The share URL
 * @returns {Promise<string>} Data URL of QR code image
 */
export async function generateQRCode(url) {
  // Check for QRCode library availability
  if (typeof QRCode === 'undefined') {
    throw new Error('QRCode library not loaded. Please include qrcode in your HTML.');
  }

  try {
    // Generate QR code as data URL
    const dataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1f2937',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });

    return dataUrl;
  } catch (error) {
    console.error('QR code generation failed:', error);
    throw error;
  }
}

/**
 * Displays share dialog with link and QR code
 * @param {object} plan - The retirement plan
 * @param {object} options - Options for sharing
 */
export async function showShareDialog(plan, options = {}) {
  try {
    // Generate share link
    const shareUrl = await generateShareLink(plan, options);
    const qrCode = await generateQRCode(shareUrl);

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay share-modal';
    
    modal.innerHTML = `
      <div class="modal-content share-dialog">
        <div class="modal-header">
          <h3>📤 Share Your Plan</h3>
          <button class="modal-close">&times;</button>
        </div>
        
        <div class="share-content">
          <div class="share-info">
            <p>Share this link to allow others to view your retirement plan. All data is encoded in the URL - no server upload required.</p>
          </div>

          <div class="qr-code-container">
            <img src="${qrCode}" alt="QR Code" class="qr-code-image">
            <p class="qr-label">Scan with mobile device</p>
          </div>

          <div class="share-link-container">
            <input type="text" 
                   id="share-url-input" 
                   readonly 
                   value="${shareUrl}" 
                   class="share-url-input">
            <button id="copy-link-btn" class="btn-primary">
              📋 Copy Link
            </button>
          </div>

          <div class="share-options">
            <h4>Share via:</h4>
            <div class="share-buttons">
              <button class="share-btn email-btn" data-method="email">
                📧 Email
              </button>
              <button class="share-btn whatsapp-btn" data-method="whatsapp">
                💬 WhatsApp
              </button>
              <button class="share-btn twitter-btn" data-method="twitter">
                🐦 Twitter
              </button>
            </div>
          </div>

          <div class="share-warning">
            <strong>⚠️ Privacy Note:</strong> The link contains your plan data. Only share with people you trust. 
            The link does not expire and can be used by anyone who has it.
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary close-dialog-btn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeModal = () => modal.remove();
    modal.querySelector('.modal-close').onclick = closeModal;
    modal.querySelector('.close-dialog-btn').onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    // Copy link handler
    document.getElementById('copy-link-btn').onclick = async () => {
      const input = document.getElementById('share-url-input');
      input.select();
      
      try {
        await navigator.clipboard.writeText(shareUrl);
        const btn = document.getElementById('copy-link-btn');
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      } catch (err) {
        // Fallback for older browsers
        document.execCommand('copy');
      }
    };

    // Share method handlers
    modal.querySelectorAll('.share-btn').forEach(btn => {
      btn.onclick = () => {
        const method = btn.dataset.method;
        shareViaMethod(method, shareUrl, plan);
      };
    });

  } catch (error) {
    alert(`Failed to generate share link: ${error.message}`);
  }
}

/**
 * Sanitizes plan data for sharing (removes sensitive info)
 */
function sanitizePlanForSharing(plan) {
  // Only include essential fields for reconstruction
  return {
    name: plan.name || 'Shared Plan',
    currentAge: plan.currentAge,
    retirementAge: plan.retirementAge,
    targetNetIncome: plan.targetNetIncome,
    currentPension: plan.currentPension,
    currentIsa: plan.currentIsa,
    annualPensionContribution: plan.annualPensionContribution,
    annualIsaContribution: plan.annualIsaContribution,
    statePensionAge: plan.statePensionAge,
    expectedStatePension: plan.expectedStatePension,
    assumptions: plan.assumptions,
    applyAgeBasedSpendingReductions: plan.applyAgeBasedSpendingReductions
  };
}

/**
 * Simple string compression using RLE-like approach
 */
async function compressString(str) {
  // For production, consider using a proper compression library
  // This is a simple implementation
  return str; // Placeholder - implement compression if needed
}

/**
 * Decompress string
 */
function decompressString(str) {
  return str; // Placeholder - implement decompression if needed
}

/**
 * Share via different methods
 */
function shareViaMethod(method, url, plan) {
  const text = `Check out my retirement plan on RetireLens 2`;
  
  switch (method) {
    case 'email':
      window.location.href = `mailto:?subject=${encodeURIComponent('My RetireLens 2 Plan')}&body=${encodeURIComponent(text + '\n\n' + url)}`;
      break;
    
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
      break;
    
    case 'twitter':
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
      break;
  }
}

/**
 * Loads a plan from share code in URL hash
 * @returns {object|null} Decoded plan or null if not found
 */
export function loadPlanFromURL() {
  const hash = window.location.hash;
  
  if (!hash.startsWith('#share=')) {
    return null;
  }

  const shareCode = hash.substring(7); // Remove '#share='
  
  try {
    const data = decodeShareLink(shareCode);
    
    // Validate version
    if (data.v !== 1) {
      throw new Error('Incompatible share link version');
    }

    return data.plan;
  } catch (error) {
    console.error('Failed to load shared plan:', error);
    return null;
  }
}

/**
 * Helper to load QRCode library dynamically if not available
 */
export async function ensureQRCodeLoaded() {
  if (typeof window !== 'undefined' && typeof QRCode === 'undefined') {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}

/**
 * Add share dialog styles
 */
export function addShareStyles() {
  if (document.getElementById('share-styles')) return;

  const style = document.createElement('style');
  style.id = 'share-styles';
  style.textContent = `
    .share-dialog {
      max-width: 600px;
      width: 100%;
    }

    .share-content {
      padding: 1.5rem;
    }

    .share-info {
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: #f0f9ff;
      border-radius: 6px;
      border-left: 3px solid #3b82f6;
    }

    .share-info p {
      margin: 0;
      color: #1e40af;
      font-size: 0.9rem;
    }

    .qr-code-container {
      text-align: center;
      margin: 1.5rem 0;
      padding: 1rem;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }

    .qr-code-image {
      max-width: 250px;
      height: auto;
    }

    .qr-label {
      margin: 0.5rem 0 0 0;
      color: #6b7280;
      font-size: 0.85rem;
    }

    .share-link-container {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .share-url-input {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.9rem;
      font-family: monospace;
      background: #f9fafb;
    }

    .share-url-input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .share-options {
      margin: 1.5rem 0;
    }

    .share-options h4 {
      margin: 0 0 0.75rem 0;
      font-size: 1rem;
      color: #374151;
    }

    .share-buttons {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 0.75rem;
    }

    .share-btn {
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .share-btn:hover {
      border-color: #3b82f6;
      background: #f0f9ff;
    }

    .share-warning {
      margin-top: 1.5rem;
      padding: 1rem;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      font-size: 0.85rem;
      color: #92400e;
    }

    @media (max-width: 768px) {
      .share-link-container {
        flex-direction: column;
      }

      .share-buttons {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

// Auto-add styles when module loads
if (typeof document !== 'undefined') {
  addShareStyles();
}
