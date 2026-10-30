import type { SeatableGuest, SeatingState, SeatingTable } from './rules';

export type SeatingRow = {
  table: number | string;
  tableName: string;
  seat: number;
  guest: string;
  household: string;
  side: string;
  role: string;
};
export type TableRow = { table: number | string; tableName: string; seats: number; filled: number; free: number };
export type NotSeatedRow = { guest: string; household: string; side: string; role: string };
export type ExportRows = { seating: SeatingRow[]; tables: TableRow[]; notSeated: NotSeatedRow[] };

const SIDE_LABEL = { KLIFF: 'Kliff', CHAO: 'Chao', BOTH: 'Both' } as const;

// VIP 1, VIP 2, then the round tables by number.
function tableOrder(a: SeatingTable, b: SeatingTable): number {
  if (a.kind !== b.kind) return a.kind === 'VIP' ? -1 : 1;
  return a.number - b.number;
}

function tableLabel(table: SeatingTable): number | string {
  return table.kind === 'VIP' ? `VIP ${table.number}` : table.number;
}

function guestName(guest: SeatableGuest): string {
  return `${guest.firstName} ${guest.lastName}`;
}

export function seatingRows(state: SeatingState, guestsById: Map<string, SeatableGuest>): SeatingRow[] {
  const rows: SeatingRow[] = [];
  for (const table of [...state.tables].sort(tableOrder)) {
    const seated = state.assignments.filter((a) => a.tableId === table.id).sort((a, b) => a.seat - b.seat);
    for (const assignment of seated) {
      const guest = guestsById.get(assignment.guestId);
      if (!guest) continue; // no longer attending: never reaches the file
      rows.push({
        table: tableLabel(table),
        tableName: table.name,
        seat: assignment.seat,
        guest: guestName(guest),
        household: guest.partyLabel,
        side: SIDE_LABEL[guest.side],
        role: guest.role ?? '',
      });
    }
  }
  return rows;
}

export function tableRows(state: SeatingState): TableRow[] {
  return [...state.tables].sort(tableOrder).map((table) => {
    const filled = state.assignments.filter((a) => a.tableId === table.id).length;
    return {
      table: tableLabel(table),
      tableName: table.name,
      seats: table.seats,
      filled,
      free: Math.max(0, table.seats - filled),
    };
  });
}

export function notSeatedRows(state: SeatingState, guests: SeatableGuest[]): NotSeatedRow[] {
  const seated = new Set(state.assignments.map((a) => a.guestId));
  return guests
    .filter((g) => !seated.has(g.id))
    .map((g) => ({ guest: guestName(g), household: g.partyLabel, side: SIDE_LABEL[g.side], role: g.role ?? '' }));
}

// The spreadsheet's three sheets, all from one plan (the exports pass the freshly loaded one).
export function exportRows(plan: { state: SeatingState; guests: SeatableGuest[] }): ExportRows {
  const guestsById = new Map(plan.guests.map((g) => [g.id, g]));
  return {
    seating: seatingRows(plan.state, guestsById),
    tables: tableRows(plan.state),
    notSeated: notSeatedRows(plan.state, plan.guests),
  };
}
