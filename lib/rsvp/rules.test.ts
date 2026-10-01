import { describe, expect, it } from 'vitest';
import { findGuestOutsideParty, hashIp, hasDuplicateGuestIds, isPastDeadline } from './rules';

describe('hasDuplicateGuestIds', () => {
  it('returns false for distinct guest ids', () => {
    expect(hasDuplicateGuestIds([{ guestId: 'g01', status: 'ATTENDING' }, { guestId: 'g02', status: 'ATTENDING' }])).toBe(
      false,
    );
  });

  it('returns true when the same guest id appears twice', () => {
    expect(
      hasDuplicateGuestIds([
        { guestId: 'g01', status: 'ATTENDING' },
        { guestId: 'g01', status: 'NOT_ATTENDING' },
      ]),
    ).toBe(true);
  });
});

describe('findGuestOutsideParty', () => {
  const partyMemberIds = new Set(['g01', 'g02', 'g03']);

  it('returns null when every response targets a party member', () => {
    expect(findGuestOutsideParty([{ guestId: 'g01', status: 'ATTENDING' }], partyMemberIds)).toBeNull();
  });

  it('returns the first guestId outside the party', () => {
    expect(
      findGuestOutsideParty(
        [
          { guestId: 'g01', status: 'ATTENDING' },
          { guestId: 'g99', status: 'ATTENDING' },
        ],
        partyMemberIds,
      ),
    ).toBe('g99');
  });
});

describe('isPastDeadline', () => {
  it('is not past the deadline before it arrives', () => {
    expect(isPastDeadline(new Date('2026-01-01'), new Date('2027-01-01'))).toBe(false);
  });

  it('is past the deadline once reached', () => {
    expect(isPastDeadline(new Date('2027-01-01'), new Date('2027-01-01'))).toBe(true);
  });

  it('is past the deadline after it', () => {
    expect(isPastDeadline(new Date('2028-01-01'), new Date('2027-01-01'))).toBe(true);
  });
});

describe('hashIp', () => {
  it('is deterministic for the same input', () => {
    expect(hashIp('1.2.3.4', 'salt')).toBe(hashIp('1.2.3.4', 'salt'));
  });

  it('differs for a different salt', () => {
    expect(hashIp('1.2.3.4', 'salt-a')).not.toBe(hashIp('1.2.3.4', 'salt-b'));
  });
});
