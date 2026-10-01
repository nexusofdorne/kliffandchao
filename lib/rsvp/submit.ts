import 'server-only';
import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import type { RsvpResponseInput } from '../validation';

export type SubmitRsvpInput = {
  clientSubmissionId: string;
  partyId: string;
  submittedByGuestId: string;
  responses: RsvpResponseInput[];
  message: string | null;
  ipHash: string | null;
};

export type SubmitRsvpResult = { outcome: 'submitted' } | { outcome: 'deduped' };

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

// One transaction: insert the immutable submission + its responses, then
// upsert each guest's current state. If clientSubmissionId has already been
// used, the insert's unique-constraint violation rolls the whole thing back
// — docs/BUILD_PLAN.md "POST /api/rsvp" step 1 — so a retried request after
// a dropped response writes nothing twice.
export async function submitRsvp(prisma: PrismaClient, input: SubmitRsvpInput): Promise<SubmitRsvpResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.rsvpSubmission.create({
        data: {
          id: input.clientSubmissionId,
          partyId: input.partyId,
          submittedByGuestId: input.submittedByGuestId,
          message: input.message,
          ipHash: input.ipHash,
          responses: {
            create: input.responses.map((response) => ({
              guestId: response.guestId,
              status: response.status,
            })),
          },
        },
      });

      const respondedAt = new Date();
      for (const response of input.responses) {
        await tx.guestRsvp.upsert({
          where: { guestId: response.guestId },
          create: {
            guestId: response.guestId,
            status: response.status,
            respondedAt,
            respondedByGuestId: input.submittedByGuestId,
            lastSubmissionId: input.clientSubmissionId,
          },
          update: {
            status: response.status,
            respondedAt,
            respondedByGuestId: input.submittedByGuestId,
            lastSubmissionId: input.clientSubmissionId,
          },
        });
      }
    });

    return { outcome: 'submitted' };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION) {
      return { outcome: 'deduped' };
    }
    throw error;
  }
}
