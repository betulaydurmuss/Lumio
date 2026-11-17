import { Writable } from 'node:stream';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createLogger, redactUrl } from '../src/logger.js';
import { buildServices, FakeMailer, MemoryReplayGuard, testPrisma } from './helpers.js';

function capturingApp() {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });
  const app = createApp({
    logger: createLogger('info', sink),
    cookieSecret: 'c'.repeat(40),
    version: 'test',
    checks: { database: async () => true, redis: async () => true },
    services: buildServices(testPrisma(), new FakeMailer(), new MemoryReplayGuard()),
  });
  return { app, lines };
}

describe('request logs', () => {
  it('never contain a media link token or a certificate verification code', async () => {
    const { app, lines } = capturingApp();
    const token = 'eyJrIjoiZGVtby9sZXNzb24ubXA0In0.SIGNATURE-VALUE-123';
    await request(app).get(`/api/media/${token}`);
    await request(app).get('/api/certificates/LMS-2026-000001?k=SECRET-CODE-456&locale=en');

    const log = lines.join('\n');
    expect(log).toContain('/api/media/');
    expect(log).toContain('LMS-2026-000001');
    expect(log).not.toContain('SIGNATURE-VALUE-123');
    expect(log).not.toContain('eyJrIjoiZGVtby9sZXNzb24ubXA0In0');
    expect(log).not.toContain('SECRET-CODE-456');
  });
});

describe('redactUrl', () => {
  it('keeps the route readable and drops the secrets', () => {
    expect(redactUrl('/api/media/abc.def')).toBe('/api/media/[redacted]');
    expect(redactUrl('/api/certificates/LMS-2026-000001/certificate.pdf?k=x&w=800')).toBe(
      '/api/certificates/LMS-2026-000001/certificate.pdf?k=[redacted]&w=800',
    );
    expect(redactUrl('/api/catalog/courses?q=kvkk')).toBe('/api/catalog/courses?q=kvkk');
  });
});
