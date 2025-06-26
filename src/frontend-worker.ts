// Frontend Worker - Serves React app and proxies API calls using Static Assets

// Static Assets binding type
interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API requests - proxy to backend worker
    if (url.pathname.startsWith('/api/')) {
      const backendUrl = 'https://unchartedterritory.masahiro-hibi.workers.dev' + url.pathname + url.search;
      
      try {
        const response = await fetch(backendUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });
        return response;
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Proxy failed',
          message: error.message,
          backendUrl: backendUrl,
          originalUrl: url.toString(),
          method: request.method
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Debug info
    if (url.pathname === '/debug') {
      return new Response(JSON.stringify({
        envKeys: Object.keys(env),
        hasAssets: !!env.ASSETS,
        url: url.toString(),
        pathname: url.pathname,
        method: request.method,
        isApiPath: url.pathname.startsWith('/api/'),
        message: 'Using new Static Assets API'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Serve static assets using the new Static Assets API
    // The SPA routing is handled automatically by not_found_handling = "single-page-application"
    return env.ASSETS.fetch(request);
  },
};