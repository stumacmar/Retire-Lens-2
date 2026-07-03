/**
 * E2E Test Suite - Navigation Bug Fix Validation
 *
 * Tests validate the unified wizard flow for both singles and couples.
 * Couples use the same screens as singles with partner inputs injected.
 */

import { test, expect } from '@playwright/test';

test.describe('Critical Bug Fix - Navigation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.waitForSelector('#screen-household-type.active', { timeout: 10000 });
  });

  test('TEST 1: Entry point is household type (no splash screen)', async ({ page }) => {
    const householdScreen = page.locator('#screen-household-type.active');
    await expect(householdScreen).toBeVisible();

    const title = await page.locator('#screen-household-type h2').textContent();
    expect(title.toLowerCase()).toContain('planning for');

    await page.screenshot({
      path: './test-artifacts/screenshots/test01-entry-household-type.png',
      fullPage: true
    });

    console.log('✓ TEST 1 PASSED: Entry point is household type screen');
  });

  test('TEST 2: Single household navigates correctly', async ({ page }) => {
    await page.click('.household-type-card[data-household-type="single"]');
    await page.waitForTimeout(600);

    await page.waitForSelector('#screen-age.active', { timeout: 5000 });
    const ageScreen = page.locator('#screen-age.active');
    await expect(ageScreen).toBeVisible();

    await page.screenshot({
      path: './test-artifacts/screenshots/test02-single-age-screen.png',
      fullPage: true
    });

    console.log('✓ TEST 2 PASSED: Single household navigates to age screen');
  });

  test('TEST 3: Couple household navigates to age screen (unified wizard)', async ({ page }) => {
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(600);

    // Couples now use the same wizard — should go to age screen
    await page.waitForSelector('#screen-age.active', { timeout: 5000 });
    const ageScreen = page.locator('#screen-age.active');
    await expect(ageScreen).toBeVisible();

    // Partner input should be injected
    const partnerInput = page.locator('#input-partner-current-age');
    await expect(partnerInput).toBeVisible();

    await page.screenshot({
      path: './test-artifacts/screenshots/test03-couple-age-screen.png',
      fullPage: true
    });

    console.log('✓ TEST 3 PASSED: Couple household shows age screen with partner input');
  });

  test('TEST 4: Couple wizard shows partner inputs on each screen', async ({ page }) => {
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(600);

    // Age screen — partner input should exist
    await page.waitForSelector('#screen-age.active', { timeout: 5000 });
    await expect(page.locator('#input-partner-current-age')).toBeVisible();

    // Fill ages and retirement ages, then advance
    await page.fill('#input-current-age', '55');
    await page.fill('#input-retirement-age', '65');
    // Partner inputs
    const partnerInputs = page.locator('#screen-age .partner-input-group input');
    await partnerInputs.nth(0).fill('52');
    await partnerInputs.nth(1).fill('63');
    await page.click('#screen-age.active [data-action="next"]');

    // Pension pot screen is next (income target now lives on this screen)
    await page.waitForSelector('#screen-pension-pot.active', { timeout: 5000 });
    await expect(page.locator('#screen-pension-pot.active')).toBeVisible();
    await expect(page.locator('#input-partner-pension-pot')).toBeVisible();

    await page.screenshot({
      path: './test-artifacts/screenshots/test04-couple-pension-screen.png',
      fullPage: true
    });

    console.log('✓ TEST 4 PASSED: Partner inputs visible on each wizard screen');
  });

  test('TEST 5: Single wizard does NOT show partner inputs', async ({ page }) => {
    await page.click('.household-type-card[data-household-type="single"]');
    await page.waitForTimeout(600);

    await page.waitForSelector('#screen-age.active', { timeout: 5000 });

    // Partner input should NOT exist for singles
    const partnerInput = page.locator('#input-partner-current-age');
    await expect(partnerInput).toHaveCount(0);

    console.log('✓ TEST 5 PASSED: Single wizard has no partner inputs');
  });

  test('TEST 6: Validation works for incomplete single data', async ({ page }) => {
    await page.click('.household-type-card[data-household-type="single"]');
    await page.waitForTimeout(600);

    // Navigate through without filling data
    await page.waitForSelector('#screen-age.active', { timeout: 5000 });
    await page.click('#screen-age.active [data-action="next"]');

    // Should advance to pension pot (income target is now on that screen)
    await page.waitForSelector('#screen-pension-pot.active', { timeout: 5000 });
    await expect(page.locator('#screen-pension-pot.active')).toBeVisible();

    console.log('✓ TEST 6 PASSED: Navigation works even with empty inputs');
  });
});

test.describe('Single Household Full Flow', () => {

  test('TEST 7: Complete single household happy path', async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.waitForSelector('#screen-household-type.active', { timeout: 10000 });

    await page.click('.household-type-card[data-household-type="single"]');
    await page.waitForTimeout(600);

    // Age + Retirement (combined screen)
    await page.waitForSelector('#screen-age.active');
    await page.fill('#input-current-age', '45');
    await page.fill('#input-retirement-age', '65');
    await page.click('#screen-age.active [data-action="next"]');

    // Pension pot + income target + contributions (combined screen)
    await page.waitForSelector('#screen-pension-pot.active');
    await page.fill('#input-target-income', '30000');
    await page.fill('#input-pension-pot', '200000');
    await page.fill('#input-pension-contribution', '500');
    await page.click('#screen-pension-pot.active [data-action="next"]');

    // ISA + State Pension (combined screen)
    await page.waitForSelector('#screen-isa-savings.active', { timeout: 5000 });
    await page.fill('#input-isa-balance', '50000');
    await page.click('#screen-isa-savings.active [data-action="next"]');

    // Results (review screen is no longer part of the flow)
    await page.waitForSelector('#screen-results.active', { timeout: 10000 });
    await expect(page.locator('#screen-results.active')).toBeVisible();

    await page.screenshot({
      path: './test-artifacts/screenshots/test07-results.png',
      fullPage: true
    });

    console.log('✓ TEST 7 PASSED: Single household completes full flow to results');
  });
});

test.describe('Couple Household Full Flow', () => {

  test('TEST 8: Complete couple household happy path (unified wizard)', async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.waitForSelector('#screen-household-type.active', { timeout: 10000 });

    // 1. Select couple
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(600);

    // 2. Age + Retirement (combined) with partner inputs
    await page.waitForSelector('#screen-age.active', { timeout: 5000 });
    await page.fill('#input-current-age', '55');
    await page.fill('#input-retirement-age', '65');
    // Partner inputs are dynamically injected
    const partnerAgeInputs = page.locator('#screen-age .partner-input-group input');
    await partnerAgeInputs.nth(0).fill('52');
    await partnerAgeInputs.nth(1).fill('63');
    await page.click('#screen-age.active [data-action="next"]');

    // 3. Pension + income target + contributions + partner DC (combined)
    await page.waitForSelector('#screen-pension-pot.active');
    await page.fill('#input-target-income', '50000');
    await page.fill('#input-pension-pot', '300000');
    await page.fill('#input-pension-contribution', '800');
    await page.fill('#input-partner-pension-pot', '150000');
    await page.click('#screen-pension-pot.active [data-action="next"]');

    // 4. ISA + State Pension (combined)
    await page.waitForSelector('#screen-isa-savings.active', { timeout: 5000 });
    await page.fill('#input-isa-balance', '30000');
    await page.click('#screen-isa-savings.active [data-action="next"]');

    // 5. Results (review screen is no longer part of the flow)
    await page.waitForSelector('#screen-results.active', { timeout: 10000 });
    await expect(page.locator('#screen-results.active')).toBeVisible();

    await page.screenshot({
      path: './test-artifacts/screenshots/test08-couple-results.png',
      fullPage: true
    });

    console.log('✓ TEST 8 PASSED: Couple household completes unified wizard to results');
  });
});

test.describe('Progress Bar Tests', () => {

  test('TEST 9: Progress bar updates as navigation advances', async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.waitForSelector('#screen-household-type.active', { timeout: 10000 });

    const progressBar = page.locator('#progress-bar');
    const initialWidth = await progressBar.evaluate(el => el.style.width);

    await page.click('.household-type-card[data-household-type="single"]');
    await page.waitForTimeout(600);
    await page.waitForSelector('#screen-age.active');

    const afterWidth = await progressBar.evaluate(el => el.style.width);

    const initialPercent = parseFloat(initialWidth) || 0;
    const afterPercent = parseFloat(afterWidth) || 0;

    expect(afterPercent).toBeGreaterThan(initialPercent);

    console.log(`✓ TEST 9 PASSED: Progress bar advanced from ${initialPercent}% to ${afterPercent}%`);
  });
});
