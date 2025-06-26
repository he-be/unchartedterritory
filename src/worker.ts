// Uncharted Territory - Cloudflare Workers Implementation

import { GameState, ShipCommand, GameEvent } from './types';
import { generateUniverse } from './world-generator';
import { EconomicEngine } from './economic-engine';
import { ShipEngine } from './ship-engine';

// KV storage would be used in production for game state persistence
// For MVP, we use in-memory storage (will reset on deployment)
const gameStates = new Map<string, GameState>();
const gameEvents = new Map<string, GameEvent[]>();

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      if (url.pathname === '/') {
        return handleRoot(corsHeaders);
      }
      
      if (url.pathname === '/health') {
        return handleHealth(corsHeaders);
      }

      if (url.pathname === '/api/game/new' && method === 'POST') {
        return handleNewGame(corsHeaders);
      }

      const gameStateMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/state$/);
      if (gameStateMatch && gameStateMatch[1] && method === 'GET') {
        return handleGameState(gameStateMatch[1], corsHeaders);
      }

      const sectorsMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/sectors$/);
      if (sectorsMatch && sectorsMatch[1] && method === 'GET') {
        return handleSectors(sectorsMatch[1], corsHeaders);
      }

      const sectorDetailMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/sectors\/([^/]+)$/);
      if (sectorDetailMatch && sectorDetailMatch[1] && sectorDetailMatch[2] && method === 'GET') {
        return handleSectorDetail(sectorDetailMatch[1], sectorDetailMatch[2], corsHeaders);
      }

      const shipCommandMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/ships\/([^/]+)\/commands$/);
      if (shipCommandMatch && shipCommandMatch[1] && shipCommandMatch[2] && method === 'POST') {
        return handleShipCommand(shipCommandMatch[1], shipCommandMatch[2], request, corsHeaders);
      }

      const tradeOpportunitiesMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/trade-opportunities$/);
      if (tradeOpportunitiesMatch && tradeOpportunitiesMatch[1] && method === 'GET') {
        return handleTradeOpportunities(tradeOpportunitiesMatch[1], corsHeaders);
      }

      const tradeMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/ships\/([^/]+)\/trade$/);
      if (tradeMatch && tradeMatch[1] && tradeMatch[2] && method === 'POST') {
        return handleTrade(tradeMatch[1], tradeMatch[2], request, corsHeaders);
      }

      const playerMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/player$/);
      if (playerMatch && playerMatch[1] && method === 'GET') {
        return handlePlayer(playerMatch[1], corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  },
};

function handleRoot(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({
    message: 'Uncharted Territory - Space Economic Simulation',
    version: '1.0.0-MVP',
    edge: 'Cloudflare Workers',
    endpoints: {
      newGame: 'POST /api/game/new',
      gameState: 'GET /api/game/:gameId/state',
      sectors: 'GET /api/game/:gameId/sectors',
      shipCommands: 'POST /api/game/:gameId/ships/:shipId/commands',
      trade: 'POST /api/game/:gameId/ships/:shipId/trade',
      opportunities: 'GET /api/game/:gameId/trade-opportunities'
    }
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function handleHealth(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({
    status: 'OK',
    service: 'Uncharted Territory API',
    edge: 'Cloudflare Workers',
    activeGames: gameStates.size
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function handleNewGame(corsHeaders: Record<string, string>): Response {
  const gameState = generateUniverse();
  gameStates.set(gameState.id, gameState);
  gameEvents.set(gameState.id, []);

  return new Response(JSON.stringify({
    gameId: gameState.id,
    message: 'New game created',
    initialState: {
      playerId: gameState.player.name,
      credits: gameState.player.credits,
      startingSector: gameState.sectors.find(s => s.discovered)?.name,
      shipCount: gameState.player.ships.length
    }
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function handleGameState(gameId: string, corsHeaders: Record<string, string>): Response {
  const gameState = gameStates.get(gameId);

  if (!gameState) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Update economy before returning state
  const economicEvents = EconomicEngine.updateEconomy(gameState);
  const movementEvents = ShipEngine.updateShipMovement(gameState, 1);

  const events = gameEvents.get(gameId) || [];
  events.push(...economicEvents, ...movementEvents);
  gameEvents.set(gameId, events);

  return new Response(JSON.stringify({
    gameId: gameState.id,
    gameTime: gameState.gameTime,
    player: gameState.player,
    discoveredSectors: gameState.sectors.filter(s => s.discovered),
    recentEvents: events.slice(-10)
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function handleSectors(gameId: string, corsHeaders: Record<string, string>): Response {
  const gameState = gameStates.get(gameId);

  if (!gameState) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
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

  return new Response(JSON.stringify(discoveredSectors), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function handleSectorDetail(gameId: string, sectorId: string, corsHeaders: Record<string, string>): Response {
  const gameState = gameStates.get(gameId);

  if (!gameState) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const sector = gameState.sectors.find(s => s.id === sectorId);
  if (!sector || !sector.discovered) {
    return new Response(JSON.stringify({ error: 'Sector not found or not discovered' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Update prices for this sector
  sector.stations.forEach(station => {
    EconomicEngine.updatePrices(station, gameState.wares);
  });

  const playerShipsInSector = gameState.player.ships.filter(ship => ship.sectorId === sectorId);

  return new Response(JSON.stringify({
    ...sector,
    playerShips: playerShipsInSector,
    wares: gameState.wares
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleShipCommand(gameId: string, shipId: string, request: Request, corsHeaders: Record<string, string>): Promise<Response> {
  const gameState = gameStates.get(gameId);
  if (!gameState) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const ship = gameState.player.ships.find(s => s.id === shipId);
  if (!ship) {
    return new Response(JSON.stringify({ error: 'Ship not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  let command: ShipCommand;
  try {
    command = await request.json() as ShipCommand;
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  if (ship.isMoving && command.type !== 'trade') {
    return new Response(JSON.stringify({ error: 'Ship is currently moving' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const events = ShipEngine.executeCommand(ship, command, gameState);
  const existingEvents = gameEvents.get(gameId) || [];
  gameEvents.set(gameId, [...existingEvents, ...events]);

  return new Response(JSON.stringify({
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
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function handleTradeOpportunities(gameId: string, corsHeaders: Record<string, string>): Response {
  const gameState = gameStates.get(gameId);

  if (!gameState) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const opportunities = EconomicEngine.getTradeOpportunities(gameState);
  return new Response(JSON.stringify(opportunities.slice(0, 20)), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleTrade(gameId: string, shipId: string, request: Request, corsHeaders: Record<string, string>): Promise<Response> {
  const gameState = gameStates.get(gameId);
  if (!gameState) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const ship = gameState.player.ships.find(s => s.id === shipId);
  if (!ship) {
    return new Response(JSON.stringify({ error: 'Ship not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  let tradeData: { stationId: string; action: string; wareId: string; quantity: number };
  try {
    tradeData = await request.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const { stationId, action, wareId, quantity } = tradeData;

  // Find the station
  const sector = gameState.sectors.find(s => s.id === ship.sectorId);
  const station = sector?.stations.find(s => s.id === stationId);
  
  if (!station) {
    return new Response(JSON.stringify({ error: 'Station not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Check if ship is close enough to station
  const distance = ShipEngine.getDistance(ship.position, station.position);
  if (distance > 200) {
    return new Response(JSON.stringify({ error: 'Ship too far from station' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const command: ShipCommand = {
    type: 'trade',
    target: stationId,
    parameters: { action: action as 'buy' | 'sell', wareId, quantity }
  };

  const events = ShipEngine.executeCommand(ship, command, gameState);
  const existingEvents = gameEvents.get(gameId) || [];
  gameEvents.set(gameId, [...existingEvents, ...events]);

  return new Response(JSON.stringify({
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
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function handlePlayer(gameId: string, corsHeaders: Record<string, string>): Response {
  const gameState = gameStates.get(gameId);

  if (!gameState) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const totalCargoValue = gameState.player.ships.reduce((total, ship) => {
    return total + ship.cargo.reduce((shipTotal, cargo) => {
      const ware = gameState.wares.find(w => w.id === cargo.wareId);
      return shipTotal + (cargo.quantity * (ware?.basePrice || 0));
    }, 0);
  }, 0);

  return new Response(JSON.stringify({
    ...gameState.player,
    totalCargoValue,
    fleetStatus: gameState.player.ships.map(ship => ({
      id: ship.id,
      name: ship.name,
      type: ship.type,
      sectorName: gameState.sectors.find(s => s.id === ship.sectorId)?.name,
      isMoving: ship.isMoving,
      cargoFull: ship.cargo.reduce((total, cargo) => {
        const ware = gameState.wares.find(w => w.id === cargo.wareId);
        return total + (cargo.quantity * (ware?.cargoSize || 1));
      }, 0) / ship.cargoCapacity
    }))
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}