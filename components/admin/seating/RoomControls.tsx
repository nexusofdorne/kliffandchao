'use client';

import { useState, type FormEvent } from 'react';
import type { SeatingState } from '@/lib/seating/rules';

type RoomControlsProps = {
  state: SeatingState;
  onSetRoundTables(count: number, defaultSeats: number): void;
};

const DEFAULT_SEATS = 10;
const inputClass = 'w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground';

// How many round tables the room has, and how many seats a newly added one gets. Removing tables
// takes the highest numbers first; their guests go back to not seated, after a confirm.
export function RoomControls({ state, onSetRoundTables }: RoomControlsProps) {
  const round = state.tables.filter((t) => t.kind === 'ROUND').sort((a, b) => a.number - b.number);
  const [count, setCount] = useState(String(round.length));
  const [seats, setSeats] = useState(String(DEFAULT_SEATS));

  function submit(e: FormEvent) {
    e.preventDefault();
    const nextCount = Number(count);
    const nextSeats = Number(seats);
    if (!Number.isInteger(nextCount) || nextCount < 0 || nextCount > 80) return setCount(String(round.length));
    if (!Number.isInteger(nextSeats) || nextSeats < 0 || nextSeats > 60) return setSeats(String(DEFAULT_SEATS));
    if (nextCount === round.length) return;

    const removed = new Set(round.slice(nextCount).map((t) => t.id));
    const goingBack = state.assignments.filter((a) => removed.has(a.tableId)).length;
    if (
      goingBack > 0 &&
      !window.confirm(
        `Removing ${removed.size} ${removed.size === 1 ? 'table' : 'tables'} sends ${goingBack} ${
          goingBack === 1 ? 'guest' : 'guests'
        } back to not seated. Continue?`,
      )
    ) {
      setCount(String(round.length));
      return;
    }
    onSetRoundTables(nextCount, nextSeats);
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3 text-sm">
      <label className="space-y-1">
        <span className="block text-xs text-muted-foreground">Round tables</span>
        <input type="number" min={0} max={80} value={count} onChange={(e) => setCount(e.target.value)} className={inputClass} />
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-muted-foreground">Seats per new table</span>
        <input type="number" min={0} max={60} value={seats} onChange={(e) => setSeats(e.target.value)} className={inputClass} />
      </label>
      <button type="submit" className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground">
        Set
      </button>
    </form>
  );
}
