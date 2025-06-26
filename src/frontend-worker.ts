// Frontend Worker - Serves React app and proxies API calls
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Env {
  __STATIC_CONTENT: any;
}

export default {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API requests - proxy to backend worker
    if (url.pathname.startsWith('/api/')) {
      // Replace with your actual backend worker URL
      const backendUrl = 'https://unchartedterritory.masahiro-hibi.workers.dev' + url.pathname + url.search;
      
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
      console.log('Asset not found, serving index.html for SPA routing:', e);
      // If asset not found, return index.html for SPA routing
      try {
        const indexRequest = new Request(`${url.origin}/index.html`, {
          method: 'GET',
          headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
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
        console.log('Failed to serve index.html:', e);
        return new Response(`Debug: Failed to serve assets. Error: ${String(e)}. Env keys: ${Object.keys(env)}`, { status: 500 });
      }
    }
  },
};