import { describe, test, expect, beforeEach } from 'vitest';
import { ShipEngine } from '../ship-engine';
import { GameState, Ship, ShipCommand } from '../types';

describe('ShipEngine Cross-Sector Movement', () => {
  let testShip: Ship;
  let testGameState: GameState;

  beforeEach(() => {
    testShip = {
      id: 'test-ship',
      name: 'Discovery',
      type: 'scout',
      position: { x: 0, y: 0 },
      sectorId: 'sector1',
      maxSpeed: 300,
      cargoClass: 'M',
      cargoCapacity: 30,
      cargo: [],
      commandQueue: [],
      isMoving: false
    };

    testGameState = {
      id: 'test-game',
      player: {
        name: 'TestPlayer',
        credits: 100000,
        ships: [testShip],
        discoveredSectors: ['sector1', 'sector2', 'sector3']
      },
      sectors: [
        {
          id: 'sector1',
          name: 'Alpha Sector',
          discovered: true,
          stations: [
            { id: 'station1', name: 'Alpha Station', type: 'trading_port', position: { x: 200, y: 100 }, sectorId: 'sector1', wares: [], produces: [], consumes: [] }
          ],
          gates: [
            { id: 'gate1', position: { x: 500, y: 0 }, connectsTo: 'sector2' }
          ],
          asteroids: []
        },
        {
          id: 'sector2',
          name: 'Beta Sector',
          discovered: true,
          stations: [
            { id: 'station2', name: 'Beta Station', type: 'trading_port', position: { x: -200, y: -100 }, sectorId: 'sector2', wares: [], produces: [], consumes: [] }
          ],
          gates: [
            { id: 'gate2a', position: { x: -500, y: 0 }, connectsTo: 'sector1' },
            { id: 'gate2b', position: { x: 300, y: 0 }, connectsTo: 'sector3' }
          ],
          asteroids: []
        },
        {
          id: 'sector3',
          name: 'Gamma Sector',
          discovered: true,
          stations: [
            { id: 'station3', name: 'Gamma Station', type: 'trading_port', position: { x: 0, y: 200 }, sectorId: 'sector3', wares: [], produces: [], consumes: [] }
          ],
          gates: [
            { id: 'gate3', position: { x: -300, y: 0 }, connectsTo: 'sector2' }
          ],
          asteroids: []
        }
      ],
      galaxyMap: {
        sectors: {
          'sector1': { id: 'sector1', name: 'Alpha Sector', position: { x: 0, y: 0 }, discovered: true },
          'sector2': { id: 'sector2', name: 'Beta Sector', position: { x: 1000, y: 0 }, discovered: true },
          'sector3': { id: 'sector3', name: 'Gamma Sector', position: { x: 2000, y: 0 }, discovered: true }
        },
        connections: [
          { id: 'sector1-sector2', sectorA: 'sector1', sectorB: 'sector2', gateAId: 'gate1', gateBId: 'gate2a' },
          { id: 'sector2-sector3', sectorA: 'sector2', sectorB: 'sector3', gateAId: 'gate2b', gateBId: 'gate3' }
        ]
      },
      wares: [],
      gameTime: 0,
      lastUpdate: Date.now()
    };
  });

  describe('Cross-sector coordinate movement', () => {
    test('should plan route to coordinates in different sector with explicit targetSectorId', () => {
      const command: ShipCommand = {
        type: 'move',
        parameters: {
          x: -200, // Near Beta Station
          y: -100,
          targetSectorId: 'sector2'
        }
      };

      const events = ShipEngine.executeCommand(testShip, command, testGameState);

      // Should generate route planning event
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.message).toContain('planning cross-sector route');
      
      // Should add commands to command queue for gate traversal
      expect(testShip.commandQueue.length).toBeGreaterThan(0);
      
      // First command should be to move to gate1 (gate from sector1 to sector2)
      expect(testShip.commandQueue[0]?.type).toBe('move');
      expect(testShip.commandQueue[0]?.target).toBe('gate1');
      
      // Last command should be the final coordinate movement
      const lastCommand = testShip.commandQueue[testShip.commandQueue.length - 1];
      expect(lastCommand?.type).toBe('move');
      expect(lastCommand?.parameters?.x).toBe(-200);
      expect(lastCommand?.parameters?.y).toBe(-100);
    });

    test('should auto-detect target sector from coordinates when not specified', () => {
      const command: ShipCommand = {
        type: 'move',
        parameters: {
          x: -200, // Near Beta Station in sector2
          y: -100
          // No targetSectorId specified
        }
      };

      const events = ShipEngine.executeCommand(testShip, command, testGameState);

      // Should still generate route planning since coordinates are near Beta Station
      expect(events.length).toBeGreaterThan(0);
      
      // Should add commands for cross-sector movement
      expect(testShip.commandQueue.length).toBeGreaterThan(0);
      expect(testShip.commandQueue[0]?.target).toBe('gate1');
    });

    test('should handle multi-hop cross-sector movement', () => {
      const command: ShipCommand = {
        type: 'move',
        parameters: {
          x: 0, // Near Gamma Station in sector3
          y: 200,
          targetSectorId: 'sector3'
        }
      };

      const events = ShipEngine.executeCommand(testShip, command, testGameState);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.message).toContain('planning cross-sector route');
      
      // Should generate multiple gate commands (sector1 -> sector2 -> sector3)
      expect(testShip.commandQueue.length).toBeGreaterThan(2);
      
      // Should go through gate1 first (sector1 -> sector2)
      expect(testShip.commandQueue[0]?.target).toBe('gate1');
      
      // Then through gate2b (sector2 -> sector3)
      expect(testShip.commandQueue[1]?.target).toBe('gate2b');
    });

    test('should handle same-sector coordinate movement normally', () => {
      const command: ShipCommand = {
        type: 'move',
        parameters: {
          x: 200, // Near Alpha Station in current sector
          y: 100,
          targetSectorId: 'sector1' // Same as current sector
        }
      };

      ShipEngine.executeCommand(testShip, command, testGameState);

      // Should handle as normal movement, not cross-sector
      expect(testShip.isMoving).toBe(true);
      expect(testShip.destination).toEqual({ x: 200, y: 100 });
      expect(testShip.commandQueue.length).toBe(0); // No queue commands needed
    });

    test('should handle coordinates near current sector elements as same-sector movement', () => {
      const command: ShipCommand = {
        type: 'move',
        parameters: {
          x: 250, // Near Alpha Station
          y: 150
          // No targetSectorId - should auto-detect as sector1
        }
      };

      ShipEngine.executeCommand(testShip, command, testGameState);

      // Should handle as normal movement since coordinates are close to Alpha Station
      expect(testShip.isMoving).toBe(true);
      expect(testShip.destination).toEqual({ x: 250, y: 150 });
      expect(testShip.commandQueue.length).toBe(0);
    });

    test('should handle unreachable sector gracefully', () => {
      // Add isolated sector
      testGameState.sectors.push({
        id: 'sector4',
        name: 'Isolated Sector',
        discovered: true,
        stations: [
          { id: 'station4', name: 'Isolated Station', type: 'trading_port', position: { x: 0, y: 0 }, sectorId: 'sector4', wares: [], produces: [], consumes: [] }
        ],
        gates: [], // No gates - unreachable
        asteroids: []
      });

      const command: ShipCommand = {
        type: 'move',
        parameters: {
          x: 0,
          y: 0,
          targetSectorId: 'sector4'
        }
      };

      const events = ShipEngine.executeCommand(testShip, command, testGameState);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.message).toContain('Cannot find route');
      expect(testShip.commandQueue.length).toBe(0);
    });
  });

  describe('Sector detection from coordinates', () => {
    test('should detect sector based on proximity to stations', () => {
      // Use private method via any cast for testing
      const ShipEngineAny = ShipEngine as any;
      
      // Coordinates near Beta Station in sector2
      const sectorId = ShipEngineAny.findSectorByCoordinates({ x: -180, y: -80 }, testGameState);
      expect(sectorId).toBe('sector2');
      
      // Coordinates near Alpha Station in sector1
      const sectorId2 = ShipEngineAny.findSectorByCoordinates({ x: 220, y: 120 }, testGameState);
      expect(sectorId2).toBe('sector1');
    });

    test('should detect sector based on proximity to gates', () => {
      const ShipEngineAny = ShipEngine as any;
      
      // Coordinates near gate1 in sector1
      const sectorId = ShipEngineAny.findSectorByCoordinates({ x: 480, y: 20 }, testGameState);
      expect(sectorId).toBe('sector1');
    });

    test('should return null for coordinates too far from any sector elements', () => {
      const ShipEngineAny = ShipEngine as any;
      
      // Very distant coordinates
      const sectorId = ShipEngineAny.findSectorByCoordinates({ x: 10000, y: 10000 }, testGameState);
      expect(sectorId).toBeNull();
    });
  });
});