import type { AttendanceStatus } from './stats';

// Pure sorting and filtering for the admin guest table (components/admin/GuestTable.tsx),
// spreadsheet-style: click a header to sort, a filter under each header, one search box.

export type GuestSide = 'KLIFF' | 'CHAO' | 'BOTH';

export type GuestTableRow = {
  id: string;
  displayName: string;
  partyId: string;
  partyLabel: string;
  side: GuestSide;
  status: AttendanceStatus | null;
  respondedAt: Date | null;
  answeredByDisplayName: string | null;
};

export type GuestColumn = 'guest' | 'household' | 'side' | 'status' | 'answeredBy' | 'respondedAt';
export type SortDirection = 'asc' | 'desc';
export type GuestSort = { column: GuestColumn; direction: SortDirection };

/** 'PENDING' stands for "no answer yet" (status null). */
export type StatusFilter = AttendanceStatus | 'PENDING';

export type GuestFilters = {
  /** Matches the guest, household or "answered by" name, any part, any case. */
  search: string;
  guest: string;
  household: string;
  answeredBy: string;
  /** Empty means every side. */
  sides: GuestSide[];
  /** Empty means every status. */
  statuses: StatusFilter[];
};

export const EMPTY_FILTERS: GuestFilters = {
  search: '',
  guest: '',
  household: '',
  answeredBy: '',
  sides: [],
  statuses: [],
};

export const statusOf = (row: Pick<GuestTableRow, 'status'>): StatusFilter => row.status ?? 'PENDING';

const contains = (value: string | null, needle: string) =>
  needle.trim() === '' || (value ?? '').toLowerCase().includes(needle.trim().toLowerCase());

export function filterGuests(rows: GuestTableRow[], filters: GuestFilters): GuestTableRow[] {
  return rows.filter(
    (row) =>
      (filters.search.trim() === '' ||
        [row.displayName, row.partyLabel, row.answeredByDisplayName].some((value) => contains(value, filters.search))) &&
      contains(row.displayName, filters.guest) &&
      contains(row.partyLabel, filters.household) &&
      contains(row.answeredByDisplayName, filters.answeredBy) &&
      (filters.sides.length === 0 || filters.sides.includes(row.side)) &&
      (filters.statuses.length === 0 || filters.statuses.includes(statusOf(row))),
  );
}

const STATUS_ORDER: Record<StatusFilter, number> = { ATTENDING: 0, NOT_ATTENDING: 1, PENDING: 2 };
const SIDE_ORDER: Record<GuestSide, number> = { KLIFF: 0, CHAO: 1, BOTH: 2 };
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function compareBy(column: GuestColumn, a: GuestTableRow, b: GuestTableRow): number {
  switch (column) {
    case 'guest':
      return collator.compare(a.displayName, b.displayName);
    case 'household':
      return collator.compare(a.partyLabel, b.partyLabel);
    case 'side':
      return SIDE_ORDER[a.side] - SIDE_ORDER[b.side];
    case 'status':
      return STATUS_ORDER[statusOf(a)] - STATUS_ORDER[statusOf(b)];
    case 'answeredBy':
      return collator.compare(a.answeredByDisplayName ?? '', b.answeredByDisplayName ?? '');
    case 'respondedAt':
      return (a.respondedAt?.getTime() ?? 0) - (b.respondedAt?.getTime() ?? 0);
  }
}

// Blanks (no answer, no date, nobody answered) go last whichever way the column is sorted, as in
// a spreadsheet; ties keep households together, then names in order.
function isBlank(column: GuestColumn, row: GuestTableRow): boolean {
  if (column === 'answeredBy') return row.answeredByDisplayName == null;
  if (column === 'respondedAt') return row.respondedAt == null;
  return false;
}

export function sortGuests(rows: GuestTableRow[], sort: GuestSort | null): GuestTableRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sort) {
      const blankA = isBlank(sort.column, a);
      const blankB = isBlank(sort.column, b);
      if (blankA !== blankB) return blankA ? 1 : -1;
      const order = compareBy(sort.column, a, b);
      if (order !== 0) return sort.direction === 'asc' ? order : -order;
    }
    return compareBy('household', a, b) || compareBy('guest', a, b);
  });
  return sorted;
}

/** Click a header: sort by it ascending, then descending, then back to the default order. */
export function nextSort(current: GuestSort | null, column: GuestColumn): GuestSort | null {
  if (current?.column !== column) return { column, direction: 'asc' };
  return current.direction === 'asc' ? { column, direction: 'desc' } : null;
}
