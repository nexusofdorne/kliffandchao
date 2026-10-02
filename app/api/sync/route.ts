import { NextResponse } from 'next/server';
import { parseGuestRows } from '@/lib/guests/parse-rows';
import { upsertGuestRows } from '@/lib/guests/upsert';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { syncRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The Apps Script installable trigger's only authorization — docs/
// BUILD_PLAN.md "Sheet -> DB": it posts the edited row(s) here with this
// header on every edit to the Guests tab. Not reachable by a guest or
// admin session at all; `onEdit` never fires on row deletion, so removals
// are handled separately by POST /api/admin/sync's full pull instead.
export async function POST(request: Request) {
  if (request.headers.get('x-sync-secret') !== env.SYNC_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  let parsedRows;
  try {
    parsedRows = parseGuestRows(parsed.data.rows);
  } catch (error) {
    return NextResponse.json({ error: 'invalid_rows', message: (error as Error).message }, { status: 400 });
  }

  const result = await upsertGuestRows(prisma, parsedRows);
  return NextResponse.json(result);
}
