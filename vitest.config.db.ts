import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Real credentials for a throwaway test database — never the production one.
// Populated in .env.test (gitignored); see .env.example for every var name.
// (At this stage of the project, before anything is in production, that's
// the same Supabase project Phase 1 set up and seeded.)
export default defineConfig({
  resolve: {
    alias: {
      // Same reasoning as vitest.config.ts: Next's bundler swaps this for
      // an empty module server-side; Vitest has no such swap.
      'server-only': fileURLToPath(new URL('./vitest.setup/server-only-shim.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    env: loadEnv('test', process.cwd(), ''),
  },
});
