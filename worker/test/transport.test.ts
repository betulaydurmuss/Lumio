import { createServer, type Server } from 'node:net';
import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { transportOptions } from '../src/transport.js';

/**
 * A relay that never offers STARTTLS, as one under an on-path attacker would
 * look. It records every line it receives and accepts whatever it is sent.
 */
function plaintextRelay() {
  const received: string[] = [];
  const server: Server = createServer((socket) => {
    socket.write('220 relay.test ESMTP\r\n');
    let buffer = '';
    let inData = false;
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      let end: number;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        received.push(line);
        if (inData) {
          if (line === '.') {
            inData = false;
            socket.write('250 queued\r\n');
          }
          continue;
        }
        const verb = line.slice(0, 4).toUpperCase();
        if (verb === 'EHLO') socket.write('250-relay.test\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (verb === 'STAR') socket.write('502 STARTTLS not supported\r\n');
        else if (verb === 'AUTH') socket.write('235 ok\r\n');
        else if (verb === 'DATA') {
          inData = true;
          socket.write('354 go on\r\n');
        } else if (verb === 'QUIT') socket.end('221 bye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  return new Promise<{ port: number; received: string[]; close: () => void }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ port, received, close: () => server.close() });
    });
  });
}

let close: (() => void) | undefined;
afterEach(() => close?.());

const base = {
  REDIS_URL: 'redis://localhost:6380',
  SMTP_HOST: '127.0.0.1',
  SMTP_USER: 'relay-user',
  SMTP_PASSWORD: 'relay-secret',
  MAIL_FROM: 'Lumio <no-reply@example.test>',
};

async function send(env: Record<string, string>) {
  const relay = await plaintextRelay();
  close = relay.close;
  const transport = nodemailer.createTransport(
    transportOptions(loadConfig({ ...base, ...env, SMTP_PORT: String(relay.port) })),
  );
  const result = await transport
    .sendMail({
      from: base.MAIL_FROM,
      to: 'owner@example.test',
      subject: 'Reset',
      text: 'https://lumio.example.test/reset-password?token=SECRET-RESET-TOKEN',
    })
    .then(
      () => 'sent' as const,
      () => 'refused' as const,
    );
  return { result, wire: relay.received.join('\n') };
}

describe('the mail relay connection', () => {
  it('never sends credentials or links over a connection that was not encrypted', async () => {
    const { result, wire } = await send({});
    expect(result).toBe('refused');
    expect(wire).not.toMatch(/^AUTH/m);
    expect(wire).not.toContain('SECRET-RESET-TOKEN');
  });

  it('allows plain text only when told to, for a local mail catcher', async () => {
    const { result, wire } = await send({ SMTP_REQUIRE_TLS: 'false' });
    expect(result).toBe('sent');
    expect(wire).toContain('SECRET-RESET-TOKEN');
  });
});
