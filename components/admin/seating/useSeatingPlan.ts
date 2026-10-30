'use client';

import { useRef, useState } from 'react';
import {
  autoFillVipSeats,
  moveCenter as moveCenterAction,
  moveGuests,
  moveTable as moveTableAction,
  renameTable,
  setRoundTables,
  setSeats,
  type SeatingActionResult,
} from '@/app/admin/seating/actions';
import { clampToRoom, nextRoundTablePosition, type Point } from '@/lib/seating/geometry';
import {
  applyMove,
  autoFillVip,
  defaultTableName,
  setRoundTableCount,
  setTableSeats,
  type Move,
  type SeatableGuest,
  type SeatingState,
} from '@/lib/seating/rules';

export type Plan = { state: SeatingState; guests: SeatableGuest[] };

const MAX_NAME_LENGTH = 40;
const FAILED_MESSAGE = "Couldn't save that change. Reload the page and try again.";

// The plan on the page: each change is applied at once with lib/seating/rules (optimistic), then
// sent to the server, whose answer replaces it (on a conflict, the latest plan; on a refusal, the
// last saved one). Only the newest request's answer is shown, so an answer to an earlier change
// can't briefly undo a later one still on its way.
export function useSeatingPlan(initial: Plan) {
  const [plan, setPlanState] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  // VIPs the last auto-fill run couldn't fit (the action only reports how many).
  const [notFitted, setNotFitted] = useState<ReadonlySet<string>>(new Set());
  // Read by event handlers, which can run after a render they didn't see.
  const current = useRef(initial);
  const saved = useRef(initial);
  const latestRequest = useRef(0);

  function setPlan(next: Plan) {
    current.current = next;
    setPlanState(next);
  }

  async function commit(optimistic: SeatingState | null, call: () => Promise<SeatingActionResult>) {
    if (optimistic) setPlan({ ...current.current, state: optimistic });
    const request = ++latestRequest.current;
    let result: SeatingActionResult;
    try {
      result = await call();
    } catch {
      if (request !== latestRequest.current) return;
      setPlan(saved.current);
      setMessage(FAILED_MESSAGE);
      return;
    }
    // Server actions run one at a time, so every answer is at least as new as the last.
    if (result.state && result.guests) saved.current = { state: result.state, guests: result.guests };
    if (request !== latestRequest.current) return;
    setPlan(saved.current);
    if (result.message) setMessage(result.message);
  }

  const state = () => current.current.state;

  return {
    plan,
    message,
    notFitted,
    dismissMessage: () => setMessage(null),

    move(move: Move) {
      const result = applyMove(state(), move);
      return commit(result.error ? null : result.state, () => moveGuests(move));
    },

    autoFill() {
      const result = autoFillVip(state(), current.current.guests);
      setNotFitted(new Set(result.notSeated));
      return commit(result.state, () => autoFillVipSeats());
    },

    setSeats(tableId: string, seats: number) {
      return commit(setTableSeats(state(), tableId, seats).state, () => setSeats(tableId, seats));
    },

    setRoundTables(count: number, defaultSeats: number) {
      const center = state().center;
      const next = setRoundTableCount(
        state(),
        count,
        defaultSeats,
        () => crypto.randomUUID(),
        (tables) =>
          nextRoundTablePosition(
            tables.filter((t) => t.kind === 'ROUND' && t.x != null).map((t) => ({ x: t.x!, y: t.y! })),
            center,
          ),
      );
      return commit(next.state, () => setRoundTables(count, defaultSeats));
    },

    rename(tableId: string, name: string) {
      const trimmed = name.trim().slice(0, MAX_NAME_LENGTH).trim();
      const s = state();
      const tables = s.tables.map((t) =>
        t.id === tableId ? { ...t, name: trimmed || defaultTableName(t.kind, t.number) } : t,
      );
      return commit({ ...s, tables }, () => renameTable(tableId, name));
    },

    moveTable(tableId: string, to: Point) {
      const at = clampToRoom(to);
      const s = state();
      const tables = s.tables.map((t) => (t.id === tableId ? { ...t, x: at.x, y: at.y } : t));
      return commit({ ...s, tables }, () => moveTableAction(tableId, at.x, at.y));
    },

    moveCenter(to: Point) {
      const at = clampToRoom(to);
      return commit({ ...state(), center: at }, () => moveCenterAction(at.x, at.y));
    },
  };
}
