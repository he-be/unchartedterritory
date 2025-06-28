import { describe, test, expect, beforeEach } from 'vitest';
import { ShipEngine } from '../ship-engine';
import { GameState, Ship, ShipCommand } from '../types';

describe('ShipEngine Cross-Sector Station Docking', () => {
  let testShip: Ship;
  let testGameState: GameState;

  beforeEach(() => {
    testShip = {
      id: 'test-ship',
      name: 'Merchant',
      type: 'trader',
      position: { x: 0, y: 0 },
      sectorId: 'sector1',
      maxSpeed: 300,
      cargoClass: 'M',
      cargoCapacity: 50,
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

  describe('Direct cross-sector station docking', () => {
    test('should plan route to station in adjacent sector', () => {
      // Ship in sector1 wants to dock at station2 in sector2
      const command: ShipCommand = {
        type: 'move',
        target: 'station2' // Station in sector2
      };

      const events = ShipEngine.executeCommand(testShip, command, testGameState);

      // Should generate route planning event
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.message).toContain('planning cross-sector route to station station2');
      
      // Should add commands to command queue for gate traversal and final station approach
      expect(testShip.commandQueue.length).toBeGreaterThan(0);
      
      // First command should be to move to gate1 (gate from sector1 to sector2)
      expect(testShip.commandQueue[0]?.type).toBe('move');
      expect(testShip.commandQueue[0]?.target).toBe('gate1');
      
      // Last command should be the final station movement
      const lastCommand = testShip.commandQueue[testShip.commandQueue.length - 1];
      expect(lastCommand?.type).toBe('move');
      expect(lastCommand?.target).toBe('station2');
    });

    test('should plan multi-hop route to station in distant sector', () => {
      // Ship in sector1 wants to dock at station3 in sector3 (requires going through sector2)
      const command: ShipCommand = {
        type: 'move',
        target: 'station3' // Station in sector3
      };

      const events = ShipEngine.executeCommand(testShip, command, testGameState);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.message).toContain('planning cross-sector route to station station3');
      
      // Should generate multiple gate commands (sector1 -> sector2 -> sector3)
      expect(testShip.commandQueue.length).toBeGreaterThan(2);
      
      // Should go through gate1 first (sector1 -> sector2)
      expect(testShip.commandQueue[0]?.target).toBe('gate1');
      
      // Then through gate2b (sector2 -> sector3)
      expect(testShip.commandQueue[1]?.target).toBe('gate2b');
      
      // Final command should be to dock at station3
      const lastCommand = testShip.commandQueue[testShip.commandQueue.length - 1];
      expect(lastCommand?.target).toBe('station3');
    });

    test('should handle same-sector station normally', () => {
      // Ship in sector1 wants to dock at station1 in sector1 (same sector)
      const command: ShipCommand = {
        type: 'move',
        target: 'station1' // Station in same sector
      };

      ShipEngine.executeCommand(testShip, command, testGameState);

      // Should handle as normal movement, not cross-sector
      expect(testShip.isMoving).toBe(true);
      expect(testShip.destination).toEqual({ x: 200, y: 100 });
      expect(testShip.commandQueue.length).toBe(0); // No queue commands needed
    });

    test('should handle non-existent station gracefully', () => {
      const command: ShipCommand = {
        type: 'move',
        target: 'nonexistent-station'
      };

      ShipEngine.executeCommand(testShip, command, testGameState);

      // Should not crash and should not move
      expect(testShip.isMoving).toBe(false);
      expect(testShip.commandQueue.length).toBe(0);
    });

    test('should handle unreachable station gracefully', () => {
      // Add isolated sector with unreachable station
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
        target: 'station4'
      };

      const events = ShipEngine.executeCommand(testShip, command, testGameState);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.message).toContain('Cannot find route to station station4');
      expect(testShip.commandQueue.length).toBe(0);
    });
  });

  describe('findStationInAllSectors helper method', () => {
    test('should find station in correct sector', () => {
      const ShipEngineAny = ShipEngine as any;
      
      const result = ShipEngineAny.findStationInAllSectors('station2', testGameState);
      expect(result).toBeDefined();
      expect(result.station.id).toBe('station2');
      expect(result.sectorId).toBe('sector2');
    });

    test('should return null for non-existent station', () => {
      const ShipEngineAny = ShipEngine as any;
      
      const result = ShipEngineAny.findStationInAllSectors('nonexistent', testGameState);
      expect(result).toBeNull();
    });

    test('should find station in first matching sector', () => {
      // Add duplicate station ID (shouldn't happen in real game, but test edge case)
      testGameState.sectors[2]!.stations.push({
        id: 'station1', // Same ID as in sector1
        name: 'Duplicate Station',
        type: 'trading_port',
        position: { x: 100, y: 100 },
        sectorId: 'sector3',
        wares: [],
        produces: [],
        consumes: []
      });

      const ShipEngineAny = ShipEngine as any;
      
      const result = ShipEngineAny.findStationInAllSectors('station1', testGameState);
      expect(result).toBeDefined();
      expect(result.sectorId).toBe('sector1'); // Should find first match
    });
  });
});