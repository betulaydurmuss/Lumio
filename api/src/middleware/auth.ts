import { rolesRequiringTwoFactor, type Role } from '@lumio/shared';
import type { Request, RequestHandler } from 'express';
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
async function resolveAuth(services: Services, req: Request): Promise<AuthContext | null> {
  const raw = req.cookies?.[ACCESS_COOKIE] as string | undefined;
  const token = raw ? await services.tokens.verifyAccess(raw) : null;
  if (!token) return null;

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
  if (!session) return null;

  return {
    userId: token.userId,
    orgId: token.orgId,
    sessionId: token.sessionId,
    role: session.user.role,
    mfaVerified: session.mfaVerified,
    db: scopedPrisma(services.prisma, token.orgId),
  };
}

export function requireAuth(services: Services): RequestHandler {
  return async (req, _res, next) => {
    const context = await resolveAuth(services, req);
    if (!context) return next(new HttpError(401, 'unauthenticated', 'Sign in required'));
    req.auth = context;
    next();
  };
}

/** For public pages that show a little more to a signed-in visitor. Never rejects. */
export function optionalAuth(services: Services): RequestHandler {
  return async (req, _res, next) => {
    const context = await resolveAuth(services, req);
    if (context) req.auth = context;
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
