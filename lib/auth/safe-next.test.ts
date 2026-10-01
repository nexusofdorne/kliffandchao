import { describe, expect, it } from 'vitest';
import { isSafeNextPath } from './safe-next';

describe('isSafeNextPath', () => {
  it('allows an internal path', () => {
    expect(isSafeNextPath('/rsvp')).toBe(true);
  });

  it('rejects a protocol-relative URL', () => {
    expect(isSafeNextPath('//evil.com')).toBe(false);
  });

  it('rejects an absolute URL', () => {
    expect(isSafeNextPath('https://evil.com')).toBe(false);
  });

  it('rejects a path that does not start with a slash', () => {
    expect(isSafeNextPath('rsvp')).toBe(false);
  });
});
