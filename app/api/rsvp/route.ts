import { after, NextResponse } from 'next/server';
import { requireGateApi } from '@/lib/auth/require-gate';
import { loadPartyView } from '@/lib/rsvp/build-party';
import { deliverRsvpSubmission } from '@/lib/rsvp/deliveries';
import {
  findGuestOutsideParty,
  hashIp,
  hasDuplicateGuestIds,
  isPastDeadline,
} from '@/lib/rsvp/rules';
import { submitRsvp } from '@/lib/rsvp/submit';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/settings/site-settings';
import { rsvpRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Order of checks per docs/BUILD_PLAN.md "POST /api/rsvp": requireGate() ->
// zod parse -> deadline (409) -> resolve submitter's party -> reject a
// guestId outside it (403 outside_party) -> reject duplicate guest ids
// (400) -> the transaction in submitRsvp().
export async function POST(request: Request) {
  const unauthorized = await requireGateApi();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  const parsed = rsvpRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // closed from /admin (after the wedding, the portfolio): nothing is saved or sent
  if ((await getSiteSettings()).rsvpClosed) {
    return NextResponse.json({ error: 'rsvp_closed' }, { status: 409 });
  }

  const deadline = new Date(env.RSVP_DEADLINE);
  const now = new Date();
  if (isPastDeadline(now, deadline)) {
    return NextResponse.json({ error: 'deadline_passed' }, { status: 409 });
  }

  const submitter = await prisma.guest.findFirst({
    where: { id: parsed.data.submittedByGuestId, archivedAt: null },
    select: {
      partyId: true,
      firstName: true,
      lastName: true,
      party: {
        select: {
          label: true,
          members: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!submitter) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const partyMemberIds = new Set(
    submitter.party.members.map((member) => member.id),
  );
  const outsideGuestId = findGuestOutsideParty(
    parsed.data.responses,
    partyMemberIds,
  );
  if (outsideGuestId) {
    return NextResponse.json({ error: 'outside_party' }, { status: 403 });
  }

  if (hasDuplicateGuestIds(parsed.data.responses)) {
    return NextResponse.json({ error: 'duplicate_guest_id' }, { status: 400 });
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  const ipHash = forwardedFor
    ? hashIp(forwardedFor.split(',')[0].trim(), env.IP_HASH_SALT)
    : null;

  const result = await submitRsvp(prisma, {
    clientSubmissionId: parsed.data.clientSubmissionId,
    partyId: submitter.partyId,
    submittedByGuestId: parsed.data.submittedByGuestId,
    responses: parsed.data.responses,
    message: parsed.data.message ?? null,
    ipHash,
    notification: {
      recipient: env.COUPLE_NOTIFY_EMAIL,
      partyLabel: submitter.party.label,
      submitterName: `${submitter.firstName} ${submitter.lastName}`.trim(),
      answers: parsed.data.responses.map((response) => {
        const member = submitter.party.members.find((m) => m.id === response.guestId);
        return {
          name: member ? `${member.firstName} ${member.lastName}`.trim() : 'A guest',
          status: response.status,
        };
      }),
    },
  });

  if (result.outcome === 'submitted') {
    // Next.js keeps this work attached to the function lifecycle. Pending
    // delivery records survive interruption and can be retried by an admin.
    after(() => deliverRsvpSubmission(prisma, parsed.data.clientSubmissionId));
  }

  const party = await loadPartyView(prisma, submitter.partyId, now, deadline);
  return NextResponse.json({ deduped: result.outcome === 'deduped', party });
}
