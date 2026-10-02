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

  it('returns nothing for a sheet with only a header row', () => {
    expect(parseGuestsSheetValues([HEADER])).toEqual({ parties: [], guests: [] });
  });

  it('returns nothing for a completely empty grid', () => {
    expect(parseGuestsSheetValues([])).toEqual({ parties: [], guests: [] });
  });

  it('still throws parseGuestRows\' specific error for a missing column', () => {
    const incompleteHeader = HEADER.filter((column) => column !== 'party_id');
    const grid = [incompleteHeader, ['g01', 'Benjamin', 'Kho', '', 'Kho Family', 'KLIFF', '']];
    expect(() => parseGuestsSheetValues(grid)).toThrow(/party_id/);
  });
});
