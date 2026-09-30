import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Real credentials for a throwaway test database — never the production one.
// Populated in .env.test (gitignored); see .env.example for every var name.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    env: loadEnv('test', process.cwd(), ''),
  },
});
