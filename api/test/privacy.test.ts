import type { Consents, NotificationFeed } from '@lumio/shared';
import { PRIVACY_NOTICE_VERSION } from '@lumio/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCatalog } from '../prisma/seed.js';
import {
  buildApp,
  Client,
  codeFor,
  PASSWORD,
  resetDatabase,
  signedInAdmin,
  signedInUser,
  testPrisma,
  uniqueEmail,
  type TestContext,
} from './helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  await seedCatalog(testPrisma());
});

beforeEach(async () => {
  ctx = buildApp();
  await resetDatabase(ctx.prisma);
});

async function consents(client: Client) {
  return (await client.get('/api/me/consents')).body as Consents;
}

async function feed(client: Client) {
  return (await client.get('/api/me/notifications')).body as NotificationFeed;
}

describe('marketing consent', () => {
  it('is never assumed: no answer at sign-up means no', async () => {
    const { client } = await signedInUser(ctx);
    expect(await consents(client)).toEqual({
      marketingEmail: false,
      noticeVersion: PRIVACY_NOTICE_VERSION,
      history: [],
    });
  });

  it('is recorded with the notice version when given at sign-up', async () => {
    const email = uniqueEmail();
    const client = await new Client(ctx.app).init();
    await client.post('/api/auth/register', {
      accountType: 'personal',
      displayName: 'Ayşe Yılmaz',
      email,
      password: PASSWORD,
      locale: 'tr',
      marketingConsent: true,
    });
    await client.post('/api/auth/verify-email', {
      token: ctx.mailer.tokenFor(email),
      password: PASSWORD,
    });
    await client.post('/api/auth/login', { email, password: PASSWORD });

    const state = await consents(client);
    expect(state.marketingEmail).toBe(true);
    expect(state.history).toEqual([
      expect.objectContaining({ granted: true, noticeVersion: PRIVACY_NOTICE_VERSION }),
    ]);
  });

  it('can be withdrawn at any time, and keeps a history of decisions', async () => {
    const { client, user } = await signedInUser(ctx);
    const put = (marketingEmail: boolean) =>
      client.agent
        .put('/api/me/consents')
        .set('x-csrf-token', client.csrf)
        .send({ marketingEmail });

    expect((await put(true)).body.marketingEmail).toBe(true);
    expect((await put(false)).body.marketingEmail).toBe(false);
    const repeated = (await put(false)).body as Consents;

    expect(repeated.history.map((row) => row.granted)).toEqual([false, true]);
    expect(
      await ctx.prisma.auditLog.count({ where: { actorId: user.id, action: 'consent.changed' } }),
    ).toBe(2);
  });
});

describe('notifications', () => {
  it('tells a member about a course assigned to them, in their own feed only', async () => {
    const admin = await signedInAdmin(ctx, 'Anadolu Sigorta');
    const email = uniqueEmail('employee');
    await admin.client.post('/api/org/invitations', { email, role: 'learner' });
    const token = decodeURIComponent(
      ctx.mailer.sent.at(-1)!.text.match(/invite\?token=([^\s]+)/)![1]!,
    );
    const learner = await new Client(ctx.app).init();
    await learner.post('/api/auth/invitations/accept', {
      token,
      displayName: 'Deniz Kara',
      password: PASSWORD,
      locale: 'tr',
    });
    await learner.post('/api/auth/login', { email, password: PASSWORD });
    const member = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });

    await admin.client.post('/api/org/assignments', {
      courseSlug: 'kvkk-awareness',
      userIds: [member.id],
      dueOn: '2099-01-31',
    });

    const mine = await feed(learner);
    expect(mine.unread).toBe(1);
    expect(mine.items[0]).toMatchObject({
      kind: 'course_assigned',
      read: false,
      data: { courseSlug: 'kvkk-awareness', dueOn: '2099-01-31' },
    });
    // The admin's own feed has their two-factor notice, not the member's assignment.
    expect((await feed(admin.client)).items.map((item) => item.kind)).toEqual([
      'two_factor_enabled',
    ]);
  });

  it('marks one or all as read, and never touches someone else’s', async () => {
    const admin = await signedInAdmin(ctx);
    const other = await signedInUser(ctx);
    await ctx.prisma.notification.create({
      data: { orgId: other.user.orgId, userId: other.user.id, kind: 'password_changed' },
    });
    const theirs = await ctx.prisma.notification.findFirstOrThrow({
      where: { userId: other.user.id },
    });

    await admin.client.post('/api/me/notifications/read', { ids: [theirs.id] });
    expect((await feed(other.client)).unread).toBe(1);

    expect((await feed(admin.client)).unread).toBe(1);
    await admin.client.post('/api/me/notifications/read', {});
    expect((await feed(admin.client)).unread).toBe(0);
  });

  it('warns the owner when the password is changed', async () => {
    const { client, email } = await signedInUser(ctx);
    const visitor = await new Client(ctx.app).init();
    await visitor.post('/api/auth/password/forgot', { email });
    await visitor.post('/api/auth/password/reset', {
      token: ctx.mailer.tokenFor(email),
      password: 'an entirely new passphrase',
    });
    await client.post('/api/auth/login', { email, password: 'an entirely new passphrase' });

    expect((await feed(client)).items[0]?.kind).toBe('password_changed');
  });
});

describe('the data export', () => {
  it('hands over what is held about the member, without any secret', async () => {
    const account = await signedInUser(ctx);
    const setup = await account.client.post('/api/auth/totp/setup', { password: PASSWORD });
    await account.client.post('/api/auth/totp/enable', { code: await codeFor(setup.body.secret) });

    const res = await account.client.get('/api/me/data-export');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.account).toMatchObject({ email: account.email, twoFactorEnabled: true });
    expect(res.body.sessions.length).toBeGreaterThan(0);

    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: account.user.id } });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(stored.passwordHash!);
    expect(text).not.toContain(stored.totpSecret!);
    expect(text).not.toMatch(/passwordHash|totpSecret|refreshTokenHash|tokenHash|recovery/i);
    expect(
      await ctx.prisma.auditLog.count({
        where: { actorId: account.user.id, action: 'data.exported' },
      }),
    ).toBe(1);
  });

  it('is only for the signed-in member', async () => {
    const visitor = await new Client(ctx.app).init();
    expect((await visitor.get('/api/me/data-export')).status).toBe(401);
  });
});
