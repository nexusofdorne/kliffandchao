import { NextResponse } from 'next/server';
import { requireGateApi } from '@/lib/auth/require-gate';

// Stub for Phase 3 (GET /api/party?guestId= → Party + current answers).
// Exists now so Phase 2's requireGate() enforcement has a real gated API
// route to verify against — see docs/PLAN.md Verification 3.
export async function GET() {
  const unauthorized = await requireGateApi();
  if (unauthorized) return unauthorized;

  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
