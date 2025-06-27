// Frontend Worker - Serves React app and proxies API calls

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API requests - proxy to backend worker
    if (url.pathname.startsWith('/api/')) {
      // For debugging: First return a test response
      if (url.pathname === '/api/game/new') {
        return new Response(JSON.stringify({
          debug: 'API request received in worker',
          pathname: url.pathname,
          method: request.method,
          timestamp: new Date().toISOString(),
          message: 'Worker is processing API requests correctly'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Proxy other API requests to backend
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