import { z } from 'zod';

/**
 * The version of the privacy notice in force. Every consent is stored with the
 * version the member saw, so a later change to the notice cannot be read back
 * into an older "yes".
 */
export const PRIVACY_NOTICE_VERSION = '2026-11-17';

export const notificationKinds = [
  'course_assigned',
  'certificate_issued',
  'password_changed',
  'two_factor_enabled',
] as const;
export const notificationKindSchema = z.enum(notificationKinds);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

/** Only structured values: the text is put together from translations when shown. */
export const notificationDataSchema = z.object({
  courseSlug: z.string().optional(),
  courseTitleTr: z.string().optional(),
  courseTitleEn: z.string().optional(),
  dueOn: z.string().nullable().optional(),
  certNo: z.string().optional(),
});
export type NotificationData = z.infer<typeof notificationDataSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  kind: notificationKindSchema,
  data: notificationDataSchema,
  read: z.boolean(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationFeedSchema = z.object({
  unread: z.number().int(),
  items: notificationSchema.array(),
});
export type NotificationFeed = z.infer<typeof notificationFeedSchema>;

export const markReadSchema = z.object({ ids: z.uuid().array().max(100).optional() });
export type MarkReadInput = z.infer<typeof markReadSchema>;

export const consentsSchema = z.object({
  marketingEmail: z.boolean(),
  noticeVersion: z.string(),
  history: z
    .object({ granted: z.boolean(), noticeVersion: z.string(), createdAt: z.string() })
    .array(),
});
export type Consents = z.infer<typeof consentsSchema>;

export const updateConsentsSchema = z.object({ marketingEmail: z.boolean() });
export type UpdateConsentsInput = z.infer<typeof updateConsentsSchema>;
