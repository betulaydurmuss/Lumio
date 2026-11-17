// Creates .env from .env.example with fresh random secrets, so a clean clone
// never runs on values that are published in the repository.
// Usage: node scripts/create-env.mjs
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const target = new URL('../.env', import.meta.url);
const example = new URL('../.env.example', import.meta.url);

if (existsSync(target)) {
  console.error('.env already exists; it was left as it is.');
  process.exit(1);
}

const redisPassword = randomBytes(24).toString('hex');
const postgresPassword = randomBytes(24).toString('hex');
const fresh = {
  COOKIE_SECRET: randomBytes(48).toString('base64url'),
  ACCESS_TOKEN_SECRET: randomBytes(48).toString('base64url'),
  ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  REDIS_PASSWORD: redisPassword,
  POSTGRES_PASSWORD: postgresPassword,
};

const lines = readFileSync(example, 'utf8')
  .split('\n')
  .map((line) => {
    const key = line.split('=', 1)[0];
    if (key in fresh) return `${key}=${fresh[key]}`;
    if (key === 'REDIS_URL') return line.replace(/:\/\/:[^@]*@/, `://:${redisPassword}@`);
    if (key === 'DATABASE_URL')
      return line.replace(/:\/\/([^:]+):[^@]*@/, `://$1:${postgresPassword}@`);
    return line;
  });

writeFileSync(target, lines.join('\n'), { mode: 0o600 });
console.log('.env created with new random secrets.');
