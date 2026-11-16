import { z } from 'zod';
import type { Transporter } from 'nodemailer';

export const MAIL_QUEUE = 'mail';

export const mailJobSchema = z.object({
  to: z.email(),
  subject: z.string().min(1).max(200),
  text: z.string().min(1),
  html: z.string().optional(),
});

export type MailJob = z.infer<typeof mailJobSchema>;

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
