import { z } from 'zod';
import { lessonTypes } from './catalog.js';

/** A video lesson counts as watched once this share of it has been played. */
export const VIDEO_COMPLETION_RATIO = 0.9;

// ---- Lesson content -----------------------------------------------------------
// Content is structured data, never HTML, so it is rendered as text and cannot
// carry script into the page.

const text = z.string().min(1).max(2000);

export const readingBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), text: z.string().min(1).max(200) }),
  z.object({ type: z.literal('paragraph'), text }),
  z.object({ type: z.literal('list'), items: text.array().min(1).max(20) }),
  z.object({ type: z.literal('callout'), tone: z.enum(['info', 'warning']), text }),
]);
export type ReadingBlock = z.infer<typeof readingBlockSchema>;

export const checkSchema = z
  .object({
    question: z.string().min(1).max(300),
    options: z.string().min(1).max(200).array().min(2).max(5),
    answer: z.number().int().nonnegative(),
    explanation: z.string().min(1).max(600),
  })
  .refine((check) => check.answer < check.options.length, { message: 'answer out of range' });
export type Check = z.infer<typeof checkSchema>;

export const interactiveStepSchema = z.object({
  title: z.string().min(1).max(120),
  body: text,
  check: checkSchema.optional(),
});
export type InteractiveStep = z.infer<typeof interactiveStepSchema>;

export const lessonBodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('reading'), blocks: readingBlockSchema.array().min(1).max(60) }),
  z.object({
    kind: z.literal('interactive'),
    steps: interactiveStepSchema.array().min(1).max(20),
  }),
]);
export type LessonBody = z.infer<typeof lessonBodySchema>;

// ---- Player API ---------------------------------------------------------------

export const outlineLessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(lessonTypes),
  durationMinutes: z.number().int(),
  isPreview: z.boolean(),
  completed: z.boolean(),
  /** Enrolled learners can open every lesson; everyone else only the previews. */
  accessible: z.boolean(),
});

export const courseProgressSchema = z.object({
  completed: z.number().int(),
  total: z.number().int(),
  percent: z.number().int().min(0).max(100),
});
export type CourseProgress = z.infer<typeof courseProgressSchema>;

export const courseOutlineSchema = z.object({
  course: z.object({ slug: z.string(), title: z.string() }),
  enrolled: z.boolean(),
  sections: z.object({ title: z.string(), lessons: outlineLessonSchema.array() }).array(),
  progress: courseProgressSchema.nullable(),
  /** Where "continue" should land: the first lesson not yet completed. */
  resumeLessonId: z.string().nullable(),
});
export type CourseOutline = z.infer<typeof courseOutlineSchema>;

export const lessonViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  sectionTitle: z.string(),
  type: z.enum(lessonTypes),
  durationMinutes: z.number().int(),
  body: lessonBodySchema.nullable(),
  video: z
    .object({
      src: z.string(),
      seconds: z.number().int().positive(),
      captions: z.object({ lang: z.string(), src: z.string() }).array(),
    })
    .nullable(),
  progress: z.object({ positionSeconds: z.number().int(), completed: z.boolean() }).nullable(),
  previousLessonId: z.string().nullable(),
  nextLessonId: z.string().nullable(),
});
export type LessonView = z.infer<typeof lessonViewSchema>;

export const progressUpdateSchema = z
  .object({
    positionSeconds: z.number().int().min(0).max(86_400).optional(),
    completed: z.literal(true).optional(),
  })
  .refine((value) => value.positionSeconds !== undefined || value.completed, {
    message: 'Send a position or mark the lesson complete',
  });
export type ProgressUpdate = z.infer<typeof progressUpdateSchema>;

export const progressResultSchema = z.object({
  completed: z.boolean(),
  course: courseProgressSchema,
});
export type ProgressResult = z.infer<typeof progressResultSchema>;
