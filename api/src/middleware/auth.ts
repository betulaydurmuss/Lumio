import { rolesRequiringTwoFactor, type Role } from '@lumio/shared';
import type { RequestHandler } from 'express';
import { ACCESS_COOKIE } from '../http/cookies.js';
import type { Services } from '../services.js';
import { scopedPrisma, type ScopedPrisma } from '../tenancy.js';
import { HttpError } from './errors.js';

export interface AuthContext {
  userId: string;
  orgId: string;
  sessionId: string;
  role: Role;
  mfaVerified: boolean;
  /** A client that only reaches this organization's rows. */
  db: ScopedPrisma;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Verifies the access token and then the session behind it, so that revoking
 * a session takes effect on the next request rather than when the token expires.
 * Role comes from the database, not the token, for the same reason.
 */
export function requireAuth(services: Services): RequestHandler {
  return async (req, _res, next) => {
    const raw = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    const token = raw ? await services.tokens.verifyAccess(raw) : null;
    if (!token) return next(new HttpError(401, 'unauthenticated', 'Sign in required'));

    const session = await services.prisma.session.findFirst({
      where: {
        id: token.sessionId,
        userId: token.userId,
        orgId: token.orgId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { mfaVerified: true, user: { select: { role: true } } },
    });
    if (!session) return next(new HttpError(401, 'unauthenticated', 'Session has ended'));

    req.auth = {
      userId: token.userId,
      orgId: token.orgId,
      sessionId: token.sessionId,
      role: session.user.role,
      mfaVerified: session.mfaVerified,
      db: scopedPrisma(services.prisma, token.orgId),
    };
    next();
  };
}

export function auth(req: Express.Request): AuthContext {
  if (!req.auth) throw new HttpError(401, 'unauthenticated', 'Sign in required');
  return req.auth;
}

export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    const context = req.auth;
    if (!context || !allowed.includes(context.role)) {
      return next(new HttpError(403, 'forbidden', 'Not allowed'));
    }
    next();
  };
}

/** Admin roles must have passed TOTP in this session. */
export const requireMfaForAdmins: RequestHandler = (req, _res, next) => {
  const context = req.auth;
  if (context && rolesRequiringTwoFactor.includes(context.role) && !context.mfaVerified) {
    return next(new HttpError(403, 'mfa_required', 'Two-factor authentication is required'));
  }
  next();
};
