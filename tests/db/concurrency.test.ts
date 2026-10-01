import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { submitRsvp } from '../../lib/rsvp/submit';
import { testPrisma } from './client';

// Dy Household (external id p05: g13-g16) — its own party so this doesn't
// race the idempotency test, which uses Kho Family.
const PARTY_EXTERNAL_ID = 'p05';
const GUEST_EXTERNAL_IDS = ['g13', 'g14', 'g15', 'g16'];
const SUBMISSION_COUNT = 5;
let partyId: string;
let guestIds: string[];

async function cleanUp(clientSubmissionIds: string[]) {
  await testPrisma.rsvpResponse.deleteMany({ where: { submissionId: { in: clientSubmissionIds } } });
  await testPrisma.rsvpSubmission.deleteMany({ where: { id: { in: clientSubmissionIds } } });
  await testPrisma.guestRsvp.deleteMany({ where: { guestId: { in: guestIds } } });
}

describe('submitRsvp concurrency', () => {
  let clientSubmissionIds: string[];

  beforeAll(async () => {
    const party = await testPrisma.party.findUniqueOrThrow({ where: { externalId: PARTY_EXTERNAL_ID } });
    partyId = party.id;
    const guests = await testPrisma.guest.findMany({ where: { externalId: { in: GUEST_EXTERNAL_IDS } } });
    guestIds = guests.map((guest) => guest.id);
  });

  afterEach(async () => {
    await cleanUp(clientSubmissionIds);
  });

  it('five concurrent submissions for one household produce five submissions and one coherent GuestRsvp per guest', async () => {
    clientSubmissionIds = Array.from({ length: SUBMISSION_COUNT }, () => randomUUID());

    const results = await Promise.all(
      clientSubmissionIds.map((clientSubmissionId, index) =>
        submitRsvp(testPrisma, {
          clientSubmissionId,
          partyId,
          submittedByGuestId: guestIds[index % guestIds.length],
          responses: guestIds.map((guestId, memberIndex) => ({
            guestId,
            status: (index + memberIndex) % 2 === 0 ? ('ATTENDING' as const) : ('NOT_ATTENDING' as const),
          })),
          message: `Concurrency test #${index}`,
          ipHash: null,
        }),
      ),
    );

    expect(results.every((result) => result.outcome === 'submitted')).toBe(true);

    const submissions = await testPrisma.rsvpSubmission.findMany({ where: { id: { in: clientSubmissionIds } } });
    expect(submissions).toHaveLength(SUBMISSION_COUNT);

    const guestRsvps = await testPrisma.guestRsvp.findMany({ where: { guestId: { in: guestIds } } });
    expect(guestRsvps).toHaveLength(guestIds.length);

    // Coherence: whichever submission "won" the race for a guest, its
    // status/submissionId pair must match an actual response from that
    // same submission — never a mix of two different submissions' fields.
    for (const guestRsvp of guestRsvps) {
      const matchingResponse = await testPrisma.rsvpResponse.findFirst({
        where: { submissionId: guestRsvp.lastSubmissionId, guestId: guestRsvp.guestId },
      });
      expect(matchingResponse).not.toBeNull();
      expect(matchingResponse?.status).toBe(guestRsvp.status);
      expect(clientSubmissionIds).toContain(guestRsvp.lastSubmissionId);
    }
  });
});
