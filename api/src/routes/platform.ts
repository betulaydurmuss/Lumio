import {
  courseStatusSchema,
  localeSchema,
  type PlatformCourse,
  type PlatformOverview,
} from '@lumio/shared';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../audit.js';
import { auth, requireAuth, requireMfaForAdmins, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import type { Services } from '../services.js';

/**
 * The platform operator's view. Unlike every other router this one reads across
 * organizations on purpose, so it is open to platform admins with 2FA only, and
 * it shows counts rather than any learner's personal data.
 */
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

  router.patch('/courses/:slug/status', async (req, res) => {
    const context = auth(req);
    const slug = z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .parse(req.params.slug);
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
