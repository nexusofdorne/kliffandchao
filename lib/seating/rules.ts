import { vipRoleOf } from './roles';

export type TableKind = 'ROUND' | 'VIP';

// VIP tables are number 1 or 2 with x/y null: they sit on the ring around the room's center.
export type SeatingTable = {
  id: string;
  kind: TableKind;
  number: number;
  name: string;
  seats: number;
  x: number | null;
  y: number | null;
};

export type Assignment = { guestId: string; tableId: string; seat: number };

export type SeatableGuest = {
  id: string;
  partyId: string;
  partyLabel: string;
  firstName: string;
  lastName: string;
  side: 'KLIFF' | 'CHAO' | 'BOTH';
  role: string | null;
};

export type SeatingState = {
  center: { x: number; y: number };
  tables: SeatingTable[];
  assignments: Assignment[];
};

export type Move =
  | { kind: 'seat'; guestId: string; tableId: string; seat?: number } // seat omitted = first free chair
  | { kind: 'household'; guestIds: string[]; tableId: string }
  | { kind: 'unseat'; guestId: string };

export type MoveResult = {
  state: SeatingState;
  bumped: string[];
  notSeated: string[];
  error?: 'TABLE_FULL' | 'UNKNOWN_TABLE' | 'BAD_SEAT';
};

const MAX_SEATS = 60;
const MAX_ROUND_TABLES = 80;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function defaultTableName(kind: TableKind, number: number): string {
  return kind === 'VIP' ? `VIP ${number}` : `Table ${number}`;
}

function findTable(state: SeatingState, tableId: string): SeatingTable | undefined {
  return state.tables.find((t) => t.id === tableId);
}

function takenSeats(state: SeatingState, tableId: string): Set<number> {
  return new Set(state.assignments.filter((a) => a.tableId === tableId).map((a) => a.seat));
}

function freeSeats(state: SeatingState, table: SeatingTable): number[] {
  const taken = takenSeats(state, table.id);
  const free: number[] = [];
  for (let seat = 1; seat <= table.seats; seat++) if (!taken.has(seat)) free.push(seat);
  return free;
}

export function firstFreeSeat(state: SeatingState, tableId: string): number | null {
  const table = findTable(state, tableId);
  if (!table) return null;
  return freeSeats(state, table)[0] ?? null;
}

function unchanged(state: SeatingState, error?: MoveResult['error']): MoveResult {
  return { state, bumped: [], notSeated: [], ...(error ? { error } : {}) };
}

function withAssignments(state: SeatingState, assignments: Assignment[]): SeatingState {
  return { ...state, assignments };
}

function seatGuest(state: SeatingState, move: Extract<Move, { kind: 'seat' }>): MoveResult {
  const table = findTable(state, move.tableId);
  if (!table) return unchanged(state, 'UNKNOWN_TABLE');

  const current = state.assignments.find((a) => a.guestId === move.guestId);
  let seat: number;
  if (move.seat === undefined) {
    // Dropped on the table as a whole: a guest already there stays put.
    if (current?.tableId === table.id) return unchanged(state);
    const free = firstFreeSeat(state, table.id);
    if (free === null) return unchanged(state, 'TABLE_FULL');
    seat = free;
  } else {
    if (!Number.isInteger(move.seat) || move.seat < 1 || move.seat > table.seats) return unchanged(state, 'BAD_SEAT');
    seat = move.seat;
  }

  if (current && current.tableId === table.id && current.seat === seat) return unchanged(state);

  const occupant = state.assignments.find((a) => a.tableId === table.id && a.seat === seat);
  const bumped: string[] = [];
  const assignments: Assignment[] = [];
  for (const a of state.assignments) {
    if (a.guestId === move.guestId) continue;
    if (occupant && a.guestId === occupant.guestId) {
      if (current) assignments.push({ guestId: a.guestId, tableId: current.tableId, seat: current.seat });
      else bumped.push(a.guestId);
      continue;
    }
    assignments.push(a);
  }
  assignments.push({ guestId: move.guestId, tableId: table.id, seat });
  return { state: withAssignments(state, assignments), bumped, notSeated: [] };
}

function seatHousehold(state: SeatingState, move: Extract<Move, { kind: 'household' }>): MoveResult {
  const table = findTable(state, move.tableId);
  if (!table) return unchanged(state, 'UNKNOWN_TABLE');

  const seated = new Set(state.assignments.map((a) => a.guestId));
  const toSeat = [...new Set(move.guestIds)].filter((id) => !seated.has(id));
  const free = freeSeats(state, table);
  const added: Assignment[] = toSeat.slice(0, free.length).map((guestId, i) => ({ guestId, tableId: table.id, seat: free[i] }));
  return {
    state: withAssignments(state, [...state.assignments, ...added]),
    bumped: [],
    notSeated: toSeat.slice(free.length),
  };
}

export function applyMove(state: SeatingState, move: Move): MoveResult {
  switch (move.kind) {
    case 'seat':
      return seatGuest(state, move);
    case 'household':
      return seatHousehold(state, move);
    case 'unseat':
      if (!state.assignments.some((a) => a.guestId === move.guestId)) return unchanged(state);
      return {
        state: withAssignments(state, state.assignments.filter((a) => a.guestId !== move.guestId)),
        bumped: [],
        notSeated: [],
      };
  }
}

export function autoFillVip(
  state: SeatingState,
  guests: SeatableGuest[],
): { state: SeatingState; seated: string[]; notSeated: string[] } {
  const vip1 = state.tables.find((t) => t.kind === 'VIP' && t.number === 1);
  const vip2 = state.tables.find((t) => t.kind === 'VIP' && t.number === 2);
  const alreadySeated = new Set(state.assignments.map((a) => a.guestId));

  const candidates = guests
    .filter((g) => !alreadySeated.has(g.id) && vipRoleOf(g.role) !== null)
    .sort(
      (a, b) =>
        a.partyLabel.localeCompare(b.partyLabel) ||
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName),
    );

  let current = state;
  const seated: string[] = [];
  const notSeated: string[] = [];
  for (const g of candidates) {
    const target =
      g.side === 'KLIFF'
        ? vip1
        : g.side === 'CHAO'
          ? vip2
          : vip1 && firstFreeSeat(current, vip1.id) !== null
            ? vip1
            : vip2;
    const seat = target ? firstFreeSeat(current, target.id) : null;
    if (!target || seat === null) {
      notSeated.push(g.id);
      continue;
    }
    current = withAssignments(current, [...current.assignments, { guestId: g.id, tableId: target.id, seat }]);
    seated.push(g.id);
  }
  return { state: current, seated, notSeated };
}

export function setTableSeats(
  state: SeatingState,
  tableId: string,
  seats: number,
): { state: SeatingState; unseated: string[] } {
  if (!findTable(state, tableId)) return { state, unseated: [] };
  const next = clamp(Math.round(seats), 0, MAX_SEATS);
  const dropped = state.assignments
    .filter((a) => a.tableId === tableId && a.seat > next)
    .sort((a, b) => a.seat - b.seat);
  const gone = new Set(dropped.map((a) => a.guestId));
  return {
    state: {
      ...state,
      tables: state.tables.map((t) => (t.id === tableId ? { ...t, seats: next } : t)),
      assignments: state.assignments.filter((a) => !gone.has(a.guestId)),
    },
    unseated: dropped.map((a) => a.guestId),
  };
}

export function setRoundTableCount(
  state: SeatingState,
  count: number,
  defaultSeats: number,
  newId: () => string,
  positionFor: (existing: SeatingTable[]) => { x: number; y: number },
): { state: SeatingState; unseated: string[]; removedTableIds: string[] } {
  const target = clamp(Math.round(count), 0, MAX_ROUND_TABLES);
  const seats = clamp(Math.round(defaultSeats), 0, MAX_SEATS);
  const round = state.tables.filter((t) => t.kind === 'ROUND').sort((a, b) => a.number - b.number);

  if (target < round.length) {
    const removed = round.slice(target);
    const removedIds = new Set(removed.map((t) => t.id));
    const unseated = state.assignments.filter((a) => removedIds.has(a.tableId)).map((a) => a.guestId);
    return {
      state: {
        ...state,
        tables: state.tables.filter((t) => !removedIds.has(t.id)),
        assignments: state.assignments.filter((a) => !removedIds.has(a.tableId)),
      },
      unseated,
      removedTableIds: removed.map((t) => t.id),
    };
  }

  const tables = [...state.tables];
  let number = round.length ? round[round.length - 1].number : 0;
  for (let i = round.length; i < target; i++) {
    number += 1;
    const { x, y } = positionFor(tables);
    tables.push({ id: newId(), kind: 'ROUND', number, name: defaultTableName('ROUND', number), seats, x, y });
  }
  return { state: { ...state, tables }, unseated: [], removedTableIds: [] };
}
