// Tests for Uncharted Territory Game API

import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';

describe('Uncharted Territory Game API', () => {
  let gameId: string;

  beforeEach(async () => {
    // Create a new game for each test
    const response = await request(app)
      .post('/api/game/new')
      .expect(201);
    
    gameId = response.body.gameId;
  });

  describe('Game Lifecycle', () => {
    test('POST /api/game/new should create a new game', async () => {
      const response = await request(app)
        .post('/api/game/new')
        .expect(201);

      expect(response.body.gameId).toBeDefined();
      expect(response.body.message).toBe('New game created');
      expect(response.body.initialState).toMatchObject({
        playerId: 'Commander',
        credits: 100000,
        shipCount: 1
      });
    });

    test('GET /api/game/:gameId/state should return game state', async () => {
      const response = await request(app)
        .get(`/api/game/${gameId}/state`)
        .expect(200);

      expect(response.body.gameId).toBe(gameId);
      expect(response.body.player).toMatchObject({
        name: 'Commander',
        credits: 100000
      });
      expect(response.body.player.ships).toHaveLength(1);
      expect(response.body.discoveredSectors).toHaveLength(1);
    });

    test('GET /api/game/invalid/state should return 404', async () => {
      await request(app)
        .get('/api/game/invalid/state')
        .expect(404);
    });
  });

  describe('Sectors and Exploration', () => {
    test('GET /api/game/:gameId/sectors should return discovered sectors', async () => {
      const response = await request(app)
        .get(`/api/game/${gameId}/sectors`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1); // Only starting sector discovered
      expect(response.body[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        stationCount: expect.any(Number),
        gateCount: expect.any(Number)
      });
    });

    test('GET /api/game/:gameId/sectors/:sectorId should return sector details', async () => {
      // Get discovered sectors first
      const sectorsResponse = await request(app)
        .get(`/api/game/${gameId}/sectors`);
      
      const sectorId = sectorsResponse.body[0].id;

      const response = await request(app)
        .get(`/api/game/${gameId}/sectors/${sectorId}`)
        .expect(200);

      expect(response.body.id).toBe(sectorId);
      expect(response.body.stations).toBeDefined();
      expect(response.body.gates).toBeDefined();
      expect(response.body.wares).toBeDefined();
      expect(Array.isArray(response.body.stations)).toBe(true);
    });

    test('GET /api/game/:gameId/sectors/invalid should return 404', async () => {
      await request(app)
        .get(`/api/game/${gameId}/sectors/invalid`)
        .expect(404);
    });
  });

  describe('Ship Commands', () => {
    let shipId: string;
    let stationId: string;

    beforeEach(async () => {
      // Get game state to find ship and station
      const stateResponse = await request(app)
        .get(`/api/game/${gameId}/state`);
      
      shipId = stateResponse.body.player.ships[0].id;

      // Get sector details to find a station
      const sectorsResponse = await request(app)
        .get(`/api/game/${gameId}/sectors`);
      
      const sectorId = sectorsResponse.body[0].id;
      const sectorResponse = await request(app)
        .get(`/api/game/${gameId}/sectors/${sectorId}`);
      
      stationId = sectorResponse.body.stations[0].id;
    });

    test('POST /api/game/:gameId/ships/:shipId/commands should execute movement command', async () => {
      const command = {
        type: 'move',
        target: stationId
      };

      const response = await request(app)
        .post(`/api/game/${gameId}/ships/${shipId}/commands`)
        .send(command)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.ship.isMoving).toBe(true);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].type).toBe('movement');
    });

    test('POST /api/game/:gameId/ships/:shipId/commands should execute explore command', async () => {
      const command = {
        type: 'explore'
      };

      const response = await request(app)
        .post(`/api/game/${gameId}/ships/${shipId}/commands`)
        .send(command)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.events).toBeDefined();
    });

    test('POST /api/game/:gameId/ships/invalid/commands should return 404', async () => {
      const command = { type: 'move', target: stationId };

      await request(app)
        .post(`/api/game/${gameId}/ships/invalid/commands`)
        .send(command)
        .expect(404);
    });
  });

  describe('Trading System', () => {
    let shipId: string;
    let stationId: string;

    beforeEach(async () => {
      // Get ship and station for trading tests
      const stateResponse = await request(app)
        .get(`/api/game/${gameId}/state`);
      
      shipId = stateResponse.body.player.ships[0].id;

      const sectorsResponse = await request(app)
        .get(`/api/game/${gameId}/sectors`);
      
      const sectorId = sectorsResponse.body[0].id;
      const sectorResponse = await request(app)
        .get(`/api/game/${gameId}/sectors/${sectorId}`);
      
      // Find a trading port for testing
      const tradingPort = sectorResponse.body.stations.find((s: any) => 
        s.type === 'trading_port'
      );
      stationId = tradingPort?.id || sectorResponse.body.stations[0].id;
    });

    test('GET /api/game/:gameId/trade-opportunities should return opportunities', async () => {
      const response = await request(app)
        .get(`/api/game/${gameId}/trade-opportunities`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // May be empty initially, but should be an array
    });

    test('POST /api/game/:gameId/ships/:shipId/trade should handle trade attempt', async () => {
      // First, move ship close to station
      const moveCommand = {
        type: 'move',
        target: stationId
      };

      await request(app)
        .post(`/api/game/${gameId}/ships/${shipId}/commands`)
        .send(moveCommand);

      // Get sector details to find available wares
      const sectorsResponse = await request(app)
        .get(`/api/game/${gameId}/sectors`);
      
      const sectorId = sectorsResponse.body[0].id;
      const sectorResponse = await request(app)
        .get(`/api/game/${gameId}/sectors/${sectorId}`);

      const station = sectorResponse.body.stations.find((s: any) => s.id === stationId);
      const availableWare = station.wares.find((w: any) => w.sellPrice > 0 && w.quantity > 0);

      if (availableWare) {
        const tradeData = {
          stationId,
          action: 'buy',
          wareId: availableWare.wareId,
          quantity: 1
        };

        const response = await request(app)
          .post(`/api/game/${gameId}/ships/${shipId}/trade`)
          .send(tradeData);

        // May succeed or fail based on distance, but should return valid response
        expect([200, 400]).toContain(response.status);
      }
    });
  });

  describe('Player Information', () => {
    test('GET /api/game/:gameId/player should return player details', async () => {
      const response = await request(app)
        .get(`/api/game/${gameId}/player`)
        .expect(200);

      expect(response.body.name).toBe('Commander');
      expect(response.body.credits).toBe(100000);
      expect(response.body.ships).toHaveLength(1);
      expect(response.body.fleetStatus).toHaveLength(1);
      expect(response.body.totalCargoValue).toBeDefined();
    });
  });

  describe('Health and Info Endpoints', () => {
    test('GET / should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body.message).toContain('Uncharted Territory');
      expect(response.body.version).toBe('1.0.0-MVP');
      expect(response.body.endpoints).toBeDefined();
    });

    test('GET /health should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.service).toContain('Uncharted Territory');
      expect(response.body.activeGames).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('Should handle invalid game ID gracefully', async () => {
      await request(app)
        .get('/api/game/invalid-game-id/state')
        .expect(404);
    });

    test('Should handle malformed requests', async () => {
      const stateResponse = await request(app)
        .get(`/api/game/${gameId}/state`);
      
      const shipId = stateResponse.body.player.ships[0].id;

      const response = await request(app)
        .post(`/api/game/${gameId}/ships/${shipId}/commands`)
        .set('Content-Type', 'application/json')
        .send('invalid json');

      // Express might return 500 for malformed JSON
      expect([400, 500]).toContain(response.status);
    });

    test('Should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown/route');
      
      // May return 404 or 500 depending on route handling
      expect([404, 500]).toContain(response.status);
    });
  });
});