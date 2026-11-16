import { z } from 'zod';
import { localeSchema } from './locale.js';
import { roleSchema } from './roles.js';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const email = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());

const password = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const registerSchema = z
  .object({
    accountType: z.enum(['personal', 'company']),
    organizationName: z.string().trim().min(2).max(120).optional(),
    displayName: z.string().trim().min(2).max(120),
    email,
    password,
    locale: localeSchema,
  })
  .refine((value) => value.accountType === 'personal' || value.organizationName, {
    path: ['organizationName'],
    message: 'Required for a company account',
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  // Length is not checked here so a long guess costs the same as a short one.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const totpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Six digits'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(200),
});

export const loginResultSchema = z.discriminatedUnion('next', [
  z.object({ next: z.literal('done') }),
  z.object({ next: z.literal('totp') }),
]);
export type LoginResult = z.infer<typeof loginResultSchema>;

export const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: roleSchema,
  locale: localeSchema,
  twoFactorEnabled: z.boolean(),
  /** Whether this session passed the second factor. */
  mfaVerified: z.boolean(),
  /** Admins must enable 2FA before the admin area opens. */
  twoFactorRequired: z.boolean(),
  organization: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    kind: z.enum(['personal', 'company']),
  }),
});
export type Me = z.infer<typeof meSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  current: z.boolean(),
});
export type SessionInfo = z.infer<typeof sessionSchema>;

export const totpSetupSchema = z.object({
  otpauthUrl: z.string(),
  qrDataUrl: z.string(),
  secret: z.string(),
});
export type TotpSetup = z.infer<typeof totpSetupSchema>;

export const memberSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: roleSchema,
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  createdAt: z.string(),
});
export type Member = z.infer<typeof memberSchema>;

export const auditEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  actorId: z.string().nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const CSRF_HEADER = 'x-csrf-token';
