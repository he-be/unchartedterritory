import { test, expect, Page } from '@playwright/test';
import type { GameState, TradeOpportunity } from '../src/types/game';

// Type for the game store
interface GameStore {
  gameState: GameState | null;
  selectedShipId: string | null;
  selectedSectorId: string | null;
  tradeOpportunities: TradeOpportunity[] | null;
  isLoading: boolean;
  error: string | null;
  pollingInterval: NodeJS.Timeout | null;
  getState: () => GameStore;
}

// Helper to wait for the game to load
async function waitForGameLoad(page: Page) {
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(2000); // Wait for initial render
}

// Helper to get console logs
async function setupConsoleLogging(page: Page) {
  const logs: string[] = [];
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`);
  });
  return logs;
}

test.describe('Coordinate System Debug', () => {
  let page: Page;
  let logs: string[] = [];

  test.beforeEach(async ({ browser }) => {
    // Start both backend and frontend servers
    page = await browser.newPage();
    logs = await setupConsoleLogging(page);
    
    // Navigate to the app
    await page.goto('http://localhost:3000');
    await waitForGameLoad(page);
  });

  test('Debug coordinate conversions and ship movement', async () => {
    // Wait for the sector map to be visible
    const canvas = await page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // Get canvas bounding box
    const box = await canvas.boundingBox();
    console.log('Canvas bounding box:', box);

    // Take a screenshot before clicking
    await page.screenshot({ path: 'before-click.png' });

    // Click at various positions and log the coordinates
    const testPositions = [
      { x: 100, y: 100, desc: 'top-left' },
      { x: 400, y: 300, desc: 'center' },
      { x: 700, y: 500, desc: 'bottom-right' },
    ];

    for (const pos of testPositions) {
      console.log(`\n--- Testing click at ${pos.desc} (${pos.x}, ${pos.y}) ---`);
      
      // Clear previous logs
      logs.length = 0;
      
      // Click on the canvas
      await canvas.click({ position: { x: pos.x, y: pos.y } });
      
      // Wait for any logs
      await page.waitForTimeout(500);
      
      // Print all console logs
      logs.forEach(log => console.log(log));
      
      // Check if command menu appears
      const commandMenu = await page.locator('.fixed.bg-gray-800').first();
      if (await commandMenu.isVisible()) {
        console.log('Command menu is visible');
        
        // Click "Move Here"
        await page.click('text=Move Here');
        await page.waitForTimeout(500);
        
        // Print logs after move command
        console.log('\nLogs after Move Here:');
        logs.forEach(log => console.log(log));
      }
      
      // Take screenshot after action
      await page.screenshot({ path: `after-click-${pos.desc}.png` });
    }

    // Evaluate JavaScript in the page to get game state
    const gameState = await page.evaluate(() => {
      // Access the game state from window if available
      const gameStore = (window as Window & { gameStore?: GameStore }).gameStore;
      if (gameStore && gameStore.getState) {
        const state = gameStore.getState();
        return {
          ships: state.gameState?.player?.ships || [],
          currentSector: state.selectedSectorId,
          sectors: state.gameState?.sectors || []
        };
      }
      return null;
    });

    console.log('\nGame State:', JSON.stringify(gameState, null, 2));

    // Check ship positions and movements
    if (gameState?.ships?.length > 0) {
      const ship = gameState.ships[0];
      console.log('\nShip details:');
      console.log('Position:', ship.position);
      console.log('Destination:', ship.destination);
      console.log('Is Moving:', ship.isMoving);
      console.log('Current Command:', ship.currentCommand);
    }
  });

  test('Analyze coordinate scaling', async () => {
    // Inject JavaScript to analyze the coordinate system
    const analysis = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;

      // Get some sample positions
      const results = {
        canvasSize: { width: canvas.width, height: canvas.height },
        scale: 0.08,
        worldBounds: { min: -5000, max: 5000 },
        conversions: [] as {
          screen: { x: number; y: number };
          world: { x: number; y: number };
          backToScreen: { x: number; y: number };
        }[]
      };

      // Test coordinate conversions
      const testPoints = [
        { screen: { x: 0, y: 0 } },
        { screen: { x: 400, y: 300 } },
        { screen: { x: 800, y: 600 } }
      ];

      for (const point of testPoints) {
        const worldX = (point.screen.x - canvas.width / 2) / 0.08;
        const worldY = (point.screen.y - canvas.height / 2) / 0.08;
        
        results.conversions.push({
          screen: point.screen,
          world: { x: worldX, y: worldY },
          backToScreen: {
            x: (worldX * 0.08) + canvas.width / 2,
            y: (worldY * 0.08) + canvas.height / 2
          }
        });
      }

      return results;
    });

    console.log('\nCoordinate Analysis:', JSON.stringify(analysis, null, 2));
  });

  test('Check actual rendered positions', async () => {
    // Take a screenshot and analyze what's actually rendered
    await page.screenshot({ path: 'sector-map-full.png', fullPage: true });

    // Inject code to draw debug overlays
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get game state
      const gameStore = (window as Window & { gameStore?: GameStore }).gameStore;
      if (!gameStore || !gameStore.getState) return;
      
      const state = gameStore.getState();
      const sector = state.gameState?.sectors?.find((s: { id: string }) => s.id === state.selectedSectorId);
      
      if (!sector) return;

      // Draw coordinate grid
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      
      // Draw world origin
      const originX = 0 * 0.08 + canvas.width / 2;
      const originY = 0 * 0.08 + canvas.height / 2;
      
      ctx.beginPath();
      ctx.moveTo(originX - 20, originY);
      ctx.lineTo(originX + 20, originY);
      ctx.moveTo(originX, originY - 20);
      ctx.lineTo(originX, originY + 20);
      ctx.stroke();
      
      ctx.fillStyle = 'red';
      ctx.font = '16px monospace';
      ctx.fillText('ORIGIN (0,0)', originX + 25, originY - 5);

      // Label all stations with their world coordinates
      if (sector.stations) {
        ctx.fillStyle = 'yellow';
        ctx.font = '12px monospace';
        
        sector.stations.forEach((station: { position: { x: number; y: number } }) => {
          const screenX = (station.position.x * 0.08) + canvas.width / 2;
          const screenY = (station.position.y * 0.08) + canvas.height / 2;
          
          const text = `(${Math.round(station.position.x)}, ${Math.round(station.position.y)})`;
          ctx.fillText(text, screenX - 30, screenY - 20);
        });
      }
    });

    // Take another screenshot with debug overlay
    await page.screenshot({ path: 'sector-map-debug-overlay.png' });
  });
});