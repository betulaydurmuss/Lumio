// Takes a full backup of the Lumio database from the Compose stack.
// Usage: npm run backup            -> backups/lumio-<timestamp>.dump
//
// The dump holds personal data. Keep it encrypted and access-controlled, and
// keep ENCRYPTION_KEY (stored separately, never next to the dump): without it
// the two-factor seeds and the certificate signing key in the dump are unreadable.
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, statSync } from 'node:fs';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { composeEnv } from './lib/compose.mjs';

const env = composeEnv();
mkdirSync(new URL('../backups/', import.meta.url), { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const file = new URL(`../backups/lumio-${stamp}.dump`, import.meta.url);

// Custom format: compressed, and restorable table by table if ever needed.
const dump = spawn(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'postgres',
    'pg_dump',
    '-U',
    env.user,
    '-d',
    env.db,
    '-Fc',
    '--no-owner',
  ],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);
const out = createWriteStream(file, { mode: 0o600 });
dump.stdout.pipe(out);
const code = await new Promise((resolve) => dump.on('close', resolve));
await finished(out);
if (code !== 0) {
  console.error(`pg_dump failed with code ${code}`);
  process.exit(1);
}
console.log(`Backup written: ${fileURLToPath(file)} (${statSync(file).size} bytes)`);
