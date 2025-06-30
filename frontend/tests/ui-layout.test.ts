import { test, expect } from '@playwright/test';

test.describe('UI Layout and Design', () => {
  test('should display terminal-style 3-pane layout', async ({ page }) => {
    await page.goto('http://localhost:43619/');
    
    // Create game to see main layout
    await page.fill('input[placeholder="Enter your player name"]', 'UITest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Check header exists and has correct styling
    const header = page.locator('.header');
    await expect(header).toBeVisible();
    await expect(header).toHaveCSS('background-color', 'rgb(22, 27, 34)');
    
    // Check 3-pane layout exists
    const gameLayout = page.locator('.game-layout');
    await expect(gameLayout).toBeVisible();
    await expect(gameLayout).toHaveCSS('display', 'flex');
    
    // Check left pane (ships) exists and has correct width
    const leftPane = page.locator('.left-pane');
    await expect(leftPane).toBeVisible();
    await expect(leftPane).toHaveCSS('width', '300px');
    await expect(leftPane).toHaveCSS('background-color', 'rgb(22, 27, 34)');
    
    // Check center pane (map) exists and is flexible
    const centerPane = page.locator('.center-pane');
    await expect(centerPane).toBeVisible();
    await expect(centerPane).toHaveCSS('flex-grow', '1');
    
    // Check right pane (stations) exists and has correct width  
    const rightPane = page.locator('.right-pane');
    await expect(rightPane).toBeVisible();
    await expect(rightPane).toHaveCSS('width', '300px');
    await expect(rightPane).toHaveCSS('background-color', 'rgb(22, 27, 34)');
  });

  test('should display ship list in left pane with proper styling', async ({ page }) => {
    await page.goto('http://localhost:43619/');
    await page.fill('input[placeholder="Enter your player name"]', 'ShipTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Check ships section in left pane
    const shipsCard = page.locator('.left-pane .card').first();
    await expect(shipsCard).toBeVisible();
    await expect(shipsCard.locator('h3')).toHaveText('Ships (1)');
    
    // Check ship item styling
    const shipItem = page.locator('.ship-item').first();
    await expect(shipItem).toBeVisible();
    await expect(shipItem).toHaveCSS('background-color', 'rgb(33, 38, 45)');
    await expect(shipItem).toHaveCSS('border-color', 'rgb(48, 54, 61)');
    
    // Check ship can be selected
    await shipItem.click();
    await expect(shipItem).toHaveCSS('border-color', 'rgb(88, 166, 255)');
    
    // Check ship details are visible
    await expect(shipItem.locator('.ship-name')).toContainText('Discovery');
    await expect(shipItem.locator('.ship-details').first()).toContainText('Position:');
    await expect(shipItem.locator('.ship-details').nth(2)).toContainText('Status:');
  });

  test('should display map in center pane with sector buttons', async ({ page }) => {
    await page.goto('http://localhost:43619/');
    await page.fill('input[placeholder="Enter your player name"]', 'MapTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Check map container
    const mapContainer = page.locator('.map-container');
    await expect(mapContainer).toBeVisible();
    
    // Check map header with sector buttons
    const mapHeader = page.locator('.map-header');
    await expect(mapHeader).toBeVisible();
    await expect(mapHeader).toHaveCSS('background-color', 'rgb(22, 27, 34)');
    
    // Check sector buttons are in map header
    const sectorButtons = page.locator('.sector-buttons');
    await expect(sectorButtons).toBeVisible();
    
    // Check individual sector buttons
    await expect(page.locator('.sector-buttons button:has-text("Argon Prime")')).toBeVisible();
    await expect(page.locator('.sector-buttons button:has-text("Three\'s Company")')).toBeVisible();
    await expect(page.locator('.sector-buttons button:has-text("Elena\'s Fortune")')).toBeVisible();
    
    // Check canvas is present
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveCSS('border-color', 'rgb(48, 54, 61)');
  });

  test('should display stations in right pane', async ({ page }) => {
    await page.goto('http://localhost:43619/');
    await page.fill('input[placeholder="Enter your player name"]', 'StationTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Check stations section in right pane
    const stationsCard = page.locator('.right-pane .card').first();
    await expect(stationsCard).toBeVisible();
    await expect(stationsCard.locator('h3')).toHaveText('Stations');
    
    // Check station items exist
    const stationItems = page.locator('.station-item');
    await expect(stationItems.first()).toBeVisible();
    
    // Check station item styling
    const firstStation = stationItems.first();
    await expect(firstStation).toHaveCSS('background-color', 'rgb(33, 38, 45)');
    await expect(firstStation).toHaveCSS('border-color', 'rgb(48, 54, 61)');
    
    // Check sector info section
    const sectorInfoCard = page.locator('.right-pane .card').nth(1);
    await expect(sectorInfoCard).toBeVisible();
    await expect(sectorInfoCard.locator('h3')).toHaveText('Sector Info');
  });

  test('should use terminal-style colors and fonts', async ({ page }) => {
    await page.goto('http://localhost:43619/');
    
    // Check body has monospace font
    await expect(page.locator('body')).toHaveCSS('font-family', /mono/i);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(13, 17, 23)');
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(240, 246, 252)');
    
    // Check game creation card styling
    const gameCreation = page.locator('.game-creation');
    await expect(gameCreation).toBeVisible();
    await expect(gameCreation).toHaveCSS('background-color', 'rgb(22, 27, 34)');
    await expect(gameCreation).toHaveCSS('border-color', 'rgb(48, 54, 61)');
    
    // Check input styling
    const input = page.locator('.input');
    await expect(input).toHaveCSS('background-color', 'rgb(33, 38, 45)');
    await expect(input).toHaveCSS('border-color', 'rgb(48, 54, 61)');
    await expect(input).toHaveCSS('color', 'rgb(240, 246, 252)');
    
    // Check primary button styling
    const button = page.locator('.button.primary');
    await expect(button).toHaveCSS('background-color', 'rgb(88, 166, 255)');
    await expect(button).toHaveCSS('border-color', 'rgb(88, 166, 255)');
  });

  test('should be responsive and fill viewport', async ({ page }) => {
    // Test at different viewport sizes
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('http://localhost:43619/');
    
    // Container should fill viewport height - check that it has the height style
    const container = page.locator('.container');
    const containerHeight = await container.evaluate(el => window.getComputedStyle(el).height);
    expect(parseInt(containerHeight)).toBeGreaterThan(600); // Should be viewport height
    
    // Test at larger size
    await page.setViewportSize({ width: 1600, height: 1000 });
    
    await page.fill('input[placeholder="Enter your player name"]', 'ResponsiveTest');
    await page.click('button:has-text("Create Game")');
    await page.waitForSelector('text=Game Status');
    
    // Game layout should still be properly arranged
    const gameLayout = page.locator('.game-layout');
    await expect(gameLayout).toHaveCSS('display', 'flex');
    
    // Center pane should expand to fill available space
    const centerPane = page.locator('.center-pane');
    await expect(centerPane).toHaveCSS('flex-grow', '1');
  });
});