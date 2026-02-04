/**
 * RetireLens 2 - E2E Tests for Pathfinder Flow
 * 
 * Tests the complete user journey from pathfinder through mode selection.
 */

import { test, expect } from '@playwright/test';

test.describe('Pathfinder Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to initialize
    await page.waitForSelector('#screen-welcome.active');
  });

  test('welcome screen displays correctly', async ({ page }) => {
    await expect(page.locator('.screen-title')).toContainText('RetireLens 2');
    await expect(page.locator('.welcome-tagline')).toContainText('Can I retire at age X');
    
    // Screenshot
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/01-welcome-${test.info().project.name}.png`,
      fullPage: true 
    });
  });

  test('clicking start navigates to pathfinder', async ({ page }) => {
    await page.click('[data-action="next"]');
    
    // Wait for pathfinder screen
    await page.waitForSelector('#screen-pathfinder.active');
    
    // Check pathfinder elements
    await expect(page.locator('#pathfinder-question-text')).toBeVisible();
    await expect(page.locator('.pathfinder-progress')).toBeVisible();
    
    // Screenshot
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/02-pathfinder-${test.info().project.name}.png`,
      fullPage: true 
    });
  });

  test('pathfinder questions advance correctly', async ({ page }) => {
    await page.click('[data-action="next"]');
    await page.waitForSelector('#screen-pathfinder.active');
    
    // Answer Q1 - Just starting
    await page.click('.pathfinder-option:first-child');
    await page.waitForTimeout(300);
    
    // Should advance to Q2
    await expect(page.locator('.pathfinder-dot.completed')).toHaveCount(1);
    
    // Answer Q2
    await page.click('.pathfinder-option:first-child');
    await page.waitForTimeout(300);
    
    // Answer Q3
    await page.click('.pathfinder-option:first-child');
    await page.waitForTimeout(300);
    
    // Answer Q4
    await page.click('.pathfinder-option:first-child'); // Quick mode
    await page.waitForTimeout(300);
    
    // Should be on mode select
    await expect(page.locator('#screen-mode-select')).toHaveClass(/active/);
    
    // Screenshot
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/03-mode-select-${test.info().project.name}.png`,
      fullPage: true 
    });
  });

  test('pre-retire journey routes correctly for age 55+', async ({ page }) => {
    await page.click('[data-action="next"]');
    await page.waitForSelector('#screen-pathfinder.active');
    
    // Answer Q1 - Within 10 years of retirement
    await page.click('.pathfinder-option:nth-child(3)');
    await page.waitForTimeout(300);
    
    // Answer Q2 - Check if can retire soon
    await page.click('.pathfinder-option:nth-child(3)');
    await page.waitForTimeout(300);
    
    // Answer Q3 - Very confident
    await page.click('.pathfinder-option:nth-child(3)');
    await page.waitForTimeout(300);
    
    // Answer Q4 - Full detail
    await page.click('.pathfinder-option:nth-child(3)');
    await page.waitForTimeout(300);
    
    // Should be on mode select with pre-retire journey
    await expect(page.locator('#journey-title')).toContainText('Approaching Retirement');
  });
});

test.describe('Mode Selection', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate through pathfinder
    await page.click('[data-action="next"]');
    await page.waitForSelector('#screen-pathfinder.active');
    
    // Quick answers through pathfinder
    for (let i = 0; i < 4; i++) {
      await page.click('.pathfinder-option:first-child');
      await page.waitForTimeout(300);
    }
    
    await page.waitForSelector('#screen-mode-select.active');
  });

  test('mode cards are clickable and highlight', async ({ page }) => {
    // Click guided mode
    await page.click('.mode-card[data-mode="guided"]');
    
    // Check it's selected
    await expect(page.locator('.mode-card[data-mode="guided"]')).toHaveClass(/selected/);
    
    // Continue button should be enabled
    await expect(page.locator('#mode-select-next-btn')).toBeEnabled();
  });

  test('quick mode shows fewer steps', async ({ page }) => {
    // Select quick mode
    await page.click('.mode-card[data-mode="quick"]');
    await page.click('#mode-select-next-btn');
    
    // Navigate through to review
    const inputScreens = ['age', 'retirement-age', 'income-target', 'pension-pot', 'contributions'];
    
    for (const screen of inputScreens) {
      await expect(page.locator(`#screen-${screen}`)).toHaveClass(/active/);
      
      // Fill in test data
      const input = page.locator(`#screen-${screen} input[type="number"]`).first();
      if (await input.isVisible()) {
        await input.fill('50');
      }
      
      await page.click('[data-action="next"]');
      await page.waitForTimeout(200);
    }
    
    // Should now be at review (skip ISA and state pension in quick mode)
    await expect(page.locator('#screen-review')).toHaveClass(/active/);
    
    // Screenshot
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/04-review-quick-${test.info().project.name}.png`,
      fullPage: true 
    });
  });

  test('guided mode shows ISA and state pension steps', async ({ page }) => {
    // Select guided mode
    await page.click('.mode-card[data-mode="guided"]');
    await page.click('#mode-select-next-btn');
    
    // Navigate through steps
    const inputScreens = ['age', 'retirement-age', 'income-target', 'pension-pot', 'contributions', 'isa-savings', 'state-pension'];
    
    for (const screen of inputScreens) {
      await expect(page.locator(`#screen-${screen}`)).toHaveClass(/active/);
      
      // Fill in test data
      const input = page.locator(`#screen-${screen} input[type="number"]`).first();
      if (await input.isVisible()) {
        await input.fill('50');
      }
      
      await page.click('[data-action="next"]');
      await page.waitForTimeout(200);
    }
    
    // Should now be at review with guided mode
    await expect(page.locator('#screen-review')).toHaveClass(/active/);
    
    // Screenshot
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/05-review-guided-${test.info().project.name}.png`,
      fullPage: true 
    });
  });

  test('full mode shows advanced options accordion', async ({ page }) => {
    // Select full mode
    await page.click('.mode-card[data-mode="full"]');
    await page.click('#mode-select-next-btn');
    
    // Navigate to review
    const inputScreens = ['age', 'retirement-age', 'income-target', 'pension-pot', 'contributions', 'isa-savings', 'state-pension'];
    
    for (const screen of inputScreens) {
      const input = page.locator(`#screen-${screen} input[type="number"]`).first();
      if (await input.isVisible()) {
        await input.fill('50');
      }
      await page.click('[data-action="next"]');
      await page.waitForTimeout(200);
    }
    
    // Should be at review
    await expect(page.locator('#screen-review')).toHaveClass(/active/);
    
    // Advanced options container should be visible
    await expect(page.locator('#advanced-options-container')).toBeVisible();
    
    // Screenshot showing advanced options
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/06-advanced-options-${test.info().project.name}.png`,
      fullPage: true 
    });
    
    // Click accordion to expand
    await page.click('.accordion-header:first-child');
    await page.waitForTimeout(200);
    
    // Screenshot with expanded accordion
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/07-accordion-expanded-${test.info().project.name}.png`,
      fullPage: true 
    });
  });
});

test.describe('Answer Preview Card', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate through pathfinder and mode select
    await page.click('[data-action="next"]');
    await page.waitForSelector('#screen-pathfinder.active');
    
    for (let i = 0; i < 4; i++) {
      await page.click('.pathfinder-option:first-child');
      await page.waitForTimeout(300);
    }
    
    await page.click('.mode-card[data-mode="guided"]');
    await page.click('#mode-select-next-btn');
    await page.waitForTimeout(200);
  });

  test('preview card appears on input screens', async ({ page }) => {
    // Should be on age screen
    await expect(page.locator('#screen-age')).toHaveClass(/active/);
    
    // Preview card should be visible
    await expect(page.locator('#answer-preview-card')).toBeVisible();
    
    // Screenshot
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/08-preview-card-initial-${test.info().project.name}.png`,
      fullPage: true 
    });
  });

  test('preview card updates when pension pot changes', async ({ page }) => {
    // Fill in age
    await page.fill('#input-current-age', '40');
    await page.click('[data-action="next"]');
    
    // Fill in retirement age
    await page.fill('#input-retirement-age', '65');
    await page.click('[data-action="next"]');
    
    // Fill in target income
    await page.fill('#input-target-income', '30000');
    await page.click('[data-action="next"]');
    
    // Now on pension pot screen
    await expect(page.locator('#screen-pension-pot')).toHaveClass(/active/);
    
    // Enter pension pot
    await page.fill('#input-pension-pot', '100000');
    
    // Wait for debounce
    await page.waitForTimeout(200);
    
    // Preview should now show projected pot
    const previewPot = page.locator('#preview-pot');
    await expect(previewPot).not.toContainText('—');
    
    // Screenshot with preview card showing values
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/09-preview-card-with-pot-${test.info().project.name}.png`,
      fullPage: true 
    });
  });

  test('preview card shows gap/surplus correctly', async ({ page }) => {
    // Fill in all required fields
    await page.fill('#input-current-age', '40');
    await page.click('[data-action="next"]');
    
    await page.fill('#input-retirement-age', '65');
    await page.click('[data-action="next"]');
    
    await page.fill('#input-target-income', '20000');
    await page.click('[data-action="next"]');
    
    await page.fill('#input-pension-pot', '500000');
    await page.waitForTimeout(200);
    
    // With £500k pot at 4% = £20k, should show surplus or near target
    const previewGap = page.locator('#preview-gap');
    await expect(previewGap).not.toContainText('—');
    
    // Screenshot
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/10-preview-card-surplus-${test.info().project.name}.png`,
      fullPage: true 
    });
  });

  test('preview card info tooltip toggles', async ({ page }) => {
    // Click info button
    await page.click('#preview-info-btn');
    
    // Tooltip should be visible
    await expect(page.locator('#preview-tooltip')).toHaveClass(/visible/);
    
    // Screenshot
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/11-preview-tooltip-${test.info().project.name}.png`,
      fullPage: true 
    });
  });
});
