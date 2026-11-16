import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

const ISSUER = 'Lumio';

export function newTotpSecret(): string {
  return generateSecret();
}

export async function totpEnrollment(secret: string, accountLabel: string) {
  const otpauthUrl = generateURI({ issuer: ISSUER, label: accountLabel, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
  return { otpauthUrl, qrDataUrl };
}

/** Accepts the current 30-second step and one step either side for clock drift. */
export async function verifyTotp(secret: string, code: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code, epochTolerance: 30 });
    return result.valid;
  } catch {
    return false;
  }
}
