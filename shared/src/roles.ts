import { z } from 'zod';

/**
 * Every user belongs to exactly one organization and holds one role in it.
 * Platform admins operate across organizations and must use 2FA.
 */
export const roles = ['learner', 'instructor', 'org_admin', 'platform_admin'] as const;

export const roleSchema = z.enum(roles);
export type Role = z.infer<typeof roleSchema>;

export const rolesRequiringTwoFactor: readonly Role[] = ['org_admin', 'platform_admin'];
