import type { 
  GameState, 
  Player, 
  Sector, 
  Ship, 
  WebSocketMessage, 
  WebSocketResponse,
  ShipCommand,
  TradeData
} from './types';

// Game loop configuration
const TICK_RATE_HZ = 10;
const TICK_INTERVAL_MS = 1000 / TICK_RATE_HZ;

export class GameSession implements DurableObject {
  private state: DurableObjectState;
  private gameState: GameState | null = null;
  private lastUpdateTime = 0;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    
    // Initialize game state from storage
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('gameState');
      if (stored) {
        this.gameState = stored as GameState;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle WebSocket connections
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }
    
    // Handle HTTP API requests
    if (url.pathname.endsWith('/new')) {
      return this.handleNewGame(request);
    }
    
    if (url.pathname.endsWith('/state')) {
      return this.handleGetState();
    }
    
    return new Response('Not Found', { status: 404 });
  }

  private async handleWebSocketUpgrade(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Use WebSocket Hibernation for cost optimization
    this.state.acceptWebSocket(server);

    // Start game loop if this is the first connection
    const clients = this.state.getWebSockets();
    if (clients.length === 1) {
      await this.startGameLoop();
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleNewGame(request: Request): Promise<Response> {
    const body = await request.json() as { playerName: string };
    
    if (!body.playerName) {
      return new Response('Player name required', { status: 400 });
    }

    this.gameState = this.createInitialGameState(body.playerName);
    await this.saveGameState();

    return Response.json(this.gameState);
  }

  private async handleGetState(): Promise<Response> {
    if (!this.gameState) {
      return new Response('Game not found', { status: 404 });
    }

    return Response.json(this.gameState);
  }

  // WebSocket Hibernation handlers
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const data = JSON.parse(message as string) as WebSocketMessage;
      const response = await this.processMessage(data);
      
      if (response) {
        ws.send(JSON.stringify(response));
      }
      
      // Broadcast state updates to all clients
      await this.broadcastGameState();
      
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      const errorResponse: WebSocketResponse = {
        type: 'error',
        message: 'Failed to process message'
      };
      ws.send(JSON.stringify(errorResponse));
    }
  }

  async webSocketClose(_ws: WebSocket, code: number, reason: string, _wasClean: boolean): Promise<void> {
    console.log(`WebSocket closed: ${code} ${reason}`);
  }

  // Game loop using Alarms API
  async alarm(): Promise<void> {
    if (!this.gameState) return;

    // Update game time
    const now = Date.now();
    if (this.lastUpdateTime > 0) {
      const deltaTime = now - this.lastUpdateTime;
      this.gameState.gameTime += deltaTime;
    }
    this.lastUpdateTime = now;

    // Process game logic updates
    await this.updateGameLogic();
    
    // Broadcast state to all connected clients
    await this.broadcastGameState();
    
    // Save updated state
    await this.saveGameState();
    
    // Schedule next tick
    await this.state.storage.setAlarm(Date.now() + TICK_INTERVAL_MS);
  }

  private async startGameLoop(): Promise<void> {
    // Check if game loop is already running
    const currentAlarm = await this.state.storage.getAlarm();
    if (currentAlarm === null) {
      this.lastUpdateTime = Date.now();
      await this.state.storage.setAlarm(Date.now() + TICK_INTERVAL_MS);
    }
  }

  private async updateGameLogic(): Promise<void> {
    if (!this.gameState) return;

    // Update ship positions and process commands
    for (const ship of this.gameState.player.ships) {
      if (ship.isMoving) {
        // Simple movement simulation - in real game would use proper physics
        ship.isMoving = false; // Stop movement for now
        
        this.gameState.events.push({
          id: crypto.randomUUID(),
          timestamp: this.gameState.gameTime,
          type: 'ship_moved',
          message: `${ship.name} has reached its destination`,
        });
      }
    }

    // Keep only recent events (last 100)
    this.gameState.events = this.gameState.events.slice(-100);
  }

  private async processMessage(message: WebSocketMessage): Promise<WebSocketResponse | null> {
    if (!this.gameState) {
      return { type: 'error', message: 'Game not initialized' };
    }

    switch (message.type) {
      case 'ping':
        return { type: 'pong' };
        
      case 'requestState':
        return { type: 'gameState', gameState: this.gameState };
        
      case 'shipCommand':
        if (message.shipId && message.command) {
          return await this.processShipCommand(message.shipId, message.command);
        }
        break;
        
      case 'trade':
        if (message.shipId && message.tradeData) {
          return await this.processTrade(message.shipId, message.tradeData);
        }
        break;
    }

    return { type: 'error', message: 'Invalid message type' };
  }

  private async processShipCommand(shipId: string, command: ShipCommand): Promise<WebSocketResponse> {
    const ship = this.gameState!.player.ships.find(s => s.id === shipId);
    if (!ship) {
      return { type: 'error', message: 'Ship not found' };
    }

    switch (command.type) {
      case 'move':
        if (command.targetPosition) {
          ship.position = command.targetPosition;
          ship.isMoving = true;
        }
        break;
        
      case 'dock_at_station':
        if (command.stationId) {
          const sector = this.gameState!.sectors.find(s => s.id === ship.sectorId);
          const station = sector?.stations.find(st => st.id === command.stationId);
          if (station) {
            ship.position = station.position;
            ship.isMoving = false;
          }
        }
        break;
    }

    await this.saveGameState();
    return { type: 'commandResult', shipId, message: 'Command executed' };
  }

  private async processTrade(shipId: string, tradeData: TradeData): Promise<WebSocketResponse> {
    // Simplified trade logic
    this.gameState!.events.push({
      id: crypto.randomUUID(),
      timestamp: this.gameState!.gameTime,
      type: 'trade_completed',
      message: `Trade completed: ${tradeData.action} ${tradeData.quantity} of ${tradeData.wareId}`,
    });

    await this.saveGameState();
    return { type: 'tradeResult', shipId, message: 'Trade completed' };
  }

  private async broadcastGameState(): Promise<void> {
    if (!this.gameState) return;

    const message: WebSocketResponse = {
      type: 'stateUpdate',
      gameState: this.gameState,
      events: this.gameState.events.slice(-10) // Send recent events
    };

    const clients = this.state.getWebSockets();
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    }
  }

  private createInitialGameState(playerName: string): GameState {
    const gameId = crypto.randomUUID();
    const playerId = crypto.randomUUID();
    
    // Create initial sector
    const sector: Sector = {
      id: 'argon-prime',
      name: 'Argon Prime',
      coordinates: { x: 0, y: 0 },
      stations: [{
        id: 'trading-station-1',
        name: 'Trading Station Alpha',
        position: { x: 100, y: 100 },
        sectorId: 'argon-prime',
        inventory: [
          {
            wareId: 'energy-cells',
            quantity: 1000,
            buyPrice: 15,
            sellPrice: 12
          }
        ]
      }],
      gates: []
    };

    // Create initial ship
    const ship: Ship = {
      id: crypto.randomUUID(),
      name: 'Discovery',
      position: { x: 50, y: 50 },
      sectorId: 'argon-prime',
      isMoving: false,
      cargo: [],
      maxCargo: 100
    };

    const player: Player = {
      id: playerId,
      name: playerName,
      credits: 10000,
      ships: [ship]
    };

    return {
      id: gameId,
      player,
      sectors: [sector],
      currentSectorId: 'argon-prime',
      gameTime: 0,
      events: [{
        id: crypto.randomUUID(),
        timestamp: 0,
        type: 'sector_discovered',
        message: 'Welcome to Argon Prime!'
      }]
    };
  }

  private async saveGameState(): Promise<void> {
    if (this.gameState) {
      await this.state.storage.put('gameState', this.gameState);
    }
  }
}