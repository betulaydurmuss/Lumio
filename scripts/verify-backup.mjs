// Proves a backup can be restored: loads it into a scratch database next to the
// live one, compares the row count of every table, then drops the scratch copy.
// Usage: npm run backup:verify -- backups/lumio-<timestamp>.dump
import { createReadStream, existsSync } from 'node:fs';
import { composeEnv, psql, run } from './lib/compose.mjs';

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error('Give the path of a .dump file made by npm run backup.');
  process.exit(1);
}

const env = composeEnv();
const scratch = `${env.db}_restore_check`;
const tablesSql = `select tablename from pg_tables where schemaname = 'public' order by tablename`;

async function counts(database) {
  const tables = (await psql(env, database, tablesSql)).trim().split('\n').filter(Boolean);
  const result = {};
  for (const table of tables) {
    result[table] = Number((await psql(env, database, `select count(*) from "${table}"`)).trim());
  }
  return result;
}

await psql(env, 'postgres', `drop database if exists "${scratch}"`);
await psql(env, 'postgres', `create database "${scratch}"`);
try {
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
      scratch,
      '--no-owner',
      '--exit-on-error',
    ],
    createReadStream(file),
  );
  const [live, restored] = await Promise.all([counts(env.db), counts(scratch)]);
  const tables = Object.keys(live);
  const differing = tables.filter((table) => live[table] !== restored[table]);
  for (const table of tables) {
    console.log(
      `${table.padEnd(28)} live ${String(live[table]).padStart(6)}  restored ${String(restored[table] ?? 'missing').padStart(7)}`,
    );
  }
  if (differing.length > 0 || tables.length === 0) {
    // A count can differ if someone used the app between backup and check; say so plainly.
    console.error(`Restore check failed for: ${differing.join(', ') || 'no tables found'}`);
    process.exitCode = 1;
  } else {
    console.log(`Restore check passed: ${tables.length} tables, every row count matches.`);
  }
} finally {
  await psql(env, 'postgres', `drop database if exists "${scratch}"`);
}
