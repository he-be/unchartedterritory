# Uncharted Territory

宇宙経済シミュレーションゲーム - 司令官として船団を指揮し、未知の宇宙で経済圏を確立しよう

## 🌌 ゲーム概要

X3/X4シリーズやFactorioにインスパイアされた宇宙経済シミュレーション。プレイヤーは司令官として：

- **探索**: 偵察機で未知のセクターを発見
- **交易**: 価格差を利用した戦略的な商品取引  
- **拡張**: 利益で船団を拡大し、より大規模な交易を実現
- **経済**: リアルタイムの価格変動と生産サイクル

## ⚡ 技術特徴

- **TypeScript フルスタック**: 型安全な開発
- **デュアル実装**: Express.js (開発) + Cloudflare Workers (本番)
- **リアルタイム経済**: 動的価格変動・生産システム
- **高品質**: 80%+ テストカバレッジ目標

## 🛠 セットアップ

```bash
npm install
```

## 🎮 ゲームの遊び方

現在フロントエンドはないため、HTTP API で直接プレイします。

### クイックスタート
```bash
# 1. 新規ゲーム作成
curl -X POST http://localhost:3000/api/game/new

# 2. ゲーム状態確認（gameId をメモ）
curl http://localhost:3000/api/game/[gameId]/state

# 3. 船舶に探索指示
curl -X POST http://localhost:3000/api/game/[gameId]/ships/scout_01/commands \
  -H "Content-Type: application/json" \
  -d '{"type": "explore"}'

# 4. 交易機会の確認
curl http://localhost:3000/api/game/[gameId]/trade-opportunities
```

**📖 詳しいプレイ方法は [ゲームプレイガイド](./docs/GAMEPLAY_GUIDE.md) を参照**

## 📝 開発

### 開発コマンド
```bash
npm run dev          # Express 開発サーバー (localhost:3000)
npm run dev:worker   # Workers 開発サーバー
npm run test         # テスト実行
npm run test:coverage # カバレッジ生成
npm run lint         # コード品質チェック
npm run typecheck    # 型チェック
```

### 開発ワークフロー

このプロジェクトは **Git Flow + CI/CD** でPR駆動開発を行っています：

1. **Feature Branch作成** → 2. **開発・テスト** → 3. **PR作成** → 4. **CI/CD自動チェック** → 5. **レビュー・マージ** → 6. **自動デプロイ**

```bash
# 1. 新機能開発開始
git checkout -b feature/new-feature

# 2. 開発・ローカルテスト
npm test && npm run lint && npm run typecheck

# 3. PR作成 (GitHub UI)
git push origin feature/new-feature

# 4. 自動チェック実行 ✅
#    - ESLint, TypeScript, Tests, Coverage
#    - すべて通過後にマージ可能

# 5. main マージ後、自動デプロイ 🚀
```

**📖 詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照**

## 📚 設計ドキュメント

詳細な設計思想と実装方針は [docs/](./docs/) を参照：

- **[アーキテクチャ全体](./docs/ARCHITECTURE.md)**: システム構成・技術選定
- **[データモデル](./docs/DATA_MODEL.md)**: TypeScript型設計・DB設計
- **[世界生成](./docs/WORLD_GENERATION.md)**: 宇宙・経済の生成ロジック  
- **[経済エンジン](./docs/ECONOMIC_ENGINE.md)**: 価格変動・生産システム
- **[船舶エンジン](./docs/SHIP_ENGINE.md)**: 移動・探索・交易システム
- **[API設計](./docs/API_DESIGN.md)**: REST API・エラーハンドリング
- **[テスト戦略](./docs/TESTING_STRATEGY.md)**: 品質保証・カバレッジ戦略

## 🚢 デプロイ

### Express.js (開発・本番)
```bash
npm run build
npm start
```

### Cloudflare Workers (本番)
```bash
npm run build:worker
wrangler deploy
```

## 📊 品質基準

- **TypeScript strict mode** ✅
- **ESLint エラーゼロ** ✅  
- **テストカバレッジ** 68.45% → 80%+ (改善中)
- **全テスト成功** ✅

## 🗺️ 開発ロードマップ

### MVP (完了) ✅
- 基本的な探索・交易システム
- リアルタイム経済エンジン
- Express + Workers デュアル実装

### Phase 2 (計画中)
- データベース永続化
- WebSocket リアルタイム通信
- 自動化コマンド (自動交易)

### Phase 3 (将来)
- フロントエンド UI
- マルチプレイヤー対応
- 高度な AI 船舶システム

---

*Claude Code による個人開発最適化プロジェクト*
