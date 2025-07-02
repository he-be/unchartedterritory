/**
 * Economy System - Single source of truth for wares and station types
 * This file defines all economic data and rules for procedural station generation
 */

export interface Ware {
  id: string;
  name: string;
  basePrice: number;
  category: 'raw_materials' | 'components' | 'manufactured' | 'luxury' | 'services' | 'energy';
  description?: string;
}

export interface StationType {
  id: string;
  name: string;
  category: 'production' | 'processing' | 'trading' | 'service' | 'research';
  produces: string[]; // Ware IDs this station type produces
  consumes: string[]; // Ware IDs this station type buys
  rarity: 'common' | 'uncommon' | 'rare'; // How often this type appears
  sectorPreference?: string[]; // Preferred sector types (if any)
  
  // NEW: Real-time economic behavior
  economicType?: 'factory' | 'trading_station' | 'service_station';
  productionRates?: { [wareId: string]: number }; // Units produced per second
  consumptionRates?: { [wareId: string]: number }; // Units consumed per second
  npcTradeFrequency?: number; // For trading stations: NPC trades per minute
  storageCapacity?: { [wareId: string]: number }; // Max storage per ware type
}

export interface StationEconomicState {
  lastUpdateTime: number;
  productionCycles: { [wareId: string]: number }; // Accumulated production fractions
  consumptionCycles: { [wareId: string]: number }; // Accumulated consumption fractions
  npcTradeTimer: number; // Timer for next NPC trade
}

/**
 * Complete ware catalog - single source of truth for all tradeable goods
 */
export const WARES: Ware[] = [
  // Raw Materials
  { id: 'ore', name: 'Ore', basePrice: 10, category: 'raw_materials' },
  { id: 'helium', name: 'Helium', basePrice: 35, category: 'raw_materials' },
  { id: 'noble-gases', name: 'Noble Gases', basePrice: 95, category: 'raw_materials' },
  { id: 'food-rations', name: 'Food Rations', basePrice: 25, category: 'raw_materials' },
  
  // Energy
  { id: 'energy-cells', name: 'Energy Cells', basePrice: 15, category: 'energy' },
  
  // Components
  { id: 'microchips', name: 'Microchips', basePrice: 85, category: 'components' },
  { id: 'refined-metals', name: 'Refined Metals', basePrice: 60, category: 'components' },
  { id: 'weapon-components', name: 'Weapon Components', basePrice: 120, category: 'components' },
  { id: 'farm-equipment', name: 'Farm Equipment', basePrice: 150, category: 'components' },
  
  // Manufactured Goods
  { id: 'ammunition', name: 'Ammunition', basePrice: 45, category: 'manufactured' },
  { id: 'defense-systems', name: 'Defense Systems', basePrice: 280, category: 'manufactured' },
  { id: 'ship-engines', name: 'Ship Engines', basePrice: 350, category: 'manufactured' },
  { id: 'ship-hulls', name: 'Ship Hulls', basePrice: 200, category: 'manufactured' },
  { id: 'chemicals', name: 'Chemicals', basePrice: 75, category: 'manufactured' },
  
  // Medical & Research
  { id: 'medical-supplies', name: 'Medical Supplies', basePrice: 80, category: 'manufactured' },
  { id: 'pharmaceuticals', name: 'Pharmaceuticals', basePrice: 180, category: 'manufactured' },
  { id: 'research-data', name: 'Research Data', basePrice: 220, category: 'manufactured' },
  { id: 'tech-blueprints', name: 'Tech Blueprints', basePrice: 400, category: 'manufactured' },
  
  // Luxury & Services
  { id: 'luxury-goods', name: 'Luxury Goods', basePrice: 300, category: 'luxury' },
  { id: 'art-pieces', name: 'Art Pieces', basePrice: 500, category: 'luxury' },
  { id: 'entertainment-services', name: 'Entertainment Services', basePrice: 120, category: 'services' },
  { id: 'financial-services', name: 'Financial Services', basePrice: 50, category: 'services' },
  { id: 'repair-services', name: 'Repair Services', basePrice: 90, category: 'services' }
];

/**
 * Station types with their economic behavior
 */
export const STATION_TYPES: StationType[] = [
  // Raw Material Production
  {
    id: 'mining-station',
    name: 'Mining Station',
    category: 'production',
    produces: ['ore'],
    consumes: ['energy-cells'],
    rarity: 'common',
    economicType: 'factory',
    productionRates: { 'ore': 2.5 }, // 2.5 ore per second
    consumptionRates: { 'energy-cells': 0.5 }, // 0.5 energy cells per second
    storageCapacity: { 'ore': 2000, 'energy-cells': 500 }
  },
  {
    id: 'gas-extraction',
    name: 'Gas Extraction Facility',
    category: 'production',
    produces: ['helium'],
    consumes: ['energy-cells'],
    rarity: 'uncommon',
    economicType: 'factory',
    productionRates: { 'helium': 1.2 },
    consumptionRates: { 'energy-cells': 0.8 },
    storageCapacity: { 'helium': 1500, 'energy-cells': 400 }
  },
  {
    id: 'agricultural-hub',
    name: 'Agricultural Hub',
    category: 'production',
    produces: ['food-rations'],
    consumes: ['energy-cells', 'farm-equipment'],
    rarity: 'common',
    economicType: 'factory',
    productionRates: { 'food-rations': 1.8 },
    consumptionRates: { 'energy-cells': 0.6, 'farm-equipment': 0.1 },
    storageCapacity: { 'food-rations': 2500, 'energy-cells': 300, 'farm-equipment': 200 }
  },
  {
    id: 'energy-plant',
    name: 'Energy Production Plant',
    category: 'production',
    produces: ['energy-cells'],
    consumes: [], // Primary producer - no consumption
    rarity: 'common',
    economicType: 'factory',
    productionRates: { 'energy-cells': 3.0 }, // 3 energy cells per second
    storageCapacity: { 'energy-cells': 3000 }
  },
  
  // Processing & Manufacturing
  {
    id: 'refinery',
    name: 'Material Refinery',
    category: 'processing',
    produces: ['refined-metals'],
    consumes: ['ore', 'energy-cells'],
    rarity: 'common',
    economicType: 'factory',
    productionRates: { 'refined-metals': 1.0 },
    consumptionRates: { 'ore': 2.0, 'energy-cells': 0.8 },
    storageCapacity: { 'refined-metals': 1500, 'ore': 2000, 'energy-cells': 400 }
  },
  {
    id: 'gas-processing',
    name: 'Gas Processing Facility',
    category: 'processing',
    produces: ['noble-gases'],
    consumes: ['helium', 'energy-cells'],
    rarity: 'uncommon'
  },
  {
    id: 'tech-factory',
    name: 'Technology Factory',
    category: 'processing',
    produces: ['microchips'],
    consumes: ['ore', 'refined-metals'],
    rarity: 'uncommon'
  },
  {
    id: 'chemical-plant',
    name: 'Chemical Processing Plant',
    category: 'processing',
    produces: ['chemicals'],
    consumes: ['refined-metals', 'energy-cells'],
    rarity: 'uncommon'
  },
  
  // Advanced Manufacturing
  {
    id: 'weapon-factory',
    name: 'Weapons Factory',
    category: 'processing',
    produces: ['weapon-components', 'ammunition'],
    consumes: ['refined-metals', 'microchips'],
    rarity: 'uncommon'
  },
  {
    id: 'shipyard',
    name: 'Shipyard',
    category: 'processing',
    produces: ['ship-hulls', 'ship-engines'],
    consumes: ['refined-metals', 'weapon-components', 'microchips'],
    rarity: 'rare'
  },
  {
    id: 'defense-factory',
    name: 'Defense Systems Factory',
    category: 'processing',
    produces: ['defense-systems'],
    consumes: ['weapon-components', 'microchips'],
    rarity: 'rare'
  },
  {
    id: 'equipment-factory',
    name: 'Equipment Factory',
    category: 'processing',
    produces: ['farm-equipment'],
    consumes: ['refined-metals', 'microchips'],
    rarity: 'common'
  },
  
  // Medical & Research
  {
    id: 'medical-station',
    name: 'Medical Research Station',
    category: 'research',
    produces: ['medical-supplies'],
    consumes: ['food-rations', 'energy-cells'],
    rarity: 'uncommon'
  },
  {
    id: 'pharmaceutical-lab',
    name: 'Pharmaceutical Laboratory',
    category: 'research',
    produces: ['pharmaceuticals'],
    consumes: ['medical-supplies', 'chemicals'],
    rarity: 'rare'
  },
  {
    id: 'research-lab',
    name: 'Research Laboratory',
    category: 'research',
    produces: ['research-data', 'tech-blueprints'],
    consumes: ['microchips', 'energy-cells'],
    rarity: 'rare'
  },
  
  // Luxury & Services
  {
    id: 'luxury-factory',
    name: 'Luxury Goods Factory',
    category: 'processing',
    produces: ['luxury-goods'],
    consumes: ['medical-supplies', 'microchips'],
    rarity: 'rare'
  },
  {
    id: 'art-gallery',
    name: 'Art Gallery',
    category: 'service',
    produces: ['art-pieces'],
    consumes: ['luxury-goods', 'research-data'],
    rarity: 'rare'
  },
  {
    id: 'entertainment-complex',
    name: 'Entertainment Complex',
    category: 'service',
    produces: ['entertainment-services'],
    consumes: ['luxury-goods', 'food-rations'],
    rarity: 'uncommon'
  },
  {
    id: 'financial-center',
    name: 'Financial Center',
    category: 'service',
    produces: ['financial-services'],
    consumes: ['luxury-goods', 'art-pieces'],
    rarity: 'rare'
  },
  {
    id: 'repair-station',
    name: 'Repair Station',
    category: 'service',
    produces: ['repair-services'],
    consumes: ['refined-metals', 'microchips'],
    rarity: 'common'
  },
  
  // Trading
  {
    id: 'trading-station',
    name: 'Trading Station',
    category: 'trading',
    produces: [], // Trading stations don't produce, they facilitate trade
    consumes: [], // They buy and sell various goods
    rarity: 'common',
    economicType: 'trading_station',
    npcTradeFrequency: 12, // 12 NPC trades per minute (1 every 5 seconds)
    storageCapacity: {} // Will be set dynamically based on traded wares
  }
];

/**
 * Get ware by ID
 */
export function getWare(wareId: string): Ware | undefined {
  return WARES.find(ware => ware.id === wareId);
}

/**
 * Get station type by ID
 */
export function getStationType(stationTypeId: string): StationType | undefined {
  return STATION_TYPES.find(type => type.id === stationTypeId);
}

/**
 * Get random station types based on rarity weights
 */
export function getRandomStationTypes(count: number, _seed?: string): StationType[] {
  // Simple weighted random selection
  const weightedTypes: StationType[] = [];
  
  for (const stationType of STATION_TYPES) {
    const weight = stationType.rarity === 'common' ? 3 : 
                   stationType.rarity === 'uncommon' ? 2 : 1;
    
    for (let i = 0; i < weight; i++) {
      weightedTypes.push(stationType);
    }
  }
  
  const selected: StationType[] = [];
  const used = new Set<string>();
  
  // Simple random selection (could be enhanced with proper seeded random)
  while (selected.length < count && selected.length < STATION_TYPES.length) {
    const randomIndex = Math.floor(Math.random() * weightedTypes.length);
    const candidate = weightedTypes[randomIndex];
    
    if (!used.has(candidate.id)) {
      selected.push(candidate);
      used.add(candidate.id);
    }
  }
  
  return selected;
}

/**
 * Calculate production/consumption for a factory station over time
 */
export function updateFactoryProduction(
  station: any, // Station with inventory
  stationType: StationType,
  economicState: StationEconomicState,
  deltaTimeSeconds: number
): void {
  if (stationType.economicType !== 'factory') return;
  
  const now = Date.now();
  if (economicState.lastUpdateTime === 0) {
    economicState.lastUpdateTime = now;
    return;
  }
  
  // Consumption phase: Check if we have enough materials
  let canProduce = true;
  if (stationType.consumptionRates) {
    for (const [wareId, ratePerSecond] of Object.entries(stationType.consumptionRates)) {
      const required = ratePerSecond * deltaTimeSeconds;
      const inventory = station.inventory.find((inv: any) => inv.wareId === wareId);
      if (!inventory || inventory.quantity < required) {
        canProduce = false;
        break;
      }
    }
  }
  
  if (canProduce) {
    // Consume materials
    if (stationType.consumptionRates) {
      for (const [wareId, ratePerSecond] of Object.entries(stationType.consumptionRates)) {
        const toConsume = ratePerSecond * deltaTimeSeconds;
        const inventory = station.inventory.find((inv: any) => inv.wareId === wareId);
        if (inventory) {
          inventory.quantity = Math.max(0, inventory.quantity - toConsume);
        }
      }
    }
    
    // Produce goods
    if (stationType.productionRates) {
      for (const [wareId, ratePerSecond] of Object.entries(stationType.productionRates)) {
        const toProduce = ratePerSecond * deltaTimeSeconds;
        const inventory = station.inventory.find((inv: any) => inv.wareId === wareId);
        if (inventory) {
          const maxCapacity = stationType.storageCapacity?.[wareId] || 1000;
          inventory.quantity = Math.min(maxCapacity, inventory.quantity + toProduce);
        }
      }
    }
  }
  
  economicState.lastUpdateTime = now;
}

/**
 * Simulate NPC trading for trading stations
 */
export function updateTradingStationActivity(
  station: any,
  stationType: StationType, 
  economicState: StationEconomicState,
  deltaTimeSeconds: number
): void {
  if (stationType.economicType !== 'trading_station' || !stationType.npcTradeFrequency) return;
  
  economicState.npcTradeTimer += deltaTimeSeconds;
  const tradeInterval = 60 / stationType.npcTradeFrequency; // Seconds between trades
  
  while (economicState.npcTradeTimer >= tradeInterval) {
    economicState.npcTradeTimer -= tradeInterval;
    
    // Simulate random NPC trade
    const availableWares = station.inventory.filter((inv: any) => inv.quantity > 0 && inv.buyPrice > 0);
    if (availableWares.length > 0) {
      const randomWare = availableWares[Math.floor(Math.random() * availableWares.length)];
      const tradeAmount = Math.floor(Math.random() * 50) + 10; // 10-60 units
      const actualAmount = Math.min(tradeAmount, randomWare.quantity);
      
      randomWare.quantity -= actualAmount;
      // Note: This simulates NPC buying from the station (reducing stock)
    }
  }
}