// Core game data structures for Uncharted Territory

export interface Vector2 {
  x: number;
  y: number;
}

export interface Ware {
  id: string;
  name: string;
  category: 'raw' | 'intermediate' | 'finished';
  cargoClass: 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'ST';
  cargoSize: number; // S=1, M=5, L=10, XL=50, XXL=100, ST=1000
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
  produces?: string[]; // ware IDs this station produces
  consumes?: string[]; // ware IDs this station consumes
}

export interface Gate {
  id: string;
  position: Vector2;
  connectsTo: string; // sector ID
}

export interface Sector {
  id: string;
  name: string;
  discovered: boolean;
  stations: Station[];
  gates: Gate[];
  asteroids: Vector2[]; // for future mining
}

export interface Ship {
  id: string;
  name: string;
  type: 'scout' | 'trader';
  position: Vector2;
  sectorId: string;
  maxSpeed: number;
  cargoClass: 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'ST';
  cargoCapacity: number;
  cargo: { wareId: string; quantity: number }[];
  currentCommand?: ShipCommand | undefined;
  commandQueue: ShipCommand[];
  isMoving: boolean;
  destination?: Vector2 | undefined;
}

export interface ShipCommand {
  type: 'move' | 'explore' | 'trade' | 'auto-move';
  target?: string; // station ID or sector ID
  parameters?: {
    action?: 'buy' | 'sell';
    wareId?: string;
    quantity?: number;
    position?: Vector2;
    x?: number;
    y?: number;
    targetSectorId?: string; // for auto-move across sectors
  };
}

export interface Player {
  name: string;
  credits: number;
  ships: Ship[];
  discoveredSectors: string[];
}

export interface GalaxyMap {
  sectors: { [sectorId: string]: GalaxySectorNode };
  connections: GalaxyConnection[];
}

export interface GalaxySectorNode {
  id: string;
  name: string;
  position: Vector2; // Position on galaxy map
  discovered: boolean;
}

export interface GalaxyConnection {
  id: string; // Unique connection ID (gate pair)
  sectorA: string;
  sectorB: string;
  gateAId: string; // Gate ID in sector A
  gateBId: string; // Gate ID in sector B
}

export interface GameState {
  id: string;
  player: Player;
  sectors: Sector[];
  galaxyMap: GalaxyMap;
  wares: Ware[];
  gameTime: number; // in seconds
  lastUpdate: number; // timestamp
}

export interface GameEvent {
  timestamp: number;
  type: 'discovery' | 'trade' | 'movement' | 'production';
  message: string;
  details?: any;
}

// Cloudflare Workers Durable Objects and WebSocket types
export interface DurableObjectState {
  storage: DurableObjectStorage;
  acceptWebSocket(ws: CloudflareWebSocket): void;
  getWebSockets(): CloudflareWebSocket[];
}

export interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteAll(): Promise<void>;
  list<T>(options?: { prefix?: string; limit?: number }): Promise<Map<string, T>>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  getAlarm(): Promise<number | null>;
  deleteAlarm(): Promise<void>;
}

export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  idFromString(hexId: string): DurableObjectId;
  newUniqueId(): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

export interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

export interface CloudflareRequestInit {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | ArrayBuffer | null;
  signal?: AbortSignal | null;
}

export interface DurableObjectStub {
  fetch(request: Request | string, init?: CloudflareRequestInit): Promise<Response>;
}

export interface CloudflareWebSocket {
  send(message: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

export interface CloudflareWebSocketPair {
  (): [CloudflareWebSocket, CloudflareWebSocket];
}

export interface CloudflareEnv {
  GAME_SESSION: DurableObjectNamespace;
}