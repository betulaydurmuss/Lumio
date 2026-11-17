import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, hashToken, randomToken } from '../src/security/crypto.js';
import { isDisposableEmail } from '../src/security/disposable.js';
import { hashPassword, verifyPassword } from '../src/security/passwords.js';
import { TokenService } from '../src/security/tokens.js';

describe('passwords', () => {
  it('stores argon2id hashes that verify only the original password', async () => {
    const stored = await hashPassword('a long enough passphrase');

    expect(stored.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(stored, 'a long enough passphrase')).toBe(true);
    expect(await verifyPassword(stored, 'a long enough passphrasE')).toBe(false);
  });

  it('rejects when there is no stored hash', async () => {
    expect(await verifyPassword(null, 'anything')).toBe(false);
  });
});

describe('encryption at rest', () => {
  const key = Buffer.alloc(32, 1);

  it('round-trips and never stores the plaintext', () => {
    const sealed = encrypt('JBSWY3DPEHPK3PXP', key);

    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decrypt(sealed, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('refuses a tampered ciphertext', () => {
    const [iv, tag, body] = encrypt('secret', key).split('.');
    const flipped = Buffer.from(body!, 'base64url');
    flipped[0] = flipped[0]! ^ 1;

    expect(() => decrypt([iv, tag, flipped.toString('base64url')].join('.'), key)).toThrow();
  });

  it('refuses the wrong key', () => {
    expect(() => decrypt(encrypt('secret', key), Buffer.alloc(32, 2))).toThrow();
  });
});

describe('tokens', () => {
  it('hashes deterministically and generates unique random tokens', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(randomToken()).not.toBe(randomToken());
  });

  it('rejects an access token signed with another secret', async () => {
    const ours = new TokenService('o'.repeat(40));
    const theirs = new TokenService('x'.repeat(40));
    const jwt = await theirs.signAccess({
      userId: 'u',
      orgId: 'o',
      sessionId: 's',
      role: 'platform_admin',
    });

    expect(await ours.verifyAccess(jwt)).toBeNull();
  });

  it('does not accept an MFA challenge as an access token', async () => {
    const service = new TokenService('o'.repeat(40));
    const challenge = await service.signChallenge('user-id', 'hash');

    expect(await service.verifyAccess(challenge)).toBeNull();
  });
});

describe('disposable email', () => {
  it('flags throwaway domains and allows ordinary ones', () => {
    expect(isDisposableEmail('someone@mailinator.com')).toBe(true);
    expect(isDisposableEmail('someone@MAILINATOR.com')).toBe(true);
    expect(isDisposableEmail('someone@acme.com.tr')).toBe(false);
  });
});
