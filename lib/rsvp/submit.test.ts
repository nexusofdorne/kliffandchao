import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { submitRsvp, type SubmitRsvpInput } from './submit';

const input: SubmitRsvpInput = {
  clientSubmissionId: 'submission-1',
  partyId: 'party-1',
  submittedByGuestId: 'g1',
  responses: [
    { guestId: 'g1', status: 'NOT_ATTENDING' },
    { guestId: 'g2', status: 'ATTENDING' },
  ],
  message: null,
  ipHash: null,
  notification: { recipient: 'test@example.com', partyLabel: 'Test household', submitterName: 'Test Guest', answers: [] },
};

// The transaction client has no seating tables on purpose: freeing seats happens after the commit.
function fakePrisma(options: { transactionError?: unknown; releaseError?: unknown } = {}) {
  const tx = {
    rsvpSubmission: { create: vi.fn().mockResolvedValue({}) },
    guestRsvp: { upsert: vi.fn().mockResolvedValue({}) },
  };
  const deleteMany = options.releaseError
    ? vi.fn().mockRejectedValue(options.releaseError)
    : vi.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
      if (options.transactionError) throw options.transactionError;
      return fn(tx);
    }),
    seatAssignment: { deleteMany },
  };
  return { prisma: prisma as unknown as PrismaClient, deleteMany };
}

describe('submitRsvp seat release', () => {
  afterEach(() => vi.restoreAllMocks());

  it('frees the seats of guests not attending after the RSVP commits', async () => {
    const { prisma, deleteMany } = fakePrisma();
    await expect(submitRsvp(prisma, input)).resolves.toEqual({ outcome: 'submitted' });
    expect(deleteMany).toHaveBeenCalledWith({ where: { guestId: { in: ['g1'] } } });
  });

  it('still reports the RSVP as submitted when freeing the seats fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { prisma } = fakePrisma({ releaseError: new Error('seating down') });
    await expect(submitRsvp(prisma, input)).resolves.toEqual({ outcome: 'submitted' });
    expect(logged).toHaveBeenCalledOnce();
  });

  it('frees nothing for a deduplicated retry', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' });
    const { prisma, deleteMany } = fakePrisma({ transactionError: duplicate });
    await expect(submitRsvp(prisma, input)).resolves.toEqual({ outcome: 'deduped' });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
