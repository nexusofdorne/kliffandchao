import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/require-admin';
import { upsertGuestRows } from '@/lib/guests/upsert';
import { prisma } from '@/lib/prisma';
import { sheetsFetch } from '@/lib/sheets/client';
import { parseGuestsSheetValues } from '@/lib/sheets/read-guests';
import { withRetry } from '@/lib/sheets/retry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// "Sync now" — docs/BUILD_PLAN.md "Sheet -> DB": the only place removals
// are handled, since `onEdit` (POST /api/sync) never fires on row
// deletion. Guests missing from the sheet get archivedAt set, never
// hard-deleted, so their RSVP history survives.
export async function POST() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  let response: Response;
  try {
    response = await withRetry(() => sheetsFetch('/values/Guests'));
  } catch (error) {
    // Most likely GOOGLE_SA_KEY_B64 isn't set up yet (malformed base64/JSON
    // throws before any network call ever happens) — worth a distinct
    // error from a reachable-but-rejecting Sheets API below.
    console.error('Sheets API call failed', error);
    return NextResponse.json({ error: 'sheets_misconfigured' }, { status: 502 });
  }
  if (!response.ok) {
    return NextResponse.json({ error: 'sheets_unreachable', status: response.status }, { status: 502 });
  }

  const body = (await response.json()) as { values?: string[][] };
  let parsedRows;
  try {
    parsedRows = parseGuestsSheetValues(body.values ?? []);
  } catch (error) {
    return NextResponse.json({ error: 'invalid_rows', message: (error as Error).message }, { status: 400 });
  }

  // A sheet that parsed to zero guests is almost certainly a mistake (an
  // empty range, a renamed tab) rather than the couple actually deleting
  // everyone — archiving the entire guest list on that basis would be a
  // bigger, harder-to-undo mistake than refusing to sync at all.
  if (parsedRows.guests.length === 0) {
    return NextResponse.json({ error: 'empty_sheet' }, { status: 400 });
  }

  const result = await upsertGuestRows(prisma, parsedRows);

  const sheetGuestIds = parsedRows.guests.map((guest) => guest.externalId);
  const archived = await prisma.guest.updateMany({
    where: { archivedAt: null, externalId: { notIn: sheetGuestIds } },
    data: { archivedAt: new Date() },
  });

  return NextResponse.json({ ...result, archived: archived.count });
}
