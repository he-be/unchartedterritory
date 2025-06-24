# AI Development Constitution (CLAUDE.md)

このプロジェクトは個人開発効率化のための最適設定済みです。

## 個人開発最適化ルール

### 開発フロー
- GitHub Issues → ブランチ作成 → 実装 → テスト → PR → 自動デプロイ
- カバレッジ 80% 以上必須
- Self-hosted runner で高速 CI/CD
- Cloudflare Workers で世界配信

### Claude Code 効率化
- TodoWrite/TodoRead を頻繁に活用
- 一括処理でスピード重視
- テスト駆動開発必須
- デプロイまで自動化

### 技術スタック
- **フロントエンド**: TypeScript + 任意のフレームワーク
- **バックエンド**: Express.js（開発） + Cloudflare Workers（本番）
- **テスト**: Vitest + Supertest
- **CI/CD**: GitHub Actions（self-hosted）
- **デプロイ**: Cloudflare Workers

### 品質基準
- TypeScript strict mode 必須
- ESLint エラーゼロ
- テストカバレッジ 80%+
- 全 CI チェック通過

### コマンド
- `/check-ci` - CI確認・修正
- `/sync-main` - ブランチ同期
- `/deploy-test` - デプロイテスト
- `/setup-cloudflare` - Workers設定
