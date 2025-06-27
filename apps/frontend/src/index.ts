// Frontend Worker - Serves React app and proxies API calls via Service Bindings

interface Env {
  API_BACKEND: { fetch: typeof fetch };
  ASSETS: { fetch: typeof fetch };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API requests - proxy to backend worker via Service Binding
    if (url.pathname.startsWith('/api/')) {
      // Service Binding provides zero-latency internal communication
      return env.API_BACKEND.fetch(request);
    }
    
    // Handle health check for frontend
    if (url.pathname === '/health-frontend') {
      return new Response(JSON.stringify({
        status: 'OK',
        service: 'Uncharted Territory Frontend',
        hasBackendBinding: !!env.API_BACKEND,
        hasAssetsBinding: !!env.ASSETS,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Debug endpoint for development
    if (url.pathname === '/debug') {
      return new Response(JSON.stringify({
        envKeys: Object.keys(env),
        hasAssets: !!env.ASSETS,
        hasBackend: !!env.API_BACKEND,
        url: url.toString(),
        pathname: url.pathname,
        message: 'Frontend Worker Debug Info'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Serve static assets (React app)
    return env.ASSETS.fetch(request);
  },
};