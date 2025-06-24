# 世界生成システム設計書

## 1. 概要

### 1.1 目的
- プロシージャルに宇宙世界を生成
- 経済的に意味のあるステーション配置
- 探索の面白さを生み出すセクター構成

### 1.2 責務
- セクター配置とゲート接続
- ステーション生成と商品設定
- 初期プレイヤー状態の設定

## 2. 生成アルゴリズム

### 2.1 宇宙構造生成
```typescript
// フェーズ1: セクター作成
for (8セクター) {
  sector = createSector(id, name)
  ├── 3-8個のステーション生成
  ├── ランダムタイプ選択
  ├── 1/3確率で造船所追加
  └── 小惑星配置
}

// フェーズ2: ゲート接続
for (隣接セクター) {
  双方向ゲート作成
}
追加接続（0→3）作成
```

### 2.2 ステーション生成
```typescript
function createStation(type) {
  switch(type) {
    case 'trading_port':
      // 全商品を扱う商業ハブ
      wares = ALL_WARES with balanced_stock
      
    case 'mine':
      // 原料生産
      produces = ['ore', 'silicon']
      stock = high_quantity, low_price
      
    case 'refinery':
      // 原料→中間財
      consumes = ['ore', 'silicon']
      produces = ['microchips']
      
    case 'basic_factory':
      // 基礎製品生産
      consumes = ['ore', 'ice']
      produces = ['hull_parts', 'food']
      
    case 'hightech_factory':
      // 高技術製品
      consumes = ['microchips', 'silicon']
      produces = ['quantum_tubes']
      
    case 'shipyard':
      // 船舶販売（将来実装）
      consumes = ['hull_parts', 'quantum_tubes']
  }
}
```

## 3. 商品システム

### 3.1 商品カテゴリ
```typescript
// 原料 (Raw Materials)
ore:      基礎鉱物、価格安定
silicon:  電子部品材料
ice:      生命維持・燃料

// 中間財 (Intermediate)
microchips:    高価値、小容量
quantum_tubes: 超高価値

// 完成品 (Finished)
hull_parts: 船舶建造用
food:       生命維持
```

### 3.2 価格設定ロジック
```typescript
// 基準価格からの変動幅
price_range = base_price * 0.3  // ±30%
min_price = base_price - price_range
max_price = base_price + price_range

// 在庫比率による価格計算
stock_ratio = current_stock / max_stock
current_price = max_price - (price_range * stock_ratio)

// 売買価格の決定
if (station.produces(ware)) {
  sell_price = current_price
  buy_price = 0
} else if (station.consumes(ware)) {
  buy_price = current_price
  sell_price = 0
} else { // trading_port
  buy_price = current_price * 0.95
  sell_price = current_price * 1.05
}
```

## 4. セクター接続設計

### 4.1 基本構造
```
Sector 0 ←→ Sector 1 ←→ Sector 2
   ↑                        ↓
   └────────→ Sector 3 ←────┘
```

### 4.2 探索設計
- 開始: Sector 0 のみ発見済み
- 探索: ゲートを通じて新セクター発見
- 深度: 最大3ホップで全セクター到達可能

## 5. 初期状態設定

### 5.1 プレイヤー初期化
```typescript
player = {
  name: 'Commander',
  credits: 100000,  // 十分な初期資金
  ships: [scout_ship],
  discoveredSectors: [sector_0]
}

scout_ship = {
  type: 'scout',
  name: 'Discovery',
  speed: 500,        // 高速移動
  cargo: 10,         // 少量積載
  position: (0,0)    // セクター中央
}
```

## 6. バランス調整

### 6.1 経済バランス
- **初期資金**: 貿易船1隻購入可能
- **利益率**: 往復で10-30%利益確保
- **在庫量**: 継続的な取引が可能

### 6.2 探索バランス
- **ゲート配置**: セクター端部（移動時間確保）
- **発見報酬**: 新しい交易機会の提供
- **距離設計**: 移動に意味のある時間を確保

## 7. 拡張性

### 7.1 短期拡張
- **セクター数増加**: 線形に拡張可能
- **ステーション種類追加**: 生産チェーン拡張
- **商品追加**: カテゴリ別に追加

### 7.2 長期拡張
- **動的生成**: セーブデータ互換性保持
- **派閥システム**: セクター所有権
- **イベントシステム**: 動的な世界変化

## 8. 設定可能パラメータ

```typescript
// world-generator.ts 内の調整可能値
SECTOR_COUNT = 8
SECTOR_SIZE = 20000  // 20km四方
CENTER_AREA = 10000  // 中心エリア

STATION_COUNT_MIN = 3
STATION_COUNT_MAX = 8
SHIPYARD_PROBABILITY = 0.33

ASTEROID_COUNT_MIN = 2
ASTEROID_COUNT_MAX = 7

// 価格変動率
PRICE_MULTIPLIER = 0.3
```

## 9. テスト可能性

### 9.1 単体テスト
- セクター生成の検証
- ステーション配置の検証
- 価格計算の検証

### 9.2 統合テスト
- 全セクター接続性の検証
- 経済循環の検証
- プレイヤー初期状態の検証

## 10. 既知の制限・改善点

### 10.1 現在の制限
- 固定的な接続パターン
- ステーション種類の偏り可能性
- 非現実的な在庫設定

### 10.2 将来の改善
- より複雑なゲート接続アルゴリズム
- 地理的特性を考慮したステーション配置
- 経済シミュレーションによる在庫調整