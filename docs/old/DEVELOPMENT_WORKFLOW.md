# 🚀 Enhanced Development Workflow for Cloudflare Workers

## 🔄 CI/CD Improvements

### PR Preview Deployments
Every Pull Request now automatically deploys to staging environments:

- **Backend Preview**: `https://unchartedterritory-pr-{PR_NUMBER}.masahiro-hibi.workers.dev`
- **Frontend Preview**: `https://unchartedterritory-frontend-pr-{PR_NUMBER}.masahiro-hibi.workers.dev`

### Benefits
- ✅ **Fast Debugging**: Test Workers-specific issues immediately
- ✅ **Real Environment**: Deploy to actual Cloudflare infrastructure
- ✅ **Isolated Testing**: Each PR gets unique URLs
- ✅ **Automated Cleanup**: Preview environments auto-managed

## 🛠️ Local Development

### Full Local Stack
```bash
# Run all services locally
npm run dev:local

# Services will start on:
# - Backend Worker: http://localhost:8787
# - Frontend Worker: http://localhost:8788  
# - React Frontend: http://localhost:5173
```

### Individual Services
```bash
# Backend Worker only
npm run dev:worker

# Frontend Worker only  
npm run dev:frontend-worker

# React frontend only
npm run dev:frontend
```

## 🧪 Testing Strategy

### 1. Local Testing (Fastest)
```bash
npm run dev:local
# Test on localhost with wrangler dev
```

### 2. PR Preview (Real Environment)
1. Create PR
2. Wait for CI/CD to deploy preview
3. Test on preview URLs
4. Iterate quickly

### 3. Production Deployment
- Only after PR approval and merge to main

## 📋 Debug Workflow

### When You Find a Bug:

#### 1. Reproduce Locally
```bash
npm run dev:local
# Check if issue exists in local wrangler dev
```

#### 2. Create Test Branch
```bash
git checkout -b bugfix/issue-description
# Make your changes
git push origin bugfix/issue-description
```

#### 3. Test on Preview
- PR auto-deploys to staging
- Test real Cloudflare environment
- Debug with actual Workers runtime

#### 4. Iterate Quickly
- Push changes to branch
- Preview environment updates automatically
- No need to wait for main branch merge

## 🔧 Debug Tools

### Environment Endpoints
```bash
# Production
curl https://unchartedterritory.masahiro-hibi.workers.dev/debug

# PR Preview (replace {PR_NUMBER})
curl https://unchartedterritory-pr-{PR_NUMBER}.masahiro-hibi.workers.dev/debug
```

### Logs and Monitoring
```bash
# Real-time logs for development
wrangler tail

# Logs for specific deployment
wrangler tail --name unchartedterritory-pr-123
```

### Health Checks
Each deployment includes health check endpoints:
- `/api/health` - Backend health
- `/debug` - Environment info
- `/api/game/new` - API functionality test

## 🧹 Maintenance

### Cleanup Preview Environments
```bash
node scripts/cleanup-preview.js
# Removes deployments for closed PRs
```

### Manual Cleanup
```bash
# List all deployments
wrangler deployments list

# Delete specific preview
wrangler delete unchartedterritory-pr-123
```

## 📊 Performance Benefits

| Old Workflow | New Workflow |
|--------------|--------------|
| 🐌 Main branch only | ⚡ Every PR gets preview |
| 🔍 Debug in production | 🧪 Debug in staging |
| ⏳ Slow feedback loop | 🚀 Instant feedback |
| 💥 Break main branch | 🛡️ Safe testing |

## 🎯 Next Steps

1. **Use PR previews** for all feature development
2. **Test locally first** with `npm run dev:local`
3. **Debug in staging** before production
4. **Clean up** preview environments regularly

This workflow dramatically improves development speed and reduces production issues! 🎉