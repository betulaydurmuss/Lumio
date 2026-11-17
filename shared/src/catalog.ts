import { z } from 'zod';
import { localeSchema } from './locale.js';

/**
 * Folds text for search: lower-cases with Turkish rules, drops accents and maps
 * dotless ı to i, so "guvenlik" finds "Güvenlik" and "ISTANBUL" finds "İstanbul".
 */
export function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .replaceAll('ı', 'i')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const courseLevels = ['beginner', 'intermediate', 'advanced', 'all'] as const;
export const courseLevelSchema = z.enum(courseLevels);
export type CourseLevel = z.infer<typeof courseLevelSchema>;

export const lessonTypes = ['video', 'interactive', 'reading'] as const;
export type LessonType = (typeof lessonTypes)[number];

export const durationBuckets = ['short', 'medium', 'long'] as const;
/** Inclusive minute ranges for the duration filter. */
export const durationRanges: Record<(typeof durationBuckets)[number], [number, number]> = {
  short: [0, 120],
  medium: [121, 360],
  long: [361, 100_000],
};

export const catalogSorts = ['popular', 'newest', 'rating', 'completed'] as const;
export type CatalogSort = (typeof catalogSorts)[number];

export const CATALOG_PAGE_SIZE = 12;

const flag = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional(),
  level: courseLevelSchema.optional(),
  duration: z.enum(durationBuckets).optional(),
  price: z.enum(['free', 'paid']).optional(),
  language: localeSchema.optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  certificate: flag,
  sort: z.enum(catalogSorts).default('popular'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  locale: localeSchema.default('tr'),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export const priceSchema = z.object({
  /** Minor units: 24900 is ₺249,00. Zero is free. */
  amount: z.number().int().nonnegative(),
  listAmount: z.number().int().nonnegative().nullable(),
  currency: z.string(),
});
export type Price = z.infer<typeof priceSchema>;

export const courseCardSchema = z.object({
  slug: z.string(),
  title: z.string(),
  subtitle: z.string(),
  category: z.object({ slug: z.string(), name: z.string() }),
  instructor: z.object({ slug: z.string(), name: z.string() }),
  level: courseLevelSchema,
  language: localeSchema,
  durationMinutes: z.number().int(),
  lessonCount: z.number().int(),
  ratingAverage: z.number(),
  ratingCount: z.number().int(),
  enrollmentCount: z.number().int(),
  price: priceSchema,
  hasCertificate: z.boolean(),
  coverStyle: z.string(),
  isNew: z.boolean(),
});
export type CourseCard = z.infer<typeof courseCardSchema>;

export const catalogPageSchema = z.object({
  items: courseCardSchema.array(),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type CatalogPage = z.infer<typeof catalogPageSchema>;

export interface CategoryNode {
  slug: string;
  name: string;
  courseCount: number;
  children: CategoryNode[];
}
export const categoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() =>
  z.object({
    slug: z.string(),
    name: z.string(),
    courseCount: z.number().int(),
    children: categoryNodeSchema.array(),
  }),
);

export const suggestionsSchema = z.object({
  courses: z.object({ slug: z.string(), title: z.string() }).array(),
  popular: z.string().array(),
});
export type Suggestions = z.infer<typeof suggestionsSchema>;

export const lessonSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(lessonTypes),
  durationMinutes: z.number().int(),
  isPreview: z.boolean(),
});

export const courseDetailSchema = courseCardSchema.extend({
  description: z.string(),
  outcomes: z.string().array(),
  requirements: z.string().array(),
  audience: z.string().array(),
  updatedAt: z.string(),
  sections: z
    .object({
      title: z.string(),
      durationMinutes: z.number().int(),
      lessons: lessonSummarySchema.array(),
    })
    .array(),
  instructorProfile: z.object({
    slug: z.string(),
    name: z.string(),
    headline: z.string(),
    bio: z.string(),
    courseCount: z.number().int(),
    studentCount: z.number().int(),
    ratingAverage: z.number(),
    otherCourses: courseCardSchema.array(),
  }),
  related: courseCardSchema.array(),
  /** Null for visitors who are not signed in. */
  viewer: z.object({ enrolled: z.boolean(), wishlisted: z.boolean() }).nullable(),
});
export type CourseDetail = z.infer<typeof courseDetailSchema>;

export const learningItemSchema = z.object({
  course: courseCardSchema,
  enrolledAt: z.string(),
  progress: z.object({
    completed: z.number().int(),
    total: z.number().int(),
    percent: z.number().int(),
  }),
  resumeLessonId: z.string().nullable(),
  /** Set when the organization assigned this course. */
  assignment: z.object({ dueOn: z.string().nullable(), overdue: z.boolean() }).nullable(),
});
export type LearningItem = z.infer<typeof learningItemSchema>;
