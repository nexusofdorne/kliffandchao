import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, filterGuests, nextSort, sortGuests, type GuestTableRow } from './guest-table';

const row = (over: Partial<GuestTableRow> & { id: string }): GuestTableRow => ({
  displayName: 'Guest',
  partyId: 'p',
  partyLabel: 'Household',
  side: 'BOTH',
  status: null,
  respondedAt: null,
  answeredByDisplayName: null,
  ...over,
});

const rows: GuestTableRow[] = [
  row({ id: 'a', displayName: 'Ana Cruz', partyLabel: 'Cruz Family', side: 'CHAO', status: 'ATTENDING', respondedAt: new Date('2027-01-03'), answeredByDisplayName: 'Ana Cruz' }),
  row({ id: 'b', displayName: 'Ben Cruz', partyLabel: 'Cruz Family', side: 'CHAO', status: 'NOT_ATTENDING', respondedAt: new Date('2027-01-03'), answeredByDisplayName: 'Ana Cruz' }),
  row({ id: 'c', displayName: 'Carl Dee', partyLabel: 'Dee', side: 'KLIFF' }),
  row({ id: 'd', displayName: 'Dina Abad', partyLabel: 'Abad Family', side: 'KLIFF', status: 'ATTENDING', respondedAt: new Date('2027-01-01'), answeredByDisplayName: 'Dina Abad' }),
];
const ids = (list: GuestTableRow[]) => list.map((r) => r.id);

describe('filterGuests', () => {
  it('keeps everything with no filters', () => {
    expect(ids(filterGuests(rows, EMPTY_FILTERS))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('filters by status, with pending meaning no answer yet', () => {
    expect(ids(filterGuests(rows, { ...EMPTY_FILTERS, statuses: ['ATTENDING'] }))).toEqual(['a', 'd']);
    expect(ids(filterGuests(rows, { ...EMPTY_FILTERS, statuses: ['PENDING'] }))).toEqual(['c']);
    expect(ids(filterGuests(rows, { ...EMPTY_FILTERS, statuses: ['NOT_ATTENDING', 'PENDING'] }))).toEqual(['b', 'c']);
  });

  it('matches text in any case and any part of the cell', () => {
    expect(ids(filterGuests(rows, { ...EMPTY_FILTERS, household: 'cruz' }))).toEqual(['a', 'b']);
    expect(ids(filterGuests(rows, { ...EMPTY_FILTERS, search: 'ABAD' }))).toEqual(['d']);
    expect(ids(filterGuests(rows, { ...EMPTY_FILTERS, answeredBy: 'ana' }))).toEqual(['a', 'b']);
  });

  it('combines filters', () => {
    expect(ids(filterGuests(rows, { ...EMPTY_FILTERS, sides: ['KLIFF'], statuses: ['ATTENDING'] }))).toEqual(['d']);
  });
});

describe('sortGuests', () => {
  it('defaults to household, then name', () => {
    expect(ids(sortGuests(rows, null))).toEqual(['d', 'a', 'b', 'c']);
  });

  it('sorts both ways', () => {
    expect(ids(sortGuests(rows, { column: 'guest', direction: 'asc' }))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(sortGuests(rows, { column: 'guest', direction: 'desc' }))).toEqual(['d', 'c', 'b', 'a']);
  });

  it('keeps blanks last in either direction', () => {
    expect(ids(sortGuests(rows, { column: 'respondedAt', direction: 'asc' })).at(-1)).toBe('c');
    expect(ids(sortGuests(rows, { column: 'respondedAt', direction: 'desc' })).at(-1)).toBe('c');
    expect(ids(sortGuests(rows, { column: 'respondedAt', direction: 'desc' })).slice(0, 2)).toEqual(['a', 'b']);
  });

  it('orders statuses attending, not attending, pending', () => {
    expect(ids(sortGuests(rows, { column: 'status', direction: 'asc' }))).toEqual(['d', 'a', 'b', 'c']);
  });
});

describe('nextSort', () => {
  it('cycles ascending, descending, off', () => {
    const first = nextSort(null, 'guest');
    expect(first).toEqual({ column: 'guest', direction: 'asc' });
    const second = nextSort(first, 'guest');
    expect(second).toEqual({ column: 'guest', direction: 'desc' });
    expect(nextSort(second, 'guest')).toBeNull();
    expect(nextSort(second, 'household')).toEqual({ column: 'household', direction: 'asc' });
  });
});
