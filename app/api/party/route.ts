import { NextResponse, type NextRequest } from 'next/server';
import { requireGateApi } from '@/lib/auth/require-gate';
import { loadPartyView } from '@/lib/rsvp/build-party';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reachable only via a guestId already matched through /api/guests/search —
// there is deliberately no GET /api/parties/:id (bulk enumeration risk).
export async function GET(request: NextRequest) {
  const unauthorized = await requireGateApi();
  if (unauthorized) return unauthorized;

  const guestId = request.nextUrl.searchParams.get('guestId');
  if (!guestId) {
    return NextResponse.json({ error: 'missing_guest_id' }, { status: 400 });
  }

  const guest = await prisma.guest.findFirst({
    where: { id: guestId, archivedAt: null },
    select: { partyId: true },
  });
  if (!guest) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const party = await loadPartyView(prisma, guest.partyId, new Date(), new Date(env.RSVP_DEADLINE));
  if (!party) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(party);
}
