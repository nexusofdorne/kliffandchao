import { describe, expect, it } from 'vitest';
import { notSeatedRows, seatingRows, tableRows } from './export-rows';
import type { SeatableGuest, SeatingState, SeatingTable } from './rules';

function table(id: string, kind: 'VIP' | 'ROUND', number: number, seats: number, name?: string): SeatingTable {
  return {
    id,
    kind,
    number,
    name: name ?? (kind === 'VIP' ? `VIP ${number}` : `Table ${number}`),
    seats,
    x: kind === 'VIP' ? null : 100,
    y: kind === 'VIP' ? null : 100,
  };
}

function guest(id: string, over: Partial<SeatableGuest> = {}): SeatableGuest {
  return {
    id,
    partyId: `p-${id}`,
    partyLabel: `Party ${id}`,
    firstName: id,
    lastName: 'Cruz',
    side: 'KLIFF',
    role: null,
    ...over,
  };
}

const tables = [table('r2', 'ROUND', 2, 8), table('v2', 'VIP', 2, 4, 'Sponsors'), table('r1', 'ROUND', 1, 6, 'Family'), table('v1', 'VIP', 1, 4)];
const guests = [guest('a', { side: 'CHAO', role: 'Parents' }), guest('b', { side: 'BOTH' }), guest('c'), guest('d')];
const guestsById = new Map(guests.map((g) => [g.id, g]));
const state: SeatingState = {
  center: { x: 500, y: 380 },
  tables,
  assignments: [
    { guestId: 'c', tableId: 'r1', seat: 2 },
    { guestId: 'b', tableId: 'r2', seat: 1 },
    { guestId: 'a', tableId: 'v2', seat: 3 },
    { guestId: 'd', tableId: 'r1', seat: 1 },
    { guestId: 'gone', tableId: 'v1', seat: 1 },
  ],
};

describe('seatingRows', () => {
  it('sorts VIP 1, VIP 2, then round tables by number, then seat', () => {
    const rows = seatingRows(state, guestsById);
    expect(rows.map((r) => [r.table, r.seat])).toEqual([
      ['VIP 2', 3],
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
  });

  it('fills the columns and skips guests who are no longer attending', () => {
    const rows = seatingRows(state, guestsById);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      table: 'VIP 2',
      tableName: 'Sponsors',
      seat: 3,
      guest: 'a Cruz',
      household: 'Party a',
      side: 'Chao',
      role: 'Parents',
    });
    expect(rows[1]).toMatchObject({ tableName: 'Family', guest: 'd Cruz', side: 'Kliff', role: '' });
    expect(rows[3]).toMatchObject({ side: 'Both' });
  });

  it('is empty for an empty plan', () => {
    expect(seatingRows({ ...state, assignments: [] }, guestsById)).toEqual([]);
  });
});

describe('tableRows', () => {
  it('lists every table in order with seats, filled and free', () => {
    expect(tableRows(state)).toEqual([
      { table: 'VIP 1', tableName: 'VIP 1', seats: 4, filled: 1, free: 3 },
      { table: 'VIP 2', tableName: 'Sponsors', seats: 4, filled: 1, free: 3 },
      { table: 1, tableName: 'Family', seats: 6, filled: 2, free: 4 },
      { table: 2, tableName: 'Table 2', seats: 8, filled: 1, free: 7 },
    ]);
  });

  it('never reports negative free seats', () => {
    const over: SeatingState = {
      ...state,
      assignments: [1, 2, 3].map((seat) => ({ guestId: `g${seat}`, tableId: 'v1', seat })),
      tables: [table('v1', 'VIP', 1, 2)],
    };
    expect(tableRows(over)[0]).toMatchObject({ filled: 3, free: 0 });
  });

  it('is empty without tables', () => {
    expect(tableRows({ ...state, tables: [], assignments: [] })).toEqual([]);
  });
});

describe('notSeatedRows', () => {
  it('lists attending guests with no assignment', () => {
    const rows = notSeatedRows(
      { ...state, assignments: [{ guestId: 'a', tableId: 'v2', seat: 1 }] },
      guests,
    );
    expect(rows.map((r) => r.guest)).toEqual(['b Cruz', 'c Cruz', 'd Cruz']);
    expect(rows[0]).toEqual({ guest: 'b Cruz', household: 'Party b', side: 'Both', role: '' });
  });

  it('is empty when everyone is seated or there are no guests', () => {
    expect(notSeatedRows(state, [guests[0]])).toEqual([]);
    expect(notSeatedRows(state, [])).toEqual([]);
  });
});
