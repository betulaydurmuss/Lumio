import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { LOCKOUT_MINUTES, MAX_FAILED_LOGINS } from '../src/routes/auth.js';
import {
  buildApp,
  Client,
  codeFor,
  PASSWORD,
  resetDatabase,
  signedInAdmin,
  signedInUser,
  uniqueEmail,
  type TestContext,
} from './helpers.js';

let ctx: TestContext;

beforeEach(async () => {
  ctx = buildApp();
  await resetDatabase(ctx.prisma);
});

function registration(email: string, overrides: object = {}) {
  return {
    accountType: 'personal',
    displayName: 'Ayşe Yılmaz',
    email,
    password: PASSWORD,
    locale: 'tr',
    ...overrides,
  };
}

describe('registration and email verification', () => {
  it('sends a Turkish verification mail and blocks sign-in until it is used', async () => {
    const client = await new Client(ctx.app).init();
    const email = uniqueEmail();

    const res = await client.post('/api/auth/register', registration(email));
    expect(res.status).toBe(202);
    expect(ctx.mailer.sent).toHaveLength(1);
    expect(ctx.mailer.sent[0]?.subject).toBe('Lumio hesabını doğrula');

    const early = await client.post('/api/auth/login', { email, password: PASSWORD });
    expect(early.status).toBe(403);
    expect(early.body.error.code).toBe('email_not_verified');

    const verified = await client.post('/api/auth/verify-email', {
      token: ctx.mailer.tokenFor(email),
    });
    expect(verified.status).toBe(200);

    const login = await client.post('/api/auth/login', { email, password: PASSWORD });
    expect(login.body).toEqual({ next: 'done' });
  });

  it('does not reveal whether an address already has an account', async () => {
    const { email } = await signedInUser(ctx);
    const before = ctx.mailer.sent.length;
    const client = await new Client(ctx.app).init();

    const res = await client.post('/api/auth/register', registration(email.toUpperCase()));

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'verification_sent' });
    expect(ctx.mailer.sent.length).toBe(before);
    expect(await ctx.prisma.user.count({ where: { email } })).toBe(1);
  });

  it('refuses throwaway email providers and short passwords', async () => {
    const client = await new Client(ctx.app).init();

    const disposable = await client.post('/api/auth/register', registration('a@mailinator.com'));
    expect(disposable.status).toBe(422);

    const short = await client.post(
      '/api/auth/register',
      registration(uniqueEmail(), { password: 'short' }),
    );
    expect(short.status).toBe(400);
  });

  it('accepts a verification link only once', async () => {
    const client = await new Client(ctx.app).init();
    const email = uniqueEmail();
    await client.post('/api/auth/register', registration(email));
    const token = ctx.mailer.tokenFor(email);

    expect((await client.post('/api/auth/verify-email', { token })).status).toBe(200);
    expect((await client.post('/api/auth/verify-email', { token })).status).toBe(400);
  });

  it('makes the person who opens a company account its admin', async () => {
    const { user } = await signedInUser(ctx, { accountType: 'company' });
    const org = await ctx.prisma.organization.findUniqueOrThrow({ where: { id: user.orgId } });

    expect(user.role).toBe('org_admin');
    expect(org.kind).toBe('company');
    expect(org.slug).toMatch(/^acme-bilisim-[0-9a-f]{6}$/);
  });
});

describe('sign-in', () => {
  it('locks the account after repeated wrong passwords, even for the right one', async () => {
    const { email, user } = await signedInUser(ctx);
    const client = await new Client(ctx.app).init();

    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      const res = await client.post('/api/auth/login', { email, password: 'wrong password!!' });
      expect(res.status).toBe(401);
    }
    const right = await client.post('/api/auth/login', { email, password: PASSWORD });
    expect(right.status).toBe(401);

    const locked = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(
      Date.now() + (LOCKOUT_MINUTES - 1) * 60_000,
    );
    expect(
      await ctx.prisma.auditLog.count({
        where: { actorId: user.id, action: 'auth.account_locked' },
      }),
    ).toBe(1);
  });

  it('gives the same answer for an unknown address and a wrong password', async () => {
    const { email } = await signedInUser(ctx);
    const client = await new Client(ctx.app).init();

    const unknown = await client.post('/api/auth/login', {
      email: uniqueEmail(),
      password: PASSWORD,
    });
    const wrong = await client.post('/api/auth/login', { email, password: 'wrong password!!' });

    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('rate limits sign-in attempts per address', async () => {
    const limited = buildApp({ authRateLimit: 3 });
    const client = await new Client(limited.app).init();
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      statuses.push(
        (await client.post('/api/auth/login', { email: uniqueEmail(), password: 'x' })).status,
      );
    }
    expect(statuses).toEqual([401, 401, 401, 429]);
  });

  it('sets httpOnly, SameSite=strict session cookies and never returns tokens in the body', async () => {
    const { email } = await signedInUser(ctx);
    const client = await new Client(ctx.app).init();
    const res = await client.post('/api/auth/login', { email, password: PASSWORD });

    const access = client.setCookie('lumio_at')!;
    const refresh = client.setCookie('lumio_rt')!;
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/SameSite=Strict/);
    expect(refresh).toMatch(/Path=\/api\/auth/);
    expect(JSON.stringify(res.body)).not.toMatch(/eyJ/);
  });
});

describe('CSRF', () => {
  it('rejects a write without the token header', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: 'x' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('csrf_failed');
  });

  it('rejects a header that does not match the cookie', async () => {
    const client = await new Client(ctx.app).init();
    const res = await client.agent
      .post('/api/auth/login')
      .set('x-csrf-token', 'forged')
      .send({ email: 'a@example.com', password: 'x' });

    expect(res.status).toBe(403);
  });
});

describe('sessions', () => {
  it('rotates the refresh token, and ends the session when an old one is replayed', async () => {
    const { client } = await signedInUser(ctx);
    const stolen = client.setCookie('lumio_rt')!.split(';')[0]!;

    const rotated = await client.post('/api/auth/refresh');
    expect(rotated.status).toBe(204);
    expect(client.setCookie('lumio_rt')!.split(';')[0]).not.toBe(stolen);

    const replay = await request(ctx.app)
      .post('/api/auth/refresh')
      .set('Cookie', [stolen, `lumio_csrf=${client.csrf}`])
      .set('x-csrf-token', client.csrf);
    expect(replay.status).toBe(401);

    // The legitimate holder is signed out too: the session itself is gone.
    expect((await client.get('/api/auth/me')).status).toBe(401);
  });

  it('ends the session on logout', async () => {
    const { client } = await signedInUser(ctx);
    expect((await client.get('/api/auth/me')).status).toBe(200);

    expect((await client.post('/api/auth/logout')).status).toBe(204);
    expect((await client.get('/api/auth/me')).status).toBe(401);
  });

  it('lists devices and revokes another one immediately', async () => {
    const { client: laptop, email } = await signedInUser(ctx);
    const phone = await new Client(ctx.app).init();
    await phone.post('/api/auth/login', { email, password: PASSWORD });

    const list = await laptop.get('/api/auth/sessions');
    expect(list.body).toHaveLength(2);
    const other = (list.body as { id: string; current: boolean }[]).find((s) => !s.current)!;

    expect((await laptop.delete(`/api/auth/sessions/${other.id}`)).status).toBe(204);
    expect((await phone.get('/api/auth/me')).status).toBe(401);
    expect((await laptop.get('/api/auth/me')).status).toBe(200);
  });
});

describe('two-factor authentication', () => {
  it('stores the TOTP seed encrypted and asks for a code at the next sign-in', async () => {
    const { client, email, user, totpSecret } = await signedInAdmin(ctx);

    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.totpSecret).not.toContain(totpSecret);

    await client.post('/api/auth/logout');
    const step1 = await client.post('/api/auth/login', { email, password: PASSWORD });
    expect(step1.body).toEqual({ next: 'totp' });
    expect((await client.get('/api/auth/me')).status).toBe(401);

    ctx.replay.clear();
    const step2 = await client.post('/api/auth/login/totp', { code: await codeFor(totpSecret) });
    expect(step2.body).toEqual({ next: 'done' });

    const me = await client.get('/api/auth/me');
    expect(me.body.mfaVerified).toBe(true);
  });

  it('refuses a wrong code and a code that was already used', async () => {
    const { client, email, totpSecret } = await signedInAdmin(ctx);
    await client.post('/api/auth/logout');
    await client.post('/api/auth/login', { email, password: PASSWORD });

    const wrong = await client.post('/api/auth/login/totp', { code: '000000' });
    expect(wrong.status).toBe(401);

    // The code that turned 2FA on was claimed then; it cannot sign in now.
    const reused = await client.post('/api/auth/login/totp', { code: await codeFor(totpSecret) });
    expect(reused.status).toBe(401);
  });

  it('keeps an admin out of the admin area until 2FA is on', async () => {
    const { client } = await signedInUser(ctx, { accountType: 'company' });

    const res = await client.get('/api/org/members');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('mfa_required');

    const me = await client.get('/api/auth/me');
    expect(me.body.twoFactorRequired).toBe(true);
  });

  it('keeps learners out of the admin area entirely', async () => {
    const { client } = await signedInUser(ctx);

    const res = await client.get('/api/org/members');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });
});
