import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { columnLetter, planGuestRsvpCells, SHEET_RSVP_VALUE } = await import('./guests-rsvp');

// The real Guests tab: a dashboard above the table, the template's own columns around ours.
const grid = [
  ['Kliff & Chao — Guest List'],
  [],
  ['', '#', 'Guest Name', 'Invitation', 'guest_id', 'first_name', 'last_name', 'nickname', 'party_id', 'party_label', 'side', 'RSVP', 'Category'],
  ['', '1', 'Ana Cruz', 'Sent', 'g01', 'Ana', 'Cruz', '', 'p01', 'Cruz Family', 'CHAO', '', 'Family'],
  ['', '2', 'Ben Cruz', 'Sent', 'g02', 'Ben', 'Cruz', '', 'p01', 'Cruz Family', 'CHAO', 'GOING', 'Family'],
  ['', '3', 'Carl Dee', 'Sent', 'g03', 'Carl', 'Dee', '', 'p02', 'Dee', 'KLIFF'],
];

describe('SHEET_RSVP_VALUE', () => {
  it('uses the sheet dropdown values', () => {
    expect(SHEET_RSVP_VALUE.ATTENDING).toBe('GOING');
    expect(SHEET_RSVP_VALUE.NOT_ATTENDING).toBe('NOT GOING');
  });
});

describe('columnLetter', () => {
  it('turns a 0-based column index into its letters', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(11)).toBe('L');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLetter(27)).toBe('AB');
  });
});

describe('planGuestRsvpCells', () => {
  it("writes each guest's answer into the RSVP column of their own row", () => {
    expect(
      planGuestRsvpCells(grid, [
        { externalId: 'g01', status: 'ATTENDING' },
        { externalId: 'g03', status: 'NOT_ATTENDING' },
      ]),
    ).toEqual([
      { range: 'Guests!L4', values: [['GOING']] },
      { range: 'Guests!L6', values: [['NOT GOING']] },
    ]);
  });

  it('finds the RSVP header in any case and spacing, wherever the column is', () => {
    const moved = grid.map((row, i) => (i === 2 ? row.map((cell) => (cell === 'RSVP' ? ' rsvp ' : cell)) : row));
    expect(planGuestRsvpCells(moved, [{ externalId: 'g02', status: 'NOT_ATTENDING' }])).toEqual([
      { range: 'Guests!L5', values: [['NOT GOING']] },
    ]);
  });

  it('skips guests no longer in the sheet', () => {
    expect(planGuestRsvpCells(grid, [{ externalId: 'g99', status: 'ATTENDING' }])).toEqual([]);
  });

  it('writes nothing when the sheet has no RSVP column or no header row', () => {
    const noRsvp = grid.map((row) => row.filter((cell) => cell !== 'RSVP'));
    expect(planGuestRsvpCells(noRsvp, [{ externalId: 'g01', status: 'ATTENDING' }])).toEqual([]);
    expect(planGuestRsvpCells([['nothing here']], [{ externalId: 'g01', status: 'ATTENDING' }])).toEqual([]);
  });
});
