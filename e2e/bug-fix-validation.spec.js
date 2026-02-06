/**
 * E2E Test Suite - Navigation Bug Fix Validation
 * 
 * Critical tests to validate the "Next does nothing" bug is fixed
 * and the navigation refactor works correctly.
 */

import { test, expect } from '@playwright/test';

test.describe('Critical Bug Fix - Couples Next Button', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.waitForSelector('#screen-household-type.active', { timeout: 10000 });
  });

  test('TEST 1: Entry point is household type (no splash screen)', async ({ page }) => {
    // Verify household-type screen is active on load
    const householdScreen = page.locator('#screen-household-type.active');
    await expect(householdScreen).toBeVisible();
    
    // Verify title
    const title = await page.locator('#screen-household-type h2').textContent();
    expect(title.toLowerCase()).toContain('planning for');
    
    // Take screenshot
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test01-entry-household-type.png',
      fullPage: true 
    });
    
    console.log('✓ TEST 1 PASSED: Entry point is household type screen');
  });

  test('TEST 2: Single household navigates correctly', async ({ page }) => {
    // Select single household
    await page.click('.household-type-card[data-household-type="single"]');
    await page.waitForTimeout(600);
    
    // Should navigate to age screen (NOT pension-types)
    await page.waitForSelector('#screen-age.active', { timeout: 5000 });
    const ageScreen = page.locator('#screen-age.active');
    await expect(ageScreen).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test02-single-age-screen.png',
      fullPage: true 
    });
    
    console.log('✓ TEST 2 PASSED: Single household navigates to age screen');
  });

  test('TEST 3: Couple household shows couples input screen', async ({ page }) => {
    // Select couple household
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(600);
    
    // Should navigate to couples-input screen (NOT pension-types)
    await page.waitForSelector('#screen-couples-input.active', { timeout: 5000 });
    const couplesScreen = page.locator('#screen-couples-input.active');
    await expect(couplesScreen).toBeVisible();
    
    // Verify screen content
    const title = await page.locator('#screen-couples-input h2').textContent();
    expect(title.toLowerCase()).toContain('household details');
    
    // Take screenshot
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test03-couples-input-screen.png',
      fullPage: true 
    });
    
    console.log('✓ TEST 3 PASSED: Couple household shows couples input screen');
  });

  test('TEST 4: Couples Next button exists and is visible', async ({ page }) => {
    // Navigate to couples input
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(600);
    await page.waitForSelector('#screen-couples-input.active', { timeout: 5000 });
    
    // Verify Next button exists
    const nextButton = page.locator('#couples-input-next-btn');
    await expect(nextButton).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test04-next-button-visible.png',
      fullPage: true 
    });
    
    console.log('✓ TEST 4 PASSED: Couples Next button is visible');
  });

  test('TEST 5: CRITICAL - Couples Next button click handler works', async ({ page }) => {
    // This is the bug that was fixed - Next button had no click handler
    
    // Navigate to couples input
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(600);
    await page.waitForSelector('#screen-couples-input.active', { timeout: 5000 });
    
    // Fill required fields
    await page.fill('#target-income-input', '40000');
    
    // Fill Person A data
    await page.click('[data-tab="you"]');
    await page.waitForTimeout(300);
    await page.locator('input[data-person="personA"][data-field="currentAge"]').fill('55');
    await page.locator('input[data-person="personA"][data-field="retirementAge"]').fill('65');
    
    // Fill Person B data
    await page.click('[data-tab="partner"]');
    await page.waitForTimeout(300);
    await page.locator('input[data-person="personB"][data-field="currentAge"]').fill('52');
    await page.locator('input[data-person="personB"][data-field="retirementAge"]').fill('63');
    
    // Take screenshot before clicking
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test05a-before-next-click.png',
      fullPage: true 
    });
    
    // Wait for button to be enabled
    const nextButton = page.locator('#couples-input-next-btn');
    await expect(nextButton).toBeEnabled({ timeout: 2000 });
    
    // CRITICAL TEST: Click Next button
    await nextButton.click();
    
    // Button click should trigger navigation
    // Wait for screen change
    await page.waitForTimeout(1000);
    
    // Verify we navigated away from couples-input
    const couplesStillActive = await page.locator('#screen-couples-input.active').count();
    expect(couplesStillActive).toBe(0);
    
    // Verify we're on a new screen (should be review)
    const reviewActive = await page.locator('#screen-review.active').count();
    expect(reviewActive).toBe(1);
    
    // Take screenshot after clicking
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test05b-after-next-click.png',
      fullPage: true 
    });
    
    console.log('✓ TEST 5 PASSED: Couples Next button click handler works - navigated to review screen');
  });

  test('TEST 6: Validation - incomplete data shows error', async ({ page }) => {
    // Navigate to couples input
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(600);
    await page.waitForSelector('#screen-couples-input.active', { timeout: 5000 });
    
    // Fill only partial data
    await page.fill('#target-income-input', '40000');
    await page.locator('input[data-person="personA"][data-field="currentAge"]').fill('55');
    
    // Button should be disabled
    const nextButton = page.locator('#couples-input-next-btn');
    await expect(nextButton).toBeDisabled();
    
    // Take screenshot
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test06-validation-disabled.png',
      fullPage: true 
    });
    
    console.log('✓ TEST 6 PASSED: Next button disabled with incomplete data');
  });
});

test.describe('Single Household Full Flow', () => {
  
  test('TEST 7: Complete single household happy path', async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.waitForSelector('#screen-household-type.active', { timeout: 10000 });
    
    // 1. Select single
    await page.click('.household-type-card[data-household-type="single"]');
    await page.waitForTimeout(600);
    
    // 2. Age screen
    await page.waitForSelector('#screen-age.active');
    await page.fill('#input-current-age', '45');
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test07-step1-age.png',
      fullPage: true 
    });
    await page.click('#screen-age.active [data-action="next"]');
    
    // 3. Retirement age
    await page.waitForSelector('#screen-retirement-age.active');
    await page.fill('#input-retirement-age', '65');
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test07-step2-retirement.png',
      fullPage: true 
    });
    await page.click('#screen-retirement-age.active [data-action="next"]');
    
    // 4. Income target
    await page.waitForSelector('#screen-income-target.active');
    await page.fill('#input-target-income', '30000');
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test07-step3-income.png',
      fullPage: true 
    });
    await page.click('#screen-income-target.active [data-action="next"]');
    
    // 5. Pension pot
    await page.waitForSelector('#screen-pension-pot.active');
    await page.fill('#input-pension-pot', '200000');
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test07-step4-pension.png',
      fullPage: true 
    });
    await page.click('#screen-pension-pot.active [data-action="next"]');
    
    // 6. Contributions
    await page.waitForSelector('#screen-contributions.active');
    await page.fill('#input-pension-contribution', '500');
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test07-step5-contributions.png',
      fullPage: true 
    });
    await page.click('#screen-contributions.active [data-action="next"]');
    
    // 7. ISA savings (full mode includes this)
    await page.waitForSelector('#screen-isa-savings.active', { timeout: 5000 });
    await page.fill('#input-isa-balance', '50000');
    await page.fill('#input-isa-contribution', '5000');
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test07-step6-isa.png',
      fullPage: true 
    });
    await page.click('#screen-isa-savings.active [data-action="next"]');
    
    // 8. State pension (full mode includes this)
    await page.waitForSelector('#screen-state-pension.active', { timeout: 5000 });
    // Use defaults, just click next
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test07-step7-state-pension.png',
      fullPage: true 
    });
    await page.click('#screen-state-pension.active [data-action="next"]');
    
    // 9. Should reach review
    await page.waitForSelector('#screen-review.active', { timeout: 5000 });
    const reviewScreen = page.locator('#screen-review.active');
    await expect(reviewScreen).toBeVisible();
    
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test07-step8-review.png',
      fullPage: true 
    });
    
    console.log('✓ TEST 7 PASSED: Single household completes full flow to review');
  });
});

test.describe('Couple Household Full Flow', () => {
  
  test('TEST 8: Complete couple household happy path', async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.waitForSelector('#screen-household-type.active', { timeout: 10000 });
    
    // 1. Select couple
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(600);
    
    // 2. Couples input screen
    await page.waitForSelector('#screen-couples-input.active');
    
    // Fill household income
    await page.fill('#target-income-input', '50000');
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test08-step1-household-income.png',
      fullPage: true 
    });
    
    // Fill You tab
    await page.click('[data-tab="you"]');
    await page.waitForTimeout(300);
    await page.locator('input[data-person="personA"][data-field="currentAge"]').fill('55');
    await page.locator('input[data-person="personA"][data-field="retirementAge"]').fill('65');
    await page.locator('input[data-person="personA"][data-field="dcPot"]').fill('300000');
    await page.locator('input[data-person="personA"][data-field="dcMonthlyContrib"]').fill('800');
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test08-step2-you-tab.png',
      fullPage: true 
    });
    
    // Fill Partner tab
    await page.click('[data-tab="partner"]');
    await page.waitForTimeout(300);
    await page.locator('input[data-person="personB"][data-field="currentAge"]').fill('52');
    await page.locator('input[data-person="personB"][data-field="retirementAge"]').fill('63');
    await page.locator('input[data-person="personB"][data-field="dcPot"]').fill('150000');
    await page.locator('input[data-person="personB"][data-field="dcMonthlyContrib"]').fill('400');
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test08-step3-partner-tab.png',
      fullPage: true 
    });
    
    // 3. Click Next
    const nextButton = page.locator('#couples-input-next-btn');
    await expect(nextButton).toBeEnabled();
    await nextButton.click();
    
    // 4. Should reach review
    await page.waitForSelector('#screen-review.active', { timeout: 5000 });
    const reviewScreen = page.locator('#screen-review.active');
    await expect(reviewScreen).toBeVisible();
    
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test08-step4-review.png',
      fullPage: true 
    });
    
    console.log('✓ TEST 8 PASSED: Couple household completes full flow to review');
  });
});

test.describe('Tab Interaction Tests', () => {
  
  test('TEST 9: Tabs switch correctly', async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.waitForSelector('#screen-household-type.active', { timeout: 10000 });
    
    // Navigate to couples input
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(600);
    await page.waitForSelector('#screen-couples-input.active');
    
    // Click You tab
    await page.click('[data-tab="you"]');
    await page.waitForTimeout(300);
    const youTab = page.locator('[data-tab="you"]');
    await expect(youTab).toHaveClass(/tab-active/);
    
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test09-you-tab-active.png',
      fullPage: true 
    });
    
    // Click Partner tab
    await page.click('[data-tab="partner"]');
    await page.waitForTimeout(300);
    const partnerTab = page.locator('[data-tab="partner"]');
    await expect(partnerTab).toHaveClass(/tab-active/);
    
    // You tab should not be active
    await expect(youTab).not.toHaveClass(/tab-active/);
    
    await page.screenshot({ 
      path: './test-artifacts/screenshots/test09-partner-tab-active.png',
      fullPage: true 
    });
    
    console.log('✓ TEST 9 PASSED: Tabs switch correctly');
  });
});

test.describe('Progress Bar Tests', () => {
  
  test('TEST 10: Progress bar updates as navigation advances', async ({ page }) => {
    await page.goto('http://localhost:8080');
    await page.waitForSelector('#screen-household-type.active', { timeout: 10000 });
    
    // Get initial progress
    const progressBar = page.locator('#progress-bar');
    const initialWidth = await progressBar.evaluate(el => el.style.width);
    
    // Navigate forward
    await page.click('.household-type-card[data-household-type="single"]');
    await page.waitForTimeout(600);
    await page.waitForSelector('#screen-age.active');
    
    // Get updated progress
    const afterWidth = await progressBar.evaluate(el => el.style.width);
    
    // Parse percentages
    const initialPercent = parseFloat(initialWidth) || 0;
    const afterPercent = parseFloat(afterWidth) || 0;
    
    expect(afterPercent).toBeGreaterThan(initialPercent);
    
    console.log(`✓ TEST 10 PASSED: Progress bar advanced from ${initialPercent}% to ${afterPercent}%`);
  });
});
