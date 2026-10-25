import { describe, expect, it } from 'vitest';
import { hashPassword } from './password';
import { formatPasswordHash, hasValidPasswordHashFormat } from './password-env';

describe('password environment values', () => {
  const hash = hashPassword('example-password');
  it('escapes local assignments without changing the Vercel value', () => {
    expect(formatPasswordHash(hash, 'local')).toBe(
      `SITE_PASSWORD_HASH=${hash.split('$').join('\\$')}`,
    );
    expect(formatPasswordHash(hash, 'vercel')).toBe(hash);
  });
  it('accepts generated hashes and rejects expanded, escaped or malformed values', () => {
    expect(hasValidPasswordHashFormat(hash)).toBe(true);
    for (const invalid of [
      undefined,
      '',
      'scrypt',
      hash.replace(/\$/g, '\\$'),
      hash + '$extra',
      hash.replace('$16384$', '$999$'),
    ]) {
      expect(hasValidPasswordHashFormat(invalid)).toBe(false);
    }
  });
});
