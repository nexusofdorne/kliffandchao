import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

function parseDatabaseUrl(raw: string): URL {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:')
      throw new Error();
    return url;
  } catch {
    throw new Error(
      'Database connection configuration must contain valid PostgreSQL URLs.',
    );
  }
}

function databaseIdentity(raw: string): string {
  const url = parseDatabaseUrl(raw);
  const project =
    /^db\.([^.]+)\.supabase\.co$/.exec(url.hostname)?.[1] ??
    (url.hostname.endsWith('.pooler.supabase.com')
      ? /^[^.]+\.(.+)$/.exec(decodeURIComponent(url.username))?.[1]
      : undefined);
  return project
    ? `supabase:${project}${url.pathname}`
    : `${url.hostname}:${url.port || '5432'}${url.pathname}`;
}

// Used by both migration/seed preparation and Vitest. Requiring an explicit
// separate target protects real guests before any database write begins.
export function loadTestDatabaseEnv(
  root = process.cwd(),
): Record<string, string> {
  const file = resolve(root, '.env.test');
  if (!existsSync(file))
    throw new Error(
      'Database tests require .env.test with TEST_DATABASE_URL for a separate test database.',
    );
  const testEnv = parse(readFileSync(file));
  if (!testEnv.TEST_DATABASE_URL)
    throw new Error(
      'Set TEST_DATABASE_URL in .env.test. No fallback to the application database is allowed.',
    );
  const target = parseDatabaseUrl(testEnv.TEST_DATABASE_URL);
  for (const name of ['.env', '.env.local']) {
    const appFile = resolve(root, name);
    if (!existsSync(appFile)) continue;
    const appEnv = parse(readFileSync(appFile));
    for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
      if (
        appEnv[key] &&
        databaseIdentity(appEnv[key]) === databaseIdentity(target.href)
      )
        throw new Error(
          'TEST_DATABASE_URL must use a different database from the application.',
        );
    }
  }
  if (testEnv.TEST_DATABASE_CA_CERT) {
    const certificate = resolve(root, testEnv.TEST_DATABASE_CA_CERT);
    if (!existsSync(certificate))
      throw new Error('TEST_DATABASE_CA_CERT does not exist.');
    target.searchParams.set('sslmode', 'verify-full');
    target.searchParams.set('sslrootcert', certificate);
  }
  return {
    ...testEnv,
    TEST_DATABASE_URL: target.href,
    DATABASE_URL: target.href,
    DIRECT_URL: target.href,
    NODE_ENV: 'test',
  };
}

// Prisma Migrate uses its Rust connector, while the app and tests use pg.
// Their CA parameters differ; both are configured to verify certificates.
export function getTestMigrationUrl(connection: string): string {
  const url = parseDatabaseUrl(connection);
  const certificate = url.searchParams.get('sslrootcert');
  if (certificate) {
    url.searchParams.delete('sslrootcert');
    url.searchParams.set('sslcert', certificate);
    url.searchParams.set('sslmode', 'require');
    url.searchParams.set('sslaccept', 'strict');
  }
  return url.href;
}
