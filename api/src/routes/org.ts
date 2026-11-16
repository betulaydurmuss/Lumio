import type { AuditEntry, Member } from '@lumio/shared';
import { Router } from 'express';
import { auth, requireAuth, requireMfaForAdmins, requireRole } from '../middleware/auth.js';
import type { Services } from '../services.js';

/** The organization admin's view of their own organization. Nothing here crosses tenants. */
export function orgRouter(services: Services): Router {
  const router = Router();
  router.use(
    requireAuth(services),
    requireRole('org_admin', 'platform_admin'),
    requireMfaForAdmins,
  );

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
      createdAt: user.createdAt.toISOString(),
    }));
    res.json(body);
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

  return router;
}
