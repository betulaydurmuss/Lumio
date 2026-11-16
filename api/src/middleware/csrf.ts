import { CSRF_HEADER } from '@lumio/shared';
import type { RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { CSRF_COOKIE } from '../http/cookies.js';
import { HttpError } from './errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Double-submit check on every state-changing request. A cross-site form can
 * send the cookie, but cannot read it to copy it into the header. SameSite=strict
 * on the session cookies is the first line; this is the second.
 */
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const header = req.get(CSRF_HEADER);
  if (!cookie || !header || !same(cookie, header)) {
    return next(new HttpError(403, 'csrf_failed', 'Missing or invalid CSRF token'));
  }
  next();
};
