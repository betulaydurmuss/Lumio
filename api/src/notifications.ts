import type { NotificationData, NotificationKind } from '@lumio/shared';

/** Anything that can create rows: the raw client, a tenant-scoped one or a transaction. */
interface NotificationWriter {
  notification: {
    createMany(args: {
      data: { orgId: string; userId: string; kind: NotificationKind; data: NotificationData }[];
    }): Promise<unknown>;
  };
}

/** Leaves a note for one or more members of the same organization. */
export async function notify(
  db: NotificationWriter,
  orgId: string,
  userIds: string[],
  kind: NotificationKind,
  data: NotificationData = {},
) {
  if (userIds.length === 0) return;
  await db.notification.createMany({
    data: userIds.map((userId) => ({ orgId, userId, kind, data })),
  });
}
