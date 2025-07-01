import { test, expect } from '@playwright/test';

test.describe('Sector Navigation', () => {
  test('should allow basic sector navigation', async ({ page }) => {
    // Create game first
    await page.goto('http://localhost:8787/');
    await page.fill('input[placeholder="Enter your player name"]', 'NavTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Click on the ship to select it
    const shipInfo = page.locator('.ship-item:has-text("Discovery")');
    await shipInfo.click();
    
    // Verify ship is selected
    await expect(shipInfo).toHaveCSS('border-color', 'rgb(88, 166, 255)');
    
    // Verify current sector is argon-prime
    await expect(shipInfo.locator('text=Sector: argon-prime')).toBeVisible();
  });
});