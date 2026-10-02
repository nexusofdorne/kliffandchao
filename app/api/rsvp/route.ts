import { NextResponse } from 'next/server';
import { requireGateApi } from '@/lib/auth/require-gate';
import { loadPartyView } from '@/lib/rsvp/build-party';
import { notifyCouple } from '@/lib/rsvp/notify';
import { findGuestOutsideParty, hashIp, hasDuplicateGuestIds, isPastDeadline } from '@/lib/rsvp/rules';
import { submitRsvp } from '@/lib/rsvp/submit';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { mirrorRsvpToSheet } from '@/lib/sheets/mirror';
import { rsvpRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const deadline = new Date(env.RSVP_DEADLINE);
  const now = new Date();
  if (isPastDeadline(now, deadline)) {
    return NextResponse.json({ error: 'deadline_passed' }, { status: 409 });
  }

  const submitter = await prisma.guest.findFirst({
    where: { id: parsed.data.submittedByGuestId, archivedAt: null },
    select: { partyId: true, party: { select: { label: true, members: { select: { id: true } } } } },
  });
  if (!submitter) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const partyMemberIds = new Set(submitter.party.members.map((member) => member.id));
  const outsideGuestId = findGuestOutsideParty(parsed.data.responses, partyMemberIds);
  if (outsideGuestId) {
    return NextResponse.json({ error: 'outside_party' }, { status: 403 });
  }

  if (hasDuplicateGuestIds(parsed.data.responses)) {
    return NextResponse.json({ error: 'duplicate_guest_id' }, { status: 400 });
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  const ipHash = forwardedFor ? hashIp(forwardedFor.split(',')[0].trim(), env.IP_HASH_SALT) : null;

  const result = await submitRsvp(prisma, {
    clientSubmissionId: parsed.data.clientSubmissionId,
    partyId: submitter.partyId,
    submittedByGuestId: parsed.data.submittedByGuestId,
    responses: parsed.data.responses,
    message: parsed.data.message ?? null,
    ipHash,
  });

  if (result.outcome === 'submitted') {
    // Fire-and-forget: a notification/mirror failure must never fail the
    // RSVP — the database write above already committed, that's the
    // source of truth.
    void notifyCouple(submitter.party.label, parsed.data.message ?? null);
    void mirrorRsvpToSheet({
      submissionId: parsed.data.clientSubmissionId,
      submittedByGuestId: parsed.data.submittedByGuestId,
      partyId: submitter.partyId,
      responses: parsed.data.responses,
      message: parsed.data.message ?? null,
      ipHash,
      createdAt: now,
    });
  }

  const party = await loadPartyView(prisma, submitter.partyId, now, deadline);
  return NextResponse.json({ deduped: result.outcome === 'deduped', party });
}
