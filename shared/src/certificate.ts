import { z } from 'zod';

/** LMS-2026-000042: the year of issue and a number that is never reused. */
export const CERT_NO_PATTERN = /^LMS-\d{4}-\d{6}$/;

export const certificateStatusSchema = z.enum(['valid', 'revoked', 'invalid']);
export type CertificateStatus = z.infer<typeof certificateStatusSchema>;

/** What the public verification page shows. There is no email or account detail here. */
export const verificationSchema = z.object({
  status: certificateStatusSchema,
  certNo: z.string(),
  /** Masked ("B****** D*****") unless the request carries the code from the QR link. */
  recipientName: z.string(),
  nameMasked: z.boolean(),
  orgName: z.string().nullable(),
  courseTitle: z.string(),
  instructorName: z.string(),
  hours: z.number().int(),
  startedAt: z.string(),
  completedAt: z.string(),
  issuedAt: z.string(),
  revokedAt: z.string().nullable(),
  revokedReason: z.string().nullable(),
  signature: z.object({ algorithm: z.string(), keyId: z.string(), valid: z.boolean() }),
});
export type Verification = z.infer<typeof verificationSchema>;

/** One of the learner's own certificates. */
export const ownCertificateSchema = z.object({
  certNo: z.string(),
  verifyCode: z.string(),
  courseSlug: z.string(),
  courseTitle: z.string(),
  issuedAt: z.string(),
  revoked: z.boolean(),
});
export type OwnCertificate = z.infer<typeof ownCertificateSchema>;

/** An organization admin's view of the certificates issued in their organization. */
export const orgCertificateSchema = z.object({
  certNo: z.string(),
  recipientName: z.string(),
  courseTitle: z.string(),
  issuedAt: z.string(),
  revokedAt: z.string().nullable(),
});
export type OrgCertificate = z.infer<typeof orgCertificateSchema>;

export const revokeCertificateSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export const publicKeySchema = z.object({
  keyId: z.string(),
  algorithm: z.string(),
  publicKeyPem: z.string(),
  createdAt: z.string(),
  retiredAt: z.string().nullable(),
});
export type PublicKey = z.infer<typeof publicKeySchema>;

/** "Betülay Durmuş" → "B****** D*****": enough to recognise, not enough to collect. */
export function maskName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const [first = '', ...rest] = Array.from(part);
      return first + '*'.repeat(rest.length);
    })
    .join(' ');
}
