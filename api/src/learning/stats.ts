import type { LearningStats } from '@lumio/shared';
import type { ScopedPrisma } from '../tenancy.js';

/** A calendar day in Turkey, where Lumio's learners are: YYYY-MM-DD. */
export function turkeyDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Days in a row with activity. The current streak may end yesterday: a learner
 * who has not studied yet today has not broken it.
 */
export function streaks(days: Set<string>, today: string) {
  let current = 0;
  let cursor = days.has(today) ? today : previousDay(today);
  while (days.has(cursor)) {
    current += 1;
    cursor = previousDay(cursor);
  }
  let longest = 0;
  let run = 0;
  let last: string | null = null;
  for (const day of [...days].sort()) {
    run = last !== null && previousDay(day) === last ? run + 1 : 1;
    longest = Math.max(longest, run);
    last = day;
  }
  return { current, longest };
}

export async function learningStats(
  db: ScopedPrisma,
  userId: string,
  now = new Date(),
): Promise<LearningStats> {
  const [lessons, attempts, coursesCompleted, certificates] = await Promise.all([
    db.lessonProgress.findMany({
      where: { userId, completedAt: { not: null } },
      select: { completedAt: true, lesson: { select: { durationMinutes: true } } },
    }),
    db.quizAttempt.findMany({ where: { userId }, select: { createdAt: true } }),
    db.enrollment.count({ where: { userId, completedAt: { not: null } } }),
    db.certificate.count({ where: { userId, revokedAt: null } }),
  ]);

  const today = turkeyDay(now);
  const minutesByDay = new Map<string, number>();
  const active = new Set<string>();
  for (const row of lessons) {
    const day = turkeyDay(row.completedAt!);
    active.add(day);
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + row.lesson.durationMinutes);
  }
  for (const row of attempts) active.add(turkeyDay(row.createdAt));

  const week: LearningStats['week'] = [];
  let cursor = today;
  for (let i = 0; i < 7; i++) {
    week.unshift({ date: cursor, minutes: minutesByDay.get(cursor) ?? 0 });
    cursor = previousDay(cursor);
  }

  return {
    minutesLearned: lessons.reduce((sum, row) => sum + row.lesson.durationMinutes, 0),
    lessonsCompleted: lessons.length,
    coursesCompleted,
    certificates,
    streak: streaks(active, today),
    week,
  };
}
