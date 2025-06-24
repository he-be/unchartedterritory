// Economic engine for Uncharted Territory

import { GameState, Station, GameEvent, Ware } from './types';

export class EconomicEngine {
  private static PRODUCTION_CYCLE_MS = 60000; // 60 seconds as per spec
  private static PRICE_MULTIPLIER = 0.3; // Price fluctuation range (30%)

  static updatePrices(station: Station, wares: Ware[]): void {
    station.wares.forEach(stock => {
      const ware = wares.find(w => w.id === stock.wareId);
      if (!ware) return;

      const stockRatio = stock.quantity / stock.maxQuantity;
      const priceRange = ware.basePrice * this.PRICE_MULTIPLIER;
      const minPrice = ware.basePrice - priceRange;
      const maxPrice = ware.basePrice + priceRange;

      // Price formula from spec: price = maxPrice - ((maxPrice - minPrice) * stockRatio)
      const currentPrice = maxPrice - ((maxPrice - minPrice) * stockRatio);

      // Update buy/sell prices based on station role
      if (station.produces?.includes(stock.wareId)) {
        // Station produces this ware - sells it
        stock.sellPrice = Math.round(currentPrice);
        stock.buyPrice = 0;
      } else if (station.consumes?.includes(stock.wareId)) {
        // Station consumes this ware - buys it
        stock.buyPrice = Math.round(currentPrice);
        stock.sellPrice = 0;
      } else {
        // Trading port - both buy and sell
        stock.buyPrice = Math.round(currentPrice * 0.95);
        stock.sellPrice = Math.round(currentPrice * 1.05);
      }
    });
  }

  static processProduction(station: Station): GameEvent[] {
    const events: GameEvent[] = [];

    if (!station.produces || !station.consumes) {
      return events; // No production for this station type
    }

    // Check if we have required inputs
    let canProduce = true;
    const requiredInputs: { wareId: string; amount: number }[] = [];

    station.consumes.forEach(wareId => {
      const stock = station.wares.find(w => w.wareId === wareId);
      if (!stock || stock.quantity < 10) {
        canProduce = false;
      } else {
        requiredInputs.push({ wareId, amount: 10 });
      }
    });

    if (!canProduce) {
      return events;
    }

    // Check if we have space for outputs
    const outputs: { wareId: string; amount: number }[] = [];
    station.produces.forEach(wareId => {
      const stock = station.wares.find(w => w.wareId === wareId);
      if (!stock || stock.quantity >= stock.maxQuantity - 20) {
        canProduce = false;
      } else {
        outputs.push({ wareId, amount: 20 });
      }
    });

    if (!canProduce) {
      return events;
    }

    // Perform production
    requiredInputs.forEach(input => {
      const stock = station.wares.find(w => w.wareId === input.wareId);
      if (stock) {
        stock.quantity -= input.amount;
      }
    });

    outputs.forEach(output => {
      const stock = station.wares.find(w => w.wareId === output.wareId);
      if (stock) {
        stock.quantity += output.amount;
      }
    });

    events.push({
      timestamp: Date.now(),
      type: 'production',
      message: `${station.name} produced ${outputs.map(o => `${o.amount} ${o.wareId}`).join(', ')}`,
      details: { stationId: station.id, consumed: requiredInputs, produced: outputs }
    });

    return events;
  }

  static updateEconomy(gameState: GameState): GameEvent[] {
    const events: GameEvent[] = [];
    const now = Date.now();

    // Only process if enough time has passed since last update
    if (now - gameState.lastUpdate < this.PRODUCTION_CYCLE_MS) {
      return events;
    }

    gameState.sectors.forEach(sector => {
      if (!sector.discovered) return;

      sector.stations.forEach(station => {
        // Update prices based on current stock
        this.updatePrices(station, gameState.wares);

        // Process production if applicable
        const productionEvents = this.processProduction(station);
        events.push(...productionEvents);
      });
    });

    gameState.lastUpdate = now;
    gameState.gameTime += Math.floor(this.PRODUCTION_CYCLE_MS / 1000);

    return events;
  }

  static getTradeOpportunities(gameState: GameState): Array<{
    wareId: string;
    from: { stationId: string; sectorId: string; price: number };
    to: { stationId: string; sectorId: string; price: number };
    profitMargin: number;
  }> {
    const opportunities: any[] = [];

    gameState.wares.forEach(ware => {
      const sellers: Array<{ station: Station; price: number }> = [];
      const buyers: Array<{ station: Station; price: number }> = [];

      gameState.sectors.forEach(sector => {
        if (!sector.discovered) return;

        sector.stations.forEach(station => {
          const stock = station.wares.find(w => w.wareId === ware.id);
          if (!stock) return;

          if (stock.sellPrice > 0 && stock.quantity > 20) {
            sellers.push({ station, price: stock.sellPrice });
          }
          if (stock.buyPrice > 0 && stock.quantity < stock.maxQuantity - 20) {
            buyers.push({ station, price: stock.buyPrice });
          }
        });
      });

      // Find profitable routes
      sellers.forEach(seller => {
        buyers.forEach(buyer => {
          if (buyer.price > seller.price) {
            const profitMargin = buyer.price - seller.price;
            opportunities.push({
              wareId: ware.id,
              from: {
                stationId: seller.station.id,
                sectorId: seller.station.sectorId,
                price: seller.price
              },
              to: {
                stationId: buyer.station.id,
                sectorId: buyer.station.sectorId,
                price: buyer.price
              },
              profitMargin
            });
          }
        });
      });
    });

    return opportunities.sort((a, b) => b.profitMargin - a.profitMargin);
  }
}