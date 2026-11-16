import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import nodemailer from 'nodemailer';
import { pino } from 'pino';
import { loadConfig } from './config.js';
import { MAIL_QUEUE } from '@lumio/shared';
import { sendMail } from './mail.js';

const config = loadConfig();
const logger = pino({ level: config.LOG_LEVEL });
const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

const transport = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  ...(config.SMTP_USER && config.SMTP_PASSWORD
    ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } }
    : {}),
});

const mailWorker = new Worker(
  MAIL_QUEUE,
  (job) => sendMail(transport, config.MAIL_FROM, job.data),
  {
    connection,
    concurrency: 5,
  },
);

mailWorker.on('completed', (job) => logger.info({ queue: MAIL_QUEUE, jobId: job.id }, 'sent'));
mailWorker.on('failed', (job, err) =>
  logger.error({ queue: MAIL_QUEUE, jobId: job?.id, err }, 'failed'),
);

logger.info({ queues: [MAIL_QUEUE] }, 'worker started');

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  await mailWorker.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
