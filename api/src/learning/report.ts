import {
  assignmentStatus,
  type Assignment,
  type Locale,
  type Transcript,
  type TranscriptEntry,
} from '@lumio/shared';
import { courseProgress } from '../routes/learn.js';
import type { ScopedPrisma } from '../tenancy.js';

/** Today as a calendar date, the way due dates are stored. */
export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

const key = (userId: string, courseId: string) => `${userId}:${courseId}`;

/**
 * How far each member got in each course: lessons done and quizzes passed out
 * of all of them, the same rule the player uses. Reads through the tenant
 * scope, so only this organization's progress is counted.
 */
export async function progressOf(db: ScopedPrisma, userIds: string[], courseIds: string[]) {
  const progress = new Map<string, { completed: number; total: number; percent: number }>();
  if (userIds.length === 0 || courseIds.length === 0) return progress;

  const [courses, lessons, quizzes] = await Promise.all([
    db.course.findMany({
      where: { id: { in: courseIds } },
      select: {
        id: true,
        sections: { select: { lessons: { select: { id: true } } } },
        quizzes: { select: { id: true } },
      },
    }),
    db.lessonProgress.findMany({
      where: { userId: { in: userIds }, courseId: { in: courseIds }, completedAt: { not: null } },
      select: { userId: true, courseId: true, lessonId: true },
    }),
    db.quizAttempt.findMany({
      where: { userId: { in: userIds }, courseId: { in: courseIds }, passed: true },
      select: { userId: true, courseId: true, quizId: true },
      distinct: ['userId', 'quizId'],
    }),
  ]);

  const parts = new Map(
    courses.map((course) => [
      course.id,
      {
        lessons: new Set(course.sections.flatMap((section) => section.lessons.map((l) => l.id))),
        quizzes: new Set(course.quizzes.map((quiz) => quiz.id)),
      },
    ]),
  );
  const done = new Map<string, number>();
  const bump = (k: string) => done.set(k, (done.get(k) ?? 0) + 1);
  // Only lessons and quizzes the course still has count, so a removed lesson
  // cannot push anyone past 100%.
  for (const row of lessons) {
    if (parts.get(row.courseId)?.lessons.has(row.lessonId)) bump(key(row.userId, row.courseId));
  }
  for (const row of quizzes) {
    if (parts.get(row.courseId)?.quizzes.has(row.quizId)) bump(key(row.userId, row.courseId));
  }

  for (const userId of userIds) {
    for (const [courseId, course] of parts) {
      const total = course.lessons.size + course.quizzes.size;
      progress.set(
        key(userId, courseId),
        courseProgress(done.get(key(userId, courseId)) ?? 0, total),
      );
    }
  }
  return progress;
}

/** Every assignment in the organization with where it stands, most urgent first. */
export async function assignmentReport(db: ScopedPrisma, locale: Locale): Promise<Assignment[]> {
  const rows = await db.assignment.findMany({
    include: {
      user: { select: { id: true, displayName: true, email: true } },
      course: { select: { id: true, slug: true, titleTr: true, titleEn: true } },
    },
  });
  const enrollments = await db.enrollment.findMany({
    where: {
      userId: { in: [...new Set(rows.map((row) => row.userId))] },
      courseId: { in: [...new Set(rows.map((row) => row.courseId))] },
    },
    select: { userId: true, courseId: true, completedAt: true },
  });
  const completedAt = new Map(
    enrollments.map((row) => [key(row.userId, row.courseId), row.completedAt]),
  );
  const progress = await progressOf(
    db,
    [...new Set(rows.map((row) => row.userId))],
    [...new Set(rows.map((row) => row.courseId))],
  );
  const now = today();

  const report = rows.map((row): Assignment => {
    const k = key(row.userId, row.courseId);
    const finished = completedAt.get(k) ?? null;
    const percent = finished ? 100 : (progress.get(k)?.percent ?? 0);
    const dueOn = dateOnly(row.dueOn);
    return {
      id: row.id,
      member: row.user,
      course: {
        slug: row.course.slug,
        title: locale === 'tr' ? row.course.titleTr : row.course.titleEn,
      },
      assignedAt: row.createdAt.toISOString(),
      dueOn,
      status: assignmentStatus(percent, Boolean(finished), dueOn, now),
      percent,
      completedAt: finished?.toISOString() ?? null,
    };
  });

  const order = { overdue: 0, not_started: 1, in_progress: 2, completed: 3 } as const;
  return report.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999') ||
      a.member.displayName.localeCompare(b.member.displayName),
  );
}

/** One learner's record of study, as they or their organization's admin sees it. */
export async function transcriptFor(
  db: ScopedPrisma,
  userId: string,
  locale: Locale,
): Promise<Transcript> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { organization: true },
  });
  const [enrollments, assignments, certificates] = await Promise.all([
    db.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            slug: true,
            titleTr: true,
            titleEn: true,
            durationMinutes: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.assignment.findMany({ where: { userId }, select: { courseId: true, dueOn: true } }),
    db.certificate.findMany({
      where: { userId, revokedAt: null },
      select: { courseId: true, certNo: true },
    }),
  ]);
  const progress = await progressOf(
    db,
    [userId],
    enrollments.map((row) => row.courseId),
  );
  const due = new Map(assignments.map((row) => [row.courseId, row.dueOn]));
  const certificateOf = new Map(certificates.map((row) => [row.courseId, row.certNo]));

  const entries = enrollments.map((row): TranscriptEntry => ({
    course: {
      slug: row.course.slug,
      title: locale === 'tr' ? row.course.titleTr : row.course.titleEn,
    },
    minutes: row.course.durationMinutes,
    enrolledAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    percent: row.completedAt ? 100 : (progress.get(key(userId, row.courseId))?.percent ?? 0),
    certificateNo: certificateOf.get(row.courseId) ?? null,
    assigned: due.has(row.courseId),
    dueOn: dateOnly(due.get(row.courseId) ?? null),
  }));
  const finished = entries.filter((entry) => entry.completedAt);
  return {
    learner: {
      displayName: user.displayName,
      email: user.email,
      organization: user.organization.name,
    },
    generatedAt: new Date().toISOString(),
    totals: {
      courses: entries.length,
      completed: finished.length,
      completedMinutes: finished.reduce((sum, entry) => sum + entry.minutes, 0),
      certificates: entries.filter((entry) => entry.certificateNo).length,
    },
    entries,
  };
}

/**
 * One CSV cell. Quoted always, and a leading =, +, - or @ is defused, so a
 * name cannot turn into a formula when the report is opened in a spreadsheet.
 */
export function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  const safe = /^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
