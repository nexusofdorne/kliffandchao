import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Dummy but schema-valid values so `npm run test` runs on a fresh clone with
// no .env.local — lib/env.ts is exercised by its own unit tests, not by a
// real database or Supabase project. Integration tests that need the real
// thing live in tests/db/ and run under vitest.config.db.ts instead.
const dummyEnv = {
  SITE_PASSWORD_HASH: 'scrypt$16384$8$1$test-salt$test-hash',
  SESSION_SECRET: 'test-session-secret-at-least-32-bytes',
  SESSION_EPOCH: '1',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
  DIRECT_URL: 'postgresql://user:pass@localhost:5432/test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  ADMIN_EMAILS: 'test@example.com',
  GOOGLE_SA_KEY_B64: 'test-base64-key',
  GOOGLE_SHEET_ID: 'test-sheet-id',
  SYNC_WEBHOOK_SECRET: 'test-webhook-secret',
  RSVP_DEADLINE: '2027-02-01T00:00:00.000Z',
  IP_HASH_SALT: 'test-salt',
  RESEND_API_KEY: 'test-resend-key',
  COUPLE_NOTIFY_EMAIL: 'test@example.com',
};

export default defineConfig({
  resolve: {
    alias: {
      // Next's bundler swaps this for an empty module server-side and a
      // throwing one client-side; Vitest has no such swap, so alias it here.
      'server-only': fileURLToPath(
        new URL('./vitest.setup/server-only-shim.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'prototype/**', 'tests/db/**'],
    env: dummyEnv,
  },
});
