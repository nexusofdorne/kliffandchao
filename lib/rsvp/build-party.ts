import 'server-only';
import type { PrismaClient } from '../../generated/prisma/client';

export type AttendanceStatus = 'ATTENDING' | 'NOT_ATTENDING';

export type PartyMemberInput = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  current: { status: AttendanceStatus; respondedAt: Date; respondedByGuestId: string } | null;
};

export type PartyInput = {
  id: string;
  label: string;
  members: PartyMemberInput[];
  latestMessage: string | null;
};

export type PartyMemberView = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  status: AttendanceStatus | null;
  respondedAt: string | null;
  respondedByGuestId: string | null;
};

export type PartyView = {
  id: string;
  label: string;
  members: PartyMemberView[];
  message: string | null;
  hasSubmission: boolean;
  lastRespondedAt: string | null;
  editable: boolean;
  deadlineIso: string;
};

// Pure: takes the party's current state and "now", returns exactly what the
// client renders. docs/PLAN.md "Already-RSVP'd behaviour" — hasSubmission
// drives the prefill/banner, editable is the server-side deadline check the
// client flag is never trusted for.
export function buildParty(input: PartyInput, now: Date, deadline: Date): PartyView {
  const respondedTimestamps = input.members
    .map((member) => member.current?.respondedAt)
    .filter((respondedAt): respondedAt is Date => respondedAt != null);

  const lastRespondedAt =
    respondedTimestamps.length > 0
      ? new Date(Math.max(...respondedTimestamps.map((date) => date.getTime())))
      : null;

  return {
    id: input.id,
    label: input.label,
    members: input.members.map((member) => ({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      nickname: member.nickname,
      status: member.current?.status ?? null,
      respondedAt: member.current?.respondedAt.toISOString() ?? null,
      respondedByGuestId: member.current?.respondedByGuestId ?? null,
    })),
    message: input.latestMessage,
    hasSubmission: respondedTimestamps.length > 0,
    lastRespondedAt: lastRespondedAt?.toISOString() ?? null,
    editable: now.getTime() < deadline.getTime(),
    deadlineIso: deadline.toISOString(),
  };
}

// Thin I/O wrapper: fetches what buildParty() needs and calls it. Used by
// both GET /api/party and POST /api/rsvp's "return the fresh Party" step.
export async function loadPartyView(
  prisma: PrismaClient,
  partyId: string,
  now: Date,
  deadline: Date,
): Promise<PartyView | null> {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      members: { where: { archivedAt: null }, include: { current: true } },
      submissions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!party) return null;

  return buildParty(
    {
      id: party.id,
      label: party.label,
      members: party.members,
      latestMessage: party.submissions[0]?.message ?? null,
    },
    now,
    deadline,
  );
}
