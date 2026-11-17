import type { LearningStats } from '@lumio/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCatalog } from '../prisma/seed.js';
import { streaks, turkeyDay } from '../src/learning/stats.js';
import { buildApp, resetDatabase, signedInUser, testPrisma, type TestContext } from './helpers.js';

const COURSE = 'kvkk-awareness';
let ctx: TestContext;

beforeAll(async () => {
  await seedCatalog(testPrisma());
});

beforeEach(async () => {
  ctx = buildApp();
  await resetDatabase(ctx.prisma);
});

describe('streaks', () => {
  it("counts days in Turkey's time, not the server's", () => {
    // 22:30 UTC is already the next day in Istanbul (UTC+3).
    expect(turkeyDay(new Date('2026-11-16T22:30:00Z'))).toBe('2026-11-17');
    expect(turkeyDay(new Date('2026-11-16T20:30:00Z'))).toBe('2026-11-16');
  });

  it("keeps today's streak alive until the day is over, and remembers the longest", () => {
    const days = new Set(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-15', '2026-11-16']);
    expect(streaks(days, '2026-11-17')).toEqual({ current: 2, longest: 3 });
    expect(streaks(days, '2026-11-16')).toEqual({ current: 2, longest: 3 });
    expect(streaks(days, '2026-11-18')).toEqual({ current: 0, longest: 3 });
    expect(streaks(new Set(), '2026-11-18')).toEqual({ current: 0, longest: 0 });
  });
});

describe('learning stats', () => {
  it('adds up finished lessons and shows them on this week', async () => {
    const { client } = await signedInUser(ctx);
    await client.post(`/api/catalog/courses/${COURSE}/enroll`);
    const readings = await ctx.prisma.lesson.findMany({
      where: { section: { course: { slug: COURSE } }, type: { not: 'video' } },
    });
    for (const lesson of readings) {
      await client.agent
        .put(`/api/learn/${COURSE}/lessons/${lesson.id}/progress`)
        .set('x-csrf-token', client.csrf)
        .send({ completed: true });
    }

    const stats = (await client.get('/api/me/stats')).body as LearningStats;
    const minutes = readings.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
    expect(stats.lessonsCompleted).toBe(readings.length);
    expect(stats.minutesLearned).toBe(minutes);
    expect(stats.week).toHaveLength(7);
    expect(stats.week.at(-1)).toEqual({ date: turkeyDay(new Date()), minutes });
    expect(stats.streak).toEqual({ current: 1, longest: 1 });
  });

  it("counts only the member's own learning", async () => {
    const { client } = await signedInUser(ctx);
    const stats = (await client.get('/api/me/stats')).body as LearningStats;
    expect(stats).toMatchObject({ minutesLearned: 0, lessonsCompleted: 0, streak: { current: 0 } });
  });
});
