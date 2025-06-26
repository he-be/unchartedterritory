// Frontend Worker - Serves React app and proxies API calls
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Env {
  __STATIC_CONTENT: any;
  __STATIC_CONTENT_MANIFEST?: string;
}

export default {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
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
    
    // Debug info
    if (url.pathname === '/debug') {
      return new Response(JSON.stringify({
        envKeys: Object.keys(env),
        hasStaticContent: !!env.__STATIC_CONTENT,
        hasManifest: !!env.__STATIC_CONTENT_MANIFEST,
        url: url.toString(),
        pathname: url.pathname
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    try {
      // Serve static assets
      const assetManifest = env.__STATIC_CONTENT_MANIFEST ? JSON.parse(env.__STATIC_CONTENT_MANIFEST) : {};
      
      return await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
    } catch (e) {
      // If asset not found, return index.html for SPA routing
      try {
        const indexRequest = new Request(`${url.origin}/index.html`, {
          method: 'GET',
        });
        
        const assetManifest = env.__STATIC_CONTENT_MANIFEST ? JSON.parse(env.__STATIC_CONTENT_MANIFEST) : {};
        
        return await getAssetFromKV(
          {
            request: indexRequest,
            waitUntil: ctx.waitUntil.bind(ctx),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: assetManifest,
          }
        );
      } catch (e) {
        return new Response(`Debug: Failed to serve assets. Error: ${String(e)}. Env keys: ${Object.keys(env)}. Has static content: ${!!env.__STATIC_CONTENT}`, { 
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }
  },
};