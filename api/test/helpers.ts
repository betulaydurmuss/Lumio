import type { MailJob } from '@lumio/shared';
import type { Express } from 'express';
import { fileURLToPath } from 'node:url';
import { generate } from 'otplib';
import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrisma, type PrismaClient } from '../src/db.js';
import { createLogger } from '../src/logger.js';
import { MediaSigner } from '../src/media/signer.js';
import { LocalMediaStore } from '../src/media/store.js';
import { TokenService } from '../src/security/tokens.js';
import type { Services } from '../src/services.js';
import { testDatabaseUrl } from './setup/database.js';

export const PASSWORD = 'correct horse battery staple';

export class FakeMailer {
  readonly sent: MailJob[] = [];
  async send(job: MailJob) {
    this.sent.push(job);
  }
  /** The verification token from the last mail sent to this address. */
  tokenFor(email: string): string {
    const mail = [...this.sent].reverse().find((job) => job.to === email);
    const token = mail?.text.match(/token=([^\s]+)/)?.[1];
    if (!token) throw new Error(`No verification mail for ${email}`);
    return decodeURIComponent(token);
  }
}

export class MemoryReplayGuard {
  private readonly seen = new Set<string>();
  async claim(key: string) {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
  clear() {
    this.seen.clear();
  }
}

export interface TestContext {
  app: Express;
  prisma: PrismaClient;
  mailer: FakeMailer;
  replay: MemoryReplayGuard;
}

let shared: PrismaClient | undefined;

export function testPrisma(): PrismaClient {
  shared ??= createPrisma(testDatabaseUrl);
  return shared;
}

export function buildServices(prisma: PrismaClient, mailer: FakeMailer, replay: MemoryReplayGuard) {
  const services: Services = {
    prisma,
    tokens: new TokenService('t'.repeat(40)),
    mailer,
    replay,
    encryptionKey: Buffer.alloc(32, 7),
    webOrigin: 'http://localhost:5174',
    secureCookies: false,
    media: {
      store: new LocalMediaStore(fileURLToPath(new URL('../media', import.meta.url))),
      signer: new MediaSigner('m'.repeat(40)),
    },
  };
  return services;
}

export function buildApp(options: { authRateLimit?: number } = {}): TestContext {
  const prisma = testPrisma();
  const mailer = new FakeMailer();
  const replay = new MemoryReplayGuard();
  const app = createApp({
    logger: createLogger('silent'),
    cookieSecret: 'c'.repeat(40),
    version: 'test',
    checks: { database: async () => true, redis: async () => true },
    services: buildServices(prisma, mailer, replay),
    auth: { rateLimit: options.authRateLimit ?? 10_000 },
  });
  return { app, prisma, mailer, replay };
}

export async function resetDatabase(prisma: PrismaClient) {
  // TRUNCATE skips row triggers, so the append-only audit table can be cleared between tests.
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE audit_logs, email_verifications, sessions, lesson_progress, enrollments, wishlist_items, search_terms',
  );
  // Users and organizations are deleted rather than truncated with CASCADE, which
  // would follow instructors.user_id into the catalog and wipe the seeded courses.
  await prisma.$executeRawUnsafe('DELETE FROM users');
  await prisma.$executeRawUnsafe('DELETE FROM organizations');
}

function cookieValue(setCookie: string[] | string | undefined, name: string) {
  for (const line of [setCookie ?? []].flat()) {
    const match = new RegExp(`^${name}=([^;]*)`).exec(line);
    if (match) return match[1];
  }
  return undefined;
}

/** A browser stand-in: keeps cookies and echoes the CSRF token like the web client does. */
export class Client {
  readonly agent: ReturnType<typeof request.agent>;
  csrf = '';
  lastSetCookie: string[] = [];

  constructor(app: Express) {
    this.agent = request.agent(app);
  }

  private capture(res: request.Response) {
    const header = res.headers['set-cookie'] as unknown as string[] | undefined;
    this.lastSetCookie = header ?? [];
    const csrf = cookieValue(header, 'lumio_csrf');
    if (csrf) this.csrf = csrf;
    return res;
  }

  async init() {
    this.capture(await this.agent.get('/api/auth/csrf'));
    return this;
  }

  async get(url: string) {
    return this.capture(await this.agent.get(url));
  }

  async post(url: string, body: object = {}) {
    return this.capture(await this.agent.post(url).set('x-csrf-token', this.csrf).send(body));
  }

  async delete(url: string) {
    return this.capture(await this.agent.delete(url).set('x-csrf-token', this.csrf));
  }

  setCookie(name: string) {
    return this.lastSetCookie.find((line) => line.startsWith(`${name}=`));
  }
}

let counter = 0;
export function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@example.com`;
}

interface AccountOptions {
  accountType?: 'personal' | 'company';
  organizationName?: string;
  email?: string;
}

/** Registers, verifies and signs in. Returns a signed-in client. */
export async function signedInUser(ctx: TestContext, options: AccountOptions = {}) {
  const email = options.email ?? uniqueEmail();
  const client = await new Client(ctx.app).init();
  const accountType = options.accountType ?? 'personal';
  const registered = await client.post('/api/auth/register', {
    accountType,
    ...(accountType === 'company'
      ? { organizationName: options.organizationName ?? 'Acme Bilişim' }
      : {}),
    displayName: 'Test User',
    email,
    password: PASSWORD,
    locale: 'en',
  });
  expect(registered.status).toBe(202);
  const verified = await client.post('/api/auth/verify-email', {
    token: ctx.mailer.tokenFor(email),
  });
  expect(verified.status).toBe(200);
  const login = await client.post('/api/auth/login', { email, password: PASSWORD });
  expect(login.status).toBe(200);
  const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
  return { client, email, user };
}

export async function codeFor(secret: string) {
  return generate({ secret });
}

/** A company admin who has turned on 2FA, with a session that passed it. */
export async function signedInAdmin(ctx: TestContext, organizationName = 'Acme Bilişim') {
  const account = await signedInUser(ctx, { accountType: 'company', organizationName });
  const setup = await account.client.post('/api/auth/totp/setup');
  expect(setup.status).toBe(200);
  const enabled = await account.client.post('/api/auth/totp/enable', {
    code: await codeFor(setup.body.secret as string),
  });
  expect(enabled.status).toBe(200);
  return { ...account, totpSecret: setup.body.secret as string };
}
