import { test, expect } from '@playwright/test';

test.describe('Auto-Trade Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8787/');
  });

  test('should show auto-trade toggle button for ships', async ({ page }) => {
    // Create game
    await page.fill('input[placeholder="Enter your player name"]', 'AutoTradeTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Check that ships are visible
    await expect(page.locator('text=Ships (2)')).toBeVisible();
    
    // Check Discovery ship (should have auto-trade OFF initially)
    const discoveryShip = page.locator('.ship-item:has-text("Discovery")');
    await expect(discoveryShip).toBeVisible();
    await expect(discoveryShip.locator('button:has-text("Auto-Trade: OFF")')).toBeVisible();
    
    // Check Trader ship (should have auto-trade ON initially)
    const traderShip = page.locator('.ship-item:has-text("Trader")');
    await expect(traderShip).toBeVisible();
    await expect(traderShip.locator('button:has-text("Auto-Trade: ON")')).toBeVisible();
  });



  test('should verify Trader ship auto-trade is working', async ({ page }) => {
    // Create game
    await page.fill('input[placeholder="Enter your player name"]', 'TraderTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Select Trader ship
    const traderShip = page.locator('.ship-item:has-text("Trader")');
    await traderShip.click();
    
    // Trader should already have auto-trade ON
    await expect(traderShip.locator('button:has-text("Auto-Trade: ON")')).toBeVisible();
    
    // Trader should have command queue with trading commands
    await expect(traderShip.locator('text=/Queue \\(\\d+\\):/').first()).toBeVisible();
    
    // Verify trading commands are present
    const hasTradingCommands = traderShip.locator('.command-queued:has-text("dock_at_station"), .command-current:has-text("dock_at_station"), .command-queued:has-text("move_to_gate"), .command-current:has-text("move_to_gate")');
    await expect(hasTradingCommands.first()).toBeVisible();
  });
});