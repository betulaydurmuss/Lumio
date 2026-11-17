import { roleSchema, type Role } from '@lumio/shared';
import { jwtVerify, SignJWT } from 'jose';
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;

const ISSUER = 'lumio';

const accessClaims = z.object({
  sub: z.string(),
  org: z.string(),
  sid: z.string(),
  role: roleSchema,
  typ: z.literal('access'),
});

const challengeClaims = z.object({
  sub: z.string(),
  pwd: z.string(),
  typ: z.literal('mfa_challenge'),
});

/**
 * A short fingerprint of the stored password hash. A challenge carries the one
 * in force when the password step passed; once the password changes, the
 * fingerprints differ and the half-finished sign-in is worthless.
 */
export function passwordFingerprint(passwordHash: string | null): string {
  return createHash('sha256')
    .update(passwordHash ?? '')
    .digest('base64url')
    .slice(0, 22);
}

export interface AccessToken {
  userId: string;
  orgId: string;
  sessionId: string;
  role: Role;
}

export class TokenService {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  signAccess(token: AccessToken): Promise<string> {
    return new SignJWT({ org: token.orgId, sid: token.sessionId, role: token.role, typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(token.userId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async verifyAccess(jwt: string): Promise<AccessToken | null> {
    try {
      const { payload } = await jwtVerify(jwt, this.key, { issuer: ISSUER, algorithms: ['HS256'] });
      const claims = accessClaims.parse(payload);
      return { userId: claims.sub, orgId: claims.org, sessionId: claims.sid, role: claims.role };
    } catch {
      return null;
    }
  }

  /** Proves the password step passed, so the TOTP step can finish the sign-in. */
  signChallenge(userId: string, passwordHash: string | null): Promise<string> {
    return new SignJWT({ typ: 'mfa_challenge', pwd: passwordFingerprint(passwordHash) })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${MFA_CHALLENGE_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async verifyChallenge(jwt: string): Promise<{ userId: string; password: string } | null> {
    try {
      const { payload } = await jwtVerify(jwt, this.key, { issuer: ISSUER, algorithms: ['HS256'] });
      const claims = challengeClaims.parse(payload);
      return { userId: claims.sub, password: claims.pwd };
    } catch {
      return null;
    }
  }
}
