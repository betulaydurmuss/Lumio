import { z } from 'zod';

const envSchema = z.object({
  REDIS_URL: z.url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  /**
   * Refuse to talk to the relay without encryption. On by default: a relay that
   * does not offer STARTTLS (or an attacker who strips it) would otherwise get the
   * relay password and every reset link in plain text. Off only for a local catcher.
   */
  SMTP_REQUIRE_TLS: z.stringbool().default(true),
  MAIL_FROM: z.string().min(3),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type WorkerConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}
