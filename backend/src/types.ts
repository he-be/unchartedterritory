// Game Types - Core game data structures
export interface Vector2 {
  x: number;
  y: number;
}

export interface Ship {
  id: string;
  name: string;
  position: Vector2;
  destination?: Vector2;
  sectorId: string;
  isMoving: boolean;
  cargo: ShipCargo[];
  maxCargo: number;
  commandQueue: ShipQueueCommand[]; // Queue of commands to execute
  currentCommand?: ShipQueueCommand; // Currently executing command
}

export interface ShipCargo {
  wareId: string;
  quantity: number;
}

export interface Station {
  id: string;
  name: string;
  position: Vector2;
  sectorId: string;
  inventory: StationInventory[];
}

export interface StationInventory {
  wareId: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
}

export interface Sector {
  id: string;
  name: string;
  coordinates: Vector2;
  stations: Station[];
  gates: Gate[];
}

export interface Gate {
  id: string;
  position: Vector2;
  targetSectorId: string;
}

export interface Player {
  id: string;
  name: string;
  credits: number;
  ships: Ship[];
}

export interface GameState {
  id: string;
  player: Player;
  sectors: Sector[];
  currentSectorId: string;
  gameTime: number;
  events: GameEvent[];
}

export interface GameEvent {
  id: string;
  timestamp: number;
  type: 'ship_moved' | 'trade_completed' | 'sector_discovered' | 'ship_command' | 'sector_changed';
  message: string;
  data?: Record<string, unknown>;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'shipCommand' | 'shipAction' | 'trade' | 'ping' | 'requestState';
  shipId?: string;
  command?: ShipCommand;
  targetPosition?: Vector2;
  targetSectorId?: string;
  tradeData?: TradeData;
  data?: Record<string, unknown>;
}

export interface WebSocketResponse {
  type: 'gameState' | 'commandResult' | 'tradeResult' | 'error' | 'pong' | 'stateUpdate';
  gameState?: GameState;
  shipId?: string;
  events?: GameEvent[];
  message?: string;
  data?: Record<string, unknown>;
}

export interface ShipCommand {
  type: 'move' | 'dock_at_station' | 'auto_move';
  targetPosition?: Vector2;
  stationId?: string;
}

export interface ShipQueueCommand {
  id: string;
  type: 'move_to_position' | 'move_to_gate' | 'dock_at_station';
  targetPosition: Vector2;
  targetSectorId?: string;
  targetGateId?: string;
  targetGateSectorId?: string;
  stationId?: string;
  metadata?: Record<string, unknown>;
}

export interface TradeData {
  stationId: string;
  wareId: string;
  quantity: number;
  action: 'buy' | 'sell';
}

// Environment Types
export interface Env {
  GAME_SESSION: DurableObjectNamespace;
}