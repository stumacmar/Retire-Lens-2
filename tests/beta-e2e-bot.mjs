/**
 * RetireLens - Virtual Beta Testers (E2E bot)
 *
 * Drives the real planner UI end-to-end for several personas, entering data as
 * a user would, and records every issue: console errors, page errors, screens
 * that fail to advance, and whether results actually render. Writes a JSON
 * summary that generate-beta-report.mjs turns into BETA_TEST_REPORT.md.
 *
 * Run (server must be on :8899):  node tests/beta-e2e-bot.mjs
 */

import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.RL_BASE || 'http://localhost:8899';

// Personas expressed as field-id → value. Pension contribution field is monthly.
const TESTERS = [
  {
    id: 'stuart-56', label: 'Stuart, 56 — single', household: 'single',
    names: { a: 'Stuart' },
    fields: {
      'input-current-age': 56, 'input-retirement-age': 67, 'input-target-income': 28000,
      'input-pension-pot': 320000, 'input-pension-contribution': 1000,
      'input-isa-balance': 60000, 'input-isa-contribution': 333,
      'input-state-pension-amount': 11973, 'input-state-pension-age': 67,
    },
  },
  {
    id: 'high-earner', label: 'James, 50 — high earner single', household: 'single',
    names: { a: 'James' },
    fields: {
      'input-current-age': 50, 'input-retirement-age': 60, 'input-target-income': 55000,
      'input-pension-pot': 700000, 'input-pension-contribution': 3333,
      'input-isa-balance': 200000, 'input-isa-contribution': 1666,
      'input-state-pension-amount': 11973, 'input-state-pension-age': 67,
    },
  },
  {
    id: 'late-starter', label: 'Maureen, 58 — small pot single', household: 'single',
    names: { a: 'Maureen' },
    fields: {
      'input-current-age': 58, 'input-retirement-age': 68, 'input-target-income': 15000,
      'input-pension-pot': 60000, 'input-pension-contribution': 500,
      'input-isa-balance': 8000, 'input-isa-contribution': 83,
      'input-state-pension-amount': 11973, 'input-state-pension-age': 67,
    },
  },
  {
    id: 'couple-annbob', label: 'Ann & Bob — couple', household: 'couple',
    names: { a: 'Ann', b: 'Bob' },
    fields: {
      'input-current-age': 59, 'input-retirement-age': 66, 'input-target-income': 40000,
      'input-pension-pot': 350000, 'input-pension-contribution': 1000,
      'input-isa-balance': 80000, 'input-isa-contribution': 417,
      'input-state-pension-amount': 11973, 'input-state-pension-age': 67,
      'input-partner-current-age': 57, 'input-partner-retirement-age': 66,
      'input-partner-pension-pot': 180000, 'input-partner-pension-contribution': 600,
      'input-partner-isa-balance': 30000,
      'input-partner-state-pension-amount': 11973, 'input-partner-state-pension-age': 67,
    },
  },
];

const results = [];

async function fillVisibleFields(page, fields) {
  const filled = [];
  for (const [id, val] of Object.entries(fields)) {
    const loc = page.locator(`#${id}`);
    if (await loc.count() && await loc.isVisible().catch(() => false)) {
      await loc.fill(String(val)).catch(() => {});
      // fire input + change so listeners update state
      await loc.evaluate(el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }).catch(() => {});
      filled.push(id);
    }
  }
  return filled;
}

async function clickPrimary(page) {
  // Within the active screen, prefer calculate, then names-next, then data-action=next
  const active = page.locator('.screen.active');
  for (const sel of ['#calculate-btn', '#names-next-btn', '[data-action="next"]', '#couples-input-next-btn']) {
    const btn = active.locator(sel).first();
    if (await btn.count() && await btn.isVisible().catch(() => false) && await btn.isEnabled().catch(() => false)) {
      await btn.click().catch(() => {});
      return sel;
    }
  }
  return null;
}

async function currentScreen(page) {
  return page.evaluate(() => document.querySelector('.screen.active')?.id || null);
}

for (const t of TESTERS) {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [], pageErrors = [];
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ResizeObserver/.test(m.text())) consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  const rec = { id: t.id, label: t.label, steps: [], reachedResults: false, resultText: '', consoleErrors, pageErrors, issues: [] };
  try {
    await page.goto(`${BASE}/app.html`);
    await page.waitForTimeout(700);

    // Select household type (auto-advances)
    await page.locator(`.household-type-card[data-household-type="${t.household}"]`).click();
    await page.waitForTimeout(700);

    // Names
    if (await page.locator('#input-name-a').isVisible().catch(() => false)) {
      await page.locator('#input-name-a').fill(t.names.a || '');
      if (t.names.b) await page.locator('#input-name-b').fill(t.names.b);
    } else {
      rec.issues.push('Names screen did not appear after selecting household type');
    }

    // Walk the wizard
    let guard = 0;
    let screen = await currentScreen(page);
    while (screen !== 'screen-results' && guard < 14) {
      guard++;
      const filled = await fillVisibleFields(page, t.fields);
      const clicked = await clickPrimary(page);
      rec.steps.push({ screen, filled: filled.length, clicked });
      await page.waitForTimeout(500);
      const next = await currentScreen(page);
      if (next === screen && !clicked) { rec.issues.push(`Stuck on ${screen} — no advance control found`); break; }
      screen = next;
    }

    await page.waitForTimeout(1200); // let results calc + render
    screen = await currentScreen(page);
    rec.reachedResults = screen === 'screen-results';
    // Read the actual results container + summary, not just the brand header.
    const probe = await page.evaluate(() => ({
      containerLen: (document.getElementById('results-container')?.innerText || '').length,
      summary: (document.getElementById('results-header-summary')?.innerText || '').replace(/\s+/g, ' ').trim(),
      errMsg: document.getElementById('error-message')?.classList.contains('visible')
        ? (document.getElementById('error-message')?.innerText || '').trim() : '',
    })).catch(() => ({ containerLen: 0, summary: '', errMsg: '' }));
    rec.resultText = (probe.summary || '').slice(0, 200);
    rec.containerLen = probe.containerLen;
    if (rec.reachedResults) {
      if (probe.errMsg) rec.issues.push(`Calculation blocked: "${probe.errMsg}"`);
      else if (probe.containerLen < 50) rec.issues.push('Results screen reached but results container rendered (near-)empty');
    } else {
      rec.issues.push(`Did not reach results (stopped on ${screen})`);
    }
    await page.screenshot({ path: `test-artifacts/beta-${t.id}.png`, fullPage: true }).catch(() => {});
  } catch (e) {
    rec.issues.push(`Exception: ${e.message}`);
  }
  if (consoleErrors.length) rec.issues.push(`${consoleErrors.length} console error(s)`);
  if (pageErrors.length) rec.issues.push(`${pageErrors.length} page error(s)`);
  results.push(rec);
  console.log(`${t.label}: results=${rec.reachedResults}, issues=${rec.issues.length}`);
  await browser.close();
}

writeFileSync('test-artifacts/beta-results.json', JSON.stringify(results, null, 2));
console.log('\nWrote test-artifacts/beta-results.json');
