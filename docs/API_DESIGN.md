# API設計書

## 1. 概要

### 1.1 目的
- ゲームロジックとフロントエンドの分離
- 複数デプロイ環境での一貫性確保 (Express + Cloudflare Workers)
- RESTful APIによる直感的な操作

### 1.2 設計原則
- **REST準拠**: リソースベースのURL設計
- **無状態**: セッション管理なし（ゲーム状態はサーバー側で管理）
- **冪等性**: 同じリクエストは同じ結果を返す
- **エラー処理**: 適切なHTTPステータスコードとエラーメッセージ

## 2. アーキテクチャ

### 2.1 デュアル実装
```
┌─────────────────┐    ┌─────────────────┐
│   Express.js    │    │ Cloudflare      │
│   (開発・本格)   │    │ Workers (本番)   │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────┬───────────────┘
                 │
         ┌─────────────────┐
         │  Game Engine    │
         │  (共通ロジック)  │
         └─────────────────┘
```

### 2.2 共通インターフェース
両環境で同一のAPIエンドポイントとレスポンス形式を提供

## 3. エンドポイント設計

### 3.1 ゲーム管理
```http
POST /api/game/new
# 新規ゲーム作成
Response: {
  gameId: string,
  message: string,
  initialState: {
    playerId: string,
    credits: number,
    startingSector: string,
    shipCount: number
  }
}

GET /api/game/:gameId/state  
# ゲーム状態取得
Response: {
  gameId: string,
  gameTime: number,
  player: Player,
  discoveredSectors: Sector[],
  recentEvents: GameEvent[]
}
```

### 3.2 探索・セクター情報
```http
GET /api/game/:gameId/sectors
# 発見済みセクター一覧
Response: Array<{
  id: string,
  name: string,
  stationCount: number,
  gateCount: number,
  playerShips: number
}>

GET /api/game/:gameId/sectors/:sectorId
# セクター詳細情報
Response: {
  ...Sector,
  playerShips: Ship[],
  wares: Ware[]  // 価格計算済み
}
```

### 3.3 船舶操作
```http
POST /api/game/:gameId/ships/:shipId/commands
# 船舶コマンド実行
Request: ShipCommand {
  type: 'move' | 'explore' | 'trade',
  target?: string,
  parameters?: any
}
Response: {
  success: boolean,
  ship: ShipStatus,
  events: GameEvent[]
}
```

### 3.4 交易システム
```http
GET /api/game/:gameId/trade-opportunities
# 交易機会一覧
Response: Array<{
  wareId: string,
  from: { stationId, sectorId, price },
  to: { stationId, sectorId, price },
  profitMargin: number
}>

POST /api/game/:gameId/ships/:shipId/trade
# 直接交易実行
Request: {
  stationId: string,
  action: 'buy' | 'sell',
  wareId: string,
  quantity: number
}
Response: {
  success: boolean,
  ship: { cargo },
  player: { credits },
  events: GameEvent[]
}
```

### 3.5 プレイヤー情報
```http
GET /api/game/:gameId/player
# プレイヤー状態詳細
Response: {
  ...Player,
  totalCargoValue: number,
  fleetStatus: Array<ShipSummary>
}
```

## 4. 実装詳細

### 4.1 Express.js実装 (index.ts)

#### 特徴
- **開発効率**: 豊富なミドルウェア
- **デバッグ性**: 詳細なログ・エラー情報
- **柔軟性**: 複雑なビジネスロジック対応

#### 主要構成
```typescript
// ミドルウェア構成
app.use(express.json())
app.use(express.static('public'))

// ゲーム状態管理
const gameStates = new Map<string, GameState>()
const gameEvents = new Map<string, GameEvent[]>()

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})
```

#### リクエスト処理フロー
```typescript
1. エンドポイント判定
2. パラメータ抽出・検証
3. ゲーム状態取得
4. ビジネスロジック実行
5. 経済・移動エンジン更新
6. レスポンス生成
```

### 4.2 Cloudflare Workers実装 (worker.ts)

#### 特徴
- **エッジ配信**: 世界中の低レイテンシ
- **スケーラビリティ**: 自動スケーリング
- **コスト効率**: 従量課金

#### 主要構成
```typescript
// ルーティング
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    
    // パターンマッチングでエンドポイント判定
    const gameStateMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/state$/)
    if (gameStateMatch && method === 'GET') {
      return handleGameState(gameStateMatch[1], corsHeaders)
    }
    // ...
  }
}
```

#### CORS対応
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// プリフライトリクエスト対応
if (method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders })
}
```

## 5. 状態管理

### 5.1 ゲーム状態
```typescript
// メモリ内状態管理（MVP版）
Map<gameId, GameState>
Map<gameId, GameEvent[]>

// 将来的にはデータベース永続化
// - Redis: セッション管理
// - PostgreSQL: ゲーム状態
// - InfluxDB: イベント履歴
```

### 5.2 状態更新戦略
```typescript
// リクエスト時の自動更新
1. economic-engine.updateEconomy()
2. ship-engine.updateShipMovement()
3. 価格再計算
4. イベント生成

// 更新頻度制御
- 経済更新: 60秒間隔制限
- 移動更新: リクエスト毎（リアルタイム）
- 価格更新: セクター参照時
```

## 6. エラー処理

### 6.1 HTTPステータスコード
```
200 OK: 正常処理
201 Created: リソース作成成功
204 No Content: 削除成功
400 Bad Request: リクエスト不正
404 Not Found: リソース未発見
500 Internal Server Error: サーバーエラー
```

### 6.2 エラーレスポンス形式
```json
{
  "error": "Game not found",
  "details": {
    "gameId": "invalid-id",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### 6.3 エラー処理戦略
- **入力検証**: パラメータの型・範囲チェック
- **存在確認**: ゲーム・船舶・ステーションの存在
- **状態確認**: 船舶移動中等の状態制約
- **ビジネスルール**: 残高・積載量等の制約

## 7. パフォーマンス最適化

### 7.1 レスポンス最適化
```typescript
// 必要なデータのみ返却
ship_summary = {
  id, name, position, isMoving, cargo  // 全データは返さない
}

// 大量データの制限
trade_opportunities.slice(0, 20)  // 上位20件のみ
recent_events.slice(-10)          // 直近10件のみ
```

### 7.2 計算効率化
```typescript
// 差分更新
if (now - gameState.lastUpdate < PRODUCTION_CYCLE_MS) {
  return events  // 経済更新スキップ
}

// キャッシュ活用
updatePrices(sector)  // セクター参照時のみ価格更新
```

## 8. セキュリティ考慮

### 8.1 入力検証
```typescript
// パラメータサニタイゼーション
gameId: string (英数字のみ)
quantity: number (正の整数)
wareId: string (許可された値のみ)
```

### 8.2 レート制限
- 将来実装: IP別リクエスト制限
- ゲーム操作頻度制限

## 9. 監視・ログ

### 9.1 ログ戦略
```typescript
// Express.js
console.log(`Game ${gameId}: Ship ${shipId} executed ${command.type}`)
console.error(`Error in game ${gameId}:`, error.stack)

// Cloudflare Workers  
console.error('Worker error:', error)
```

### 9.2 メトリクス（将来実装）
- API呼び出し頻度
- ゲーム作成数
- 平均セッション時間
- エラー率

## 10. テスト戦略

### 10.1 API テスト
```typescript
// 統合テスト
describe('Game Lifecycle', () => {
  test('create game → get state → execute commands')
})

// エラーケーステスト
describe('Error Handling', () => {
  test('invalid game ID returns 404')
  test('malformed request returns 400')
})
```

### 10.2 環境別テスト
- Express: Supertest使用
- Workers: フェッチAPIモック

## 11. 設定管理

### 11.1 環境変数
```typescript
// Express
PORT = process.env.PORT || 3000

// Workers (将来実装)
GAME_DB_URL = env.GAME_DB_URL
REDIS_URL = env.REDIS_URL
```

### 11.2 設定可能項目
- ゲーム状態の永続化間隔
- イベント履歴保持期間  
- API レート制限値

## 12. デプロイメント

### 12.1 Express.js
```bash
npm run build
npm start
# or
docker build -t uncharted-territory .
docker run -p 3000:3000 uncharted-territory
```

### 12.2 Cloudflare Workers
```bash
npm run build:worker
wrangler deploy
```

## 13. 今後の拡張

### 13.1 短期拡張
- **WebSocket**: リアルタイム更新
- **認証**: プレイヤーアカウント管理
- **永続化**: データベース統合

### 13.2 長期拡張
- **GraphQL**: 複雑なクエリ対応
- **gRPC**: マイクロサービス間通信
- **Event Sourcing**: 完全な状態履歴管理