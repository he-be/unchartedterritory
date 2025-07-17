# Uncharted Territory 詳細設計書

## 1. はじめに

本書は「Uncharted Territory」のゲームデザイン文書および基本設計書に基づき、実装に必要な詳細な技術仕様を定義します。

### 1.1 文書の位置づけ
- ゲームデザイン仕様書（GAME_DESIGN_DOCUMENT.txt）：ゲームの概念と仕様
- 基本設計書（GAME_SYSTEM_DOCUMENT.txt）：システム構成とアーキテクチャ
- **詳細設計書（本書）**：実装レベルの詳細仕様

### 1.2 システム概要
放置型宇宙経済シミュレーションゲームのクライアント・サーバーシステム。Cloudflare Workers/Durable Objectsを基盤とし、WebSocketによるリアルタイム通信を実現。

## 2. クライアント側詳細設計

### 2.1 アーキテクチャ概要
```
[UI Layer]
    ├── React/Vue Components
    ├── Canvas Renderer (ゲームマップ)
    └── UI Panels (フローティングウィンドウ)
[State Management]
    ├── Game State Store
    └── UI State Store
[Communication Layer]
    ├── WebSocket Manager
    └── Command Queue
[Rendering Engine]
    ├── Map Renderer
    ├── Entity Renderer
    └── UI Renderer
```

### 2.2 コンポーネント設計

#### 2.2.1 メインビューコンポーネント
```typescript
interface MainViewProps {
  gameState: GameState;
  selectedEntity: Entity | null;
  onEntitySelect: (entity: Entity) => void;
}

class MainView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private viewport: Viewport;
  private renderer: MapRenderer;
  
  // パン・ズーム機能
  handleMouseWheel(event: WheelEvent): void;
  handleMouseDrag(event: MouseEvent): void;
  
  // 描画ループ (30fps)
  render(): void {
    // セクター描画
    // ゲート接続曲線描画
    // 船・ステーション描画
  }
}
```

#### 2.2.2 船団パネルコンポーネント
```typescript
interface FleetPanelProps {
  ships: Ship[];
  onShipSelect: (ship: Ship) => void;
  onSellShip: (shipId: string) => void;
  onToggleAI: (shipId: string, enabled: boolean) => void;
}

// 各船のステータス表示
interface ShipStatusDisplay {
  shipId: string;
  name: string;
  status: 'Idle' | 'Trading' | 'MovingToBuy' | 'MovingToSell';
  cargo: CargoInfo | null;
  destination: string | null;
  profit: number;
}
```

#### 2.2.3 情報パネルコンポーネント
```typescript
interface InfoPanelProps {
  selectedEntity: Station | Ship | Gate | null;
}

// ステーション情報表示
interface StationInfoDisplay {
  stationId: string;
  type: 'Mine' | 'Factory' | 'Trading Hub';
  inventory: InventoryItem[];
  production: ProductionInfo;
  consumption: ConsumptionInfo[];
}
```

### 2.3 状態管理設計

#### 2.3.1 GameStateStore
```typescript
class GameStateStore {
  private state: GameState;
  private subscribers: Set<() => void>;
  
  // WebSocketから受信した状態を更新
  updateFromServer(newState: GameState): void;
  
  // 最適化：差分更新
  applyStateDiff(diff: GameStateDiff): void;
  
  // ゲッター
  getShips(): Ship[];
  getSectors(): Sector[];
  getCredits(): number;
}
```

#### 2.3.2 UIStateStore
```typescript
class UIStateStore {
  selectedEntityId: string | null;
  viewportState: {
    center: { x: number; y: number };
    zoom: number;
  };
  activePanels: {
    fleet: boolean;
    info: boolean;
    tradelog: boolean;
  };
}
```

### 2.4 通信層設計

#### 2.4.1 WebSocketManager
```typescript
class WebSocketManager {
  private ws: WebSocket;
  private commandQueue: Command[];
  private reconnectAttempts: number;
  
  connect(url: string): Promise<void>;
  
  // コマンド送信（キューイング機能付き）
  sendCommand(command: Command): void;
  
  // 自動再接続
  private handleDisconnect(): void;
  
  // メッセージハンドラー
  private handleMessage(event: MessageEvent): void {
    const message = JSON.parse(event.data);
    switch (message.type) {
      case 'gameStateUpdate':
        gameStateStore.updateFromServer(message.payload);
        break;
      case 'notification':
        uiStore.showNotification(message.payload);
        break;
    }
  }
}
```

### 2.5 レンダリング詳細

#### 2.5.1 座標系とビューポート
```typescript
// ワールド座標系（ゲーム内座標）
interface WorldCoordinate {
  x: number; // 0-2000 per sector
  y: number; // 0-2000 per sector
  sectorId: number;
}

// スクリーン座標系（Canvas座標）
interface ScreenCoordinate {
  x: number;
  y: number;
}

class CoordinateTransformer {
  worldToScreen(world: WorldCoordinate, viewport: Viewport): ScreenCoordinate;
  screenToWorld(screen: ScreenCoordinate, viewport: Viewport): WorldCoordinate;
}
```

#### 2.5.2 描画最適化
```typescript
class RenderOptimizer {
  // 視界外のオブジェクトをカリング
  cullInvisibleObjects(entities: Entity[], viewport: Viewport): Entity[];
  
  // LOD（Level of Detail）システム
  getDetailLevel(zoomLevel: number): 'high' | 'medium' | 'low';
  
  // バッチレンダリング
  batchRenderShips(ships: Ship[], ctx: CanvasRenderingContext2D): void;
}
```

## 3. サーバー側詳細設計

### 3.1 Cloudflare Worker設計

#### 3.1.1 メインWorkerクラス
```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    
    if (upgradeHeader === 'websocket') {
      // WebSocket接続処理
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      // 認証チェック
      const userId = await authenticateUser(request, env);
      if (!userId) return new Response('Unauthorized', { status: 401 });
      
      // Durable Objectに接続
      const id = env.GAME_STATE.idFromName(userId);
      const gameState = env.GAME_STATE.get(id);
      
      // WebSocket接続をDurable Objectに転送
      await gameState.fetch(request, { headers: { 'Upgrade': 'websocket' } });
      
      return new Response(null, { status: 101, webSocket: client });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
```

### 3.2 Durable Object設計

#### 3.2.1 GameStateDurableObject
```typescript
export class GameStateDurableObject {
  private state: DurableObjectState;
  private gameState: GameState;
  private updateTimer: number | null;
  private connections: Set<WebSocket>;
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.connections = new Set();
  }
  
  async fetch(request: Request): Promise<Response> {
    // WebSocket接続処理
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    await this.handleWebSocket(server);
    
    return new Response(null, { status: 101, webSocket: client });
  }
  
  private async handleWebSocket(ws: WebSocket): Promise<void> {
    this.connections.add(ws);
    
    // 初回接続時にゲーム状態を送信
    ws.send(JSON.stringify({
      type: 'gameStateUpdate',
      payload: this.gameState
    }));
    
    // メッセージハンドラー
    ws.addEventListener('message', async (event) => {
      await this.handleCommand(JSON.parse(event.data), ws);
    });
    
    // 切断処理
    ws.addEventListener('close', () => {
      this.connections.delete(ws);
      if (this.connections.size === 0) {
        this.stopGameLoop();
      }
    });
    
    // ゲームループ開始
    if (this.connections.size === 1) {
      this.startGameLoop();
    }
  }
}
```

#### 3.2.2 ゲームループ実装
```typescript
private startGameLoop(): void {
  // 60Hz更新ループ
  this.updateTimer = setInterval(() => {
    this.updateGame(1 / 60);
  }, 16.67);
}

private updateGame(deltaTime: number): void {
  // 船の移動更新
  for (const ship of this.gameState.ships) {
    if (ship.destination) {
      this.updateShipPosition(ship, deltaTime);
    }
  }
  
  // 取引判定
  for (const ship of this.gameState.ships) {
    if (this.isInTradingRange(ship)) {
      this.processTrade(ship);
    }
  }
  
  // 生産・消費サイクル（60秒ごと）
  if (this.shouldUpdateProduction()) {
    this.updateProduction();
  }
  
  // クライアントへの状態送信（30Hz）
  if (this.shouldBroadcast()) {
    this.broadcastGameState();
  }
}
```

### 3.3 ゲームロジック実装詳細

#### 3.3.1 交易AI詳細実装
```typescript
class TradingAI {
  findBestRoute(ship: Ship, gameState: GameState): TradeRoute | null {
    const routes: PotentialRoute[] = [];
    
    // 全ステーションの全商品をスキャン
    for (const sector of gameState.sectors) {
      for (const station of sector.stations) {
        for (const item of station.inventory) {
          if (this.canAfford(item, gameState.credits)) {
            const sellTarget = this.findBestSellTarget(item, gameState);
            if (sellTarget) {
              routes.push(this.calculateRoute(ship, station, sellTarget, item));
            }
          }
        }
      }
    }
    
    // 時間対効果で並び替え
    routes.sort((a, b) => b.profitPerSecond - a.profitPerSecond);
    
    return routes[0] || null;
  }
  
  private calculateRoute(
    ship: Ship,
    buyStation: Station,
    sellStation: Station,
    commodity: InventoryItem
  ): PotentialRoute {
    const buyDistance = this.calculateDistance(ship.location, buyStation.location);
    const sellDistance = this.calculateDistance(buyStation.location, sellStation.location);
    const totalDistance = buyDistance + sellDistance;
    const travelTime = totalDistance / ship.speed;
    const tradeTime = 2; // 取引時間（秒）
    
    const quantity = Math.min(commodity.quantity, ship.capacity);
    const profit = (sellStation.getPrice(commodity.id) - commodity.price) * quantity;
    
    return {
      buyStation,
      sellStation,
      commodity: commodity.id,
      quantity,
      profit,
      totalTime: travelTime + tradeTime,
      profitPerSecond: profit / (travelTime + tradeTime)
    };
  }
}
```

#### 3.3.2 価格計算エンジン
```typescript
class PriceEngine {
  calculatePrice(
    commodity: string,
    currentStock: number,
    maxStock: number,
    basePrice: number
  ): number {
    const stockRate = currentStock / maxStock;
    const maxPrice = basePrice * 1.5;
    const minPrice = basePrice * 0.5;
    
    return maxPrice - ((maxPrice - minPrice) * stockRate);
  }
  
  // 価格履歴管理（将来の拡張用）
  private priceHistory: Map<string, PricePoint[]> = new Map();
  
  recordPrice(stationId: string, commodity: string, price: number): void {
    const key = `${stationId}:${commodity}`;
    if (!this.priceHistory.has(key)) {
      this.priceHistory.set(key, []);
    }
    this.priceHistory.get(key)!.push({
      timestamp: Date.now(),
      price
    });
  }
}
```

## 4. データモデル詳細設計

### 4.1 完全なデータスキーマ

#### 4.1.1 コア・エンティティ
```typescript
// 商品定義
enum CommodityType {
  // 原料
  ORE = 'ore',
  SILICON = 'silicon',
  ICE = 'ice',
  
  // 中間財
  MICROCHIPS = 'microchips',
  QUANTUM_TUBES = 'quantum_tubes',
  
  // 完成品
  HULL_PARTS = 'hull_parts',
  FOOD = 'food'
}

// 商品の基準価格定義
const COMMODITY_BASE_PRICES: Record<CommodityType, number> = {
  [CommodityType.ORE]: 10,
  [CommodityType.SILICON]: 15,
  [CommodityType.ICE]: 5,
  [CommodityType.MICROCHIPS]: 50,
  [CommodityType.QUANTUM_TUBES]: 80,
  [CommodityType.HULL_PARTS]: 200,
  [CommodityType.FOOD]: 30
};

// 生産レシピ定義
interface ProductionRecipe {
  inputs: Array<{ commodity: CommodityType; amount: number }>;
  output: { commodity: CommodityType; amount: number };
  cycleTime: number; // 秒
}

const PRODUCTION_RECIPES: Record<string, ProductionRecipe> = {
  microchipFactory: {
    inputs: [{ commodity: CommodityType.SILICON, amount: 2 }],
    output: { commodity: CommodityType.MICROCHIPS, amount: 1 },
    cycleTime: 60
  },
  quantumFactory: {
    inputs: [
      { commodity: CommodityType.ORE, amount: 1 },
      { commodity: CommodityType.MICROCHIPS, amount: 1 }
    ],
    output: { commodity: CommodityType.QUANTUM_TUBES, amount: 1 },
    cycleTime: 60
  },
  shipyard: {
    inputs: [
      { commodity: CommodityType.ORE, amount: 3 },
      { commodity: CommodityType.QUANTUM_TUBES, amount: 1 }
    ],
    output: { commodity: CommodityType.HULL_PARTS, amount: 1 },
    cycleTime: 60
  },
  hydroponicsFarm: {
    inputs: [{ commodity: CommodityType.ICE, amount: 2 }],
    output: { commodity: CommodityType.FOOD, amount: 3 },
    cycleTime: 60
  }
};
```

#### 4.1.2 拡張されたエンティティ定義
```typescript
// 船の詳細定義
interface ShipType {
  id: string;
  name: string;
  price: number;
  speed: number;
  capacity: number;
  maintenanceCost: number; // 将来の拡張用
}

const SHIP_TYPES: Record<string, ShipType> = {
  mercury: {
    id: 'mercury',
    name: 'Mercury',
    price: 50000,
    speed: 600,
    capacity: 1000,
    maintenanceCost: 0
  }
  // 将来的に追加される船種
};

// ステーションの詳細定義
interface StationBlueprint {
  type: 'Mine' | 'Factory' | 'Trading Hub';
  name: string;
  productionRecipe?: string;
  storageCapacity: Record<CommodityType, number>;
}

// セクター生成パラメータ
interface SectorGenerationParams {
  stationCount: {
    min: number;
    max: number;
  };
  stationTypeWeights: {
    mine: number;
    factory: number;
    tradingHub: number;
  };
  gateCount: {
    min: number;
    max: number;
  };
}
```

### 4.2 状態永続化設計

#### 4.2.1 Durable Objectストレージ戦略
```typescript
class GameStatePersistence {
  private state: DurableObjectState;
  
  // 定期的な自動保存
  async autoSave(gameState: GameState): Promise<void> {
    await this.state.storage.put('gameState', gameState);
    await this.state.storage.put('lastSaved', Date.now());
  }
  
  // トランザクションログ
  async logTransaction(transaction: Transaction): Promise<void> {
    const logs = await this.state.storage.get<Transaction[]>('transactionLog') || [];
    logs.push(transaction);
    
    // 最新1000件のみ保持
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
    
    await this.state.storage.put('transactionLog', logs);
  }
  
  // ゲーム状態の復元
  async loadGameState(): Promise<GameState | null> {
    return await this.state.storage.get<GameState>('gameState');
  }
}
```

## 5. 通信プロトコル詳細設計

### 5.1 メッセージフォーマット

#### 5.1.1 クライアント→サーバー
```typescript
// 基本コマンド構造
interface Command {
  id: string; // UUID
  type: CommandType;
  payload: any;
  timestamp: number;
}

enum CommandType {
  BUY_SHIP = 'buyShip',
  SELL_SHIP = 'sellShip',
  TOGGLE_SHIP_AI = 'toggleShipAI',
  AUTHENTICATE = 'authenticate'
}

// 具体的なコマンド定義
interface BuyShipCommand extends Command {
  type: CommandType.BUY_SHIP;
  payload: {
    shipType: string;
    name?: string;
  };
}

interface SellShipCommand extends Command {
  type: CommandType.SELL_SHIP;
  payload: {
    shipId: string;
  };
}

interface ToggleShipAICommand extends Command {
  type: CommandType.TOGGLE_SHIP_AI;
  payload: {
    shipId: string;
    enabled: boolean;
  };
}
```

#### 5.1.2 サーバー→クライアント
```typescript
// 基本メッセージ構造
interface ServerMessage {
  id: string;
  type: MessageType;
  payload: any;
  timestamp: number;
}

enum MessageType {
  GAME_STATE_UPDATE = 'gameStateUpdate',
  COMMAND_RESULT = 'commandResult',
  NOTIFICATION = 'notification',
  ERROR = 'error'
}

// ゲーム状態更新メッセージ
interface GameStateUpdateMessage extends ServerMessage {
  type: MessageType.GAME_STATE_UPDATE;
  payload: GameState;
}

// コマンド実行結果
interface CommandResultMessage extends ServerMessage {
  type: MessageType.COMMAND_RESULT;
  payload: {
    commandId: string;
    success: boolean;
    result?: any;
    error?: string;
  };
}

// 通知メッセージ
interface NotificationMessage extends ServerMessage {
  type: MessageType.NOTIFICATION;
  payload: {
    message: string;
    type: 'info' | 'warning' | 'success';
    data?: any;
  };
}
```

### 5.2 通信最適化

#### 5.2.1 差分更新システム
```typescript
// 状態差分計算
class StateDiffCalculator {
  calculateDiff(oldState: GameState, newState: GameState): GameStateDiff {
    const diff: GameStateDiff = {
      credits: oldState.credits !== newState.credits ? newState.credits : undefined,
      ships: this.calculateShipsDiff(oldState.ships, newState.ships),
      sectors: this.calculateSectorsDiff(oldState.sectors, newState.sectors),
      timestamp: newState.lastUpdated
    };
    
    return diff;
  }
  
  private calculateShipsDiff(oldShips: Ship[], newShips: Ship[]): ShipDiff[] {
    // 変更があった船のみを含む差分配列を生成
    const diffs: ShipDiff[] = [];
    
    // 追加・更新された船
    for (const newShip of newShips) {
      const oldShip = oldShips.find(s => s.id === newShip.id);
      if (!oldShip || !this.shipsEqual(oldShip, newShip)) {
        diffs.push({
          action: oldShip ? 'update' : 'add',
          ship: newShip
        });
      }
    }
    
    // 削除された船
    for (const oldShip of oldShips) {
      if (!newShips.find(s => s.id === oldShip.id)) {
        diffs.push({
          action: 'remove',
          shipId: oldShip.id
        });
      }
    }
    
    return diffs;
  }
}
```

#### 5.2.2 メッセージ圧縮
```typescript
class MessageCompressor {
  // 数値の精度削減
  compressNumbers(obj: any): any {
    if (typeof obj === 'number') {
      return Math.round(obj * 100) / 100; // 小数点以下2桁
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.compressNumbers(item));
    }
    if (typeof obj === 'object' && obj !== null) {
      const compressed: any = {};
      for (const key in obj) {
        compressed[key] = this.compressNumbers(obj[key]);
      }
      return compressed;
    }
    return obj;
  }
  
  // プロパティ名の短縮（帯域幅節約）
  private propertyMap = {
    'location': 'l',
    'destination': 'd',
    'capacity': 'c',
    'quantity': 'q',
    'commodity': 'cm',
    'timestamp': 't'
  };
  
  compress(message: any): any {
    // 実装省略：プロパティ名を短縮し、数値を圧縮
  }
  
  decompress(compressed: any): any {
    // 実装省略：圧縮されたメッセージを復元
  }
}
```

## 6. ゲームロジック詳細設計

### 6.1 移動システム

#### 6.1.1 パスファインディング
```typescript
class PathfindingSystem {
  // セクター内移動
  findPathInSector(
    start: Vector2,
    end: Vector2,
    sectorId: number
  ): Vector2[] {
    // 直線移動（障害物なし）
    return [start, end];
  }
  
  // セクター間移動
  findPathBetweenSectors(
    startSector: number,
    endSector: number,
    sectors: Sector[]
  ): number[] {
    // ダイクストラ法でゲート経由の最短経路を計算
    const graph = this.buildSectorGraph(sectors);
    return this.dijkstra(graph, startSector, endSector);
  }
  
  private buildSectorGraph(sectors: Sector[]): Graph {
    const graph = new Graph();
    
    for (const sector of sectors) {
      for (const gate of sector.gates) {
        if (gate.targetSectorId !== null) {
          graph.addEdge(sector.id, gate.targetSectorId, 1);
        }
      }
    }
    
    return graph;
  }
}
```

#### 6.1.2 移動物理演算
```typescript
class MovementPhysics {
  updateShipPosition(ship: Ship, deltaTime: number): void {
    if (!ship.destination) return;
    
    const target = this.getTargetPosition(ship.destination);
    const distance = this.calculateDistance(ship.location, target);
    
    if (distance <= ARRIVAL_THRESHOLD) {
      // 到着処理
      ship.location = target;
      ship.status = 'Idle';
      return;
    }
    
    // 移動ベクトル計算
    const direction = this.normalize({
      x: target.x - ship.location.x,
      y: target.y - ship.location.y
    });
    
    const moveDistance = Math.min(ship.speed * deltaTime, distance);
    
    ship.location.x += direction.x * moveDistance;
    ship.location.y += direction.y * moveDistance;
  }
  
  // ゲート通過処理
  handleGateTransition(ship: Ship, gate: Gate): void {
    if (gate.targetSectorId === null) return;
    
    // セクター移動
    ship.location.sectorId = gate.targetSectorId;
    
    // 対応するゲート出口の座標に配置
    const targetSector = this.getSector(gate.targetSectorId);
    const exitGate = targetSector.gates.find(g => 
      g.targetSectorId === ship.location.sectorId
    );
    
    if (exitGate) {
      ship.location.x = exitGate.location.x;
      ship.location.y = exitGate.location.y;
    }
  }
}
```

### 6.2 取引システム

#### 6.2.1 取引処理フロー
```typescript
class TradingSystem {
  async processTrade(ship: Ship, station: Station): Promise<TradeResult> {
    // 取引範囲チェック
    if (!this.isInTradingRange(ship, station)) {
      return { success: false, reason: 'OutOfRange' };
    }
    
    // 船のステータスによる処理分岐
    switch (ship.status) {
      case 'MovingToBuy':
        return await this.processBuy(ship, station);
        
      case 'MovingToSell':
        return await this.processSell(ship, station);
        
      default:
        return { success: false, reason: 'InvalidStatus' };
    }
  }
  
  private async processBuy(
    ship: Ship,
    station: Station
  ): Promise<TradeResult> {
    const targetCommodity = ship.plannedCargo?.commodity;
    if (!targetCommodity) {
      return { success: false, reason: 'NoCommodityPlanned' };
    }
    
    const inventory = station.inventory.find(i => i.commodityId === targetCommodity);
    if (!inventory || inventory.quantity === 0) {
      return { success: false, reason: 'OutOfStock' };
    }
    
    const quantity = Math.min(
      inventory.quantity,
      ship.capacity,
      Math.floor(this.gameState.credits / inventory.price)
    );
    
    if (quantity === 0) {
      return { success: false, reason: 'InsufficientFunds' };
    }
    
    // トランザクション実行
    await this.executeTransaction({
      type: 'buy',
      shipId: ship.id,
      stationId: station.id,
      commodity: targetCommodity,
      quantity,
      price: inventory.price,
      totalCost: inventory.price * quantity
    });
    
    // 状態更新
    ship.cargo = { commodityId: targetCommodity, quantity };
    ship.status = 'MovingToSell';
    inventory.quantity -= quantity;
    this.gameState.credits -= inventory.price * quantity;
    
    // 価格再計算
    this.updateStationPrices(station);
    
    return { success: true, quantity, totalCost: inventory.price * quantity };
  }
}
```

#### 6.2.2 競合処理
```typescript
class CompetitionHandler {
  private tradingQueue: Map<string, TradingRequest[]> = new Map();
  
  // 取引リクエストをキューに追加
  queueTradingRequest(request: TradingRequest): void {
    const key = `${request.stationId}:${request.commodity}`;
    
    if (!this.tradingQueue.has(key)) {
      this.tradingQueue.set(key, []);
    }
    
    this.tradingQueue.get(key)!.push(request);
  }
  
  // キューを処理（早い者勝ち）
  processQueue(stationId: string, commodity: string): void {
    const key = `${stationId}:${commodity}`;
    const queue = this.tradingQueue.get(key);
    
    if (!queue || queue.length === 0) return;
    
    // 到着時刻順にソート
    queue.sort((a, b) => a.arrivalTime - b.arrivalTime);
    
    const station = this.getStation(stationId);
    const inventory = station.inventory.find(i => i.commodityId === commodity);
    
    let remainingStock = inventory?.quantity || 0;
    
    for (const request of queue) {
      if (remainingStock <= 0) {
        // 在庫切れ - 失敗通知
        this.notifyTradeFailed(request.shipId, 'OutOfStock');
        continue;
      }
      
      const tradeQuantity = Math.min(request.quantity, remainingStock);
      this.executeTrade(request, tradeQuantity);
      remainingStock -= tradeQuantity;
    }
    
    // キューをクリア
    this.tradingQueue.delete(key);
  }
}
```

### 6.3 生産システム

#### 6.3.1 生産サイクル管理
```typescript
class ProductionSystem {
  private lastProductionCycle: number = 0;
  private readonly PRODUCTION_INTERVAL = 60000; // 60秒
  
  updateProduction(currentTime: number): void {
    if (currentTime - this.lastProductionCycle < this.PRODUCTION_INTERVAL) {
      return;
    }
    
    this.lastProductionCycle = currentTime;
    
    for (const sector of this.gameState.sectors) {
      for (const station of sector.stations) {
        this.processStationProduction(station);
      }
    }
  }
  
  private processStationProduction(station: Station): void {
    switch (station.type) {
      case 'Mine':
        this.processMineProduction(station);
        break;
        
      case 'Factory':
        this.processFactoryProduction(station);
        break;
        
      case 'Trading Hub':
        this.processTradingHubConsumption(station);
        break;
    }
  }
  
  private processFactoryProduction(station: Station): void {
    if (!station.production) return;
    
    const recipe = PRODUCTION_RECIPES[station.production.recipeId];
    if (!recipe) return;
    
    // 入力資源チェック
    let canProduce = true;
    for (const input of recipe.inputs) {
      const inventory = station.inventory.find(i => 
        i.commodityId === input.commodity
      );
      
      if (!inventory || inventory.quantity < input.amount) {
        canProduce = false;
        break;
      }
    }
    
    if (!canProduce) return;
    
    // 資源消費
    for (const input of recipe.inputs) {
      const inventory = station.inventory.find(i => 
        i.commodityId === input.commodity
      );
      inventory!.quantity -= input.amount;
    }
    
    // 生産物追加
    const outputInventory = station.inventory.find(i => 
      i.commodityId === recipe.output.commodity
    );
    
    if (outputInventory) {
      outputInventory.quantity = Math.min(
        outputInventory.quantity + recipe.output.amount,
        station.storageCapacity[recipe.output.commodity]
      );
    }
    
    // 価格更新
    this.updateStationPrices(station);
  }
}
```

### 6.4 セクター生成システム

#### 6.4.1 プロシージャル生成
```typescript
class SectorGenerator {
  generateSector(
    sectorId: number,
    params: SectorGenerationParams
  ): Sector {
    const random = new SeededRandom(sectorId);
    
    // ステーション数決定
    const stationCount = random.randInt(
      params.stationCount.min,
      params.stationCount.max
    );
    
    // ゲート数決定
    const gateCount = random.randInt(
      params.gateCount.min,
      Math.min(params.gateCount.max, 4) // 最大4
    );
    
    const sector: Sector = {
      id: sectorId,
      name: this.generateSectorName(sectorId),
      gates: this.generateGates(gateCount, random),
      stations: []
    };
    
    // ステーション生成
    const positions = this.generateStationPositions(stationCount, random);
    
    for (let i = 0; i < stationCount; i++) {
      const type = this.selectStationType(params.stationTypeWeights, random);
      const station = this.generateStation(type, positions[i], sectorId, i, random);
      sector.stations.push(station);
    }
    
    return sector;
  }
  
  private generateStationPositions(
    count: number,
    random: SeededRandom
  ): Vector2[] {
    const positions: Vector2[] = [];
    const minDistance = 300; // 最小間隔
    
    for (let i = 0; i < count; i++) {
      let position: Vector2;
      let attempts = 0;
      
      do {
        position = {
          x: random.randFloat(200, 1800),
          y: random.randFloat(200, 1800)
        };
        attempts++;
      } while (
        attempts < 100 &&
        positions.some(p => this.distance(p, position) < minDistance)
      );
      
      positions.push(position);
    }
    
    return positions;
  }
  
  private generateStation(
    type: 'Mine' | 'Factory' | 'Trading Hub',
    position: Vector2,
    sectorId: number,
    index: number,
    random: SeededRandom
  ): Station {
    const station: Station = {
      id: `sector${sectorId}_station${index}`,
      type,
      name: this.generateStationName(type, sectorId, index),
      location: { ...position, sectorId },
      inventory: []
    };
    
    // タイプ別の初期化
    switch (type) {
      case 'Mine':
        station.production = this.selectMineProduction(random);
        break;
        
      case 'Factory':
        station.production = this.selectFactoryProduction(random);
        break;
    }
    
    // 初期在庫設定
    station.inventory = this.generateInitialInventory(type, random);
    
    return station;
  }
}
```

## 7. 実装ガイドライン

### 7.1 コーディング規約

#### 7.1.1 TypeScript規約
```typescript
// 命名規則
// - クラス名: PascalCase
// - インターフェース名: PascalCase（Iプレフィックスなし）
// - 変数・関数名: camelCase
// - 定数: UPPER_SNAKE_CASE
// - private変数: _プレフィックスなし

// 型定義
// - anyの使用禁止（unknown使用）
// - 暗黙的anyの禁止（strict: true）
// - nullableはundefined優先

// インポート順序
// 1. 外部ライブラリ
// 2. 内部モジュール（絶対パス）
// 3. 相対パス
```

#### 7.1.2 エラーハンドリング
```typescript
// カスタムエラークラス
class GameError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'GameError';
  }
}

// エラーハンドリングパターン
async function safeExecute<T>(
  operation: () => Promise<T>,
  errorHandler: (error: Error) => void
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    errorHandler(error as Error);
    return null;
  }
}
```

### 7.2 パフォーマンス最適化

#### 7.2.1 メモリ管理
```typescript
class MemoryOptimizer {
  // オブジェクトプール
  private shipPool: ObjectPool<Ship>;
  
  // 不要なプロパティの削除
  cleanupGameState(state: GameState): void {
    // 古いトランザクションログの削除
    if (state.transactionLog.length > 1000) {
      state.transactionLog = state.transactionLog.slice(-1000);
    }
    
    // 非アクティブな船の詳細情報削減
    for (const ship of state.ships) {
      if (ship.status === 'Idle' && !ship.isAIEnabled) {
        delete ship.plannedRoute;
      }
    }
  }
}
```

#### 7.2.2 計算最適化
```typescript
class CalculationCache {
  private distanceCache = new Map<string, number>();
  
  getCachedDistance(from: Vector2, to: Vector2): number {
    const key = `${from.x},${from.y}-${to.x},${to.y}`;
    
    if (this.distanceCache.has(key)) {
      return this.distanceCache.get(key)!;
    }
    
    const distance = Math.sqrt(
      Math.pow(to.x - from.x, 2) + 
      Math.pow(to.y - from.y, 2)
    );
    
    this.distanceCache.set(key, distance);
    
    // キャッシュサイズ制限
    if (this.distanceCache.size > 10000) {
      const firstKey = this.distanceCache.keys().next().value;
      this.distanceCache.delete(firstKey);
    }
    
    return distance;
  }
}
```

### 7.3 セキュリティ考慮事項

#### 7.3.1 入力検証
```typescript
class InputValidator {
  validateCommand(command: Command): ValidationResult {
    // コマンドタイプ検証
    if (!Object.values(CommandType).includes(command.type)) {
      return { valid: false, error: 'Invalid command type' };
    }
    
    // ペイロード検証
    switch (command.type) {
      case CommandType.BUY_SHIP:
        return this.validateBuyShip(command.payload);
        
      case CommandType.SELL_SHIP:
        return this.validateSellShip(command.payload);
    }
    
    return { valid: true };
  }
  
  private validateBuyShip(payload: any): ValidationResult {
    if (!payload.shipType || typeof payload.shipType !== 'string') {
      return { valid: false, error: 'Invalid ship type' };
    }
    
    if (!SHIP_TYPES[payload.shipType]) {
      return { valid: false, error: 'Unknown ship type' };
    }
    
    return { valid: true };
  }
}
```

#### 7.3.2 レート制限
```typescript
class RateLimiter {
  private commandHistory = new Map<string, number[]>();
  private readonly MAX_COMMANDS_PER_MINUTE = 60;
  
  checkLimit(userId: string): boolean {
    const now = Date.now();
    const history = this.commandHistory.get(userId) || [];
    
    // 1分以上前のエントリを削除
    const recentHistory = history.filter(time => now - time < 60000);
    
    if (recentHistory.length >= this.MAX_COMMANDS_PER_MINUTE) {
      return false;
    }
    
    recentHistory.push(now);
    this.commandHistory.set(userId, recentHistory);
    
    return true;
  }
}
```

### 7.4 テスト戦略

#### 7.4.1 ユニットテスト例
```typescript
// 交易AIのテスト
describe('TradingAI', () => {
  it('should find most profitable route', () => {
    const ai = new TradingAI();
    const gameState = createMockGameState();
    const ship = createMockShip();
    
    const route = ai.findBestRoute(ship, gameState);
    
    expect(route).toBeDefined();
    expect(route!.profitPerSecond).toBeGreaterThan(0);
  });
  
  it('should handle no available routes', () => {
    const ai = new TradingAI();
    const gameState = createEmptyGameState();
    const ship = createMockShip();
    
    const route = ai.findBestRoute(ship, gameState);
    
    expect(route).toBeNull();
  });
});
```

#### 7.4.2 統合テスト例
```typescript
// WebSocket通信のテスト
describe('WebSocket Integration', () => {
  let server: TestServer;
  let client: TestClient;
  
  beforeEach(async () => {
    server = await createTestServer();
    client = await createTestClient(server.url);
  });
  
  it('should receive game state on connection', async () => {
    const gameState = await client.waitForMessage('gameStateUpdate');
    
    expect(gameState).toHaveProperty('credits');
    expect(gameState).toHaveProperty('ships');
    expect(gameState).toHaveProperty('sectors');
  });
  
  it('should process buy ship command', async () => {
    await client.sendCommand({
      type: CommandType.BUY_SHIP,
      payload: { shipType: 'mercury' }
    });
    
    const result = await client.waitForMessage('commandResult');
    
    expect(result.success).toBe(true);
  });
});
```

## 8. デプロイメント設計

### 8.1 環境構成
```yaml
# wrangler.toml
name = "uncharted-territory"
type = "javascript"
compatibility_date = "2024-01-01"

[env.production]
workers_dev = false
routes = ["unchartedterritory.com/*"]

[env.staging]
workers_dev = true
name = "uncharted-territory-staging"

[[durable_objects.bindings]]
name = "GAME_STATE"
class_name = "GameStateDurableObject"

[[kv_namespaces]]
binding = "CACHE"
id = "xxx"
```

### 8.2 モニタリング設計
```typescript
class GameMetrics {
  // パフォーマンスメトリクス
  recordUpdateTime(duration: number): void {
    // Cloudflare Analyticsに送信
  }
  
  // ビジネスメトリクス
  recordTransaction(transaction: Transaction): void {
    // 取引量、収益などを記録
  }
  
  // エラー追跡
  recordError(error: Error, context: any): void {
    // Sentryなどのエラー追跡サービスに送信
  }
}
```

## 9. まとめ

本詳細設計書は、「Uncharted Territory」の実装に必要な技術仕様を網羅的に定義しました。開発チームは本書を基に、以下の優先順位で実装を進めることを推奨します：

1. **フェーズ1（MVP）**：基本的な交易システムと単一セクター
2. **フェーズ2**：複数セクターとセクター間移動
3. **フェーズ3**：プロシージャル生成と自動セクター発見
4. **フェーズ4**：最適化とスケーラビリティ改善

各フェーズの完了時には、パフォーマンステストとユーザビリティテストを実施し、次フェーズの実装にフィードバックを反映させることが重要です。