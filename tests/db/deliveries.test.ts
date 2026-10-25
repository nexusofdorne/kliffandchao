import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testPrisma } from './client';
import { submitRsvp } from '../../lib/rsvp/submit';
import { deliverRsvpDelivery } from '../../lib/rsvp/deliveries';

const partyIds: string[] = [];

afterEach(async () => {
  await testPrisma.guestRsvp.deleteMany({
    where: { guest: { partyId: { in: partyIds } } },
  });
  await testPrisma.rsvpResponse.deleteMany({
    where: { submission: { partyId: { in: partyIds } } },
  });
  await testPrisma.rsvpSubmission.deleteMany({
    where: { partyId: { in: partyIds } },
  });
  await testPrisma.guest.deleteMany({ where: { partyId: { in: partyIds } } });
  await testPrisma.party.deleteMany({ where: { id: { in: partyIds } } });
  partyIds.length = 0;
});

async function submissionFixture() {
  const id = randomUUID();
  const party = await testPrisma.party.create({
    data: {
      externalId: `test-delivery-${id}`,
      label: 'Delivery test',
      members: {
        create: {
          externalId: `test-guest-${id}`,
          firstName: 'Test',
          lastName: 'Delivery',
          side: 'BOTH',
        },
      },
    },
    include: { members: true },
  });
  partyIds.push(party.id);
  await submitRsvp(testPrisma, {
    clientSubmissionId: id,
    partyId: party.id,
    submittedByGuestId: party.members[0].id,
    responses: [{ guestId: party.members[0].id, status: 'ATTENDING' }],
    message: null,
    ipHash: null,
    notification: {
      recipient: 'test@example.com',
      partyLabel: 'Delivery test',
    },
  });
  return testPrisma.rsvpDelivery.findMany({ where: { submissionId: id } });
}

describe('delivery database coordination', () => {
  it('lets only one concurrent worker send the same email', async () => {
    const deliveries = await submissionFixture();
    const email = deliveries.find(({ channel }) => channel === 'EMAIL');
    if (!email) throw new Error('Missing email task');
    const notify = vi.fn(async () => {});
    const dependencies = {
      notify,
      nextRow: async () => 2,
      mirror: async () => {},
    };
    const results = await Promise.all([
      deliverRsvpDelivery(testPrisma, email.id, dependencies),
      deliverRsvpDelivery(testPrisma, email.id, dependencies),
    ]);
    expect(results).toContain('delivered');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(
      (
        await testPrisma.rsvpDelivery.findUniqueOrThrow({
          where: { id: email.id },
        })
      ).attempts,
    ).toBe(1);
  });
  it('reserves different ranges when concurrent submissions see the same sheet tail', async () => {
    const [first, second] = await Promise.all([
      submissionFixture(),
      submissionFixture(),
    ]);
    const tasks = [...first, ...second].filter(
      ({ channel }) => channel === 'SHEETS',
    );
    const rows: number[] = [];
    const dependencies = {
      notify: async () => {},
      nextRow: async () => 200,
      mirror: async (_input: unknown, startRow: number) => {
        rows.push(startRow);
      },
    };
    const results = await Promise.all(
      tasks.map(({ id }) => deliverRsvpDelivery(testPrisma, id, dependencies)),
    );
    expect(results).toEqual(['delivered', 'delivered']);
    expect(new Set(rows).size).toBe(2);
    expect(Math.abs(rows[0] - rows[1])).toBe(1);
  });
});
