// Restores a backup over the live Lumio database. Destructive by design, so it
// refuses to run without --yes, and the API and worker should be stopped first.
// Usage: npm run restore -- backups/lumio-<timestamp>.dump --yes
import { createReadStream, existsSync } from 'node:fs';
import { composeEnv, psql, run } from './lib/compose.mjs';

const file = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
if (!file || !existsSync(file)) {
  console.error('Give the path of a .dump file made by npm run backup.');
  process.exit(1);
}
if (!process.argv.includes('--yes')) {
  console.error(
    'This replaces every table in the live database with the backup.\n' +
      'Stop the app first (docker compose stop api worker), then run again with --yes.',
  );
  process.exit(1);
}

const env = composeEnv();
await run(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'postgres',
    'pg_restore',
    '-U',
    env.user,
    '-d',
    env.db,
    '--clean',
    '--if-exists',
    '--no-owner',
    '--exit-on-error',
  ],
  createReadStream(file),
);
// Sessions in the dump may belong to devices revoked since; everyone signs in again.
await psql(env, env.db, 'update sessions set revoked_at = now() where revoked_at is null');
console.log('Restored, and every session was ended.');
console.log('Start the app again with: docker compose up -d api worker');
