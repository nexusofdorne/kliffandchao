import { describe, expect, it } from 'vitest';
import { isAllowlistedAdminEmail } from './admin-allowlist';

describe('isAllowlistedAdminEmail', () => {
  const adminEmails = 'kliff@example.com, chao@example.com';

  it('accepts an exact match', () => {
    expect(isAllowlistedAdminEmail('kliff@example.com', adminEmails)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isAllowlistedAdminEmail('KLIFF@EXAMPLE.COM', adminEmails)).toBe(true);
  });

  it('tolerates the whitespace after the comma in the env var', () => {
    expect(isAllowlistedAdminEmail('chao@example.com', adminEmails)).toBe(true);
  });

  it('rejects an email outside the allowlist', () => {
    expect(isAllowlistedAdminEmail('guest@example.com', adminEmails)).toBe(false);
  });

  it('rejects a null or missing email', () => {
    expect(isAllowlistedAdminEmail(null, adminEmails)).toBe(false);
    expect(isAllowlistedAdminEmail(undefined, adminEmails)).toBe(false);
    expect(isAllowlistedAdminEmail('', adminEmails)).toBe(false);
  });
});
