import { describe, test, expect } from 'vitest';
import { NavigationEngine } from '../navigation-engine';
import { GameState } from '../types';

describe('NavigationEngine', () => {
  const createTestGameState = (): GameState => ({
    id: 'test-game',
    player: {
      name: 'TestPlayer',
      credits: 100000,
      ships: [],
      discoveredSectors: ['sector1', 'sector2', 'sector3']
    },
    sectors: [
      {
        id: 'sector1',
        name: 'Sector 1',
        discovered: true,
        stations: [],
        gates: [
          { id: 'gate1', position: { x: 100, y: 0 }, connectsTo: 'sector2' }
        ],
        asteroids: []
      },
      {
        id: 'sector2', 
        name: 'Sector 2',
        discovered: true,
        stations: [],
        gates: [
          { id: 'gate2a', position: { x: -100, y: 0 }, connectsTo: 'sector1' },
          { id: 'gate2b', position: { x: 100, y: 0 }, connectsTo: 'sector3' }
        ],
        asteroids: []
      },
      {
        id: 'sector3',
        name: 'Sector 3', 
        discovered: true,
        stations: [],
        gates: [
          { id: 'gate3', position: { x: -100, y: 0 }, connectsTo: 'sector2' }
        ],
        asteroids: []
      }
    ],
    galaxyMap: {
      sectors: {
        'sector1': { id: 'sector1', name: 'Sector 1', position: { x: 0, y: 0 }, discovered: true },
        'sector2': { id: 'sector2', name: 'Sector 2', position: { x: 200, y: 0 }, discovered: true },
        'sector3': { id: 'sector3', name: 'Sector 3', position: { x: 400, y: 0 }, discovered: true }
      },
      connections: [
        { id: 'sector1-sector2', sectorA: 'sector1', sectorB: 'sector2', gateAId: 'gate1', gateBId: 'gate2a' },
        { id: 'sector2-sector3', sectorA: 'sector2', sectorB: 'sector3', gateAId: 'gate2b', gateBId: 'gate3' }
      ]
    },
    wares: [],
    gameTime: 0,
    lastUpdate: Date.now()
  });

  describe('findRoute', () => {
    test('should return empty route for same sector', () => {
      const gameState = createTestGameState();
      const route = NavigationEngine.findRoute(gameState, 'sector1', 'sector1');
      
      expect(route).not.toBeNull();
      expect(route!.steps).toHaveLength(0);
      expect(route!.totalDistance).toBe(0);
      expect(route!.estimatedTime).toBe(0);
    });

    test('should find direct route between adjacent sectors', () => {
      const gameState = createTestGameState();
      const route = NavigationEngine.findRoute(gameState, 'sector1', 'sector2');
      
      expect(route).not.toBeNull();
      expect(route!.steps).toHaveLength(1);
      expect(route!.steps[0]).toMatchObject({
        fromSectorId: 'sector1',
        toSectorId: 'sector2',
        gateId: 'gate1'
      });
    });

    test('should find multi-hop route', () => {
      const gameState = createTestGameState();
      const route = NavigationEngine.findRoute(gameState, 'sector1', 'sector3');
      
      expect(route).not.toBeNull();
      expect(route!.steps).toHaveLength(2);
      expect(route!.steps[0]?.fromSectorId).toBe('sector1');
      expect(route!.steps[0]?.toSectorId).toBe('sector2');
      expect(route!.steps[1]?.fromSectorId).toBe('sector2');
      expect(route!.steps[1]?.toSectorId).toBe('sector3');
    });

    test('should return null for unreachable sectors', () => {
      const gameState = createTestGameState();
      // Add isolated sector
      gameState.sectors.push({
        id: 'sector4',
        name: 'Isolated',
        discovered: true,
        stations: [],
        gates: [],
        asteroids: []
      });

      const route = NavigationEngine.findRoute(gameState, 'sector1', 'sector4');
      expect(route).toBeNull();
    });

    test('should calculate travel time correctly', () => {
      const gameState = createTestGameState();
      const route = NavigationEngine.findRoute(gameState, 'sector1', 'sector2', 300);
      
      expect(route).not.toBeNull();
      expect(route!.estimatedTime).toBeGreaterThan(0);
      
      // With 5000 distance and 300 speed = 16.67 seconds
      expect(route!.estimatedTime).toBeCloseTo(16.67, 1);
    });
  });

  describe('helper methods', () => {
    test('isSectorDiscovered should check discovery status', () => {
      const gameState = createTestGameState();
      gameState.sectors[0]!.discovered = true;
      gameState.sectors[1]!.discovered = false;

      expect(NavigationEngine.isSectorDiscovered(gameState, 'sector1')).toBe(true);
      expect(NavigationEngine.isSectorDiscovered(gameState, 'sector2')).toBe(false);
      expect(NavigationEngine.isSectorDiscovered(gameState, 'unknown')).toBe(false);
    });

    test('getConnectedSectors should return discovered neighbors', () => {
      const gameState = createTestGameState();
      gameState.sectors[0]!.discovered = true;
      gameState.sectors[1]!.discovered = true;
      gameState.sectors[2]!.discovered = false;

      const connected = NavigationEngine.getConnectedSectors(gameState, 'sector2');
      expect(connected).toContain('sector1');
      expect(connected).not.toContain('sector3');
    });

    test('estimateTravelTime should include gate jump time', () => {
      const route = {
        steps: [
          { fromSectorId: 'a', toSectorId: 'b', gateId: 'g1', distance: 3000 },
          { fromSectorId: 'b', toSectorId: 'c', gateId: 'g2', distance: 4000 }
        ],
        totalDistance: 7000,
        estimatedTime: 23.33
      };

      const time = NavigationEngine.estimateTravelTime(route, 300, 5);
      // Travel time: 7000/300 = 23.33 seconds
      // Jump time: 2 jumps * 5 seconds = 10 seconds  
      // Total: 33.33 seconds
      expect(time).toBeCloseTo(33.33, 1);
    });
  });
});