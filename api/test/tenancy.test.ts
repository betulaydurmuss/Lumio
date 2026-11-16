import { beforeEach, describe, expect, it } from 'vitest';
import { audit } from '../src/audit.js';
import { scopedPrisma } from '../src/tenancy.js';
import {
  buildApp,
  Client,
  PASSWORD,
  resetDatabase,
  signedInAdmin,
  signedInUser,
  type TestContext,
} from './helpers.js';

let ctx: TestContext;

beforeEach(async () => {
  ctx = buildApp();
  await resetDatabase(ctx.prisma);
});

async function twoCompanies() {
  const a = await signedInAdmin(ctx, 'Anadolu Sigorta');
  const b = await signedInAdmin(ctx, 'Boğaziçi Lojistik');
  return { a, b };
}

describe('organization isolation over HTTP', () => {
  it('shows an admin only their own members', async () => {
    const { a, b } = await twoCompanies();

    const members = await a.client.get('/api/org/members');

    expect(members.status).toBe(200);
    const emails = (members.body as { email: string }[]).map((m) => m.email);
    expect(emails).toEqual([a.email]);
    expect(emails).not.toContain(b.email);
  });

  it('shows an admin only their own audit trail', async () => {
    const { a, b } = await twoCompanies();

    const logs = await a.client.get('/api/org/audit-logs');

    const actors = new Set((logs.body as { actorId: string }[]).map((entry) => entry.actorId));
    expect(actors.has(a.user.id)).toBe(true);
    expect(actors.has(b.user.id)).toBe(false);
  });

  it("cannot revoke another organization's session by guessing its id", async () => {
    const { a, b } = await twoCompanies();
    const bSession = await ctx.prisma.session.findFirstOrThrow({ where: { userId: b.user.id } });

    const res = await a.client.delete(`/api/auth/sessions/${bSession.id}`);

    expect(res.status).toBe(404);
    expect((await b.client.get('/api/auth/me')).status).toBe(200);
  });

  it("cannot revoke a colleague's session in the same organization either", async () => {
    const admin = await signedInUser(ctx, { accountType: 'company' });
    // A second user in the same organization, signed in on their own device.
    const colleague = await ctx.prisma.user.create({
      data: {
        orgId: admin.user.orgId,
        email: 'colleague@example.com',
        displayName: 'Colleague',
        passwordHash: admin.user.passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    const device = await new Client(ctx.app).init();
    await device.post('/api/auth/login', { email: colleague.email, password: PASSWORD });
    const theirs = await ctx.prisma.session.findFirstOrThrow({ where: { userId: colleague.id } });

    expect((await admin.client.delete(`/api/auth/sessions/${theirs.id}`)).status).toBe(404);
  });
});

describe('the tenant-scoped client', () => {
  it('cannot read, count, change or delete rows of another organization', async () => {
    const { a, b } = await twoCompanies();
    const db = scopedPrisma(ctx.prisma, a.user.orgId);

    expect(await db.user.findUnique({ where: { id: b.user.id } })).toBeNull();
    expect(await db.user.findFirst({ where: { email: b.email } })).toBeNull();
    expect(await db.user.count()).toBe(1);
    expect(await db.session.count({ where: { userId: b.user.id } })).toBe(0);

    await expect(
      db.user.update({ where: { id: b.user.id }, data: { displayName: 'hijacked' } }),
    ).rejects.toThrow();
    expect((await db.user.updateMany({ data: { displayName: 'renamed' } })).count).toBe(1);
    expect((await db.session.deleteMany({ where: { userId: b.user.id } })).count).toBe(0);

    const untouched = await ctx.prisma.user.findUniqueOrThrow({ where: { id: b.user.id } });
    expect(untouched.displayName).toBe('Test User');
  });

  it('cannot be widened by passing another orgId in the filter', async () => {
    const { a, b } = await twoCompanies();
    const db = scopedPrisma(ctx.prisma, a.user.orgId);

    expect(await db.user.findMany({ where: { orgId: b.user.orgId } })).toEqual([]);
  });

  it('stamps its own organization on every row it creates', async () => {
    const { a, b } = await twoCompanies();
    const db = scopedPrisma(ctx.prisma, a.user.orgId);

    const row = await db.auditLog.create({
      data: { orgId: b.user.orgId, action: 'test.cross_tenant_write' },
    });

    expect(row.orgId).toBe(a.user.orgId);
  });
});

describe('the audit log', () => {
  it('records the sign-in story of an account', async () => {
    const { user } = await signedInAdmin(ctx);

    const actions = (
      await ctx.prisma.auditLog.findMany({
        where: { actorId: user.id },
        orderBy: { createdAt: 'asc' },
      })
    ).map((entry) => entry.action);

    expect(actions).toEqual([
      'user.registered',
      'user.email_verified',
      'auth.login_succeeded',
      'totp.enabled',
    ]);
  });

  it('cannot be edited or deleted, even by the application', async () => {
    const { user } = await signedInUser(ctx);
    await audit(ctx.prisma, { orgId: user.orgId, actorId: user.id, action: 'auth.logout' });
    const entry = await ctx.prisma.auditLog.findFirstOrThrow({ where: { action: 'auth.logout' } });

    await expect(
      ctx.prisma.auditLog.update({ where: { id: entry.id }, data: { action: 'nothing.happened' } }),
    ).rejects.toThrow(/append-only/);
    await expect(ctx.prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(
      /append-only/,
    );
  });
});
