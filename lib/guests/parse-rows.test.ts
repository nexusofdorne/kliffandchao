import { describe, expect, it } from 'vitest';
import { parseGuestRows } from './parse-rows';

const baseRow = {
  guest_id: 'g01',
  first_name: 'Benjamin',
  last_name: 'Kho',
  nickname: '',
  party_id: 'p01',
  party_label: 'Kho Family',
  side: 'KLIFF',
  notes_private: '',
};

describe('parseGuestRows', () => {
  it('returns empty arrays for no rows', () => {
    expect(parseGuestRows([])).toEqual({ parties: [], guests: [] });
  });

  it('builds one party per distinct party_id and one guest per row', () => {
    const result = parseGuestRows([
      baseRow,
      { ...baseRow, guest_id: 'g02', first_name: 'Imelda' },
      { ...baseRow, guest_id: 'g03', party_id: 'p02', party_label: 'Chao Family', side: 'CHAO' },
    ]);
    expect(result.parties).toEqual([
      { externalId: 'p01', label: 'Kho Family' },
      { externalId: 'p02', label: 'Chao Family' },
    ]);
    expect(result.guests).toHaveLength(3);
  });

  it('maps a blank nickname/notes to null, and a filled one through', () => {
    const result = parseGuestRows([{ ...baseRow, nickname: 'Benjie', notes_private: 'Vegetarian' }]);
    expect(result.guests[0]).toMatchObject({ nickname: 'Benjie', notesPrivate: 'Vegetarian' });

    const blank = parseGuestRows([baseRow]);
    expect(blank.guests[0]).toMatchObject({ nickname: null, notesPrivate: null });
  });

  it('normalizes a lowercase side to its uppercase enum value', () => {
    const result = parseGuestRows([{ ...baseRow, side: 'kliff' }]);
    expect(result.guests[0]?.side).toBe('KLIFF');
  });

  it('rejects an invalid side', () => {
    expect(() => parseGuestRows([{ ...baseRow, side: 'GROOM' }])).toThrow(/invalid side/i);
  });

  it('rejects a missing required column', () => {
    const rest: Partial<typeof baseRow> = { ...baseRow };
    delete rest.side;
    expect(() => parseGuestRows([rest as Record<string, string>])).toThrow(/missing required column/i);
  });

  it('rejects a row with a blank required value', () => {
    expect(() => parseGuestRows([{ ...baseRow, first_name: '' }])).toThrow(/row 2/i);
  });
});
