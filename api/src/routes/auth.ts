import {
  loginSchema,
  registerSchema,
  rolesRequiringTwoFactor,
  totpCodeSchema,
  verifyEmailSchema,
  type LoginResult,
  type Me,
  type Role,
  type SessionInfo,
  type TotpSetup,
} from '@lumio/shared';
import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { audit } from '../audit.js';
import {
  CHALLENGE_COOKIE,
  clearChallengeCookie,
  clearSessionCookies,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  setAccessCookie,
  setChallengeCookie,
  setCsrfCookie,
  setSessionCookies,
} from '../http/cookies.js';
import { verificationMail } from '../mail/templates.js';
import { auth, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { decrypt, encrypt, hashToken, randomToken } from '../security/crypto.js';
import { isDisposableEmail } from '../security/disposable.js';
import { hashPassword, verifyPassword } from '../security/passwords.js';
import { newTotpSecret, totpEnrollment, verifyTotp } from '../security/totp.js';
import type { Services } from '../services.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
const VERIFICATION_TTL_HOURS = 24;

const invalidCredentials = () =>
  new HttpError(
    401,
    'invalid_credentials',
    'Email or password is incorrect, or the account is locked',
  );

function slugify(name: string): string {
  const base = name
    .toLocaleLowerCase('tr')
    .replaceAll('ı', 'i')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'org'}-${randomBytes(3).toString('hex')}`;
}

function clientInfo(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
  };
}

export interface AuthRouterOptions {
  /** Attempts per IP per 15 minutes on the sign-in and sign-up endpoints. */
  rateLimit?: number;
}

export function authRouter(services: Services, options: AuthRouterOptions = {}): Router {
  const router = Router();
  const { prisma, tokens, secureCookies: secure } = services;

  const limiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: options.rateLimit ?? 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new HttpError(429, 'rate_limited', 'Too many attempts, try again later')),
  });

  async function startSession(
    req: Request,
    res: Response,
    user: { id: string; orgId: string; role: Role },
    mfaVerified: boolean,
  ) {
    const refresh = randomToken();
    const session = await prisma.session.create({
      data: {
        orgId: user.orgId,
        userId: user.id,
        refreshTokenHash: hashToken(refresh),
        mfaVerified,
        ...clientInfo(req),
        expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      },
    });
    const access = await tokens.signAccess({
      userId: user.id,
      orgId: user.orgId,
      sessionId: session.id,
      role: user.role,
    });
    setSessionCookies(res, secure, { access, refresh });
    setCsrfCookie(res, secure, randomToken());
    return session;
  }

  async function recordFailure(
    req: Request,
    user: { id: string; orgId: string; failedLogins: number },
  ) {
    const failures = user.failedLogins + 1;
    const locked = failures >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: locked
        ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) }
        : { failedLogins: failures },
    });
    await audit(prisma, {
      orgId: user.orgId,
      actorId: user.id,
      action: locked ? 'auth.account_locked' : 'auth.login_failed',
      ipAddress: req.ip,
      metadata: { failures },
    });
  }

  /** Issues the CSRF cookie. The client calls this once before its first write. */
  router.get('/csrf', (_req, res) => {
    setCsrfCookie(res, secure, randomToken());
    res.status(204).end();
  });

  router.post('/register', limiter, async (req, res) => {
    const input = registerSchema.parse(req.body);
    if (isDisposableEmail(input.email)) {
      throw new HttpError(422, 'disposable_email', 'Use a permanent email address');
    }

    // Hash first so an existing address costs the same time as a new one.
    const passwordHash = await hashPassword(input.password);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });

    if (!existing) {
      const token = randomToken();
      const user = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name:
              input.accountType === 'company' && input.organizationName
                ? input.organizationName
                : input.displayName,
            slug: slugify(input.organizationName ?? input.displayName),
            kind: input.accountType,
          },
        });
        const created = await tx.user.create({
          data: {
            orgId: organization.id,
            email: input.email,
            displayName: input.displayName,
            passwordHash,
            locale: input.locale,
            // Whoever opens a company account administers it.
            role: input.accountType === 'company' ? 'org_admin' : 'learner',
          },
        });
        await tx.emailVerification.create({
          data: {
            userId: created.id,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + VERIFICATION_TTL_HOURS * 3_600_000),
          },
        });
        await audit(tx, {
          orgId: organization.id,
          actorId: created.id,
          action: 'user.registered',
          targetType: 'organization',
          targetId: organization.id,
          ipAddress: req.ip,
          metadata: { accountType: input.accountType },
        });
        return created;
      });

      const link = `${services.webOrigin}/verify-email?token=${encodeURIComponent(token)}`;
      await services.mailer.send(
        verificationMail({ to: user.email, name: user.displayName, link, locale: user.locale }),
      );
    }

    // The same answer either way, so the endpoint cannot be used to find out who has an account.
    res.status(202).json({ status: 'verification_sent' });
  });

  router.post('/verify-email', limiter, async (req, res) => {
    const { token } = verifyEmailSchema.parse(req.body);
    const record = await prisma.emailVerification.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new HttpError(400, 'invalid_token', 'This link is invalid or has expired');
    }
    await prisma.$transaction([
      prisma.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
      }),
    ]);
    await audit(prisma, {
      orgId: record.user.orgId,
      actorId: record.userId,
      action: 'user.email_verified',
      ipAddress: req.ip,
    });
    res.json({ status: 'verified' });
  });

  router.post('/login', limiter, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    const passwordOk = await verifyPassword(user?.passwordHash, input.password);

    if (!user) throw invalidCredentials();
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await audit(prisma, {
        orgId: user.orgId,
        actorId: user.id,
        action: 'auth.login_failed',
        ipAddress: req.ip,
        metadata: { reason: 'locked' },
      });
      throw invalidCredentials();
    }
    if (!passwordOk) {
      await recordFailure(req, user);
      throw invalidCredentials();
    }
    if (!user.emailVerifiedAt) {
      throw new HttpError(403, 'email_not_verified', 'Verify your email address first');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });

    let result: LoginResult;
    if (user.totpEnabledAt) {
      setChallengeCookie(res, secure, await tokens.signChallenge(user.id));
      result = { next: 'totp' };
    } else {
      await startSession(req, res, user, false);
      await audit(prisma, {
        orgId: user.orgId,
        actorId: user.id,
        action: 'auth.login_succeeded',
        ipAddress: req.ip,
        metadata: { mfa: false },
      });
      result = { next: 'done' };
    }
    res.json(result);
  });

  router.post('/login/totp', limiter, async (req, res) => {
    const { code } = totpCodeSchema.parse(req.body);
    const challenge = req.signedCookies?.[CHALLENGE_COOKIE] as string | undefined;
    const userId = challenge ? await tokens.verifyChallenge(challenge) : null;
    if (!userId) throw new HttpError(401, 'challenge_expired', 'Sign in again');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret || !user.totpEnabledAt) {
      throw new HttpError(401, 'challenge_expired', 'Sign in again');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) throw invalidCredentials();

    const secret = decrypt(user.totpSecret, services.encryptionKey);
    const fresh = await services.replay.claim(`totp:${user.id}:${code}`, 90);
    if (!fresh || !(await verifyTotp(secret, code))) {
      await audit(prisma, {
        orgId: user.orgId,
        actorId: user.id,
        action: 'auth.totp_failed',
        ipAddress: req.ip,
      });
      await recordFailure(req, user);
      throw new HttpError(401, 'invalid_code', 'The code is not valid');
    }

    clearChallengeCookie(res, secure);
    await startSession(req, res, user, true);
    await audit(prisma, {
      orgId: user.orgId,
      actorId: user.id,
      action: 'auth.login_succeeded',
      ipAddress: req.ip,
      metadata: { mfa: true },
    });
    const result: LoginResult = { next: 'done' };
    res.json(result);
  });

  /**
   * Rotates the refresh token on every use. A token that was already rotated
   * away can only be presented by someone who copied it, so the whole session ends.
   */
  router.post('/refresh', async (req, res) => {
    const presented = req.signedCookies?.[REFRESH_COOKIE] as string | undefined;
    if (!presented) throw new HttpError(401, 'unauthenticated', 'Sign in required');
    const digest = hashToken(presented);

    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: digest },
      include: { user: { select: { role: true } } },
    });

    if (!session) {
      const reused = await prisma.session.findUnique({ where: { previousHash: digest } });
      if (reused && !reused.revokedAt) {
        await prisma.session.update({ where: { id: reused.id }, data: { revokedAt: new Date() } });
        await audit(prisma, {
          orgId: reused.orgId,
          actorId: reused.userId,
          action: 'auth.refresh_reused',
          targetType: 'session',
          targetId: reused.id,
          ipAddress: req.ip,
        });
      }
      clearSessionCookies(res, secure);
      throw new HttpError(401, 'unauthenticated', 'Sign in required');
    }
    if (session.revokedAt || session.expiresAt < new Date()) {
      clearSessionCookies(res, secure);
      throw new HttpError(401, 'unauthenticated', 'Session has ended');
    }

    const next = randomToken();
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: hashToken(next), previousHash: digest, lastUsedAt: new Date() },
    });
    const access = await tokens.signAccess({
      userId: session.userId,
      orgId: session.orgId,
      sessionId: session.id,
      role: session.user.role,
    });
    setSessionCookies(res, secure, { access, refresh: next });
    res.status(204).end();
  });

  router.post('/logout', requireAuth(services), async (req, res) => {
    const context = auth(req);
    await context.db.session.update({
      where: { id: context.sessionId },
      data: { revokedAt: new Date() },
    });
    await audit(context.db, {
      orgId: context.orgId,
      actorId: context.userId,
      action: 'auth.logout',
      ipAddress: req.ip,
    });
    clearSessionCookies(res, secure);
    res.status(204).end();
  });

  router.get('/me', requireAuth(services), async (req, res) => {
    const context = auth(req);
    const user = await context.db.user.findUniqueOrThrow({
      where: { id: context.userId },
      include: { organization: true },
    });
    const me: Me = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      locale: user.locale,
      twoFactorEnabled: Boolean(user.totpEnabledAt),
      mfaVerified: context.mfaVerified,
      twoFactorRequired: rolesRequiringTwoFactor.includes(user.role),
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        kind: user.organization.kind,
      },
    };
    res.json(me);
  });

  router.get('/sessions', requireAuth(services), async (req, res) => {
    const context = auth(req);
    const sessions = await context.db.session.findMany({
      where: { userId: context.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    const body: SessionInfo[] = sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      current: session.id === context.sessionId,
    }));
    res.json(body);
  });

  router.delete('/sessions/:id', requireAuth(services), async (req, res) => {
    const context = auth(req);
    const id = String(req.params.id);
    // Scoped to the organization by the client and to the user by the filter:
    // someone else's session id simply is not found.
    const { count } = await context.db.session.updateMany({
      where: { id, userId: context.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new HttpError(404, 'not_found', 'Session not found');
    await audit(context.db, {
      orgId: context.orgId,
      actorId: context.userId,
      action: 'session.revoked',
      targetType: 'session',
      targetId: id,
      ipAddress: req.ip,
    });
    res.status(204).end();
  });

  router.post('/totp/setup', requireAuth(services), async (req, res) => {
    const context = auth(req);
    const user = await context.db.user.findUniqueOrThrow({ where: { id: context.userId } });
    if (user.totpEnabledAt) {
      throw new HttpError(409, 'totp_already_enabled', 'Two-factor authentication is already on');
    }
    const secret = newTotpSecret();
    await context.db.user.update({
      where: { id: user.id },
      data: { totpSecret: encrypt(secret, services.encryptionKey) },
    });
    const { otpauthUrl, qrDataUrl } = await totpEnrollment(secret, user.email);
    const body: TotpSetup = { otpauthUrl, qrDataUrl, secret };
    res.json(body);
  });

  router.post('/totp/enable', requireAuth(services), limiter, async (req, res) => {
    const context = auth(req);
    const { code } = totpCodeSchema.parse(req.body);
    const user = await context.db.user.findUniqueOrThrow({ where: { id: context.userId } });
    if (user.totpEnabledAt) {
      throw new HttpError(409, 'totp_already_enabled', 'Two-factor authentication is already on');
    }
    if (!user.totpSecret) throw new HttpError(400, 'totp_not_started', 'Start the setup first');

    const secret = decrypt(user.totpSecret, services.encryptionKey);
    const fresh = await services.replay.claim(`totp:${user.id}:${code}`, 90);
    if (!fresh || !(await verifyTotp(secret, code))) {
      throw new HttpError(401, 'invalid_code', 'The code is not valid');
    }

    await context.db.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date() } });
    // This session just proved the second factor; every other one has to prove it again.
    await context.db.session.update({
      where: { id: context.sessionId },
      data: { mfaVerified: true },
    });
    await context.db.session.updateMany({
      where: { userId: user.id, id: { not: context.sessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await audit(context.db, {
      orgId: context.orgId,
      actorId: user.id,
      action: 'totp.enabled',
      ipAddress: req.ip,
    });
    const access = await tokens.signAccess({
      userId: user.id,
      orgId: context.orgId,
      sessionId: context.sessionId,
      role: user.role,
    });
    setAccessCookie(res, secure, access);
    res.json({ status: 'enabled' });
  });

  return router;
}
