import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PrismaClient, RsvpDelivery } from '../../generated/prisma/client';
import { env } from '../env';
import { mirrorRsvpToSheet, readRsvpLogNextRow } from '../sheets/mirror';
import { notificationSchema } from '../validation';
import { DELIVERY_LEASE_MS, getDeliveryAction } from './delivery-policy';
import { notifyCouple } from './notify';

type DeliveryServices = {
  notify: typeof notifyCouple;
  mirror: typeof mirrorRsvpToSheet;
  nextRow: typeof readRsvpLogNextRow;
};
const services: DeliveryServices = {
  notify: notifyCouple,
  mirror: mirrorRsvpToSheet,
  nextRow: readRsvpLogNextRow,
};

export type DeliveryOutcome =
  'delivered' | 'failed' | 'busy' | 'review' | 'missing' | 'complete';

async function reserveSheetRows(
  prisma: PrismaClient,
  delivery: RsvpDelivery,
  rowCount: number,
  nextRow: () => Promise<number>,
): Promise<number> {
  if (delivery.sheetStartRow !== null) {
    if (delivery.sheetId !== env.GOOGLE_SHEET_ID)
      throw new Error('Delivery belongs to another spreadsheet');
    return delivery.sheetStartRow;
  }
  const firstUnusedRow = await nextRow();
  return prisma.$transaction(async (tx) => {
    // One cursor per spreadsheet serializes allocations across concurrent
    // submissions. Existing log rows are preserved when initializing it.
    const [cursor] = await tx.$queryRaw<{ nextRow: number }[]>`
      INSERT INTO "SheetMirrorCursor" ("sheetId", "nextRow")
      VALUES (${env.GOOGLE_SHEET_ID}, ${firstUnusedRow + rowCount})
      ON CONFLICT ("sheetId") DO UPDATE
      SET "nextRow" = GREATEST("SheetMirrorCursor"."nextRow", ${firstUnusedRow}) + ${rowCount}
      RETURNING "nextRow"
    `;
    const startRow = cursor.nextRow - rowCount;
    const reserved = await tx.rsvpDelivery.updateMany({
      where: {
        id: delivery.id,
        claimToken: delivery.claimToken,
        status: 'PROCESSING',
      },
      data: { sheetId: env.GOOGLE_SHEET_ID, sheetStartRow: startRow },
    });
    if (reserved.count !== 1) throw new Error('Delivery claim expired');
    return startRow;
  });
}

export async function deliverRsvpDelivery(
  prisma: PrismaClient,
  deliveryId: string,
  dependencies: DeliveryServices = services,
): Promise<DeliveryOutcome> {
  const record = await prisma.rsvpDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      submission: { include: { responses: { orderBy: { guestId: 'asc' } } } },
    },
  });
  if (!record) return 'missing';
  const now = new Date();
  const action = getDeliveryAction(record, now);
  if (action === 'review') {
    await prisma.rsvpDelivery.updateMany({
      where: {
        id: record.id,
        attempts: record.attempts,
        status: record.status,
      },
      data: { status: 'REVIEW', claimToken: null, leaseUntil: null },
    });
    return 'review';
  }
  if (action !== 'send') return action;

  const claimToken = randomUUID();
  const claimed = await prisma.rsvpDelivery.updateMany({
    where: {
      id: record.id,
      attempts: record.attempts,
      OR: [
        { status: { in: ['PENDING', 'FAILED'] } },
        { status: 'PROCESSING', leaseUntil: { lte: now } },
      ],
    },
    data: {
      status: 'PROCESSING',
      claimToken,
      attempts: { increment: 1 },
      firstAttemptAt: record.firstAttemptAt ?? now,
      leaseUntil: new Date(now.getTime() + DELIVERY_LEASE_MS),
    },
  });
  if (claimed.count !== 1) return 'busy';
  try {
    if (record.channel === 'EMAIL') {
      await dependencies.notify(
        notificationSchema.parse(record.payload),
        record.id,
      );
    } else {
      const submission = record.submission;
      const startRow = await reserveSheetRows(
        prisma,
        { ...record, claimToken },
        submission.responses.length,
        dependencies.nextRow,
      );
      await dependencies.mirror(
        {
          submissionId: submission.id,
          submittedByGuestId: submission.submittedByGuestId,
          partyId: submission.partyId,
          responses: submission.responses,
          message: submission.message,
          ipHash: submission.ipHash,
          createdAt: submission.createdAt,
        },
        startRow,
      );
    }
    const completed = await prisma.rsvpDelivery.updateMany({
      where: { id: record.id, claimToken },
      data: {
        status: 'SUCCEEDED',
        deliveredAt: new Date(),
        claimToken: null,
        leaseUntil: null,
      },
    });
    return completed.count === 1 ? 'delivered' : 'busy';
  } catch {
    // Provider bodies may contain private data. Keep logs scoped to ids.
    console.error('RSVP delivery failed', {
      deliveryId: record.id,
      channel: record.channel,
    });
    await prisma.rsvpDelivery.updateMany({
      where: { id: record.id, claimToken },
      data: { status: 'FAILED', claimToken: null, leaseUntil: null },
    });
    return 'failed';
  }
}

export async function deliverRsvpSubmission(
  prisma: PrismaClient,
  submissionId: string,
): Promise<void> {
  const deliveries = await prisma.rsvpDelivery.findMany({
    where: { submissionId },
    select: { id: true },
  });
  const outcomes = await Promise.allSettled(
    deliveries.map(({ id }) => deliverRsvpDelivery(prisma, id)),
  );
  if (outcomes.some((outcome) => outcome.status === 'rejected'))
    console.error('RSVP delivery worker interrupted', { submissionId });
}

export async function getOutstandingDeliveries(
  prisma: PrismaClient,
  requestedPage = 1,
) {
  const pageSize = 50;
  const total = await prisma.rsvpDelivery.count({
    where: { status: { not: 'SUCCEEDED' } },
  });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(
    pages,
    Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1),
  );
  const records = await prisma.rsvpDelivery.findMany({
    where: { status: { not: 'SUCCEEDED' } },
    orderBy: { createdAt: 'asc' },
    take: pageSize,
    skip: (page - 1) * pageSize,
    include: {
      submission: { include: { party: { select: { label: true } } } },
    },
  });
  const now = new Date();
  return {
    total,
    page,
    pages,
    records: records.map((record) => ({
      id: record.id,
      channel: record.channel,
      status:
        getDeliveryAction(record, now) === 'review'
          ? ('REVIEW' as const)
          : record.status,
      attempts: record.attempts,
      partyLabel: record.submission.party.label,
      retryable: getDeliveryAction(record, now) === 'send',
    })),
  };
}
