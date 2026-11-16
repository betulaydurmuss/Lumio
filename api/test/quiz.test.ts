import type { CourseOutline, QuizResult, QuizView } from '@lumio/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCatalog } from '../prisma/seed.js';
import { scopedPrisma } from '../src/tenancy.js';
import {
  buildApp,
  resetDatabase,
  signedInUser,
  testPrisma,
  type Client,
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

async function quizzes() {
  const all = await ctx.prisma.quiz.findMany({
    where: { course: { slug: COURSE } },
    include: { questions: { orderBy: { position: 'asc' } } },
  });
  return {
    section: all.find((quiz) => quiz.sectionId !== null)!,
    final: all.find((quiz) => quiz.sectionId === null)!,
  };
}

const rightAnswers = (quiz: { questions: { correctIndex: number }[] }) =>
  quiz.questions.map((question) => question.correctIndex);
const wrongAnswers = (quiz: { questions: { correctIndex: number }[] }) =>
  quiz.questions.map((question) => (question.correctIndex === 0 ? 1 : 0));

async function enrolled() {
  const account = await signedInUser(ctx);
  await account.client.post(`/api/catalog/courses/${COURSE}/enroll`);
  return account;
}

function attempt(client: Client, quizId: string, answers: number[]) {
  return client.post(`/api/learn/${COURSE}/quizzes/${quizId}/attempts?locale=en`, { answers });
}

async function finishLessons(client: Client) {
  const lessons = await ctx.prisma.lesson.findMany({
    where: { section: { course: { slug: COURSE } } },
  });
  for (const lesson of lessons) {
    await client.agent
      .put(`/api/learn/${COURSE}/lessons/${lesson.id}/progress`)
      .set('x-csrf-token', client.csrf)
      .send({ positionSeconds: 30, completed: true });
  }
}

describe('taking a quiz', () => {
  it('never sends the correct answers before grading', async () => {
    const { client } = await enrolled();
    const { section } = await quizzes();

    const res = await client.get(`/api/learn/${COURSE}/quizzes/${section.id}`);
    const view = res.body as QuizView;

    expect(view.questions).toHaveLength(3);
    expect(JSON.stringify(res.body)).not.toMatch(/correct|explanation|answer/i);
  });

  it('is only open to enrolled learners, and only in its own course', async () => {
    const { client } = await signedInUser(ctx);
    const { section } = await quizzes();
    expect((await client.get(`/api/learn/${COURSE}/quizzes/${section.id}`)).status).toBe(403);

    const other = await ctx.prisma.quiz.findFirstOrThrow({
      where: { course: { slug: 'phishing-and-social-engineering' } },
    });
    const learner = await enrolled();
    expect((await learner.client.get(`/api/learn/${COURSE}/quizzes/${other.id}`)).status).toBe(404);
  });

  it('grades on the server and explains every answer on a section quiz', async () => {
    const { client } = await enrolled();
    const { section } = await quizzes();

    const failed = (await attempt(client, section.id, wrongAnswers(section))).body as QuizResult;
    expect(failed.score).toBe(0);
    expect(failed.passed).toBe(false);
    expect(failed.results.every((result) => result.correctIndex !== null)).toBe(true);
    expect(failed.results[0]?.explanation).toContain('KVKK art. 6');

    const passed = (await attempt(client, section.id, rightAnswers(section))).body as QuizResult;
    expect(passed).toMatchObject({ score: 100, passed: true, passPercent: 70 });
  });

  it('applies the pass mark', async () => {
    const { client } = await enrolled();
    const { section } = await quizzes();
    const twoOfThree = rightAnswers(section).map((answer, index) =>
      index === 0 ? (answer === 0 ? 1 : 0) : answer,
    );

    const result = (await attempt(client, section.id, twoOfThree)).body as QuizResult;
    expect(result.score).toBe(67);
    expect(result.passed).toBe(false);
  });

  it('wants an answer for every question', async () => {
    const { client } = await enrolled();
    const { section } = await quizzes();

    expect((await attempt(client, section.id, [0])).status).toBe(400);
  });
});

describe('the final exam', () => {
  it('stays locked until every lesson is done', async () => {
    const { client } = await enrolled();
    const { final } = await quizzes();

    const view = (await client.get(`/api/learn/${COURSE}/quizzes/${final.id}`)).body as QuizView;
    expect(view.locked).toBe(true);
    expect(view.questions).toEqual([]);

    const res = await attempt(client, final.id, rightAnswers(final));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('quiz_locked');
  });

  it('does not reveal the answers when it is failed', async () => {
    const { client } = await enrolled();
    const { final } = await quizzes();
    await finishLessons(client);

    const failed = (await attempt(client, final.id, wrongAnswers(final))).body as QuizResult;
    expect(failed.passed).toBe(false);
    expect(failed.results.every((result) => result.correctIndex === null)).toBe(true);
    expect(failed.results.every((result) => result.explanation === null)).toBe(true);
    expect(failed.results.every((result) => result.correct === false)).toBe(true);
  });
});

describe('completing a course', () => {
  it('happens once, after every lesson and every quiz', async () => {
    const { client, user } = await enrolled();
    const { section, final } = await quizzes();
    const before = await ctx.prisma.course.findUniqueOrThrow({ where: { slug: COURSE } });

    await finishLessons(client);
    const sectionResult = (await attempt(client, section.id, rightAnswers(section)))
      .body as QuizResult;
    expect(sectionResult.courseCompleted).toBe(false);

    const finalResult = (await attempt(client, final.id, rightAnswers(final))).body as QuizResult;
    expect(finalResult.courseCompleted).toBe(true);
    expect(finalResult.course).toEqual({ completed: 10, total: 10, percent: 100 });

    // Passing again does not complete it a second time.
    const again = (await attempt(client, final.id, rightAnswers(final))).body as QuizResult;
    expect(again.courseCompleted).toBe(false);

    const outline = (await client.get(`/api/learn/${COURSE}`)).body as CourseOutline;
    expect(outline.completedAt).not.toBeNull();
    expect(outline.finalQuiz).toMatchObject({ passed: true, bestScore: 100, locked: false });

    const after = await ctx.prisma.course.findUniqueOrThrow({ where: { slug: COURSE } });
    expect(after.completionCount).toBe(before.completionCount + 1);
    expect(
      await ctx.prisma.auditLog.count({ where: { actorId: user.id, action: 'course.completed' } }),
    ).toBe(1);
  });

  it("keeps one organization's attempts out of another's sight", async () => {
    const a = await enrolled();
    const b = await signedInUser(ctx);
    const { section } = await quizzes();
    await attempt(a.client, section.id, rightAnswers(section));

    expect(await scopedPrisma(ctx.prisma, b.user.orgId).quizAttempt.count()).toBe(0);
    expect(await scopedPrisma(ctx.prisma, a.user.orgId).quizAttempt.count()).toBe(1);
  });
});
