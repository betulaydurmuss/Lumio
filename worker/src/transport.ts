import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import type { WorkerConfig } from './config.js';

/** How the worker reaches the mail relay. */
export function transportOptions(config: WorkerConfig): SMTPTransport.Options {
  return {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    // Port 465 speaks TLS from the first byte; others upgrade with STARTTLS when offered.
    secure: config.SMTP_PORT === 465,
    requireTLS: config.SMTP_PORT !== 465 && config.SMTP_REQUIRE_TLS,
    ...(config.SMTP_USER && config.SMTP_PASSWORD
      ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } }
      : {}),
  };
}
