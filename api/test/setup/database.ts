import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://lumio:lumio@localhost:5433/lumio_test';

/** Creates the test database if it is missing and brings it to the latest migration. */
export default async function setup() {
  const url = new URL(testDatabaseUrl);
  const name = url.pathname.slice(1);
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';

  const client = new pg.Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (found.rowCount === 0) await client.query(`CREATE DATABASE "${name.replaceAll('"', '')}"`);
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  });
}
