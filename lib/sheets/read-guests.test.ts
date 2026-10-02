import { describe, expect, it } from 'vitest';
import { parseGuestsSheetValues } from './read-guests';

const HEADER = ['guest_id', 'first_name', 'last_name', 'nickname', 'party_id', 'party_label', 'side', 'notes_private'];

describe('parseGuestsSheetValues', () => {
  it('maps a grid to guests and their parties by header name', () => {
    const grid = [HEADER, ['g01', 'Benjamin', 'Kho', '', 'p01', 'Kho Family', 'KLIFF', '']];
    const result = parseGuestsSheetValues(grid);
    expect(result.parties).toEqual([{ externalId: 'p01', label: 'Kho Family' }]);
    expect(result.guests).toMatchObject([{ externalId: 'g01', firstName: 'Benjamin', lastName: 'Kho' }]);
  });

  it('skips fully blank rows (a common artifact of a sheet with trailing empty rows)', () => {
    const grid = [HEADER, ['g01', 'Benjamin', 'Kho', '', 'p01', 'Kho Family', 'KLIFF', ''], ['', '', '', '', '', '', '', '']];
    expect(parseGuestsSheetValues(grid).guests).toHaveLength(1);
  });

  it('finds the header row below an arbitrary number of unrelated rows (a dashboard summary above the real table)', () => {
    const grid = [
      [],
      ['', '', 'Guest List', '', '', 'GUESTS BREAKDOWN'],
      ['', '', 'Total No. of Guests', '216'],
      [],
      ['', '#', 'Guest Name', 'Invitation', 'guest_id', 'party_id', 'party_label', 'first_name', 'last_name', 'nickname', 'side', 'notes_private'],
      ['', '1', 'Fiel Bulawin', 'Both', 'G001', 'P001', 'Bulawin Family', 'Fiel', 'Bulawin', '', 'CHAO', ''],
    ];
    const result = parseGuestsSheetValues(grid);
    expect(result.parties).toEqual([{ externalId: 'P001', label: 'Bulawin Family' }]);
    expect(result.guests).toMatchObject([{ externalId: 'G001', firstName: 'Fiel', lastName: 'Bulawin', side: 'CHAO' }]);
  });

  it('ignores extra columns in the header that parseGuestRows never asked for', () => {
    const grid = [
      ['#', 'Guest Name', ...HEADER, 'RSVP', 'Category'],
      ['1', 'Benjamin Kho', 'g01', 'Benjamin', 'Kho', '', 'p01', 'Kho Family', 'KLIFF', '', 'Yes', 'Family'],
    ];
    expect(parseGuestsSheetValues(grid).guests).toMatchObject([{ externalId: 'g01' }]);
  });

  it('throws a specific error when no row contains "guest_id" at all', () => {
    const grid = [['#', 'Guest Name', 'Invitation'], ['1', 'Someone', 'Both']];
    expect(() => parseGuestsSheetValues(grid)).toThrow(/guest_id/);
  });

  it('returns nothing for a sheet with only a header row', () => {
    expect(parseGuestsSheetValues([HEADER])).toEqual({ parties: [], guests: [] });
  });

  it('still throws parseGuestRows\' specific error for a missing required column', () => {
    const incompleteHeader = HEADER.filter((column) => column !== 'party_id');
    const grid = [incompleteHeader, ['g01', 'Benjamin', 'Kho', '', 'Kho Family', 'KLIFF', '']];
    expect(() => parseGuestsSheetValues(grid)).toThrow(/party_id/);
  });
});
