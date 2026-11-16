import { createHmac, timingSafeEqual } from 'node:crypto';
import { isValidMediaKey } from './store.js';

export const MEDIA_LINK_TTL_SECONDS = 4 * 60 * 60;

/**
 * Signs short-lived links to lesson media. A link names one file and an expiry
 * time, and is useless after it expires or if a single character is changed.
 */
export class MediaSigner {
  private readonly key: Buffer;

  constructor(secret: string) {
    // A key of its own, derived from the server secret, so media links can
    // never be confused with any other signed value.
    this.key = createHmac('sha256', secret).update('lumio-media-links').digest();
  }

  private mac(payload: string): string {
    return createHmac('sha256', this.key).update(payload).digest('base64url');
  }

  sign(mediaKey: string, ttlSeconds = MEDIA_LINK_TTL_SECONDS, now = Date.now()): string {
    const expires = Math.floor(now / 1000) + ttlSeconds;
    const payload = Buffer.from(JSON.stringify({ k: mediaKey, e: expires })).toString('base64url');
    return `${payload}.${this.mac(payload)}`;
  }

  /** The media key if the token is genuine and unexpired; otherwise why not. */
  verify(token: string, now = Date.now()): { key: string } | { error: 'invalid' | 'expired' } {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return { error: 'invalid' };

    const expected = Buffer.from(this.mac(payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return { error: 'invalid' };
    }

    try {
      const { k, e } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
        k: unknown;
        e: unknown;
      };
      if (typeof k !== 'string' || typeof e !== 'number' || !isValidMediaKey(k)) {
        return { error: 'invalid' };
      }
      if (e < Math.floor(now / 1000)) return { error: 'expired' };
      return { key: k };
    } catch {
      return { error: 'invalid' };
    }
  }
}
