import { randomBytes } from 'node:crypto';
import { audit } from '../audit.js';
import type { PrismaClient } from '../db.js';
import { Prisma, type Certificate } from '../generated/prisma/client.js';
import type { AuthContext } from '../middleware/auth.js';
import { canonicalPayload, type CertificateKeyRing, type SignedFields } from './signing.js';

export function verifyUrl(webOrigin: string, certNo: string, verifyCode: string): string {
  return `${webOrigin}/dogrula/${certNo}?k=${verifyCode}`;
}

export function signedFields(certificate: Certificate): SignedFields {
  return {
    certNo: certificate.certNo,
    recipientName: certificate.recipientName,
    orgName: certificate.orgName,
    courseTitleTr: certificate.courseTitleTr,
    courseTitleEn: certificate.courseTitleEn,
    instructorName: certificate.instructorName,
    hours: certificate.hours,
    startedAt: certificate.startedAt,
    completedAt: certificate.completedAt,
    issuedAt: certificate.issuedAt,
  };
}

/**
 * Issues the certificate for a completed enrolment, once. Returns the existing
 * one if it was already issued, and null if the course offers no certificate.
 */
export async function issueCertificate(
  prisma: PrismaClient,
  keys: CertificateKeyRing,
  context: AuthContext,
  courseId: string,
  ipAddress?: string,
): Promise<Certificate | null> {
  const enrollment = await context.db.enrollment.findFirst({
    where: { userId: context.userId, courseId, completedAt: { not: null } },
    include: {
      course: { include: { instructor: true } },
      user: { include: { organization: true } },
    },
  });
  if (!enrollment?.completedAt || !enrollment.course.hasCertificate) return null;

  const existing = await context.db.certificate.findFirst({
    where: { enrollmentId: enrollment.id },
  });
  if (existing) return existing;

  const [row] = await prisma.$queryRaw<
    { nextval: bigint }[]
  >`SELECT nextval('certificate_number_seq')`;
  const issuedAt = new Date();
  const fields: SignedFields = {
    certNo: `LMS-${issuedAt.getUTCFullYear()}-${String(row?.nextval ?? 0).padStart(6, '0')}`,
    recipientName: enrollment.user.displayName,
    orgName:
      enrollment.user.organization.kind === 'company' ? enrollment.user.organization.name : null,
    courseTitleTr: enrollment.course.titleTr,
    courseTitleEn: enrollment.course.titleEn,
    instructorName: enrollment.course.instructor.name,
    hours: Math.max(1, Math.ceil(enrollment.course.durationMinutes / 60)),
    startedAt: enrollment.createdAt,
    completedAt: enrollment.completedAt,
    issuedAt,
  };
  const { signature, keyId } = await keys.sign(canonicalPayload(fields));

  try {
    const certificate = await context.db.certificate.create({
      data: {
        ...fields,
        orgId: context.orgId,
        userId: context.userId,
        courseId,
        enrollmentId: enrollment.id,
        // 72 random bits: unguessable, and still short enough for a QR code.
        verifyCode: randomBytes(9).toString('base64url'),
        signature,
        keyId,
      },
    });
    await audit(context.db, {
      orgId: context.orgId,
      actorId: context.userId,
      action: 'certificate.issued',
      targetType: 'certificate',
      targetId: certificate.certNo,
      ipAddress,
    });
    return certificate;
  } catch (error) {
    // Two requests finished the course together; the other one issued it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return context.db.certificate.findFirst({ where: { enrollmentId: enrollment.id } });
    }
    throw error;
  }
}
