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
    
    console.log(`Collected prices from ${stationPrices.size} stations`);
    
    // Get all unique ware IDs from all stations
    const wareIds = new Set<string>();
    for (const inventory of stationPrices.values()) {
      for (const item of inventory) {
        wareIds.add(item.wareId);
      }
    }
    console.log(`Found ${wareIds.size} unique wares: ${Array.from(wareIds).join(', ')}`);

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
      if (wareItem.sellPrice > 0 && wareItem.sellPrice < bestBuyPrice && wareItem.quantity > 0) {
        bestBuyPrice = wareItem.sellPrice;
        buyStation = station;
        buyInventory = wareItem;
      }

      // Check for best sell price (station buying from us)
      if (wareItem.buyPrice > 0 && wareItem.buyPrice > bestSellPrice) {
        bestSellPrice = wareItem.buyPrice;
        sellStation = station;
        sellInventory = wareItem;
      }
    }

    // Calculate profit and feasibility
    if (buyStation && sellStation && buyInventory && sellInventory && bestSellPrice > bestBuyPrice) {
      // Prevent trading with the same station (buy and sell at same location)
      if (buyStation.id === sellStation.id) {
        return null;
      }
      
      const profit = bestSellPrice - bestBuyPrice;
      const currentCargoQuantity = ship.cargo.reduce((total, cargo) => total + cargo.quantity, 0);
      
      // Calculate max affordable quantity based on player's credits
      const maxAffordable = Math.floor(this.gameState.player.credits / bestBuyPrice);
      
      const maxQuantity = Math.min(
        ship.maxCargo - currentCargoQuantity,  // Ship cargo space
        buyInventory.quantity,                 // Station stock
        maxAffordable                          // Player affordability
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
    console.log(`Generating trading commands for ${ship.name} in sector ${ship.sectorId}`);
    const opportunity = this.findBestTradeOpportunity(ship);
    if (!opportunity) {
      console.log(`No valid trading opportunity found for ${ship.name} - stopping auto-trade`);
      return [];
    }
    console.log(`Found trading opportunity for ${ship.name}: Buy ${opportunity.wareId} from ${opportunity.buyStation.name} at ${opportunity.buyPrice}, sell to ${opportunity.sellStation.name} at ${opportunity.sellPrice}, profit: ${opportunity.totalProfit}`);

    const commands: ShipQueueCommand[] = [];

    // If ship is not in the buy station's sector, need to navigate there first
    if (ship.sectorId !== opportunity.buyStation.sectorId) {
      // Find the gate to use
      const currentSector = this.gameState.sectors.find(s => s.id === ship.sectorId);
      const targetGate = currentSector?.gates.find(g => g.targetSectorId === opportunity.buyStation.sectorId);
      
      if (targetGate) {
        commands.push({
          id: crypto.randomUUID(),
          type: 'move_to_gate',
          targetPosition: targetGate.position,
          targetSectorId: ship.sectorId,
          targetGateId: targetGate.id,
          targetGateSectorId: opportunity.buyStation.sectorId
        });
      }
    }

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

    // If sell station is in different sector, need to navigate there
    if (opportunity.buyStation.sectorId !== opportunity.sellStation.sectorId) {
      const buySector = this.gameState.sectors.find(s => s.id === opportunity.buyStation.sectorId);
      const targetGate = buySector?.gates.find(g => g.targetSectorId === opportunity.sellStation.sectorId);
      
      if (targetGate) {
        commands.push({
          id: crypto.randomUUID(),
          type: 'move_to_gate',
          targetPosition: targetGate.position,
          targetSectorId: opportunity.buyStation.sectorId,
          targetGateId: targetGate.id,
          targetGateSectorId: opportunity.sellStation.sectorId
        });
      }
    }

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

    // Command 3: Continue auto-trading only if we found a valid opportunity
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