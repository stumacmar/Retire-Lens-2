/**
 * E2E Smoke Test - Boot/Initialization & Screen 1 Navigation
 * 
 * This test validates the fix for the boot/initialization issue where
 * the app failed to initialize Screen 1 (household-type) properly.
 * 
 * BOOT FAILURE CAUSE: DOMContentLoaded handler did not call showScreen()
 * to initialize the first screen's UI state.
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Test - App Initialization & Screen 1', () => {
  
  test('SMOKE 1: App loads without errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Listen for page errors
    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
    
    // Navigate to app
    await page.goto('http://localhost:8080/v2/');
    
    // Wait for app to initialize
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // Allow time for initialization
    
    // Verify no critical errors (allow external CDN/resource failures)
    const criticalErrors = [...consoleErrors, ...pageErrors].filter(err => 
      !err.includes('favicon') && // Ignore favicon errors
      !err.includes('ResizeObserver') && // Ignore ResizeObserver warnings
      !err.includes('cdn.jsdelivr.net') && // Ignore CDN failures
      !err.includes('ERR_NAME_NOT_RESOLVED') && // Ignore network errors
      !err.includes('ERR_BLOCKED_BY_CLIENT') // Ignore ad-blocker errors
    );
    
    expect(criticalErrors).toHaveLength(0);
    console.log('✓ SMOKE 1 PASSED: App loaded without critical errors');
  });

  test('SMOKE 2: Screen 1 (household-type) renders correctly', async ({ page }) => {
    await page.goto('http://localhost:8080/v2/');
    
    // Wait for Screen 1 to be active
    const householdScreen = page.locator('#screen-household-type.active');
    await expect(householdScreen).toBeVisible({ timeout: 5000 });
    
    // Verify screen title
    const title = page.locator('#screen-household-type h2');
    await expect(title).toContainText('Who are you planning for?');
    
    // Verify both household type cards exist
    const singleCard = page.locator('.household-type-card[data-household-type="single"]');
    const coupleCard = page.locator('.household-type-card[data-household-type="couple"]');
    
    await expect(singleCard).toBeVisible();
    await expect(coupleCard).toBeVisible();
    
    // Verify card text
    await expect(singleCard).toContainText('Just me');
    await expect(coupleCard).toContainText('Me and my partner');
    
    // Take screenshot for visual verification
    await page.screenshot({ 
      path: './test-artifacts/screenshots/smoke-screen1-initial.png',
      fullPage: true 
    });
    
    console.log('✓ SMOKE 2 PASSED: Screen 1 renders correctly');
  });

  test('SMOKE 3: Clicking "Just me" (Single) advances to next screen', async ({ page }) => {
    await page.goto('http://localhost:8080/v2/');
    
    // Wait for Screen 1
    await page.waitForSelector('#screen-household-type.active', { timeout: 5000 });
    
    // Click "Just me" card
    await page.click('.household-type-card[data-household-type="single"]');
    
    // Wait for navigation (has 400ms delay in selectHouseholdType)
    await page.waitForTimeout(600);
    
    // Verify Screen 1 is no longer active
    const householdScreen = page.locator('#screen-household-type.active');
    await expect(householdScreen).not.toBeVisible();
    
    // Verify we navigated to the next screen (should be age screen for single)
    const nextScreen = page.locator('.screen.active');
    await expect(nextScreen).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: './test-artifacts/screenshots/smoke-single-navigation.png',
      fullPage: true 
    });
    
    console.log('✓ SMOKE 3 PASSED: Single selection navigates to next screen');
  });

  test('SMOKE 4: Clicking "Me and my partner" (Couple) advances to next screen', async ({ page }) => {
    await page.goto('http://localhost:8080/v2/');
    
    // Wait for Screen 1
    await page.waitForSelector('#screen-household-type.active', { timeout: 5000 });
    
    // Click "Me and my partner" card
    await page.click('.household-type-card[data-household-type="couple"]');
    
    // Wait for navigation (has 400ms delay in selectHouseholdType)
    await page.waitForTimeout(600);
    
    // Verify Screen 1 is no longer active
    const householdScreen = page.locator('#screen-household-type.active');
    await expect(householdScreen).not.toBeVisible();
    
    // Verify we navigated to the next screen (should be couples-input for couple)
    const nextScreen = page.locator('.screen.active');
    await expect(nextScreen).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: './test-artifacts/screenshots/smoke-couple-navigation.png',
      fullPage: true 
    });
    
    console.log('✓ SMOKE 4 PASSED: Couple selection navigates to next screen');
  });

  test('SMOKE 5: Verify state is properly initialized', async ({ page }) => {
    await page.goto('http://localhost:8080/v2/');
    await page.waitForSelector('#screen-household-type.active', { timeout: 5000 });
    
    // Check that the state object exists and has the expected structure
    const stateCheck = await page.evaluate(() => {
      // The app should have initialized state.currentScreen
      const appContainer = document.querySelector('.app-container');
      const activeScreen = document.querySelector('.screen.active');
      const progressBar = document.getElementById('progress-bar');
      
      return {
        hasAppContainer: !!appContainer,
        hasActiveScreen: !!activeScreen,
        activeScreenId: activeScreen ? activeScreen.id : null,
        hasProgressBar: !!progressBar,
        progressBarWidth: progressBar ? progressBar.style.width : null
      };
    });
    
    expect(stateCheck.hasAppContainer).toBe(true);
    expect(stateCheck.hasActiveScreen).toBe(true);
    expect(stateCheck.activeScreenId).toBe('screen-household-type');
    expect(stateCheck.hasProgressBar).toBe(true);
    // Progress bar should have some width set (initialization successful)
    expect(stateCheck.progressBarWidth).not.toBe('');
    
    console.log('✓ SMOKE 5 PASSED: State is properly initialized');
  });

});
