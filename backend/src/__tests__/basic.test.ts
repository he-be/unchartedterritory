import { describe, it, expect } from 'vitest';
// @ts-expect-error - cloudflare:test module types not available
import { SELF } from 'cloudflare:test';

describe('Backend Worker', () => {
  it('should respond to health check', async () => {
    const response = await SELF.fetch('http://localhost/health');
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  it('should handle CORS preflight', async () => {
    const response = await SELF.fetch('http://localhost/api/game/new', {
      method: 'OPTIONS',
    });
    
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should return 404 for unknown routes', async () => {
    const response = await SELF.fetch('http://localhost/unknown');
    expect(response.status).toBe(404);
  });
});