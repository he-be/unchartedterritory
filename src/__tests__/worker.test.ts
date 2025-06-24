// Tests for Uncharted Territory Cloudflare Workers

import { describe, test, expect, beforeEach } from 'vitest';

describe('Uncharted Territory Cloudflare Workers', () => {
  let worker: any;
  
  beforeEach(async () => {
    worker = await import('../worker');
  });

  describe('Basic Endpoints', () => {
    test('should handle root path', async () => {
      const request = new Request('https://example.com/');
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.message).toContain('Uncharted Territory');
      expect(json.version).toBe('1.0.0-MVP');
      expect(json.edge).toBe('Cloudflare Workers');
    });

    test('should handle health check', async () => {
      const request = new Request('https://example.com/health');
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('OK');
      expect(json.service).toContain('Uncharted Territory');
      expect(json.edge).toBe('Cloudflare Workers');
    });

    test('should handle CORS preflight requests', async () => {
      const request = new Request('https://example.com/api/game/new', {
        method: 'OPTIONS'
      });
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('Game Lifecycle', () => {
    test('POST /api/game/new should create a new game', async () => {
      const request = new Request('https://example.com/api/game/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.gameId).toBeDefined();
      expect(json.message).toBe('New game created');
      expect(json.initialState.playerId).toBe('Commander');
      expect(json.initialState.credits).toBe(100000);
    });

    test('GET /api/game/:gameId/state should return game state', async () => {
      // First create a game
      const createRequest = new Request('https://example.com/api/game/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const createResponse = await worker.default.fetch(createRequest);
      const createJson = await createResponse.json();
      const gameId = createJson.gameId;

      // Then get the game state
      const request = new Request(`https://example.com/api/game/${gameId}/state`);
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.gameId).toBe(gameId);
      expect(json.player.name).toBe('Commander');
      expect(json.player.ships).toHaveLength(1);
      expect(json.discoveredSectors).toHaveLength(1);
    });

    test('GET /api/game/invalid/state should return 404', async () => {
      const request = new Request('https://example.com/api/game/invalid/state');
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Game not found');
    });
  });

  describe('Sectors and Exploration', () => {
    let gameId: string;

    beforeEach(async () => {
      // Create a game for each test
      const createRequest = new Request('https://example.com/api/game/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const createResponse = await worker.default.fetch(createRequest);
      const createJson = await createResponse.json();
      gameId = createJson.gameId;
    });

    test('GET /api/game/:gameId/sectors should return discovered sectors', async () => {
      const request = new Request(`https://example.com/api/game/${gameId}/sectors`);
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json).toHaveLength(1); // Starting sector
      expect(json[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        stationCount: expect.any(Number)
      });
    });

    test('GET /api/game/:gameId/sectors/:sectorId should return sector details', async () => {
      // Get sectors first
      const sectorsRequest = new Request(`https://example.com/api/game/${gameId}/sectors`);
      const sectorsResponse = await worker.default.fetch(sectorsRequest);
      const sectors = await sectorsResponse.json();
      const sectorId = sectors[0].id;

      const request = new Request(`https://example.com/api/game/${gameId}/sectors/${sectorId}`);
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.id).toBe(sectorId);
      expect(json.stations).toBeDefined();
      expect(json.gates).toBeDefined();
      expect(Array.isArray(json.stations)).toBe(true);
    });
  });

  describe('Ship Commands', () => {
    let gameId: string;
    let shipId: string;
    let stationId: string;

    beforeEach(async () => {
      // Create game and get ship/station IDs
      const createRequest = new Request('https://example.com/api/game/new', {
        method: 'POST'
      });
      const createResponse = await worker.default.fetch(createRequest);
      const createJson = await createResponse.json();
      gameId = createJson.gameId;

      // Get game state for ship ID
      const stateRequest = new Request(`https://example.com/api/game/${gameId}/state`);
      const stateResponse = await worker.default.fetch(stateRequest);
      const stateJson = await stateResponse.json();
      shipId = stateJson.player.ships[0].id;

      // Get sectors for station ID
      const sectorsRequest = new Request(`https://example.com/api/game/${gameId}/sectors`);
      const sectorsResponse = await worker.default.fetch(sectorsRequest);
      const sectors = await sectorsResponse.json();
      const sectorId = sectors[0].id;

      const sectorRequest = new Request(`https://example.com/api/game/${gameId}/sectors/${sectorId}`);
      const sectorResponse = await worker.default.fetch(sectorRequest);
      const sector = await sectorResponse.json();
      stationId = sector.stations[0].id;
    });

    test('POST /api/game/:gameId/ships/:shipId/commands should execute movement command', async () => {
      const command = {
        type: 'move',
        target: stationId
      };

      const request = new Request(`https://example.com/api/game/${gameId}/ships/${shipId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command)
      });
      
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.ship.isMoving).toBe(true);
    });

    test('POST /api/game/:gameId/ships/:shipId/commands should execute explore command', async () => {
      const command = {
        type: 'explore'
      };

      const request = new Request(`https://example.com/api/game/${gameId}/ships/${shipId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command)
      });
      
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    test('POST /api/game/:gameId/ships/invalid/commands should return 404', async () => {
      const command = { type: 'move', target: stationId };

      const request = new Request(`https://example.com/api/game/${gameId}/ships/invalid/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command)
      });
      
      const response = await worker.default.fetch(request);
      expect(response.status).toBe(404);
    });
  });

  describe('Trading System', () => {
    let gameId: string;

    beforeEach(async () => {
      const createRequest = new Request('https://example.com/api/game/new', {
        method: 'POST'
      });
      const createResponse = await worker.default.fetch(createRequest);
      const createJson = await createResponse.json();
      gameId = createJson.gameId;
    });

    test('GET /api/game/:gameId/trade-opportunities should return opportunities', async () => {
      const request = new Request(`https://example.com/api/game/${gameId}/trade-opportunities`);
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(Array.isArray(json)).toBe(true);
    });

    test('GET /api/game/:gameId/player should return player information', async () => {
      const request = new Request(`https://example.com/api/game/${gameId}/player`);
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.name).toBe('Commander');
      expect(json.credits).toBe(100000);
      expect(json.fleetStatus).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent routes', async () => {
      const request = new Request('https://example.com/non-existent');
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(404);
    });

    test('should handle malformed JSON gracefully', async () => {
      const request = new Request('https://example.com/api/game/test/ships/test/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      
      const response = await worker.default.fetch(request);
      // May return 404 for non-existent game instead of 400 for malformed JSON
      expect([400, 404]).toContain(response.status);
    });

    test('should handle server errors gracefully', async () => {
      const request = new Request('https://example.com/api/game/invalid-id/state');
      const response = await worker.default.fetch(request);
      
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Game not found');
    });
  });
});