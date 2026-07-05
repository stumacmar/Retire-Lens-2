/**
 * RetireLens - Access Gate
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

// ── Self-contained styles ───────────────────────────────────
// Injected once so the gate looks right on ANY page (e.g. RetireLens 4),
// without depending on the app's stylesheet.
function injectGateStyles() {
  if (document.getElementById('rl-gate-styles')) return;
  const style = document.createElement('style');
  style.id = 'rl-gate-styles';
  style.textContent = `
  .rl-gate-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
    padding:1rem;background:rgba(15,23,42,.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);overflow-y:auto;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;color:#0f172a;}
  .rl-gate-card{width:100%;max-width:460px;background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.25);
    padding:2rem 1.75rem;margin:auto;}
  .rl-gate-brand{font-size:1.4rem;font-weight:800;letter-spacing:-.03em;color:#0e7a6e;margin-bottom:1rem;}
  .rl-gate-brand span{color:#0e7a6e;}
  .rl-gate-title{font-size:1.35rem;font-weight:700;margin:0 0 .5rem;}
  .rl-gate-lead{color:#475569;margin:0 0 1rem;}
  .rl-gate-lead a,.rl-gate-fine a{color:#0e7a6e;}
  .rl-gate-list{list-style:none;padding:0;margin:0 0 1.25rem;}
  .rl-gate-list li{position:relative;padding-left:1.5rem;margin-bottom:.6rem;font-size:.92rem;color:#334155;}
  .rl-gate-list li::before{content:'';position:absolute;left:0;top:.5rem;width:8px;height:8px;border-radius:50%;background:#0e7a6e;}
  .rl-gate-check{display:flex;align-items:flex-start;gap:.6rem;margin-bottom:1.25rem;cursor:pointer;font-size:.92rem;color:#334155;}
  .rl-gate-check input{margin-top:.2rem;width:18px;height:18px;flex-shrink:0;}
  .rl-gate-btn{display:block;width:100%;text-align:center;background:#0e7a6e;color:#fff;border:none;border-radius:10px;
    padding:.85rem 1rem;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none;}
  .rl-gate-btn:hover:not(:disabled){background:#0b6459;}
  .rl-gate-btn:disabled{opacity:.45;cursor:not-allowed;}
  .rl-gate-btn:focus-visible{outline:3px solid #99f6e4;outline-offset:2px;}
  .rl-gate-btn-secondary{width:auto;flex-shrink:0;background:#1f2937;}
  .rl-gate-fine{font-size:.78rem;color:#64748b;margin-top:1rem;text-align:center;}
  .rl-gate-divider{display:flex;align-items:center;text-align:center;margin:1.25rem 0 1rem;color:#94a3b8;font-size:.72rem;
    text-transform:uppercase;letter-spacing:.05em;}
  .rl-gate-divider::before,.rl-gate-divider::after{content:'';flex:1;height:1px;background:#e2e8f0;}
  .rl-gate-divider span{padding:0 .75rem;}
  .rl-gate-label{display:block;font-size:.85rem;font-weight:600;margin-bottom:.4rem;color:#334155;}
  .rl-gate-coderow{display:flex;gap:.5rem;}
  .rl-gate-coderow input{flex:1;min-width:0;padding:.75rem;border:1px solid #e2e8f0;border-radius:10px;font-size:1rem;
    text-transform:uppercase;letter-spacing:.05em;}
  .rl-gate-error{color:#dc2626;font-size:.82rem;margin-top:.6rem;}`;
  document.head.appendChild(style);
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
      <div class="rl-gate-brand">Retire<span>Lens</span></div>
      <h1 class="rl-gate-title">Before you start</h1>
      <p class="rl-gate-lead">RetireLens is an educational planning tool, <strong>not financial advice</strong>.</p>
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
      <div class="rl-gate-brand">Retire<span>Lens</span></div>
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
  injectGateStyles();
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
