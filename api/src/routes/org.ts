import {
  assignCourseSchema,
  changeRoleSchema,
  INVITATION_TTL_DAYS,
  inviteSchema,
  localeSchema,
  type AssignResult,
  type AuditEntry,
  type Invitation,
  type Member,
  type OrgCertificate,
  type OrgStats,
} from '@lumio/shared';
import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { audit } from '../audit.js';
import { assignmentReport, csvCell, transcriptFor } from '../learning/report.js';
import { assignmentMail, invitationMail } from '../mail/templates.js';
import {
  auth,
  requireAuth,
  requireMfaForAdmins,
  requireRole,
  type AuthContext,
} from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { hashToken, randomToken } from '../security/crypto.js';
import type { PrismaClient } from '../db.js';
import { notify } from '../notifications.js';
import type { Services } from '../services.js';

const idParam = z.uuid();

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Runs a membership change for one organization, one at a time. The lock makes
 * "is there another admin left?" and the change itself a single step, so two
 * admins demoting each other at the same moment cannot leave nobody in charge.
 * The actor's own authority is read again inside the lock: their request may
 * have been authorised just before someone else demoted them.
 */
async function withOrgAdminLock<T>(
  prisma: PrismaClient,
  context: AuthContext,
  change: (tx: Tx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`org-admins:${context.orgId}`}))`;
    const actor = await tx.user.findFirst({
      where: {
        id: context.userId,
        orgId: context.orgId,
        disabledAt: null,
        role: { in: ['org_admin', 'platform_admin'] },
      },
    });
    if (!actor) throw new HttpError(403, 'forbidden', 'Not allowed');
    return change(tx);
  });
}

/**
 * The member an admin is about to change, checked against the rules every
 * change shares: never yourself, never a platform admin, and never the last
 * active admin of the organization. Every query names the organization: this
 * runs on the transaction client, which the tenant scope does not wrap.
 */
async function changeableMember(tx: Tx, context: AuthContext, id: string, demotesAdmin: boolean) {
  if (id === context.userId) {
    throw new HttpError(409, 'cannot_change_self', 'You cannot change your own account here');
  }
  const member = await tx.user.findFirst({ where: { id, orgId: context.orgId } });
  if (!member) throw new HttpError(404, 'not_found', 'Member not found');
  if (member.role === 'platform_admin') {
    throw new HttpError(403, 'forbidden', 'Platform admins are managed by the platform');
  }
  if (demotesAdmin && member.role === 'org_admin') {
    const otherAdmins = await tx.user.count({
      where: {
        orgId: context.orgId,
        role: 'org_admin',
        disabledAt: null,
        id: { not: member.id },
      },
    });
    if (otherAdmins === 0) {
      throw new HttpError(409, 'last_admin', 'An organization needs at least one active admin');
    }
  }
  return member;
}

/** The organization admin's view of their own organization. Nothing here crosses tenants. */
export function orgRouter(services: Services): Router {
  const router = Router();
  router.use(
    requireAuth(services),
    requireRole('org_admin', 'platform_admin'),
    requireMfaForAdmins,
  );

  // Invitations send email, so each admin gets a modest allowance.
  const inviteLimiter = rateLimit({
    windowMs: 60 * 60_000,
    limit: 50,
    keyGenerator: (req: Request) => req.auth?.userId ?? 'anonymous',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new HttpError(429, 'rate_limited', 'Too many invitations, try again later')),
  });

  router.get('/stats', async (req, res) => {
    const { db } = auth(req);
    const now = new Date();
    const [members, disabledMembers, pendingInvitations, enrollments, completions, certificates] =
      await Promise.all([
        db.user.count(),
        db.user.count({ where: { disabledAt: { not: null } } }),
        db.invitation.count({
          where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
        }),
        db.enrollment.count(),
        db.enrollment.count({ where: { completedAt: { not: null } } }),
        db.certificate.count({ where: { revokedAt: null } }),
      ]);
    const body: OrgStats = {
      members,
      disabledMembers,
      pendingInvitations,
      enrollments,
      completions,
      certificates,
    };
    res.json(body);
  });

  router.get('/members', async (req, res) => {
    const { db } = auth(req);
    const users = await db.user.findMany({ orderBy: { createdAt: 'asc' } });
    const body: Member[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
      twoFactorEnabled: Boolean(user.totpEnabledAt),
      disabled: Boolean(user.disabledAt),
      createdAt: user.createdAt.toISOString(),
    }));
    res.json(body);
  });

  router.patch('/members/:id/role', async (req, res) => {
    const context = auth(req);
    const { role } = changeRoleSchema.parse(req.body);
    const id = idParam.parse(req.params.id);
    await withOrgAdminLock(services.prisma, context, async (tx) => {
      const member = await changeableMember(tx, context, id, role !== 'org_admin');
      if (member.role === role) return;
      await tx.user.update({ where: { id: member.id }, data: { role } });
      if (member.role === 'org_admin') {
        // Their pending invitations were sent with authority they no longer have.
        await tx.invitation.updateMany({
          where: {
            orgId: context.orgId,
            invitedById: member.id,
            acceptedAt: null,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }
      await audit(tx, {
        orgId: context.orgId,
        actorId: context.userId,
        action: 'member.role_changed',
        targetType: 'user',
        targetId: member.id,
        ipAddress: req.ip,
        metadata: { from: member.role, to: role },
      });
    });
    res.status(204).end();
  });

  router.post('/members/:id/deactivate', async (req, res) => {
    const context = auth(req);
    const id = idParam.parse(req.params.id);
    await withOrgAdminLock(services.prisma, context, async (tx) => {
      const member = await changeableMember(tx, context, id, true);
      if (member.disabledAt) return;
      const now = new Date();
      await tx.user.update({ where: { id: member.id }, data: { disabledAt: now } });
      // Ends every session at once, not when the access token runs out.
      await tx.session.updateMany({
        where: { orgId: context.orgId, userId: member.id, revokedAt: null },
        data: { revokedAt: now },
      });
      // Their pending invitations were sent with authority they no longer have.
      await tx.invitation.updateMany({
        where: { orgId: context.orgId, invitedById: member.id, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await audit(tx, {
        orgId: context.orgId,
        actorId: context.userId,
        action: 'member.deactivated',
        targetType: 'user',
        targetId: member.id,
        ipAddress: req.ip,
      });
    });
    res.status(204).end();
  });

  router.post('/members/:id/reactivate', async (req, res) => {
    const context = auth(req);
    const id = idParam.parse(req.params.id);
    await withOrgAdminLock(services.prisma, context, async (tx) => {
      const member = await changeableMember(tx, context, id, false);
      if (!member.disabledAt) return;
      await tx.user.update({ where: { id: member.id }, data: { disabledAt: null } });
      await audit(tx, {
        orgId: context.orgId,
        actorId: context.userId,
        action: 'member.reactivated',
        targetType: 'user',
        targetId: member.id,
        ipAddress: req.ip,
      });
    });
    res.status(204).end();
  });

  router.get('/invitations', async (req, res) => {
    const { db } = auth(req);
    const rows = await db.invitation.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const now = Date.now();
    const body: Invitation[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role === 'platform_admin' ? 'learner' : row.role,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      expired: row.expiresAt.getTime() < now,
    }));
    res.json(body);
  });

  router.post('/invitations', inviteLimiter, async (req, res) => {
    const context = auth(req);
    const { email, role } = inviteSchema.parse(req.body);
    const [organization, inviter] = await Promise.all([
      services.prisma.organization.findUniqueOrThrow({ where: { id: context.orgId } }),
      context.db.user.findUniqueOrThrow({ where: { id: context.userId } }),
    ]);
    if (organization.kind !== 'company') {
      throw new HttpError(409, 'not_a_company', 'Only company accounts can invite members');
    }

    const now = new Date();
    // A new invitation replaces any earlier one still waiting for the same address.
    await context.db.invitation.updateMany({
      where: { email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    const token = randomToken();
    const invitation = await context.db.invitation.create({
      data: {
        orgId: context.orgId,
        email,
        role,
        tokenHash: hashToken(token),
        invitedById: context.userId,
        expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * 86_400_000),
      },
    });
    await services.mailer.send(
      invitationMail({
        to: email,
        organization: organization.name,
        inviter: inviter.displayName,
        link: `${services.webOrigin}/invite?token=${encodeURIComponent(token)}`,
      }),
    );
    await audit(context.db, {
      orgId: context.orgId,
      actorId: context.userId,
      action: 'member.invited',
      targetType: 'invitation',
      targetId: invitation.id,
      ipAddress: req.ip,
      metadata: { role },
    });
    res.status(201).json({ id: invitation.id });
  });

  router.delete('/invitations/:id', async (req, res) => {
    const context = auth(req);
    const id = idParam.parse(req.params.id);
    const { count } = await context.db.invitation.updateMany({
      where: { id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new HttpError(404, 'not_found', 'Invitation not found');
    await audit(context.db, {
      orgId: context.orgId,
      actorId: context.userId,
      action: 'invitation.revoked',
      targetType: 'invitation',
      targetId: id,
      ipAddress: req.ip,
    });
    res.status(204).end();
  });

  // Assignments send mail as well, one per member.
  const assignLimiter = rateLimit({
    windowMs: 60 * 60_000,
    limit: 30,
    keyGenerator: (req: Request) => req.auth?.userId ?? 'anonymous',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new HttpError(429, 'rate_limited', 'Too many assignments, try again later')),
  });

  /**
   * Assigns a course to members of this organization. Each one is enrolled at
   * once, so the course is waiting in their list, and gets a mail. Assigning
   * again is harmless: members who already have it are counted, not changed.
   */
  router.post('/assignments', assignLimiter, async (req, res) => {
    const context = auth(req);
    const input = assignCourseSchema.parse(req.body);
    const course = await services.prisma.course.findFirst({
      where: { slug: input.courseSlug, status: 'published' },
    });
    if (!course) throw new HttpError(404, 'not_found', 'Course not found');
    if (course.priceAmount > 0) {
      // Paid courses need seats from a purchase, which arrives with payments.
      throw new HttpError(402, 'payment_required', 'Only free courses can be assigned for now');
    }

    // Read through the tenant scope: an id from another organization is simply not found.
    const ids = [...new Set(input.userIds)];
    const members = await context.db.user.findMany({
      where: { id: { in: ids }, disabledAt: null },
    });
    if (members.length !== ids.length) {
      throw new HttpError(404, 'member_not_found', 'Some members were not found or are inactive');
    }

    const dueOn = input.dueOn ? new Date(`${input.dueOn}T00:00:00Z`) : null;
    const created = await context.db.assignment.createManyAndReturn({
      data: ids.map((userId) => ({
        orgId: context.orgId,
        userId,
        courseId: course.id,
        assignedById: context.userId,
        dueOn,
      })),
      skipDuplicates: true,
      select: { id: true, userId: true },
    });
    const enrolled = await context.db.enrollment.createMany({
      data: created.map((row) => ({
        orgId: context.orgId,
        userId: row.userId,
        courseId: course.id,
      })),
      skipDuplicates: true,
    });
    if (enrolled.count > 0) {
      await services.prisma.course.update({
        where: { id: course.id },
        data: { enrollmentCount: { increment: enrolled.count } },
      });
    }

    const assignedTo = new Set(created.map((row) => row.userId));
    for (const member of members.filter((m) => assignedTo.has(m.id))) {
      await services.mailer.send(
        assignmentMail({
          to: member.email,
          courseTitle: member.locale === 'tr' ? course.titleTr : course.titleEn,
          dueOn: input.dueOn,
          link: `${services.webOrigin}/learn/${course.slug}`,
          locale: member.locale,
        }),
      );
    }
    await notify(
      context.db,
      context.orgId,
      created.map((row) => row.userId),
      'course_assigned',
      {
        courseSlug: course.slug,
        courseTitleTr: course.titleTr,
        courseTitleEn: course.titleEn,
        dueOn: input.dueOn,
      },
    );
    if (created.length > 0) {
      await audit(context.db, {
        orgId: context.orgId,
        actorId: context.userId,
        action: 'course.assigned',
        targetType: 'course',
        targetId: course.id,
        ipAddress: req.ip,
        metadata: { members: created.length, dueOn: input.dueOn },
      });
    }
    const body: AssignResult = {
      assigned: created.length,
      alreadyAssigned: ids.length - created.length,
    };
    res.status(201).json(body);
  });

  router.get('/assignments', async (req, res) => {
    const { db } = auth(req);
    const locale = localeSchema.catch('tr').parse(req.query.locale);
    res.json(await assignmentReport(db, locale));
  });

  /** The same report as a spreadsheet, for compliance records. */
  router.get('/assignments.csv', async (req, res) => {
    const { db } = auth(req);
    const locale = localeSchema.catch('tr').parse(req.query.locale);
    const rows = await assignmentReport(db, locale);
    const header = [
      'name',
      'email',
      'course',
      'assigned_at',
      'due_on',
      'status',
      'percent',
      'completed_at',
    ];
    const lines = [
      header.map(csvCell).join(','),
      ...rows.map((row) =>
        [
          row.member.displayName,
          row.member.email,
          row.course.title,
          row.assignedAt.slice(0, 10),
          row.dueOn,
          row.status,
          row.percent,
          row.completedAt?.slice(0, 10) ?? null,
        ]
          .map(csvCell)
          .join(','),
      ),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lumio-assignments.csv"');
    // A byte-order mark so spreadsheet programs read Turkish letters correctly.
    res.send(`\uFEFF${lines.join('\r\n')}\r\n`);
  });

  /** Takes an assignment back. What the member already did, and the enrollment, stay. */
  router.delete('/assignments/:id', async (req, res) => {
    const context = auth(req);
    const id = idParam.parse(req.params.id);
    const { count } = await context.db.assignment.deleteMany({ where: { id } });
    if (count === 0) throw new HttpError(404, 'not_found', 'Assignment not found');
    await audit(context.db, {
      orgId: context.orgId,
      actorId: context.userId,
      action: 'assignment.removed',
      targetType: 'assignment',
      targetId: id,
      ipAddress: req.ip,
    });
    res.status(204).end();
  });

  router.get('/members/:id/transcript', async (req, res) => {
    const { db } = auth(req);
    const id = idParam.parse(req.params.id);
    const locale = localeSchema.catch('tr').parse(req.query.locale);
    if (!(await db.user.findUnique({ where: { id } }))) {
      throw new HttpError(404, 'not_found', 'Member not found');
    }
    res.json(await transcriptFor(db, id, locale));
  });

  router.get('/audit-logs', async (req, res) => {
    const { db } = auth(req);
    const entries = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    const body: AuditEntry[] = entries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actorId: entry.actorId,
      targetType: entry.targetType,
      targetId: entry.targetId,
      ipAddress: entry.ipAddress,
      createdAt: entry.createdAt.toISOString(),
    }));
    res.json(body);
  });

  router.get('/certificates', async (req, res) => {
    const { db } = auth(req);
    const locale = localeSchema.catch('tr').parse(req.query.locale);
    const rows = await db.certificate.findMany({ orderBy: { issuedAt: 'desc' }, take: 200 });
    const body: OrgCertificate[] = rows.map((row) => ({
      certNo: row.certNo,
      recipientName: row.recipientName,
      courseTitle: locale === 'tr' ? row.courseTitleTr : row.courseTitleEn,
      issuedAt: row.issuedAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    }));
    res.json(body);
  });

  return router;
}
