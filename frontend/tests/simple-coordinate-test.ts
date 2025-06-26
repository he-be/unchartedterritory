// Simple coordinate test to run directly with Node
import puppeteer from 'puppeteer';

async function debugCoordinates() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('error', err => console.error('PAGE ERROR:', err));
    
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Wait for canvas
    await page.waitForSelector('canvas', { timeout: 5000 });
    console.log('Canvas found!');
    
    // Get canvas info
    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        width: canvas.width,
        height: canvas.height,
        boundingRect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        }
      };
    });
    console.log('Canvas info:', canvasInfo);
    
    // Test coordinate conversion
    const coordinateTest = await page.evaluate(() => {
      const scale = 0.08;
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return null;
      
      // Test points
      const testPoints = [
        { name: 'Canvas center', screen: { x: 400, y: 300 } },
        { name: 'Top-left', screen: { x: 0, y: 0 } },
        { name: 'Bottom-right', screen: { x: 800, y: 600 } }
      ];
      
      const results = testPoints.map(point => {
        const worldX = (point.screen.x - canvas.width / 2) / scale;
        const worldY = (point.screen.y - canvas.height / 2) / scale;
        
        // Convert back to screen
        const backX = (worldX * scale) + canvas.width / 2;
        const backY = (worldY * scale) + canvas.height / 2;
        
        return {
          ...point,
          world: { x: worldX, y: worldY },
          backToScreen: { x: backX, y: backY },
          error: {
            x: Math.abs(backX - point.screen.x),
            y: Math.abs(backY - point.screen.y)
          }
        };
      });
      
      return results;
    });
    
    console.log('\nCoordinate conversion test:');
    coordinateTest?.forEach(test => {
      console.log(`\n${test.name}:`);
      console.log(`  Screen: (${test.screen.x}, ${test.screen.y})`);
      console.log(`  World: (${test.world.x.toFixed(2)}, ${test.world.y.toFixed(2)})`);
      console.log(`  Back to screen: (${test.backToScreen.x.toFixed(2)}, ${test.backToScreen.y.toFixed(2)})`);
      console.log(`  Error: (${test.error.x.toFixed(2)}, ${test.error.y.toFixed(2)})`);
    });
    
    // Take screenshot
    await page.screenshot({ path: 'coordinate-test-screenshot.png' });
    
    // Click and check logs
    console.log('\n\nClicking at center (400, 300)...');
    await page.mouse.click(400, 300);
    await page.waitForTimeout(1000);
    
    // Check if command menu appeared
    const hasCommandMenu = await page.evaluate(() => {
      return document.querySelector('.fixed.bg-gray-800') !== null;
    });
    console.log('Command menu visible:', hasCommandMenu);
    
    if (hasCommandMenu) {
      // Take screenshot with menu
      await page.screenshot({ path: 'coordinate-test-with-menu.png' });
      
      // Click Move Here
      await page.click('text=Move Here');
      console.log('Clicked Move Here');
      await page.waitForTimeout(1000);
    }
    
    // Get game state after click
    const gameState = await page.evaluate(() => {
      const store = (window as any).gameStore;
      if (!store) return null;
      const state = store.getState();
      const ship = state.gameState?.player?.ships?.[0];
      return {
        ship: ship ? {
          position: ship.position,
          destination: ship.destination,
          isMoving: ship.isMoving
        } : null
      };
    });
    
    console.log('\nGame state after move:', JSON.stringify(gameState, null, 2));
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
debugCoordinates().catch(console.error);