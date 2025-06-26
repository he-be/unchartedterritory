// Frontend Worker - Serves React app and proxies API calls
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
}

interface Env {
  __STATIC_CONTENT: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API requests - proxy to backend worker
    if (url.pathname.startsWith('/api/')) {
      // Replace with your actual backend worker URL
      const backendUrl = 'https://unchartedterritory.masahiro-hibi.workers.dev/' + url.pathname + url.search;
      
      return fetch(backendUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }
    
    try {
      // Serve static assets
      return await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: {},
        }
      );
    } catch (e) {
      // If asset not found, return index.html for SPA routing
      try {
        const indexRequest = new Request(`${url.origin}/index.html`, {
          method: request.method,
          headers: request.headers,
        });
        
        return await getAssetFromKV(
          {
            request: indexRequest,
            waitUntil: ctx.waitUntil.bind(ctx),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: {},
          }
        );
      } catch (e) {
        return new Response('Not Found', { status: 404 });
      }
    }
  },
};