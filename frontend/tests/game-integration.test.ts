import { test, expect } from '@playwright/test';

test.describe('Uncharted Territory Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8787/');
  });

  test('should create a new game and display game state', async ({ page }) => {
    // Enter player name
    await page.fill('input[placeholder="Enter your player name"]', 'TestPlayer');
    
    // Click create game button
    await page.click('button:has-text("Create Game")');
    
    // Wait for game to load
    await page.waitForSelector('text=Game Status');
    
    // Verify game state
    await expect(page.locator('text=Player: TestPlayer')).toBeVisible();
    await expect(page.locator('text=Credits: 25,000')).toBeVisible();
    await expect(page.locator('.status.connected')).toBeVisible();
    
    // Verify sectors are loaded (now in right pane)
    await expect(page.locator('text=Sector Info')).toBeVisible();
    await expect(page.locator('.right-pane .station-name:has-text("Argon Prime")')).toBeVisible();
    await expect(page.locator('.right-pane .station-name:has-text("Advanced Tech Factory")')).toBeVisible();
    await expect(page.locator('.right-pane .station-name:has-text("Technology Research Laboratory")')).toBeVisible();
    
    // Verify ships exist (Discovery + Trader cargo ship)
    await expect(page.locator('text=Ships (2)')).toBeVisible();
    await expect(page.locator('text=Discovery')).toBeVisible();
    await expect(page.locator('text=Trader')).toBeVisible();
  });

  test('should select ship and send move command', async ({ page }) => {
    // Create game first
    await page.fill('input[placeholder="Enter your player name"]', 'MoveTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Click on the ship to select it
    const shipInfo = page.locator('.ship-item:has-text("Discovery")');
    await shipInfo.click();
    
    // Verify ship is selected (should have blue border)
    await expect(shipInfo).toHaveCSS('border-color', 'rgb(88, 166, 255)');
    
    // Click on the map canvas to move the ship
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 600, y: 200 } });
    
    // Wait for ship to start moving (status should change to "Moving")
    await expect(shipInfo.locator('text=Status: Moving')).toBeVisible({ timeout: 5000 });
    
    // Wait for ship movement to complete
    await expect(shipInfo.locator('text=Status: Idle')).toBeVisible({ timeout: 15000 });
  });

  test('should handle WebSocket connection properly', async ({ page }) => {
    // Create game
    await page.fill('input[placeholder="Enter your player name"]', 'WSTest');
    await page.click('button:has-text("Create Game")');
    
    // Wait for WebSocket connection
    await page.waitForSelector('.status.connected');
    
    // Verify connection status
    await expect(page.locator('.status.connected')).toBeVisible();
  });

  test('should display map with stations and gates', async ({ page }) => {
    // Create game
    await page.fill('input[placeholder="Enter your player name"]', 'MapTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Verify map elements
    await expect(page.locator('text=Sector Map: Argon Prime')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    
    // Check that Argon Prime has 3 stations
    await expect(page.locator('text=Stations: 3').first()).toBeVisible();
    await expect(page.locator('text=Gates: 4').first()).toBeVisible();
  });

});