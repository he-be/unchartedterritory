import { describe, test, expect } from 'vitest';

describe('Cloudflare Workers', () => {
  test('should handle root path', async () => {
    const worker = await import('../worker');
    const request = new Request('https://example.com/');
    const response = await worker.default.fetch(request);
    
    expect(response.status).toBe(200);
    const json = await response.json() as { message: string };
    expect(json.message).toBe('Hello World!');
  });

  test('should handle health check', async () => {
    const worker = await import('../worker');
    const request = new Request('https://example.com/health');
    const response = await worker.default.fetch(request);
    
    expect(response.status).toBe(200);
    const json = await response.json() as { status: string };
    expect(json.status).toBe('OK');
  });
});
