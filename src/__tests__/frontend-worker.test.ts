import { describe, test, expect, beforeEach, vi } from 'vitest';
import worker from '../frontend-worker';

describe('Frontend Worker', () => {
  const mockEnv = {
    ASSETS: {
      fetch: vi.fn()
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should handle debug endpoint', async () => {
    const request = new Request('https://example.com/debug');
    
    const response = await worker.fetch(request, mockEnv);
    
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.envKeys).toEqual(['ASSETS']);
    expect(json.hasAssets).toBe(true);
    expect(json.pathname).toBe('/debug');
    expect(json.message).toBe('Debug endpoint working');
  });

  test('should proxy API requests to backend', async () => {
    const request = new Request('https://example.com/api/game/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'test' })
    });

    // Mock fetch to simulate backend response
    const mockBackendResponse = new Response(JSON.stringify({
      id: 'game_123',
      player: { name: 'test' }
    }));
    
    global.fetch = vi.fn().mockResolvedValue(mockBackendResponse);
    
    const response = await worker.fetch(request, mockEnv);
    
    expect(global.fetch).toHaveBeenCalledWith(
      'https://unchartedterritory.masahiro-hibi.workers.dev/api/game/new',
      expect.objectContaining({
        method: 'POST'
      })
    );
    
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.id).toBe('game_123');
  });

  test('should serve static assets for non-API requests', async () => {
    const request = new Request('https://example.com/index.html');
    const mockAssetResponse = new Response('<!DOCTYPE html><html></html>');
    
    mockEnv.ASSETS.fetch.mockResolvedValue(mockAssetResponse);
    
    const response = await worker.fetch(request, mockEnv);
    
    expect(mockEnv.ASSETS.fetch).toHaveBeenCalledWith(request);
    expect(response).toBe(mockAssetResponse);
  });
});