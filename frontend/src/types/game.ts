export interface Vector2 {
  x: number;
  y: number;
}

export type CargoClass = 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'ST';

export interface Ware {
  id: string;
  name: string;
  category: 'raw' | 'intermediate' | 'finished';
  cargoClass: CargoClass;
  cargoSize: number;
  basePrice: number;
}

export interface WareStock {
  wareId: string;
  quantity: number;
  maxQuantity: number;
  buyPrice: number;
  sellPrice: number;
}

export interface Station {
  id: string;
  name: string;
  type: 'trading_port' | 'shipyard' | 'hightech_factory' | 'basic_factory' | 'refinery' | 'mine';
  position: Vector2;
  sectorId: string;
  wares: WareStock[];
  produces?: string[];
  consumes?: string[];
}

export interface Gate {
  id: string;
  position: Vector2;
  connectsTo: string;
}

export interface Sector {
  id: string;
  name: string;
  discovered: boolean;
  stations: Station[];
  gates: Gate[];
  asteroids: Vector2[];
}

export interface ShipCargo {
  wareId: string;
  quantity: number;
}

export interface ShipCommand {
  type: 'move' | 'explore' | 'trade';
  target?: string;
  parameters?: {
    action?: 'buy' | 'sell';
    wareId?: string;
    quantity?: number;
    position?: Vector2;
    x?: number;
    y?: number;
  };
}

export interface Ship {
  id: string;
  name: string;
  type: 'scout' | 'trader';
  position: Vector2;
  sectorId: string;
  maxSpeed: number;
  cargoClass: CargoClass;
  cargoCapacity: number;
  cargo: ShipCargo[];
  currentCommand?: ShipCommand;
  isMoving: boolean;
  destination?: Vector2;
}

export interface Player {
  name: string;
  credits: number;
  ships: Ship[];
  discoveredSectors: string[];
}

export interface GameState {
  id: string;
  player: Player;
  sectors: Sector[];
  wares: Ware[];
  gameTime: number;
  lastUpdate: number;
}

export interface GameEvent {
  timestamp: number;
  type: 'discovery' | 'trade' | 'movement' | 'production';
  message: string;
  details?: Record<string, unknown>;
}

export interface TradeOpportunity {
  wareId: string;
  from: {
    stationId: string;
    sectorId: string;
    price: number;
  };
  to: {
    stationId: string;
    sectorId: string;
    price: number;
  };
  profitMargin: number;
}