import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';
import type { PrismaClient } from '../db.js';
import { decrypt, encrypt } from '../security/crypto.js';

export const SIGNATURE_ALGORITHM = 'Ed25519';

/**
 * The keys that sign certificates. The first signature creates a key; its
 * private half is stored encrypted with ENCRYPTION_KEY and never leaves the API.
 * Retired keys stop signing but keep verifying what they signed.
 */
export class CertificateKeyRing {
  private active: { id: string; privateKey: KeyObject } | undefined;
  private readonly publicKeys = new Map<string, KeyObject>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly encryptionKey: Buffer,
  ) {}

  private async activeKey() {
    if (this.active) return this.active;

    let row = await this.prisma.signingKey.findFirst({
      where: { retiredAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) {
      const { publicKey, privateKey } = generateKeyPairSync('ed25519');
      const id = `lumio-${new Date().getUTCFullYear()}-${randomBytes(3).toString('hex')}`;
      row = await this.prisma.signingKey.create({
        data: {
          id,
          algorithm: SIGNATURE_ALGORITHM,
          publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
          privateKey: encrypt(
            privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
            this.encryptionKey,
          ),
        },
      });
    }
    this.active = {
      id: row.id,
      privateKey: createPrivateKey(decrypt(row.privateKey, this.encryptionKey)),
    };
    return this.active;
  }

  async sign(payload: string): Promise<{ signature: string; keyId: string }> {
    const key = await this.activeKey();
    const signature = sign(null, Buffer.from(payload, 'utf8'), key.privateKey);
    return { signature: signature.toString('base64url'), keyId: key.id };
  }

  async verify(payload: string, signature: string, keyId: string): Promise<boolean> {
    let publicKey = this.publicKeys.get(keyId);
    if (!publicKey) {
      const row = await this.prisma.signingKey.findUnique({ where: { id: keyId } });
      if (!row) return false;
      publicKey = createPublicKey(row.publicKey);
      this.publicKeys.set(keyId, publicKey);
    }
    try {
      return verify(
        null,
        Buffer.from(payload, 'utf8'),
        publicKey,
        Buffer.from(signature, 'base64url'),
      );
    } catch {
      return false;
    }
  }
}

export interface SignedFields {
  certNo: string;
  recipientName: string;
  orgName: string | null;
  courseTitleTr: string;
  courseTitleEn: string;
  instructorName: string;
  hours: number;
  startedAt: Date;
  completedAt: Date;
  issuedAt: Date;
}

/**
 * The exact text that is signed. Fields are written in a fixed order, so the
 * same certificate always produces the same bytes, and any edit breaks it.
 */
export function canonicalPayload(fields: SignedFields): string {
  return JSON.stringify([
    'lumio-certificate-v1',
    fields.certNo,
    fields.recipientName,
    fields.orgName ?? '',
    fields.courseTitleTr,
    fields.courseTitleEn,
    fields.instructorName,
    fields.hours,
    fields.startedAt.toISOString(),
    fields.completedAt.toISOString(),
    fields.issuedAt.toISOString(),
  ]);
}
