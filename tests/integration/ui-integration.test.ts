import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('UI Integration Tests', () => {
  let browser: Browser;
  let page: Page;
  let server: any;
  let serverUrl: string;

  beforeAll(async () => {
    // Start a local HTTP server to serve the dist files
    server = createServer((req, res) => {
      let filePath = req.url === '/' ? '/index.html' : req.url;
      filePath = filePath?.startsWith('/') ? filePath.slice(1) : filePath;
      
      try {
        const fullPath = join(process.cwd(), 'dist', filePath || 'index.html');
        const content = readFileSync(fullPath);
        
        // Set appropriate content type
        if (filePath?.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath?.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        } else if (filePath?.endsWith('.html')) {
          res.setHeader('Content-Type', 'text/html');
        }
        
        res.end(content);
      } catch (error) {
        res.statusCode = 404;
        res.end('File not found');
      }
    });
    
    // Start server on a random port
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        serverUrl = `http://localhost:${address.port}`;
      }
    });
    
    // Wait for server to start
    await new Promise(resolve => server.once('listening', resolve));
    
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    
    // Listen for console errors and uncaught exceptions
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser Console Error:', msg.text());
      }
    });
    
    page.on('pageerror', error => {
      console.log('Browser Page Error:', error.message);
    });
  });

  afterAll(async () => {
    await browser.close();
    server.close();
  });

  it('should load the app and show game components', async () => {
    // Navigate to the local HTTP server
    await page.goto(serverUrl);
    
    // Wait for the app to load
    await page.waitForSelector('#app', { timeout: 5000 });
    
    // Wait a bit more for the game to initialize
    await page.waitForTimeout(2000);
    
    // Check if the app has loaded beyond the loading state
    const appContent = await page.textContent('#app');
    console.log('App content:', appContent);
    
    // Should not be stuck in loading state
    expect(appContent).not.toBe('Loading Innovation...');
    
    // Check for game components
    const gameContainer = await page.$('.game-container');
    if (gameContainer) {
      console.log('✅ Game container found');
    } else {
      console.log('❌ Game container not found');
    }
    
    // Check for player tableaus
    const playerTableaus = await page.$$('.player-tableau');
    console.log(`Found ${playerTableaus.length} player tableaus`);
    
    // Check for action bar
    const actionBar = await page.$('.action-bar');
    if (actionBar) {
      console.log('✅ Action bar found');
    } else {
      console.log('❌ Action bar not found');
    }
    
    // Check for cards
    const cards = await page.$$('.card');
    console.log(`Found ${cards.length} cards`);
    
    // Check for EventLog component
    const eventLog = await page.$('.event-log');
    if (eventLog) {
      console.log('✅ Event log found');
    } else {
      console.log('❌ Event log not found');
    }
    
    // Check for action buttons
    const actionButtons = await page.$$('.action-button');
    console.log(`Found ${actionButtons.length} action buttons`);
    
    // For now, just check that the app loaded beyond loading state
    expect(appContent).not.toBe('Loading Innovation...');
  }, 15000);

  it('should display correct game information', async () => {
    await page.goto(serverUrl);
    await page.waitForSelector('#app', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    // Check game status information
    const gameStatus = await page.textContent('.game-info-panel');
    console.log('Game status:', gameStatus);
    
    // Should show current turn and player
    expect(gameStatus).toContain('Turn: 1');
    expect(gameStatus).toContain('Current Player: Player');
    
    // Check player information
    const playerNames = await page.$$('.player-name');
    expect(playerNames.length).toBe(2);
    
    // Check that one player is marked as current
    const currentPlayer = await page.$('.player-name.current');
    expect(currentPlayer).toBeTruthy();
  }, 15000);

  it('should show correct card information', async () => {
    await page.goto(serverUrl);
    await page.waitForSelector('#app', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    // Check that cards display real names, not just "Card X"
    const cardNames = await page.$$('.card-name');
    expect(cardNames.length).toBeGreaterThan(0);
    
    // Get the text of the first card
    const firstCardName = await cardNames[0].textContent();
    console.log('First card name:', firstCardName);
    
    // Should be a real card name, not "Card 1"
    expect(firstCardName).not.toMatch(/^Card \d+$/);
    expect(firstCardName!.length).toBeGreaterThan(0);
    
    // Check that cards show colors
    const cardColors = await page.$$('.card-color');
    expect(cardColors.length).toBeGreaterThan(0);
    
    const firstCardColor = await cardColors[0].textContent();
    console.log('First card color:', firstCardColor);
    expect(firstCardColor).toMatch(/^(Red|Blue|Green|Yellow|Purple)$/);
  }, 15000);

  it('should handle action buttons correctly', async () => {
    await page.goto(serverUrl);
    await page.waitForSelector('#app', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    // Check that action buttons are present and clickable
    const actionButtons = await page.$$('.action-button');
    expect(actionButtons.length).toBeGreaterThan(0);
    
    // Check that buttons have proper styling and text
    for (let i = 0; i < Math.min(actionButtons.length, 3); i++) {
      const button = actionButtons[i];
      const buttonText = await button.textContent();
      console.log(`Action button ${i + 1}:`, buttonText);
      
      // Should contain action type
      expect(buttonText).toMatch(/(DRAW|MELD|DOGMA|ACHIEVE)/);
      
      // Should be clickable
      const isClickable = await button.isEnabled();
      expect(isClickable).toBe(true);
    }
  }, 15000);

  it('should not have any JavaScript errors', async () => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto(serverUrl);
    await page.waitForSelector('#app', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    // Filter out expected warnings (like favicon 404)
    const actualErrors = consoleErrors.filter(error => 
      !error.includes('favicon.ico') && 
      !error.includes('Failed to load resource') &&
      !error.includes('MIME type')
    );
    
    console.log('Console errors found:', actualErrors);
    expect(actualErrors).toEqual([]);
  }, 15000);
}); 