import { describe, test, expect, beforeEach } from 'vitest';
import { AutoTradeEngine, AutoTradeState } from '../auto-trade-engine';
import { GameState, Ship } from '../types';

describe('AutoTradeEngine', () => {
  let testShip: Ship;
  let testGameState: GameState;

  beforeEach(() => {
    testShip = {
      id: 'trader-ship',
      name: 'Auto Trader',
      type: 'trader',
      position: { x: 0, y: 0 },
      sectorId: 'sector1',
      maxSpeed: 400,
      cargoClass: 'L',
      cargoCapacity: 100,
      cargo: [],
      commandQueue: [],
      isMoving: false
    };

    testGameState = {
      id: 'test-game',
      player: {
        name: 'TestPlayer',
        credits: 50000,
        ships: [testShip],
        discoveredSectors: ['sector1', 'sector2']
      },
      sectors: [
        {
          id: 'sector1',
          name: 'Trade Hub Alpha',
          discovered: true,
          stations: [
            {
              id: 'station1',
              name: 'Mining Station',
              type: 'mine',
              position: { x: 200, y: 0 },
              sectorId: 'sector1',
              produces: ['iron'],
              consumes: [],
              wares: [
                {
                  wareId: 'iron',
                  quantity: 100,
                  maxQuantity: 200,
                  sellPrice: 50,
                  buyPrice: 0
                }
              ]
            }
          ],
          gates: [
            { id: 'gate1', position: { x: 500, y: 0 }, connectsTo: 'sector2' }
          ],
          asteroids: []
        },
        {
          id: 'sector2',
          name: 'Industrial Sector',
          discovered: true,
          stations: [
            {
              id: 'station2',
              name: 'Factory Station',
              type: 'basic_factory',
              position: { x: -200, y: 0 },
              sectorId: 'sector2',
              produces: [],
              consumes: ['iron'],
              wares: [
                {
                  wareId: 'iron',
                  quantity: 20,
                  maxQuantity: 150,
                  sellPrice: 0,
                  buyPrice: 80
                }
              ]
            }
          ],
          gates: [
            { id: 'gate2', position: { x: -500, y: 0 }, connectsTo: 'sector1' }
          ],
          asteroids: []
        }
      ],
      galaxyMap: {
        sectors: {
          'sector1': { id: 'sector1', name: 'Trade Hub Alpha', position: { x: 0, y: 0 }, discovered: true },
          'sector2': { id: 'sector2', name: 'Industrial Sector', position: { x: 1000, y: 0 }, discovered: true }
        },
        connections: [
          { id: 'sector1-sector2', sectorA: 'sector1', sectorB: 'sector2', gateAId: 'gate1', gateBId: 'gate2' }
        ]
      },
      wares: [
        {
          id: 'iron',
          name: 'Iron Ore',
          category: 'raw',
          cargoClass: 'L',
          cargoSize: 1,
          basePrice: 65
        }
      ],
      gameTime: 0,
      lastUpdate: Date.now()
    };
  });

  describe('Trade route finding', () => {
    test('should find profitable trade routes', () => {
      const routes = AutoTradeEngine.findBestTradeRoutes(testShip, testGameState);
      
      expect(routes.length).toBeGreaterThan(0);
      
      const ironRoute = routes.find(r => r.wareId === 'iron');
      expect(ironRoute).toBeDefined();
      expect(ironRoute!.profitPerUnit).toBe(30); // 80 - 50 = 30 profit per unit
      expect(ironRoute!.buyStation.stationId).toBe('station1');
      expect(ironRoute!.sellStation.stationId).toBe('station2');
    });

    test('should calculate profit per time correctly', () => {
      const routes = AutoTradeEngine.findBestTradeRoutes(testShip, testGameState);
      const route = routes[0];
      
      expect(route).toBeDefined();
      expect(route!.profitPerTime).toBeGreaterThan(0);
      expect(route!.travelTime).toBeGreaterThan(0);
    });

    test('should consider cargo capacity constraints', () => {
      testShip.cargoCapacity = 10; // Very small cargo hold
      
      const routes = AutoTradeEngine.findBestTradeRoutes(testShip, testGameState);
      const route = routes[0];
      
      expect(route!.maxQuantity).toBeLessThanOrEqual(10);
    });

    test('should consider credit constraints', () => {
      testGameState.player.credits = 100; // Very low credits
      
      const routes = AutoTradeEngine.findBestTradeRoutes(testShip, testGameState);
      
      if (routes.length > 0) {
        const route = routes[0];
        expect(route!.maxQuantity).toBeLessThanOrEqual(2); // 100 credits / 50 price = 2 units max
      } else {
        // No routes found due to insufficient credits, which is also valid
        expect(routes.length).toBe(0);
      }
    });
  });

  describe('Auto-trade state management', () => {
    test('should start auto-trade with valid route', () => {
      const autoTradeState = AutoTradeEngine.startAutoTrade(testShip, testGameState);
      
      expect(autoTradeState.enabled).toBe(true);
      expect(autoTradeState.targetShipId).toBe(testShip.id);
      expect(autoTradeState.currentRoute).toBeDefined();
      expect(autoTradeState.status).toBe('traveling_to_buy');
      expect(testShip.commandQueue.length).toBeGreaterThan(0);
    });

    test('should fail to start auto-trade when no profitable routes', () => {
      // Make all trades unprofitable
      testGameState.sectors[0]!.stations[0]!.wares[0]!.sellPrice = 100;
      testGameState.sectors[1]!.stations[0]!.wares[0]!.buyPrice = 50;
      
      const autoTradeState = AutoTradeEngine.startAutoTrade(testShip, testGameState);
      
      expect(autoTradeState.enabled).toBe(false);
      expect(autoTradeState.status).toBe('error');
    });

    test('should stop auto-trade and clear commands', () => {
      const autoTradeState = AutoTradeEngine.startAutoTrade(testShip, testGameState);
      expect(testShip.commandQueue.length).toBeGreaterThan(0);
      
      AutoTradeEngine.stopAutoTrade(testShip, autoTradeState);
      
      expect(autoTradeState.enabled).toBe(false);
      expect(autoTradeState.status).toBe('idle');
      expect(testShip.commandQueue.length).toBe(0);
    });
  });

  describe('Status reporting', () => {
    test('should provide meaningful status messages', () => {
      const autoTradeState: AutoTradeState = {
        enabled: true,
        targetShipId: testShip.id,
        status: 'buying',
        totalProfit: 0,
        tradesCompleted: 0,
        lastUpdate: Date.now(),
        currentRoute: {
          wareId: 'iron',
          buyStation: { stationId: 'station1', sectorId: 'sector1', price: 50, availableQuantity: 100 },
          sellStation: { stationId: 'station2', sectorId: 'sector2', price: 80, demandQuantity: 130 },
          profitPerUnit: 30,
          distance: 1000,
          travelTime: 10,
          profitPerTime: 300,
          maxQuantity: 50
        }
      };
      
      const status = AutoTradeEngine.getAutoTradeStatus(autoTradeState);
      expect(status).toBe('Buying iron');
      
      autoTradeState.status = 'traveling_to_sell';
      const travelStatus = AutoTradeEngine.getAutoTradeStatus(autoTradeState);
      expect(travelStatus).toBe('Traveling to sell iron');
    });

    test('should show disabled status when not enabled', () => {
      const autoTradeState: AutoTradeState = {
        enabled: false,
        status: 'idle',
        totalProfit: 0,
        tradesCompleted: 0,
        lastUpdate: Date.now()
      };
      
      const status = AutoTradeEngine.getAutoTradeStatus(autoTradeState);
      expect(status).toBe('Auto-trade disabled');
    });
  });

  describe('Trade analysis', () => {
    test('should analyze trade opportunities', () => {
      const analysis = AutoTradeEngine.analyzeTradeOpportunities(testShip, testGameState);
      
      expect(analysis.totalRoutes).toBeGreaterThan(0);
      expect(analysis.averageProfitPerTime).toBeGreaterThan(0);
      expect(analysis.bestRoute).toBeDefined();
      expect(analysis.routesByWare['iron']).toBeGreaterThan(0);
    });

    test('should handle case with no trade opportunities', () => {
      // Remove all station wares to eliminate opportunities
      testGameState.sectors.forEach(sector => {
        sector.stations.forEach(station => {
          station.wares = [];
        });
      });
      
      const analysis = AutoTradeEngine.analyzeTradeOpportunities(testShip, testGameState);
      
      expect(analysis.totalRoutes).toBe(0);
      expect(analysis.averageProfitPerTime).toBe(0);
      expect(analysis.bestRoute).toBeUndefined();
    });
  });

  describe('Cross-sector trading', () => {
    test('should create commands for cross-sector trade routes', () => {
      testShip.sectorId = 'sector1'; // Start in sector1
      
      const autoTradeState = AutoTradeEngine.startAutoTrade(testShip, testGameState);
      
      expect(autoTradeState.enabled).toBe(true);
      expect(testShip.commandQueue.length).toBeGreaterThan(2); // Should have move, buy, auto-move, move, sell commands
      
      // Should start with moving to buy station
      const commands = testShip.commandQueue;
      expect(commands.some(cmd => cmd.type === 'move' && cmd.target === 'station1')).toBe(true);
      expect(commands.some(cmd => cmd.type === 'trade' && cmd.parameters?.action === 'buy')).toBe(true);
      expect(commands.some(cmd => cmd.type === 'auto-move')).toBe(true);
      expect(commands.some(cmd => cmd.type === 'trade' && cmd.parameters?.action === 'sell')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    test('should handle ship with existing cargo', () => {
      testShip.cargo = [{ wareId: 'iron', quantity: 20 }];
      
      const routes = AutoTradeEngine.findBestTradeRoutes(testShip, testGameState);
      const route = routes[0];
      
      // Should account for already used cargo space
      expect(route!.maxQuantity).toBeLessThan(100); // Less than full capacity due to existing cargo
    });

    test('should handle zero travel time routes', () => {
      // Put ship in same sector as both buy and sell stations by creating a station in sector1 that buys iron
      testGameState.sectors[0]!.stations.push({
        id: 'station1b',
        name: 'Local Factory',
        type: 'basic_factory',
        position: { x: 400, y: 0 },
        sectorId: 'sector1',
        produces: [],
        consumes: ['iron'],
        wares: [
          {
            wareId: 'iron',
            quantity: 10,
            maxQuantity: 100,
            sellPrice: 0,
            buyPrice: 75
          }
        ]
      });
      
      const routes = AutoTradeEngine.findBestTradeRoutes(testShip, testGameState);
      
      // Should still find profitable routes even with minimal travel time
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0]!.profitPerTime).toBeGreaterThan(0);
    });
  });
});