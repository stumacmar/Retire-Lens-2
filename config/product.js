/**
 * Someday - Product & Commercial Configuration
 *
 * Single source of truth for branding, donations, pricing, the access gate,
 * and external links. Everything a non-developer needs to change to go live
 * lives here. See LAUNCH.md for the step-by-step launch checklist.
 *
 * DEFAULT MODEL: free to use, with a "pay what you think it's worth" donation
 * ask (`model: 'donation'`). The fixed-fee paywall below is an optional
 * alternative, off unless you set `model: 'paywall'` and `paywallEnabled: true`.
 *
 * IMPORTANT: This is a 100% client-side static app with no backend, so the
 * paywall is a "soft" gate — it deters casual users and supports honest
 * buyers, but a determined user can bypass it. That is the standard trade-off
 * for indie static tools. To harden it, add a serverless license check
 * (see LAUNCH.md → "Hardening the paywall").
 */

export const PRODUCT = Object.freeze({
  // ── Branding ──────────────────────────────────────────────
  name: 'Someday',
  tagline: 'See the day you can afford to stop.',
  domain: 'someday.money',               // change here + in the CNAME file
  supportEmail: 'hello@someday.money',    // shown on legal/how-to pages

  // ── Monetisation model ────────────────────────────────────
  // 'donation' — free to use, with a "pay what you think it's worth" ask (default)
  // 'paywall'  — require an access code to use the planner
  model: 'donation',

  // ── Donations (pay what you think it's worth) ─────────────
  // Paste a Buy Me a Coffee / Ko-fi / PayPal.me / Stripe donation link here.
  // Shown on the homepage and after results. Empty = the buttons are hidden.
  donationLink: '',                      // e.g. 'https://buymeacoffee.com/retirelens'
  donationHeadline: 'Pay what you think it’s worth',
  donationBlurb: 'Someday is free. I built it because I couldn’t find one I understood. ' +
    'If it helped you, a small contribution funds the next idea — no pressure, no paywall.',

  // ── Pricing (only used when model === 'paywall') ──────────
  price: '£4.99',
  priceModel: 'one-time',                // 'one-time' | 'subscription'
  currency: 'GBP',

  // ── Payment ───────────────────────────────────────────────
  // Paste your Stripe Payment Link (or Gumroad/Ko-fi URL) here.
  // While this is empty OR paywallEnabled is false, the app stays fully open.
  stripePaymentLink: '',                 // e.g. 'https://buy.stripe.com/xxxxxxxx'

  // Master switch. Keep FALSE until your payment link + codes are ready,
  // then flip to TRUE to require an access code to use the planner.
  paywallEnabled: false,

  // ── Access codes ──────────────────────────────────────────
  // Codes are validated by format + checksum (see js/access.js). Generating
  // a valid code is a one-liner documented in LAUNCH.md. This keeps the code
  // list out of the shipped source. A short optional allow-list below can
  // hold hand-issued codes (e.g. for reviewers, press, refunds).
  extraValidCodes: Object.freeze([
    // 'RL-DEMO-1234'  // example; add hand-issued codes here
  ]),

  // ── Legal ─────────────────────────────────────────────────
  // Disclaimer must be accepted once before the planner can be used.
  disclaimerVersion: '1.0',              // bump to force re-acceptance
  companyName: 'Someday',                // trading name shown on legal pages
  jurisdiction: 'England & Wales',
  // REQUIRED before charging: UK consumer law requires a real trader identity
  // and contact address shown before purchase. Fill the bracketed fields in
  // legal.html (section 2 → "Who you're dealing with"). See LAUNCH.md Step 7.
  traderIdentityComplete: false,
});

// localStorage keys (namespaced to avoid collisions)
export const STORAGE_KEYS = Object.freeze({
  disclaimerAccepted: 'rl_disclaimer_accepted_v',
  accessGranted: 'rl_access_granted',
  accessCode: 'rl_access_code',
});
