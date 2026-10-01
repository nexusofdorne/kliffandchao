import { describe, expect, it } from 'vitest';
import { hashPassword, normalizePassword, verifyPassword } from './password';

describe('normalizePassword', () => {
  it('trims, lowercases and NFKC-normalizes', () => {
    expect(normalizePassword(' KliffAndChao ')).toBe('kliffandchao');
  });
});

describe('verifyPassword', () => {
  const hash = hashPassword('kliffandchao');

  it('accepts the exact password', () => {
    expect(verifyPassword('kliffandchao', hash)).toBe(true);
  });

  it('accepts a normalization-equivalent variant', () => {
    expect(verifyPassword(' KliffAndChao ', hash)).toBe(true);
  });

  it('rejects the wrong password', () => {
    expect(verifyPassword('wrongpassword', hash)).toBe(false);
  });

  it('rejects a malformed hash instead of throwing', () => {
    expect(verifyPassword('kliffandchao', 'not-a-real-hash')).toBe(false);
  });

  it('rejects a hash with a non-scrypt scheme', () => {
    expect(verifyPassword('kliffandchao', 'bcrypt$10$abc$def')).toBe(false);
  });
});

describe('hashPassword', () => {
  it('produces a different salt (and hash) each time for the same password', () => {
    expect(hashPassword('kliffandchao')).not.toBe(hashPassword('kliffandchao'));
  });
});
