const REQUIRED_HEADERS = [
  'guest_id',
  'first_name',
  'last_name',
  'nickname',
  'party_id',
  'party_label',
  'side',
  'notes_private',
] as const;

const SIDES = ['KLIFF', 'CHAO', 'BOTH'] as const;
type GuestSide = (typeof SIDES)[number];

export type PartySeed = {
  externalId: string;
  label: string;
};

export type GuestSeed = {
  externalId: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  side: GuestSide;
  notesPrivate: string | null;
  partyExternalId: string;
};

export type ParsedGuestRows = {
  parties: PartySeed[];
  guests: GuestSeed[];
};

// Shared by the seed script and the future Sheets sync route (BUILD_PLAN.md
// "Map columns by header name; reject with a specific error if a header is
// missing") so both read the Guests tab's columns the same way.
export function parseGuestRows(rows: Record<string, string>[]): ParsedGuestRows {
  if (rows.length === 0) {
    return { parties: [], guests: [] };
  }

  const headers = Object.keys(rows[0] ?? {});
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new Error(`Missing required column "${required}" in guest data`);
    }
  }

  const partiesByExternalId = new Map<string, PartySeed>();
  const guests: GuestSeed[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2; // 1-based + header row

    const side = row.side.trim().toUpperCase();
    if (!SIDES.includes(side as GuestSide)) {
      throw new Error(`Row ${rowNumber}: invalid side "${row.side}" (expected KLIFF, CHAO or BOTH)`);
    }

    const partyExternalId = requireField(row, 'party_id', rowNumber);
    if (!partiesByExternalId.has(partyExternalId)) {
      partiesByExternalId.set(partyExternalId, {
        externalId: partyExternalId,
        label: requireField(row, 'party_label', rowNumber),
      });
    }

    guests.push({
      externalId: requireField(row, 'guest_id', rowNumber),
      firstName: requireField(row, 'first_name', rowNumber),
      lastName: requireField(row, 'last_name', rowNumber),
      nickname: emptyToNull(row.nickname),
      side: side as GuestSide,
      notesPrivate: emptyToNull(row.notes_private),
      partyExternalId,
    });
  }

  return { parties: [...partiesByExternalId.values()], guests };
}

function requireField(row: Record<string, string>, field: string, rowNumber: number): string {
  const value = row[field]?.trim();
  if (!value) {
    throw new Error(`Row ${rowNumber}: missing required value for "${field}"`);
  }
  return value;
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
