// World generation system for Uncharted Territory

import { GameState, Sector, Station, Ware, Vector2, Player, Ship } from './types';

export const WARES: Ware[] = [
  // Raw materials
  { id: 'ore', name: 'Ore', category: 'raw', cargoClass: 'M', cargoSize: 5, basePrice: 50 },
  { id: 'silicon', name: 'Silicon', category: 'raw', cargoClass: 'M', cargoSize: 5, basePrice: 80 },
  { id: 'ice', name: 'Ice', category: 'raw', cargoClass: 'L', cargoSize: 10, basePrice: 30 },
  
  // Intermediate goods
  { id: 'microchips', name: 'Microchips', category: 'intermediate', cargoClass: 'S', cargoSize: 1, basePrice: 200 },
  { id: 'quantum_tubes', name: 'Quantum Tubes', category: 'intermediate', cargoClass: 'M', cargoSize: 5, basePrice: 300 },
  
  // Finished products
  { id: 'hull_parts', name: 'Hull Parts', category: 'finished', cargoClass: 'L', cargoSize: 10, basePrice: 500 },
  { id: 'food', name: 'Food', category: 'finished', cargoClass: 'M', cargoSize: 5, basePrice: 100 },
];

function generateRandomPosition(centerArea = true): Vector2 {
  if (centerArea) {
    // Within 10000m center area
    return {
      x: (Math.random() - 0.5) * 10000,
      y: (Math.random() - 0.5) * 10000
    };
  }
  return {
    x: (Math.random() - 0.5) * 20000,
    y: (Math.random() - 0.5) * 20000
  };
}

function createStation(id: string, type: Station['type'], sectorId: string): Station {
  const station: Station = {
    id,
    name: `${type.replace('_', ' ').toUpperCase()} ${id.slice(-2)}`,
    type,
    position: generateRandomPosition(true),
    sectorId,
    wares: []
  };

  // Configure station production/consumption and initial stock
  switch (type) {
    case 'trading_port':
      // Trading ports have diverse inventory
      station.wares = WARES.map(ware => ({
        wareId: ware.id,
        quantity: Math.floor(Math.random() * 200) + 50,
        maxQuantity: 500,
        buyPrice: ware.basePrice * 0.9,
        sellPrice: ware.basePrice * 1.1
      }));
      break;
      
    case 'mine':
      station.produces = ['ore', 'silicon'];
      station.wares = [
        { wareId: 'ore', quantity: 300, maxQuantity: 1000, buyPrice: 0, sellPrice: 40 },
        { wareId: 'silicon', quantity: 200, maxQuantity: 500, buyPrice: 0, sellPrice: 70 }
      ];
      break;
      
    case 'refinery':
      station.consumes = ['ore', 'silicon'];
      station.produces = ['microchips'];
      station.wares = [
        { wareId: 'ore', quantity: 50, maxQuantity: 200, buyPrice: 60, sellPrice: 0 },
        { wareId: 'silicon', quantity: 30, maxQuantity: 100, buyPrice: 90, sellPrice: 0 },
        { wareId: 'microchips', quantity: 100, maxQuantity: 300, buyPrice: 0, sellPrice: 180 }
      ];
      break;
      
    case 'basic_factory':
      station.consumes = ['ore', 'ice'];
      station.produces = ['hull_parts', 'food'];
      station.wares = [
        { wareId: 'ore', quantity: 80, maxQuantity: 300, buyPrice: 55, sellPrice: 0 },
        { wareId: 'ice', quantity: 100, maxQuantity: 400, buyPrice: 35, sellPrice: 0 },
        { wareId: 'hull_parts', quantity: 50, maxQuantity: 200, buyPrice: 0, sellPrice: 450 },
        { wareId: 'food', quantity: 150, maxQuantity: 500, buyPrice: 0, sellPrice: 90 }
      ];
      break;
      
    case 'hightech_factory':
      station.consumes = ['microchips', 'silicon'];
      station.produces = ['quantum_tubes'];
      station.wares = [
        { wareId: 'microchips', quantity: 20, maxQuantity: 100, buyPrice: 220, sellPrice: 0 },
        { wareId: 'silicon', quantity: 40, maxQuantity: 150, buyPrice: 85, sellPrice: 0 },
        { wareId: 'quantum_tubes', quantity: 30, maxQuantity: 120, buyPrice: 0, sellPrice: 280 }
      ];
      break;
      
    case 'shipyard':
      station.consumes = ['hull_parts', 'quantum_tubes'];
      station.wares = [
        { wareId: 'hull_parts', quantity: 10, maxQuantity: 100, buyPrice: 520, sellPrice: 0 },
        { wareId: 'quantum_tubes', quantity: 5, maxQuantity: 50, buyPrice: 320, sellPrice: 0 }
      ];
      break;
  }

  return station;
}

function createSector(id: string, name: string): Sector {
  const sector: Sector = {
    id,
    name,
    discovered: false,
    stations: [],
    gates: [],
    asteroids: []
  };

  // Generate 3-8 stations per sector (simplified for MVP)
  const stationCount = Math.floor(Math.random() * 3) + 3;
  const stationTypes: Station['type'][] = ['trading_port', 'mine', 'refinery', 'basic_factory', 'hightech_factory'];
  
  for (let i = 0; i < stationCount; i++) {
    const stationType = stationTypes[Math.floor(Math.random() * stationTypes.length)] || 'trading_port';
    const station = createStation(`${id}_station_${i}`, stationType, id);
    sector.stations.push(station);
  }

  // Add shipyard (rare - 1 in 3 sectors)
  if (Math.random() < 0.33) {
    const shipyard = createStation(`${id}_shipyard`, 'shipyard', id);
    sector.stations.push(shipyard);
  }

  // Generate some asteroids for future mining
  const asteroidCount = Math.floor(Math.random() * 5) + 2;
  for (let i = 0; i < asteroidCount; i++) {
    sector.asteroids.push(generateRandomPosition(false));
  }

  return sector;
}

export function generateUniverse(): GameState {
  const sectors: Sector[] = [];
  
  // Create sectors with interesting names
  const sectorNames = [
    'Argon Prime', 'New Tokyo', 'Europa Station', 'Mars Colony',
    'Alpha Centauri', 'Vega Outpost', 'Orion Gate', 'Solar Central'
  ];

  for (let i = 0; i < 8; i++) {
    const sector = createSector(`sector_${i}`, sectorNames[i] || `Sector ${i}`);
    sectors.push(sector);
  }

  // Connect sectors with gates (simplified linear connection for MVP)
  for (let i = 0; i < sectors.length - 1; i++) {
    const currentSector = sectors[i];
    const nextSector = sectors[i + 1];
    
    if (!currentSector || !nextSector) continue;
    
    // Gate in current sector to next
    currentSector.gates.push({
      id: `gate_${i}_to_${i + 1}`,
      position: { x: 4500, y: 4500 },
      connectsTo: nextSector.id
    });
    
    // Gate in next sector back to current
    nextSector.gates.push({
      id: `gate_${i + 1}_to_${i}`,
      position: { x: -4500, y: -4500 },
      connectsTo: currentSector.id
    });
  }

  // Add some additional connections for interesting routing
  if (sectors.length >= 4 && sectors[0] && sectors[3]) {
    sectors[0].gates.push({
      id: 'gate_0_to_3',
      position: { x: -4500, y: 4500 },
      connectsTo: sectors[3].id
    });
    sectors[3].gates.push({
      id: 'gate_3_to_0',
      position: { x: 4500, y: -4500 },
      connectsTo: sectors[0].id
    });
  }

  // Create starting player
  const startingSector = sectors[0];
  if (!startingSector) {
    throw new Error('No starting sector available');
  }
  
  startingSector.discovered = true;

  const scoutShip: Ship = {
    id: 'scout_01',
    name: 'Discovery',
    type: 'scout',
    position: { x: 0, y: 0 },
    sectorId: startingSector.id,
    maxSpeed: 500,
    cargoClass: 'S',
    cargoCapacity: 10,
    cargo: [],
    isMoving: false
  };

  const player: Player = {
    name: 'Commander',
    credits: 100000,
    ships: [scoutShip],
    discoveredSectors: [startingSector.id]
  };

  return {
    id: `game_${Date.now()}`,
    player,
    sectors,
    wares: WARES,
    gameTime: 0,
    lastUpdate: Date.now()
  };
}