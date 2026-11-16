import {
  CERT_NO_PATTERN,
  localeSchema,
  maskName,
  revokeCertificateSchema,
  type Locale,
  type OwnCertificate,
  type PublicKey,
  type Verification,
} from '@lumio/shared';
import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { audit } from '../audit.js';
import { issueCertificate, signedFields, verifyUrl } from '../certificates/issue.js';
import { renderPdf, renderPng, renderSvg } from '../certificates/render.js';
import { canonicalPayload, SIGNATURE_ALGORITHM } from '../certificates/signing.js';
import type { Certificate } from '../generated/prisma/client.js';
import { auth, requireAuth, requireMfaForAdmins, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import type { Services } from '../services.js';

const certNoParam = z.string().regex(CERT_NO_PATTERN);
const PREVIEW_WIDTHS = [800, 1600, 3508];

const pick = <T>(locale: Locale, tr: T, en: T) => (locale === 'tr' ? tr : en);

function localeOf(req: Request): Locale {
  const parsed = localeSchema.safeParse(req.query.locale);
  return parsed.success ? parsed.data : 'tr';
}

function codeMatches(certificate: Certificate, given: unknown): boolean {
  if (typeof given !== 'string') return false;
  const expected = Buffer.from(certificate.verifyCode);
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function certificatesRouter(services: Services): Router {
  const router = Router();
  const { prisma } = services;
  const keys = services.certificates;

  // Verification is public; the limit keeps anyone from walking the number range quickly.
  const verifyLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new HttpError(429, 'rate_limited', 'Too many requests, try again later')),
  });

  async function load(req: Request) {
    const certNo = certNoParam.parse(req.params.certNo);
    const certificate = await prisma.certificate.findUnique({ where: { certNo } });
    if (!certificate) throw new HttpError(404, 'not_found', 'Certificate not found');
    const signatureValid = await keys.verify(
      canonicalPayload(signedFields(certificate)),
      certificate.signature,
      certificate.keyId,
    );
    return { certificate, signatureValid };
  }

  router.get('/keys', async (_req, res) => {
    const rows = await prisma.signingKey.findMany({ orderBy: { createdAt: 'asc' } });
    const body: PublicKey[] = rows.map((row) => ({
      keyId: row.id,
      algorithm: row.algorithm,
      publicKeyPem: row.publicKey,
      createdAt: row.createdAt.toISOString(),
      retiredAt: row.retiredAt?.toISOString() ?? null,
    }));
    res.json(body);
  });

  router.get('/:certNo', verifyLimiter, async (req, res) => {
    const locale = localeOf(req);
    const { certificate, signatureValid } = await load(req);
    const showName = codeMatches(certificate, req.query.k);
    const body: Verification = {
      // A broken signature outranks everything: the record cannot be trusted at all.
      status: !signatureValid ? 'invalid' : certificate.revokedAt ? 'revoked' : 'valid',
      certNo: certificate.certNo,
      recipientName: showName ? certificate.recipientName : maskName(certificate.recipientName),
      nameMasked: !showName,
      orgName: certificate.orgName,
      courseTitle: pick(locale, certificate.courseTitleTr, certificate.courseTitleEn),
      instructorName: certificate.instructorName,
      hours: certificate.hours,
      startedAt: certificate.startedAt.toISOString(),
      completedAt: certificate.completedAt.toISOString(),
      issuedAt: certificate.issuedAt.toISOString(),
      revokedAt: certificate.revokedAt?.toISOString() ?? null,
      revokedReason: certificate.revokedReason,
      signature: {
        algorithm: SIGNATURE_ALGORITHM,
        keyId: certificate.keyId,
        valid: signatureValid,
      },
    };
    res.json(body);
  });

  async function document(req: Request) {
    const { certificate, signatureValid } = await load(req);
    if (!codeMatches(certificate, req.query.k)) {
      throw new HttpError(403, 'invalid_link', 'The verification code is missing or wrong');
    }
    // A record whose signature fails is never drawn: that would hand out a forgery.
    if (!signatureValid) {
      throw new HttpError(409, 'invalid_certificate', 'This certificate failed verification');
    }
    const view = {
      ...signedFields(certificate),
      keyId: certificate.keyId,
      verifyUrl: verifyUrl(services.webOrigin, certificate.certNo, certificate.verifyCode),
      revoked: Boolean(certificate.revokedAt),
    };
    return { certificate, view, svg: await renderSvg(view) };
  }

  router.get('/:certNo/certificate.png', verifyLimiter, async (req, res) => {
    const { certificate, svg } = await document(req);
    const requested = Number(req.query.w);
    const width = PREVIEW_WIDTHS.includes(requested) ? requested : 1600;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.setHeader('Content-Disposition', `inline; filename="${certificate.certNo}.png"`);
    res.send(renderPng(svg, width));
  });

  router.get('/:certNo/certificate.pdf', verifyLimiter, async (req, res) => {
    const { certificate, view, svg } = await document(req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.setHeader('Content-Disposition', `attachment; filename="${certificate.certNo}.pdf"`);
    res.send(Buffer.from(await renderPdf(svg, view)));
  });

  router.post(
    '/:certNo/revoke',
    requireAuth(services),
    requireRole('org_admin', 'platform_admin'),
    requireMfaForAdmins,
    async (req, res) => {
      const context = auth(req);
      const certNo = certNoParam.parse(req.params.certNo);
      const { reason } = revokeCertificateSchema.parse(req.body);
      // Scoped: an admin can only revoke certificates issued in their own organization.
      const { count } = await context.db.certificate.updateMany({
        where: { certNo, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      });
      if (count === 0) throw new HttpError(404, 'not_found', 'Certificate not found');
      await audit(context.db, {
        orgId: context.orgId,
        actorId: context.userId,
        action: 'certificate.revoked',
        targetType: 'certificate',
        targetId: certNo,
        ipAddress: req.ip,
        metadata: { reason },
      });
      res.status(204).end();
    },
  );

  return router;
}

/** The learner's own certificates, issuing any that a completed course is still owed. */
export function myCertificatesRouter(services: Services): Router {
  const router = Router();

  router.get('/certificates', requireAuth(services), async (req, res) => {
    const context = auth(req);
    const locale = localeOf(req);
    const completed = await context.db.enrollment.findMany({
      where: { userId: context.userId, completedAt: { not: null } },
      select: { courseId: true },
    });
    for (const { courseId } of completed) {
      await issueCertificate(services.prisma, services.certificates, context, courseId, req.ip);
    }

    const certificates = await context.db.certificate.findMany({
      where: { userId: context.userId },
      orderBy: { issuedAt: 'desc' },
    });
    const courses = await services.prisma.course.findMany({
      where: { id: { in: certificates.map((certificate) => certificate.courseId) } },
      select: { id: true, slug: true },
    });
    const slugs = new Map(courses.map((course) => [course.id, course.slug]));
    const body: OwnCertificate[] = certificates.map((certificate) => ({
      certNo: certificate.certNo,
      verifyCode: certificate.verifyCode,
      courseSlug: slugs.get(certificate.courseId) ?? '',
      courseTitle: pick(locale, certificate.courseTitleTr, certificate.courseTitleEn),
      issuedAt: certificate.issuedAt.toISOString(),
      revoked: Boolean(certificate.revokedAt),
    }));
    res.json(body);
  });

  return router;
}
