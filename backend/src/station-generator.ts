/**
 * Procedural Station Generator
 * Generates stations dynamically based on economy rules and randomization
 */

import type { Station, StationInventory, Vector2 } from './types';
import { getWare, getRandomStationTypes, StationType } from './economy';

export interface StationGenerationConfig {
  minStations: number;
  maxStations: number;
  sectorId: string;
  sectorName: string;
  seed?: string; // For deterministic generation
}

/**
 * Generate stations for a sector procedurally
 */
export function generateStationsForSector(config: StationGenerationConfig): Station[] {
  const stationCount = Math.floor(Math.random() * (config.maxStations - config.minStations + 1)) + config.minStations;
  const stationTypes = getRandomStationTypes(stationCount, config.seed);
  
  const stations: Station[] = [];
  
  for (let i = 0; i < stationTypes.length; i++) {
    const stationType = stationTypes[i];
    const station = generateStation(stationType, config.sectorId, config.sectorName, i);
    stations.push(station);
  }
  
  return stations;
}

/**
 * Generate a single station based on its type
 */
function generateStation(stationType: StationType, sectorId: string, sectorName: string, index: number): Station {
  const stationId = `${sectorId}-${stationType.id}-${index + 1}`;
  const position = generateStationPosition(index);
  
  // Generate station name with some variation
  const nameVariations = generateStationName(stationType, sectorName);
  
  const inventory = generateStationInventory(stationType);
  
  return {
    id: stationId,
    name: nameVariations,
    position,
    sectorId,
    inventory,
    stationTypeId: stationType.id,
    economicState: {
      lastUpdateTime: 0,
      productionCycles: {},
      consumptionCycles: {},
      npcTradeTimer: 0
    }
  };
}

/**
 * Generate inventory for a station based on its type
 */
function generateStationInventory(stationType: StationType): StationInventory[] {
  const inventory: StationInventory[] = [];
  
  // Add produced goods (what the station sells)
  for (const wareId of stationType.produces) {
    const ware = getWare(wareId);
    if (ware) {
      const quantity = generateInitialQuantity(ware.category, 'produces');
      const sellPrice = calculatePrice(ware.basePrice, 'sell');
      
      inventory.push({
        wareId,
        quantity,
        buyPrice: 0, // Station doesn't buy what it produces
        sellPrice
      });
    }
  }
  
  // Add consumed goods (what the station buys)
  for (const wareId of stationType.consumes) {
    const ware = getWare(wareId);
    if (ware) {
      const buyPrice = calculatePrice(ware.basePrice, 'buy');
      
      inventory.push({
        wareId,
        quantity: 0, // Station starts with 0 of what it buys
        buyPrice,
        sellPrice: 0 // Station doesn't sell what it consumes
      });
    }
  }
  
  // Special case for trading stations - they deal in various goods
  if (stationType.id === 'trading-station') {
    addTradingStationInventory(inventory);
  }
  
  return inventory;
}

/**
 * Add inventory for trading stations (they buy/sell various goods)
 */
function addTradingStationInventory(inventory: StationInventory[]): void {
  // Trading stations deal in many common and some uncommon goods
  const commonWares = ['energy-cells', 'microchips', 'food-rations', 'ore', 'refined-metals'];
  const uncommonWares = ['medical-supplies', 'ammunition', 'weapon-components', 'farm-equipment', 'chemicals'];
  
  // Always stock common wares
  for (const wareId of commonWares) {
    const ware = getWare(wareId);
    if (ware) {
      const quantity = generateInitialQuantity(ware.category, 'trading');
      const basePrice = ware.basePrice;
      const buyPrice = Math.floor(basePrice * (0.85 + Math.random() * 0.05)); // 85-90% of base
      const sellPrice = Math.floor(basePrice * (1.05 + Math.random() * 0.1)); // 105-115% of base
      
      inventory.push({
        wareId,
        quantity,
        buyPrice, // Trading stations buy these goods
        sellPrice // Trading stations also sell these goods
      });
    }
  }
  
  // Sometimes stock uncommon wares
  for (const wareId of uncommonWares) {
    const ware = getWare(wareId);
    if (ware && Math.random() < 0.4) { // 40% chance for uncommon wares
      const quantity = Math.floor(generateInitialQuantity(ware.category, 'trading') * 0.6); // Less stock
      const basePrice = ware.basePrice;
      const buyPrice = Math.floor(basePrice * (0.8 + Math.random() * 0.05)); // 80-85% of base
      const sellPrice = Math.floor(basePrice * (1.1 + Math.random() * 0.15)); // 110-125% of base
      
      inventory.push({
        wareId,
        quantity,
        buyPrice,
        sellPrice
      });
    }
  }
}

/**
 * Generate initial quantity based on ware category and station role
 */
function generateInitialQuantity(category: string, role: 'produces' | 'trading'): number {
  const baseQuantity = role === 'produces' ? 
    (category === 'luxury' ? 100 : category === 'services' ? 500 : 1000) :
    (category === 'luxury' ? 50 : category === 'services' ? 250 : 500);
  
  // Add some randomization (±25%)
  const variation = 0.25;
  const min = Math.floor(baseQuantity * (1 - variation));
  const max = Math.floor(baseQuantity * (1 + variation));
  
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate buy/sell prices with market variation
 */
function calculatePrice(basePrice: number, type: 'buy' | 'sell'): number {
  const marketVariation = 0.15; // ±15% market variation
  const variation = (Math.random() - 0.5) * 2 * marketVariation;
  
  const adjustedPrice = basePrice * (1 + variation);
  
  if (type === 'buy') {
    // Stations buy at 85-95% of market price
    return Math.floor(adjustedPrice * (0.85 + Math.random() * 0.1));
  } else {
    // Stations sell at 105-120% of market price
    return Math.floor(adjustedPrice * (1.05 + Math.random() * 0.15));
  }
}

/**
 * Generate station position within sector
 */
function generateStationPosition(index: number): Vector2 {
  // Distribute stations around the sector space
  const angle = (index * 2 * Math.PI) / 3; // Assuming max 3 stations
  const distance = 150 + Math.random() * 100; // 150-250 units from center
  
  const x = Math.floor(Math.cos(angle) * distance);
  const y = Math.floor(Math.sin(angle) * distance);
  
  // Add some randomization to avoid perfect circles
  const randomOffset = 50;
  const offsetX = (Math.random() - 0.5) * randomOffset;
  const offsetY = (Math.random() - 0.5) * randomOffset;
  
  return {
    x: x + offsetX,
    y: y + offsetY
  };
}

/**
 * Generate station name with variety
 */
function generateStationName(stationType: StationType, sectorName: string): string {
  const prefixes = [
    sectorName,
    sectorName.split(' ')[0], // First word of sector name
    'Advanced',
    'Central',
    'Prime',
    'Alpha',
    'Beta'
  ];
  
  const suffixes = [
    'Station',
    'Complex',
    'Facility',
    'Outpost',
    'Hub',
    'Center'
  ];
  
  // For specific types, use more appropriate names
  const typeSpecificNames: Record<string, string[]> = {
    'mining-station': ['Mining Complex', 'Extraction Facility', 'Ore Processing Plant'],
    'shipyard': ['Shipyard', 'Shipbuilding Complex', 'Naval Facility'],
    'research-lab': ['Research Laboratory', 'Science Station', 'R&D Facility'],
    'trading-station': ['Trading Post', 'Commercial Hub', 'Trade Center'],
    'medical-station': ['Medical Center', 'Health Station', 'Med Bay'],
    'financial-center': ['Financial District', 'Banking Complex', 'Credit Union']
  };
  
  if (typeSpecificNames[stationType.id]) {
    const specificNames = typeSpecificNames[stationType.id];
    const randomName = specificNames[Math.floor(Math.random() * specificNames.length)];
    return `${sectorName} ${randomName}`;
  }
  
  // Generic naming for other types
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  return `${prefix} ${stationType.name.replace('Station', '').replace('Factory', '').trim()} ${suffix}`.trim();
}