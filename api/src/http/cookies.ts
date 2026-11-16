import type { CookieOptions, Response } from 'express';
import { ACCESS_TOKEN_TTL_SECONDS, MFA_CHALLENGE_TTL_SECONDS } from '../security/tokens.js';

export const ACCESS_COOKIE = 'lumio_at';
export const REFRESH_COOKIE = 'lumio_rt';
export const CHALLENGE_COOKIE = 'lumio_mfa';
export const CSRF_COOKIE = 'lumio_csrf';

export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

function base(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'strict' };
}

export function setSessionCookies(
  res: Response,
  secure: boolean,
  tokens: { access: string; refresh: string },
) {
  res.cookie(ACCESS_COOKIE, tokens.access, {
    ...base(secure),
    path: '/api',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  // The refresh token only travels to the endpoints that rotate or revoke it.
  res.cookie(REFRESH_COOKIE, tokens.refresh, {
    ...base(secure),
    path: '/api/auth',
    maxAge: REFRESH_TTL_SECONDS * 1000,
    signed: true,
  });
}

export function setAccessCookie(res: Response, secure: boolean, access: string) {
  res.cookie(ACCESS_COOKIE, access, {
    ...base(secure),
    path: '/api',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookies(res: Response, secure: boolean) {
  res.clearCookie(ACCESS_COOKIE, { ...base(secure), path: '/api' });
  res.clearCookie(REFRESH_COOKIE, { ...base(secure), path: '/api/auth', signed: true });
}

export function setChallengeCookie(res: Response, secure: boolean, challenge: string) {
  res.cookie(CHALLENGE_COOKIE, challenge, {
    ...base(secure),
    path: '/api/auth',
    maxAge: MFA_CHALLENGE_TTL_SECONDS * 1000,
    signed: true,
  });
}

export function clearChallengeCookie(res: Response, secure: boolean) {
  res.clearCookie(CHALLENGE_COOKIE, { ...base(secure), path: '/api/auth', signed: true });
}

/** Readable by the page on purpose: the client echoes it back in a header. */
export function setCsrfCookie(res: Response, secure: boolean, token: string) {
  res.cookie(CSRF_COOKIE, token, { httpOnly: false, secure, sameSite: 'strict', path: '/' });
}
