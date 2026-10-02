import { parseGuestRows, type ParsedGuestRows } from '../guests/parse-rows';

// Not assumed to be row 1: the real Guests tab (a pre-existing guest-
// tracking template) has a dashboard summary above the real table, so the
// header is found by content instead — the first row anywhere that
// contains "guest_id" exactly. Everything above it (the dashboard) and
// every other column in the header (the template's own tracking columns —
// "Guest Name", "Invitation", "RSVP", etc.) is simply ignored:
// parseGuestRows only ever reads the specific keys it needs.
function findHeaderRowIndex(grid: string[][]): number {
  return grid.findIndex((row) => row.includes('guest_id'));
}

// Sheets API's values.get returns a plain string[][] grid, not rows keyed
// by header — this is the one step of translation needed before
// parseGuestRows can read the Guests tab the same way it already reads
// the seed CSV (lib/csv.ts's parseCsv does the identical mapping for
// text, just starting from an unsplit string instead of an already-split
// grid).
export function parseGuestsSheetValues(grid: string[][]): ParsedGuestRows {
  const headerRowIndex = findHeaderRowIndex(grid);
  if (headerRowIndex === -1) {
    throw new Error('Could not find the Guests tab\'s header row (no row contains "guest_id")');
  }

  const header = grid[headerRowIndex];
  const dataRows = grid.slice(headerRowIndex + 1);

  const records = dataRows
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));

  return parseGuestRows(records);
}
