import {
  acceptInvitationSchema,
  forgotPasswordSchema,
  invitationTokenSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  rolesRequiringTwoFactor,
  totpCodeSchema,
  totpSetupRequestSchema,
  verifyEmailSchema,
  type LoginResult,
  type Me,
  type Role,
  type SessionInfo,
  type InvitationPreview,
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
import { passwordResetMail, verificationMail } from '../mail/templates.js';
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
const RESET_TTL_MINUTES = 60;
/** At most one reset mail per account in this many minutes, so nobody's inbox can be flooded. */
const RESET_MAIL_GAP_MINUTES = 5;

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

  // Refresh runs every 15 minutes per open tab, so it gets a separate, larger allowance.
  const refreshLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: options.rateLimit ?? 60,
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

  // Sign-in attempts are counted per account, for the password and the second
  // factor together. An attempt is taken *before* the password or code is
  // checked, with one conditional update: requests sent at the same moment each
  // use one up instead of all reading the same old count, and once five are
  // used nothing more is checked until the lock runs out. The count only goes
  // back to zero when a sign-in completes, so entering the right password again
  // does not buy a fresh set of guesses at the code.

  /** Takes one attempt. False when the account is locked or has none left. */
  async function claimAttempt(req: Request, user: { id: string; orgId: string }) {
    const now = new Date();
    const claimed = await prisma.user.updateMany({
      where: {
        id: user.id,
        failedLogins: { lt: MAX_FAILED_LOGINS },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      data: { failedLogins: { increment: 1 }, lockedUntil: null },
    });
    if (claimed.count === 1) return true;
    await lockIfSpent(req, user);
    await audit(prisma, {
      orgId: user.orgId,
      actorId: user.id,
      action: 'auth.login_failed',
      ipAddress: req.ip,
      metadata: { reason: 'locked' },
    });
    return false;
  }

  /** Locks the account once every attempt has been used, and only once. */
  async function lockIfSpent(req: Request, user: { id: string; orgId: string }) {
    const now = new Date();
    const locked = await prisma.user.updateMany({
      where: {
        id: user.id,
        failedLogins: { gte: MAX_FAILED_LOGINS },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      data: { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) },
    });
    if (locked.count === 1) {
      await audit(prisma, {
        orgId: user.orgId,
        actorId: user.id,
        action: 'auth.account_locked',
        ipAddress: req.ip,
      });
    }
  }

  async function recordFailure(req: Request, user: { id: string; orgId: string }) {
    await audit(prisma, {
      orgId: user.orgId,
      actorId: user.id,
      action: 'auth.login_failed',
      ipAddress: req.ip,
    });
    await lockIfSpent(req, user);
  }

  async function resetAttempts(user: { id: string }) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });
  }

  async function hasLiveVerification(userId: string) {
    const live = await prisma.emailVerification.count({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    });
    return live > 0;
  }

  /**
   * Drops a sign-up that never proved its address, with the organization it
   * opened if nobody else is in it. An unverified account cannot sign in, so it
   * has nothing to lose; it only stands between the address and its owner.
   */
  async function forgetUnverified(
    db: Pick<typeof prisma, 'user' | 'organization'>,
    user: { id: string; orgId: string },
  ) {
    await db.user.delete({ where: { id: user.id } });
    if ((await db.user.count({ where: { orgId: user.orgId } })) === 0) {
      await db.organization.delete({ where: { id: user.orgId } });
    }
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
    let existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing && !existing.emailVerifiedAt && !(await hasLiveVerification(existing.id))) {
      // Nobody proved this address within a day, so it is free again.
      await forgetUnverified(prisma, existing);
      existing = null;
    }

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

  // Forgotten password. The link goes to the address on the account, so
  // whoever can read that mailbox can set the password. That also gives the
  // address back to its owner when someone else signed up with it, and opens
  // an account that a stranger keeps locking with wrong passwords.
  router.post('/password/forgot', limiter, async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    const recent = user
      ? await prisma.passwordReset.count({
          where: {
            userId: user.id,
            createdAt: { gt: new Date(Date.now() - RESET_MAIL_GAP_MINUTES * 60_000) },
          },
        })
      : 0;

    if (user && !user.disabledAt && recent === 0) {
      const token = randomToken();
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
        },
      });
      await audit(prisma, {
        orgId: user.orgId,
        actorId: user.id,
        action: 'auth.password_reset_requested',
        ipAddress: req.ip,
      });
      const link = `${services.webOrigin}/reset-password?token=${encodeURIComponent(token)}`;
      await services.mailer.send(passwordResetMail({ to: user.email, link, locale: user.locale }));
    }
    // The same answer either way, so the endpoint cannot be used to find out who has an account.
    res.status(202).json({ status: 'reset_sent' });
  });

  router.post('/password/reset', limiter, async (req, res) => {
    const input = resetPasswordSchema.parse(req.body);
    const passwordHash = await hashPassword(input.password);
    const now = new Date();

    const user = await prisma.$transaction(async (tx) => {
      // Conditional, so one link used twice at the same moment only works once.
      const record = await tx.passwordReset.findUnique({
        where: { tokenHash: hashToken(input.token) },
        include: { user: true },
      });
      const claimed = record
        ? await tx.passwordReset.updateMany({
            where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
            data: { usedAt: now },
          })
        : { count: 0 };
      if (!record || claimed.count === 0 || record.user.disabledAt) {
        throw new HttpError(400, 'invalid_token', 'This link is invalid or has expired');
      }
      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          failedLogins: 0,
          lockedUntil: null,
          // Opening a link sent to the address proves it, as verification would.
          emailVerifiedAt: record.user.emailVerifiedAt ?? now,
        },
      });
      // Whoever knew the old password, or held a session, is out.
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.passwordReset.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: now },
      });
      await audit(tx, {
        orgId: record.user.orgId,
        actorId: record.userId,
        action: 'auth.password_reset',
        ipAddress: req.ip,
      });
      return record.user;
    });
    clearSessionCookies(res, secure);
    res.json({ status: 'reset', email: user.email });
  });

  router.post('/login', limiter, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    const allowed = user ? await claimAttempt(req, user) : false;
    // Always hashed, so an unknown or locked account answers as slowly as any other.
    const passwordOk = await verifyPassword(
      allowed ? user?.passwordHash : undefined,
      input.password,
    );

    if (!user || !allowed) throw invalidCredentials();
    if (!passwordOk) {
      await recordFailure(req, user);
      throw invalidCredentials();
    }
    // Same answer as a wrong password: a deactivated account reveals nothing new.
    if (user.disabledAt) throw invalidCredentials();
    if (!user.emailVerifiedAt) {
      throw new HttpError(403, 'email_not_verified', 'Verify your email address first');
    }

    let result: LoginResult;
    if (user.totpEnabledAt) {
      // The attempt stays counted until the code is right as well.
      setChallengeCookie(res, secure, await tokens.signChallenge(user.id));
      result = { next: 'totp' };
    } else {
      await resetAttempts(user);
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
    if (user.disabledAt) throw invalidCredentials();
    if (!(await claimAttempt(req, user))) throw invalidCredentials();

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
    await resetAttempts(user);
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
  router.post('/refresh', refreshLimiter, async (req, res) => {
    const presented = req.signedCookies?.[REFRESH_COOKIE] as string | undefined;
    if (!presented) throw new HttpError(401, 'unauthenticated', 'Sign in required');
    const digest = hashToken(presented);

    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: digest },
      include: { user: { select: { role: true, disabledAt: true } } },
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
    if (session.revokedAt || session.expiresAt < new Date() || session.user.disabledAt) {
      clearSessionCookies(res, secure);
      throw new HttpError(401, 'unauthenticated', 'Session has ended');
    }

    // Conditional, so a token presented twice at the same moment is rotated
    // once: the second request finds it already replaced and gets nothing.
    const next = randomToken();
    const rotated = await prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: digest, revokedAt: null },
      data: { refreshTokenHash: hashToken(next), previousHash: digest, lastUsedAt: new Date() },
    });
    if (rotated.count === 0) throw new HttpError(401, 'unauthenticated', 'Sign in required');
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

  router.post('/totp/setup', requireAuth(services), limiter, async (req, res) => {
    const context = auth(req);
    const { password } = totpSetupRequestSchema.parse(req.body);
    const user = await context.db.user.findUniqueOrThrow({ where: { id: context.userId } });
    if (user.totpEnabledAt) {
      throw new HttpError(409, 'totp_already_enabled', 'Two-factor authentication is already on');
    }
    // Binding a second factor is a privilege change: a session cookie alone must not
    // be enough, or whoever steals one could enrol their own authenticator and pass
    // the admin 2FA gate. Wrong passwords count towards the account lockout.
    if (!(await claimAttempt(req, user))) throw invalidCredentials();
    if (!(await verifyPassword(user.passwordHash, password))) {
      await recordFailure(req, user);
      throw invalidCredentials();
    }
    await resetAttempts(user);
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

  /** A usable invitation for this token, or a 400 that does not say why. */
  async function openInvitation(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { organization: true, invitedBy: true },
    });
    // An invitation carries its sender's authority, so it is only as good as
    // that authority is now: a sender who has since been demoted, deactivated
    // or moved elsewhere can no longer bring anyone in.
    const sender = invitation?.invitedBy;
    const senderCanInvite =
      sender &&
      !sender.disabledAt &&
      sender.orgId === invitation.orgId &&
      (sender.role === 'org_admin' || sender.role === 'platform_admin');
    if (
      !invitation ||
      !senderCanInvite ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt < new Date() ||
      invitation.role === 'platform_admin'
    ) {
      throw new HttpError(400, 'invalid_token', 'This invitation is invalid or has expired');
    }
    return { ...invitation, role: invitation.role };
  }

  // The token travels in the body, not the URL, so it never lands in access logs.
  router.post('/invitations/lookup', limiter, async (req, res) => {
    const { token } = invitationTokenSchema.parse(req.body);
    const invitation = await openInvitation(token);
    const body: InvitationPreview = {
      organizationName: invitation.organization.name,
      email: invitation.email,
      role: invitation.role,
    };
    res.json(body);
  });

  router.post('/invitations/accept', limiter, async (req, res) => {
    const input = acceptInvitationSchema.parse(req.body);
    const invitation = await openInvitation(input.token);
    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing?.emailVerifiedAt) {
      throw new HttpError(409, 'email_taken', 'This address already has a Lumio account');
    }
    const passwordHash = await hashPassword(input.password);

    await prisma.$transaction(async (tx) => {
      // Conditional, so the same link accepted twice at once only works once.
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new HttpError(400, 'invalid_token', 'This invitation is invalid or has expired');
      }
      // The invitation mail reached this address; an unverified sign-up never did.
      if (existing) await forgetUnverified(tx, existing);
      const user = await tx.user.create({
        data: {
          orgId: invitation.orgId,
          email: invitation.email,
          displayName: input.displayName,
          passwordHash,
          role: invitation.role,
          locale: input.locale,
          // Opening the emailed link is the proof the address works.
          emailVerifiedAt: new Date(),
        },
      });
      await audit(tx, {
        orgId: invitation.orgId,
        actorId: user.id,
        action: 'invitation.accepted',
        targetType: 'invitation',
        targetId: invitation.id,
        ipAddress: req.ip,
      });
    });
    res.status(201).json({ status: 'joined' });
  });

  return router;
}
