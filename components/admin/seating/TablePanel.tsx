'use client';

import { useState, type KeyboardEvent } from 'react';
import type { Assignment, SeatableGuest, SeatingTable } from '@/lib/seating/rules';

type TablePanelProps = {
  table: SeatingTable;
  seated: Assignment[];
  guestsById: Map<string, SeatableGuest>;
  onRename(name: string): void;
  onSeats(seats: number): void;
  onRemove(guestId: string): void;
  onClose(): void;
};

const inputClass = 'rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground';

function blurOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur();
}

// The clicked table: its name, its number of seats, and who sits where. Keyed by table id and
// saved values by the caller, so the inputs reset when the table or the saved plan changes.
export function TablePanel({ table, seated, guestsById, onRename, onSeats, onRemove, onClose }: TablePanelProps) {
  const [name, setName] = useState(table.name);
  const [seats, setSeats] = useState(String(table.seats));
  const bySeat = [...seated].sort((a, b) => a.seat - b.seat);

  function saveName() {
    if (name.trim() !== table.name) onRename(name);
  }

  function saveSeats() {
    const next = Number(seats);
    if (!Number.isInteger(next) || next < 0 || next > 60) {
      setSeats(String(table.seats));
      return;
    }
    if (next === table.seats) return;
    const goingBack = seated.filter((a) => a.seat > next).length;
    if (
      goingBack > 0 &&
      !window.confirm(
        `${goingBack} ${goingBack === 1 ? 'guest goes' : 'guests go'} back to not seated. Change ${table.name} to ${next} seats?`,
      )
    ) {
      setSeats(String(table.seats));
      return;
    }
    onSeats(next);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs tracking-wide text-muted-foreground uppercase">
          {table.kind === 'VIP' ? 'VIP table' : `Table ${table.number}`}
        </div>
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground underline">
          Close
        </button>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Name</span>
        <input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={blurOnEnter}
          className={`${inputClass} w-full`}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Seats</span>
        <input
          type="number"
          min={0}
          max={60}
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          onBlur={saveSeats}
          onKeyDown={blurOnEnter}
          className={`${inputClass} w-24`}
        />
      </label>
      <div>
        <div className="mb-1 text-xs text-muted-foreground">
          Guests · {seated.length}/{table.seats}
        </div>
        {bySeat.length === 0 ? (
          <p className="text-xs text-muted-foreground">No one yet. Drag names onto the table.</p>
        ) : (
          <ul className="space-y-0.5">
            {bySeat.map((a) => {
              const guest = guestsById.get(a.guestId);
              return (
                <li key={a.guestId} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">
                    <span className="inline-block w-6 text-muted-foreground">{a.seat}</span>
                    {guest ? `${guest.firstName} ${guest.lastName}` : 'Guest'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(a.guestId)}
                    className="rounded-md border border-input px-2 py-0.5 text-xs text-foreground"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
