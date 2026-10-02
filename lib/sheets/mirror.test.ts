import { describe, expect, it } from 'vitest';
import { buildRsvpLogRows } from './mirror';

describe('buildRsvpLogRows', () => {
  const createdAt = new Date('2026-06-01T12:00:00.000Z');

  it('builds one row per guest response, in the RSVP_Log column order', () => {
    const rows = buildRsvpLogRows({
      submissionId: 'sub_1',
      submittedByGuestId: 'g01',
      partyId: 'p01',
      responses: [
        { guestId: 'g01', status: 'ATTENDING' },
        { guestId: 'g02', status: 'NOT_ATTENDING' },
      ],
      message: 'See you there!',
      ipHash: 'hash123',
      createdAt,
    });

    expect(rows).toEqual([
      [createdAt.toISOString(), 'sub_1', 'g01', 'p01', 'g01', 'ATTENDING', 'See you there!', 'hash123'],
      [createdAt.toISOString(), 'sub_1', 'g01', 'p01', 'g02', 'NOT_ATTENDING', 'See you there!', 'hash123'],
    ]);
  });

  it('writes empty strings for a null message and ip hash', () => {
    const [row] = buildRsvpLogRows({
      submissionId: 'sub_2',
      submittedByGuestId: 'g01',
      partyId: 'p01',
      responses: [{ guestId: 'g01', status: 'ATTENDING' }],
      message: null,
      ipHash: null,
      createdAt,
    });
    expect(row[6]).toBe('');
    expect(row[7]).toBe('');
  });

  it('escapes a message that would read as a formula', () => {
    const [row] = buildRsvpLogRows({
      submissionId: 'sub_3',
      submittedByGuestId: 'g01',
      partyId: 'p01',
      responses: [{ guestId: 'g01', status: 'ATTENDING' }],
      message: '=1+1',
      ipHash: null,
      createdAt,
    });
    expect(row[6]).toBe("'=1+1");
  });

  it('returns no rows for an empty response list', () => {
    expect(
      buildRsvpLogRows({
        submissionId: 'sub_4',
        submittedByGuestId: 'g01',
        partyId: 'p01',
        responses: [],
        message: null,
        ipHash: null,
        createdAt,
      }),
    ).toEqual([]);
  });
});
