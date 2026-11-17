import type { CourseOutline, LessonView } from '@lumio/shared';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCatalog } from '../prisma/seed.js';
import { MediaSigner } from '../src/media/signer.js';
import { isValidMediaKey } from '../src/media/store.js';
import { scopedPrisma } from '../src/tenancy.js';
import {
  buildApp,
  Client,
  resetDatabase,
  signedInUser,
  startedWatchingEarlier,
  testPrisma,
  type TestContext,
} from './helpers.js';

const COURSE = 'kvkk-awareness';
let ctx: TestContext;

beforeAll(async () => {
  await seedCatalog(testPrisma());
});

beforeEach(async () => {
  ctx = buildApp();
  await resetDatabase(ctx.prisma);
});

async function lessonsOf(slug: string) {
  return ctx.prisma.lesson.findMany({
    where: { section: { course: { slug } } },
    orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
  });
}

async function enrolledLearner() {
  const account = await signedInUser(ctx);
  expect((await account.client.post(`/api/catalog/courses/${COURSE}/enroll`)).status).toBe(201);
  return account;
}

function saveProgress(client: Client, lessonId: string, body: object) {
  return client.agent
    .put(`/api/learn/${COURSE}/lessons/${lessonId}/progress`)
    .set('x-csrf-token', client.csrf)
    .send(body);
}

/** Plays a lesson through: starts it, lets the clock run, then finishes it. */
async function watchThrough(account: { client: Client; user: { id: string } }, lessonId: string) {
  await saveProgress(account.client, lessonId, { positionSeconds: 0 });
  await startedWatchingEarlier(ctx.prisma, account.user.id);
  return saveProgress(account.client, lessonId, { positionSeconds: 30, completed: true });
}

describe('opening lessons', () => {
  it('lets a visitor open free previews and nothing else', async () => {
    const lessons = await lessonsOf(COURSE);
    const preview = lessons.find((lesson) => lesson.isPreview)!;
    const locked = lessons.find((lesson) => !lesson.isPreview)!;

    const open = await request(ctx.app).get(`/api/learn/${COURSE}/lessons/${preview.id}`);
    expect(open.status).toBe(200);
    expect(open.body.progress).toBeNull();

    const closed = await request(ctx.app).get(`/api/learn/${COURSE}/lessons/${locked.id}`);
    expect(closed.status).toBe(403);
    expect(closed.body.error.code).toBe('not_enrolled');
  });

  it('opens every lesson for an enrolled learner, with content in their language', async () => {
    const { client } = await enrolledLearner();
    const reading = (await lessonsOf(COURSE)).find((lesson) => lesson.type === 'reading')!;

    const tr = await client.get(`/api/learn/${COURSE}/lessons/${reading.id}?locale=tr`);
    const en = await client.get(`/api/learn/${COURSE}/lessons/${reading.id}?locale=en`);

    const trView = tr.body as LessonView;
    expect(trView.body?.kind).toBe('reading');
    expect(JSON.stringify(trView.body)).toContain('30 gün');
    expect(JSON.stringify((en.body as LessonView).body)).toContain('30 days');
  });

  it('does not open a lesson through another course', async () => {
    const { client } = await enrolledLearner();
    const foreign = (await lessonsOf('owasp-top-10-in-practice'))[0]!;

    expect((await client.get(`/api/learn/${COURSE}/lessons/${foreign.id}`)).status).toBe(404);
  });

  it('gives video lessons a signed link and captions in both languages', async () => {
    const { client } = await enrolledLearner();
    const video = (await lessonsOf(COURSE)).find((lesson) => lesson.type === 'video')!;

    const view = (await client.get(`/api/learn/${COURSE}/lessons/${video.id}`)).body as LessonView;

    expect(view.video?.src).toMatch(/^\/api\/media\/[\w-]+\.[\w-]+$/);
    expect(view.video?.captions.map((caption) => caption.lang)).toEqual(['tr', 'en']);
    expect(view.video?.src).not.toContain('demo/lesson.mp4');
  });
});

describe('media links', () => {
  it('streams the file, and serves a range for seeking', async () => {
    const { client } = await enrolledLearner();
    const video = (await lessonsOf(COURSE)).find((lesson) => lesson.type === 'video')!;
    const { src } = (
      (await client.get(`/api/learn/${COURSE}/lessons/${video.id}`)).body as LessonView
    ).video!;

    const whole = await request(ctx.app).get(src);
    expect(whole.status).toBe(200);
    expect(whole.headers['content-type']).toBe('video/mp4');

    const part = await request(ctx.app).get(src).set('Range', 'bytes=0-99');
    expect(part.status).toBe(206);
    expect(part.headers['content-length']).toBe('100');
    expect(part.headers['content-range']).toMatch(/^bytes 0-99\/\d+$/);
  });

  it('refuses a link that was tampered with', async () => {
    const signer = new MediaSigner('m'.repeat(40));
    const [payload, signature] = signer.sign('demo/lesson.mp4').split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ k: 'demo/captions.tr.vtt', e: 9e9 }),
    ).toString('base64url');

    expect((await request(ctx.app).get(`/api/media/${forgedPayload}.${signature}`)).status).toBe(
      403,
    );
    expect((await request(ctx.app).get(`/api/media/${payload}.AAAA`)).status).toBe(403);
  });

  it('refuses a link signed with another secret and an expired link', async () => {
    const foreign = new MediaSigner('x'.repeat(40)).sign('demo/lesson.mp4');
    expect((await request(ctx.app).get(`/api/media/${foreign}`)).status).toBe(403);

    const old = new MediaSigner('m'.repeat(40)).sign('demo/lesson.mp4', 60, Date.now() - 3_600_000);
    expect((await request(ctx.app).get(`/api/media/${old}`)).status).toBe(410);
  });

  it('refuses a link that claims to last longer than the server ever signs one for', () => {
    // A genuine signature on a ten-year link can only come from a leaked secret.
    const signer = new MediaSigner('m'.repeat(40));
    const forever = signer.sign('demo/lesson.mp4', 10 * 365 * 24 * 3600);
    expect(signer.verify(forever)).toEqual({ error: 'invalid' });
    expect(signer.verify(signer.sign('demo/lesson.mp4'))).toEqual({ key: 'demo/lesson.mp4' });
  });

  it('hands out a lesson file as a download, behind its own link', async () => {
    const { client } = await enrolledLearner();
    const lesson = (await lessonsOf(COURSE)).find(
      (row) => row.titleEn === 'Rights of the data subject',
    )!;

    const view = (await client.get(`/api/learn/${COURSE}/lessons/${lesson.id}?locale=en`))
      .body as LessonView;
    expect(view.attachments).toEqual([
      expect.objectContaining({
        title: 'Data subject request checklist',
        fileName: 'kvkk-basvuru-kontrol-listesi.txt',
      }),
    ]);
    const file = view.attachments[0]!;
    expect(file.sizeBytes).toBeGreaterThan(100);

    const download = await request(ctx.app).get(file.href);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(download.headers['content-disposition']).toBe(
      'attachment; filename="kvkk-basvuru-kontrol-listesi.txt"',
    );
    expect(download.text).toContain('KVKK');
  });

  it('keeps the files of a locked lesson from visitors', async () => {
    const lesson = (await lessonsOf(COURSE)).find(
      (row) => row.titleEn === 'Rights of the data subject',
    )!;
    expect(lesson.isPreview).toBe(false);
    const res = await request(ctx.app).get(`/api/learn/${COURSE}/lessons/${lesson.id}`);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('/api/media/');
  });

  it('never lets a key leave the media folder', () => {
    expect(isValidMediaKey('demo/lesson.mp4')).toBe(true);
    for (const key of [
      '../.env',
      'demo/../../.env',
      '/etc/passwd',
      'demo/lesson.mp4.exe',
      'x.ts',
      // Nothing that a browser would run as a page is ever served.
      'demo/page.html',
      'demo/image.svg',
      'demo/script.js',
    ]) {
      expect(isValidMediaKey(key)).toBe(false);
    }
  });
});

describe('progress', () => {
  it('does not take the player at its word about how far it got', async () => {
    // A client can send any position. The server also asks how long ago this
    // learner started the video: 27 of 30 seconds cannot be watched in one.
    const { client } = await enrolledLearner();
    const video = (await lessonsOf(COURSE)).find((lesson) => lesson.type === 'video')!;

    const res = await saveProgress(client, video.id, { positionSeconds: 30, completed: true });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('not_watched');
  });

  it('only completes a video once most of it has been watched', async () => {
    const { client, user } = await enrolledLearner();
    const video = (await lessonsOf(COURSE)).find((lesson) => lesson.type === 'video')!;

    await saveProgress(client, video.id, { positionSeconds: 0 });
    await startedWatchingEarlier(ctx.prisma, user.id);
    const early = await saveProgress(client, video.id, { positionSeconds: 10, completed: true });
    expect(early.status).toBe(422);
    expect(early.body.error.code).toBe('not_watched');

    const done = await saveProgress(client, video.id, { positionSeconds: 28, completed: true });
    expect(done.status).toBe(200);
    expect(done.body.completed).toBe(true);
    expect(done.body.course).toEqual({ completed: 1, total: 10, percent: 10 });
  });

  it('remembers the position to resume a video', async () => {
    const { client } = await enrolledLearner();
    const video = (await lessonsOf(COURSE)).find((lesson) => lesson.type === 'video')!;

    await saveProgress(client, video.id, { positionSeconds: 17 });
    const view = (await client.get(`/api/learn/${COURSE}/lessons/${video.id}`)).body as LessonView;

    expect(view.progress).toEqual({ positionSeconds: 17, completed: false });
  });

  it('resumes the outline at the first lesson not yet done', async () => {
    const account = await enrolledLearner();
    const { client } = account;
    const lessons = await lessonsOf(COURSE);
    const [first, second] = lessons;
    await watchThrough(account, first!.id);

    const outline = (await client.get(`/api/learn/${COURSE}`)).body as CourseOutline;
    expect(outline.resumeLessonId).toBe(second!.id);
    expect(outline.sections[0]?.lessons[0]?.completed).toBe(true);

    const learning = await client.get('/api/me/learning');
    expect(learning.body[0].progress.completed).toBe(1);
    expect(learning.body[0].resumeLessonId).toBe(second!.id);
  });

  it('does not save progress for a course the learner is not enrolled in', async () => {
    const { client } = await signedInUser(ctx);
    const lesson = (await lessonsOf(COURSE))[0]!;

    expect((await saveProgress(client, lesson.id, { positionSeconds: 5 })).status).toBe(403);
  });

  it("keeps one organization's progress out of another's sight", async () => {
    const a = await enrolledLearner();
    const b = await signedInUser(ctx);
    const lesson = (await lessonsOf(COURSE))[0]!;
    await watchThrough(a, lesson.id);

    expect(await scopedPrisma(ctx.prisma, b.user.orgId).lessonProgress.count()).toBe(0);
    expect(await scopedPrisma(ctx.prisma, a.user.orgId).lessonProgress.count()).toBe(1);
  });
});
