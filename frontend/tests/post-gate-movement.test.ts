import { test, expect } from '@playwright/test';

test.describe('Post-Gate Movement', () => {
  test('should continue moving to final destination after gate jump', async ({ page }) => {
    await page.goto('http://localhost:8787/');
    
    // Create game
    await page.fill('input[placeholder="Enter your player name"]', 'PostGateTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Select ship
    const shipInfo = page.locator('.ship-item').first();
    await shipInfo.click();
    
    // Switch to Three's Company view
    await page.click('button:has-text("Three\'s Company")');
    await page.waitForSelector('text=Sector Map: Three\'s Company');
    
    // Click on a specific position in Three's Company (not on gate)
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 200 } }); // Arbitrary position in sector
    
    // Ship should start moving (pathfinding will queue commands)
    await expect(shipInfo.locator('text=Status: Moving')).toBeVisible({ timeout: 5000 });
    
    // Check command queue appears during cross-sector movement
    await expect(page.locator('text=/Queue \\(\\d+\\):/').first()).toBeVisible({ timeout: 5000 });
    
    // Wait for pathfinding and gate jump to complete - ship should end up in Three's Company
    await expect(shipInfo.locator('text=Sector: threes-company')).toBeVisible({ timeout: 20000 });
    
    // Ship should eventually reach idle state at destination
    await expect(shipInfo.locator('text=Status: Idle')).toBeVisible({ timeout: 15000 });
    
    // Command queue should be empty when movement is complete
    const commandQueueVisible = await page.locator('text=/Queue \\(\\d+\\):/').first().isVisible();
    if (commandQueueVisible) {
      // If queue is still visible, it should be empty
      await expect(page.locator('text=/Queue \\(0\\):/').first()).toBeVisible();
    }
  });
});