# データモデル設計書

## 1. 設計思想

### 1.1 目的
- ゲーム世界のすべての状態を型安全に表現
- 各システム間でのデータ共有インターフェース
- 将来のデータベース設計の基盤

### 1.2 設計原則
- **型安全性**: TypeScriptの型システムを最大活用
- **不変性**: データの変更を追跡可能に
- **正規化**: データ重複を最小化

## 2. コアデータ構造

### 2.1 空間関連
```typescript
// 2D座標系（セクター内位置）
interface Vector2 {
  x: number;  // -10000 ～ +10000 (20km四方)
  y: number;
}

// セクター（宇宙の区域）
interface Sector {
  id: string;           // "sector_0"
  name: string;         // "Argon Prime"
  discovered: boolean;  // プレイヤーが発見済みか
  stations: Station[];  // セクター内ステーション
  gates: Gate[];        // 他セクターへの接続
  asteroids: Vector2[]; // 将来の採掘ポイント
}

// ゲート（セクター間接続）
interface Gate {
  id: string;      // "gate_0_to_1"
  position: Vector2;
  connectsTo: string; // 接続先セクターID
}
```

### 2.2 経済システム
```typescript
// 商品定義
interface Ware {
  id: string;         // "ore", "microchips"
  name: string;       // "Ore", "Microchips"
  category: 'raw' | 'intermediate' | 'finished';
  cargoClass: 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'ST';
  cargoSize: number;  // S=1, M=5, L=10...
  basePrice: number;  // 基準価格
}

// 在庫情報（ステーション毎）
interface WareStock {
  wareId: string;
  quantity: number;    // 現在在庫
  maxQuantity: number; // 最大在庫
  buyPrice: number;    // 買取価格（0=買取なし）
  sellPrice: number;   // 販売価格（0=販売なし）
}
```

### 2.3 施設システム
```typescript
interface Station {
  id: string;
  name: string;
  type: 'trading_port' | 'shipyard' | 'hightech_factory' | 
        'basic_factory' | 'refinery' | 'mine';
  position: Vector2;
  sectorId: string;
  wares: WareStock[];
  produces?: string[];  // 生産する商品ID
  consumes?: string[];  // 消費する商品ID
}
```

### 2.4 船舶システム
```typescript
interface Ship {
  id: string;           // "scout_01"
  name: string;         // "Discovery"
  type: 'scout' | 'trader';
  position: Vector2;
  sectorId: string;
  maxSpeed: number;     // m/s
  cargoClass: 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'ST';
  cargoCapacity: number;
  cargo: { wareId: string; quantity: number }[];
  currentCommand?: ShipCommand;
  isMoving: boolean;
  destination?: Vector2;
}

interface ShipCommand {
  type: 'move' | 'explore' | 'trade';
  target?: string;     // ステーションID or セクターID
  parameters?: any;    // コマンド固有パラメータ
}
```

### 2.5 ゲーム状態
```typescript
interface GameState {
  id: string;
  player: Player;
  sectors: Sector[];
  wares: Ware[];
  gameTime: number;    // ゲーム内時間（秒）
  lastUpdate: number;  // 最終更新タイムスタンプ
}

interface Player {
  name: string;
  credits: number;
  ships: Ship[];
  discoveredSectors: string[];
}
```

## 3. データ関係図

```
GameState
├── Player
│   ├── ships[] ──→ Ship
│   └── discoveredSectors[] ──→ Sector.id
├── sectors[] ──→ Sector
│   ├── stations[] ──→ Station
│   │   └── wares[] ──→ WareStock ──→ Ware.id
│   └── gates[] ──→ Gate ──→ Sector.id
└── wares[] ──→ Ware
```

## 4. データ整合性ルール

### 4.1 参照整合性
- `Ship.sectorId` は存在する `Sector.id` を参照
- `WareStock.wareId` は存在する `Ware.id` を参照
- `Gate.connectsTo` は存在する `Sector.id` を参照

### 4.2 ビジネスルール
- `Ship.cargo` の総サイズ ≤ `Ship.cargoCapacity`
- `WareStock.quantity` ≤ `WareStock.maxQuantity`
- `Player.credits` ≥ 0

### 4.3 状態遷移ルール
- `Ship.isMoving = true` の時、`destination` は必須
- `Station.type = 'mine'` の時、`produces` は必須
- 価格は在庫量に基づいて自動計算

## 5. 最適化考慮点

### 5.1 メモリ効率
- 大きな配列（`sectors`, `ships`）のインデックス化検討
- 不要なデータの定期的なクリーンアップ

### 5.2 計算効率
- 頻繁なアクセスデータのキャッシュ化
- 距離計算の最適化（空間インデックス）

## 6. 将来拡張

### 6.1 永続化対応
- 各interfaceをテーブル設計に対応
- 関係の正規化・非正規化判断

### 6.2 リアルタイム対応
- 差分更新のためのイベントソーシング
- 楽観的ロック機構

### 6.3 マルチプレイヤー対応
- `Player` の複数化
- 所有権・権限管理の追加