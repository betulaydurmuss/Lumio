import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const valid = {
  WEB_ORIGIN: 'http://localhost:5173',
  COOKIE_SECRET: 'a'.repeat(32),
  DATABASE_URL: 'postgresql://lumio:lumio@localhost:5432/lumio',
  REDIS_URL: 'redis://localhost:6379',
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

  it('lists every missing variable at once', () => {
    expect(() => loadConfig({})).toThrow(/WEB_ORIGIN[\s\S]*DATABASE_URL/);
  });
});
