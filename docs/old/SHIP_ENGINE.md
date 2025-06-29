# 船舶エンジン設計書

## 1. 概要

### 1.1 目的
- 船舶の移動、探索、交易コマンドの実行
- リアルタイム移動システム
- プレイヤーの戦略的意思決定支援

### 1.2 責務
- 船舶移動の物理演算
- コマンド実行と状態管理
- 探索による新セクター発見
- 交易処理と在庫管理

## 2. 移動システム

### 2.1 物理計算
```typescript
// 2D空間での移動計算
moveTowards(current: Vector2, target: Vector2, speed: number, deltaTime: number) {
  distance = sqrt((target.x - current.x)² + (target.y - current.y)²)
  
  if (distance <= speed * deltaTime) {
    return target  // 到達
  }
  
  // 方向ベクトル正規化
  direction = {
    x: (target.x - current.x) / distance,
    y: (target.y - current.y) / distance
  }
  
  return {
    x: current.x + direction.x * speed * deltaTime,
    y: current.y + direction.y * speed * deltaTime
  }
}
```

### 2.2 移動パラメータ
```typescript
// 船種別性能
scout = {
  max_speed: 500,     // m/s (高速)
  cargo_capacity: 10, // 小容量
  cargo_class: 'S'    // 小型貨物のみ
}

trader = {
  max_speed: 200,     // m/s (中速)  
  cargo_capacity: 1000, // 大容量
  cargo_class: 'L'    // 大型貨物対応
}

// 移動速度係数
MOVEMENT_SPEED_MULTIPLIER = 100  // ゲーム時間調整
```

### 2.3 到達判定
```typescript
// 目標到達の判定条件
ARRIVAL_THRESHOLD = 50  // 50m以内で到達扱い

// 理由: UI上の精確性と計算効率のバランス
```

## 3. コマンドシステム

### 3.1 コマンド種類
```typescript
interface ShipCommand {
  type: 'move' | 'explore' | 'trade'
  target?: string      // ステーションID/セクターID
  parameters?: any     // コマンド固有データ
}
```

### 3.2 移動コマンド (move)
```typescript
executeMove(ship, command) {
  // 目標の特定
  if (command.target) {
    target = findStationOrGate(command.target)
  } else {
    target = command.parameters.position
  }
  
  // 移動開始
  ship.destination = target.position
  ship.isMoving = true
  ship.currentCommand = command
  
  event = createMovementEvent(ship, target)
}
```

### 3.3 探索コマンド (explore)
```typescript
executeExplore(ship, gameState) {
  currentSector = getSector(ship.sectorId)
  
  // 未探索ゲートの検索
  unexploredGates = currentSector.gates.filter(gate => 
    !gameState.player.discoveredSectors.includes(gate.connectsTo)
  )
  
  if (unexploredGates.length === 0) {
    event = createNoExplorationEvent(ship)
    return
  }
  
  // 最寄りの未探索ゲートに移動
  nearestGate = findNearestGate(ship.position, unexploredGates)
  ship.destination = nearestGate.position
  ship.isMoving = true
  ship.currentCommand = { type: 'explore', target: nearestGate.id }
}
```

### 3.4 交易コマンド (trade)
```typescript
executeTrade(ship, command, gameState) {
  const { action, wareId, quantity } = command.parameters
  station = findStation(command.target)
  
  // 距離チェック
  distance = getDistance(ship.position, station.position)
  if (distance > TRADE_RANGE) {
    return createTradeFailureEvent('too_far')
  }
  
  if (action === 'buy') {
    result = executeBuy(ship, station, wareId, quantity, gameState)
  } else if (action === 'sell') {
    result = executeSell(ship, station, wareId, quantity, gameState)
  }
  
  return result
}

const TRADE_RANGE = 200  // 200m以内で交易可能
```

## 4. 交易システム

### 4.1 購入処理
```typescript
buyWare(ship, station, wareId, quantity, gameState) {
  stationStock = station.wares.find(w => w.wareId === wareId)
  ware = gameState.wares.find(w => w.id === wareId)
  
  // 可用性チェック
  checks = {
    available: stationStock.sellPrice > 0,
    stock: stationStock.quantity >= quantity,
    credits: gameState.player.credits >= (quantity * stationStock.sellPrice),
    cargo_space: getAvailableCargoSpace(ship, ware) >= quantity
  }
  
  if (!allChecksPass(checks)) {
    return createTradeFailureEvent(failedCheck)
  }
  
  // 取引実行
  totalCost = quantity * stationStock.sellPrice
  gameState.player.credits -= totalCost
  stationStock.quantity -= quantity
  addToShipCargo(ship, wareId, quantity)
  
  return createTradeSuccessEvent('buy', quantity, wareId, totalCost)
}
```

### 4.2 売却処理
```typescript
sellWare(ship, station, wareId, quantity, gameState) {
  stationStock = station.wares.find(w => w.wareId === wareId)
  shipCargo = ship.cargo.find(c => c.wareId === wareId)
  
  // 可用性チェック
  checks = {
    wanted: stationStock.buyPrice > 0,
    ship_stock: shipCargo?.quantity >= quantity,
    station_space: (stationStock.maxQuantity - stationStock.quantity) >= quantity
  }
  
  if (!allChecksPass(checks)) {
    return createTradeFailureEvent(failedCheck)
  }
  
  // 取引実行
  totalRevenue = quantity * stationStock.buyPrice
  gameState.player.credits += totalRevenue
  stationStock.quantity += quantity
  removeFromShipCargo(ship, wareId, quantity)
  
  return createTradeSuccessEvent('sell', quantity, wareId, totalRevenue)
}
```

### 4.3 積載量計算
```typescript
getUsedCargo(ship, gameState) {
  return ship.cargo.reduce((total, cargo) => {
    ware = gameState.wares.find(w => w.id === cargo.wareId)
    return total + (cargo.quantity * ware.cargoSize)
  }, 0)
}

getAvailableCargoSpace(ship, ware) {
  usedSpace = getUsedCargo(ship)
  availableSpace = ship.cargoCapacity - usedSpace
  return Math.floor(availableSpace / ware.cargoSize)
}
```

## 5. 探索システム

### 5.1 セクター発見
```typescript
handleGateArrival(ship, gameState) {
  currentSector = getSector(ship.sectorId)
  nearbyGate = findNearbyGate(ship.position, GATE_INTERACTION_RANGE)
  
  if (!nearbyGate) return
  
  targetSectorId = nearbyGate.connectsTo
  if (gameState.player.discoveredSectors.includes(targetSectorId)) {
    return // 既に発見済み
  }
  
  // 新セクター発見
  newSector = gameState.sectors.find(s => s.id === targetSectorId)
  newSector.discovered = true
  gameState.player.discoveredSectors.push(targetSectorId)
  
  return createDiscoveryEvent(ship, newSector)
}

const GATE_INTERACTION_RANGE = 100  // ゲート相互作用範囲
```

## 6. リアルタイム更新

### 6.1 移動更新処理
```typescript
updateShipMovement(gameState, deltaTime) {
  events = []
  
  gameState.player.ships.forEach(ship => {
    if (!ship.isMoving || !ship.destination) return
    
    // 移動計算
    newPosition = moveTowards(
      ship.position, 
      ship.destination, 
      ship.maxSpeed * MOVEMENT_SPEED_MULTIPLIER, 
      deltaTime
    )
    
    ship.position = newPosition
    
    // 到達判定
    if (getDistance(ship.position, ship.destination) < ARRIVAL_THRESHOLD) {
      handleArrival(ship, gameState, events)
    }
  })
  
  return events
}
```

### 6.2 到達処理
```typescript
handleArrival(ship, gameState, events) {
  ship.position = ship.destination
  ship.isMoving = false
  ship.destination = undefined
  
  // コマンド種別による後処理
  if (ship.currentCommand?.type === 'explore') {
    discoveryEvents = handleGateArrival(ship, gameState)
    events.push(...discoveryEvents)
  }
  
  events.push(createArrivalEvent(ship))
  ship.currentCommand = undefined
}
```

## 7. 状態管理

### 7.1 船舶状態
```typescript
// 船舶の状態遷移
idle → moving → (arrived) → idle
  ↓
trade (immediate) → idle

// 状態チェック
canExecuteCommand(ship, command) {
  if (ship.isMoving && command.type !== 'trade') {
    return false  // 移動中は交易以外不可
  }
  return true
}
```

### 7.2 コマンド履歴
- 現在は `currentCommand` のみ保持
- 将来: コマンド履歴、キューイング機能追加予定

## 8. イベントシステム

### 8.1 イベント種類
```typescript
// 移動関連
movement_start: 移動開始
movement_arrival: 目標到達

// 探索関連  
discovery: 新セクター発見
exploration_complete: 探索完了

// 交易関連
trade_success: 取引成功
trade_failure: 取引失敗
```

### 8.2 イベント生成
```typescript
createEvent(type, ship, details) {
  return {
    timestamp: Date.now(),
    type: type,
    message: generateMessage(type, ship, details),
    details: {
      shipId: ship.id,
      ...details
    }
  }
}
```

## 9. パフォーマンス考慮

### 9.1 計算最適化
- **距離計算**: 平方根計算の最小化
- **衝突判定**: 単純な距離ベース判定
- **更新頻度**: 必要最小限のリアルタイム更新

### 9.2 状態更新効率
- **差分更新**: 移動中の船舶のみ処理
- **イベント最適化**: 重要なイベントのみ保存

## 10. 設定パラメータ

```typescript
// ship-engine.ts 内の調整可能値
MOVEMENT_SPEED_MULTIPLIER = 100
ARRIVAL_THRESHOLD = 50
TRADE_RANGE = 200
GATE_INTERACTION_RANGE = 100

// 船種別性能（将来的にJSON設定化）
SHIP_SPECS = {
  scout: { speed: 500, cargo: 10, class: 'S' },
  trader: { speed: 200, cargo: 1000, class: 'L' }
}
```

## 11. 既知の制限と改善点

### 11.1 現在の制限
- **単純な移動**: 直線移動のみ
- **衝突判定なし**: 障害物・他船との衝突なし
- **移動コストなし**: 燃料等のリソース消費なし

### 11.2 将来の拡張
- **経路探索**: A*アルゴリズムによる最適ルート
- **燃料システム**: 移動距離による燃料消費
- **自動化コマンド**: 複数ステーション間の自動交易
- **船団機能**: 複数船舶の連携行動

## 12. テスト戦略

### 12.1 単体テスト
- 移動計算の精度
- 交易条件判定
- 探索ロジック

### 12.2 統合テスト
- 長距離移動の安定性
- 複数船舶の同時動作
- 経済システムとの連携

### 12.3 パフォーマンステスト
- 大量船舶の移動処理
- 長時間稼働での安定性