import { Hono } from 'hono';
import type { Env } from './types';
import { GameSession } from './game-session';

const app = new Hono<{ Bindings: Env }>();

// Simple CORS middleware
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (c.req.method === 'OPTIONS') {
    return new Response('', { status: 204 });
  }
  
  await next();
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// Game API routes
app.post('/api/game/new', async (c) => {
  try {
    console.log('POST /api/game/new - Starting game creation');
    
    // Check if GAME_SESSION binding exists
    if (!c.env.GAME_SESSION) {
      console.error('GAME_SESSION binding not found');
      return c.json({ 
        error: 'Service unavailable - GAME_SESSION binding missing',
        details: 'Durable Object binding not configured properly'
      }, 503);
    }
    
    const gameId = crypto.randomUUID();
    console.log(`Generated game ID: ${gameId}`);
    
    // Create new game session Durable Object
    const durableObjectId = c.env.GAME_SESSION.idFromName(gameId);
    const gameSession = c.env.GAME_SESSION.get(durableObjectId);
    
    // Create URL with gameId parameter
    const url = new URL(c.req.url);
    url.searchParams.set('gameId', gameId);
    
    // Forward request to Durable Object with gameId
    const newRequest = new Request(url.toString(), {
      method: c.req.method,
      headers: c.req.header(),
      body: c.req.raw.body
    });
    
    console.log('Forwarding request to Durable Object');
    const response = await gameSession.fetch(newRequest);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Durable Object returned error: ${response.status} - ${errorText}`);
      return c.json({ 
        error: 'Failed to create game in Durable Object',
        details: errorText,
        status: response.status
      }, 500);
    }
    
    const gameState = await response.json() as object;
    console.log('Game created successfully');
    return c.json(gameState);
  } catch (error) {
    console.error('Error creating new game:', error);
    return c.json({ 
      error: 'Failed to create game',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

app.get('/api/game/:gameId/state', async (c) => {
  try {
    const gameId = c.req.param('gameId');
    
    // Get game session Durable Object
    const durableObjectId = c.env.GAME_SESSION.idFromName(gameId);
    const gameSession = c.env.GAME_SESSION.get(durableObjectId);
    
    // Forward request to Durable Object
    const response = await gameSession.fetch(c.req.raw);
    
    if (!response.ok) {
      return c.json({ error: 'Game not found' }, 404);
    }
    
    const gameState = await response.json() as object;
    return c.json(gameState);
  } catch (error) {
    console.error('Error getting game state:', error);
    return c.json({ error: 'Failed to get game state' }, 500);
  }
});

// WebSocket endpoint for real-time communication
app.get('/api/game/:gameId/ws', async (c) => {
  const gameId = c.req.param('gameId');
  
  // Validate WebSocket upgrade
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 400 });
  }

  try {
    // Get game session Durable Object
    const durableObjectId = c.env.GAME_SESSION.idFromName(gameId);
    const gameSession = c.env.GAME_SESSION.get(durableObjectId);
    
    // Forward WebSocket upgrade to Durable Object
    return gameSession.fetch(c.req.raw);
  } catch (error) {
    console.error('Error establishing WebSocket connection:', error);
    return new Response('Failed to establish connection', { status: 500 });
  }
});

// Handle all other routes
app.all('*', (c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Export the Durable Object class
export { GameSession };

// Export the main worker
export default app;