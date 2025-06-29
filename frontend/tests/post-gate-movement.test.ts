import { test, expect } from '@playwright/test';

test.describe('Post-Gate Movement', () => {
  test('should continue moving to final destination after gate jump', async ({ page }) => {
    await page.goto('http://localhost:39173/');
    
    // Create game
    await page.fill('input[placeholder="Enter your player name"]', 'PostGateTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Select ship
    const shipInfo = page.locator('div').filter({ hasText: /^Discovery/ }).first();
    await shipInfo.click();
    
    // Listen for console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });
    
    // Switch to Three's Company view
    await page.click('button:has-text("Three\'s Company")');
    await page.waitForSelector('text=Viewing: Three\'s Company');
    
    // Click on a specific position in Three's Company (not on gate)
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 200 } }); // Arbitrary position in sector
    
    // Wait for movement to start
    await page.waitForTimeout(1000);
    
    // Check command queue shows multiple steps
    await expect(page.locator('text=Command Queue')).toBeVisible();
    await expect(page.locator('text=move_to_gate').first()).toBeVisible();
    
    // Check for final move_to_position command in queue
    const commandQueueSection = page.locator('div').filter({ hasText: /^Command Queue \(\d+\):/ });
    const commandQueueText = await commandQueueSection.textContent();
    expect(commandQueueText).toContain('move_to_position');
    
    // Wait for ship to reach gate and jump
    await page.waitForTimeout(8000);
    
    // Ship should now be in Three's Company and moving to final position
    const shipStatus = await shipInfo.textContent();
    console.log('Ship status after gate jump wait:', shipStatus);
    expect(shipStatus).toContain('threes-company');
    expect(shipStatus).toContain('Moving'); // Should still be moving after gate jump
    
    // Wait for final arrival
    await page.waitForTimeout(8000);
    
    // Ship should now be idle at destination
    const finalStatus = await shipInfo.textContent();
    console.log('Final ship status:', finalStatus);
    expect(finalStatus).toContain('Idle');
    
    // Command queue should be empty
    const commandQueueVisible = await page.locator('text=Command Queue').isVisible();
    expect(commandQueueVisible).toBe(false);
  });
});