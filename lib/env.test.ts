import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const validEnv = {
  SITE_PASSWORD_HASH: 'scrypt$16384$8$1$salt$hash',
  SESSION_SECRET: 'a'.repeat(32),
  SESSION_EPOCH: '1',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  ADMIN_EMAILS: 'couple@example.com',
  GOOGLE_SA_KEY_B64: 'base64-key',
  GOOGLE_SHEET_ID: 'sheet-id',
  SYNC_WEBHOOK_SECRET: 'webhook-secret',
  RSVP_DEADLINE: '2027-02-01T00:00:00.000Z',
  IP_HASH_SALT: 'salt',
  RESEND_API_KEY: 'resend-key',
  COUPLE_NOTIFY_EMAIL: 'couple@example.com',
};

describe('parseEnv', () => {
  it('accepts a fully populated environment', () => {
    const env = parseEnv(validEnv);
    expect(env.SESSION_EPOCH).toBe(1);
    expect(env.COUPLE_NOTIFY_EMAIL).toBe('couple@example.com');
  });

  it('omits optional keys without failing', () => {
    expect(() => parseEnv(validEnv)).not.toThrow();
    expect(parseEnv(validEnv).UPSTASH_REDIS_REST_URL).toBeUndefined();
  });

  it('rejects a missing required var', () => {
    const rest: Partial<typeof validEnv> = { ...validEnv };
    delete rest.SITE_PASSWORD_HASH;
    expect(() => parseEnv(rest)).toThrow();
  });

  it('rejects a malformed email', () => {
    expect(() =>
      parseEnv({ ...validEnv, COUPLE_NOTIFY_EMAIL: 'not-an-email' }),
    ).toThrow();
  });
});
