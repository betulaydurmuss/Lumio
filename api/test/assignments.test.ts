import type { Assignment, LearningItem, Transcript } from '@lumio/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCatalog } from '../prisma/seed.js';
import {
  buildApp,
  Client,
  PASSWORD,
  resetDatabase,
  signedInAdmin,
  signedInUser,
  testPrisma,
  uniqueEmail,
  type TestContext,
} from './helpers.js';

const FREE = 'kvkk-awareness';
const PAID = 'react-and-typescript';

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

/** A company admin and one learner in the same organization. */
async function team() {
  const admin = await signedInAdmin(ctx, 'Anadolu Sigorta');
  const email = uniqueEmail('employee');
  await admin.client.post('/api/org/invitations', { email, role: 'learner' });
  const client = await new Client(ctx.app).init();
  await client.post('/api/auth/invitations/accept', {
    token: inviteToken(email),
    displayName: 'Deniz Kara',
    password: PASSWORD,
    locale: 'tr',
  });
  await client.post('/api/auth/login', { email, password: PASSWORD });
  const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
  return { admin, learner: { client, email, user } };
}

async function report(admin: Client) {
  return (await admin.get('/api/org/assignments?locale=en')).body as Assignment[];
}

describe('assigning courses', () => {
  it('enrols the member, tells them by mail and puts the due date in their list', async () => {
    const { admin, learner } = await team();

    const res = await admin.client.post('/api/org/assignments', {
      courseSlug: FREE,
      userIds: [learner.user.id],
      dueOn: '2099-12-31',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ assigned: 1, alreadyAssigned: 0 });

    const mail = ctx.mailer.sent.at(-1)!;
    expect(mail.to).toBe(learner.email);
    expect(mail.subject).toContain('Yeni eğitim');
    expect(mail.text).toContain('2099-12-31');

    const learning = (await learner.client.get('/api/me/learning')).body as LearningItem[];
    expect(learning).toHaveLength(1);
    expect(learning[0]?.assignment).toEqual({ dueOn: '2099-12-31', overdue: false });

    const again = await admin.client.post('/api/org/assignments', {
      courseSlug: FREE,
      userIds: [learner.user.id],
    });
    expect(again.body).toEqual({ assigned: 0, alreadyAssigned: 1 });
    expect(await ctx.prisma.enrollment.count({ where: { userId: learner.user.id } })).toBe(1);
  });

  it('only assigns free courses until payments exist', async () => {
    const { admin, learner } = await team();
    const res = await admin.client.post('/api/org/assignments', {
      courseSlug: PAID,
      userIds: [learner.user.id],
    });
    expect(res.status).toBe(402);
    expect(await ctx.prisma.assignment.count()).toBe(0);
  });

  it("cannot assign anything to another organization's people", async () => {
    const { admin } = await team();
    const outsider = await signedInUser(ctx);

    const res = await admin.client.post('/api/org/assignments', {
      courseSlug: FREE,
      userIds: [outsider.user.id],
    });
    expect(res.status).toBe(404);
    expect(await ctx.prisma.assignment.count()).toBe(0);
    expect(await ctx.prisma.enrollment.count({ where: { userId: outsider.user.id } })).toBe(0);
  });

  it('keeps the report to admins, and to their own organization', async () => {
    const { admin, learner } = await team();
    await admin.client.post('/api/org/assignments', {
      courseSlug: FREE,
      userIds: [learner.user.id],
    });

    expect((await learner.client.get('/api/org/assignments')).status).toBe(403);
    const other = await signedInAdmin(ctx, 'Başka Şirket');
    expect(await report(other.client)).toEqual([]);
  });
});

describe('the assignment report', () => {
  it('follows each assignment from not started to completed, and flags late ones', async () => {
    const { admin, learner } = await team();
    await admin.client.post('/api/org/assignments', {
      courseSlug: FREE,
      userIds: [learner.user.id],
      dueOn: '2099-01-01',
    });
    expect((await report(admin.client))[0]).toMatchObject({
      status: 'not_started',
      percent: 0,
      member: { displayName: 'Deniz Kara' },
    });

    // A reading lesson counts as soon as it is opened and marked done.
    const reading = await ctx.prisma.lesson.findFirstOrThrow({
      where: { section: { course: { slug: FREE } }, type: 'reading' },
    });
    await learner.client.agent
      .put(`/api/learn/${FREE}/lessons/${reading.id}/progress`)
      .set('x-csrf-token', learner.client.csrf)
      .send({ completed: true });
    const started = (await report(admin.client))[0]!;
    expect(started.status).toBe('in_progress');
    expect(started.percent).toBeGreaterThan(0);

    await ctx.prisma.assignment.updateMany({ data: { dueOn: new Date('2020-01-01') } });
    expect((await report(admin.client))[0]?.status).toBe('overdue');
    const learning = (await learner.client.get('/api/me/learning')).body as LearningItem[];
    expect(learning[0]?.assignment?.overdue).toBe(true);

    await ctx.prisma.enrollment.updateMany({
      where: { userId: learner.user.id },
      data: { completedAt: new Date() },
    });
    expect((await report(admin.client))[0]).toMatchObject({ status: 'completed', percent: 100 });
  });

  it('downloads as a spreadsheet that cannot run formulas', async () => {
    const { admin, learner } = await team();
    await ctx.prisma.user.update({
      where: { id: learner.user.id },
      data: { displayName: '=HYPERLINK("http://evil.example","x")' },
    });
    await admin.client.post('/api/org/assignments', {
      courseSlug: FREE,
      userIds: [learner.user.id],
    });

    const res = await admin.client.get('/api/org/assignments.csv?locale=en');
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe(
      '"name","email","course","assigned_at","due_on","status","percent","completed_at"',
    );
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
    expect(lines[1]).toContain('"not_started"');
  });

  it('takes an assignment back without taking the course away', async () => {
    const { admin, learner } = await team();
    await admin.client.post('/api/org/assignments', {
      courseSlug: FREE,
      userIds: [learner.user.id],
    });
    const [row] = await report(admin.client);

    expect((await admin.client.delete(`/api/org/assignments/${row!.id}`)).status).toBe(204);
    expect(await report(admin.client)).toEqual([]);
    expect(await ctx.prisma.enrollment.count({ where: { userId: learner.user.id } })).toBe(1);
  });
});

describe('the transcript', () => {
  it("lists a learner's courses, with what is finished and what was assigned", async () => {
    const { admin, learner } = await team();
    await admin.client.post('/api/org/assignments', {
      courseSlug: FREE,
      userIds: [learner.user.id],
      dueOn: '2099-06-30',
    });
    await learner.client.post('/api/catalog/courses/javascript-fundamentals/enroll');
    await ctx.prisma.enrollment.updateMany({
      where: { userId: learner.user.id, course: { slug: 'javascript-fundamentals' } },
      data: { completedAt: new Date() },
    });

    const own = (await learner.client.get('/api/me/transcript?locale=en')).body as Transcript;
    expect(own.learner).toMatchObject({
      displayName: 'Deniz Kara',
      organization: 'Anadolu Sigorta',
    });
    expect(own.totals.courses).toBe(2);
    expect(own.totals.completed).toBe(1);
    expect(own.totals.completedMinutes).toBeGreaterThan(0);
    const assigned = own.entries.find((entry) => entry.course.slug === FREE)!;
    expect(assigned).toMatchObject({ assigned: true, dueOn: '2099-06-30', completedAt: null });

    const seenByAdmin = await admin.client.get(`/api/org/members/${learner.user.id}/transcript`);
    expect(seenByAdmin.status).toBe(200);
    expect((seenByAdmin.body as Transcript).totals.courses).toBe(2);
  });

  it("is not open to another organization's admin", async () => {
    const { learner } = await team();
    const other = await signedInAdmin(ctx, 'Başka Şirket');
    const res = await other.client.get(`/api/org/members/${learner.user.id}/transcript`);
    expect(res.status).toBe(404);
  });
});
