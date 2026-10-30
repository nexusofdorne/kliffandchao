'use client';

import { useMemo, useState, type PointerEvent } from 'react';
import { isVipRole } from '@/lib/seating/roles';
import type { SeatableGuest } from '@/lib/seating/rules';

type UnseatedListProps = {
  guests: SeatableGuest[]; // attending and not seated, in household order
  notFitted: ReadonlySet<string>;
  onPointerDownGuest(guest: SeatableGuest, e: PointerEvent): void;
  onPointerDownHousehold(members: SeatableGuest[], e: PointerEvent): void;
};

type Household = { partyId: string; label: string; members: SeatableGuest[] };

const badgeClass = 'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium';

function matches(guest: SeatableGuest, query: string): boolean {
  if (!query) return true;
  return `${guest.firstName} ${guest.lastName} ${guest.partyLabel}`.toLowerCase().includes(query);
}

// The left column: everyone attending without a chair, by household. A name drags one guest;
// the household header drags everyone listed under it. Dropping a seated guest here unseats them.
export function UnseatedList({ guests, notFitted, onPointerDownGuest, onPointerDownHousehold }: UnseatedListProps) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  const households = useMemo(() => {
    const byParty = new Map<string, Household>();
    for (const guest of guests) {
      if (!matches(guest, query)) continue;
      const household = byParty.get(guest.partyId) ?? { partyId: guest.partyId, label: guest.partyLabel, members: [] };
      household.members.push(guest);
      byParty.set(guest.partyId, household);
    }
    return [...byParty.values()];
  }, [guests, query]);

  return (
    <div data-drop-unseat="" className="flex h-full flex-col gap-2 rounded-lg border border-border p-3">
      <div className="text-xs tracking-wide text-muted-foreground uppercase">Not seated · {guests.length}</div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search names"
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
      />
      <div className="max-h-[70vh] space-y-2 overflow-y-auto">
        {households.map((household) => (
          <div key={household.partyId} className="rounded-md border border-input text-sm">
            <div
              className="cursor-grab border-b border-input px-2 py-1 font-medium text-foreground select-none"
              style={{ touchAction: 'none' }}
              title="Drag to seat the whole household"
              onPointerDown={(e) => onPointerDownHousehold(household.members, e)}
            >
              {household.label} <span className="font-normal text-muted-foreground">· {household.members.length}</span>
            </div>
            <ul className="px-2 py-1">
              {household.members.map((guest) => (
                <li
                  key={guest.id}
                  className="cursor-grab py-0.5 text-foreground select-none"
                  style={{ touchAction: 'none' }}
                  onPointerDown={(e) => onPointerDownGuest(guest, e)}
                >
                  {guest.firstName} {guest.lastName}
                  {notFitted.has(guest.id) ? (
                    <span className={`${badgeClass} bg-rose-100 text-rose-800`}>VIP not seated</span>
                  ) : isVipRole(guest.role) ? (
                    <span className={`${badgeClass} bg-amber-100 text-amber-800`}>VIP</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {households.length === 0 && (
          <p className="text-xs text-muted-foreground">{guests.length === 0 ? 'Everyone is seated.' : 'No matches.'}</p>
        )}
      </div>
    </div>
  );
}
