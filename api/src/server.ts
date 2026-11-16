import { MAIL_QUEUE, type MailJob } from '@lumio/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { readFileSync } from 'node:fs';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPrisma } from './db.js';
import { createLogger } from './logger.js';
import { TokenService } from './security/tokens.js';

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const prisma = createPrisma(config.DATABASE_URL);
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const mailQueue = new Queue<MailJob>(MAIL_QUEUE, { connection: redis });

// src/ and dist/ both sit next to the package manifest.
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

const app = createApp({
  logger,
  cookieSecret: config.COOKIE_SECRET,
  version,
  services: {
    prisma,
    tokens: new TokenService(config.ACCESS_TOKEN_SECRET),
    encryptionKey: Buffer.from(config.ENCRYPTION_KEY, 'base64'),
    webOrigin: config.WEB_ORIGIN,
    secureCookies: config.NODE_ENV === 'production',
    mailer: {
      async send(job) {
        await mailQueue.add('send', job, {
          attempts: 5,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        });
      },
    },
    replay: {
      async claim(key, ttlSeconds) {
        return (await redis.set(`replay:${key}`, '1', 'EX', ttlSeconds, 'NX')) === 'OK';
      },
    },
  },
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
  await Promise.allSettled([mailQueue.close(), prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
