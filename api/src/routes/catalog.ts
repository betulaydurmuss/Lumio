import {
  CATALOG_PAGE_SIZE,
  catalogQuerySchema,
  durationRanges,
  localeSchema,
  normalizeSearch,
  type CatalogPage,
  type CatalogSort,
  type CategoryNode,
  type CourseCard,
  type CourseDetail,
  type LearningItem,
  type Locale,
  type Suggestions,
} from '@lumio/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { audit } from '../audit.js';
import type { PrismaClient } from '../db.js';
import { Prisma } from '../generated/prisma/client.js';
import { auth, optionalAuth, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import type { Services } from '../services.js';

const NEW_FOR_DAYS = 45;
const SUGGESTION_LIMIT = 6;
const POPULAR_MIN_COUNT = 2;

const cardInclude = { category: true, instructor: true } satisfies Prisma.CourseInclude;
type CardCourse = Prisma.CourseGetPayload<{ include: typeof cardInclude }>;

const orderBy: Record<CatalogSort, Prisma.CourseOrderByWithRelationInput[]> = {
  popular: [{ enrollmentCount: 'desc' }, { ratingAverage: 'desc' }],
  newest: [{ publishedAt: 'desc' }],
  rating: [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }],
  completed: [{ completionCount: 'desc' }],
};

const pick = <T>(locale: Locale, tr: T, en: T) => (locale === 'tr' ? tr : en);

export function toCard(course: CardCourse, locale: Locale): CourseCard {
  const published = course.publishedAt?.getTime() ?? 0;
  return {
    slug: course.slug,
    title: pick(locale, course.titleTr, course.titleEn),
    subtitle: pick(locale, course.subtitleTr, course.subtitleEn),
    category: {
      slug: course.category.slug,
      name: pick(locale, course.category.nameTr, course.category.nameEn),
    },
    instructor: { slug: course.instructor.slug, name: course.instructor.name },
    level: course.level,
    language: course.language,
    durationMinutes: course.durationMinutes,
    lessonCount: course.lessonCount,
    ratingAverage: Number(course.ratingAverage),
    ratingCount: course.ratingCount,
    enrollmentCount: course.enrollmentCount,
    price: {
      amount: course.priceAmount,
      listAmount: course.listPriceAmount,
      currency: course.currency,
    },
    hasCertificate: course.hasCertificate,
    coverStyle: course.coverStyle,
    isNew: Date.now() - published < NEW_FOR_DAYS * 86_400_000,
  };
}

/** Every word of the query must appear somewhere in the course's folded search text. */
function searchFilter(q: string | undefined): Prisma.CourseWhereInput[] {
  const words = normalizeSearch(q ?? '')
    .split(' ')
    .filter((word) => word.length > 0)
    .slice(0, 8);
  return words.map((word) => ({ searchText: { contains: word } }));
}

/** The category and everything below it. Unknown slugs match nothing. */
async function categorySubtree(prisma: PrismaClient, slug: string): Promise<string[]> {
  const all = await prisma.category.findMany({ select: { id: true, slug: true, parentId: true } });
  const root = all.find((category) => category.slug === slug);
  if (!root) return [];
  const ids = [root.id];
  for (let i = 0; i < ids.length; i++) {
    for (const child of all) if (child.parentId === ids[i]) ids.push(child.id);
  }
  return ids;
}

function localeOf(req: Request): Locale {
  const parsed = localeSchema.safeParse(req.query.locale);
  return parsed.success ? parsed.data : 'tr';
}

async function publishedCourse(prisma: PrismaClient, slug: string) {
  const course = await prisma.course.findFirst({ where: { slug, status: 'published' } });
  if (!course) throw new HttpError(404, 'not_found', 'Course not found');
  return course;
}

const slugParam = z.string().regex(/^[a-z0-9-]{1,80}$/);

export function catalogRouter(services: Services): Router {
  const router = Router();
  const { prisma } = services;

  router.get('/categories', async (req, res) => {
    const locale = localeOf(req);
    const [categories, counts] = await Promise.all([
      prisma.category.findMany({ orderBy: { position: 'asc' } }),
      prisma.course.groupBy({
        by: ['categoryId'],
        where: { status: 'published' },
        _count: { _all: true },
      }),
    ]);
    const direct = new Map(counts.map((row) => [row.categoryId, row._count._all]));

    const build = (parentId: string | null): CategoryNode[] =>
      categories
        .filter((category) => category.parentId === parentId)
        .map((category) => {
          const children = build(category.id);
          const own = direct.get(category.id) ?? 0;
          return {
            slug: category.slug,
            name: pick(locale, category.nameTr, category.nameEn),
            courseCount: own + children.reduce((sum, child) => sum + child.courseCount, 0),
            children,
          };
        });

    res.json(build(null));
  });

  router.get('/courses', async (req, res) => {
    const query = catalogQuerySchema.parse(req.query);
    const and: Prisma.CourseWhereInput[] = [{ status: 'published' }, ...searchFilter(query.q)];

    if (query.category) {
      and.push({ categoryId: { in: await categorySubtree(prisma, query.category) } });
    }
    if (query.level) and.push({ level: query.level });
    if (query.language) and.push({ language: query.language });
    if (query.duration) {
      const [min, max] = durationRanges[query.duration];
      and.push({ durationMinutes: { gte: min, lte: max } });
    }
    if (query.price === 'free') and.push({ priceAmount: 0 });
    if (query.price === 'paid') and.push({ priceAmount: { gt: 0 } });
    if (query.rating !== undefined) and.push({ ratingAverage: { gte: query.rating } });
    if (query.certificate) and.push({ hasCertificate: true });

    const where: Prisma.CourseWhereInput = { AND: and };
    const [total, courses] = await prisma.$transaction([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        include: cardInclude,
        orderBy: orderBy[query.sort],
        skip: (query.page - 1) * CATALOG_PAGE_SIZE,
        take: CATALOG_PAGE_SIZE,
      }),
    ]);

    // Only searches that found something are counted, so "popular searches"
    // can only ever show words that lead to a course.
    const term = normalizeSearch(query.q ?? '').slice(0, 60);
    if (term.length >= 2 && query.page === 1 && total > 0) {
      await prisma.searchTerm.upsert({
        where: { term },
        create: { term },
        update: { count: { increment: 1 } },
      });
    }

    const body: CatalogPage = {
      items: courses.map((course) => toCard(course, query.locale)),
      total,
      page: query.page,
      pageSize: CATALOG_PAGE_SIZE,
    };
    res.json(body);
  });

  router.get('/suggest', async (req, res) => {
    const locale = localeOf(req);
    const q = z.string().max(100).catch('').parse(req.query.q);
    const filter = searchFilter(q);

    const [courses, popular] = await Promise.all([
      normalizeSearch(q).length >= 2
        ? prisma.course.findMany({
            where: { AND: [{ status: 'published' }, ...filter] },
            orderBy: { enrollmentCount: 'desc' },
            take: SUGGESTION_LIMIT,
            select: { slug: true, titleTr: true, titleEn: true },
          })
        : Promise.resolve([]),
      prisma.searchTerm.findMany({
        where: { count: { gte: POPULAR_MIN_COUNT } },
        orderBy: { count: 'desc' },
        take: SUGGESTION_LIMIT,
      }),
    ]);

    const body: Suggestions = {
      courses: courses.map((course) => ({
        slug: course.slug,
        title: pick(locale, course.titleTr, course.titleEn),
      })),
      popular: popular.map((row) => row.term),
    };
    res.json(body);
  });

  router.get('/courses/:slug', optionalAuth(services), async (req, res) => {
    const locale = localeOf(req);
    const slug = slugParam.parse(req.params.slug);
    const course = await prisma.course.findFirst({
      where: { slug, status: 'published' },
      include: {
        ...cardInclude,
        sections: {
          orderBy: { position: 'asc' },
          include: { lessons: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!course) throw new HttpError(404, 'not_found', 'Course not found');

    // Related courses come from the same top-level category, e.g. all of "Cybersecurity".
    const top = course.category.parentId
      ? await prisma.category.findUniqueOrThrow({ where: { id: course.category.parentId } })
      : course.category;
    const relatedCategoryIds = await categorySubtree(prisma, top.slug);

    const [instructorCourses, related, viewer] = await Promise.all([
      prisma.course.findMany({
        where: { instructorId: course.instructorId, status: 'published' },
        include: cardInclude,
        orderBy: { enrollmentCount: 'desc' },
      }),
      prisma.course.findMany({
        where: {
          status: 'published',
          // The instructor's own courses already have their own row on the page.
          instructorId: { not: course.instructorId },
          categoryId: { in: relatedCategoryIds },
        },
        include: cardInclude,
        orderBy: { enrollmentCount: 'desc' },
        take: 4,
      }),
      req.auth
        ? Promise.all([
            req.auth.db.enrollment.findFirst({
              where: { userId: req.auth.userId, courseId: course.id },
            }),
            req.auth.db.wishlistItem.findFirst({
              where: { userId: req.auth.userId, courseId: course.id },
            }),
          ])
        : Promise.resolve(null),
    ]);

    const rated = instructorCourses.filter((item) => item.ratingCount > 0);
    const ratingWeight = rated.reduce((sum, item) => sum + item.ratingCount, 0);
    const body: CourseDetail = {
      ...toCard(course, locale),
      description: pick(locale, course.descriptionTr, course.descriptionEn),
      outcomes: pick(locale, course.outcomesTr, course.outcomesEn),
      requirements: pick(locale, course.requirementsTr, course.requirementsEn),
      audience: pick(locale, course.audienceTr, course.audienceEn),
      updatedAt: course.updatedAt.toISOString(),
      sections: course.sections.map((section) => ({
        title: pick(locale, section.titleTr, section.titleEn),
        durationMinutes: section.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0),
        lessons: section.lessons.map((lesson) => ({
          id: lesson.id,
          title: pick(locale, lesson.titleTr, lesson.titleEn),
          type: lesson.type,
          durationMinutes: lesson.durationMinutes,
          isPreview: lesson.isPreview,
        })),
      })),
      instructorProfile: {
        slug: course.instructor.slug,
        name: course.instructor.name,
        headline: pick(locale, course.instructor.headlineTr, course.instructor.headlineEn),
        bio: pick(locale, course.instructor.bioTr, course.instructor.bioEn),
        courseCount: instructorCourses.length,
        studentCount: instructorCourses.reduce((sum, item) => sum + item.enrollmentCount, 0),
        ratingAverage: ratingWeight
          ? Math.round(
              (rated.reduce((sum, item) => sum + Number(item.ratingAverage) * item.ratingCount, 0) /
                ratingWeight) *
                10,
            ) / 10
          : 0,
        otherCourses: instructorCourses
          .filter((item) => item.id !== course.id)
          .slice(0, 3)
          .map((item) => toCard(item, locale)),
      },
      related: related.map((item) => toCard(item, locale)),
      viewer: viewer ? { enrolled: Boolean(viewer[0]), wishlisted: Boolean(viewer[1]) } : null,
    };
    res.json(body);
  });

  router.post('/courses/:slug/enroll', requireAuth(services), async (req, res) => {
    const context = auth(req);
    const course = await publishedCourse(prisma, slugParam.parse(req.params.slug));
    if (course.priceAmount > 0) {
      // Checkout arrives with payments in Phase 2; until then paid courses cannot be joined.
      throw new HttpError(402, 'payment_required', 'This course needs to be purchased');
    }

    try {
      await context.db.enrollment.create({
        data: { orgId: context.orgId, userId: context.userId, courseId: course.id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.json({ status: 'enrolled' });
        return;
      }
      throw error;
    }
    await prisma.course.update({
      where: { id: course.id },
      data: { enrollmentCount: { increment: 1 } },
    });
    await audit(context.db, {
      orgId: context.orgId,
      actorId: context.userId,
      action: 'course.enrolled',
      targetType: 'course',
      targetId: course.id,
      ipAddress: req.ip,
    });
    res.status(201).json({ status: 'enrolled' });
  });

  router.put('/courses/:slug/wishlist', requireAuth(services), async (req, res) => {
    const context = auth(req);
    const course = await publishedCourse(prisma, slugParam.parse(req.params.slug));
    await context.db.wishlistItem.createMany({
      data: [{ orgId: context.orgId, userId: context.userId, courseId: course.id }],
      skipDuplicates: true,
    });
    res.status(204).end();
  });

  router.delete('/courses/:slug/wishlist', requireAuth(services), async (req, res) => {
    const context = auth(req);
    const course = await publishedCourse(prisma, slugParam.parse(req.params.slug));
    await context.db.wishlistItem.deleteMany({
      where: { userId: context.userId, courseId: course.id },
    });
    res.status(204).end();
  });

  return router;
}

/** The signed-in learner's own courses, newest first. Feeds the "continue" rail. */
export function learningRouter(services: Services): Router {
  const router = Router();

  router.get('/learning', requireAuth(services), async (req, res) => {
    const context = auth(req);
    const locale = localeOf(req);
    const enrollments = await context.db.enrollment.findMany({
      where: { userId: context.userId },
      include: { course: { include: cardInclude } },
      orderBy: { createdAt: 'desc' },
    });
    const body: LearningItem[] = enrollments.map((enrollment) => ({
      course: toCard(enrollment.course, locale),
      enrolledAt: enrollment.createdAt.toISOString(),
    }));
    res.json(body);
  });

  router.get('/wishlist', requireAuth(services), async (req, res) => {
    const context = auth(req);
    const locale = localeOf(req);
    const items = await context.db.wishlistItem.findMany({
      where: { userId: context.userId },
      include: { course: { include: cardInclude } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items.map((item) => toCard(item.course, locale)));
  });

  return router;
}
