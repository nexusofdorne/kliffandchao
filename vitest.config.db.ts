import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import { loadTestDatabaseEnv } from './scripts/test-database-env';

// Share the same fail-closed target checks as the migration/seed command.
const testEnv = loadTestDatabaseEnv();

export default defineConfig({
  resolve: {
    alias: {
      // Same reasoning as vitest.config.ts: Next's bundler swaps this for
      // an empty module server-side; Vitest has no such swap.
      '@': fileURLToPath(new URL('./', import.meta.url)),
      'server-only': fileURLToPath(
        new URL('./vitest.setup/server-only-shim.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    // The seating test files share the singleton seating tables, so files run one at a time.
    fileParallelism: false,
    include: ['tests/db/**/*.test.ts'],
    env: {
      ...testEnv,
      DATABASE_URL: testEnv.TEST_DATABASE_URL,
      DIRECT_URL: testEnv.TEST_DATABASE_URL,
    },
  },
});
