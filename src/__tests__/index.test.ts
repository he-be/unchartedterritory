import { describe, test, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index';

describe('Express App', () => {
  test('GET / should return hello message', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Hello World!');
    expect(response.body.timestamp).toBeDefined();
  });

  test('GET /health should return status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
    expect(response.body.uptime).toBeDefined();
  });
});
