import { hash, verify } from '@node-rs/argon2';

// Argon2id with the OWASP baseline: 19 MiB memory, 2 iterations, 1 lane.
const options = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

// Verified against when the email is unknown, so that a missing account takes
// as long to reject as a wrong password.
const dummyHash = hash('lumio-timing-equaliser', options);

export async function verifyPassword(
  storedHash: string | null | undefined,
  password: string,
): Promise<boolean> {
  if (!storedHash) {
    await verify(await dummyHash, password).catch(() => false);
    return false;
  }
  return verify(storedHash, password).catch(() => false);
}
