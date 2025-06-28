# 経済エンジン設計書

## 1. 概要

### 1.1 目的
- 動的な価格変動システム
- 供給と需要に基づくリアルタイム経済
- プレイヤーの交易判断を促進する価格差創出

### 1.2 設計思想
- **需給バランス**: 在庫量が価格を決定
- **生産サイクル**: 定期的な商品生産・消費
- **交易機会**: 価格差による利益創出機会

## 2. 価格決定メカニズム

### 2.1 基本価格式
```typescript
// 仕様書通りの価格計算
price = max_price - ((max_price - min_price) * stock_ratio)

where:
  max_price = base_price + (base_price * PRICE_MULTIPLIER)
  min_price = base_price - (base_price * PRICE_MULTIPLIER)
  stock_ratio = current_quantity / max_quantity
  PRICE_MULTIPLIER = 0.3 (±30%変動)
```

### 2.2 価格適用ルール
```typescript
if (station.produces(ware)) {
  // 生産ステーション: 売却のみ
  sell_price = calculated_price
  buy_price = 0
} else if (station.consumes(ware)) {
  // 消費ステーション: 購入のみ
  buy_price = calculated_price  
  sell_price = 0
} else {
  // 交易港: 両方（マージン付き）
  buy_price = calculated_price * 0.95
  sell_price = calculated_price * 1.05
}
```

### 2.3 価格更新タイミング
- **リアルタイム**: セクター情報取得時
- **取引時**: 売買実行後即座に反映
- **定期更新**: 60秒サイクルで生産処理

## 3. 生産・消費システム

### 3.1 生産サイクル
```typescript
// 60秒間隔での生産処理
const PRODUCTION_CYCLE_MS = 60000

processProduction(station) {
  // 前提条件チェック
  if (!canProduce(station)) return
  
  // 投入材料の消費
  for (input in station.consumes) {
    station.wares[input].quantity -= CONSUMPTION_AMOUNT
  }
  
  // 生産物の追加
  for (output in station.produces) {
    station.wares[output].quantity += PRODUCTION_AMOUNT
  }
}
```

### 3.2 生産可能条件
```typescript
canProduce(station) {
  // 投入材料の在庫確認
  for (input in station.consumes) {
    if (stock[input].quantity < REQUIRED_AMOUNT) {
      return false
    }
  }
  
  // 生産物の容量確認
  for (output in station.produces) {
    if (stock[output].quantity >= max_quantity - PRODUCTION_AMOUNT) {
      return false
    }
  }
  
  return true
}
```

### 3.3 生産量設定
```typescript
// 現在の生産・消費量
CONSUMPTION_AMOUNT = 10  // 投入材料
PRODUCTION_AMOUNT = 20   // 生産物

// バランス考慮
- 生産量 > 消費量 (経済成長)
- 十分な在庫バッファ (継続生産)
- プレイヤー取引への影響 (適度な変動)
```

## 4. 交易機会検出

### 4.1 利益機会計算
```typescript
getTradeOpportunities(gameState) {
  opportunities = []
  
  for (ware in all_wares) {
    sellers = findSellers(ware)  // sell_price > 0
    buyers = findBuyers(ware)    // buy_price > 0
    
    for (seller in sellers) {
      for (buyer in buyers) {
        if (buyer.price > seller.price) {
          profit = buyer.price - seller.price
          opportunities.push({
            ware, seller, buyer, profit
          })
        }
      }
    }
  }
  
  return sort_by_profit_desc(opportunities)
}
```

### 4.2 機会評価指標
- **利益率**: 絶対利益額
- **セクター間距離**: 移動コスト考慮
- **在庫状況**: 取引可能量
- **市場安定性**: 価格変動リスク

## 5. システム統合

### 5.1 更新スケジュール
```typescript
// 経済エンジンの呼び出しタイミング
1. ゲーム状態取得時: updateEconomy()
2. セクター詳細取得時: updatePrices(sector)
3. 取引実行時: 即座に価格反映
```

### 5.2 他システムとの連携
```typescript
// 船舶エンジンとの連携
trade_execution → price_update → opportunity_recalculation

// APIレイヤーとの連携  
api_request → economic_update → response_with_current_prices
```

## 6. パフォーマンス最適化

### 6.1 計算効率化
- **差分更新**: 変更のあったステーションのみ処理
- **キャッシュ**: 頻繁にアクセスされる価格情報
- **バッチ処理**: 複数ステーションの一括更新

### 6.2 メモリ効率化
- **イベント履歴**: 一定期間後の自動削除
- **機会リスト**: 上位N件のみ保持
- **価格履歴**: 必要最小限の保存

## 7. 設定パラメータ

### 7.1 経済設定
```typescript
// economic-engine.ts 内の調整可能値
PRODUCTION_CYCLE_MS = 60000      // 生産サイクル間隔
PRICE_MULTIPLIER = 0.3           // 価格変動幅
CONSUMPTION_AMOUNT = 10          // 投入材料量
PRODUCTION_AMOUNT = 20           // 生産量

// 交易港のマージン率
TRADING_PORT_BUY_RATE = 0.95     // 買取価格係数
TRADING_PORT_SELL_RATE = 1.05    // 販売価格係数
```

### 7.2 バランス調整可能項目
- 各ステーション種別の生産効率
- 商品別の価格変動範囲
- 在庫最大値と生産速度の比率

## 8. イベントシステム

### 8.1 経済イベント生成
```typescript
// 生産完了時
event = {
  type: 'production',
  station_id: string,
  consumed: [{ware_id, quantity}],
  produced: [{ware_id, quantity}],
  timestamp: number
}

// 価格変動時（将来実装）
event = {
  type: 'price_change',
  station_id: string,
  ware_id: string,
  old_price: number,
  new_price: number,
  cause: 'production' | 'trade' | 'demand'
}
```

## 9. テスト戦略

### 9.1 単体テスト
- 価格計算の正確性
- 生産条件判定
- 交易機会検出

### 9.2 統合テスト
- 経済サイクルの継続性
- 価格収束の確認
- パフォーマンス測定

## 10. 既知の問題と改善点

### 10.1 現在の制限
- **簡素な需要モデル**: 固定消費量
- **価格収束問題**: 極端な在庫状態での停滞
- **外部要因なし**: プレイヤー以外の経済主体不在

### 10.2 将来の拡張
- **動的需要**: 季節変動、イベント影響
- **NPCトレーダー**: AI商人による市場活性化
- **経済指標**: インフレ率、GDP等の統計
- **先物取引**: 価格リスク管理ツール

## 11. 経済バランス検証

### 11.1 健全性指標
- **価格安定性**: 異常な価格変動の検出
- **流動性**: 全商品が適度に取引可能
- **成長性**: 長期的な経済拡大

### 11.2 プレイヤー体験
- **利益機会**: 常に複数の選択肢存在
- **リスク・リターン**: 高利益には相応のリスク
- **学習曲線**: 徐々に複雑な戦略が理解可能