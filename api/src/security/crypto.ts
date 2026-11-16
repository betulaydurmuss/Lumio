import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** A URL-safe random token with 256 bits of entropy. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Tokens are stored as SHA-256 digests. They are already high-entropy, so a
 * fast hash is enough; a leaked table cannot be replayed.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** AES-256-GCM. Output is `iv.tag.ciphertext`, each base64url. */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decrypt(payload: string, key: Buffer): string {
  const [iv, tag, ciphertext] = payload.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !ciphertext) throw new Error('Malformed ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
