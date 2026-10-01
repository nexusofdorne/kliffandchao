import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { submitRsvp } from '../../lib/rsvp/submit';
import { testPrisma } from './client';

// Kho Family (external id p01: g01, g02, g03) — reserved for this test file
// so it doesn't race the concurrency test, which uses a different household.
const PARTY_EXTERNAL_ID = 'p01';
const GUEST_EXTERNAL_IDS = ['g01', 'g02', 'g03'];
let partyId: string;
let guestIds: string[];

async function cleanUp(clientSubmissionId: string) {
  await testPrisma.rsvpResponse.deleteMany({ where: { submissionId: clientSubmissionId } });
  await testPrisma.rsvpSubmission.deleteMany({ where: { id: clientSubmissionId } });
  await testPrisma.guestRsvp.deleteMany({ where: { guestId: { in: guestIds } } });
}

describe('submitRsvp idempotency', () => {
  let clientSubmissionId: string;

  beforeAll(async () => {
    const party = await testPrisma.party.findUniqueOrThrow({ where: { externalId: PARTY_EXTERNAL_ID } });
    partyId = party.id;
    const guests = await testPrisma.guest.findMany({ where: { externalId: { in: GUEST_EXTERNAL_IDS } } });
    guestIds = guests.map((guest) => guest.id);
  });

  afterEach(async () => {
    await cleanUp(clientSubmissionId);
  });

  it('writes one submission for a repeated clientSubmissionId', async () => {
    clientSubmissionId = randomUUID();
    const input = {
      clientSubmissionId,
      partyId,
      submittedByGuestId: guestIds[0],
      responses: guestIds.map((guestId) => ({ guestId, status: 'ATTENDING' as const })),
      message: 'Idempotency test',
      ipHash: null,
    };

    const first = await submitRsvp(testPrisma, input);
    expect(first.outcome).toBe('submitted');

    const second = await submitRsvp(testPrisma, input);
    expect(second.outcome).toBe('deduped');

    const submissions = await testPrisma.rsvpSubmission.findMany({ where: { id: clientSubmissionId } });
    expect(submissions).toHaveLength(1);

    const responses = await testPrisma.rsvpResponse.findMany({ where: { submissionId: clientSubmissionId } });
    expect(responses).toHaveLength(guestIds.length);

    const guestRsvps = await testPrisma.guestRsvp.findMany({ where: { guestId: { in: guestIds } } });
    expect(guestRsvps).toHaveLength(guestIds.length);
  });
});
