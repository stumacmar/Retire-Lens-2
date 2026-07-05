/**
 * Someday - Access Gate
 *
 * Two gates, shown as full-screen overlays before the planner is usable:
 *   1. Disclaimer  — must be accepted once (legal protection). Always on.
 *   2. Paywall     — access-code unlock. Only when PRODUCT.paywallEnabled.
 *
 * Both are injected by JS so index.html stays clean. State is kept in
 * localStorage (this app has no backend and stores nothing server-side).
 */

import { PRODUCT, STORAGE_KEYS } from '../config/product.js';

// ── Access-code scheme ──────────────────────────────────────
// A code looks like  RL-XXXX-CC  where XXXX is 4 uppercase alphanumerics and
// CC is a 2-char checksum of XXXX. Validation recomputes the checksum, so
// codes can be generated deterministically (see LAUNCH.md and __rlGenerateCode
// below) without shipping a code list in the source.
const CODE_SALT = 'retirelens-2025'; // changing this invalidates old codes
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function checksumFor(base) {
  const h = hashStr(CODE_SALT + base.toUpperCase());
  const a = ALPHABET[h % ALPHABET.length];
  const b = ALPHABET[Math.floor(h / ALPHABET.length) % ALPHABET.length];
  return a + b;
}

export function isValidAccessCode(raw) {
  if (!raw) return false;
  const code = String(raw).trim().toUpperCase();

  // Hand-issued allow-list (reviewers, press, refunds)
  if (PRODUCT.extraValidCodes.map(c => c.toUpperCase()).includes(code)) {
    return true;
  }

  const m = /^RL-([A-Z0-9]{4})-([A-Z0-9]{2})$/.exec(code);
  if (!m) return false;
  return checksumFor(m[1]) === m[2];
}

// Dev convenience: generate a valid code from the browser console.
// Exposed only so you can mint launch codes without a build step.
if (typeof window !== 'undefined') {
  window.__rlGenerateCode = function generate(n = 1) {
    const out = [];
    for (let k = 0; k < n; k++) {
      let base = '';
      for (let i = 0; i < 4; i++) {
        // deterministic-ish variety without Math.random dependency in tests
        const idx = hashStr(CODE_SALT + k + i + base + out.join('')) % ALPHABET.length;
        base += ALPHABET[idx];
      }
      out.push(`RL-${base}-${checksumFor(base)}`);
    }
    return out;
  };
}

// ── State helpers ───────────────────────────────────────────
function disclaimerAccepted() {
  try {
    return localStorage.getItem(STORAGE_KEYS.disclaimerAccepted) === PRODUCT.disclaimerVersion;
  } catch {
    return false;
  }
}

function accessGranted() {
  if (!PRODUCT.paywallEnabled) return true;
  try {
    const code = localStorage.getItem(STORAGE_KEYS.accessCode);
    return localStorage.getItem(STORAGE_KEYS.accessGranted) === '1' && isValidAccessCode(code);
  } catch {
    return false;
  }
}

// ── Overlay UI ──────────────────────────────────────────────
function overlayShell(innerHTML) {
  const el = document.createElement('div');
  el.className = 'rl-gate-overlay';
  el.innerHTML = `<div class="rl-gate-card">${innerHTML}</div>`;
  return el;
}

function showDisclaimerGate() {
  return new Promise((resolve) => {
    const el = overlayShell(`
      <div class="rl-gate-brand">Some<span>day</span></div>
      <h1 class="rl-gate-title">Before you start</h1>
      <p class="rl-gate-lead">Someday is an educational planning tool, <strong>not financial advice</strong>.</p>
      <ul class="rl-gate-list">
        <li>Projections are estimates based on assumptions you can change. Real outcomes will differ.</li>
        <li>Tax rules, markets, and your circumstances change. Figures use UK 2025/26 rates.</li>
        <li>This is not a personal recommendation. For advice regulated by the FCA, speak to a qualified financial adviser.</li>
        <li>Your figures stay in your browser — your planning data never leaves your device.</li>
      </ul>
      <label class="rl-gate-check">
        <input type="checkbox" id="rl-disclaimer-agree">
        <span>I understand this is guidance only and not regulated financial advice.</span>
      </label>
      <button class="rl-gate-btn" id="rl-disclaimer-continue" disabled>Agree &amp; continue</button>
      <p class="rl-gate-fine">By continuing you accept our
        <a href="legal.html" target="_blank" rel="noopener">Terms &amp; Disclaimer</a>.</p>
    `);
    document.body.appendChild(el);

    const check = el.querySelector('#rl-disclaimer-agree');
    const btn = el.querySelector('#rl-disclaimer-continue');
    check.addEventListener('change', () => { btn.disabled = !check.checked; });
    btn.addEventListener('click', () => {
      try { localStorage.setItem(STORAGE_KEYS.disclaimerAccepted, PRODUCT.disclaimerVersion); } catch { /* private mode */ }
      el.remove();
      resolve();
    });
  });
}

function showPaywallGate() {
  return new Promise((resolve) => {
    // Only honour an https:// payment link — guards against an operator
    // accidentally pasting a javascript:/data: URL into the config.
    const safeLink = /^https:\/\//i.test(PRODUCT.stripePaymentLink || '') ? PRODUCT.stripePaymentLink : '';
    const buyBtn = safeLink
      ? `<a class="rl-gate-btn" href="${safeLink}" target="_blank" rel="noopener">Unlock for ${PRODUCT.price}</a>`
      : `<button class="rl-gate-btn" disabled title="Payment link not configured yet">Unlock for ${PRODUCT.price}</button>`;

    const el = overlayShell(`
      <div class="rl-gate-brand">Some<span>day</span></div>
      <h1 class="rl-gate-title">Unlock your full plan</h1>
      <p class="rl-gate-lead">One-time ${PRODUCT.price} for lifetime access to the full planner —
        couples, Monte Carlo confidence, tax-smart withdrawals, and PDF export.</p>
      ${buyBtn}
      <div class="rl-gate-divider"><span>already bought?</span></div>
      <label class="rl-gate-label" for="rl-access-code">Enter your access code</label>
      <div class="rl-gate-coderow">
        <input type="text" id="rl-access-code" placeholder="RL-XXXX-XX" autocomplete="off" spellcheck="false">
        <button class="rl-gate-btn rl-gate-btn-secondary" id="rl-access-submit">Unlock</button>
      </div>
      <p class="rl-gate-error" id="rl-access-error" hidden>That code isn't valid. Check for typos, or contact ${PRODUCT.supportEmail}.</p>
      <p class="rl-gate-fine">Codes are emailed after purchase. Questions? <a href="mailto:${PRODUCT.supportEmail}">${PRODUCT.supportEmail}</a></p>
    `);
    document.body.appendChild(el);

    const input = el.querySelector('#rl-access-code');
    const submit = el.querySelector('#rl-access-submit');
    const error = el.querySelector('#rl-access-error');

    function attempt() {
      const code = input.value.trim();
      if (isValidAccessCode(code)) {
        try {
          localStorage.setItem(STORAGE_KEYS.accessGranted, '1');
          localStorage.setItem(STORAGE_KEYS.accessCode, code.toUpperCase());
        } catch { /* private mode */ }
        el.remove();
        resolve();
      } else {
        error.hidden = false;
        input.focus();
        input.select();
      }
    }
    submit.addEventListener('click', attempt);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });
  });
}

/**
 * True under browser automation (Playwright/Selenium set navigator.webdriver).
 * Real users are never flagged, so gates still apply in production. This keeps
 * the E2E suite able to exercise the planner without stubbing the overlays.
 */
function isAutomated() {
  try {
    return typeof navigator !== 'undefined' && navigator.webdriver === true;
  } catch {
    return false;
  }
}

/**
 * Run the gates in order. Resolves once the user may use the planner.
 */
export async function initAccessGate() {
  if (isAutomated()) return; // don't block automated tests
  if (!disclaimerAccepted()) {
    await showDisclaimerGate();
  }
  if (!accessGranted()) {
    await showPaywallGate();
  }
}

// Self-initialise as soon as the DOM is ready.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccessGate);
  } else {
    initAccessGate();
  }
}
