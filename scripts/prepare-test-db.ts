import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { loadTestDatabaseEnv, getTestMigrationUrl } from './test-database-env';

function run(args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, args, {
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error)
    throw new Error('Could not start database preparation command.');
  if (result.status !== 0)
    throw new Error(
      'Test database preparation failed; application configuration was not changed.',
    );
}

try {
  const env = loadTestDatabaseEnv();
  console.log('Applying migrations to the explicit, separate test database.');
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    ...process.env,
    ...env,
    DIRECT_URL: getTestMigrationUrl(env.TEST_DATABASE_URL),
  });
  // Prisma creates its metadata table outside application migrations. Its
  // owning test role can still migrate with RLS enabled; API roles cannot.
  const client = new pg.Client({ connectionString: env.TEST_DATABASE_URL });
  try {
    await client.connect();
    await client.query(
      'ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY',
    );
  } finally {
    await client.end();
  }
  console.log('Seeding synthetic test households.');
  run(['--import', 'tsx', 'prisma/seed.ts'], { ...process.env, ...env });
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : 'Test database preparation failed.',
  );
  process.exitCode = 1;
}
