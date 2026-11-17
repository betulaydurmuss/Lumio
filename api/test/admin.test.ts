import type { Invitation, Member, OrgStats, PlatformOverview } from '@lumio/shared';
import request from 'supertest';
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

function inviteToken(email: string): string {
  const mail = [...ctx.mailer.sent].reverse().find((job) => job.to === email);
  const token = mail?.text.match(/invite\?token=([^\s]+)/)?.[1];
  if (!token) throw new Error(`No invitation mail for ${email}`);
  return decodeURIComponent(token);
}

/** Invites an address, accepts the invitation and signs the new member in. */
async function invitedMember(
  admin: Client,
  role: 'learner' | 'instructor' | 'org_admin' = 'learner',
) {
  const email = uniqueEmail('invited');
  expect((await admin.post('/api/org/invitations', { email, role })).status).toBe(201);
  const client = await new Client(ctx.app).init();
  const accepted = await client.post('/api/auth/invitations/accept', {
    token: inviteToken(email),
    displayName: 'Invited Person',
    password: PASSWORD,
    locale: 'en',
  });
  expect(accepted.status).toBe(201);
  await client.post('/api/auth/login', { email, password: PASSWORD });
  const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
  return { client, email, user };
}

async function members(admin: Client) {
  return (await admin.get('/api/org/members')).body as Member[];
}

describe('invitations', () => {
  it('lets an invited person join the organization with the given role', async () => {
    const admin = await signedInAdmin(ctx, 'Anadolu Sigorta');
    const email = uniqueEmail('new');
    await admin.client.post('/api/org/invitations', { email, role: 'instructor' });

    const mail = ctx.mailer.sent.at(-1)!;
    expect(mail.subject).toContain('Anadolu Sigorta');
    expect(mail.text).toContain('7 gün');
    expect(mail.text).toContain('7 days');

    const visitor = await new Client(ctx.app).init();
    const preview = await visitor.post('/api/auth/invitations/lookup', {
      token: inviteToken(email),
    });
    expect(preview.body).toEqual({
      organizationName: 'Anadolu Sigorta',
      email,
      role: 'instructor',
    });

    await visitor.post('/api/auth/invitations/accept', {
      token: inviteToken(email),
      displayName: 'Yeni Eğitmen',
      password: PASSWORD,
      locale: 'tr',
    });
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.orgId).toBe(admin.user.orgId);
    expect(user.role).toBe('instructor');
    expect(user.emailVerifiedAt).not.toBeNull();
    expect((await visitor.post('/api/auth/login', { email, password: PASSWORD })).body).toEqual({
      next: 'done',
    });
  });

  it('works once', async () => {
    const admin = await signedInAdmin(ctx);
    const { email } = await invitedMember(admin.client);
    const again = await (
      await new Client(ctx.app).init()
    ).post('/api/auth/invitations/accept', {
      token: inviteToken(email),
      displayName: 'Second Try',
      password: PASSWORD,
      locale: 'en',
    });
    expect(again.status).toBe(400);
    expect(await ctx.prisma.user.count({ where: { email } })).toBe(1);
  });

  it('stops working when expired, revoked or replaced by a newer one', async () => {
    const admin = await signedInAdmin(ctx);
    const visitor = await new Client(ctx.app).init();
    const lookup = (token: string) => visitor.post('/api/auth/invitations/lookup', { token });

    const expiring = uniqueEmail();
    await admin.client.post('/api/org/invitations', { email: expiring, role: 'learner' });
    await ctx.prisma.invitation.updateMany({
      where: { email: expiring },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await lookup(inviteToken(expiring))).status).toBe(400);

    const revoked = uniqueEmail();
    const created = await admin.client.post('/api/org/invitations', {
      email: revoked,
      role: 'learner',
    });
    await admin.client.delete(`/api/org/invitations/${created.body.id}`);
    expect((await lookup(inviteToken(revoked))).status).toBe(400);

    const replaced = uniqueEmail();
    await admin.client.post('/api/org/invitations', { email: replaced, role: 'learner' });
    const first = inviteToken(replaced);
    await admin.client.post('/api/org/invitations', { email: replaced, role: 'instructor' });
    expect((await lookup(first)).status).toBe(400);
    expect((await lookup(inviteToken(replaced))).body.role).toBe('instructor');

    const pending = (await admin.client.get('/api/org/invitations')).body as Invitation[];
    expect(pending.map((row) => row.email).sort()).toEqual([expiring, replaced].sort());
    expect(pending.find((row) => row.email === expiring)?.expired).toBe(true);
  });

  it('lets an invitation through to an address held only by an unfinished sign-up', async () => {
    // An unverified sign-up proves nothing about the address; opening the
    // invitation mail does.
    const admin = await signedInAdmin(ctx);
    const email = uniqueEmail('held');
    await (
      await new Client(ctx.app).init()
    ).post('/api/auth/register', {
      accountType: 'company',
      organizationName: 'Squatter Ltd',
      displayName: 'Squatter',
      email,
      password: 'squatter password!!',
      locale: 'en',
    });
    await admin.client.post('/api/org/invitations', { email, role: 'learner' });

    const res = await (
      await new Client(ctx.app).init()
    ).post('/api/auth/invitations/accept', {
      token: inviteToken(email),
      displayName: 'Real Person',
      password: PASSWORD,
      locale: 'en',
    });
    expect(res.status).toBe(201);
    const joined = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(joined.orgId).toBe(admin.user.orgId);
    expect(await ctx.prisma.organization.count({ where: { name: 'Squatter Ltd' } })).toBe(0);
  });

  it('refuses an address that already has an account', async () => {
    const admin = await signedInAdmin(ctx);
    const { email } = await signedInUser(ctx);
    await admin.client.post('/api/org/invitations', { email, role: 'learner' });

    const res = await (
      await new Client(ctx.app).init()
    ).post('/api/auth/invitations/accept', {
      token: inviteToken(email),
      displayName: 'Someone',
      password: PASSWORD,
      locale: 'en',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('email_taken');
  });

  it.each(['demoted', 'deactivated'] as const)(
    'stops the invitations of an admin who has been %s',
    async (change) => {
      // A removed admin must not get their authority back through an
      // invitation they sent to another address of their own.
      const first = await signedInAdmin(ctx);
      const second = await invitedMember(first.client, 'org_admin');
      const setup = await second.client.post('/api/auth/totp/setup', { password: PASSWORD });
      await second.client.post('/api/auth/totp/enable', { code: await codeFor(setup.body.secret) });
      const spare = uniqueEmail('spare');
      expect(
        (await second.client.post('/api/org/invitations', { email: spare, role: 'org_admin' }))
          .status,
      ).toBe(201);

      const res =
        change === 'demoted'
          ? await first.client.agent
              .patch(`/api/org/members/${second.user.id}/role`)
              .set('x-csrf-token', first.client.csrf)
              .send({ role: 'learner' })
          : await first.client.post(`/api/org/members/${second.user.id}/deactivate`);
      expect(res.status).toBe(204);

      const visitor = await new Client(ctx.app).init();
      const accepted = await visitor.post('/api/auth/invitations/accept', {
        token: inviteToken(spare),
        displayName: 'Spare Address',
        password: PASSWORD,
        locale: 'en',
      });
      expect(accepted.status).toBe(400);
      expect(await ctx.prisma.user.count({ where: { email: spare } })).toBe(0);
    },
  );

  it('does not let an invitation outrank the admin who sent it', async () => {
    // Defence at the door as well: even an invitation that escaped revocation
    // is refused once its sender is no longer an active admin.
    const first = await signedInAdmin(ctx);
    const second = await invitedMember(first.client, 'org_admin');
    const setup = await second.client.post('/api/auth/totp/setup', { password: PASSWORD });
    await second.client.post('/api/auth/totp/enable', { code: await codeFor(setup.body.secret) });
    const spare = uniqueEmail('spare');
    await second.client.post('/api/org/invitations', { email: spare, role: 'org_admin' });
    await ctx.prisma.user.update({ where: { id: second.user.id }, data: { role: 'learner' } });

    const visitor = await new Client(ctx.app).init();
    const accepted = await visitor.post('/api/auth/invitations/accept', {
      token: inviteToken(spare),
      displayName: 'Spare Address',
      password: PASSWORD,
      locale: 'en',
    });
    expect(accepted.status).toBe(400);
  });

  it('cannot hand out the platform admin role', async () => {
    const admin = await signedInAdmin(ctx);
    const res = await admin.client.post('/api/org/invitations', {
      email: uniqueEmail(),
      role: 'platform_admin',
    });
    expect(res.status).toBe(400);
  });
});

describe('managing members', () => {
  it('changes roles, but never your own', async () => {
    const admin = await signedInAdmin(ctx);
    const { user } = await invitedMember(admin.client);

    expect(
      (
        await admin.client.agent
          .patch(`/api/org/members/${user.id}/role`)
          .set('x-csrf-token', admin.client.csrf)
          .send({ role: 'instructor' })
      ).status,
    ).toBe(204);
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe(
      'instructor',
    );

    const self = await admin.client.agent
      .patch(`/api/org/members/${admin.user.id}/role`)
      .set('x-csrf-token', admin.client.csrf)
      .send({ role: 'learner' });
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe('cannot_change_self');
  });

  it('keeps an admin even when two admins demote each other at the same moment', async () => {
    const first = await signedInAdmin(ctx);
    const second = await invitedMember(first.client, 'org_admin');
    const setup = await second.client.post('/api/auth/totp/setup', { password: PASSWORD });
    await second.client.post('/api/auth/totp/enable', { code: await codeFor(setup.body.secret) });

    const demote = (actor: Client, target: string) =>
      actor.agent
        .patch(`/api/org/members/${target}/role`)
        .set('x-csrf-token', actor.csrf)
        .send({ role: 'learner' });
    const results = await Promise.all([
      demote(first.client, second.user.id),
      demote(second.client, first.user.id),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([204, 403]);
    expect(
      await ctx.prisma.user.count({ where: { orgId: first.user.orgId, role: 'org_admin' } }),
    ).toBe(1);
  });

  it('keeps at least one active admin in the organization', async () => {
    const admin = await signedInAdmin(ctx);
    const second = await invitedMember(admin.client, 'org_admin');
    // The first admin becomes the platform operator; the second is now the only org admin.
    await ctx.prisma.user.update({
      where: { id: admin.user.id },
      data: { role: 'platform_admin' },
    });

    const demote = await admin.client.agent
      .patch(`/api/org/members/${second.user.id}/role`)
      .set('x-csrf-token', admin.client.csrf)
      .send({ role: 'learner' });
    expect(demote.status).toBe(409);
    expect(demote.body.error.code).toBe('last_admin');

    const deactivate = await admin.client.post(`/api/org/members/${second.user.id}/deactivate`);
    expect(deactivate.body.error.code).toBe('last_admin');
  });

  it('signs a deactivated member out at once and keeps them out until reactivated', async () => {
    const admin = await signedInAdmin(ctx);
    const member = await invitedMember(admin.client);
    expect((await member.client.get('/api/auth/me')).status).toBe(200);

    await admin.client.post(`/api/org/members/${member.user.id}/deactivate`);
    expect((await member.client.get('/api/auth/me')).status).toBe(401);

    const fresh = await new Client(ctx.app).init();
    const login = await fresh.post('/api/auth/login', { email: member.email, password: PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('invalid_credentials');
    expect((await members(admin.client)).find((row) => row.id === member.user.id)?.disabled).toBe(
      true,
    );

    await admin.client.post(`/api/org/members/${member.user.id}/reactivate`);
    expect(
      (await fresh.post('/api/auth/login', { email: member.email, password: PASSWORD })).status,
    ).toBe(200);
  });

  it('cannot reach a member of another organization', async () => {
    const a = await signedInAdmin(ctx, 'Anadolu Sigorta');
    const b = await signedInAdmin(ctx, 'Boğaziçi Lojistik');

    expect((await a.client.post(`/api/org/members/${b.user.id}/deactivate`)).status).toBe(404);
    expect(
      (await ctx.prisma.user.findUniqueOrThrow({ where: { id: b.user.id } })).disabledAt,
    ).toBeNull();
  });

  it('counts the organization at a glance', async () => {
    const admin = await signedInAdmin(ctx);
    await invitedMember(admin.client);
    await admin.client.post('/api/org/invitations', { email: uniqueEmail(), role: 'learner' });

    const stats = (await admin.client.get('/api/org/stats')).body as OrgStats;
    expect(stats).toMatchObject({ members: 2, pendingInvitations: 1, disabledMembers: 0 });
  });

  it('records every change in the audit log', async () => {
    const admin = await signedInAdmin(ctx);
    const member = await invitedMember(admin.client);
    await admin.client.post(`/api/org/members/${member.user.id}/deactivate`);

    const actions = (
      await ctx.prisma.auditLog.findMany({ where: { orgId: admin.user.orgId } })
    ).map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining(['member.invited', 'invitation.accepted', 'member.deactivated']),
    );
  });

  it('keeps learners and instructors out of the admin area', async () => {
    const admin = await signedInAdmin(ctx);
    const instructor = await invitedMember(admin.client, 'instructor');

    expect((await instructor.client.get('/api/org/members')).status).toBe(403);
  });
});

describe('the platform console', () => {
  async function platformAdmin() {
    const admin = await signedInAdmin(ctx, 'Lumio Operasyon');
    await ctx.prisma.user.update({
      where: { id: admin.user.id },
      data: { role: 'platform_admin' },
    });
    return admin;
  }

  it('is closed to organization admins', async () => {
    const admin = await signedInAdmin(ctx);
    expect((await admin.client.get('/api/platform/overview')).status).toBe(403);
  });

  it('shows every organization in numbers only', async () => {
    const operator = await platformAdmin();
    await signedInAdmin(ctx, 'Anadolu Sigorta');
    // A personal account's organization is named after its owner, "Test User".
    await signedInUser(ctx);

    const overview = (await operator.client.get('/api/platform/overview')).body as PlatformOverview;
    expect(overview.totals.organizations).toBe(3);
    expect(overview.totals.publishedCourses).toBe(12);
    expect(overview.organizations.map((org) => org.name)).toContain('Anadolu Sigorta');
    expect(overview.organizations.find((org) => org.kind === 'personal')?.name).toBeNull();
    expect(JSON.stringify(overview)).not.toMatch(/@|Test User/);
  });

  it('takes a course off the catalog without taking it from enrolled learners', async () => {
    const operator = await platformAdmin();
    const learner = await signedInUser(ctx);
    await learner.client.post('/api/catalog/courses/kvkk-awareness/enroll');
    const setStatus = (status: string) =>
      operator.client.agent
        .patch('/api/platform/courses/kvkk-awareness/status')
        .set('x-csrf-token', operator.client.csrf)
        .send({ status });

    expect((await setStatus('draft')).status).toBe(204);
    expect((await request(ctx.app).get('/api/catalog/courses/kvkk-awareness')).status).toBe(404);
    expect((await request(ctx.app).get('/api/learn/kvkk-awareness')).status).toBe(404);
    expect((await learner.client.get('/api/learn/kvkk-awareness')).status).toBe(200);

    // Running the demo seed again (every deploy does) keeps the operator's decision.
    await seedCatalog(ctx.prisma);
    expect((await request(ctx.app).get('/api/catalog/courses/kvkk-awareness')).status).toBe(404);

    expect((await setStatus('published')).status).toBe(204);
    expect((await request(ctx.app).get('/api/catalog/courses/kvkk-awareness')).status).toBe(200);
    expect(
      await ctx.prisma.auditLog.count({
        where: {
          actorId: operator.user.id,
          action: { in: ['course.published', 'course.unpublished'] },
        },
      }),
    ).toBe(2);
  });
});
