import {
  mkdtempSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  rmdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getTestMigrationUrl, loadTestDatabaseEnv } from './test-database-env';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'test-db-config-'));
});
afterEach(() => {
  for (const name of ['.env', '.env.local', '.env.test', 'root.crt']) {
    const file = join(root, name);
    if (existsSync(file)) unlinkSync(file);
  }
  rmdirSync(root);
});

describe('test database targeting', () => {
  it('requires an explicit test file and connection instead of falling back to application credentials', () => {
    writeFileSync(
      join(root, '.env.local'),
      'DIRECT_URL=postgresql://app:secret@localhost/live',
    );
    expect(() => loadTestDatabaseEnv(root)).toThrow('require .env.test');
    writeFileSync(join(root, '.env.test'), 'TEST_DATABASE_URL=');
    expect(() => loadTestDatabaseEnv(root)).toThrow('No fallback');
  });
  it('rejects the same application database even with different credentials', () => {
    writeFileSync(
      join(root, '.env.local'),
      'DATABASE_URL=postgresql://app:secret@localhost/live',
    );
    writeFileSync(
      join(root, '.env.test'),
      'TEST_DATABASE_URL=postgresql://test:other@localhost/live',
    );
    expect(() => loadTestDatabaseEnv(root)).toThrow('different database');
  });
  it('recognizes a Supabase project across direct and pooled endpoints', () => {
    writeFileSync(
      join(root, '.env.local'),
      'DIRECT_URL=postgresql://postgres:secret@db.liveproject.supabase.co/postgres',
    );
    writeFileSync(
      join(root, '.env.test'),
      'TEST_DATABASE_URL=postgresql://runner.liveproject:other@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    );
    expect(() => loadTestDatabaseEnv(root)).toThrow('different database');
  });
  it('overrides every database target for child tools and preserves strict TLS', () => {
    writeFileSync(
      join(root, '.env.test'),
      'TEST_DATABASE_URL=postgresql://test:secret@db.testproject.supabase.co/postgres\nDIRECT_URL=postgresql://wrong:wrong@localhost/live\nTEST_DATABASE_CA_CERT=root.crt',
    );
    writeFileSync(join(root, 'root.crt'), 'test certificate');
    const env = loadTestDatabaseEnv(root);
    expect(env.DIRECT_URL).toBe(env.TEST_DATABASE_URL);
    expect(env.DATABASE_URL).toBe(env.TEST_DATABASE_URL);
    expect(env.NODE_ENV).toBe('test');
    const url = new URL(env.TEST_DATABASE_URL);
    expect(url.searchParams.get('sslmode')).toBe('verify-full');
    expect(url.searchParams.get('sslrootcert')).toBe(join(root, 'root.crt'));
    const migrate = new URL(getTestMigrationUrl(env.TEST_DATABASE_URL));
    expect(migrate.searchParams.get('sslaccept')).toBe('strict');
    expect(migrate.searchParams.get('sslcert')).toBe(join(root, 'root.crt'));
  });
  it('rejects invalid targets and missing certificates without revealing credentials', () => {
    writeFileSync(
      join(root, '.env.test'),
      'TEST_DATABASE_URL=https://user:private@example.com',
    );
    expect(() => loadTestDatabaseEnv(root)).toThrow('valid PostgreSQL URLs');
    writeFileSync(
      join(root, '.env.test'),
      'TEST_DATABASE_URL=postgresql://test:secret@localhost/test\nTEST_DATABASE_CA_CERT=missing.crt',
    );
    expect(() => loadTestDatabaseEnv(root)).toThrow('does not exist');
  });
});
