import {
  lessonBodySchema,
  localeSchema,
  progressUpdateSchema,
  VIDEO_COMPLETION_RATIO,
  type CourseOutline,
  type CourseProgress,
  type LessonView,
  type Locale,
  type ProgressResult,
} from '@lumio/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../db.js';
import { auth, optionalAuth, requireAuth, type AuthContext } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import type { Services } from '../services.js';

const slugParam = z.string().regex(/^[a-z0-9-]{1,80}$/);
const idParam = z.uuid();

const pick = <T>(locale: Locale, tr: T, en: T) => (locale === 'tr' ? tr : en);

function localeOf(req: Request): Locale {
  const parsed = localeSchema.safeParse(req.query.locale);
  return parsed.success ? parsed.data : 'tr';
}

/** A published course with its lessons in reading order. */
async function loadCourse(prisma: PrismaClient, slug: string) {
  const course = await prisma.course.findFirst({
    where: { slug, status: 'published' },
    include: {
      sections: {
        orderBy: { position: 'asc' },
        include: { lessons: { orderBy: { position: 'asc' } } },
      },
    },
  });
  if (!course) throw new HttpError(404, 'not_found', 'Course not found');
  const lessons = course.sections.flatMap((section) =>
    section.lessons.map((lesson) => ({ ...lesson, section })),
  );
  return { course, lessons };
}

async function isEnrolled(context: AuthContext | undefined, courseId: string) {
  if (!context) return false;
  const enrollment = await context.db.enrollment.findFirst({
    where: { userId: context.userId, courseId },
  });
  return Boolean(enrollment);
}

/** Completed lesson ids for this learner in this course, through the tenant scope. */
async function completedLessons(context: AuthContext, courseId: string) {
  const rows = await context.db.lessonProgress.findMany({
    where: { userId: context.userId, courseId, completedAt: { not: null } },
    select: { lessonId: true },
  });
  return new Set(rows.map((row) => row.lessonId));
}

export function courseProgress(completed: number, total: number): CourseProgress {
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function learnRouter(services: Services): Router {
  const router = Router();
  const { prisma } = services;

  router.get('/:slug', optionalAuth(services), async (req, res) => {
    const locale = localeOf(req);
    const { course, lessons } = await loadCourse(prisma, slugParam.parse(req.params.slug));
    const enrolled = await isEnrolled(req.auth, course.id);
    const done = enrolled && req.auth ? await completedLessons(req.auth, course.id) : new Set();

    const resume = enrolled ? (lessons.find((lesson) => !done.has(lesson.id)) ?? lessons[0]) : null;
    const body: CourseOutline = {
      course: { slug: course.slug, title: pick(locale, course.titleTr, course.titleEn) },
      enrolled,
      sections: course.sections.map((section) => ({
        title: pick(locale, section.titleTr, section.titleEn),
        lessons: section.lessons.map((lesson) => ({
          id: lesson.id,
          title: pick(locale, lesson.titleTr, lesson.titleEn),
          type: lesson.type,
          durationMinutes: lesson.durationMinutes,
          isPreview: lesson.isPreview,
          completed: done.has(lesson.id),
          accessible: enrolled || lesson.isPreview,
        })),
      })),
      progress: enrolled ? courseProgress(done.size, lessons.length) : null,
      resumeLessonId: resume?.id ?? null,
    };
    res.json(body);
  });

  router.get('/:slug/lessons/:lessonId', optionalAuth(services), async (req, res) => {
    const locale = localeOf(req);
    const { course, lessons } = await loadCourse(prisma, slugParam.parse(req.params.slug));
    const lessonId = idParam.parse(req.params.lessonId);
    // Looked up inside this course, so a lesson id from another course is simply not found.
    const index = lessons.findIndex((lesson) => lesson.id === lessonId);
    const lesson = lessons[index];
    if (!lesson) throw new HttpError(404, 'not_found', 'Lesson not found');

    const enrolled = await isEnrolled(req.auth, course.id);
    if (!enrolled && !lesson.isPreview) {
      throw new HttpError(403, 'not_enrolled', 'Enrol in the course to open this lesson');
    }

    const progress =
      enrolled && req.auth
        ? await req.auth.db.lessonProgress.findFirst({
            where: { userId: req.auth.userId, lessonId: lesson.id },
          })
        : null;

    const rawBody = pick(locale, lesson.bodyTr, lesson.bodyEn);
    const parsedBody = rawBody === null ? null : lessonBodySchema.safeParse(rawBody);
    const link = (key: string) => `/api/media/${services.media.signer.sign(key)}`;
    const captions = [
      lesson.captionsTrKey ? { lang: 'tr', src: link(lesson.captionsTrKey) } : null,
      lesson.captionsEnKey ? { lang: 'en', src: link(lesson.captionsEnKey) } : null,
    ].filter((caption) => caption !== null);

    const body: LessonView = {
      id: lesson.id,
      title: pick(locale, lesson.titleTr, lesson.titleEn),
      sectionTitle: pick(locale, lesson.section.titleTr, lesson.section.titleEn),
      type: lesson.type,
      durationMinutes: lesson.durationMinutes,
      body: parsedBody?.success ? parsedBody.data : null,
      video:
        lesson.videoKey && lesson.videoSeconds
          ? { src: link(lesson.videoKey), seconds: lesson.videoSeconds, captions }
          : null,
      progress: progress
        ? { positionSeconds: progress.positionSeconds, completed: Boolean(progress.completedAt) }
        : null,
      // Visitors moving between previews only see the neighbours they can open.
      previousLessonId:
        lessons
          .slice(0, index)
          .reverse()
          .find((other) => enrolled || other.isPreview)?.id ?? null,
      nextLessonId:
        lessons.slice(index + 1).find((other) => enrolled || other.isPreview)?.id ?? null,
    };
    res.json(body);
  });

  router.put('/:slug/lessons/:lessonId/progress', requireAuth(services), async (req, res) => {
    const context = auth(req);
    const update = progressUpdateSchema.parse(req.body);
    const { course, lessons } = await loadCourse(prisma, slugParam.parse(req.params.slug));
    const lesson = lessons.find((item) => item.id === idParam.parse(req.params.lessonId));
    if (!lesson) throw new HttpError(404, 'not_found', 'Lesson not found');
    if (!(await isEnrolled(context, course.id))) {
      throw new HttpError(403, 'not_enrolled', 'Enrol in the course to save progress');
    }

    const existing = await context.db.lessonProgress.findFirst({
      where: { userId: context.userId, lessonId: lesson.id },
    });
    const position = update.positionSeconds ?? existing?.positionSeconds ?? 0;

    let completedAt = existing?.completedAt ?? null;
    if (update.completed && !completedAt) {
      // A video only counts once most of it has actually been played.
      if (lesson.type === 'video' && lesson.videoSeconds) {
        const needed = Math.floor(lesson.videoSeconds * VIDEO_COMPLETION_RATIO);
        if (position < needed) {
          throw new HttpError(422, 'not_watched', 'Watch the video before completing it');
        }
      }
      completedAt = new Date();
    }

    // One upsert, so two saves racing from the player cannot create two rows.
    await context.db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: context.userId, lessonId: lesson.id } },
      create: {
        orgId: context.orgId,
        userId: context.userId,
        lessonId: lesson.id,
        courseId: course.id,
        positionSeconds: position,
        completedAt,
      },
      update: { positionSeconds: position, completedAt },
    });

    const done = await completedLessons(context, course.id);
    const body: ProgressResult = {
      completed: Boolean(completedAt),
      course: courseProgress(done.size, lessons.length),
    };
    res.json(body);
  });

  return router;
}
