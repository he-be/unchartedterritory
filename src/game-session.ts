// GameSession Durable Object - Single source of truth for each game

// WebSocketPair global declaration for Cloudflare Workers
declare const WebSocketPair: {
  new (): [any, any];
};

import { 
  GameState, 
  ShipCommand, 
  GameEvent, 
  DurableObjectState, 
  CloudflareWebSocket 
} from './types';
import { generateUniverse } from './world-generator';
import { EconomicEngine } from './economic-engine';
import { ShipEngine } from './ship-engine';
import { CommandQueue } from './command-queue';

interface WebSocketMessage {
  type: 'shipCommand' | 'trade' | 'ping' | 'requestState';
  shipId?: string;
  command?: ShipCommand;
  tradeData?: any;
  data?: any;
}

interface WebSocketResponse {
  type: 'gameState' | 'commandResult' | 'tradeResult' | 'error' | 'pong' | 'stateUpdate';
  gameState?: GameState;
  shipId?: string;
  ship?: any;
  player?: any;
  events?: GameEvent[];
  message?: string;
  data?: any;
}

export class GameSession {
  private state: DurableObjectState;
  private env: any;
  private gameState: GameState | null = null;
  private gameLoopActive = false;
  
  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');
    
    // Handle WebSocket upgrade
    if (upgradeHeader && upgradeHeader === 'websocket') {
      return this.handleWebSocketUpgrade();
    }
    
    // Handle HTTP endpoints for backward compatibility
    if (url.pathname === '/new' && request.method === 'POST') {
      return this.handleNewGame();
    }
    
    if (url.pathname === '/state' && request.method === 'GET') {
      return this.handleGetState();
    }
    
    return new Response('Not Found', { status: 404 });
  }

  private async handleWebSocketUpgrade(): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    if (!server) {
      return new Response('Failed to create WebSocket pair', { status: 500 });
    }
    
    // Accept the WebSocket connection with hibernation
    this.state.acceptWebSocket(server as CloudflareWebSocket);
    
    // Initialize game state if needed
    if (!this.gameState) {
      await this.initializeGameState();
    }
    
    // Send initial game state to client
    server.send(JSON.stringify({
      type: 'gameState',
      gameState: this.gameState
    } as WebSocketResponse));
    
    // Start game loop if not already active
    if (!this.gameLoopActive) {
      this.startGameLoop();
    }
    
    return new Response(null, {
      status: 101,
      webSocket: client || null,
    });
  }

  async webSocketMessage(ws: CloudflareWebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') return;
    
    try {
      const data: WebSocketMessage = JSON.parse(message);
      
      switch (data.type) {
        case 'shipCommand':
          if (data.shipId && data.command) {
            await this.handleShipCommand(data.shipId, data.command);
          }
          break;
        case 'trade':
          if (data.shipId && data.tradeData) {
            await this.handleTrade(data.shipId, data.tradeData);
          }
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' } as WebSocketResponse));
          break;
        case 'requestState':
          if (this.gameState) {
            ws.send(JSON.stringify({
              type: 'gameState',
              gameState: this.gameState
            } as WebSocketResponse));
          }
          break;
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process command'
      } as WebSocketResponse));
    }
  }

  async webSocketClose(): Promise<void> {
    // Check if there are any remaining connections
    const connections = this.state.getWebSockets();
    if (connections.length === 0) {
      // No more clients, pause the game loop
      this.gameLoopActive = false;
    }
  }

  private async initializeGameState() {
    // Try to load from storage first
    const stored = await this.state.storage.get<GameState>('gameState');
    if (stored) {
      this.gameState = stored;
    } else {
      // Create new game state
      this.gameState = generateUniverse();
      await this.state.storage.put('gameState', this.gameState);
    }
  }

  private async handleNewGame(): Promise<Response> {
    this.gameState = generateUniverse();
    await this.state.storage.put('gameState', this.gameState);
    
    return new Response(JSON.stringify(this.gameState), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleGetState(): Promise<Response> {
    if (!this.gameState) {
      await this.initializeGameState();
    }
    
    return new Response(JSON.stringify(this.gameState), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private startGameLoop() {
    if (this.gameLoopActive) return;
    
    this.gameLoopActive = true;
    // Set up game loop using Alarms API (10Hz = 100ms)
    this.state.storage.setAlarm(Date.now() + 100);
  }

  async alarm() {
    if (!this.gameState || !this.gameLoopActive) return;
    
    const deltaTime = 0.1; // 100ms tick rate
    
    // Update economy
    const economicEvents = EconomicEngine.updateEconomy(this.gameState);
    
    // Update ship movements and process command queues
    const movementEvents = ShipEngine.updateShipMovement(this.gameState, deltaTime);
    
    // Process command queues for all ships
    this.gameState.player.ships.forEach(ship => {
      if (!ship.isMoving && !ship.currentCommand && ship.commandQueue && ship.commandQueue.length > 0) {
        CommandQueue.processQueue(ship, this.gameState!, ShipEngine);
      }
    });
    
    // Broadcast state updates to all connected clients
    const allEvents = [...economicEvents, ...movementEvents];
    if (allEvents.length > 0) {
      this.broadcast({
        type: 'stateUpdate',
        gameState: this.gameState,
        events: allEvents
      });
    }
    
    // Save state periodically
    await this.state.storage.put('gameState', this.gameState);
    
    // Schedule next tick if clients are connected
    const sockets = this.state.getWebSockets();
    if (sockets.length > 0 && this.gameLoopActive) {
      this.state.storage.setAlarm(Date.now() + 100);
    }
  }

  private broadcast(message: WebSocketResponse) {
    const sockets = this.state.getWebSockets();
    const messageStr = JSON.stringify(message);
    for (const socket of sockets) {
      try {
        socket.send(messageStr);
      } catch (error) {
        // Socket might be closing
        console.error('Failed to send to socket:', error);
      }
    }
  }

  private async handleShipCommand(shipId: string, command: ShipCommand) {
    if (!this.gameState) return;
    
    const ship = this.gameState.player.ships.find(s => s.id === shipId);
    if (!ship) {
      this.broadcast({
        type: 'error',
        message: 'Ship not found'
      });
      return;
    }
    
    // Don't allow commands while moving (except trade)
    if (ship.isMoving && command.type !== 'trade') {
      this.broadcast({
        type: 'error',
        message: 'Ship is currently moving'
      });
      return;
    }
    
    // Execute the command
    const events = ShipEngine.executeCommand(ship, command, this.gameState);
    
    // Process command queue immediately if ship is not moving
    if (!ship.isMoving && !ship.currentCommand && ship.commandQueue && ship.commandQueue.length > 0) {
      CommandQueue.processQueue(ship, this.gameState, ShipEngine);
    }
    
    // Broadcast the command result
    this.broadcast({
      type: 'commandResult',
      shipId,
      ship: {
        id: ship.id,
        name: ship.name,
        position: ship.position,
        sectorId: ship.sectorId,
        isMoving: ship.isMoving,
        currentCommand: ship.currentCommand,
        commandQueue: ship.commandQueue,
        cargo: ship.cargo
      },
      events
    });
    
    // Save state
    await this.state.storage.put('gameState', this.gameState);
  }

  private async handleTrade(shipId: string, tradeData: any) {
    if (!this.gameState) return;
    
    const ship = this.gameState.player.ships.find(s => s.id === shipId);
    if (!ship) {
      this.broadcast({
        type: 'error',
        message: 'Ship not found'
      });
      return;
    }
    
    const { stationId, action, wareId, quantity } = tradeData;
    
    // Find the station
    const sector = this.gameState.sectors.find(s => s.id === ship.sectorId);
    const station = sector?.stations.find(s => s.id === stationId);
    
    if (!station) {
      this.broadcast({
        type: 'error',
        message: 'Station not found'
      });
      return;
    }
    
    // Check distance
    const distance = ShipEngine.getDistance(ship.position, station.position);
    if (distance > 200) {
      this.broadcast({
        type: 'error',
        message: 'Ship too far from station'
      });
      return;
    }
    
    // Execute trade
    const command: ShipCommand = {
      type: 'trade',
      target: stationId,
      parameters: { action: action as 'buy' | 'sell', wareId, quantity }
    };
    
    const events = ShipEngine.executeCommand(ship, command, this.gameState);
    
    // Broadcast trade result
    this.broadcast({
      type: 'tradeResult',
      shipId,
      ship: {
        id: ship.id,
        cargo: ship.cargo
      },
      player: {
        credits: this.gameState.player.credits
      },
      events
    });
    
    // Save state
    await this.state.storage.put('gameState', this.gameState);
  }
}

