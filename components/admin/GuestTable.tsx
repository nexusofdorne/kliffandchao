'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminGuestRow } from '@/lib/admin/dashboard';
import {
  EMPTY_FILTERS,
  filterGuests,
  nextSort,
  sortGuests,
  statusOf,
  type GuestColumn,
  type GuestFilters,
  type GuestSide,
  type GuestSort,
  type StatusFilter,
} from '@/lib/admin/guest-table';

type GuestTableProps = { guests: AdminGuestRow[] };

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_LABEL: Record<StatusFilter, string> = {
  ATTENDING: 'Attending',
  NOT_ATTENDING: 'Not attending',
  PENDING: 'Pending',
};

const STATUS_CLASSNAME: Record<StatusFilter, string> = {
  ATTENDING: 'bg-emerald-100 text-emerald-800',
  NOT_ATTENDING: 'bg-rose-100 text-rose-800',
  PENDING: 'bg-muted text-muted-foreground',
};

const SIDE_LABEL: Record<GuestSide, string> = { KLIFF: 'Kliff', CHAO: 'Chao', BOTH: 'Both' };

const COLUMNS: { key: GuestColumn; label: string }[] = [
  { key: 'guest', label: 'Guest' },
  { key: 'household', label: 'Household' },
  { key: 'side', label: 'Side' },
  { key: 'status', label: 'Status' },
  { key: 'answeredBy', label: 'Answered by' },
  { key: 'respondedAt', label: 'Responded' },
];

const STATUSES: StatusFilter[] = ['ATTENDING', 'NOT_ATTENDING', 'PENDING'];

const inputClass =
  'w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-normal normal-case tracking-normal text-foreground';

const chipClass = (on: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-medium ${
    on ? 'border-foreground bg-foreground text-background' : 'border-input text-foreground'
  }`;

// Spreadsheet-style: click a header to sort (again to reverse, a third time for the default
// order), a filter under each header, a search box and quick status buttons above. The
// sorting and filtering themselves are lib/admin/guest-table.ts.
export function GuestTable({ guests }: GuestTableProps) {
  const [filters, setFilters] = useState<GuestFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<GuestSort | null>(null);

  const visible = useMemo(() => sortGuests(filterGuests(guests, filters), sort), [guests, filters, sort]);
  const countByStatus = useMemo(() => {
    const counts: Record<StatusFilter, number> = { ATTENDING: 0, NOT_ATTENDING: 0, PENDING: 0 };
    guests.forEach((guest) => (counts[statusOf(guest)] += 1));
    return counts;
  }, [guests]);

  const filtering = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const set = (patch: Partial<GuestFilters>) => setFilters((previous) => ({ ...previous, ...patch }));
  const toggleStatus = (status: StatusFilter) =>
    set({
      statuses: filters.statuses.includes(status)
        ? filters.statuses.filter((s) => s !== status)
        : [...filters.statuses, status],
    });
  const sortLabel = sort && COLUMNS.find((column) => column.key === sort.column)?.label.toLowerCase();

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filters.search}
          onChange={(event) => set({ search: event.target.value })}
          placeholder="Search guest, household or answered by"
          aria-label="Search the guest list"
          className="min-w-[240px] flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
        />
        <button
          type="button"
          onClick={() => set({ statuses: [] })}
          aria-pressed={filters.statuses.length === 0}
          className={chipClass(filters.statuses.length === 0)}
        >
          All · {guests.length}
        </button>
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => toggleStatus(status)}
            aria-pressed={filters.statuses.includes(status)}
            className={chipClass(filters.statuses.includes(status))}
          >
            {STATUS_LABEL[status]} · {countByStatus[status]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {visible.length} of {guests.length} guests
          {sort ? ` · sorted by ${sortLabel}, ${sort.direction === 'asc' ? 'ascending' : 'descending'}` : ''}
        </span>
        {(filtering || sort) && (
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setSort(null);
            }}
            className="underline underline-offset-2"
          >
            Clear filters and sorting
          </button>
        )}
      </div>

      <div className="max-h-[75vh] overflow-auto rounded-lg border border-border">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              {COLUMNS.map(({ key, label }) => {
                const active = sort?.column === key;
                return (
                  <th
                    key={key}
                    className="px-3 pt-3 pb-1 font-medium"
                    aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => setSort(nextSort(sort, key))}
                      className="flex items-center gap-1 uppercase hover:text-foreground"
                      title={`Sort by ${label.toLowerCase()}`}
                    >
                      {label}
                      <span aria-hidden="true" className={active ? 'text-foreground' : 'opacity-30'}>
                        {active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr>
              <th className="px-3 pb-2">
                <input
                  className={inputClass}
                  value={filters.guest}
                  onChange={(event) => set({ guest: event.target.value })}
                  placeholder="Filter"
                  aria-label="Filter guest"
                />
              </th>
              <th className="px-3 pb-2">
                <input
                  className={inputClass}
                  value={filters.household}
                  onChange={(event) => set({ household: event.target.value })}
                  placeholder="Filter"
                  aria-label="Filter household"
                />
              </th>
              <th className="px-3 pb-2">
                <select
                  className={inputClass}
                  value={filters.sides[0] ?? ''}
                  onChange={(event) => set({ sides: event.target.value ? [event.target.value as GuestSide] : [] })}
                  aria-label="Filter side"
                >
                  <option value="">All</option>
                  {(Object.keys(SIDE_LABEL) as GuestSide[]).map((side) => (
                    <option key={side} value={side}>
                      {SIDE_LABEL[side]}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-3 pb-2">
                <select
                  className={inputClass}
                  value={filters.statuses.length === 1 ? filters.statuses[0] : filters.statuses.length ? 'SEVERAL' : ''}
                  onChange={(event) =>
                    set({ statuses: event.target.value ? [event.target.value as StatusFilter] : [] })
                  }
                  aria-label="Filter status"
                >
                  <option value="">All</option>
                  {filters.statuses.length > 1 && (
                    <option value="SEVERAL" disabled>
                      Several
                    </option>
                  )}
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-3 pb-2">
                <input
                  className={inputClass}
                  value={filters.answeredBy}
                  onChange={(event) => set({ answeredBy: event.target.value })}
                  placeholder="Filter"
                  aria-label="Filter answered by"
                />
              </th>
              <th className="px-3 pb-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((guest) => {
              const status = statusOf(guest);
              return (
                <tr key={guest.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2.5 text-foreground">{guest.displayName}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/parties/${guest.partyId}`} className="text-foreground underline underline-offset-2">
                      {guest.partyLabel}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{SIDE_LABEL[guest.side]}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSNAME[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{guest.answeredByDisplayName ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {guest.respondedAt ? DATE_FORMAT.format(guest.respondedAt) : '—'}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-muted-foreground">
                  No guests match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
