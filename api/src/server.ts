import { Redis } from 'ioredis';
import { readFileSync } from 'node:fs';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPrisma } from './db.js';
import { createLogger } from './logger.js';

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const prisma = createPrisma(config.DATABASE_URL);
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

// src/ and dist/ both sit next to the package manifest.
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

const app = createApp({
  logger,
  webOrigin: config.WEB_ORIGIN,
  cookieSecret: config.COOKIE_SECRET,
  version,
  checks: {
    database: async () => {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    },
    redis: async () => (await redis.ping()) === 'PONG',
  },
});

const server = app.listen(config.API_PORT, () => {
  logger.info({ port: config.API_PORT }, 'api listening');
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
