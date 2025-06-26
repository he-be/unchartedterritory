// Frontend Worker - Serves React app and proxies API calls
import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler';

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
        manifestSample: env.__STATIC_CONTENT_MANIFEST ? env.__STATIC_CONTENT_MANIFEST.substring(0, 200) : 'none',
        url: url.toString(),
        pathname: url.pathname
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    try {
      // Serve static assets
      const manifest = env.__STATIC_CONTENT_MANIFEST ? JSON.parse(env.__STATIC_CONTENT_MANIFEST) : {};
      
      return await getAssetFromKV(
        {
          request,
          waitUntil(promise) {
            return ctx.waitUntil(promise);
          },
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: manifest,
          mapRequestToAsset: mapRequestToAsset,
        }
      );
    } catch (e) {
      // If asset not found, return index.html for SPA routing
      try {
        const indexRequest = new Request(`${url.origin}/index.html`, request);
        const manifest = env.__STATIC_CONTENT_MANIFEST ? JSON.parse(env.__STATIC_CONTENT_MANIFEST) : {};
        
        return await getAssetFromKV(
          {
            request: indexRequest,
            waitUntil(promise) {
              return ctx.waitUntil(promise);
            },
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: manifest,
          }
        );
      } catch (e) {
        return new Response(`Error: ${String(e)}. Trying to access: ${url.pathname}`, { 
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }
  },
};