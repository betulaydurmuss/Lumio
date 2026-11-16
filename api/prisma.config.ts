import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generating the client needs no database, so the URL is only required by
  // the commands that connect (migrate, studio).
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
