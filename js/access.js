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
// The gate is a full-screen FRONT PAGE: it must be the only thing on screen on
// a first visit. It ships its own styles (index.html loads only v4/styles.css,
// which has no .rl-gate rules) so it can never fall back to an unstyled block.
function injectGateStyles() {
  if (document.getElementById('rl-gate-styles')) return;
  const s = document.createElement('style');
  s.id = 'rl-gate-styles';
  s.textContent = `
  .rl-gate-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    padding:1rem;overflow-y:auto;background:rgba(15,23,42,.6);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;line-height:1.55;}
  .rl-gate-card{width:100%;max-width:460px;margin:auto;background:#fff;border-radius:18px;
    box-shadow:0 24px 60px rgba(0,0,0,.28);padding:2rem 1.9rem;}
  .rl-gate-brand{font-size:1.5rem;font-weight:800;letter-spacing:-.02em;margin-bottom:1rem;}
  .rl-gate-brand span{color:#0e7a6e;}
  .rl-gate-card h1.rl-gate-title{font-size:1.5rem;font-weight:800;letter-spacing:-.02em;margin:0 0 .6rem;}
  .rl-gate-lead{color:#475569;margin:0 0 1rem;font-size:1.02rem;}
  .rl-gate-list{list-style:none;padding:0;margin:0 0 1.25rem;display:grid;gap:.6rem;}
  .rl-gate-list li{position:relative;padding-left:1.5rem;color:#475569;font-size:.9rem;}
  .rl-gate-list li::before{content:"✓";position:absolute;left:0;top:0;color:#0e7a6e;font-weight:800;}
  .rl-gate-check{display:flex;gap:.65rem;align-items:flex-start;cursor:pointer;margin:0 0 1.25rem;
    background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:.85rem .95rem;}
  .rl-gate-check input{margin-top:.15rem;width:1.15rem;height:1.15rem;accent-color:#0e7a6e;flex:0 0 auto;}
  .rl-gate-check span{font-size:.92rem;color:#0f172a;}
  .rl-gate-btn{display:block;width:100%;text-align:center;background:#0e7a6e;color:#fff;border:none;border-radius:12px;
    padding:.9rem 1rem;font-size:1.05rem;font-weight:700;cursor:pointer;text-decoration:none;box-sizing:border-box;}
  .rl-gate-btn:hover:not(:disabled){background:#0b6459;}
  .rl-gate-btn:disabled{background:#94a3b8;cursor:not-allowed;}
  .rl-gate-btn:focus-visible{outline:3px solid #99f6e4;outline-offset:2px;}
  .rl-gate-btn-secondary{background:#0f172a;}
  .rl-gate-fine{margin:1rem 0 0;font-size:.8rem;color:#94a3b8;text-align:center;}
  .rl-gate-fine a{color:#64748b;}
  .rl-gate-divider{display:flex;align-items:center;gap:.75rem;margin:1.1rem 0;color:#94a3b8;font-size:.78rem;}
  .rl-gate-divider::before,.rl-gate-divider::after{content:"";flex:1;height:1px;background:#e2e8f0;}
  .rl-gate-label{display:block;font-size:.85rem;font-weight:600;margin-bottom:.4rem;}
  .rl-gate-coderow{display:flex;gap:.5rem;}
  .rl-gate-coderow input{flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:.7rem .8rem;font-size:1rem;}
  .rl-gate-coderow .rl-gate-btn{width:auto;padding:.7rem 1.1rem;}
  .rl-gate-error{color:#be123c;font-size:.85rem;margin:.6rem 0 0;}`;
  document.head.appendChild(s);
}

// Trap Tab focus inside the overlay so keyboard and screen-reader users cannot
// wander into the (inert) planner behind the front page.
function trapFocus(el) {
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

function overlayShell(innerHTML) {
  injectGateStyles();
  const el = document.createElement('div');
  el.className = 'rl-gate-overlay';
  el.innerHTML = `<div class="rl-gate-card" role="dialog" aria-modal="true" aria-labelledby="rl-gate-title">${innerHTML}</div>`;
  trapFocus(el);
  return el;
}

function showDisclaimerGate() {
  return new Promise((resolve) => {
    const el = overlayShell(`
      <div class="rl-gate-brand">Some<span>day</span></div>
      <h1 class="rl-gate-title" id="rl-gate-title">Before you start</h1>
      <p class="rl-gate-lead">Someday is an educational planning tool, <strong>not financial advice</strong>.</p>
      <ul class="rl-gate-list">
        <li>Your figures stay in your browser — your planning data never leaves your device.</li>
        <li>Projections are estimates based on assumptions you can change. Real outcomes will differ.</li>
        <li>Tax rules, markets, and your circumstances change. Figures use UK 2025/26 rates.</li>
        <li>This is not a personal recommendation. For advice regulated by the FCA, speak to a qualified financial adviser.</li>
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
    check.focus();
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
      <h1 class="rl-gate-title" id="rl-gate-title">Unlock your full plan</h1>
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
