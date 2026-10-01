import { describe, expect, it } from 'vitest';
import { buildParty, type PartyInput } from './build-party';

const now = new Date('2026-06-01T00:00:00.000Z');
const deadline = new Date('2027-01-05T00:00:00.000Z');

const noSubmissionParty: PartyInput = {
  id: 'p01',
  label: 'Kho Family',
  latestMessage: null,
  members: [
    { id: 'g01', firstName: 'Benjamin', lastName: 'Kho', nickname: null, current: null },
    { id: 'g02', firstName: 'Imelda', lastName: 'Kho', nickname: null, current: null },
  ],
};

describe('buildParty', () => {
  it('reports no submission when nobody has answered', () => {
    const party = buildParty(noSubmissionParty, now, deadline);
    expect(party.hasSubmission).toBe(false);
    expect(party.lastRespondedAt).toBeNull();
    expect(party.members.every((member) => member.status === null)).toBe(true);
  });

  it('carries each member\'s current answer and attribution', () => {
    const respondedAt = new Date('2026-05-01T00:00:00.000Z');
    const party = buildParty(
      {
        ...noSubmissionParty,
        latestMessage: 'See you there!',
        members: [
          {
            id: 'g01',
            firstName: 'Benjamin',
            lastName: 'Kho',
            nickname: null,
            current: { status: 'ATTENDING', respondedAt, respondedByGuestId: 'g01' },
          },
          { id: 'g02', firstName: 'Imelda', lastName: 'Kho', nickname: null, current: null },
        ],
      },
      now,
      deadline,
    );

    expect(party.hasSubmission).toBe(true);
    expect(party.message).toBe('See you there!');
    expect(party.members[0]).toMatchObject({ status: 'ATTENDING', respondedByGuestId: 'g01' });
    expect(party.lastRespondedAt).toBe(respondedAt.toISOString());
  });

  it('picks the latest timestamp across members for lastRespondedAt', () => {
    const earlier = new Date('2026-04-01T00:00:00.000Z');
    const later = new Date('2026-05-15T00:00:00.000Z');
    const party = buildParty(
      {
        ...noSubmissionParty,
        members: [
          {
            id: 'g01',
            firstName: 'Benjamin',
            lastName: 'Kho',
            nickname: null,
            current: { status: 'ATTENDING', respondedAt: earlier, respondedByGuestId: 'g01' },
          },
          {
            id: 'g02',
            firstName: 'Imelda',
            lastName: 'Kho',
            nickname: null,
            current: { status: 'NOT_ATTENDING', respondedAt: later, respondedByGuestId: 'g02' },
          },
        ],
      },
      now,
      deadline,
    );

    expect(party.lastRespondedAt).toBe(later.toISOString());
  });

  it('is editable before the deadline and not after', () => {
    expect(buildParty(noSubmissionParty, new Date('2026-01-01'), deadline).editable).toBe(true);
    expect(buildParty(noSubmissionParty, new Date('2027-02-01'), deadline).editable).toBe(false);
  });
});
