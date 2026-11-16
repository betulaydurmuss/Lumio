import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/logger.js';
import { buildServices, FakeMailer, MemoryReplayGuard, testPrisma } from './helpers.js';

const up = async () => true;

function appWith(database: () => Promise<boolean>, redis: () => Promise<boolean>) {
  return createApp({
    logger: createLogger('silent'),
    cookieSecret: 'x'.repeat(32),
    version: 'test',
    checks: { database, redis },
    services: buildServices(testPrisma(), new FakeMailer(), new MemoryReplayGuard()),
  });
}

describe('GET /api/health', () => {
  it('reports ok when every dependency answers', async () => {
    const res = await request(appWith(up, up)).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks).toEqual({ database: 'up', redis: 'up' });
  });

  it('reports degraded with 503 when a dependency fails', async () => {
    const down = async (): Promise<boolean> => {
      throw new Error('connection refused');
    };
    const res = await request(appWith(down, up)).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database).toBe('down');
  });

  it('sends security headers and a request id', async () => {
    const res = await request(appWith(up, up)).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('only allows the web origin', async () => {
    const res = await request(appWith(up, up))
      .get('/api/health')
      .set('Origin', 'https://evil.example');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5174');
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await request(appWith(up, up)).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
