import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const valid = {
  WEB_ORIGIN: 'http://localhost:5174',
  COOKIE_SECRET: 'a'.repeat(32),
  ACCESS_TOKEN_SECRET: 'b'.repeat(32),
  ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  DATABASE_URL: 'postgresql://lumio:lumio@localhost:5433/lumio',
  REDIS_URL: 'redis://localhost:6380',
};

describe('loadConfig', () => {
  it('applies defaults to a minimal environment', () => {
    const config = loadConfig(valid);

    expect(config.API_PORT).toBe(4001);
    expect(config.NODE_ENV).toBe('development');
  });

  it('refuses a short cookie secret', () => {
    expect(() => loadConfig({ ...valid, COOKIE_SECRET: 'short' })).toThrow(/COOKIE_SECRET/);
  });

  it('refuses an encryption key that is not 32 bytes', () => {
    const shortKey = Buffer.alloc(16).toString('base64');
    expect(() => loadConfig({ ...valid, ENCRYPTION_KEY: shortKey })).toThrow(/ENCRYPTION_KEY/);
  });

  it('lists every missing variable at once', () => {
    expect(() => loadConfig({})).toThrow(/WEB_ORIGIN[\s\S]*ACCESS_TOKEN_SECRET[\s\S]*DATABASE_URL/);
  });
});
