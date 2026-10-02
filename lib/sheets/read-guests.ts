import { parseGuestRows, type ParsedGuestRows } from '../guests/parse-rows';

// Sheets API's values.get returns a plain string[][] grid, not rows keyed
// by header — this is the one step of translation needed before
// parseGuestRows can read the Guests tab the same way it already reads
// the seed CSV (lib/csv.ts's parseCsv does the identical mapping for
// text, just starting from an unsplit string instead of an already-split
// grid).
export function parseGuestsSheetValues(grid: string[][]): ParsedGuestRows {
  const [header, ...dataRows] = grid;
  if (!header) return { parties: [], guests: [] };

  const records = dataRows
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));

  return parseGuestRows(records);
}
