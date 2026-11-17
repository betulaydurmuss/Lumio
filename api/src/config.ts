import { z } from 'zod';

// Values that appear in this repository's examples. A server started with one of
// them would sign tokens with a key anyone can read on GitHub.
const PLACEHOLDER = /change-me/i;

const secret = (name: string) =>
  z
    .string()
    .min(32, `${name} must be at least 32 characters`)
    .refine((value) => !PLACEHOLDER.test(value), {
      message: `${name} is still the example value; generate a real secret`,
    });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4001),
  WEB_ORIGIN: z.url(),
  COOKIE_SECRET: secret('COOKIE_SECRET'),
  ACCESS_TOKEN_SECRET: secret('ACCESS_TOKEN_SECRET'),
  /** 32 bytes, base64. Encrypts secrets stored in the database, such as TOTP seeds. */
  ENCRYPTION_KEY: z
    .string()
    .refine((value) => Buffer.from(value, 'base64').length === 32, {
      message: 'ENCRYPTION_KEY must be 32 bytes encoded as base64',
    })
    .refine((value) => Buffer.from(value, 'base64').some((byte) => byte !== 0), {
      message: 'ENCRYPTION_KEY is the all-zero example key; generate a real one',
    }),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  /**
   * How many proxies stand in front of the API. The client's address is read
   * that many hops back in X-Forwarded-For; too few and every visitor shares the
   * proxy's address (and one rate limit), too many and a client can forge it.
   * 1 behind the bundled nginx; 2 with a TLS proxy such as Caddy in front of it.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  /** Where lesson media is read from. Defaults to api/media. */
  MEDIA_DIR: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Config = z.infer<typeof envSchema>;

/**
 * Reads the environment once at boot. A missing or malformed variable stops
 * the process with a readable list instead of failing later at runtime.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}
