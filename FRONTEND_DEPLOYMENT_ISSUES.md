# Frontend Deployment Issues - Troubleshooting Summary

## Problem
Frontend deployment to Cloudflare Workers consistently returns:
```
Error: KVError: could not find index.html in your content namespace. Trying to access: /
```

## Attempted Solutions

### 1. KV Namespace Configuration
- **Attempt 1**: Added explicit KV namespace binding with empty IDs
  - Result: Deployment failed - "KV namespace 'unchartedterritory_static' is not valid"
  
- **Attempt 2**: Removed KV namespace configuration entirely
  - Result: Deployment succeeded but runtime error persists

- **Attempt 3**: Re-added KV namespace with empty IDs
  - Result: Deployment failed again

- **Final**: Removed KV namespace config completely
  - Result: Deployment succeeds but runtime error remains

### 2. __STATIC_CONTENT_MANIFEST Handling
- **Attempt 1**: Made manifest optional with fallback to empty object
  - Result: No manifest available at runtime (hasManifest: false)
  
- **Attempt 2**: Import mapRequestToAsset and use proper waitUntil binding
  - Result: Still no manifest available

- **Attempt 3**: Made manifest required in interface
  - Result: Type errors due to missing manifest

- **Final**: Made manifest optional again
  - Result: No improvement

### 3. File Structure Verification
- Frontend build files exist in `frontend/dist/`
- Wrangler logs show files are uploaded:
  ```
  assets/index-CPXpEB-Q.8278441f81.css
  assets/index-_n8stNtq.39fda591c5.js
  index.794c623964.html
  vite.0de3998bc2.svg
  ```
- KV storage contains the files (verified by user-provided KV listing)

## Current Configuration

### wrangler-frontend.toml
```toml
name = "unchartedterritory-frontend"
main = "src/frontend-worker.ts"
compatibility_date = "2024-01-01"

[site]
bucket = "frontend/dist"
```

### frontend-worker.ts
- Uses `@cloudflare/kv-asset-handler`
- Attempts to serve assets with getAssetFromKV
- Falls back to index.html for SPA routing
- Has debug endpoint at `/debug`

## Root Cause Analysis

The issue appears to be a mismatch between:
1. How Workers Sites stores assets in KV (with hashed filenames)
2. How getAssetFromKV expects to find them
3. The missing __STATIC_CONTENT_MANIFEST which should map URLs to KV keys

Workers Sites automatically:
- Uploads files with content hashes (e.g., `index.794c623964.html`)
- Should provide __STATIC_CONTENT_MANIFEST to map `/index.html` → `index.794c623964.html`
- But the manifest is not being injected into our custom worker

## Potential Solutions

### Option 1: Use Wrangler-Generated Workers Site
Instead of custom worker, use the default Workers Site template:
```bash
wrangler generate --site my-site
```

### Option 2: Direct KV Access
Skip Workers Sites and manually handle KV:
```typescript
const asset = await env.__STATIC_CONTENT.get('index.794c623964.html');
```

### Option 3: Use Cloudflare Pages
Better suited for SPAs with automatic asset handling:
```bash
npm run build
wrangler pages deploy frontend/dist
```

### Option 4: Fix Current Setup
Find the correct way to access __STATIC_CONTENT_MANIFEST in a custom worker with Workers Sites.

## Recommended Next Steps

1. **Immediate**: Try Cloudflare Pages instead of Workers Sites
2. **Alternative**: Use direct KV access with a simple mapping
3. **Investigation**: Check if we need to import/generate the manifest differently