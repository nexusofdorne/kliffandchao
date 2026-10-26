import { NextResponse } from 'next/server';
import { requireGateApi } from '@/lib/auth/require-gate';
import { phoneContent } from '@/lib/phone/content';

export const dynamic = 'force-dynamic';

// The phone design's words, for a guest past the password (see lib/phone/content.ts).
export async function GET() {
  const unauthorized = await requireGateApi();
  if (unauthorized) return unauthorized;
  return NextResponse.json(phoneContent(), { headers: { 'Cache-Control': 'private, no-store' } });
}
