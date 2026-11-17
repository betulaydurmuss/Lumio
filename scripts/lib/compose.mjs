// Shared by the backup scripts: the database names Compose uses, read from .env
// with the same defaults as docker-compose.yml.
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

export function composeEnv() {
  const file = new URL('../../.env', import.meta.url);
  const values = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^([A-Z_]+)=(.*)$/.exec(line);
      if (match) values[match[1]] = match[2];
    }
  }
  return {
    user: process.env.POSTGRES_USER ?? values.POSTGRES_USER ?? 'lumio',
    db: process.env.POSTGRES_DB ?? values.POSTGRES_DB ?? 'lumio',
  };
}

/** Runs a command and resolves with its output; rejects with stderr on failure. */
export function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    if (input) input.pipe(child.stdin);
    child.on('close', (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`${command} exited ${code}: ${stderr}`)),
    );
  });
}

/** Runs SQL inside the Compose database container and returns the rows as text. */
export function psql(env, database, sql) {
  return run('docker', [
    'compose',
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    env.user,
    '-d',
    database,
    '-v',
    'ON_ERROR_STOP=1',
    '-tAc',
    sql,
  ]);
}
