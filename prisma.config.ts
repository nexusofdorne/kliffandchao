import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Plain `dotenv` only loads a file literally named `.env` — Next.js's
// `.env.local` convention is its own behavior, not dotenv's, so the CLI
// needs to be told about it explicitly. `.env.local` first (real values
// win), then `.env` to fill in anything it doesn't set.
config({ path: '.env.local' });
config();

// CLI-only config (migrate, studio, db seed). Deliberately DIRECT_URL, not
// DATABASE_URL: Supabase's transaction-mode pooler doesn't support the
// advisory locks Prisma Migrate takes, so the CLI needs the direct
// connection. The running app never reads this file — lib/prisma.ts builds
// its own @prisma/adapter-pg from DATABASE_URL (the pooled connection), so
// request-serving traffic goes through the pooler while migrations don't.
//
// This file loads for every Prisma CLI command, including `prisma generate`
// (run from postinstall on every `npm install`), which never connects to a
// database. Prisma's own env() helper throws if the var is missing, which
// would break a fresh clone before .env.local exists — read process.env
// directly instead, this is the one sanctioned exception to "env access
// goes through lib/env.ts" (see CLAUDE.md), since this file is CLI tooling
// config, not application code, and runs before lib/env.ts could apply.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? '',
  },
});
