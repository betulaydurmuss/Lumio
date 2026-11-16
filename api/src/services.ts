import type { MailJob } from '@lumio/shared';
import type { PrismaClient } from './db.js';
import type { TokenService } from './security/tokens.js';

export interface Mailer {
  send(job: MailJob): Promise<void>;
}

/** Remembers a key for a while; `claim` is false if the key was already seen. */
export interface ReplayGuard {
  claim(key: string, ttlSeconds: number): Promise<boolean>;
}

export interface Services {
  prisma: PrismaClient;
  tokens: TokenService;
  mailer: Mailer;
  replay: ReplayGuard;
  encryptionKey: Buffer;
  webOrigin: string;
  secureCookies: boolean;
}
