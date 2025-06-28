// Auto-trade engine for autonomous ship trading in Uncharted Territory
// Implements automated trading strategies and profit optimization

import { GameState, Ship, ShipCommand } from './types';
import { EconomicEngine } from './economic-engine';
import { CommandQueue } from './command-queue';
import { NavigationEngine } from './navigation-engine';

export interface TradeRoute {
  wareId: string;
  buyStation: {
    stationId: string;
    sectorId: string;
    price: number;
    availableQuantity: number;
  };
  sellStation: {
    stationId: string;
    sectorId: string;
    price: number;
    demandQuantity: number;
  };
  profitPerUnit: number;
  distance: number;
  travelTime: number;
  profitPerTime: number; // Credits per second
  maxQuantity: number; // Max units ship can carry
}

export interface AutoTradeState {
  enabled: boolean;
  targetShipId?: string;
  currentRoute?: TradeRoute;
  status: 'idle' | 'buying' | 'traveling_to_sell' | 'selling' | 'traveling_to_buy' | 'error';
  totalProfit: number;
  tradesCompleted: number;
  lastUpdate: number;
}

export class AutoTradeEngine {
  private static MIN_PROFIT_PER_UNIT = 10; // Minimum profit to consider a trade worthwhile
  private static MIN_PROFIT_PER_TIME = 5; // Minimum credits per second
  private static ROUTE_RECALC_INTERVAL = 30000; // Recalculate routes every 30 seconds

  /**
   * Find the most profitable trade routes for a ship
   */
  static findBestTradeRoutes(ship: Ship, gameState: GameState, maxRoutes: number = 10): TradeRoute[] {
    const opportunities = EconomicEngine.getTradeOpportunities(gameState);
    const routes: TradeRoute[] = [];

    for (const opportunity of opportunities) {
      const route = this.evaluateTradeRoute(ship, opportunity, gameState);
      if (route && route.profitPerUnit >= this.MIN_PROFIT_PER_UNIT && route.profitPerTime >= this.MIN_PROFIT_PER_TIME) {
        routes.push(route);
      }
    }

    // Sort by profit per time (most profitable routes first)
    return routes.sort((a, b) => b.profitPerTime - a.profitPerTime).slice(0, maxRoutes);
  }

  /**
   * Evaluate a trade opportunity and convert it to a trade route
   */
  private static evaluateTradeRoute(ship: Ship, opportunity: any, gameState: GameState): TradeRoute | null {
    const ware = gameState.wares.find(w => w.id === opportunity.wareId);
    if (!ware) return null;

    // Calculate distance and travel time
    const buyRoute = NavigationEngine.findRoute(gameState, ship.sectorId, opportunity.from.sectorId, ship.maxSpeed);
    const sellRoute = NavigationEngine.findRoute(gameState, opportunity.from.sectorId, opportunity.to.sectorId, ship.maxSpeed);
    
    if (!buyRoute || !sellRoute) return null;

    const totalDistance = buyRoute.totalDistance + sellRoute.totalDistance;
    const totalTravelTime = NavigationEngine.estimateTravelTime(buyRoute, ship.maxSpeed) + 
                           NavigationEngine.estimateTravelTime(sellRoute, ship.maxSpeed);

    // Get station stock information
    const buyStationInfo = this.getStationInfo(gameState, opportunity.from.stationId, opportunity.from.sectorId);
    const sellStationInfo = this.getStationInfo(gameState, opportunity.to.stationId, opportunity.to.sectorId);
    
    if (!buyStationInfo || !sellStationInfo) return null;

    const buyStock = buyStationInfo.station.wares.find(w => w.wareId === opportunity.wareId);
    const sellStock = sellStationInfo.station.wares.find(w => w.wareId === opportunity.wareId);
    
    if (!buyStock || !sellStock) return null;

    // Calculate maximum quantity ship can handle
    const availableCargo = ship.cargoCapacity - this.getUsedCargo(ship, gameState);
    const maxByCargoSpace = Math.floor(availableCargo / ware.cargoSize);
    const maxByCredits = Math.floor(gameState.player.credits / buyStock.sellPrice);
    const maxByStock = buyStock.quantity;
    const maxByDemand = sellStock.maxQuantity - sellStock.quantity;

    const maxQuantity = Math.min(maxByCargoSpace, maxByCredits, maxByStock, maxByDemand);

    if (maxQuantity <= 0) return null;

    const profitPerUnit = opportunity.profitMargin;
    const totalProfit = profitPerUnit * maxQuantity;
    const profitPerTime = totalProfit / Math.max(totalTravelTime, 1); // Avoid division by zero

    return {
      wareId: opportunity.wareId,
      buyStation: {
        stationId: opportunity.from.stationId,
        sectorId: opportunity.from.sectorId,
        price: opportunity.from.price,
        availableQuantity: buyStock.quantity
      },
      sellStation: {
        stationId: opportunity.to.stationId,
        sectorId: opportunity.to.sectorId,
        price: opportunity.to.price,
        demandQuantity: maxByDemand
      },
      profitPerUnit,
      distance: totalDistance,
      travelTime: totalTravelTime,
      profitPerTime,
      maxQuantity
    };
  }

  /**
   * Start auto-trading for a ship
   */
  static startAutoTrade(ship: Ship, gameState: GameState): AutoTradeState {
    const bestRoutes = this.findBestTradeRoutes(ship, gameState, 1);
    
    if (bestRoutes.length === 0) {
      return {
        enabled: false,
        status: 'error',
        totalProfit: 0,
        tradesCompleted: 0,
        lastUpdate: Date.now()
      };
    }

    const autoTradeState: AutoTradeState = {
      enabled: true,
      targetShipId: ship.id,
      currentRoute: bestRoutes[0]!,
      status: 'idle',
      totalProfit: 0,
      tradesCompleted: 0,
      lastUpdate: Date.now()
    };

    // Start the trade cycle
    this.executeTradeRoute(ship, autoTradeState.currentRoute!);
    autoTradeState.status = 'traveling_to_buy';

    return autoTradeState;
  }

  /**
   * Execute a complete trade route for a ship
   */
  private static executeTradeRoute(ship: Ship, route: TradeRoute): void {
    // Clear existing commands
    CommandQueue.clearQueue(ship);

    // Step 1: Move to buy station if not already there
    if (ship.sectorId !== route.buyStation.sectorId) {
      const autoMoveCommand = CommandQueue.createAutoMoveCommand(route.buyStation.sectorId);
      CommandQueue.addCommand(ship, autoMoveCommand);
    }

    // Step 2: Move to the station within the sector
    const moveToStationCommand: ShipCommand = {
      type: 'move',
      target: route.buyStation.stationId
    };
    CommandQueue.addCommand(ship, moveToStationCommand);

    // Step 3: Buy the ware
    const buyCommand: ShipCommand = {
      type: 'trade',
      target: route.buyStation.stationId,
      parameters: {
        action: 'buy',
        wareId: route.wareId,
        quantity: route.maxQuantity
      }
    };
    CommandQueue.addCommand(ship, buyCommand);

    // Step 4: Move to sell station if different sector
    if (route.sellStation.sectorId !== route.buyStation.sectorId) {
      const autoMoveToSellCommand = CommandQueue.createAutoMoveCommand(route.sellStation.sectorId);
      CommandQueue.addCommand(ship, autoMoveToSellCommand);
    }

    // Step 5: Move to sell station within sector
    const moveToSellStationCommand: ShipCommand = {
      type: 'move',
      target: route.sellStation.stationId
    };
    CommandQueue.addCommand(ship, moveToSellStationCommand);

    // Step 6: Sell the ware
    const sellCommand: ShipCommand = {
      type: 'trade',
      target: route.sellStation.stationId,
      parameters: {
        action: 'sell',
        wareId: route.wareId,
        quantity: route.maxQuantity
      }
    };
    CommandQueue.addCommand(ship, sellCommand);
  }

  /**
   * Update auto-trade state and continue trading if enabled
   */
  static updateAutoTrade(autoTradeState: AutoTradeState, gameState: GameState): void {
    if (!autoTradeState.enabled || !autoTradeState.targetShipId) return;

    const ship = gameState.player.ships.find(s => s.id === autoTradeState.targetShipId);
    if (!ship) {
      autoTradeState.enabled = false;
      autoTradeState.status = 'error';
      return;
    }

    const now = Date.now();

    // Check if ship completed all commands (finished a trade cycle)
    if (!CommandQueue.hasCommands(ship) && autoTradeState.status !== 'idle') {
      autoTradeState.tradesCompleted++;
      autoTradeState.status = 'idle';
      
      // Calculate profit from last trade if possible
      // This is simplified - in a real implementation, you'd track the cargo changes
      if (autoTradeState.currentRoute) {
        const estimatedProfit = autoTradeState.currentRoute.profitPerUnit * autoTradeState.currentRoute.maxQuantity;
        autoTradeState.totalProfit += estimatedProfit;
      }
    }

    // Recalculate routes periodically or when idle
    const shouldRecalculate = now - autoTradeState.lastUpdate > this.ROUTE_RECALC_INTERVAL || 
                             autoTradeState.status === 'idle';

    if (shouldRecalculate) {
      const newRoutes = this.findBestTradeRoutes(ship, gameState, 1);
      
      if (newRoutes.length > 0) {
        autoTradeState.currentRoute = newRoutes[0]!;
        this.executeTradeRoute(ship, autoTradeState.currentRoute);
        autoTradeState.status = 'traveling_to_buy';
        autoTradeState.lastUpdate = now;
      } else {
        autoTradeState.status = 'error';
        autoTradeState.enabled = false;
      }
    }

    // Update status based on current ship commands
    if (CommandQueue.hasCommands(ship)) {
      const currentCommand = CommandQueue.peekNextCommand(ship) || ship.currentCommand;
      if (currentCommand) {
        switch (currentCommand.type) {
          case 'move':
          case 'auto-move':
            if (autoTradeState.currentRoute) {
              const isMovingToBuy = ship.sectorId !== autoTradeState.currentRoute.buyStation.sectorId ||
                                   currentCommand.target === autoTradeState.currentRoute.buyStation.stationId;
              autoTradeState.status = isMovingToBuy ? 'traveling_to_buy' : 'traveling_to_sell';
            }
            break;
          case 'trade': {
            const isBuying = currentCommand.parameters?.action === 'buy';
            autoTradeState.status = isBuying ? 'buying' : 'selling';
            break;
          }
        }
      }
    }
  }

  /**
   * Stop auto-trading for a ship
   */
  static stopAutoTrade(ship: Ship, autoTradeState: AutoTradeState): void {
    autoTradeState.enabled = false;
    autoTradeState.status = 'idle';
    CommandQueue.clearQueue(ship);
  }

  /**
   * Get auto-trade status information for display
   */
  static getAutoTradeStatus(autoTradeState: AutoTradeState): string {
    if (!autoTradeState.enabled) {
      return 'Auto-trade disabled';
    }

    const statusMessages = {
      idle: 'Looking for trade opportunities...',
      buying: `Buying ${autoTradeState.currentRoute?.wareId || 'goods'}`,
      traveling_to_sell: `Traveling to sell ${autoTradeState.currentRoute?.wareId || 'goods'}`,
      selling: `Selling ${autoTradeState.currentRoute?.wareId || 'goods'}`,
      traveling_to_buy: `Traveling to buy ${autoTradeState.currentRoute?.wareId || 'goods'}`,
      error: 'No profitable trades found'
    };

    return statusMessages[autoTradeState.status] || 'Unknown status';
  }

  /**
   * Helper method to get station information
   */
  private static getStationInfo(gameState: GameState, stationId: string, sectorId: string) {
    const sector = gameState.sectors.find(s => s.id === sectorId);
    if (!sector) return null;
    
    const station = sector.stations.find(s => s.id === stationId);
    if (!station) return null;
    
    return { sector, station };
  }

  /**
   * Helper method to calculate used cargo space
   */
  private static getUsedCargo(ship: Ship, gameState: GameState): number {
    return ship.cargo.reduce((total, cargo) => {
      const ware = gameState.wares.find(w => w.id === cargo.wareId);
      return total + (cargo.quantity * (ware?.cargoSize || 1));
    }, 0);
  }

  /**
   * Get detailed analysis of available trade routes
   */
  static analyzeTradeOpportunities(ship: Ship, gameState: GameState): {
    totalRoutes: number;
    averageProfitPerTime: number;
    bestRoute: TradeRoute | undefined;
    routesByWare: { [wareId: string]: number };
  } {
    const routes = this.findBestTradeRoutes(ship, gameState, 50);
    
    const analysis = {
      totalRoutes: routes.length,
      averageProfitPerTime: routes.length > 0 ? routes.reduce((sum, r) => sum + r.profitPerTime, 0) / routes.length : 0,
      bestRoute: routes[0] || undefined,
      routesByWare: {} as { [wareId: string]: number }
    };

    routes.forEach(route => {
      analysis.routesByWare[route.wareId] = (analysis.routesByWare[route.wareId] || 0) + 1;
    });

    return analysis;
  }
}