# Frontend Deployment Troubleshooting Guide

## 問題の概要

フロントエンド (React SPA) から backend API への呼び出しが間欠的に失敗する問題。
エラー: `Failed to load resource: the server responded with a status of 404 ()`

## 問題の経緯と試行錯誤

### 初期問題 (Issue #3)

**症状**: フロントエンドアクセス時に "not found" エラー
- URL: https://unchartedterritory-frontend.masahiro-hibi.workers.dev/
- 原因: Workers Sites の設定問題

### 第1段階: Workers Sites から Static Assets API への移行

**問題**: 古いWorkers Sites APIが非推奨だった
```toml
# 古い設定 (非推奨)
[site]
bucket = "./frontend/dist"
entry-point = "./dist"
```

**解決策**: Cloudflare Workers Static Assets APIに移行
```toml
# 新しい設定
[assets]
directory = "./frontend/dist"
not_found_handling = "single-page-application"
binding = "ASSETS"
```

### 第2段階: .env.production の設定問題

**問題**: フロントエンドのAPI URLが間違っていた
```env
# 間違った設定
VITE_API_URL=https://unchartedterritory.your-subdomain.workers.dev/api
```

**解決策**: 相対パスを使用
```env
# 正しい設定
VITE_API_URL=/api
```

### 第3段階: run_worker_first 設定の問題

**問題**: API requestsがWorker codeに到達しない
```toml
# 動作しなかった設定
run_worker_first = ["/api/*", "/debug"]
```

**試行錯誤**:
1. `run_worker_first = true` に変更 → 効果なし
2. `run_worker_first` を削除 → 効果なし
3. 手動SPAルーティング実装 → 効果なし

### 第4段階: 設定形式の標準化

**問題**: `[assets]` セクション形式が非標準だった
```toml
# 非標準形式
[assets]
directory = "./frontend/dist"
binding = "ASSETS"
```

**解決策**: inline形式に変更
```toml
# 標準形式
assets = { directory = "./frontend/dist" }
```

**結果**: ✅ 一時的に動作

## 根本原因の分析

### 1. CI/CDデプロイメント問題

**問題**: Frontend workerがbackend workerと異なるタイミングでデプロイされる

```yaml
# CI/CD workflow
- name: Deploy backend to Cloudflare Workers
  run: npm run deploy

- name: Deploy frontend to Cloudflare Workers  
  run: npm run deploy:frontend
```

**課題**: 
- Backend deployが成功してもfrontend deployが失敗する場合がある
- Deploy順序による一時的な不整合
- Cloudflare Workers のpropagation delay

### 2. Static Assets API の制約

**発見した制約**:
- `run_worker_first` の配列形式は未サポート
- Worker codeとStatic Assetsの優先順位が不明確
- Documentation不足によるconfiguration trial-and-error

### 3. Environment Variables の複雑性

**問題**: Build時とRuntime時の環境変数の違い
```typescript
// Build時に埋め込まれる
const API_URL = import.meta.env.VITE_API_URL;

// Runtime時には変更不可
```

## 現在の設定状態

### Frontend Worker Configuration
```toml
name = "unchartedterritory-frontend"
main = "src/frontend-worker.ts"
compatibility_date = "2024-09-19"
assets = { directory = "./frontend/dist" }
```

### Frontend Worker Code
```typescript
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API requests - proxy to backend worker
    if (url.pathname.startsWith('/api/')) {
      const backendUrl = 'https://unchartedterritory.masahiro-hibi.workers.dev' + url.pathname + url.search;
      return fetch(backendUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }
    
    // Debug endpoint
    if (url.pathname === '/debug') {
      return new Response(JSON.stringify({
        envKeys: Object.keys(env),
        hasAssets: !!env.ASSETS,
        url: url.toString(),
        pathname: url.pathname,
        message: 'Debug endpoint working'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Serve static assets
    return env.ASSETS.fetch(request);
  },
};
```

## デバッグ手法

### 1. 段階的テスト
```bash
# 1. Backend API direct test
curl -X POST https://unchartedterritory.masahiro-hibi.workers.dev/api/game/new

# 2. Frontend proxy test  
curl -X POST https://unchartedterritory-frontend.masahiro-hibi.workers.dev/api/game/new

# 3. Debug endpoint test
curl https://unchartedterritory-frontend.masahiro-hibi.workers.dev/debug

# 4. Frontend static assets test
curl https://unchartedterritory-frontend.masahiro-hibi.workers.dev/
```

### 2. CI/CD Deploy Status Check
```bash
# GitHub Actions API check
curl -s "https://api.github.com/repos/he-be/unchartedterritory/actions/runs" | \
  jq '.workflow_runs[0] | {status: .status, conclusion: .conclusion}'
```

### 3. Worker Logs (要API Token)
```bash
# Real-time logs
npx wrangler tail --config wrangler-frontend.toml
```

## 未解決問題と推定原因

### 問題: 間欠的なAPI 404エラー

**推定原因**:
1. **Deploy Propagation Delay**: Cloudflare Workersの更新がglobalに反映される前のアクセス
2. **CI/CD Race Condition**: BackendとFrontendの deploy順序による一時的不整合  
3. **Static Assets vs Worker Priority**: 設定の微妙な違いによるrouting問題
4. **Caching Issues**: CloudflareのEdge cachingによる古いworker codeの実行

### 症状パターン:
- ✅ Debug endpoint (`/debug`) は常に動作
- ❌ API calls (`/api/*`) が間欠的に404
- ✅ Static assets (`/`, `/index.html`) は動作
- ❌ Browser console: `POST /api/game/new 404 (Not Found)`

## 推奨解決策

### 短期対策 (Immediate Fix)

1. **Deploy Status Verification**
```bash
# Deploy後の確認を必須化
curl -f https://unchartedterritory-frontend.masahiro-hibi.workers.dev/debug
curl -f https://unchartedterritory-frontend.masahiro-hibi.workers.dev/api/game/new
```

2. **CI/CD改善**
```yaml
- name: Deploy and verify frontend
  run: |
    npm run deploy:frontend
    sleep 10  # Wait for propagation
    curl -f ${FRONTEND_URL}/debug
    curl -X POST -f ${FRONTEND_URL}/api/game/new -d '{"playerName":"ci-test"}'
```

### 中期対策 (Architecture Improvement)

1. **Single Worker Deployment**: FrontendとBackendを統合
2. **Custom Domain**: CloudflareのCustom Domainを使用してrouting安定化
3. **Health Check Endpoint**: Deploy検証用のhealth check実装

### 長期対策 (Robust Solution)

1. **Database Integration**: 永続化によるstate管理
2. **Load Balancer**: 複数regionでのredundancy
3. **Monitoring**: Real-time error tracking and alerting

## Lessons Learned

1. **Documentation Gap**: Cloudflare Workers Static Assets APIのdocumentationが不完全
2. **Configuration Complexity**: 微妙な設定変更が大きな影響を与える
3. **Deploy Coordination**: Multi-service deploymentの複雑性
4. **Testing Strategy**: End-to-end testing の重要性
5. **Debugging Tools**: Real-time loggingとmonitoring の必要性

## 次回発生時の対応手順

1. **即座に確認**:
   ```bash
   curl https://unchartedterritory-frontend.masahiro-hibi.workers.dev/debug
   ```

2. **CI/CD Status確認**:
   - GitHub Actions の最新run status
   - Deploy job の成功/失敗確認

3. **Backend/Frontend両方テスト**:
   ```bash
   # Backend direct
   curl -X POST https://unchartedterritory.masahiro-hibi.workers.dev/api/game/new
   # Frontend proxy  
   curl -X POST https://unchartedterritory-frontend.masahiro-hibi.workers.dev/api/game/new
   ```

4. **必要に応じて再deploy**:
   ```bash
   npm run deploy:frontend
   ```

5. **10分待ってpropagation確認**

---

**作成日**: 2025-06-27  
**最終更新**: 問題解決後に更新予定  
**Status**: 🔍 調査継続中