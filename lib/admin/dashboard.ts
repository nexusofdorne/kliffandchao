import 'server-only';
import type { PrismaClient } from '../../generated/prisma/client';
import { computeAttendanceTally, type AttendanceStatus, type AttendanceTally } from './stats';

export type AdminGuestRow = {
  id: string;
  displayName: string;
  partyId: string;
  partyLabel: string;
  status: AttendanceStatus | null;
  respondedAt: Date | null;
  answeredByDisplayName: string | null;
};

export type AdminDashboardData = {
  tally: AttendanceTally;
  guests: AdminGuestRow[];
};

// Thin I/O wrapper: fetches what computeAttendanceTally() needs and calls
// it, same split as lib/rsvp/build-party.ts's loadPartyView(). "Answered
// by" is resolved in one extra batched lookup rather than one query per
// guest, since a guest's current responder is often a different guest in
// the same already-fetched party.
export async function getAdminDashboardData(prisma: PrismaClient): Promise<AdminDashboardData> {
  const guests = await prisma.guest.findMany({
    where: { archivedAt: null },
    include: { current: true, party: true },
    orderBy: [{ party: { label: 'asc' } }, { lastName: 'asc' }, { firstName: 'asc' }],
  });

  const responderIds = [
    ...new Set(
      guests.map((guest) => guest.current?.respondedByGuestId).filter((id): id is string => id != null),
    ),
  ];
  const responders = responderIds.length
    ? await prisma.guest.findMany({
        where: { id: { in: responderIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const responderNameById = new Map(responders.map((responder) => [responder.id, `${responder.firstName} ${responder.lastName}`]));

  const rows: AdminGuestRow[] = guests.map((guest) => ({
    id: guest.id,
    displayName: `${guest.firstName} ${guest.lastName}`,
    partyId: guest.partyId,
    partyLabel: guest.party.label,
    status: guest.current?.status ?? null,
    respondedAt: guest.current?.respondedAt ?? null,
    answeredByDisplayName: guest.current ? (responderNameById.get(guest.current.respondedByGuestId) ?? null) : null,
  }));

  const households = new Set(guests.map((guest) => guest.partyId)).size;

  return {
    tally: computeAttendanceTally(
      rows.map((row) => ({ status: row.status })),
      households,
    ),
    guests: rows,
  };
}

export type PartyHistorySubmission = {
  id: string;
  createdAt: Date;
  submittedByDisplayName: string;
  message: string | null;
  responses: { guestDisplayName: string; status: AttendanceStatus }[];
};

export type PartyHistory = {
  partyLabel: string;
  submissions: PartyHistorySubmission[];
};

// Every submission a party has ever made, newest first, with full
// attribution — the recoverability docs/BUILD_PLAN.md's two-layer data
// model (immutable RsvpSubmission history + current GuestRsvp) exists for.
export async function getPartyHistory(prisma: PrismaClient, partyId: string): Promise<PartyHistory | null> {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      submissions: {
        orderBy: { createdAt: 'desc' },
        include: { responses: { include: { guest: true } } },
      },
    },
  });
  if (!party) return null;

  const submitterIds = [...new Set(party.submissions.map((submission) => submission.submittedByGuestId))];
  const submitters = submitterIds.length
    ? await prisma.guest.findMany({
        where: { id: { in: submitterIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const submitterNameById = new Map(submitters.map((submitter) => [submitter.id, `${submitter.firstName} ${submitter.lastName}`]));

  return {
    partyLabel: party.label,
    submissions: party.submissions.map((submission) => ({
      id: submission.id,
      createdAt: submission.createdAt,
      submittedByDisplayName: submitterNameById.get(submission.submittedByGuestId) ?? 'Unknown',
      message: submission.message,
      responses: submission.responses.map((response) => ({
        guestDisplayName: `${response.guest.firstName} ${response.guest.lastName}`,
        status: response.status,
      })),
    })),
  };
}
