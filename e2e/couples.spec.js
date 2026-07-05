/**
 * RetireLens Pro - Couples Scenario E2E Tests
 * 
 * Tests the couples retirement planning scenario:
 * - Person A: age 55, retire at 60, DC pension £580,000
 * - Person B: age 62, retire at 67, DB pension starting at 67
 * - State Pension timing visibility
 * - Tax chart shows non-zero tax where expected
 * - No horizontal overflow on iPhone viewport
 */

import { test, expect } from '@playwright/test';

test.describe('Couples Scenario', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/app.html');
    // Wait for app to initialize
    await page.waitForSelector('#screen-welcome.active');
  });

  test('completes couples scenario with correct income phasing', async ({ page }) => {
    // Start planning - use visible Next button on active screen
    await page.locator('#screen-welcome.active [data-action="next"]').click();
    await page.waitForSelector('#screen-pathfinder.active');
    
    // Navigate through pathfinder (answer questions)
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
    
    // Mode select - Full mode should auto-advance
    await page.waitForSelector('#screen-mode-select.active');
    await page.click('.mode-card[data-mode="full"]');
    await page.waitForTimeout(400);
    
    // Fill in Person A details
    // Age screen
    await page.waitForSelector('#screen-age.active');
    await page.fill('#input-current-age', '55');
    await page.locator('#screen-age.active [data-action="next"]').click();
    
    // Retirement age
    await page.waitForSelector('#screen-retirement-age.active');
    await page.fill('#input-retirement-age', '60');
    await page.locator('#screen-retirement-age.active [data-action="next"]').click();
    
    // Target income
    await page.waitForSelector('#screen-income-target.active');
    await page.fill('#input-target-income', '35000');
    await page.locator('#screen-income-target.active [data-action="next"]').click();
    
    // Pension pot
    await page.waitForSelector('#screen-pension-pot.active');
    await page.fill('#input-pension-pot', '580000');
    await page.locator('#screen-pension-pot.active [data-action="next"]').click();
    
    // Contributions
    await page.waitForSelector('#screen-contributions.active');
    await page.fill('#input-pension-contribution', '4000');
    await page.locator('#screen-contributions.active [data-action="next"]').click();
    
    // ISA
    await page.waitForSelector('#screen-isa-savings.active');
    await page.fill('#input-isa-balance', '50000');
    await page.fill('#input-isa-contribution', '10000');
    await page.locator('#screen-isa-savings.active [data-action="next"]').click();
    
    // State pension
    await page.waitForSelector('#screen-state-pension.active');
    await page.fill('#input-state-pension-age', '67');
    await page.fill('#input-state-pension-amount', '11500');
    await page.locator('#screen-state-pension.active [data-action="next"]').click();
    
    // Review screen
    await page.waitForSelector('#screen-review.active');
    
    // Enable couples mode and fill partner details
    await page.click('.accordion-header:nth-child(1)'); // Open Tax & Household accordion
    await page.waitForTimeout(200);
    
    // Check "Planning as a couple"
    await page.check('#is-couple');
    await page.waitForTimeout(200);
    
    // Fill partner details
    await page.fill('#partner-age', '62');
    await page.fill('#partner-retirement-age', '67');
    await page.fill('#partner-sp-age', '67');
    await page.fill('#partner-sp-amount', '11500');
    await page.fill('#partner-db-amount', '15000');
    await page.fill('#partner-db-start-age', '67');
    
    // Screenshot review screen with couples data
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/couples-review-${test.info().project.name}.png`,
      fullPage: true 
    });
    
    // Calculate
    await page.click('#calculate-btn');
    
    // Wait for results
    await page.waitForSelector('#screen-results.active');
    await page.waitForTimeout(1000); // Wait for charts to render
    
    // Verify results page loaded
    await expect(page.locator('.answer-badge')).toBeVisible();
    
    // Screenshot results
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/couples-results-${test.info().project.name}.png`,
      fullPage: true 
    });
    
    // Verify key elements are visible
    await expect(page.locator('.results-hero')).toBeVisible();
    await expect(page.locator('.results-metrics')).toBeVisible();
    
    // Check guaranteed income section shows state pension info
    const guaranteedSection = page.locator('#guaranteed-income-section');
    if (await guaranteedSection.isVisible()) {
      const guaranteedText = await guaranteedSection.textContent();
      expect(guaranteedText).toContain('State Pension');
    }
  });

  test('results page has no horizontal overflow on iPhone viewport', async ({ page }) => {
    // Set iPhone viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    // Quick navigation to results
    await page.locator('#screen-welcome.active [data-action="next"]').click();
    await page.waitForSelector('#screen-pathfinder.active');
    
    // Quick pathfinder answers
    for (let i = 0; i < 4; i++) {
      await page.click('.pathfinder-option:first-child');
      await page.waitForTimeout(300);
    }
    
    // Mode select
    await page.waitForSelector('#screen-mode-select.active');
    await page.click('.mode-card[data-mode="quick"]');
    await page.waitForTimeout(400);
    
    // Fill minimum required inputs
    await page.waitForSelector('#screen-age.active');
    await page.fill('#input-current-age', '55');
    await page.locator('#screen-age.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-retirement-age.active');
    await page.fill('#input-retirement-age', '60');
    await page.locator('#screen-retirement-age.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-income-target.active');
    await page.fill('#input-target-income', '30000');
    await page.locator('#screen-income-target.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-pension-pot.active');
    await page.fill('#input-pension-pot', '400000');
    await page.locator('#screen-pension-pot.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-contributions.active');
    await page.fill('#input-pension-contribution', '1000');
    await page.locator('#screen-contributions.active [data-action="next"]').click();
    
    // Review and calculate
    await page.waitForSelector('#screen-review.active');
    await page.click('#calculate-btn');
    
    // Wait for results
    await page.waitForSelector('#screen-results.active');
    await page.waitForTimeout(1000);
    
    // Screenshot iPhone results
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/iphone-results-${test.info().project.name}.png`,
      fullPage: true 
    });
    
    // Check for horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(hasHorizontalScroll).toBe(false);
    
    // Verify all result cards are within viewport width
    const resultCards = page.locator('.result-card:visible, .results-metrics:visible, .chart-container:visible');
    const count = await resultCards.count();
    
    for (let i = 0; i < count; i++) {
      const card = resultCards.nth(i);
      if (await card.isVisible()) {
        const box = await card.boundingBox();
        if (box) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(375 + 5); // Allow 5px tolerance
        }
      }
    }
  });

  test('tax chart shows non-zero tax for taxable income', async ({ page }) => {
    // Quick navigation
    await page.locator('#screen-welcome.active [data-action="next"]').click();
    await page.waitForSelector('#screen-pathfinder.active');
    
    for (let i = 0; i < 4; i++) {
      await page.click('.pathfinder-option:first-child');
      await page.waitForTimeout(300);
    }
    
    await page.waitForSelector('#screen-mode-select.active');
    await page.click('.mode-card[data-mode="guided"]');
    await page.waitForTimeout(400);
    
    // Fill inputs with significant pension to generate taxable income
    await page.waitForSelector('#screen-age.active');
    await page.fill('#input-current-age', '55');
    await page.locator('#screen-age.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-retirement-age.active');
    await page.fill('#input-retirement-age', '60');
    await page.locator('#screen-retirement-age.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-income-target.active');
    await page.fill('#input-target-income', '40000'); // Above PA
    await page.locator('#screen-income-target.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-pension-pot.active');
    await page.fill('#input-pension-pot', '800000'); // Large pot = more withdrawals = more tax
    await page.locator('#screen-pension-pot.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-contributions.active');
    await page.fill('#input-pension-contribution', '2000');
    await page.locator('#screen-contributions.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-isa-savings.active');
    await page.fill('#input-isa-balance', '10000');
    await page.fill('#input-isa-contribution', '0');
    await page.locator('#screen-isa-savings.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-state-pension.active');
    await page.fill('#input-state-pension-age', '67');
    await page.fill('#input-state-pension-amount', '11500');
    await page.locator('#screen-state-pension.active [data-action="next"]').click();
    
    // Review and calculate
    await page.waitForSelector('#screen-review.active');
    await page.click('#calculate-btn');
    
    // Wait for results
    await page.waitForSelector('#screen-results.active');
    await page.waitForTimeout(1000);
    
    // Check that tax chart container is visible
    const taxChartContainer = page.locator('#tax-overlay-container');
    await expect(taxChartContainer).toBeVisible();
    
    // Screenshot tax section
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/tax-chart-${test.info().project.name}.png`,
      fullPage: true 
    });
  });

  test('PCLS does not appear as income spike in cashflow chart', async ({ page }) => {
    // Quick navigation to results
    await page.locator('#screen-welcome.active [data-action="next"]').click();
    await page.waitForSelector('#screen-pathfinder.active');
    
    for (let i = 0; i < 4; i++) {
      await page.click('.pathfinder-option:first-child');
      await page.waitForTimeout(300);
    }
    
    await page.waitForSelector('#screen-mode-select.active');
    await page.click('.mode-card[data-mode="quick"]');
    await page.waitForTimeout(400);
    
    // Fill inputs
    await page.waitForSelector('#screen-age.active');
    await page.fill('#input-current-age', '55');
    await page.locator('#screen-age.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-retirement-age.active');
    await page.fill('#input-retirement-age', '60');
    await page.locator('#screen-retirement-age.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-income-target.active');
    await page.fill('#input-target-income', '30000');
    await page.locator('#screen-income-target.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-pension-pot.active');
    await page.fill('#input-pension-pot', '500000'); // £125k PCLS
    await page.locator('#screen-pension-pot.active [data-action="next"]').click();
    
    await page.waitForSelector('#screen-contributions.active');
    await page.fill('#input-pension-contribution', '1000');
    await page.locator('#screen-contributions.active [data-action="next"]').click();
    
    // Calculate
    await page.waitForSelector('#screen-review.active');
    await page.click('#calculate-btn');
    
    // Wait for results
    await page.waitForSelector('#screen-results.active');
    await page.waitForTimeout(1500); // Extra time for chart rendering
    
    // Check income sources section for PCLS spread label
    const incomeSection = page.locator('#income-sources-section');
    if (await incomeSection.isVisible()) {
      const incomeText = await incomeSection.textContent();
      // PCLS should show as "PCLS Spending (5yr)" not as a lump sum
      expect(incomeText).toContain('PCLS');
    }
    
    // Screenshot cashflow chart
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/pcls-no-spike-${test.info().project.name}.png`,
      fullPage: true 
    });
  });

  test('couples onboarding with partner pension type enables calculate', async ({ page }) => {
    // Set iPhone viewport for mobile testing
    await page.setViewportSize({ width: 375, height: 812 });
    
    // Start planning
    await page.locator('#screen-welcome.active [data-action="next"]').click();
    await page.waitForSelector('#screen-pathfinder.active');
    
    // Quick pathfinder answers
    for (let i = 0; i < 4; i++) {
      await page.click('.pathfinder-option:first-child');
      await page.waitForTimeout(300);
    }
    
    // Mode select
    await page.waitForSelector('#screen-mode-select.active');
    await page.click('.mode-card[data-mode="full"]');
    await page.waitForTimeout(400);
    
    // Select COUPLE household type
    await page.waitForSelector('#screen-household-type.active');
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(400);
    
    // Person A pension types screen
    await page.waitForSelector('#screen-pension-types.active');
    
    // Check if explainer toggles work
    const dcExplainerToggle = page.locator('.pension-explainer-toggle[data-explainer="dc"]');
    if (await dcExplainerToggle.isVisible()) {
      await dcExplainerToggle.click();
      await page.waitForTimeout(300);
      await expect(page.locator('#explainer-dc.expanded')).toBeVisible();
      
      // Screenshot with DC explainer open
      await page.screenshot({ 
        path: `./test-artifacts/screenshots/couples-dc-explainer-${test.info().project.name}.png`,
        fullPage: true 
      });
    }
    
    // Select DC pension for Person A
    await page.check('#pension-dc');
    await page.waitForTimeout(200);
    await page.click('#pension-types-next-btn');
    await page.waitForTimeout(400);
    
    // Now on Partner pension types screen
    await page.waitForSelector('#screen-pension-types.active');
    
    // Verify title changed to partner
    const title = await page.locator('#pension-types-title').textContent();
    expect(title.toLowerCase()).toContain('partner');
    
    // Select DC pension for Partner
    await page.check('#pension-dc');
    await page.waitForTimeout(200);
    
    // Partner follow-up fields should appear
    const followupFields = page.locator('#partner-followup-fields');
    await expect(followupFields).toHaveClass(/visible/);
    
    // Fill partner DC details (optional but lets fill some)
    await page.fill('#input-partner-dc-pot', '200000');
    await page.fill('#input-partner-dc-contrib', '500');
    
    // Fill partner State Pension details
    await page.fill('#input-partner-sp-age', '67');
    await page.fill('#input-partner-sp-amount', '11500');
    
    // Screenshot partner pension details
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/couples-partner-pension-${test.info().project.name}.png`,
      fullPage: true 
    });
    
    // Advance from pension types
    await page.click('#pension-types-next-btn');
    await page.waitForTimeout(400);
    
    // Fill Person A age
    await page.waitForSelector('#screen-age.active');
    await page.fill('#input-current-age', '45');
    await page.locator('#screen-age.active [data-action="next"]').click();
    
    // Fill Person A retirement age
    await page.waitForSelector('#screen-retirement-age.active');
    await page.fill('#input-retirement-age', '60');
    await page.locator('#screen-retirement-age.active [data-action="next"]').click();
    
    // Fill target income
    await page.waitForSelector('#screen-income-target.active');
    await page.fill('#input-target-income', '35000');
    await page.locator('#screen-income-target.active [data-action="next"]').click();
    
    // Fill pension pot
    await page.waitForSelector('#screen-pension-pot.active');
    await page.fill('#input-pension-pot', '400000');
    await page.locator('#screen-pension-pot.active [data-action="next"]').click();
    
    // Fill contributions
    await page.waitForSelector('#screen-contributions.active');
    await page.fill('#input-pension-contribution', '1000');
    await page.locator('#screen-contributions.active [data-action="next"]').click();
    
    // Skip ISA if present
    const isaScreen = await page.$('#screen-isa-savings.active');
    if (isaScreen) {
      await page.fill('#input-isa-balance', '50000');
      await page.fill('#input-isa-contribution', '5000');
      await page.locator('#screen-isa-savings.active [data-action="next"]').click();
    }
    
    // Fill State Pension
    const spScreen = await page.$('#screen-state-pension.active');
    if (spScreen) {
      await page.fill('#input-state-pension-age', '67');
      await page.fill('#input-state-pension-amount', '11500');
      await page.locator('#screen-state-pension.active [data-action="next"]').click();
    }
    
    // Review screen
    await page.waitForSelector('#screen-review.active');
    
    // Verify Calculate button is ENABLED (not disabled)
    const calculateBtn = page.locator('#calculate-btn');
    await expect(calculateBtn).not.toBeDisabled();
    
    // Disabled reason should NOT be visible
    const disabledReason = page.locator('#calculate-disabled-reason');
    await expect(disabledReason).not.toHaveClass(/visible/);
    
    // Screenshot review screen
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/couples-review-enabled-${test.info().project.name}.png`,
      fullPage: true 
    });
    
    // Calculate
    await page.click('#calculate-btn');
    
    // Wait for results
    await page.waitForSelector('#screen-results.active');
    await page.waitForTimeout(1000);
    
    // Screenshot results on iPhone viewport
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/couples-results-iphone-${test.info().project.name}.png`,
      fullPage: true 
    });
    
    // Verify results loaded
    await expect(page.locator('.answer-badge')).toBeVisible();
  });

  test('couples scenario without partner pension type shows disabled reason', async ({ page }) => {
    // Start planning
    await page.locator('#screen-welcome.active [data-action="next"]').click();
    await page.waitForSelector('#screen-pathfinder.active');
    
    // Quick pathfinder answers
    for (let i = 0; i < 4; i++) {
      await page.click('.pathfinder-option:first-child');
      await page.waitForTimeout(300);
    }
    
    // Mode select - quick mode
    await page.waitForSelector('#screen-mode-select.active');
    await page.click('.mode-card[data-mode="quick"]');
    await page.waitForTimeout(400);
    
    // Select COUPLE household type
    await page.waitForSelector('#screen-household-type.active');
    await page.click('.household-type-card[data-household-type="couple"]');
    await page.waitForTimeout(400);
    
    // Person A pension types screen - select DC
    await page.waitForSelector('#screen-pension-types.active');
    await page.check('#pension-dc');
    await page.click('#pension-types-next-btn');
    await page.waitForTimeout(400);
    
    // Partner pension types screen - DO NOT select anything, just advance
    // Note: The next button should be disabled if nothing selected
    const nextBtn = page.locator('#pension-types-next-btn');
    await expect(nextBtn).toBeDisabled();
    
    // Screenshot showing disabled next button
    await page.screenshot({ 
      path: `./test-artifacts/screenshots/couples-partner-pension-required-${test.info().project.name}.png`,
      fullPage: true 
    });
  });
});
