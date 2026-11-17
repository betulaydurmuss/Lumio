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
  it('refuses line breaks and control characters in names', async () => {
    const client = await new Client(ctx.app).init();
    const res = await client.post(
      '/api/auth/register',
      registration(uniqueEmail(), {
        accountType: 'company',
        organizationName: 'Acme\r\nBcc: victim@example.com',
      }),
    );
    expect(res.status).toBe(400);

    const name = await client.post(
      '/api/auth/register',
      registration(uniqueEmail(), { displayName: 'Ayşe\u0000Yılmaz' }),
    );
    expect(name.status).toBe(400);
    expect(ctx.mailer.sent).toHaveLength(0);
  });

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
      password: PASSWORD,
    });
    expect(verified.status).toBe(200);

    const login = await client.post('/api/auth/login', { email, password: PASSWORD });
    expect(login.body).toEqual({ next: 'done' });
  });

  it('does not repeat the name typed at sign-up in the verification mail', async () => {
    // The mail goes to an address nobody has proved yet, so it carries none of
    // the registrant's own words.
    const client = await new Client(ctx.app).init();
    const email = uniqueEmail();
    await client.post(
      '/api/auth/register',
      registration(email, { displayName: 'Your account is suspended visit evil example' }),
    );

    const mail = ctx.mailer.sent.at(-1)!;
    expect(mail.text).not.toContain('suspended');
    expect(mail.html).not.toContain('suspended');
  });

  it('only verifies an address for the person who chose its password', async () => {
    // A stranger signs up with someone else's address. The owner gets the mail
    // and opens it, but cannot activate an account whose password they never set.
    const email = uniqueEmail('owner');
    const stranger = await new Client(ctx.app).init();
    await stranger.post('/api/auth/register', registration(email, { password: OTHER_PASSWORD }));
    const token = ctx.mailer.tokenFor(email);

    const owner = await new Client(ctx.app).init();
    expect((await owner.post('/api/auth/verify-email', { token })).status).toBe(400);
    const wrong = await owner.post('/api/auth/verify-email', { token, password: PASSWORD });
    expect(wrong.status).toBe(401);

    const row = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(row.emailVerifiedAt).toBeNull();
    const login = await stranger.post('/api/auth/login', { email, password: OTHER_PASSWORD });
    expect(login.body.error.code).toBe('email_not_verified');
  });

  it('lets the owner sign up over a sign-up that is still waiting for verification', async () => {
    const email = uniqueEmail('owner');
    const stranger = await new Client(ctx.app).init();
    await stranger.post('/api/auth/register', registration(email, { password: OTHER_PASSWORD }));

    const owner = await new Client(ctx.app).init();
    await owner.post('/api/auth/register', registration(email));
    const verified = await owner.post('/api/auth/verify-email', {
      token: ctx.mailer.tokenFor(email),
      password: PASSWORD,
    });
    expect(verified.status).toBe(200);

    expect((await owner.post('/api/auth/login', { email, password: PASSWORD })).status).toBe(200);
    const late = await new Client(ctx.app).init();
    expect((await late.post('/api/auth/login', { email, password: OTHER_PASSWORD })).status).toBe(
      401,
    );
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

    const body = { token, password: PASSWORD };
    expect((await client.post('/api/auth/verify-email', body)).status).toBe(200);
    expect((await client.post('/api/auth/verify-email', body)).status).toBe(400);
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

  it('counts every wrong password sent at the same moment', async () => {
    // Twenty guesses fired together must not all read the same old count and
    // so add up to a single failure.
    const { email, user } = await signedInUser(ctx);
    const clients = await Promise.all(Array.from({ length: 20 }, () => new Client(ctx.app).init()));

    await Promise.all(
      clients.map((client) =>
        client.post('/api/auth/login', { email, password: 'wrong password!!' }),
      ),
    );

    const after = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.lockedUntil).not.toBeNull();
    const fresh = await new Client(ctx.app).init();
    expect((await fresh.post('/api/auth/login', { email, password: PASSWORD })).status).toBe(401);
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

  it('rate limits token refreshes', async () => {
    const limited = buildApp({ authRateLimit: 3 });
    const client = await new Client(limited.app).init();
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await client.post('/api/auth/refresh')).status);
    expect(statuses).toEqual([401, 401, 401, 429]);
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

describe('behind proxies', () => {
  // supertest connects from 127.0.0.1, which stands for the nearest proxy.
  const signInFrom = async (hops: number) => {
    const app = buildApp({ trustProxyHops: hops });
    const { email, user } = await signedInUser(app);
    const client = await new Client(app.app).init();
    await client.agent
      .post('/api/auth/login')
      .set('x-csrf-token', client.csrf)
      .set('X-Forwarded-For', '198.51.100.7, 10.0.0.2')
      .send({ email, password: 'wrong password!!' });
    const entry = await app.prisma.auditLog.findFirstOrThrow({
      where: { actorId: user.id, action: 'auth.login_failed' },
    });
    return entry.ipAddress;
  };

  it('reads the client address one hop back behind nginx alone', async () => {
    expect(await signInFrom(1)).toBe('10.0.0.2');
  });

  it('reads it two hops back with a TLS proxy in front of nginx', async () => {
    expect(await signInFrom(2)).toBe('198.51.100.7');
  });
});

describe('bad requests', () => {
  it("answers broken or oversized JSON as the client's mistake, not the server's", async () => {
    const client = await new Client(ctx.app).init();
    const broken = await client.agent
      .post('/api/auth/login')
      .set('x-csrf-token', client.csrf)
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(broken.status).toBe(400);
    expect(broken.body.error.code).toBe('invalid_json');

    const huge = await client.agent
      .post('/api/auth/login')
      .set('x-csrf-token', client.csrf)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@example.com', password: 'x'.repeat(2_000_000) }));
    expect(huge.status).toBe(413);
    expect(huge.body.error.code).toBe('too_large');
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

  it('rotates a refresh token once, however many requests present it together', async () => {
    // A copied refresh cookie used at the same moment as the real one must not
    // come away with a working session of its own.
    const { client } = await signedInUser(ctx);
    const cookie = client.setCookie('lumio_rt')!.split(';')[0]!;
    const refresh = () =>
      request(ctx.app)
        .post('/api/auth/refresh')
        .set('Cookie', [cookie, `lumio_csrf=${client.csrf}`])
        .set('x-csrf-token', client.csrf);

    const results = await Promise.all(Array.from({ length: 20 }, refresh));
    expect(results.filter((res) => res.status === 204).length).toBeLessThanOrEqual(1);
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

/** Registers an address with a password, without verifying it. */
async function register(email: string, password: string, displayName = 'Someone Else') {
  const client = await new Client(ctx.app).init();
  const res = await client.post('/api/auth/register', {
    accountType: 'personal',
    displayName,
    email,
    password,
    locale: 'en',
  });
  expect(res.status).toBe(202);
  return client;
}

async function resetPassword(email: string, password: string) {
  const client = await new Client(ctx.app).init();
  expect((await client.post('/api/auth/password/forgot', { email })).status).toBe(202);
  return client.post('/api/auth/password/reset', { token: ctx.mailer.tokenFor(email), password });
}

const OTHER_PASSWORD = 'an entirely different passphrase';

describe('getting an account back', () => {
  it('lets the owner of an address take it back from a sign-up they did not make', async () => {
    // Someone else signed up with this address first, with their own password.
    const email = uniqueEmail('victim');
    await register(email, OTHER_PASSWORD);

    const reset = await resetPassword(email, PASSWORD);
    expect(reset.status).toBe(200);

    const owner = await new Client(ctx.app).init();
    expect((await owner.post('/api/auth/login', { email, password: PASSWORD })).status).toBe(200);
    const stranger = await new Client(ctx.app).init();
    expect(
      (await stranger.post('/api/auth/login', { email, password: OTHER_PASSWORD })).status,
    ).toBe(401);
  });

  it('opens a locked account again, so a stranger cannot keep its owner out', async () => {
    const { email } = await signedInUser(ctx);
    const stranger = await new Client(ctx.app).init();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await stranger.post('/api/auth/login', { email, password: 'wrong password!!' });
    }

    expect((await resetPassword(email, OTHER_PASSWORD)).status).toBe(200);
    const owner = await new Client(ctx.app).init();
    expect((await owner.post('/api/auth/login', { email, password: OTHER_PASSWORD })).status).toBe(
      200,
    );
  });

  it('signs every session out when the password changes', async () => {
    const { client, email } = await signedInUser(ctx);
    expect((await client.get('/api/auth/me')).status).toBe(200);

    await resetPassword(email, OTHER_PASSWORD);
    expect((await client.get('/api/auth/me')).status).toBe(401);
  });

  it('works once, and says nothing about addresses that have no account', async () => {
    const { email } = await signedInUser(ctx);
    const client = await new Client(ctx.app).init();
    await client.post('/api/auth/password/forgot', { email });
    const token = ctx.mailer.tokenFor(email);
    const sent = ctx.mailer.sent.length;

    const unknown = await client.post('/api/auth/password/forgot', { email: uniqueEmail() });
    expect(unknown.status).toBe(202);
    expect(ctx.mailer.sent).toHaveLength(sent);

    const first = await client.post('/api/auth/password/reset', {
      token,
      password: OTHER_PASSWORD,
    });
    expect(first.status).toBe(200);
    const again = await client.post('/api/auth/password/reset', { token, password: PASSWORD });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('invalid_token');
  });

  it('does not let a deactivated member back in through a reset', async () => {
    const { email, user } = await signedInUser(ctx);
    await ctx.prisma.user.update({ where: { id: user.id }, data: { disabledAt: new Date() } });
    const sent = ctx.mailer.sent.length;

    const client = await new Client(ctx.app).init();
    expect((await client.post('/api/auth/password/forgot', { email })).status).toBe(202);
    expect(ctx.mailer.sent).toHaveLength(sent);
  });

  it('gives an address back once a sign-up left unverified has expired', async () => {
    const email = uniqueEmail('late');
    await register(email, OTHER_PASSWORD);
    await ctx.prisma.emailVerification.updateMany({
      where: { user: { email } },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await register(email, PASSWORD, 'Real Owner');
    const client = await new Client(ctx.app).init();
    expect(
      (
        await client.post('/api/auth/verify-email', {
          token: ctx.mailer.tokenFor(email),
          password: PASSWORD,
        })
      ).status,
    ).toBe(200);
    expect((await client.post('/api/auth/login', { email, password: PASSWORD })).status).toBe(200);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.displayName).toBe('Real Owner');
  });
});

describe('two-factor authentication', () => {
  it('does not finish a sign-in begun with a password that has since been reset', async () => {
    const admin = await signedInAdmin(ctx);
    const thief = await new Client(ctx.app).init();
    const begun = await thief.post('/api/auth/login', { email: admin.email, password: PASSWORD });
    expect(begun.body).toEqual({ next: 'totp' });

    expect((await resetPassword(admin.email, OTHER_PASSWORD)).status).toBe(200);
    ctx.replay.clear(); // the code itself is fine; only the challenge is stale

    const finish = await thief.post('/api/auth/login/totp', {
      code: await codeFor(admin.totpSecret),
    });
    expect(finish.status).toBe(401);
    expect(finish.body.error.code).toBe('challenge_expired');
  });

  it('hands out recovery codes that each open the account once', async () => {
    const account = await signedInUser(ctx);
    const setup = await account.client.post('/api/auth/totp/setup', { password: PASSWORD });
    const enabled = await account.client.post('/api/auth/totp/enable', {
      code: await codeFor(setup.body.secret),
    });
    const codes = enabled.body.recoveryCodes as string[];
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: account.user.id } });
    expect(JSON.stringify(stored)).not.toContain(codes[0]);

    const lostPhone = await new Client(ctx.app).init();
    await lostPhone.post('/api/auth/login', { email: account.email, password: PASSWORD });
    const first = await lostPhone.post('/api/auth/login/totp', { recoveryCode: codes[0] });
    expect(first.status).toBe(200);

    const again = await new Client(ctx.app).init();
    await again.post('/api/auth/login', { email: account.email, password: PASSWORD });
    expect((await again.post('/api/auth/login/totp', { recoveryCode: codes[0] })).status).toBe(401);
  });

  it('keeps counting wrong codes when the password is entered again', async () => {
    // Knowing the password must not buy an endless supply of code guesses by
    // signing in again before the fifth wrong one.
    const admin = await signedInAdmin(ctx);
    const client = await new Client(ctx.app).init();
    let guess = 0;
    for (let cycle = 0; cycle < 3; cycle++) {
      const login = await client.post('/api/auth/login', {
        email: admin.email,
        password: PASSWORD,
      });
      if (login.status !== 200) break;
      for (let i = 0; i < 4; i++) {
        guess += 1;
        await client.post('/api/auth/login/totp', { code: String(guess).padStart(6, '0') });
      }
    }

    const after = await ctx.prisma.user.findUniqueOrThrow({ where: { id: admin.user.id } });
    expect(after.lockedUntil).not.toBeNull();
    const again = await client.post('/api/auth/login', { email: admin.email, password: PASSWORD });
    expect(again.status).toBe(401);
  });

  it('asks for the password before a second factor can be bound to the account', async () => {
    // Someone holding only a session (a stolen cookie) must not be able to enrol
    // their own authenticator and pass the admin 2FA gate with it.
    const { client, user } = await signedInUser(ctx, { accountType: 'company' });

    expect((await client.post('/api/auth/totp/setup')).status).toBe(400);
    const wrong = await client.post('/api/auth/totp/setup', { password: 'not the password!' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('invalid_credentials');
    expect(
      (await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).totpSecret,
    ).toBeNull();
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).failedLogins).toBe(
      1,
    );

    const right = await client.post('/api/auth/totp/setup', { password: PASSWORD });
    expect(right.status).toBe(200);
  });

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
