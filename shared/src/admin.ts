import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './auth.js';
import { localeSchema } from './locale.js';

/**
 * Roles an organization admin can give. Platform admin is deliberately absent:
 * it is granted only from the server's command line, never through the API.
 */
export const assignableRoles = ['learner', 'instructor', 'org_admin'] as const;
export const assignableRoleSchema = z.enum(assignableRoles);
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

export const INVITATION_TTL_DAYS = 7;

export const inviteSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
  role: assignableRoleSchema,
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const invitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: assignableRoleSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
  expired: z.boolean(),
});
export type Invitation = z.infer<typeof invitationSchema>;

export const invitationTokenSchema = z.object({ token: z.string().min(20).max(200) });

export const invitationPreviewSchema = z.object({
  organizationName: z.string(),
  email: z.string(),
  role: assignableRoleSchema,
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(20).max(200),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  locale: localeSchema,
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const changeRoleSchema = z.object({ role: assignableRoleSchema });

export const orgStatsSchema = z.object({
  members: z.number().int(),
  disabledMembers: z.number().int(),
  pendingInvitations: z.number().int(),
  enrollments: z.number().int(),
  completions: z.number().int(),
  certificates: z.number().int(),
});
export type OrgStats = z.infer<typeof orgStatsSchema>;

export const platformOverviewSchema = z.object({
  totals: z.object({
    organizations: z.number().int(),
    users: z.number().int(),
    enrollments: z.number().int(),
    completions: z.number().int(),
    certificates: z.number().int(),
    publishedCourses: z.number().int(),
  }),
  organizations: z
    .object({
      id: z.string(),
      /** Null for personal accounts, whose organization is named after the person. */
      name: z.string().nullable(),
      kind: z.enum(['personal', 'company']),
      members: z.number().int(),
      enrollments: z.number().int(),
      completions: z.number().int(),
      createdAt: z.string(),
    })
    .array(),
});
export type PlatformOverview = z.infer<typeof platformOverviewSchema>;

export const platformCourseSchema = z.object({
  slug: z.string(),
  title: z.string(),
  status: z.enum(['draft', 'published']),
  enrollmentCount: z.number().int(),
  completionCount: z.number().int(),
});
export type PlatformCourse = z.infer<typeof platformCourseSchema>;

export const courseStatusSchema = z.object({ status: z.enum(['draft', 'published']) });
