# unchartedterritory

個人開発最適化済み TypeScript フルスタックプロジェクト

## 🚀 特徴

- **高速 CI/CD**: Self-hosted runner + 自動デプロイ
- **グローバル配信**: Cloudflare Workers
- **品質保証**: 80%+ テストカバレッジ
- **開発効率**: Claude Code 最適化

## 🛠 セットアップ

```bash
npm install
```

## 📝 開発

```bash
npm run dev          # Express 開発サーバー
npm run dev:worker   # Workers 開発サーバー
npm run test         # テスト実行
npm run test:coverage # カバレッジ生成
```

## 🚢 デプロイ

1. GitHub Secrets に設定:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

2. main ブランチにプッシュで自動デプロイ

## 🤖 Claude Code コマンド

- `/check-ci` - CI確認・修正
- `/sync-main` - ブランチ同期  
- `/deploy-test` - デプロイテスト

## 📊 品質基準

- TypeScript strict mode ✅
- テストカバレッジ 80%+ ✅  
- ESLint エラーゼロ ✅
- 自動デプロイ ✅

Personal Development Optimized by Claude Code
