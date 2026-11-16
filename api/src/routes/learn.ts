import {
  lessonBodySchema,
  localeSchema,
  progressUpdateSchema,
  quizAnswersSchema,
  VIDEO_COMPLETION_RATIO,
  type CourseOutline,
  type CourseProgress,
  type LessonView,
  type Locale,
  type OutlineQuiz,
  type ProgressResult,
  type QuizResult,
  type QuizView,
} from '@lumio/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { audit } from '../audit.js';
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

/** A published course with its lessons in reading order and its quizzes. */
async function loadCourse(prisma: PrismaClient, slug: string) {
  const course = await prisma.course.findFirst({
    where: { slug, status: 'published' },
    include: {
      sections: {
        orderBy: { position: 'asc' },
        include: { lessons: { orderBy: { position: 'asc' } } },
      },
      quizzes: { include: { _count: { select: { questions: true } } } },
    },
  });
  if (!course) throw new HttpError(404, 'not_found', 'Course not found');
  const lessons = course.sections.flatMap((section) =>
    section.lessons.map((lesson) => ({ ...lesson, section })),
  );
  return { course, lessons, quizzes: course.quizzes };
}

type LoadedCourse = Awaited<ReturnType<typeof loadCourse>>;

async function isEnrolled(context: AuthContext | undefined, courseId: string) {
  if (!context) return false;
  const enrollment = await context.db.enrollment.findFirst({
    where: { userId: context.userId, courseId },
  });
  return Boolean(enrollment);
}

/** What this learner has done in this course, read through the tenant scope. */
async function learnerState(context: AuthContext, courseId: string) {
  const [progress, attempts, enrollment] = await Promise.all([
    context.db.lessonProgress.findMany({
      where: { userId: context.userId, courseId, completedAt: { not: null } },
      select: { lessonId: true },
    }),
    context.db.quizAttempt.findMany({
      where: { userId: context.userId, courseId },
      select: { quizId: true, score: true, passed: true },
    }),
    context.db.enrollment.findFirst({ where: { userId: context.userId, courseId } }),
  ]);
  const bestScores = new Map<string, number>();
  for (const attempt of attempts) {
    bestScores.set(attempt.quizId, Math.max(bestScores.get(attempt.quizId) ?? 0, attempt.score));
  }
  return {
    doneLessons: new Set(progress.map((row) => row.lessonId)),
    passedQuizzes: new Set(attempts.filter((a) => a.passed).map((a) => a.quizId)),
    bestScores,
    completedAt: enrollment?.completedAt ?? null,
  };
}

type LearnerState = Awaited<ReturnType<typeof learnerState>>;

export function courseProgress(completed: number, total: number): CourseProgress {
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

/** Lessons and quizzes both count towards a course's progress. */
function progressOf(loaded: LoadedCourse, state: LearnerState) {
  return courseProgress(
    state.doneLessons.size + state.passedQuizzes.size,
    loaded.lessons.length + loaded.quizzes.length,
  );
}

const allLessonsDone = (loaded: LoadedCourse, state: LearnerState) =>
  loaded.lessons.every((lesson) => state.doneLessons.has(lesson.id));

/**
 * Marks the enrolment complete the first time every lesson is done and every
 * quiz is passed. The conditional update makes it happen exactly once, even if
 * two requests finish the course at the same moment.
 */
async function completeIfFinished(
  context: AuthContext,
  prisma: PrismaClient,
  loaded: LoadedCourse,
  req: Request,
): Promise<{ state: LearnerState; newlyCompleted: boolean }> {
  const state = await learnerState(context, loaded.course.id);
  const finished =
    allLessonsDone(loaded, state) &&
    loaded.quizzes.every((quiz) => state.passedQuizzes.has(quiz.id));
  if (!finished || state.completedAt) return { state, newlyCompleted: false };

  const now = new Date();
  const { count } = await context.db.enrollment.updateMany({
    where: { userId: context.userId, courseId: loaded.course.id, completedAt: null },
    data: { completedAt: now },
  });
  if (count === 0) return { state, newlyCompleted: false };

  await prisma.course.update({
    where: { id: loaded.course.id },
    data: { completionCount: { increment: 1 } },
  });
  await audit(context.db, {
    orgId: context.orgId,
    actorId: context.userId,
    action: 'course.completed',
    targetType: 'course',
    targetId: loaded.course.id,
    ipAddress: req.ip,
  });
  return { state: { ...state, completedAt: now }, newlyCompleted: true };
}

export function learnRouter(services: Services): Router {
  const router = Router();
  const { prisma } = services;

  router.get('/:slug', optionalAuth(services), async (req, res) => {
    const locale = localeOf(req);
    const loaded = await loadCourse(prisma, slugParam.parse(req.params.slug));
    const { course, lessons, quizzes } = loaded;
    const enrolled = await isEnrolled(req.auth, course.id);
    const state = enrolled && req.auth ? await learnerState(req.auth, course.id) : null;
    const lessonsDone = state ? allLessonsDone(loaded, state) : false;

    const outlineQuiz = (quiz: (typeof quizzes)[number]): OutlineQuiz => {
      const locked = quiz.sectionId === null && !lessonsDone;
      return {
        id: quiz.id,
        title: pick(locale, quiz.titleTr, quiz.titleEn),
        questionCount: quiz._count.questions,
        passed: state?.passedQuizzes.has(quiz.id) ?? false,
        bestScore: state?.bestScores.get(quiz.id) ?? null,
        locked,
        accessible: enrolled && !locked,
      };
    };

    const resume = state
      ? (lessons.find((lesson) => !state.doneLessons.has(lesson.id)) ?? lessons[0])
      : null;
    const finalQuiz = quizzes.find((quiz) => quiz.sectionId === null);
    const body: CourseOutline = {
      course: { slug: course.slug, title: pick(locale, course.titleTr, course.titleEn) },
      enrolled,
      sections: course.sections.map((section) => {
        const quiz = quizzes.find((item) => item.sectionId === section.id);
        return {
          title: pick(locale, section.titleTr, section.titleEn),
          lessons: section.lessons.map((lesson) => ({
            id: lesson.id,
            title: pick(locale, lesson.titleTr, lesson.titleEn),
            type: lesson.type,
            durationMinutes: lesson.durationMinutes,
            isPreview: lesson.isPreview,
            completed: state?.doneLessons.has(lesson.id) ?? false,
            accessible: enrolled || lesson.isPreview,
          })),
          quiz: quiz ? outlineQuiz(quiz) : null,
        };
      }),
      finalQuiz: finalQuiz ? outlineQuiz(finalQuiz) : null,
      completedAt: state?.completedAt?.toISOString() ?? null,
      progress: state ? progressOf(loaded, state) : null,
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
    const loaded = await loadCourse(prisma, slugParam.parse(req.params.slug));
    const lesson = loaded.lessons.find((item) => item.id === idParam.parse(req.params.lessonId));
    if (!lesson) throw new HttpError(404, 'not_found', 'Lesson not found');
    if (!(await isEnrolled(context, loaded.course.id))) {
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
        courseId: loaded.course.id,
        positionSeconds: position,
        completedAt,
      },
      update: { positionSeconds: position, completedAt },
    });

    // A course without quizzes is finished by its last lesson.
    const { state } = await completeIfFinished(context, prisma, loaded, req);
    const body: ProgressResult = {
      completed: Boolean(completedAt),
      course: progressOf(loaded, state),
    };
    res.json(body);
  });

  async function quizFor(req: Request) {
    const context = auth(req);
    const loaded = await loadCourse(prisma, slugParam.parse(req.params.slug));
    const quizId = idParam.parse(req.params.quizId);
    // Looked up inside this course, like lessons.
    if (!loaded.quizzes.some((quiz) => quiz.id === quizId)) {
      throw new HttpError(404, 'not_found', 'Quiz not found');
    }
    if (!(await isEnrolled(context, loaded.course.id))) {
      throw new HttpError(403, 'not_enrolled', 'Enrol in the course to take this quiz');
    }
    const quiz = await prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      include: { questions: { orderBy: { position: 'asc' } } },
    });
    const state = await learnerState(context, loaded.course.id);
    const locked = quiz.sectionId === null && !allLessonsDone(loaded, state);
    return { context, loaded, quiz, locked };
  }

  router.get('/:slug/quizzes/:quizId', requireAuth(services), async (req, res) => {
    const locale = localeOf(req);
    const { context, quiz, locked } = await quizFor(req);
    const attempts = await context.db.quizAttempt.findMany({
      where: { userId: context.userId, quizId: quiz.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const body: QuizView = {
      id: quiz.id,
      title: pick(locale, quiz.titleTr, quiz.titleEn),
      kind: quiz.sectionId ? 'section' : 'final',
      passPercent: quiz.passPercent,
      // Correct answers are never part of this response.
      questions: locked
        ? []
        : quiz.questions.map((question) => ({
            id: question.id,
            prompt: pick(locale, question.promptTr, question.promptEn),
            options: pick(locale, question.optionsTr, question.optionsEn),
          })),
      locked,
      attempts: attempts.map((attempt) => ({
        score: attempt.score,
        passed: attempt.passed,
        createdAt: attempt.createdAt.toISOString(),
      })),
    };
    res.json(body);
  });

  router.post('/:slug/quizzes/:quizId/attempts', requireAuth(services), async (req, res) => {
    const locale = localeOf(req);
    const { answers } = quizAnswersSchema.parse(req.body);
    const { context, loaded, quiz, locked } = await quizFor(req);
    if (locked) throw new HttpError(409, 'quiz_locked', 'Finish every lesson first');
    if (answers.length !== quiz.questions.length) {
      throw new HttpError(400, 'invalid_input', 'Answer every question');
    }

    const correct = quiz.questions.map(
      (question, index) => answers[index] === question.correctIndex,
    );
    const score = Math.round((correct.filter(Boolean).length / quiz.questions.length) * 100);
    const passed = score >= quiz.passPercent;

    await context.db.quizAttempt.create({
      data: {
        orgId: context.orgId,
        userId: context.userId,
        quizId: quiz.id,
        courseId: loaded.course.id,
        answers,
        score,
        passed,
      },
    });

    const { state, newlyCompleted } = await completeIfFinished(context, prisma, loaded, req);
    const reveal = passed || quiz.sectionId !== null;
    const body: QuizResult = {
      score,
      passed,
      passPercent: quiz.passPercent,
      results: quiz.questions.map((question, index) => ({
        questionId: question.id,
        chosen: answers[index] ?? -1,
        correct: correct[index] ?? false,
        correctIndex: reveal ? question.correctIndex : null,
        explanation: reveal ? pick(locale, question.explanationTr, question.explanationEn) : null,
      })),
      course: progressOf(loaded, state),
      courseCompleted: newlyCompleted,
    };
    res.status(201).json(body);
  });

  return router;
}
