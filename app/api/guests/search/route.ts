import { NextResponse, type NextRequest } from 'next/server';
import { requireGateApi } from '@/lib/auth/require-gate';
import { prisma } from '@/lib/prisma';
import { searchGuests } from '@/lib/search/match';

const MIN_QUERY_LENGTH = 2;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = await requireGateApi();
  if (unauthorized) return unauthorized;

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ error: 'query_too_short' }, { status: 400 });
  }

  const results = await searchGuests(prisma, query);
  return NextResponse.json(results);
}
