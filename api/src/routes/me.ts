import {
  markReadSchema,
  notificationDataSchema,
  PRIVACY_NOTICE_VERSION,
  updateConsentsSchema,
  type Consents,
  type NotificationFeed,
} from '@lumio/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { audit } from '../audit.js';
import { learningStats } from '../learning/stats.js';
import { auth, requireAuth, type AuthContext } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import type { Services } from '../services.js';

const FEED_SIZE = 50;

async function consentsOf(context: AuthContext): Promise<Consents> {
  const history = await context.db.consentRecord.findMany({
    where: { userId: context.userId, kind: 'marketing_email' },
    orderBy: { createdAt: 'desc' },
  });
  return {
    // No record means no consent: it is only ever given, never assumed.
    marketingEmail: history[0]?.granted ?? false,
    noticeVersion: PRIVACY_NOTICE_VERSION,
    history: history.map((row) => ({
      granted: row.granted,
      noticeVersion: row.noticeVersion,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

/** The signed-in member's own notifications, consents and data. */
export function meRouter(services: Services): Router {
  const router = Router();
  router.use(requireAuth(services));

  router.get('/notifications', async (req, res) => {
    const context = auth(req);
    const [unread, rows] = await Promise.all([
      context.db.notification.count({ where: { userId: context.userId, readAt: null } }),
      context.db.notification.findMany({
        where: { userId: context.userId },
        orderBy: { createdAt: 'desc' },
        take: FEED_SIZE,
      }),
    ]);
    const body: NotificationFeed = {
      unread,
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        data: notificationDataSchema.catch({}).parse(row.data),
        read: Boolean(row.readAt),
        createdAt: row.createdAt.toISOString(),
      })),
    };
    res.json(body);
  });

  /** Marks the given notifications read, or all of them when no ids are sent. */
  router.post('/notifications/read', async (req, res) => {
    const context = auth(req);
    const { ids } = markReadSchema.parse(req.body);
    await context.db.notification.updateMany({
      where: { userId: context.userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    res.status(204).end();
  });

  router.get('/stats', async (req, res) => {
    const context = auth(req);
    res.json(await learningStats(context.db, context.userId));
  });

  router.get('/consents', async (req, res) => {
    res.json(await consentsOf(auth(req)));
  });

  router.put('/consents', async (req, res) => {
    const context = auth(req);
    const { marketingEmail } = updateConsentsSchema.parse(req.body);
    const current = await consentsOf(context);
    // Only a change is recorded, so the history reads as decisions, not clicks.
    if (current.marketingEmail !== marketingEmail) {
      await context.db.consentRecord.create({
        data: {
          orgId: context.orgId,
          userId: context.userId,
          kind: 'marketing_email',
          granted: marketingEmail,
          noticeVersion: PRIVACY_NOTICE_VERSION,
          ipAddress: req.ip ?? null,
        },
      });
      await audit(context.db, {
        orgId: context.orgId,
        actorId: context.userId,
        action: 'consent.changed',
        ipAddress: req.ip,
        metadata: { kind: 'marketing_email', granted: marketingEmail },
      });
    }
    res.json(await consentsOf(context));
  });

  // Building the export reads every table about the member, so it is rationed.
  const exportLimiter = rateLimit({
    windowMs: 60 * 60_000,
    limit: 5,
    keyGenerator: (req) => req.auth?.userId ?? 'anonymous',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new HttpError(429, 'rate_limited', 'Too many exports, try again later')),
  });

  /**
   * Everything Lumio holds about the member, as one JSON file (KVKK article 11,
   * the right to learn what is processed). Secrets are left out: password and
   * token hashes and the two-factor seed are not data about the person.
   */
  router.get('/data-export', exportLimiter, async (req, res) => {
    const context = auth(req);
    const where = { userId: context.userId };
    const [user, sessions, enrollments, progress, attempts, certificates, assignments, consents] =
      await Promise.all([
        context.db.user.findUniqueOrThrow({
          where: { id: context.userId },
          include: { organization: true },
        }),
        context.db.session.findMany({ where, orderBy: { createdAt: 'desc' } }),
        context.db.enrollment.findMany({ where, include: { course: true } }),
        context.db.lessonProgress.findMany({ where }),
        context.db.quizAttempt.findMany({ where, orderBy: { createdAt: 'asc' } }),
        context.db.certificate.findMany({ where }),
        context.db.assignment.findMany({ where, include: { course: true } }),
        context.db.consentRecord.findMany({ where, orderBy: { createdAt: 'asc' } }),
      ]);

    const body = {
      exportedAt: new Date().toISOString(),
      noticeVersion: PRIVACY_NOTICE_VERSION,
      account: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        locale: user.locale,
        organization: user.organization.name,
        createdAt: user.createdAt,
        emailVerifiedAt: user.emailVerifiedAt,
        twoFactorEnabled: Boolean(user.totpEnabledAt),
      },
      sessions: sessions.map((row) => ({
        createdAt: row.createdAt,
        lastUsedAt: row.lastUsedAt,
        revokedAt: row.revokedAt,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
      })),
      enrollments: enrollments.map((row) => ({
        course: row.course.slug,
        enrolledAt: row.createdAt,
        completedAt: row.completedAt,
      })),
      lessonProgress: progress.map((row) => ({
        lessonId: row.lessonId,
        positionSeconds: row.positionSeconds,
        completedAt: row.completedAt,
        updatedAt: row.updatedAt,
      })),
      quizAttempts: attempts.map((row) => ({
        quizId: row.quizId,
        score: row.score,
        passed: row.passed,
        createdAt: row.createdAt,
      })),
      certificates: certificates.map((row) => ({
        certNo: row.certNo,
        course: row.courseTitleEn,
        issuedAt: row.issuedAt,
        revokedAt: row.revokedAt,
      })),
      assignments: assignments.map((row) => ({
        course: row.course.slug,
        assignedAt: row.createdAt,
        dueOn: row.dueOn,
      })),
      consents: consents.map((row) => ({
        kind: row.kind,
        granted: row.granted,
        noticeVersion: row.noticeVersion,
        createdAt: row.createdAt,
        ipAddress: row.ipAddress,
      })),
    };
    await audit(context.db, {
      orgId: context.orgId,
      actorId: context.userId,
      action: 'data.exported',
      ipAddress: req.ip,
    });
    res.setHeader('Content-Disposition', 'attachment; filename="lumio-my-data.json"');
    res.json(body);
  });

  return router;
}
