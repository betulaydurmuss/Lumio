import { roleSchema, type Role } from '@lumio/shared';
import { jwtVerify, SignJWT } from 'jose';
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
  typ: z.literal('mfa_challenge'),
});

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
  signChallenge(userId: string): Promise<string> {
    return new SignJWT({ typ: 'mfa_challenge' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${MFA_CHALLENGE_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async verifyChallenge(jwt: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(jwt, this.key, { issuer: ISSUER, algorithms: ['HS256'] });
      return challengeClaims.parse(payload).sub;
    } catch {
      return null;
    }
  }
}
