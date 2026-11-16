import type { OwnCertificate, PublicKey, QuizResult, Verification } from '@lumio/shared';
import { createPublicKey, verify } from 'node:crypto';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCatalog } from '../prisma/seed.js';
import { signedFields } from '../src/certificates/issue.js';
import { renderSvg } from '../src/certificates/render.js';
import { canonicalPayload } from '../src/certificates/signing.js';
import { scopedPrisma } from '../src/tenancy.js';
import {
  buildApp,
  resetDatabase,
  signedInAdmin,
  signedInUser,
  testPrisma,
  type Client,
  type TestContext,
} from './helpers.js';

const COURSE = 'kvkk-awareness';
const CERT_NO = /^LMS-\d{4}-\d{6}$/;
let ctx: TestContext;

beforeAll(async () => {
  await seedCatalog(testPrisma());
});

beforeEach(async () => {
  ctx = buildApp();
  await resetDatabase(ctx.prisma);
});

/** Enrols, finishes every lesson and passes every quiz. Returns the final quiz result. */
async function completeCourse(client: Client): Promise<QuizResult> {
  await client.post(`/api/catalog/courses/${COURSE}/enroll`);
  const lessons = await ctx.prisma.lesson.findMany({
    where: { section: { course: { slug: COURSE } } },
  });
  for (const lesson of lessons) {
    await client.agent
      .put(`/api/learn/${COURSE}/lessons/${lesson.id}/progress`)
      .set('x-csrf-token', client.csrf)
      .send({ positionSeconds: 30, completed: true });
  }
  const quizzes = await ctx.prisma.quiz.findMany({
    where: { course: { slug: COURSE } },
    include: { questions: { orderBy: { position: 'asc' } } },
    orderBy: { sectionId: { sort: 'asc', nulls: 'last' } },
  });
  let last: QuizResult | undefined;
  for (const quiz of quizzes) {
    const res = await client.post(`/api/learn/${COURSE}/quizzes/${quiz.id}/attempts`, {
      answers: quiz.questions.map((question) => question.correctIndex),
    });
    last = res.body as QuizResult;
  }
  return last!;
}

async function issued(client: Client) {
  const result = await completeCourse(client);
  const certificate = await ctx.prisma.certificate.findUniqueOrThrow({
    where: { certNo: result.certificateNo! },
  });
  return { result, certificate };
}

describe('issuing', () => {
  it('issues a numbered certificate the moment the course is complete', async () => {
    const { client, user } = await signedInUser(ctx);
    const { result, certificate } = await issued(client);

    expect(result.courseCompleted).toBe(true);
    expect(result.certificateNo).toMatch(CERT_NO);
    expect(certificate.recipientName).toBe('Test User');
    expect(certificate.orgName).toBeNull();
    expect(
      await ctx.prisma.auditLog.count({
        where: { actorId: user.id, action: 'certificate.issued' },
      }),
    ).toBe(1);
  });

  it('issues once, however often the learner asks', async () => {
    const { client } = await signedInUser(ctx);
    await completeCourse(client);

    const first = (await client.get('/api/me/certificates')).body as OwnCertificate[];
    const second = (await client.get('/api/me/certificates')).body as OwnCertificate[];

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(await ctx.prisma.certificate.count()).toBe(1);
  });

  it('prints the company name for company accounts and never reuses a number', async () => {
    const a = await signedInAdmin(ctx, 'Anadolu Sigorta');
    const b = await signedInUser(ctx);
    const first = await issued(a.client);
    const second = await issued(b.client);

    expect(first.certificate.orgName).toBe('Anadolu Sigorta');
    expect(first.certificate.certNo).not.toBe(second.certificate.certNo);
  });

  it("keeps a learner's certificates out of another organization's list", async () => {
    const a = await signedInUser(ctx);
    const b = await signedInUser(ctx);
    await completeCourse(a.client);

    expect((await b.client.get('/api/me/certificates')).body).toEqual([]);
    expect(await scopedPrisma(ctx.prisma, b.user.orgId).certificate.count()).toBe(0);
  });
});

describe('public verification', () => {
  it('confirms a genuine certificate and masks the name without the QR code', async () => {
    const { client } = await signedInUser(ctx);
    const { certificate } = await issued(client);

    const plain = (await request(ctx.app).get(`/api/certificates/${certificate.certNo}`))
      .body as Verification;
    expect(plain.status).toBe('valid');
    expect(plain.signature.valid).toBe(true);
    expect(plain.nameMasked).toBe(true);
    expect(plain.recipientName).toBe('T*** U***');
    expect(JSON.stringify(plain)).not.toMatch(/@|verifyCode/);

    const withCode = (
      await request(ctx.app).get(
        `/api/certificates/${certificate.certNo}?k=${certificate.verifyCode}&locale=en`,
      )
    ).body as Verification;
    expect(withCode.recipientName).toBe('Test User');
    expect(withCode.courseTitle).toBe('KVKK Awareness Training');
  });

  it('calls a certificate invalid once its record is changed, and will not draw it', async () => {
    const { client } = await signedInUser(ctx);
    const { certificate } = await issued(client);
    await ctx.prisma.certificate.update({
      where: { id: certificate.id },
      data: { recipientName: 'Someone Else' },
    });

    const res = (await request(ctx.app).get(`/api/certificates/${certificate.certNo}`))
      .body as Verification;
    expect(res.status).toBe('invalid');
    expect(res.signature.valid).toBe(false);

    const png = await request(ctx.app).get(
      `/api/certificates/${certificate.certNo}/certificate.png?k=${certificate.verifyCode}`,
    );
    expect(png.status).toBe(409);
  });

  it('can be checked without asking Lumio, using the published public key', async () => {
    const { client } = await signedInUser(ctx);
    const { certificate } = await issued(client);
    const keys = (await request(ctx.app).get('/api/certificates/keys')).body as PublicKey[];
    const key = keys.find((item) => item.keyId === certificate.keyId)!;

    const genuine = verify(
      null,
      Buffer.from(canonicalPayload(signedFields(certificate))),
      createPublicKey(key.publicKeyPem),
      Buffer.from(certificate.signature, 'base64url'),
    );
    expect(key.algorithm).toBe('Ed25519');
    expect(genuine).toBe(true);
  });

  it('answers unknown and malformed numbers plainly', async () => {
    expect((await request(ctx.app).get('/api/certificates/LMS-2026-999999')).status).toBe(404);
    expect((await request(ctx.app).get('/api/certificates/not-a-number')).status).toBe(400);
  });
});

describe('documents', () => {
  it('serves the PNG and PDF only with the verification code', async () => {
    const { client } = await signedInUser(ctx);
    const { certificate } = await issued(client);
    const base = `/api/certificates/${certificate.certNo}`;

    expect((await request(ctx.app).get(`${base}/certificate.pdf`)).status).toBe(403);
    expect((await request(ctx.app).get(`${base}/certificate.pdf?k=wrong`)).status).toBe(403);

    const png = await request(ctx.app)
      .get(`${base}/certificate.png?k=${certificate.verifyCode}&w=800`)
      .buffer(true);
    expect(png.headers['content-type']).toBe('image/png');
    expect((png.body as Buffer).subarray(1, 4).toString()).toBe('PNG');

    const pdf = await request(ctx.app)
      .get(`${base}/certificate.pdf?k=${certificate.verifyCode}`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('cannot be turned into markup through a name', async () => {
    const svg = await renderSvg({
      certNo: 'LMS-2026-000001',
      recipientName: '<script>alert(1)</script>',
      orgName: 'A & B "Ltd"',
      courseTitleTr: 'Kurs',
      courseTitleEn: 'Course',
      instructorName: 'Eğitmen',
      hours: 1,
      startedAt: new Date(),
      completedAt: new Date(),
      issuedAt: new Date(),
      keyId: 'k',
      verifyUrl: 'http://localhost/dogrula/LMS-2026-000001?k=x',
      revoked: false,
    });

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('A &amp; B &quot;Ltd&quot;');
  });
});

describe('revoking', () => {
  it('lets a company admin revoke their own certificate, and the public page says so', async () => {
    const admin = await signedInAdmin(ctx, 'Anadolu Sigorta');
    const { certificate } = await issued(admin.client);

    const list = await admin.client.get('/api/org/certificates');
    expect(list.body.map((row: { certNo: string }) => row.certNo)).toEqual([certificate.certNo]);

    const res = await admin.client.post(`/api/certificates/${certificate.certNo}/revoke`, {
      reason: 'Issued in error',
    });
    expect(res.status).toBe(204);

    const page = (await request(ctx.app).get(`/api/certificates/${certificate.certNo}`))
      .body as Verification;
    expect(page.status).toBe('revoked');
    expect(page.revokedReason).toBe('Issued in error');
  });

  it("does not let an admin revoke another organization's certificate", async () => {
    const learner = await signedInUser(ctx);
    const { certificate } = await issued(learner.client);
    const admin = await signedInAdmin(ctx, 'Boğaziçi Lojistik');

    const res = await admin.client.post(`/api/certificates/${certificate.certNo}/revoke`, {
      reason: 'Not ours',
    });
    expect(res.status).toBe(404);
    expect(
      (await ctx.prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } })).revokedAt,
    ).toBeNull();
  });

  it('does not let a learner revoke anything', async () => {
    const learner = await signedInUser(ctx);
    const { certificate } = await issued(learner.client);

    const res = await learner.client.post(`/api/certificates/${certificate.certNo}/revoke`, {
      reason: 'Please',
    });
    expect(res.status).toBe(403);
  });
});
