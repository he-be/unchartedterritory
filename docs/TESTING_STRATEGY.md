# テスト戦略設計書

## 1. テスト戦略概要

### 1.1 目的
- **品質保証**: 機能の正確性確保
- **回帰防止**: 変更時の既存機能破綻防止
- **設計文書**: テストコードによる仕様明確化
- **リファクタリング支援**: 安全な構造変更を可能に

### 1.2 品質基準
- **テストカバレッジ**: 80%以上（現在68.45%）
- **テスト成功率**: 100%（現在97%）
- **TypeScript準拠**: strict mode エラーゼロ
- **Lint準拠**: ESLintエラーゼロ

## 2. テスト構成

### 2.1 テストツール構成
```typescript
// テストランナー: Vitest
// HTTPテスト: Supertest  
// アサーション: Vitest built-in
// カバレッジ: v8 coverage
// 型チェック: TypeScript compiler
// 品質チェック: ESLint
```

### 2.2 テスト実行環境
```bash
npm test              # 基本テスト実行
npm run test:watch    # 監視モード
npm run test:coverage # カバレッジ測定
npm run typecheck     # 型チェック
npm run lint          # 品質チェック
```

## 3. テストレイヤー

### 3.1 API統合テスト (index.test.ts)

#### 対象範囲
- Express.js APIエンドポイント
- リクエスト/レスポンス検証
- エラーハンドリング
- ゲームロジック統合

#### テスト構造
```typescript
describe('Uncharted Territory Game API', () => {
  let gameId: string
  
  beforeEach(async () => {
    // 各テストで新規ゲーム作成
    const response = await request(app).post('/api/game/new')
    gameId = response.body.gameId
  })
  
  describe('Game Lifecycle', () => {
    // ゲーム作成・状態取得テスト
  })
  
  describe('Sectors and Exploration', () => {
    // セクター情報・探索機能テスト
  })
  
  describe('Ship Commands', () => {
    // 船舶操作テスト
  })
  
  describe('Trading System', () => {
    // 交易システムテスト
  })
  
  describe('Error Handling', () => {
    // エラー処理テスト
  })
})
```

#### 主要テストケース
```typescript
// 正常系
- 新規ゲーム作成
- ゲーム状態取得
- セクター探索
- 船舶移動コマンド
- 交易実行

// 異常系  
- 存在しないゲームID
- 不正なパラメータ
- 移動中の船舶への無効コマンド
- 残高不足での購入試行
```

### 3.2 Cloudflare Workers テスト (worker.test.ts)

#### 対象範囲
- Workers環境でのAPI動作
- CORS対応
- エッジ環境特有の制約

#### テスト戦略
```typescript
describe('Uncharted Territory Cloudflare Workers', () => {
  let worker: any
  
  beforeEach(async () => {
    worker = await import('../worker')
  })
  
  describe('Basic Endpoints', () => {
    // 基本エンドポイント（/, /health）
    // CORS プリフライト対応
  })
  
  describe('Game Lifecycle', () => {
    // Expressと同等の機能テスト
  })
  
  describe('Error Handling', () => {
    // Workers特有のエラー処理
  })
})
```

#### Workers特有の考慮点
- Request/Response API使用
- 非同期処理の確実な待機
- JSON解析エラーの適切な処理

## 4. テスト設計パターン

### 4.1 テストデータ管理

#### ゲーム状態の初期化
```typescript
// 各テストで独立したゲーム状態
beforeEach(async () => {
  gameId = await createNewGame()
  // 依存するテストデータの準備
  shipId = await getPlayerShip(gameId)
  sectorId = await getStartingSector(gameId)
})
```

#### テストデータの一貫性
```typescript
// 動的な値の検証戦略
expect(response.body.gameId).toBeDefined()
expect(response.body.credits).toBe(100000)  // 固定値
expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/) // 形式検証
```

### 4.2 エラーテスト戦略

#### 段階的なエラー検証
```typescript
// 1. 存在チェック
expect(response.status).toBe(404)
expect(response.body.error).toBe('Game not found')

// 2. 権限・状態チェック  
expect(response.status).toBe(400)
expect(response.body.error).toBe('Ship is currently moving')

// 3. ビジネスルールチェック
expect([200, 400]).toContain(response.status) // 距離等による条件分岐
```

#### エラーメッセージの一貫性
```typescript
// 統一されたエラー形式の検証
{
  error: string,           // 人間可読メッセージ
  details?: object        // 詳細情報（オプション）
}
```

### 4.3 非同期処理テスト

#### 移動システムのテスト
```typescript
test('ship movement', async () => {
  // 移動コマンド送信
  await request(app)
    .post(`/api/game/${gameId}/ships/${shipId}/commands`)
    .send({ type: 'move', target: stationId })
  
  // 状態確認（移動開始）
  const state1 = await request(app).get(`/api/game/${gameId}/state`)
  expect(state1.body.player.ships[0].isMoving).toBe(true)
  
  // 時間経過後の状態確認（到達）
  // 注意: リアルタイム移動は時間依存のため、
  // テストでは状態の設定のみ確認
})
```

## 5. カバレッジ分析

### 5.1 現在のカバレッジ状況
```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|----------
All files          |   68.45 |    78.36 |   76.47 |   68.45
economic-engine.ts |   56.75 |    93.54 |      80 |   56.75
index.ts          |   87.54 |       72 |     100 |   87.54
ship-engine.ts    |   34.75 |       60 |      50 |   34.75
worker.ts         |   70.12 |    81.25 |    90.9 |   70.12
world-generator.ts |   99.12 |    81.81 |     100 |   99.12
```

### 5.2 カバレッジ改善戦略

#### 低カバレッジ領域の対策
```typescript
// ship-engine.ts (34.75%)
- 探索システムの詳細テスト
- 交易失敗ケースの網羅
- 移動計算の境界値テスト

// economic-engine.ts (56.75%)  
- 生産サイクルの時間依存テスト
- 価格計算の全パターン検証
- 交易機会検出アルゴリズムテスト
```

#### テスト追加優先順位
1. **ship-engine**: 重要な機能、低カバレッジ
2. **economic-engine**: 複雑なロジック、中程度カバレッジ
3. **worker.ts**: エラーハンドリング強化

## 6. 継続的品質保証

### 6.1 プリコミットフック
```json
{
  "scripts": {
    "precommit": "npm run lint && npm run typecheck && npm run test"
  }
}
```

### 6.2 品質ゲート
```typescript
// テスト実行の必須条件
- TypeScript エラー: 0件
- ESLint エラー: 0件  
- テスト失敗: 0件
- カバレッジ: 80%以上（目標）
```

## 7. テストの保守性

### 7.1 テストコードの構造化

#### ヘルパー関数の活用
```typescript
// テスト共通処理の関数化
async function createGameWithShip() {
  const gameResponse = await request(app).post('/api/game/new')
  const gameId = gameResponse.body.gameId
  const stateResponse = await request(app).get(`/api/game/${gameId}/state`)
  const shipId = stateResponse.body.player.ships[0].id
  return { gameId, shipId }
}
```

#### テストデータの外部化
```typescript
// 将来実装: テストデータの設定ファイル化
const TEST_CONFIG = {
  initialCredits: 100000,
  scoutShipName: 'Discovery',
  startingSectorName: 'Argon Prime'
}
```

### 7.2 テストの独立性確保

#### 状態汚染の防止
```typescript
beforeEach(() => {
  // 各テストで独立したゲーム状態作成
  // 共有状態への依存を排除
})

afterEach(() => {
  // 必要に応じてクリーンアップ
  // 現在はメモリ内状態のため不要
})
```

## 8. パフォーマンステスト

### 8.1 現在の考慮事項
```typescript
// テスト実行時間の最適化
- 並列実行可能なテストの特定
- 重い初期化処理の共通化
- タイムアウト設定の適切化
```

### 8.2 将来のパフォーマンステスト
```typescript
// 負荷テスト（将来実装）
- 大量ゲーム状態での動作確認
- 同時API呼び出し処理
- メモリ使用量の監視
```

## 9. テスト環境管理

### 9.1 環境分離
```typescript
// 開発環境
- ローカルテスト実行
- ホットリロード対応

// CI環境  
- 自動テスト実行
- カバレッジレポート生成
- 品質ゲートチェック
```

### 9.2 依存関係管理
```typescript
// テスト専用依存関係
devDependencies: {
  "vitest": "^1.0.0",
  "supertest": "^7.1.1", 
  "@vitest/coverage-v8": "^1.6.1"
}
```

## 10. 今後の改善計画

### 10.1 短期改善 (1-2週間)
```typescript
// カバレッジ80%達成
- ship-engine.ts の探索・交易テスト追加
- economic-engine.ts の生産サイクルテスト追加
- エラーケースの網羅的テスト

// テスト安定性向上
- 時間依存テストの改善
- 非決定的テストの特定・修正
```

### 10.2 中期改善 (1-2ヶ月)
```typescript
// E2Eテスト導入
- ブラウザ自動化テスト
- ユーザーシナリオベーステスト

// パフォーマンステスト
- 負荷テスト自動化
- メモリリーク検出
```

### 10.3 長期改善 (3-6ヶ月)
```typescript
// テスト基盤強化
- テストデータ生成の自動化
- 視覚的回帰テスト
- A/Bテスト基盤

// 品質メトリクス
- コード品質の継続監視
- テスト実行時間の最適化
- テストコードの可読性向上
```

## 11. 参考情報

### 11.1 テスト実行コマンド
```bash
# 基本テスト
npm test

# 監視モード
npm run test:watch

# カバレッジ付きテスト  
npm run test:coverage

# 品質チェック一括実行
npm run precommit
```

### 11.2 テスト設定ファイル
```typescript
// vitest.config.ts
export default {
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 80,
        functions: 80
      }
    }
  }
}
```