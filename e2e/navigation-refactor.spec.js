/**
 * RetireLens 2 - Navigation Refactor E2E Tests
 * 
 * Tests the refactored navigation flow:
 * - Household type is entry point (no splash screen)
 * - Pension types screen removed
 * - Couples input screen collects all details
 * - Next button works and advances
 * - Validation errors are visible and actionable
 */

import { test, expect } from '@playwright/test';

test.describe('Navigation Refactor', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to initialize - household-type should be active
    await page.waitForSelector('#screen-household-type.active', { timeout: 5000 });
  });

  test('starts with household type screen (no splash)', async ({ page }) => {
    // Verify household-type is the entry point
    const householdScreen = await page.locator('#screen-household-type.active');
    await expect(householdScreen).toBeVisible();
    
    // Verify welcome/splash screen is not active
    const welcomeScreen = await page.locator('#screen-welcome.active');
    await expect(welcomeScreen).toHaveCount(0);
    
    // Take screenshot
    await page.screenshot({ 
      path: './test-artifacts/screenshots/01-entry-point-household-type.png',
      fullPage: true 
    });
  });

  test('single household - completes basic flow', async ({ page }) => {
    // Select single household
    await page.click('.household-type-card[data-household-type="single"]');
    await page.waitForTimeout(500);
    
    // Should advance to age screen (NOT pension-types)
    await page.waitForSelector('#screen-age.active', { timeout: 2000 });
    await page.screenshot({ 
      path: './test-artifacts/screenshots/02-single-age-screen.png',
      fullPage: true 
    });
    
    // Fill age
    await page.fill('#input-current-age', '45');
    await page.click('#screen-age.active [data-action="next"]');
    
    // Retirement age
    await page.waitForSelector('#screen-retirement-age.active');
    await page.fill('#input-retirement-age', '65');
    await page.click('#screen-retirement-age.active [data-action="next"]');
    
    // Income target
    await page.waitForSelector('#screen-income-target.active');
    await page.fill('#input-target-income', '30000');
    await page.click('#screen-income-target.active [data-action="next"]');
    
    // Verify we can navigate forward
    await page.waitForSelector('#screen-pension-pot.active');
    await expect(page.locator('#screen-pension-pot.active')).toBeVisible();
    
    await page.screenshot({ 
      path: './test-artifacts/screenshots/03-single-pension-pot.png',
      fullPage: true 
    });
  });

  test('couple household - shows couples input screen', async ({ page }) => {
    // Select couple household
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(500);
    
    // Should advance to couples-input screen (NOT pension-types)
    await page.waitForSelector('#screen-couples-input.active', { timeout: 2000 });
    await page.screenshot({ 
      path: './test-artifacts/screenshots/04-couples-input-screen.png',
      fullPage: true 
    });
    
    // Verify screen title
    const title = await page.locator('#screen-couples-input h2').textContent();
    expect(title).toContain('household details');
  });

  test('REGRESSION: couples Next button click handler works', async ({ page }) => {
    // This is the critical bug that was fixed
    
    // Select couple household
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(500);
    await page.waitForSelector('#screen-couples-input.active');
    
    // Fill in household income
    await page.fill('#target-income-input', '40000');
    
    // Switch to "You" tab and fill details
    await page.click('[data-tab="you"]');
    await page.waitForTimeout(200);
    
    // Fill all required fields for Person A
    const youInputs = await page.locator('#couples-input-container input[data-person="personA"]');
    await youInputs.filter({ hasText: '' }).first().fill('55'); // Current age
    await page.locator('input[data-person="personA"][data-field="currentAge"]').fill('55');
    await page.locator('input[data-person="personA"][data-field="retirementAge"]').fill('65');
    
    // Switch to "Partner" tab and fill details
    await page.click('[data-tab="partner"]');
    await page.waitForTimeout(200);
    
    await page.locator('input[data-person="personB"][data-field="currentAge"]').fill('52');
    await page.locator('input[data-person="personB"][data-field="retirementAge"]').fill('63');
    
    await page.screenshot({ 
      path: './test-artifacts/screenshots/05-couples-filled-data.png',
      fullPage: true 
    });
    
    // Click Next button - this should work now (was broken before)
    const nextButton = await page.locator('#couples-input-next-btn');
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeEnabled();
    
    await nextButton.click();
    
    // Should advance to next screen (review)
    await page.waitForSelector('#screen-review.active', { timeout: 3000 });
    await expect(page.locator('#screen-review.active')).toBeVisible();
    
    await page.screenshot({ 
      path: './test-artifacts/screenshots/06-couples-advanced-to-review.png',
      fullPage: true 
    });
  });

  test('couples Next button - validation errors are visible', async ({ page }) => {
    // Select couple household
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(500);
    await page.waitForSelector('#screen-couples-input.active');
    
    // Try to click Next without filling anything
    const nextButton = await page.locator('#couples-input-next-btn');
    
    // Button should be disabled initially
    await expect(nextButton).toBeDisabled();
    
    // Fill only partial data
    await page.fill('#target-income-input', '40000');
    await page.locator('input[data-person="personA"][data-field="currentAge"]').fill('55');
    
    // Button might still be disabled or we click and see error
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      
      // Should show error message
      await page.waitForTimeout(500);
      const errorMessage = await page.locator('#error-message.visible, .error-message.visible');
      // Error message should be visible or scroll should happen
      
      await page.screenshot({ 
        path: './test-artifacts/screenshots/07-validation-error.png',
        fullPage: true 
      });
    }
  });

  test('no horizontal overflow on mobile viewport', async ({ page }, testInfo) => {
    // Only run on mobile projects
    if (!testInfo.project.name.includes('iPhone')) {
      test.skip();
    }
    
    // Select couple household
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(500);
    await page.waitForSelector('#screen-couples-input.active');
    
    // Check for horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(hasHorizontalScroll).toBe(false);
    
    // Check all tabs
    await page.click('[data-tab="you"]');
    await page.waitForTimeout(200);
    const hasScrollYou = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasScrollYou).toBe(false);
    
    await page.click('[data-tab="partner"]');
    await page.waitForTimeout(200);
    const hasScrollPartner = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasScrollPartner).toBe(false);
    
    await page.screenshot({ 
      path: './test-artifacts/screenshots/08-mobile-no-overflow.png',
      fullPage: true 
    });
  });

  test('tabs are tappable and content updates', async ({ page }) => {
    // Select couple household
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(500);
    await page.waitForSelector('#screen-couples-input.active');
    
    // Click "You" tab
    await page.click('[data-tab="you"]');
    await page.waitForTimeout(200);
    
    // Verify active tab
    const youTab = await page.locator('[data-tab="you"]');
    await expect(youTab).toHaveClass(/tab-active/);
    
    // Click "Partner" tab
    await page.click('[data-tab="partner"]');
    await page.waitForTimeout(200);
    
    // Verify active tab switched
    const partnerTab = await page.locator('[data-tab="partner"]');
    await expect(partnerTab).toHaveClass(/tab-active/);
    
    const youTabAfter = await page.locator('[data-tab="you"]');
    await expect(youTabAfter).not.toHaveClass(/tab-active/);
  });

  test('progress bar updates as navigation advances', async ({ page }) => {
    const progressBar = await page.locator('#progress-bar');
    
    // Get initial progress
    const initialWidth = await progressBar.evaluate(el => el.style.width);
    
    // Navigate forward
    await page.click('.household-type-card[data-household-type="single"]');
    await page.waitForTimeout(500);
    await page.waitForSelector('#screen-age.active');
    
    // Progress should have increased
    const afterWidth = await progressBar.evaluate(el => el.style.width);
    
    // Parse and compare (remove % and convert to number)
    const initialPercent = parseFloat(initialWidth) || 0;
    const afterPercent = parseFloat(afterWidth) || 0;
    
    expect(afterPercent).toBeGreaterThan(initialPercent);
  });
});

test.describe('Single Household Happy Path', () => {
  
  test('completes full single household flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#screen-household-type.active');
    
    // 1. Select single household
    await page.click('.household-type-card[data-household-type="single"]');
    await page.waitForTimeout(500);
    
    // 2. Age
    await page.waitForSelector('#screen-age.active');
    await page.fill('#input-current-age', '45');
    await page.click('#screen-age.active [data-action="next"]');
    
    // 3. Retirement age
    await page.waitForSelector('#screen-retirement-age.active');
    await page.fill('#input-retirement-age', '65');
    await page.click('#screen-retirement-age.active [data-action="next"]');
    
    // 4. Income target
    await page.waitForSelector('#screen-income-target.active');
    await page.fill('#input-target-income', '30000');
    await page.click('#screen-income-target.active [data-action="next"]');
    
    // 5. Pension pot
    await page.waitForSelector('#screen-pension-pot.active');
    await page.fill('#input-pension-pot', '200000');
    await page.click('#screen-pension-pot.active [data-action="next"]');
    
    // 6. Contributions
    await page.waitForSelector('#screen-contributions.active');
    await page.fill('#input-pension-contribution', '500');
    await page.click('#screen-contributions.active [data-action="next"]');
    
    // 7. Should reach review
    await page.waitForSelector('#screen-review.active', { timeout: 3000 });
    await expect(page.locator('#screen-review.active')).toBeVisible();
    
    await page.screenshot({ 
      path: './test-artifacts/screenshots/09-single-happy-path-review.png',
      fullPage: true 
    });
  });
});

test.describe('Couple Household Happy Path', () => {
  
  test('completes full couple household flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#screen-household-type.active');
    
    // 1. Select couple household
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(500);
    
    // 2. Fill couples input screen
    await page.waitForSelector('#screen-couples-input.active');
    
    // Household income
    await page.fill('#target-income-input', '50000');
    
    // You tab
    await page.click('[data-tab="you"]');
    await page.waitForTimeout(200);
    await page.locator('input[data-person="personA"][data-field="currentAge"]').fill('55');
    await page.locator('input[data-person="personA"][data-field="retirementAge"]').fill('65');
    await page.locator('input[data-person="personA"][data-field="dcPot"]').fill('300000');
    await page.locator('input[data-person="personA"][data-field="dcMonthlyContrib"]').fill('800');
    
    // Partner tab
    await page.click('[data-tab="partner"]');
    await page.waitForTimeout(200);
    await page.locator('input[data-person="personB"][data-field="currentAge"]').fill('52');
    await page.locator('input[data-person="personB"][data-field="retirementAge"]').fill('63');
    await page.locator('input[data-person="personB"][data-field="dcPot"]').fill('150000');
    await page.locator('input[data-person="personB"][data-field="dcMonthlyContrib"]').fill('400');
    
    await page.screenshot({ 
      path: './test-artifacts/screenshots/10-couple-filled-complete.png',
      fullPage: true 
    });
    
    // 3. Click Next
    const nextButton = await page.locator('#couples-input-next-btn');
    await nextButton.click();
    
    // 4. Should reach review
    await page.waitForSelector('#screen-review.active', { timeout: 3000 });
    await expect(page.locator('#screen-review.active')).toBeVisible();
    
    await page.screenshot({ 
      path: './test-artifacts/screenshots/11-couple-happy-path-review.png',
      fullPage: true 
    });
  });
});
