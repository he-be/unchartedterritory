import { GameState, Ship, Station, StationInventory, ShipQueueCommand } from './types';

export interface TradeOpportunity {
  wareId: string;
  buyStation: Station;
  sellStation: Station;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  maxQuantity: number;
  totalProfit: number;
}

export class TradingAI {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Collect all station price information across all sectors
   */
  collectStationPrices(): Map<string, StationInventory[]> {
    const stationPrices = new Map<string, StationInventory[]>();
    
    for (const sector of this.gameState.sectors) {
      for (const station of sector.stations) {
        stationPrices.set(station.id, station.inventory);
      }
    }
    
    return stationPrices;
  }

  /**
   * Find the best trade opportunity for a ship
   */
  findBestTradeOpportunity(ship: Ship): TradeOpportunity | null {
    const opportunities: TradeOpportunity[] = [];
    const stationPrices = this.collectStationPrices();
    
    // Get all unique ware IDs from all stations
    const wareIds = new Set<string>();
    for (const inventory of stationPrices.values()) {
      for (const item of inventory) {
        wareIds.add(item.wareId);
      }
    }

    // For each ware, find best buy and sell opportunities
    for (const wareId of wareIds) {
      const opportunity = this.findBestTradeForWare(wareId, ship, stationPrices);
      if (opportunity) {
        opportunities.push(opportunity);
      }
    }

    // Return the opportunity with highest total profit
    return opportunities.length > 0 
      ? opportunities.reduce((best, current) => 
          current.totalProfit > best.totalProfit ? current : best
        )
      : null;
  }

  /**
   * Find best buy/sell pair for a specific ware
   */
  private findBestTradeForWare(
    wareId: string, 
    ship: Ship, 
    stationPrices: Map<string, StationInventory[]>
  ): TradeOpportunity | null {
    let bestBuyPrice = Infinity;
    let bestSellPrice = 0;
    let buyStation: Station | null = null;
    let sellStation: Station | null = null;
    let buyInventory: StationInventory | null = null;
    let sellInventory: StationInventory | null = null;

    // Find best buy and sell stations for this ware
    for (const [stationId, inventory] of stationPrices) {
      const station = this.findStationById(stationId);
      if (!station) continue;

      const wareItem = inventory.find(item => item.wareId === wareId);
      if (!wareItem) continue;

      // Check for best buy price (station selling to us)
      if (wareItem.sellPrice < bestBuyPrice && wareItem.quantity > 0) {
        bestBuyPrice = wareItem.sellPrice;
        buyStation = station;
        buyInventory = wareItem;
      }

      // Check for best sell price (station buying from us)
      if (wareItem.buyPrice > bestSellPrice) {
        bestSellPrice = wareItem.buyPrice;
        sellStation = station;
        sellInventory = wareItem;
      }
    }

    // Calculate profit and feasibility
    if (buyStation && sellStation && buyInventory && sellInventory && bestSellPrice > bestBuyPrice) {
      const profit = bestSellPrice - bestBuyPrice;
      const currentCargoQuantity = ship.cargo.reduce((total, cargo) => total + cargo.quantity, 0);
      const maxQuantity = Math.min(
        ship.maxCargo - currentCargoQuantity,
        buyInventory.quantity
      );
      
      if (maxQuantity > 0 && profit > 0) {
        return {
          wareId,
          buyStation,
          sellStation,
          buyPrice: bestBuyPrice,
          sellPrice: bestSellPrice,
          profit,
          maxQuantity,
          totalProfit: profit * maxQuantity
        };
      }
    }

    return null;
  }

  /**
   * Generate trading commands for a ship
   */
  generateTradingCommands(ship: Ship): ShipQueueCommand[] {
    const opportunity = this.findBestTradeOpportunity(ship);
    if (!opportunity) {
      return [];
    }

    const commands: ShipQueueCommand[] = [];

    // Command 1: Move to buy station
    commands.push({
      id: crypto.randomUUID(),
      type: 'dock_at_station',
      targetPosition: opportunity.buyStation.position,
      targetSectorId: opportunity.buyStation.sectorId,
      stationId: opportunity.buyStation.id,
      metadata: {
        tradeType: 'buy',
        wareId: opportunity.wareId,
        quantity: opportunity.maxQuantity,
        expectedPrice: opportunity.buyPrice
      }
    });

    // Command 2: Move to sell station
    commands.push({
      id: crypto.randomUUID(),
      type: 'dock_at_station',
      targetPosition: opportunity.sellStation.position,
      targetSectorId: opportunity.sellStation.sectorId,
      stationId: opportunity.sellStation.id,
      metadata: {
        tradeType: 'sell',
        wareId: opportunity.wareId,
        quantity: opportunity.maxQuantity,
        expectedPrice: opportunity.sellPrice
      }
    });

    // Command 3: Continue auto-trading
    commands.push({
      id: crypto.randomUUID(),
      type: 'auto_trade',
      targetPosition: { x: 0, y: 0 }, // Will be recalculated
      metadata: {
        continuous: true
      }
    });

    return commands;
  }

  /**
   * Helper to find station by ID across all sectors
   */
  private findStationById(stationId: string): Station | null {
    for (const sector of this.gameState.sectors) {
      for (const station of sector.stations) {
        if (station.id === stationId) {
          return station;
        }
      }
    }
    return null;
  }

  /**
   * Check if a ship should start auto-trading
   */
  shouldStartAutoTrade(ship: Ship): boolean {
    // Start auto-trading if ship has no commands and no current command
    return ship.commandQueue.length === 0 && !ship.currentCommand;
  }

  /**
   * Update game state reference
   */
  updateGameState(gameState: GameState): void {
    this.gameState = gameState;
  }
}