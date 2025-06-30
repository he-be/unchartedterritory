import { test, expect } from '@playwright/test';

test.describe('Command Queue Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8787/');
  });

  test('should display command queue when ship has pending commands', async ({ page }) => {
    // Create game
    await page.fill('input[placeholder="Enter your player name"]', 'QueueTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Select ship
    const shipInfo = page.locator('div').filter({ hasText: /^Discovery/ }).first();
    await shipInfo.click();
    
    // Switch to Elena's Fortune view (requires multi-hop)
    await page.click('button:has-text("Elena\'s Fortune")');
    await page.waitForSelector('text=Viewing: Elena\'s Fortune');
    
    // Click on Elena's Fortune map - should create multi-hop command queue
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 300, y: 200 } });
    
    // Wait for command queue to appear
    await page.waitForTimeout(1000);
    
    // Check for command queue display
    const commandQueue = page.locator('text=Command Queue').first();
    await expect(commandQueue).toBeVisible();
    
    // Check for specific command types
    const moveToGate = page.locator('text=/move_to_gate/').first();
    await expect(moveToGate).toBeVisible();
    
    // Should show current command
    const currentCommand = page.locator('text=/▶ Current:/').first();
    await expect(currentCommand).toBeVisible();
  });

  test('should update command queue as commands are executed', async ({ page }) => {
    // Create game
    await page.fill('input[placeholder="Enter your player name"]', 'QueueUpdateTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Select ship
    const shipInfo = page.locator('div').filter({ hasText: /^Discovery/ }).first();
    await shipInfo.click();
    
    // Move to a nearby gate first
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 640, y: 300 } }); // Gate position
    
    // Wait for initial queue count
    await page.waitForTimeout(1000);
    
    // Get initial queue count if visible
    const initialQueue = await page.locator('text=/Command Queue \\(\\d+\\):/').textContent();
    
    // Wait for ship to move and queue to update
    await page.waitForTimeout(3000);
    
    // Queue should either be gone or have fewer commands
    const updatedQueue = await page.locator('text=/Command Queue \\(\\d+\\):/').textContent();
    
    // If both are visible, count should have decreased
    if (initialQueue && updatedQueue) {
      const initialCount = parseInt(initialQueue.match(/\((\d+)\)/)?.[1] || '0');
      const updatedCount = parseInt(updatedQueue.match(/\((\d+)\)/)?.[1] || '0');
      expect(updatedCount).toBeLessThan(initialCount);
    }
  });
});