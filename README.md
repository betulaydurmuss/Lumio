# Lumio

**Online learning platform for web, cybersecurity and compliance training.**

Companies assign courses to their employees and prove who completed what. Individuals learn through
animated lessons and quizzes, and leave with a certificate that anyone can verify without asking
Lumio. The interface and the training content are in Turkish and English.

## The idea

Compliance training is usually the part of a security programme that nobody believes in. An
employee clicks through a video, a spreadsheet records a tick, and when an auditor asks for evidence
the evidence is the spreadsheet. KVKK makes this worse, not better: a company has to show that the
people who handle personal data were trained, and the training platform itself becomes one more
place that holds personal data.

Lumio treats both halves seriously. Every organization's data is kept apart from every other
organization's at the row level, every sensitive action leaves an audit record, and every
certificate is signed so that it can be checked against the platform's public key rather than
taken on trust.

## What the platform guarantees

These are the properties the code is built to enforce. The table says honestly which ones are in
place today and which are still being built.

| Guarantee                                                                       | Status                                             |
| ------------------------------------------------------------------------------- | -------------------------------------------------- |
| Configuration is validated at boot; a missing or weak secret stops the process  | In place                                           |
| Every API response carries strict security headers and a request id             | In place                                           |
| The API answers only the web origin, and is rate limited                        | In place                                           |
| Every tenant-owned row carries `org_id`; one organization cannot read another's | Schema in place, enforcement in the sign-in sprint |
| Passwords are hashed with argon2; admins cannot sign in without 2FA             | Sign-in sprint                                     |
| Every critical action is written to an append-only audit log                    | Schema in place                                    |
| Certificates are signed and verifiable at `/dogrula/:certificateNo`             | Certificate sprint                                 |

## What is stored, and what is never stored

| Stored                                                   | Never stored                                          |
| -------------------------------------------------------- | ----------------------------------------------------- |
| Name, work email, organization, role, preferred language | Plain-text passwords (only an argon2 hash)            |
| Course progress, quiz attempts, issued certificates      | Card numbers (payments are tokenized by the provider) |
| Audit records: who did what, when, from which address    | Refresh tokens (only their hash)                      |

Fonts are served from the platform itself, so a visitor's browser does not contact a third-party
font service.

## The dashboard, the player and the certificate

The catalog, lesson player, quizzes and certificate are the next sprints of the MVP. Screenshots
will be added here as each one lands.

## Repository layout

```
api/        Express + zod REST API, Prisma schema and migrations
worker/     BullMQ jobs: mail today; video processing and reports later
web/        React + Vite client, design tokens, Turkish and English translations
shared/     zod schemas and types used by both the API and the client
brand/      Logo kit and the living design system (open brand/design-system/index.html)
```

## Requirements

| Tool           | Version                  |
| -------------- | ------------------------ |
| Node.js        | 22 or newer              |
| npm            | 10 or newer              |
| Docker Compose | v2                       |
| PostgreSQL     | 16 (provided by Compose) |
| Redis          | 7 (provided by Compose)  |

Lumio's local ports are offset from the usual defaults (PostgreSQL on 5433, Redis on 6380, Mailpit
on 1026/8026) so that it can run next to another project's database. Change them in `.env`.

## Running it locally

The whole stack, built from a clean clone:

```sh
docker compose up --build
```

Then open http://localhost:8080. The API health check is at
http://localhost:8080/api/health, and mail sent in development lands in Mailpit at
http://localhost:8026.

For development with hot reload, start only the services and run the apps on the host:

```sh
cp .env.example .env
docker compose up -d postgres redis mailpit
npm install
npm run db:migrate
npm run dev
```

The client runs on http://localhost:5174 and proxies `/api` to the API on port 4001.

Checks, the same ones CI runs:

```sh
npm run typecheck
npm test
npm run build
```

## Deployment

Not deployed yet. The live URL and a `curl /api/health` example will be recorded here once it is.

## Roadmap

| Stage   | Scope                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| MVP     | Setup and brand, secure sign-in and organizations, catalog, course page, lesson player, quizzes, verifiable certificates, admin panel |
| Phase 2 | Learning paths, assignments and compliance reports, payments, instructor tools, notifications, course Q&A                             |
| Phase 3 | Live classes, study assistant, advanced assessment, SSO / LTI / SCORM, white-label, gamification                                      |

## License

MIT, see [LICENSE](LICENSE).
