# Deploying Lumio

Lumio runs on any Linux server with Docker. The production overlay
([docker-compose.prod.yml](../docker-compose.prod.yml)) adds Caddy in front for HTTPS, sends mail
through a real SMTP relay and publishes only ports 80 and 443. Nothing else about the stack
changes, so what CI starts on every push is what runs in production.

```
browser ──HTTPS──▶ Caddy ──▶ nginx (web) ──▶ API ──▶ PostgreSQL, Redis
                                            worker ──▶ SMTP relay
```

## What you need

- A server with 2 GB of memory and Docker Engine with the Compose plugin (v2.24 or newer).
- A domain name whose A (and AAAA) record points at the server. Caddy needs it to obtain the
  certificate, and ports 80 and 443 must be open to the internet.
- An SMTP relay for outgoing mail (your mail provider, or a transactional mail service), with SPF
  and DKIM set up for the sending domain so verification mails are not marked as spam.

## First start

```sh
git clone https://github.com/betulaydurmuss/Lumio.git lumio && cd lumio
npm run env:init          # or: node scripts/create-env.mjs — writes .env with random secrets
```

Then add the production values to `.env`:

```sh
DOMAIN=lumio.example.com
RELAY_SMTP_HOST=smtp.example.com
RELAY_SMTP_PORT=587          # 465 for implicit TLS
RELAY_SMTP_USER=...
RELAY_SMTP_PASSWORD=...
MAIL_FROM="Lumio <no-reply@lumio.example.com>"
```

and start everything:

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
curl https://lumio.example.com/api/health
```

The first request can take a few seconds while Caddy fetches the certificate. Migrations and the
demo catalog run on every start; both are safe to repeat, and the seed leaves anything an operator
changed alone.

Give someone the platform admin role (they sign up first, then):

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm migrate \
  npx tsx scripts/make-platform-admin.ts someone@example.com
```

## Keep `.env` safe

It holds every secret. Keep a copy in a password manager or secret store; `ENCRYPTION_KEY` in
particular cannot be recreated (see [backup.md](backup.md)). Never commit it.

## Updating

```sh
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Take a backup first (`npm run backup`), as every deploy may carry a migration.

## Backups

Run `npm run backup` daily from cron and copy the dump off the server, encrypted. The full routine,
restore steps and what else to keep are in [backup.md](backup.md).

## What is behind which proxy

The API reads the client's address from `X-Forwarded-For`, trusting exactly as many proxies as
stand in front of it (`TRUST_PROXY_HOPS`): 1 behind nginx alone, 2 with Caddy in front. The
production overlay sets 2. If you put another proxy or a CDN in front, raise it by one; otherwise
every visitor appears to come from the proxy and shares one rate limit.

## Checklist

- [ ] `https://<domain>/api/health` answers `{"status":"ok"}`.
- [ ] Signing up sends a verification mail that arrives in an inbox, not in spam.
- [ ] `http://<domain>` redirects to HTTPS and the response carries `Strict-Transport-Security`.
- [ ] `docker compose ps` shows no published ports other than Caddy's 80 and 443.
- [ ] A backup was taken and `npm run backup:verify` passed on it.
