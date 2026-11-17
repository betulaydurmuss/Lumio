import {
  categoryCreateSchema,
  categoryRenameSchema,
  courseEditSchema,
  courseStatusSchema,
  localeSchema,
  type PlatformCategory,
  type PlatformCourse,
  type PlatformCourseDetail,
  type PlatformOverview,
} from '@lumio/shared';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../audit.js';
import { refreshSearchText } from '../catalog/search-text.js';
import { auth, requireAuth, requireMfaForAdmins, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import type { Services } from '../services.js';

/**
 * The platform operator's view. Unlike every other router this one reads across
 * organizations on purpose, so it is open to platform admins with 2FA only, and
 * it shows counts rather than any learner's personal data.
 */
const slugParam = z.string().regex(/^[a-z0-9-]{1,80}$/);

export function platformRouter(services: Services): Router {
  const router = Router();
  const { prisma } = services;
  router.use(requireAuth(services), requireRole('platform_admin'), requireMfaForAdmins);

  router.get('/overview', async (_req, res) => {
    const [
      organizations,
      users,
      enrollments,
      completions,
      certificates,
      publishedCourses,
      orgs,
      completedByOrg,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.enrollment.count(),
      prisma.enrollment.count({ where: { completedAt: { not: null } } }),
      prisma.certificate.count({ where: { revokedAt: null } }),
      prisma.course.count({ where: { status: 'published' } }),
      prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { _count: { select: { users: true, enrollments: true } } },
      }),
      prisma.enrollment.groupBy({
        by: ['orgId'],
        where: { completedAt: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const completed = new Map(completedByOrg.map((row) => [row.orgId, row._count._all]));
    const body: PlatformOverview = {
      totals: { organizations, users, enrollments, completions, certificates, publishedCourses },
      organizations: orgs.map((org) => ({
        id: org.id,
        // A personal account's organization carries the person's name: not shown here.
        name: org.kind === 'company' ? org.name : null,
        kind: org.kind,
        members: org._count.users,
        enrollments: org._count.enrollments,
        completions: completed.get(org.id) ?? 0,
        createdAt: org.createdAt.toISOString(),
      })),
    };
    res.json(body);
  });

  router.get('/courses', async (req, res) => {
    const locale = localeSchema.catch('tr').parse(req.query.locale);
    const courses = await prisma.course.findMany({ orderBy: { titleTr: 'asc' } });
    const body: PlatformCourse[] = courses.map((course) => ({
      slug: course.slug,
      title: locale === 'tr' ? course.titleTr : course.titleEn,
      status: course.status,
      enrollmentCount: course.enrollmentCount,
      completionCount: course.completionCount,
    }));
    res.json(body);
  });

  router.get('/courses/:slug', async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { slug: slugParam.parse(req.params.slug) },
      include: { category: true },
    });
    if (!course) throw new HttpError(404, 'not_found', 'Course not found');
    const body: PlatformCourseDetail = {
      slug: course.slug,
      status: course.status,
      editedAt: course.editedAt?.toISOString() ?? null,
      titleTr: course.titleTr,
      titleEn: course.titleEn,
      subtitleTr: course.subtitleTr,
      subtitleEn: course.subtitleEn,
      descriptionTr: course.descriptionTr,
      descriptionEn: course.descriptionEn,
      level: course.level,
      categorySlug: course.category.slug,
      hasCertificate: course.hasCertificate,
    };
    res.json(body);
  });

  /**
   * Edits what the catalog says about a course. Lessons, quizzes and the price
   * are not changed here. Certificates already issued keep the title they were
   * signed with; only new ones carry the new title.
   */
  router.put('/courses/:slug', async (req, res) => {
    const context = auth(req);
    const input = courseEditSchema.parse(req.body);
    const course = await prisma.course.findUnique({
      where: { slug: slugParam.parse(req.params.slug) },
    });
    if (!course) throw new HttpError(404, 'not_found', 'Course not found');
    const category = await prisma.category.findUnique({ where: { slug: input.categorySlug } });
    if (!category) throw new HttpError(422, 'unknown_category', 'There is no such category');

    const { categorySlug: _categorySlug, ...fields } = input;
    await prisma.course.update({
      where: { id: course.id },
      data: { ...fields, categoryId: category.id, editedAt: new Date() },
    });
    await refreshSearchText(prisma, [course.id]);
    await audit(prisma, {
      orgId: context.orgId,
      actorId: context.userId,
      action: 'course.updated',
      targetType: 'course',
      targetId: course.id,
      ipAddress: req.ip,
    });
    res.status(204).end();
  });

  router.get('/categories', async (_req, res) => {
    const rows = await prisma.category.findMany({
      orderBy: [{ parentId: { sort: 'asc', nulls: 'first' } }, { position: 'asc' }],
      include: { parent: true, _count: { select: { courses: true, children: true } } },
    });
    const body: PlatformCategory[] = rows.map((row) => ({
      slug: row.slug,
      nameTr: row.nameTr,
      nameEn: row.nameEn,
      parentSlug: row.parent?.slug ?? null,
      courses: row._count.courses,
      children: row._count.children,
    }));
    res.json(body);
  });

  router.post('/categories', async (req, res) => {
    const context = auth(req);
    const input = categoryCreateSchema.parse(req.body);
    let parentId: string | null = null;
    if (input.parentSlug) {
      const parent = await prisma.category.findUnique({ where: { slug: input.parentSlug } });
      if (!parent) throw new HttpError(422, 'unknown_category', 'There is no such parent category');
      // Two levels keep the catalog's filter tree readable.
      if (parent.parentId) {
        throw new HttpError(422, 'too_deep', 'A subcategory cannot have subcategories');
      }
      parentId = parent.id;
    }
    if (await prisma.category.findUnique({ where: { slug: input.slug } })) {
      throw new HttpError(409, 'slug_taken', 'A category with this address already exists');
    }
    const siblings = await prisma.category.count({ where: { parentId } });
    const created = await prisma.category.create({
      data: {
        slug: input.slug,
        nameTr: input.nameTr,
        nameEn: input.nameEn,
        parentId,
        position: siblings,
        editedAt: new Date(),
      },
    });
    await audit(prisma, {
      orgId: context.orgId,
      actorId: context.userId,
      action: 'category.created',
      targetType: 'category',
      targetId: created.id,
      ipAddress: req.ip,
    });
    res.status(201).json({ slug: created.slug });
  });

  router.patch('/categories/:slug', async (req, res) => {
    const context = auth(req);
    const input = categoryRenameSchema.parse(req.body);
    const category = await prisma.category.findUnique({
      where: { slug: slugParam.parse(req.params.slug) },
      include: { children: { select: { id: true } } },
    });
    if (!category) throw new HttpError(404, 'not_found', 'Category not found');
    await prisma.category.update({
      where: { id: category.id },
      data: { ...input, editedAt: new Date() },
    });
    // Courses are searched by their category's name and their parent's.
    const affected = await prisma.course.findMany({
      where: { categoryId: { in: [category.id, ...category.children.map((child) => child.id)] } },
      select: { id: true },
    });
    await refreshSearchText(
      prisma,
      affected.map((course) => course.id),
    );
    await audit(prisma, {
      orgId: context.orgId,
      actorId: context.userId,
      action: 'category.updated',
      targetType: 'category',
      targetId: category.id,
      ipAddress: req.ip,
    });
    res.status(204).end();
  });

  /** Only an empty category can go: courses and subcategories must be moved first. */
  router.delete('/categories/:slug', async (req, res) => {
    const context = auth(req);
    const category = await prisma.category.findUnique({
      where: { slug: slugParam.parse(req.params.slug) },
      include: { _count: { select: { courses: true, children: true } } },
    });
    if (!category) throw new HttpError(404, 'not_found', 'Category not found');
    if (category._count.courses > 0 || category._count.children > 0) {
      throw new HttpError(409, 'category_in_use', 'Move its courses and subcategories first');
    }
    await prisma.category.delete({ where: { id: category.id } });
    await audit(prisma, {
      orgId: context.orgId,
      actorId: context.userId,
      action: 'category.deleted',
      targetType: 'category',
      targetId: category.id,
      ipAddress: req.ip,
      metadata: { slug: category.slug },
    });
    res.status(204).end();
  });

  router.patch('/courses/:slug/status', async (req, res) => {
    const context = auth(req);
    const slug = slugParam.parse(req.params.slug);
    const { status } = courseStatusSchema.parse(req.body);
    const course = await prisma.course.findUnique({ where: { slug } });
    if (!course) throw new HttpError(404, 'not_found', 'Course not found');

    if (course.status !== status) {
      await prisma.course.update({
        where: { id: course.id },
        data: {
          status,
          // Unpublishing keeps the original date; the course was public from then.
          ...(status === 'published' && !course.publishedAt ? { publishedAt: new Date() } : {}),
        },
      });
      await audit(prisma, {
        orgId: context.orgId,
        actorId: context.userId,
        action: status === 'published' ? 'course.published' : 'course.unpublished',
        targetType: 'course',
        targetId: course.id,
        ipAddress: req.ip,
      });
    }
    res.status(204).end();
  });

  return router;
}
