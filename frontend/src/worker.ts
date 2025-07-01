import { Hono } from 'hono';

interface Env {
  ASSETS: Fetcher;
  BACKEND: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'frontend', timestamp: Date.now() });
});

// Proxy all /api/* requests to backend worker
app.all('/api/*', async (c) => {
  try {
    console.log(`Proxying ${c.req.method} ${c.req.url} to backend`);
    
    // Check if BACKEND binding exists
    if (!c.env.BACKEND) {
      console.error('BACKEND service binding not found');
      return c.json({ 
        error: 'Backend service unavailable',
        details: 'BACKEND service binding not configured'
      }, 503);
    }
    
    // Forward request to backend worker using Service Binding
    const response = await c.env.BACKEND.fetch(c.req.raw);
    
    // Log response status for debugging
    console.log(`Backend responded with status: ${response.status}`);
    
    return response;
  } catch (error) {
    console.error('Error proxying to backend:', error);
    return c.json({ 
      error: 'Backend service unavailable',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 503);
  }
});

// Serve static assets for all other requests
app.all('*', async (c) => {
  try {
    // Serve static assets using the ASSETS binding
    const response = await c.env.ASSETS.fetch(c.req.raw);
    return response;
  } catch (error) {
    console.error('Error serving assets:', error);
    return new Response('Asset not found', { status: 404 });
  }
});

export default app;