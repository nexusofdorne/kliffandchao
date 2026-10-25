import 'server-only';
import { sheetsFetch } from './client';
import { safeCell } from './escape';
import { withRetry } from './retry';
import { z } from 'zod';

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

type SheetFetch = typeof sheetsFetch;
const SHEET_REQUEST_TIMEOUT_MS = 8_000;
const logValuesSchema = z.object({
  values: z.array(z.array(z.unknown())).optional(),
});

// Sorting or inserting rows breaks reserved addresses. Detect moved data
// before retrying so another submission is never intentionally overwritten.
export function isRsvpLogRangeAvailable(
  existing: unknown[][],
  planned: string[][],
  startRow: number,
): boolean {
  if (planned.length === 0) return true;
  const start = startRow - 1;
  return existing.every((row, index) => {
    const target = planned[index - start];
    const belongsToSubmission = row[1] === planned[0][1];
    if (belongsToSubmission && (!target || row[4] !== target[4])) return false;
    if (
      target &&
      row.some((cell) => cell !== '' && cell !== null && cell !== undefined)
    ) {
      return belongsToSubmission && row[4] === target[4];
    }
    return true;
  });
}

async function requestSheet(
  fetchSheet: SheetFetch,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await withRetry(() =>
    fetchSheet(path, {
      ...init,
      signal: AbortSignal.timeout(SHEET_REQUEST_TIMEOUT_MS),
    }),
  );
  if (!response.ok) throw new Error('Sheets delivery request failed');
  return response;
}

export async function readRsvpLogNextRow(
  fetchSheet: SheetFetch = sheetsFetch,
): Promise<number> {
  const response = await requestSheet(fetchSheet, '/values/RSVP_Log!A:H');
  const body = logValuesSchema.parse(await response.json());
  // Row 1 belongs to the header, including on a newly created empty tab.
  return Math.max(2, (body.values?.length ?? 0) + 1);
}

async function ensureRowCapacity(
  lastRow: number,
  fetchSheet: SheetFetch,
): Promise<void> {
  const response = await requestSheet(
    fetchSheet,
    '?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))',
  );
  const body = (await response.json()) as {
    sheets?: {
      properties: {
        sheetId: number;
        title: string;
        gridProperties: { rowCount: number };
      };
    }[];
  };
  const sheet = body.sheets?.find(
    ({ properties }) => properties.title === 'RSVP_Log',
  )?.properties;
  if (!sheet) throw new Error('RSVP log tab missing');
  if (sheet.gridProperties.rowCount >= lastRow) return;
  await requestSheet(fetchSheet, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          appendDimension: {
            sheetId: sheet.sheetId,
            dimension: 'ROWS',
            length: lastRow - sheet.gridProperties.rowCount,
          },
        },
      ],
    }),
  });
}

// The delivery record reserves this range before any write. A retry after
// a lost response overwrites the same cells, avoiding append duplicates.
export async function mirrorRsvpToSheet(
  input: RsvpMirrorInput,
  startRow: number,
  fetchSheet: SheetFetch = sheetsFetch,
): Promise<void> {
  const rows = buildRsvpLogRows(input);
  if (rows.length === 0) return;
  if (!Number.isInteger(startRow) || startRow < 2)
    throw new Error('Invalid RSVP log row');
  const lastRow = startRow + rows.length - 1;
  const current = await requestSheet(fetchSheet, '/values/RSVP_Log!A:H');
  const existing = logValuesSchema.parse(await current.json()).values ?? [];
  if (!isRsvpLogRangeAvailable(existing, rows, startRow))
    throw new Error('Reserved RSVP log rows have moved or are occupied');
  await ensureRowCapacity(lastRow, fetchSheet);
  await requestSheet(
    fetchSheet,
    `/values/RSVP_Log!A${startRow}:H${lastRow}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: rows }),
    },
  );
}
