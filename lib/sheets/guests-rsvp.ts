import 'server-only';
import type { PrismaClient } from '../../generated/prisma/client';
import { sheetsFetch } from './client';
import { withRetry } from './retry';

type SheetFetch = typeof sheetsFetch;

// After an RSVP, the guest's answer also goes into the RSVP column of their own row in the Guests
// tab, as the sheet's dropdown spells it. Part of the Sheets delivery (lib/rsvp/deliveries.ts), so
// a failure is retried with it. Writes by the API don't fire the sheet's on-edit sync script.

type AttendanceStatus = 'ATTENDING' | 'NOT_ATTENDING';

export const SHEET_RSVP_VALUE: Record<AttendanceStatus, string> = {
  ATTENDING: 'GOING',
  NOT_ATTENDING: 'NOT GOING',
};

const GUESTS_TAB = 'Guests';
const SHEET_REQUEST_TIMEOUT_MS = 8_000;

export type GuestRsvpUpdate = { externalId: string; status: AttendanceStatus };
export type CellWrite = { range: string; values: string[][] };

/** 0 → A, 11 → L, 26 → AA. */
export function columnLetter(index: number): string {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

// Pure: the header row is the first containing "guest_id" (as the sync reads it) and the column is
// the one headed "RSVP" in any case. Guests not in the sheet, or a sheet without an RSVP column,
// get nothing written.
export function planGuestRsvpCells(grid: string[][], updates: GuestRsvpUpdate[]): CellWrite[] {
  const headerIndex = grid.findIndex((row) => row.includes('guest_id'));
  if (headerIndex === -1) return [];
  const header = grid[headerIndex];
  const idColumn = header.indexOf('guest_id');
  const rsvpColumn = header.findIndex((cell) => String(cell).trim().toLowerCase() === 'rsvp');
  if (rsvpColumn === -1) return [];

  const rowById = new Map<string, number>();
  grid.forEach((row, index) => {
    const id = String(row[idColumn] ?? '').trim();
    if (index > headerIndex && id && !rowById.has(id)) rowById.set(id, index + 1);
  });

  return updates.flatMap(({ externalId, status }) => {
    const row = rowById.get(externalId);
    return row
      ? [{ range: `${GUESTS_TAB}!${columnLetter(rsvpColumn)}${row}`, values: [[SHEET_RSVP_VALUE[status]]] }]
      : [];
  });
}

async function requestSheet(fetchSheet: SheetFetch, path: string, init?: RequestInit): Promise<Response> {
  const response = await withRetry(() =>
    fetchSheet(path, { ...init, signal: AbortSignal.timeout(SHEET_REQUEST_TIMEOUT_MS) }),
  );
  if (!response.ok) throw new Error('Sheets Guests RSVP request failed');
  return response;
}

// Writes each guest's CURRENT answer (not the submission's), so a retried older delivery can never
// overwrite a newer answer.
export async function markGuestsRsvp(
  prisma: PrismaClient,
  guestIds: string[],
  fetchSheet: SheetFetch = sheetsFetch,
): Promise<void> {
  if (guestIds.length === 0) return;
  const guests = await prisma.guest.findMany({
    where: { id: { in: guestIds } },
    select: { externalId: true, current: { select: { status: true } } },
  });
  const updates = guests.flatMap((guest) =>
    guest.current ? [{ externalId: guest.externalId, status: guest.current.status }] : [],
  );
  if (updates.length === 0) return;

  const response = await requestSheet(fetchSheet, `/values/${GUESTS_TAB}`);
  const body = (await response.json()) as { values?: unknown[][] };
  const grid = (body.values ?? []).map((row) => row.map((cell) => String(cell ?? '')));
  const data = planGuestRsvpCells(grid, updates);
  if (data.length === 0) return;

  await requestSheet(fetchSheet, '/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  });
}
