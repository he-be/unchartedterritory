// Uncharted Territory - Space Economic Simulation Game API Server

import express from 'express';
import { GameState, ShipCommand, GameEvent } from './types';
import { generateUniverse } from './world-generator';
import { EconomicEngine } from './economic-engine';
import { ShipEngine } from './ship-engine';

export const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static('public')); // For future frontend

// Game state storage (in production, this would be a database)
const gameStates = new Map<string, GameState>();
const gameEvents = new Map<string, GameEvent[]>();

// Game lifecycle endpoints
app.post('/api/game/new', (req, res) => {
  const { playerName } = req.body;
  const gameState = generateUniverse(playerName);
  gameStates.set(gameState.id, gameState);
  gameEvents.set(gameState.id, []);

  return res.status(201).json({
    gameId: gameState.id,
    message: 'New game created',
    initialState: {
      playerId: gameState.player.name,
      credits: gameState.player.credits,
      shipCount: gameState.player.ships.length
    }
  });
});

app.get('/api/game/:gameId/state', (req, res) => {
  const { gameId } = req.params;
  const gameState = gameStates.get(gameId);

  if (!gameState) {
    return res.status(404).json({ error: 'Game not found' });
  }

  // Update economy and ship movement before returning state
  const now = Date.now();
  const deltaTime = (now - gameState.lastUpdate) / 1000; // Convert to seconds
  gameState.lastUpdate = now;
  gameState.gameTime += deltaTime;
  
  const economicEvents = EconomicEngine.updateEconomy(gameState);
  const movementEvents = ShipEngine.updateShipMovement(gameState, deltaTime);

  const events = gameEvents.get(gameId) || [];
  events.push(...economicEvents, ...movementEvents);
  gameEvents.set(gameId, events);

  return res.json({
    gameId: gameState.id,
    player: gameState.player,
    discoveredSectors: gameState.sectors.filter(s => s.discovered),
    sectors: gameState.sectors,
    wares: gameState.wares,
    gameTime: gameState.gameTime,
    lastUpdate: gameState.lastUpdate
  });
});

// Sector and exploration endpoints
app.get('/api/game/:gameId/sectors', (req, res) => {
  const { gameId } = req.params;
  const gameState = gameStates.get(gameId);

  if (!gameState) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const discoveredSectors = gameState.sectors
    .filter(s => s.discovered)
    .map(sector => ({
      id: sector.id,
      name: sector.name,
      stationCount: sector.stations.length,
      gateCount: sector.gates.length,
      playerShips: gameState.player.ships.filter(ship => ship.sectorId === sector.id).length
    }));

  return res.json(discoveredSectors);
});

app.get('/api/game/:gameId/sectors/:sectorId', (req, res) => {
  const { gameId, sectorId } = req.params;
  const gameState = gameStates.get(gameId);

  if (!gameState) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const sector = gameState.sectors.find(s => s.id === sectorId);
  if (!sector || !sector.discovered) {
    return res.status(404).json({ error: 'Sector not found or not discovered' });
  }

  // Update prices for this sector
  sector.stations.forEach(station => {
    EconomicEngine.updatePrices(station, gameState.wares);
  });

  const playerShipsInSector = gameState.player.ships.filter(ship => ship.sectorId === sectorId);

  return res.json({
    ...sector,
    playerShips: playerShipsInSector,
    wares: gameState.wares
  });
});

// Ship command endpoints
app.post('/api/game/:gameId/ships/:shipId/commands', (req, res) => {
  const { gameId, shipId } = req.params;
  const command: ShipCommand = req.body;

  const gameState = gameStates.get(gameId);
  if (!gameState) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const ship = gameState.player.ships.find(s => s.id === shipId);
  if (!ship) {
    return res.status(404).json({ error: 'Ship not found' });
  }

  if (ship.isMoving && command.type !== 'trade') {
    return res.status(400).json({ error: 'Ship is currently moving' });
  }

  const events = ShipEngine.executeCommand(ship, command, gameState);
  const existingEvents = gameEvents.get(gameId) || [];
  gameEvents.set(gameId, [...existingEvents, ...events]);

  return res.json({
    success: true,
    ship: {
      id: ship.id,
      name: ship.name,
      position: ship.position,
      isMoving: ship.isMoving,
      currentCommand: ship.currentCommand,
      cargo: ship.cargo
    },
    events
  });
});

// Trading endpoints
app.get('/api/game/:gameId/trade-opportunities', (req, res) => {
  const { gameId } = req.params;
  const gameState = gameStates.get(gameId);

  if (!gameState) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const opportunities = EconomicEngine.getTradeOpportunities(gameState);
  return res.json(opportunities.slice(0, 20)); // Top 20 opportunities
});

app.post('/api/game/:gameId/ships/:shipId/trade', (req, res) => {
  const { gameId, shipId } = req.params;
  const { stationId, action, wareId, quantity } = req.body;

  const gameState = gameStates.get(gameId);
  if (!gameState) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const ship = gameState.player.ships.find(s => s.id === shipId);
  if (!ship) {
    return res.status(404).json({ error: 'Ship not found' });
  }

  // Find the station
  const sector = gameState.sectors.find(s => s.id === ship.sectorId);
  const station = sector?.stations.find(s => s.id === stationId);
  
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }

  // Check if ship is close enough to station (within 200m)
  const distance = ShipEngine.getDistance(ship.position, station.position);
  if (distance > 200) {
    return res.status(400).json({ error: 'Ship too far from station' });
  }

  const command: ShipCommand = {
    type: 'trade',
    target: stationId,
    parameters: { action, wareId, quantity }
  };

  const events = ShipEngine.executeCommand(ship, command, gameState);
  const existingEvents = gameEvents.get(gameId) || [];
  gameEvents.set(gameId, [...existingEvents, ...events]);

  return res.json({
    success: true,
    ship: {
      id: ship.id,
      name: ship.name,
      cargo: ship.cargo
    },
    player: {
      credits: gameState.player.credits
    },
    events
  });
});

// Player and fleet management
app.get('/api/game/:gameId/player', (req, res) => {
  const { gameId } = req.params;
  const gameState = gameStates.get(gameId);

  if (!gameState) {
    return res.status(404).json({ error: 'Game not found' });
  }

  return res.json({
    ...gameState.player,
    totalCargoValue: calculateFleetCargoValue(gameState),
    fleetStatus: gameState.player.ships.map(ship => ({
      id: ship.id,
      name: ship.name,
      type: ship.type,
      sectorName: gameState.sectors.find(s => s.id === ship.sectorId)?.name,
      isMoving: ship.isMoving,
      cargoFull: getUsedCargo(ship, gameState) / ship.cargoCapacity
    }))
  });
});

// Health check and info
app.get('/health', (req, res) => {
  return res.json({ 
    status: 'OK', 
    service: 'Uncharted Territory API',
    activeGames: gameStates.size,
    uptime: process.uptime() 
  });
});

app.get('/', (req, res) => {
  return res.json({ 
    message: 'Uncharted Territory - Space Economic Simulation',
    version: '1.0.0-MVP',
    endpoints: {
      newGame: 'POST /api/game/new',
      gameState: 'GET /api/game/:gameId/state',
      sectors: 'GET /api/game/:gameId/sectors',
      shipCommands: 'POST /api/game/:gameId/ships/:shipId/commands',
      trade: 'POST /api/game/:gameId/ships/:shipId/trade',
      opportunities: 'GET /api/game/:gameId/trade-opportunities'
    }
  });
});

// Utility functions
function calculateFleetCargoValue(gameState: GameState): number {
  return gameState.player.ships.reduce((total, ship) => {
    return total + ship.cargo.reduce((shipTotal, cargo) => {
      const ware = gameState.wares.find(w => w.id === cargo.wareId);
      return shipTotal + (cargo.quantity * (ware?.basePrice || 0));
    }, 0);
  }, 0);
}

function getUsedCargo(ship: any, gameState: GameState): number {
  return ship.cargo.reduce((total: number, cargo: any) => {
    const ware = gameState.wares.find(w => w.id === cargo.wareId);
    return total + (cargo.quantity * (ware?.cargoSize || 1));
  }, 0);
}

// Error handling
app.use((err: any, _req: any, res: any /* , _next: any */) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Uncharted Territory API Server running on port ${port}`);
    console.log(`Access the API at http://localhost:${port}`);
  });
}