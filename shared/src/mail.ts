import { z } from 'zod';

export const MAIL_QUEUE = 'mail';

export const mailJobSchema = z.object({
  to: z.email(),
  subject: z.string().min(1).max(200),
  text: z.string().min(1),
  html: z.string().optional(),
});

export type MailJob = z.infer<typeof mailJobSchema>;
