import 'server-only';
import { sheetsFetch } from './client';
import { safeCell } from './escape';
import { withRetry } from './retry';

export type RsvpMirrorInput = {
  submissionId: string;
  submittedByGuestId: string;
  partyId: string;
  responses: { guestId: string; status: 'ATTENDING' | 'NOT_ATTENDING' }[];
  message: string | null;
  ipHash: string | null;
  createdAt: Date;
};

// Pure: one row per guest response, in RSVP_Log's exact column order
// (docs/PLAN.md "Sheet layout" — timestamp_iso · submission_id ·
// submitted_by_guest_id · party_id · guest_id · status · message ·
// ip_hash). safeCell runs over every cell, not just the free-text message:
// nothing stops an id from being hand-edited into something hostile later,
// and it's a no-op on ordinary ids anyway.
export function buildRsvpLogRows(input: RsvpMirrorInput): string[][] {
  const timestampIso = input.createdAt.toISOString();
  return input.responses.map((response) =>
    [
      timestampIso,
      input.submissionId,
      input.submittedByGuestId,
      input.partyId,
      response.guestId,
      response.status,
      input.message ?? '',
      input.ipHash ?? '',
    ].map(safeCell),
  );
}

async function appendRsvpLogRows(rows: string[][]): Promise<void> {
  if (rows.length === 0) return;

  const response = await withRetry(() =>
    sheetsFetch('/values/RSVP_Log!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: rows }),
    }),
  );

  if (!response.ok) {
    throw new Error(`Sheets append failed: ${response.status} ${await response.text()}`);
  }
}

// Fire-and-forget per docs/BUILD_PLAN.md "DB -> Sheet (RSVP mirror)": the
// database write already committed — that's the source of truth — so a
// mirror failure is logged, never thrown, matching notifyCouple()'s own
// contract in lib/rsvp/notify.ts.
export async function mirrorRsvpToSheet(input: RsvpMirrorInput): Promise<void> {
  try {
    await appendRsvpLogRows(buildRsvpLogRows(input));
  } catch (error) {
    console.error('Sheets RSVP mirror failed', error);
  }
}
