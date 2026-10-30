import { describe, expect, it } from 'vitest';
import {
  applyMove,
  autoFillVip,
  defaultTableName,
  firstFreeSeat,
  setRoundTableCount,
  setTableSeats,
  type Assignment,
  type Move,
  type SeatableGuest,
  type SeatingState,
  type SeatingTable,
} from './rules';

function table(id: string, kind: 'ROUND' | 'VIP', number: number, seats: number): SeatingTable {
  return {
    id,
    kind,
    number,
    name: defaultTableName(kind, number),
    seats,
    x: kind === 'VIP' ? null : number * 10,
    y: kind === 'VIP' ? null : number * 10,
  };
}

function state(assignments: Assignment[] = [], vipSeats = 3): SeatingState {
  return {
    center: { x: 50, y: 50 },
    tables: [table('V1', 'VIP', 1, vipSeats), table('V2', 'VIP', 2, vipSeats), table('T1', 'ROUND', 1, 4), table('T2', 'ROUND', 2, 4)],
    assignments,
  };
}

function withAt(guestId: string, tableId: string, seat: number): SeatingState {
  return state([{ guestId, tableId, seat }]);
}

function seatOf(s: SeatingState, guestId: string) {
  const a = s.assignments.find((x) => x.guestId === guestId);
  return a ? { tableId: a.tableId, seat: a.seat } : null;
}

function seatsAt(s: SeatingState, tableId: string) {
  return s.assignments
    .filter((a) => a.tableId === tableId)
    .map((a) => a.seat)
    .sort((a, b) => a - b);
}

function guest(id: string, over: Partial<SeatableGuest> = {}): SeatableGuest {
  return { id, partyId: 'p-' + id, partyLabel: id, firstName: id, lastName: 'X', side: 'KLIFF', role: null, ...over };
}

describe('firstFreeSeat', () => {
  it('returns the lowest free chair, or null when full or unknown', () => {
    const s = state([
      { guestId: 'a', tableId: 'T1', seat: 1 },
      { guestId: 'b', tableId: 'T1', seat: 3 },
    ]);
    expect(firstFreeSeat(s, 'T1')).toBe(2);
    expect(firstFreeSeat(s, 'nope')).toBeNull();
    expect(firstFreeSeat(setTableSeats(s, 'T2', 0).state, 'T2')).toBeNull();
  });
});

describe('applyMove seat', () => {
  it('seats a guest in the first free chair when no chair is given', () => {
    const r1 = applyMove(state(), { kind: 'seat', guestId: 'a', tableId: 'T1' });
    expect(seatOf(r1.state, 'a')).toEqual({ tableId: 'T1', seat: 1 });
    const r2 = applyMove(r1.state, { kind: 'seat', guestId: 'b', tableId: 'T1' });
    expect(seatOf(r2.state, 'b')).toEqual({ tableId: 'T1', seat: 2 });
    expect(r2.error).toBeUndefined();
  });

  it('moves an already seated guest and frees the old chair', () => {
    const r = applyMove(withAt('a', 'T1', 1), { kind: 'seat', guestId: 'a', tableId: 'T2', seat: 4 });
    expect(seatOf(r.state, 'a')).toEqual({ tableId: 'T2', seat: 4 });
    expect(r.state.assignments).toHaveLength(1);
  });

  it('swaps two seated guests when one is dropped on the other', () => {
    const s = state([
      { guestId: 'a', tableId: 'T1', seat: 1 },
      { guestId: 'b', tableId: 'T2', seat: 3 },
    ]);
    const r = applyMove(s, { kind: 'seat', guestId: 'a', tableId: 'T2', seat: 3 });
    expect(seatOf(r.state, 'a')).toEqual({ tableId: 'T2', seat: 3 });
    expect(seatOf(r.state, 'b')).toEqual({ tableId: 'T1', seat: 1 });
    expect(r.bumped).toEqual([]);
  });

  it('bumps the occupant when an unseated guest takes a taken chair', () => {
    const r = applyMove(withAt('a', 'T1', 1), { kind: 'seat', guestId: 'n', tableId: 'T1', seat: 1 });
    expect(r.bumped).toEqual(['a']);
    expect(seatOf(r.state, 'n')).toEqual({ tableId: 'T1', seat: 1 });
    expect(seatOf(r.state, 'a')).toBeNull();
  });

  it('ignores a drop on the chair the guest already holds', () => {
    const s = withAt('a', 'T1', 2);
    const r = applyMove(s, { kind: 'seat', guestId: 'a', tableId: 'T1', seat: 2 });
    expect(r.state).toEqual(s);
    expect(r.error).toBeUndefined();
    expect(r.bumped).toEqual([]);
  });

  it('refuses a first-free-chair drop on a full table', () => {
    const s = state([1, 2, 3, 4].map((seat) => ({ guestId: 'g' + seat, tableId: 'T1', seat })));
    const r = applyMove(s, { kind: 'seat', guestId: 'n', tableId: 'T1' });
    expect(r.error).toBe('TABLE_FULL');
    expect(r.state).toEqual(s);
  });

  it('rejects unknown tables and out-of-range chairs without changing state', () => {
    const s = withAt('a', 'T1', 1);
    const unknown = applyMove(s, { kind: 'seat', guestId: 'n', tableId: 'zzz' });
    expect(unknown.error).toBe('UNKNOWN_TABLE');
    expect(unknown.state).toEqual(s);
    for (const seat of [0, 5, -1, 1.5]) {
      const bad = applyMove(s, { kind: 'seat', guestId: 'n', tableId: 'T1', seat });
      expect(bad.error).toBe('BAD_SEAT');
      expect(bad.state).toEqual(s);
    }
  });

  it('does not mutate its input', () => {
    const s = withAt('a', 'T1', 1);
    const copy = structuredClone(s);
    applyMove(s, { kind: 'seat', guestId: 'n', tableId: 'T1', seat: 1 });
    expect(s).toEqual(copy);
  });
});

describe('applyMove unseat', () => {
  it('removes the guest, and is a no-op for a guest who is not seated', () => {
    const s = withAt('a', 'T1', 1);
    expect(applyMove(s, { kind: 'unseat', guestId: 'a' }).state.assignments).toEqual([]);
    const r = applyMove(s, { kind: 'unseat', guestId: 'ghost' });
    expect(r.state).toEqual(s);
    expect(r.error).toBeUndefined();
  });
});

describe('applyMove household', () => {
  it('seats a household in free chairs and reports who did not fit', () => {
    const s = state([{ guestId: 'x', tableId: 'T1', seat: 2 }]);
    const r = applyMove(s, { kind: 'household', guestIds: ['a', 'b', 'c', 'd', 'e'], tableId: 'T1' });
    expect(r.notSeated).toEqual(['d', 'e']);
    expect(seatsAt(r.state, 'T1')).toEqual([1, 2, 3, 4]);
    expect(seatOf(r.state, 'a')).toEqual({ tableId: 'T1', seat: 1 });
    expect(seatOf(r.state, 'b')).toEqual({ tableId: 'T1', seat: 3 });
    expect(seatOf(r.state, 'c')).toEqual({ tableId: 'T1', seat: 4 });
  });

  it('leaves members who are already seated where they are', () => {
    const s = withAt('a', 'T2', 2);
    const r = applyMove(s, { kind: 'household', guestIds: ['a', 'b'], tableId: 'T1' });
    expect(seatOf(r.state, 'a')).toEqual({ tableId: 'T2', seat: 2 });
    expect(seatOf(r.state, 'b')).toEqual({ tableId: 'T1', seat: 1 });
    expect(r.notSeated).toEqual([]);
  });

  it('reports an unknown table', () => {
    const s = state();
    const r = applyMove(s, { kind: 'household', guestIds: ['a'], tableId: 'zzz' });
    expect(r.error).toBe('UNKNOWN_TABLE');
    expect(r.state).toEqual(s);
  });
});

describe('autoFillVip', () => {
  it('auto-fills VIPs by side without moving anyone', () => {
    const s = state([{ guestId: 'old', tableId: 'T1', seat: 1 }]);
    const guests = [
      guest('kp', { partyLabel: 'A', side: 'KLIFF', role: 'Parents' }),
      guest('cs', { side: 'CHAO', role: 'Principal Sponsor' }),
      guest('b1', { partyLabel: 'B', side: 'BOTH', role: 'Parent' }),
      guest('plain', { side: 'KLIFF', role: 'Groomsman' }),
      guest('old', { side: 'KLIFF', role: 'Parents' }),
    ];
    const r = autoFillVip(s, guests);
    expect(seatOf(r.state, 'kp')).toEqual({ tableId: 'V1', seat: 1 });
    expect(seatOf(r.state, 'b1')).toEqual({ tableId: 'V1', seat: 2 });
    expect(seatOf(r.state, 'cs')).toEqual({ tableId: 'V2', seat: 1 });
    expect(seatOf(r.state, 'plain')).toBeNull();
    expect(seatOf(r.state, 'old')).toEqual({ tableId: 'T1', seat: 1 });
    expect([...r.seated].sort()).toEqual(['b1', 'cs', 'kp']);
    expect(r.notSeated).toEqual([]);
  });

  it('sends BOTH to VIP 2 once VIP 1 is full', () => {
    const s = state([], 1);
    const r = autoFillVip(s, [guest('k', { partyLabel: 'A', role: 'Parents' }), guest('b', { partyLabel: 'B', side: 'BOTH', role: 'Parents' })]);
    expect(seatOf(r.state, 'k')).toEqual({ tableId: 'V1', seat: 1 });
    expect(seatOf(r.state, 'b')).toEqual({ tableId: 'V2', seat: 1 });
  });

  it('keeps a household together by ordering on party label then name', () => {
    const r = autoFillVip(state(), [
      guest('z', { partyLabel: 'B', lastName: 'Z', role: 'Parents' }),
      guest('a2', { partyLabel: 'A', lastName: 'Q', firstName: 'B', role: 'Parents' }),
      guest('a1', { partyLabel: 'A', lastName: 'Q', firstName: 'A', role: 'Parents' }),
    ]);
    expect(seatOf(r.state, 'a1')?.seat).toBe(1);
    expect(seatOf(r.state, 'a2')?.seat).toBe(2);
    expect(seatOf(r.state, 'z')?.seat).toBe(3);
  });

  it('flags VIPs that do not fit and is idempotent', () => {
    const s = state([], 1);
    const guests = [guest('p1', { partyLabel: 'A', role: 'Parents' }), guest('p2', { partyLabel: 'B', role: 'Parents' })];
    const r = autoFillVip(s, guests);
    expect(r.seated).toEqual(['p1']);
    expect(r.notSeated).toEqual(['p2']);
    const again = autoFillVip(r.state, guests);
    expect(again.seated).toEqual([]);
    expect(again.state).toEqual(r.state);
  });
});

describe('setTableSeats', () => {
  it('frees the highest chairs when seats are reduced', () => {
    const s = state([1, 2, 3, 4].map((seat) => ({ guestId: 'g' + seat, tableId: 'T1', seat })));
    const r = setTableSeats(s, 'T1', 2);
    expect(r.unseated).toEqual(['g3', 'g4']);
    expect(seatsAt(r.state, 'T1')).toEqual([1, 2]);
    expect(r.state.tables.find((t) => t.id === 'T1')?.seats).toBe(2);
  });

  it('clamps to 0..60 and leaves other tables alone', () => {
    const s = withAt('a', 'T2', 1);
    expect(setTableSeats(s, 'T1', 500).state.tables.find((t) => t.id === 'T1')?.seats).toBe(60);
    const r = setTableSeats(s, 'T2', -3);
    expect(r.state.tables.find((t) => t.id === 'T2')?.seats).toBe(0);
    expect(r.unseated).toEqual(['a']);
  });
});

describe('setRoundTableCount', () => {
  const ids = () => {
    let n = 0;
    return () => 'new' + ++n;
  };
  const pos = (existing: SeatingTable[]) => ({ x: existing.length, y: 99 });

  it('removes round tables from the end and keeps numbers stable', () => {
    let s = state();
    s = setRoundTableCount(s, 3, 6, ids(), pos).state;
    s = applyMove(s, { kind: 'seat', guestId: 'g', tableId: 'new1', seat: 2 }).state;
    expect(s.tables.filter((t) => t.kind === 'ROUND').map((t) => t.number)).toEqual([1, 2, 3]);

    const down = setRoundTableCount(s, 2, 6, ids(), pos);
    expect(down.removedTableIds).toEqual(['new1']);
    expect(down.unseated).toEqual(['g']);
    expect(down.state.assignments).toEqual([]);

    const up = setRoundTableCount(down.state, 4, 6, ids(), pos);
    const added = up.state.tables.filter((t) => t.id.startsWith('new'));
    expect(added.map((t) => t.name)).toEqual(['Table 3', 'Table 4']);
    expect(added.map((t) => t.seats)).toEqual([6, 6]);
    expect(up.state.tables.filter((t) => t.kind === 'VIP')).toHaveLength(2);
  });

  it('positions each new table with those already added', () => {
    const r = setRoundTableCount(state(), 5, 8, ids(), pos);
    const added = r.state.tables.filter((t) => t.id.startsWith('new'));
    expect(added.map((t) => t.x)).toEqual([4, 5, 6]);
    expect(added.every((t) => t.kind === 'ROUND' && t.y === 99)).toBe(true);
  });

  it('clamps the count to 0..80', () => {
    const round = (s: SeatingState) => s.tables.filter((t) => t.kind === 'ROUND');
    expect(round(setRoundTableCount(state(), -4, 6, ids(), pos).state)).toHaveLength(0);
    expect(round(setRoundTableCount(state(), 999, 6, ids(), pos).state)).toHaveLength(80);
  });
});

describe('defaultTableName', () => {
  it('names tables', () => {
    expect(defaultTableName('ROUND', 3)).toBe('Table 3');
    expect(defaultTableName('VIP', 1)).toBe('VIP 1');
  });
});

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('invariants', () => {
  it('never puts two guests in one chair or one guest in two chairs', () => {
    const rand = mulberry32(12345);
    const pick = (xs: string[]) => xs[Math.floor(rand() * xs.length)];
    const guestIds = Array.from({ length: 14 }, (_, i) => 'g' + i);
    const tableIds = ['V1', 'V2', 'T1', 'T2', 'nope'];
    let s = state();
    for (let i = 0; i < 200; i++) {
      const roll = rand();
      let move: Move;
      if (roll < 0.5) {
        move = { kind: 'seat', guestId: pick(guestIds), tableId: pick(tableIds), seat: rand() < 0.3 ? undefined : Math.floor(rand() * 6) };
      } else if (roll < 0.7) {
        move = { kind: 'household', guestIds: [pick(guestIds), pick(guestIds), pick(guestIds)], tableId: pick(tableIds) };
      } else {
        move = { kind: 'unseat', guestId: pick(guestIds) };
      }
      s = applyMove(s, move).state;
      const chairs = s.assignments.map((a) => `${a.tableId}:${a.seat}`);
      expect(new Set(chairs).size).toBe(chairs.length);
      const who = s.assignments.map((a) => a.guestId);
      expect(new Set(who).size).toBe(who.length);
      for (const a of s.assignments) {
        const t = s.tables.find((x) => x.id === a.tableId)!;
        expect(a.seat).toBeGreaterThanOrEqual(1);
        expect(a.seat).toBeLessThanOrEqual(t.seats);
      }
    }
  });
});
