import { describe, test, expect, beforeEach } from 'vitest';
import { GalaxyNavigation } from '../galaxy-navigation';
import { GameState } from '../types';

describe('GalaxyNavigation', () => {
  let testGameState: GameState;

  beforeEach(() => {
    testGameState = {
      id: 'test-game',
      player: {
        name: 'TestPlayer',
        credits: 100000,
        ships: [],
        discoveredSectors: ['sector1', 'sector2']
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
          discovered: false,
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
          'sector3': { id: 'sector3', name: 'Sector 3', position: { x: 400, y: 0 }, discovered: false }
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

  describe('Gate finding', () => {
    test('should find all gates in galaxy', () => {
      const allGates = GalaxyNavigation.findAllGates(testGameState);
      
      expect(allGates).toHaveLength(4);
      expect(allGates.some(g => g.gateId === 'gate1')).toBe(true);
      expect(allGates.some(g => g.gateId === 'gate2a')).toBe(true);
      expect(allGates.some(g => g.gateId === 'gate2b')).toBe(true);
      expect(allGates.some(g => g.gateId === 'gate3')).toBe(true);
    });

    test('should find gate by ID across sectors', () => {
      const gateInfo = GalaxyNavigation.findGateById(testGameState, 'gate3');
      
      expect(gateInfo).not.toBeNull();
      expect(gateInfo!.gate.id).toBe('gate3');
      expect(gateInfo!.sector.id).toBe('sector3');
    });

    test('should return null for non-existent gate', () => {
      const gateInfo = GalaxyNavigation.findGateById(testGameState, 'non-existent');
      
      expect(gateInfo).toBeNull();
    });
  });

  describe('Connection finding', () => {
    test('should get connection for gate', () => {
      const connection = GalaxyNavigation.getConnectionForGate(testGameState, 'gate1');
      
      expect(connection).not.toBeNull();
      expect(connection!.id).toBe('sector1-sector2');
      expect(connection!.gateAId).toBe('gate1');
      expect(connection!.gateBId).toBe('gate2a');
    });

    test('should get opposite gate', () => {
      const connection = testGameState.galaxyMap.connections[0]!;
      
      const oppositeA = GalaxyNavigation.getOppositeGate(connection, 'gate1');
      const oppositeB = GalaxyNavigation.getOppositeGate(connection, 'gate2a');
      
      expect(oppositeA).toBe('gate2a');
      expect(oppositeB).toBe('gate1');
    });

    test('should get target sector', () => {
      const connection = testGameState.galaxyMap.connections[0]!;
      
      const targetFromA = GalaxyNavigation.getTargetSector(connection, 'sector1');
      const targetFromB = GalaxyNavigation.getTargetSector(connection, 'sector2');
      
      expect(targetFromA).toBe('sector2');
      expect(targetFromB).toBe('sector1');
    });
  });

  describe('Galaxy routing', () => {
    test('should find direct route between adjacent sectors', () => {
      const route = GalaxyNavigation.findGalaxyRoute(testGameState, 'sector1', 'sector2');
      
      expect(route).not.toBeNull();
      expect(route!.steps).toHaveLength(1);
      expect(route!.steps[0]!.fromSector).toBe('sector1');
      expect(route!.steps[0]!.toSector).toBe('sector2');
      expect(route!.steps[0]!.gateId).toBe('gate1');
      expect(route!.totalConnections).toBe(1);
    });

    test('should find multi-hop route', () => {
      const route = GalaxyNavigation.findGalaxyRoute(testGameState, 'sector1', 'sector3');
      
      expect(route).not.toBeNull();
      expect(route!.steps).toHaveLength(2);
      expect(route!.steps[0]!.fromSector).toBe('sector1');
      expect(route!.steps[0]!.toSector).toBe('sector2');
      expect(route!.steps[0]!.gateId).toBe('gate1');
      expect(route!.steps[1]!.fromSector).toBe('sector2');
      expect(route!.steps[1]!.toSector).toBe('sector3');
      expect(route!.steps[1]!.gateId).toBe('gate2b');
      expect(route!.totalConnections).toBe(2);
    });

    test('should return empty route for same sector', () => {
      const route = GalaxyNavigation.findGalaxyRoute(testGameState, 'sector1', 'sector1');
      
      expect(route).not.toBeNull();
      expect(route!.steps).toHaveLength(0);
      expect(route!.totalConnections).toBe(0);
    });

    test('should return null for unreachable sector', () => {
      // Add isolated sector
      testGameState.sectors.push({
        id: 'sector4',
        name: 'Isolated',
        discovered: false,
        stations: [],
        gates: [],
        asteroids: []
      });
      testGameState.galaxyMap.sectors['sector4'] = {
        id: 'sector4',
        name: 'Isolated',
        position: { x: 0, y: 200 },
        discovered: false
      };

      const route = GalaxyNavigation.findGalaxyRoute(testGameState, 'sector1', 'sector4');
      expect(route).toBeNull();
    });
  });

  describe('Discovery management', () => {
    test('should check sector discovery status', () => {
      expect(GalaxyNavigation.isSectorDiscovered(testGameState, 'sector1')).toBe(true);
      expect(GalaxyNavigation.isSectorDiscovered(testGameState, 'sector3')).toBe(false);
    });

    test('should get discovered sectors', () => {
      const discovered = GalaxyNavigation.getDiscoveredSectors(testGameState);
      
      expect(discovered).toContain('sector1');
      expect(discovered).toContain('sector2');
      expect(discovered).not.toContain('sector3');
    });

    test('should update sector as discovered', () => {
      expect(GalaxyNavigation.isSectorDiscovered(testGameState, 'sector3')).toBe(false);
      
      GalaxyNavigation.updateSectorDiscovered(testGameState, 'sector3');
      
      expect(GalaxyNavigation.isSectorDiscovered(testGameState, 'sector3')).toBe(true);
    });

    test('should get sector position', () => {
      const position = GalaxyNavigation.getSectorPosition(testGameState, 'sector2');
      
      expect(position).toEqual({ x: 200, y: 0 });
    });
  });
});