# Backup and recovery

What has to survive a lost server, how it is saved, and how it comes back.

## What holds state

| Where                     | What                                                                     | Backed up by                         |
| ------------------------- | ------------------------------------------------------------------------ | ------------------------------------ |
| PostgreSQL                | Everything that matters: accounts, learning records, certificates, audit | `npm run backup`                     |
| `.env`                    | Secrets, including `ENCRYPTION_KEY`                                      | Your secret store, never with a dump |
| Redis                     | Rate-limit counters, the code-replay guard and the mail queue            | Not needed: all of it is short-lived |
| `api/media`, `api/assets` | Lesson media and certificate fonts                                       | The repository and the built image   |

`ENCRYPTION_KEY` deserves its own line: the two-factor seeds and the private certificate signing
key are stored encrypted with it. Certificates already issued stay verifiable without it, because
their public keys are stored in the clear. But a database restored without the same key cannot
check anyone's two-factor codes and cannot sign new certificates until the old signing key is
retired (`retired_at` set) so that a fresh one is made. Keep the key in a password manager or
secret store, separately from the dumps.

## Taking a backup

```sh
npm run backup
# Backup written: .../backups/lumio-2026-11-17-13-14-58.dump
```

The dump is in PostgreSQL's custom format: compressed, and restorable table by table if needed.
It contains personal data, so the `backups/` folder is never committed, files are created
readable by their owner only, and copies kept off the machine should be encrypted.

Suggested routine for a production install: a daily dump kept for 30 days and a weekly one for
six months, which bounds data loss to one day (RPO 24 h).

## Proving it restores

```sh
npm run backup:verify -- backups/lumio-2026-11-17-13-14-58.dump
```

This loads the dump into a scratch database next to the live one, compares the row count of every
table, and drops the scratch copy again. CI does the same on every push: it starts the stack,
takes a backup and refuses to pass unless the backup restores with identical counts.

## Restoring

Restoring replaces the live data, so the script needs `--yes`, and the app should be stopped so
nothing writes in between:

```sh
docker compose stop api worker
npm run restore -- backups/lumio-2026-11-17-13-14-58.dump --yes
docker compose up -d api worker
```

On a new machine: clone the repository, put the saved `.env` in place (with the original
`ENCRYPTION_KEY`), start `docker compose up -d postgres`, run the restore, then start the rest.
With the dump at hand that is well under an hour (RTO 1 h).

After a restore:

- Sessions in the dump are as old as the dump; members may need to sign in again.
- Run `npm run backup:verify` on the next backup to confirm the restored database dumps cleanly.
