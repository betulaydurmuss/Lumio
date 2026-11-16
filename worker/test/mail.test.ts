import nodemailer from 'nodemailer';
import { describe, expect, it } from 'vitest';
import { sendMail } from '../src/mail.js';

const transport = nodemailer.createTransport({ jsonTransport: true });

describe('sendMail', () => {
  it('sends a valid job through the transport', async () => {
    const result = await sendMail(transport, 'Lumio <no-reply@lumio.local>', {
      to: 'learner@example.com',
      subject: 'Welcome',
      text: 'Hello',
    });

    expect(result.messageId).toBeTruthy();
  });

  it('rejects a job without a valid recipient', async () => {
    await expect(
      sendMail(transport, 'Lumio <no-reply@lumio.local>', {
        to: 'not-an-email',
        subject: 'Welcome',
        text: 'Hello',
      }),
    ).rejects.toThrow();
  });
});
