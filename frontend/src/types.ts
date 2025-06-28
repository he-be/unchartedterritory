// Game Types - Shared with backend
export interface Vector2 {
  x: number;
  y: number;
}

export interface Ship {
  id: string;
  name: string;
  position: Vector2;
  sectorId: string;
  isMoving: boolean;
  cargo: ShipCargo[];
  maxCargo: number;
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
  targetGateId: string;
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
  type: 'ship_moved' | 'trade_completed' | 'sector_discovered';
  message: string;
  data?: Record<string, unknown>;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';