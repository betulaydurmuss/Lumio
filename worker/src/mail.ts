import { mailJobSchema } from '@lumio/shared';
import type { Transporter } from 'nodemailer';

/**
 * Validates the job payload before it reaches SMTP, so a malformed job fails
 * loudly in the queue instead of sending something half-formed.
 */
export async function sendMail(transport: Transporter, from: string, data: unknown) {
  const job = mailJobSchema.parse(data);
  const info = await transport.sendMail({
    from,
    to: job.to,
    subject: job.subject,
    text: job.text,
    ...(job.html ? { html: job.html } : {}),
  });
  return { messageId: info.messageId as string };
}
