import type { 
  GameState, 
  Player, 
  Sector, 
  Ship, 
  Station,
  Gate,
  Vector2,
  ShipQueueCommand,
  WebSocketMessage, 
  WebSocketResponse,
  ShipCommand,
  TradeData
} from './types';
import { TradingAI } from './trading-ai';
import { SectorGraphManager } from './sector-graph';
import { generateStationsForSector } from './station-generator';
import { getStationType, updateFactoryProduction, updateTradingStationActivity } from './economy';

// Game loop configuration
const TICK_RATE_HZ = 30;
const TICK_INTERVAL_MS = 1000 / TICK_RATE_HZ;

export class GameSession implements DurableObject {
  private state: DurableObjectState;
  private gameState: GameState | null = null;
  private lastUpdateTime = 0;
  private tradingAI: TradingAI | null = null;
  private sectorGraph: SectorGraphManager;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    this.sectorGraph = new SectorGraphManager();
    
    // Initialize game state from storage
    this.state.blockConcurrencyWhile(async () => {
      console.log('DO Constructor: Attempting to load gameState from storage...');
      const stored = await this.state.storage.get('gameState');
      if (stored) {
        this.gameState = stored as GameState;
        this.tradingAI = new TradingAI(this.gameState);
        console.log('DO Constructor: gameState loaded successfully.');
        
        // Validate sector gates on load
        this.validateSectorGates();
      } else {
        console.log('DO Constructor: No gameState found in storage.');
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
    try {
      const body = await request.json() as { playerName: string };
      
      if (!body.playerName) {
        return new Response(JSON.stringify({ error: 'Player name required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get gameId from URL parameter
      const url = new URL(request.url);
      const gameId = url.searchParams.get('gameId');
      
      if (!gameId) {
        return new Response(JSON.stringify({ error: 'Game ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log(`Creating new game with ID: ${gameId}, player: ${body.playerName}`);
      
      this.gameState = this.createInitialGameState(body.playerName, gameId);
      this.tradingAI = new TradingAI(this.gameState);
      await this.saveGameState();
      
      console.log(`Game created successfully: ${gameId}`);
      
      // Process initial command queues for all ships
      for (const ship of this.gameState.player.ships) {
        if (ship.commandQueue.length > 0) {
          console.log(`Processing initial command queue for ${ship.name}`);
          await this.processShipCommandQueue(ship);
        }
      }
      
      return new Response(JSON.stringify(this.gameState), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error in handleNewGame:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to create game',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
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
      // Ensure gameState is loaded before processing messages
      if (!this.gameState) {
        const stored = await this.state.storage.get('gameState');
        if (stored) {
          this.gameState = stored as GameState;
          console.log('Loaded gameState from storage in webSocketMessage');
        }
      }

      const data = JSON.parse(message as string) as WebSocketMessage;
      // WebSocket message processing (verbose logging disabled)
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
    // Load game state if not present
    if (!this.gameState) {
      const stored = await this.state.storage.get('gameState');
      if (stored) {
        this.gameState = stored as GameState;
      } else {
        console.log('Alarm triggered but no game state exists');
        return;
      }
    }

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

    const SHIP_SPEED = 60; // Units per second (3x speed for faster movement)
    const deltaTime = TICK_INTERVAL_MS / 1000; // Convert to seconds

    // Continuous economic simulation - update all stations every tick
    this.updateStationEconomics(deltaTime);

    // Update ship positions and process commands
    for (const ship of this.gameState.player.ships) {
      if (ship.isMoving && ship.destination) {
        // Calculate direction and distance
        const dx = ship.destination.x - ship.position.x;
        const dy = ship.destination.y - ship.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 2) { // Reduced threshold for arrival
          // Arrived at destination
          ship.position = { ...ship.destination };
          ship.isMoving = false;
          delete ship.destination;
          
          // Process command queue when ship arrives at destination
          await this.processShipArrival(ship);
        } else {
          // Move towards destination
          const moveDistance = SHIP_SPEED * deltaTime;
          const ratio = moveDistance / distance;
          ship.position.x += dx * ratio;
          ship.position.y += dy * ratio;
        }
      }
    }

    // Process command queues for all ships
    for (const ship of this.gameState.player.ships) {
      await this.processShipCommandQueue(ship);
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
        if (this.gameState) {
          return { type: 'gameState', gameState: this.gameState };
        } else {
          return { type: 'error', message: 'Game state not available. Please refresh the page.' };
        }
        
      case 'shipCommand':
        if (message.shipId && message.command) {
          return await this.processShipCommand(message.shipId, message.command);
        }
        break;
        
      case 'shipAction':
        if (message.shipId && message.targetPosition) {
          return await this.processShipAction(message.shipId, message.targetPosition, message.targetSectorId);
        }
        break;
        
      case 'trade':
        if (message.shipId && message.tradeData) {
          return await this.processTrade(message.shipId, message.tradeData);
        }
        break;
        
      case 'toggleAutoTrade':
        if (message.shipId && message.enabled !== undefined) {
          return await this.toggleAutoTrade(message.shipId, message.enabled);
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
          ship.destination = { ...command.targetPosition };
          ship.isMoving = true;
          
          this.gameState!.events.push({
            id: crypto.randomUUID(),
            timestamp: this.gameState!.gameTime,
            type: 'ship_command',
            message: `${ship.name} is moving to (${Math.round(command.targetPosition.x)}, ${Math.round(command.targetPosition.y)})`,
          });
        }
        break;
        
      case 'dock_at_station':
        if (command.stationId) {
          const sector = this.gameState!.sectors.find(s => s.id === ship.sectorId);
          const station = sector?.stations.find(st => st.id === command.stationId);
          if (station) {
            ship.destination = { ...station.position };
            ship.isMoving = true;
            
            this.gameState!.events.push({
              id: crypto.randomUUID(),
              timestamp: this.gameState!.gameTime,
              type: 'ship_command',
              message: `${ship.name} is docking at ${station.name}`,
            });
          }
        }
        break;
      
      case 'auto_trade':
        if (this.tradingAI) {
          console.log(`Processing auto_trade command for ${ship.name}`);
          const tradingCommands = this.tradingAI.generateTradingCommands(ship);
          if (tradingCommands.length > 0) {
            ship.commandQueue.unshift(...tradingCommands);
            this.gameState!.events.push({
              id: crypto.randomUUID(),
              timestamp: this.gameState!.gameTime,
              type: 'ship_command',
              message: `${ship.name} starting auto-trade sequence with ${tradingCommands.length} commands`,
            });
          } else {
            console.log(`No trading opportunities found for ${ship.name}`);
            // If continuous auto-trade is enabled, re-add the auto_trade command to queue
            if (ship.isAutoTrading) {
              ship.commandQueue.push({
                id: crypto.randomUUID(),
                type: 'auto_trade',
                targetPosition: { x: 0, y: 0 },
                metadata: { continuous: true }
              });
            }
            this.gameState!.events.push({
              id: crypto.randomUUID(),
              timestamp: this.gameState!.gameTime,
              type: 'ship_command',
              message: `${ship.name} found no trading opportunities, waiting...`,
            });
          }
        }
        break;
        
    }

    await this.saveGameState();
    return { type: 'commandResult', shipId, message: 'Command executed' };
  }

  private async processShipAction(shipId: string, targetPosition: Vector2, targetSectorId?: string): Promise<WebSocketResponse> {
    const ship = this.gameState!.player.ships.find(s => s.id === shipId);
    if (!ship) {
      return { type: 'error', message: 'Ship not found' };
    }

    const currentSector = this.gameState!.sectors.find(s => s.id === ship.sectorId);
    if (!currentSector) {
      return { type: 'error', message: 'Current sector not found' };
    }

    // If targetSectorId is specified and different from ship's current sector,
    // this is a cross-sector movement request
    if (targetSectorId && targetSectorId !== ship.sectorId) {
      return await this.processCrossSectorMovement(ship, currentSector, targetSectorId, targetPosition);
    }

    // Same sector movement - check what was clicked based on target position
    // Check stations first (smaller hit area)
    const clickedStation = currentSector.stations.find(station => {
      const dx = targetPosition.x - station.position.x;
      const dy = targetPosition.y - station.position.y;
      return Math.sqrt(dx * dx + dy * dy) < 30; // 30 unit radius for stations
    });

    if (clickedStation) {
      // Dock at station
      ship.destination = { ...clickedStation.position };
      ship.isMoving = true;
      
      this.gameState!.events.push({
        id: crypto.randomUUID(),
        timestamp: this.gameState!.gameTime,
        type: 'ship_command',
        message: `${ship.name} is docking at ${clickedStation.name}`,
      });

      await this.saveGameState();
      return { type: 'commandResult', shipId, message: `Moving to station ${clickedStation.name}` };
    }

    // Check gates (larger hit area)
    const clickedGate = currentSector.gates.find(gate => {
      const dx = targetPosition.x - gate.position.x;
      const dy = targetPosition.y - gate.position.y;
      return Math.sqrt(dx * dx + dy * dy) < 50; // 50 unit radius for gates
    });

    if (clickedGate) {
      // Move to gate (will auto-jump when arrived)
      ship.destination = { ...clickedGate.position };
      ship.isMoving = true;
      
      this.gameState!.events.push({
        id: crypto.randomUUID(),
        timestamp: this.gameState!.gameTime,
        type: 'ship_command',
        message: `${ship.name} is moving to gate to ${clickedGate.targetSectorId}`,
      });

      await this.saveGameState();
      return { type: 'commandResult', shipId, message: `Moving to gate (will auto-jump to ${clickedGate.targetSectorId})` };
    }

    // Empty space - simple movement
    ship.destination = { ...targetPosition };
    ship.isMoving = true;
    
    this.gameState!.events.push({
      id: crypto.randomUUID(),
      timestamp: this.gameState!.gameTime,
      type: 'ship_command',
      message: `${ship.name} is moving to (${Math.round(targetPosition.x)}, ${Math.round(targetPosition.y)})`,
    });

    await this.saveGameState();
    return { type: 'commandResult', shipId, message: 'Moving to position' };
  }

  private async processCrossSectorMovement(ship: Ship, currentSector: Sector, targetSectorId: string, targetPosition: Vector2): Promise<WebSocketResponse> {
    // Generate command queue for cross-sector movement
    const commandQueue = this.generateCommandQueue(ship.sectorId, targetSectorId, targetPosition);
    
    if (!commandQueue.length) {
      return { type: 'error', message: `No route found from ${currentSector.name} to target sector` };
    }

    // Clear existing queue and set new commands
    ship.commandQueue = commandQueue;
    
    // Start executing the queue
    return await this.executeNextQueueCommand(ship);
  }

  private generateCommandQueue(fromSectorId: string, toSectorId: string, finalPosition: Vector2): ShipQueueCommand[] {
    if (fromSectorId === toSectorId) {
      // Same sector - direct movement
      return [{
        id: crypto.randomUUID(),
        type: 'move_to_position',
        targetPosition: finalPosition,
        targetSectorId: toSectorId
      }];
    }

    // BFS to find shortest path between sectors
    const queue: { sectorId: string; path: string[] }[] = [{ sectorId: fromSectorId, path: [fromSectorId] }];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const { sectorId, path } = queue.shift()!;
      
      if (visited.has(sectorId)) continue;
      visited.add(sectorId);
      
      if (sectorId === toSectorId) {
        // Found path - convert to command queue
        const commands: ShipQueueCommand[] = [];
        
        for (let i = 0; i < path.length - 1; i++) {
          const currentSectorId = path[i];
          const nextSectorId = path[i + 1];
          const sector = this.gameState!.sectors.find(s => s.id === currentSectorId);
          const gate = sector?.gates.find(g => g.targetSectorId === nextSectorId);
          
          if (gate) {
            // Add command to move to gate (will auto-jump when reached)
            commands.push({
              id: crypto.randomUUID(),
              type: 'move_to_gate',
              targetPosition: gate.position,
              targetSectorId: currentSectorId,
              targetGateId: gate.id,
              targetGateSectorId: nextSectorId
            });
          }
        }
        
        // Add final movement command in target sector
        commands.push({
          id: crypto.randomUUID(),
          type: 'move_to_position',
          targetPosition: finalPosition,
          targetSectorId: toSectorId
        });
        
        return commands;
      }
      
      // Add neighboring sectors to queue
      const sector = this.gameState!.sectors.find(s => s.id === sectorId);
      if (sector) {
        for (const gate of sector.gates) {
          if (!visited.has(gate.targetSectorId)) {
            queue.push({ sectorId: gate.targetSectorId, path: [...path, gate.targetSectorId] });
          }
        }
      }
    }
    
    return []; // No route found
  }

  private async executeNextQueueCommand(ship: Ship): Promise<WebSocketResponse> {
    if (ship.commandQueue.length === 0) {
      ship.currentCommand = undefined;
      return { type: 'commandResult', shipId: ship.id, message: 'All commands completed' };
    }

    // Remove the command from queue and set as current
    const nextCommand = ship.commandQueue.shift()!;
    ship.currentCommand = nextCommand;
    
    switch (nextCommand.type) {
      case 'move_to_position':
        ship.destination = { ...nextCommand.targetPosition };
        ship.isMoving = true;
        
        this.gameState!.events.push({
          id: crypto.randomUUID(),
          timestamp: this.gameState!.gameTime,
          type: 'ship_command',
          message: `${ship.name} is moving to position in ${nextCommand.targetSectorId}`,
        });
        break;
        
      case 'move_to_gate':
        ship.destination = { ...nextCommand.targetPosition };
        ship.isMoving = true;
        
        this.gameState!.events.push({
          id: crypto.randomUUID(),
          timestamp: this.gameState!.gameTime,
          type: 'ship_command',
          message: `${ship.name} is moving to gate to ${nextCommand.targetGateSectorId}`,
        });
        break;
        
        
      case 'dock_at_station':
        ship.destination = { ...nextCommand.targetPosition };
        ship.isMoving = true;
        
        this.gameState!.events.push({
          id: crypto.randomUUID(),
          timestamp: this.gameState!.gameTime,
          type: 'ship_command',
          message: `${ship.name} is docking at station ${nextCommand.stationId}`,
        });
        break;
      
      case 'auto_trade':
        if (this.tradingAI) {
          console.log(`Executing auto_trade command for ${ship.name}`);
          const tradingCommands = this.tradingAI.generateTradingCommands(ship);
          if (tradingCommands.length > 0) {
            ship.commandQueue.unshift(...tradingCommands);
            this.gameState!.events.push({
              id: crypto.randomUUID(),
              timestamp: this.gameState!.gameTime,
              type: 'ship_command',
              message: `${ship.name} continuing auto-trade with ${tradingCommands.length} commands`,
            });
          } else {
            console.log(`No trading opportunities found for ${ship.name} during execution`);
            // If continuous auto-trade is enabled, re-add the auto_trade command to queue
            if (ship.isAutoTrading || nextCommand.metadata?.continuous) {
              ship.commandQueue.push({
                id: crypto.randomUUID(),
                type: 'auto_trade',
                targetPosition: { x: 0, y: 0 },
                metadata: { continuous: true }
              });
            }
            this.gameState!.events.push({
              id: crypto.randomUUID(),
              timestamp: this.gameState!.gameTime,
              type: 'ship_command',
              message: `${ship.name} found no trading opportunities, waiting...`,
            });
          }
        }
        // Clear current command to allow next command to be processed
        ship.currentCommand = undefined;
        break;
    }

    await this.saveGameState();
    return { type: 'commandResult', shipId: ship.id, message: `Executing command: ${nextCommand.type}` };
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

  private createInitialGameState(playerName: string, gameId: string): GameState {
    const playerId = crypto.randomUUID();
    
    // Generate all sectors dynamically from the sector graph (single source of truth)
    const sectors: Sector[] = this.generateAllSectorsFromGraph();

    // Create initial ships
    const ship: Ship = {
      id: crypto.randomUUID(),
      name: 'Discovery',
      position: { x: 50, y: 50 },
      sectorId: 'argon-prime',
      isMoving: false,
      cargo: [],
      maxCargo: 100,
      commandQueue: [],
      currentCommand: undefined
    };

    const cargoShip: Ship = {
      id: crypto.randomUUID(),
      name: 'Trader',
      position: { x: 80, y: 80 },
      sectorId: 'argon-prime',
      isMoving: false,
      cargo: [],
      maxCargo: 200,
      isAutoTrading: true,
      commandQueue: [{
        id: crypto.randomUUID(),
        type: 'auto_trade',
        targetPosition: { x: 0, y: 0 },
        metadata: { continuous: true }
      }],
      currentCommand: undefined
    };

    const player: Player = {
      id: playerId,
      name: playerName,
      credits: 25000, // Increased starting credits for better trading experience
      ships: [ship, cargoShip]
    };

    return {
      id: gameId,
      player,
      sectors,
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

  private async processGateUsage(ship: Ship, gate: Gate): Promise<void> {
    const currentSector = this.gameState!.sectors.find(s => s.id === ship.sectorId);
    const targetSector = this.gameState!.sectors.find(s => s.id === gate.targetSectorId);
    
    if (!targetSector) {
      console.error(`Target sector ${gate.targetSectorId} not found`);
      return;
    }
    
    // Find corresponding gate in target sector that leads back to current sector
    const returnGate = targetSector.gates.find(g => g.targetSectorId === ship.sectorId);
    
    // Move ship to target sector
    ship.sectorId = gate.targetSectorId;
    ship.isMoving = false;
    delete ship.destination;
    
    // Position ship at the return gate in the target sector, or at center if no return gate
    if (returnGate) {
      ship.position = { x: returnGate.position.x + 50, y: returnGate.position.y }; // Slightly offset from gate
    } else {
      ship.position = { x: 0, y: 0 }; // Center of target sector
    }
    
    // Process next command in queue immediately after gate jump
    if (ship.commandQueue.length > 0) {
      // Don't wait for next tick, execute immediately
      await this.processShipCommandQueue(ship);
    }
    
    // Do NOT automatically update currentSectorId - sector map should be controlled independently
    // Ships can move between sectors without forcing the map to change
    
    this.gameState!.events.push({
      id: crypto.randomUUID(),
      timestamp: this.gameState!.gameTime,
      type: 'sector_changed',
      message: `${ship.name} has jumped to ${targetSector.name}`,
      data: { 
        fromSector: currentSector?.name,
        toSector: targetSector.name,
        shipId: ship.id 
      }
    });
    
    console.log(`Ship ${ship.name} jumped from ${currentSector?.name} to ${targetSector.name}`);
  }

  private async processShipArrival(ship: Ship): Promise<void> {
    if (!this.gameState) return;

    // Check if ship arrived at a gate and auto-activate it
    const currentSector = this.gameState.sectors.find(s => s.id === ship.sectorId);
    const nearbyGate = currentSector?.gates.find(gate => {
      const gateDistance = Math.sqrt(
        Math.pow(ship.position.x - gate.position.x, 2) + 
        Math.pow(ship.position.y - gate.position.y, 2)
      );
      return gateDistance < 30;
    });
    
    if (nearbyGate) {
      // Auto-activate gate when arriving at it
      // Ship arrived at gate - auto-activating
      await this.processGateUsage(ship, nearbyGate);
      
      // After gate usage, clear current command
      if (ship.currentCommand) {
        // Command completed
        ship.currentCommand = undefined;
      }
      
      // Process next command in queue after gate arrival
      await this.processShipCommandQueue(ship);
    } else {
      // Check if ship arrived at a station
      const nearbyStation = currentSector?.stations.find(station => {
        const stationDistance = Math.sqrt(
          Math.pow(ship.position.x - station.position.x, 2) + 
          Math.pow(ship.position.y - station.position.y, 2)
        );
        return stationDistance < 30;
      });
      
      console.log(`Ship ${ship.name} arrival check: nearbyStation=${nearbyStation?.name}, currentCommand=${ship.currentCommand?.type}, hasMetadata=${!!ship.currentCommand?.metadata}`);
      if (nearbyStation && ship.currentCommand?.type === 'dock_at_station') {
        // Execute trade if this is a trading command
        console.log(`Calling executeAutoTrade for ${ship.name} at ${nearbyStation.name}`);
        await this.executeAutoTrade(ship, nearbyStation, ship.currentCommand);
      }
      
      // Normal arrival - clear current command
      if (ship.currentCommand) {
        ship.currentCommand = undefined;
      }
      
      this.gameState.events.push({
        id: crypto.randomUUID(),
        timestamp: this.gameState.gameTime,
        type: 'ship_moved',
        message: `${ship.name} has reached its destination`,
      });
      
      // Process next command in queue after normal arrival
      await this.processShipCommandQueue(ship);
    }
  }

  private async processShipCommandQueue(ship: Ship): Promise<void> {
    if (!this.gameState) return;

    // If ship is not moving and has commands in queue, execute next command
    if (!ship.isMoving && ship.commandQueue.length > 0 && !ship.currentCommand) {
      console.log(`Processing command queue for ${ship.name}: ${ship.commandQueue.length} commands in queue`);
      await this.executeNextQueueCommand(ship);
      await this.saveGameState(); // Ensure UI gets updated queue state
    }
  }

  private async toggleAutoTrade(shipId: string, enabled: boolean): Promise<WebSocketResponse> {
    const ship = this.gameState!.player.ships.find(s => s.id === shipId);
    if (!ship) {
      return { type: 'error', message: 'Ship not found' };
    }

    ship.isAutoTrading = enabled;

    if (enabled) {
      // Clear entire command queue when enabling auto-trade
      ship.commandQueue = [];
      ship.currentCommand = undefined;
      
      // Start auto trading by adding auto_trade command to queue
      const autoTradeCommand: ShipQueueCommand = {
        id: crypto.randomUUID(),
        type: 'auto_trade',
        targetPosition: { x: 0, y: 0 },
        metadata: { continuous: true }
      };
      
      // Add to beginning of queue
      ship.commandQueue.unshift(autoTradeCommand);
      
      // Immediately start processing the auto-trade command
      await this.processShipCommandQueue(ship);
      
      this.gameState!.events.push({
        id: crypto.randomUUID(),
        timestamp: this.gameState!.gameTime,
        type: 'ship_command',
        message: `${ship.name} auto-trade enabled - command queue cleared`,
      });
    } else {
      // Clear entire command queue when disabling auto-trade
      ship.commandQueue = [];
      ship.currentCommand = undefined;
      
      this.gameState!.events.push({
        id: crypto.randomUUID(),
        timestamp: this.gameState!.gameTime,
        type: 'ship_command',
        message: `${ship.name} auto-trade disabled - command queue cleared`,
      });
    }

    await this.saveGameState();
    return { type: 'commandResult', shipId, message: `Auto-trade ${enabled ? 'enabled' : 'disabled'}` };
  }

  private async saveGameState(): Promise<void> {
    if (this.gameState) {
      await this.state.storage.put('gameState', this.gameState);
    }
  }

  private async executeAutoTrade(ship: Ship, station: Station, command: ShipQueueCommand): Promise<void> {
    console.log(`executeAutoTrade called for ${ship.name} at ${station.name}`);
    if (!this.gameState || !command.metadata) {
      console.log(`executeAutoTrade failed: gameState=${!!this.gameState}, metadata=${!!command.metadata}`);
      return;
    }

    const tradeType = command.metadata.tradeType as string;
    const wareId = command.metadata.wareId as string;
    const quantity = command.metadata.quantity as number;

    if (!tradeType || !wareId || !quantity) return;

    const stationInventory = station.inventory.find(inv => inv.wareId === wareId);
    if (!stationInventory) {
      console.log(`executeAutoTrade failed: station ${station.name} doesn't have ${wareId}`);
      return;
    }
    
    console.log(`Executing ${tradeType} trade: ${quantity} ${wareId} at ${station.name}`);
    console.log(`Station inventory: quantity=${stationInventory.quantity}, buyPrice=${stationInventory.buyPrice}, sellPrice=${stationInventory.sellPrice}`);

    try {
      if (tradeType === 'buy') {
        // Buy from station (station selling to us)
        const cost = stationInventory.sellPrice * quantity;
        console.log(`Buy attempt: cost=${cost}, playerCredits=${this.gameState.player.credits}, stationQuantity=${stationInventory.quantity}, requestedQuantity=${quantity}`);
        
        if (this.gameState.player.credits >= cost && stationInventory.quantity >= quantity) {
          // Execute purchase
          const oldCredits = this.gameState.player.credits;
          const oldStationQuantity = stationInventory.quantity;
          
          this.gameState.player.credits -= cost;
          stationInventory.quantity -= quantity;
          
          // Add cargo to ship
          const existingCargo = ship.cargo.find(c => c.wareId === wareId);
          if (existingCargo) {
            existingCargo.quantity += quantity;
          } else {
            ship.cargo.push({ wareId, quantity });
          }

          console.log(`BUY SUCCESS: Credits ${oldCredits} → ${this.gameState.player.credits}, Station stock ${oldStationQuantity} → ${stationInventory.quantity}, Ship cargo +${quantity}`);

          this.gameState.events.push({
            id: crypto.randomUUID(),
            timestamp: this.gameState.gameTime,
            type: 'trade',
            message: `${ship.name} bought ${quantity} ${wareId} from ${station.name} for ${cost} credits`,
          });
        } else {
          console.log(`BUY FAILED: Insufficient credits or stock. Need ${cost} credits (have ${this.gameState.player.credits}), need ${quantity} items (station has ${stationInventory.quantity})`);
        }
      } else if (tradeType === 'sell') {
        // Sell to station (station buying from us)
        const shipCargo = ship.cargo.find(c => c.wareId === wareId);
        const revenue = stationInventory.buyPrice * quantity;
        console.log(`Sell attempt: revenue=${revenue}, shipCargo=${shipCargo?.quantity || 0}, requestedQuantity=${quantity}`);
        
        if (shipCargo && shipCargo.quantity >= quantity) {
          // Execute sale
          const oldCredits = this.gameState.player.credits;
          const oldShipCargo = shipCargo.quantity;
          const oldStationQuantity = stationInventory.quantity;
          
          this.gameState.player.credits += revenue;
          stationInventory.quantity += quantity;
          
          // Remove cargo from ship
          shipCargo.quantity -= quantity;
          if (shipCargo.quantity <= 0) {
            ship.cargo = ship.cargo.filter(c => c.wareId !== wareId);
          }

          console.log(`SELL SUCCESS: Credits ${oldCredits} → ${this.gameState.player.credits}, Ship cargo ${oldShipCargo} → ${shipCargo.quantity <= 0 ? 0 : shipCargo.quantity}, Station stock ${oldStationQuantity} → ${stationInventory.quantity}`);

          this.gameState.events.push({
            id: crypto.randomUUID(),
            timestamp: this.gameState.gameTime,
            type: 'trade',
            message: `${ship.name} sold ${quantity} ${wareId} to ${station.name} for ${revenue} credits`,
          });
        } else {
          console.log(`SELL FAILED: Insufficient cargo. Ship has ${shipCargo?.quantity || 0}, needs ${quantity}`);
        }
      }
    } catch (error) {
      console.error('Error executing auto-trade:', error);
    }
  }

  /**
   * Generate all sectors from the sector graph with their stations and gates
   */
  private generateAllSectorsFromGraph(): Sector[] {
    const allSectorMetadata = this.sectorGraph.getAllSectorMetadata();
    const sectors: Sector[] = [];
    
    for (const metadata of allSectorMetadata) {
      const sector: Sector = {
        id: metadata.id,
        name: metadata.name,
        coordinates: metadata.coordinates,
        stations: generateStationsForSector({
          minStations: 2,
          maxStations: 3,
          sectorId: metadata.id,
          sectorName: metadata.name,
          seed: `${metadata.id}-stations` // Deterministic generation based on sector
        }),
        gates: this.sectorGraph.generateGatesForSector(metadata.id)
      };
      sectors.push(sector);
    }
    
    return sectors;
  }

  /**
   * Update station economics with continuous production/consumption and NPC trading
   */
  private updateStationEconomics(deltaTimeSeconds: number): void {
    if (!this.gameState) return;

    for (const sector of this.gameState.sectors) {
      for (const station of sector.stations) {
        if (!station.stationTypeId || !station.economicState) continue;
        
        const stationType = getStationType(station.stationTypeId);
        if (!stationType) continue;
        
        // Update factory production/consumption
        if (stationType.economicType === 'factory') {
          updateFactoryProduction(station, stationType, station.economicState, deltaTimeSeconds);
        }
        
        // Update trading station NPC activity
        if (stationType.economicType === 'trading_station') {
          updateTradingStationActivity(station, stationType, station.economicState, deltaTimeSeconds);
        }
      }
    }
  }

  /**
   * Validate sector gates against the graph and log any issues
   */
  private validateSectorGates(): void {
    if (!this.gameState) return;

    console.log('🔍 Validating sector gate configuration...');
    
    const validationResult = this.sectorGraph.validateSectorGates(this.gameState.sectors);
    
    if (validationResult.isValid) {
      console.log('✅ All sector gates are properly configured');
    } else {
      console.error('❌ Sector gate validation failed:');
      validationResult.errors.forEach(error => console.error(`  - ${error}`));
      
      if (validationResult.missingGates.length > 0) {
        console.error('🚫 Missing gates:');
        validationResult.missingGates.forEach(gate => 
          console.error(`  - ${gate.fromSectorId} → ${gate.toSectorId}`)
        );
      }
      
      if (validationResult.extraGates.length > 0) {
        console.error('⚠️ Extra gates:');
        validationResult.extraGates.forEach(gate => 
          console.error(`  - ${gate.id} → ${gate.targetSectorId}`)
        );
      }
    }

    // Also validate graph connectivity
    const allSectorIds = this.gameState.sectors.map(s => s.id);
    const connectivityResult = this.sectorGraph.validateGraphConnectivity(allSectorIds);
    
    if (connectivityResult.isConnected) {
      console.log('✅ All sectors are reachable (graph is connected)');
    } else {
      console.error('❌ Graph connectivity issues:');
      connectivityResult.errors.forEach(error => console.error(`  - ${error}`));
    }
  }
}
