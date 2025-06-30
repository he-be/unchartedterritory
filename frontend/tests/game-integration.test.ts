import { test, expect } from '@playwright/test';

test.describe('Uncharted Territory Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:43619/');
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
    await expect(page.locator('text=Credits: 10,000')).toBeVisible();
    await expect(page.locator('text=Connection: CONNECTED')).toBeVisible();
    
    // Verify sectors are loaded
    await expect(page.locator('text=Sectors (3)')).toBeVisible();
    await expect(page.locator('h4:has-text("Argon Prime")')).toBeVisible();
    await expect(page.locator('h4:has-text("Three\'s Company")')).toBeVisible();
    await expect(page.locator('h4:has-text("Elena\'s Fortune")')).toBeVisible();
    
    // Verify ship exists
    await expect(page.locator('text=Ships (1)')).toBeVisible();
    await expect(page.locator('text=Discovery')).toBeVisible();
  });

  test('should select ship and send move command', async ({ page }) => {
    // Create game first
    await page.fill('input[placeholder="Enter your player name"]', 'MoveTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Click on the ship to select it
    const shipInfo = page.locator('div').filter({ hasText: /^Discovery/ }).first();
    await shipInfo.click();
    
    // Verify ship is selected (should have blue border)
    await expect(shipInfo).toHaveCSS('border-color', 'rgb(74, 158, 255)');
    
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
    await page.waitForSelector('text=CONNECTED');
    
    // Verify connection status
    const connectionStatus = page.locator('text=Connection:').locator('..');
    await expect(connectionStatus).toContainText('CONNECTED');
  });

  test('should display map with stations and gates', async ({ page }) => {
    // Create game
    await page.fill('input[placeholder="Enter your player name"]', 'MapTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Verify map elements
    await expect(page.locator('text=Sector Map: Argon Prime')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    
    // Check sector information
    await expect(page.locator('text=Stations: 2').first()).toBeVisible();
    await expect(page.locator('text=Gates: 2').first()).toBeVisible();
  });

  test('should allow leaving and creating new game', async ({ page }) => {
    // Create first game
    await page.fill('input[placeholder="Enter your player name"]', 'LeaveTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Leave game
    await page.click('button:has-text("Leave Game")');
    
    // Should be back at create game screen
    await expect(page.locator('text=Create New Game')).toBeVisible();
    
    // Create another game
    await page.fill('input[placeholder="Enter your player name"]', 'NewGame');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Verify new game
    await expect(page.locator('text=Player: NewGame')).toBeVisible();
  });
});