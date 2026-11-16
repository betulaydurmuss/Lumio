import type { Prisma } from './generated/prisma/client.js';

export type AuditAction =
  | 'user.registered'
  | 'user.email_verified'
  | 'auth.login_succeeded'
  | 'auth.login_failed'
  | 'auth.account_locked'
  | 'auth.totp_failed'
  | 'auth.logout'
  | 'auth.refresh_reused'
  | 'session.revoked'
  | 'totp.enabled'
  | 'course.enrolled'
  | 'course.completed';

export interface AuditEntry {
  orgId: string | null;
  actorId: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  ipAddress?: string | undefined;
  metadata?: Prisma.InputJsonObject;
}

/** Anything that can insert an audit row: the client, a transaction, or a tenant-scoped client. */
interface AuditWriter {
  auditLog: {
    create(args: { data: Prisma.AuditLogUncheckedCreateInput }): PromiseLike<unknown>;
  };
}

/** Writes one audit record. The table is append-only at the database level. */
export async function audit(db: AuditWriter, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      orgId: entry.orgId,
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      ipAddress: entry.ipAddress ?? null,
      metadata: entry.metadata ?? {},
    },
  });
}
