import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { submitRsvp } from '../../lib/rsvp/submit';
import { applyMove } from '../../lib/seating/rules';
import { loadSeating, saveSeatingChange, SeatingConflictError } from '../../lib/seating/store';
import { testPrisma } from './client';

// Sy Household (external id p03: g07-g09) — not used by the other DB tests.
const GUEST_EXTERNAL_IDS = ['g07', 'g08', 'g09'];
let partyId: string;
let guestIds: string[];

async function attend(ids: string[], status: 'ATTENDING' | 'NOT_ATTENDING' = 'ATTENDING') {
  for (const guestId of ids) {
    await testPrisma.guestRsvp.upsert({
      where: { guestId },
      create: { guestId, status, respondedAt: new Date(), respondedByGuestId: guestIds[0], lastSubmissionId: 'seating-test' },
      update: { status },
    });
  }
}

async function vip1Id() {
  const { state } = await loadSeating(testPrisma);
  return state.tables.find((t) => t.kind === 'VIP' && t.number === 1)!.id;
}

function seatAt(guestId: string, tableId: string, seat: number) {
  return saveSeatingChange(testPrisma, (state) => ({ state: applyMove(state, { kind: 'seat', guestId, tableId, seat }).state }));
}

// The test database is remote and each case makes a dozen round trips.
describe('seating store', { timeout: 30_000 }, () => {
  beforeAll(async () => {
    const party = await testPrisma.party.findUniqueOrThrow({ where: { externalId: 'p03' } });
    partyId = party.id;
    const guests = await testPrisma.guest.findMany({ where: { externalId: { in: GUEST_EXTERNAL_IDS } } });
    guestIds = guests.map((g) => g.id);
  });

  // Every case starts from an empty plan, even after a run that left one behind (or local use of
  // the test database).
  async function reset() {
    await testPrisma.seatAssignment.deleteMany({});
    await testPrisma.seatingTable.deleteMany({});
    await testPrisma.seatingRoom.deleteMany({});
    await testPrisma.rsvpResponse.deleteMany({ where: { submission: { partyId } } });
    await testPrisma.rsvpSubmission.deleteMany({ where: { partyId } });
    await testPrisma.guestRsvp.deleteMany({ where: { guestId: { in: guestIds } } });
    await testPrisma.guest.updateMany({ where: { id: { in: guestIds } }, data: { archivedAt: null } });
  }
  beforeAll(reset);
  beforeEach(reset);
  afterEach(reset);

  it('creates the room and VIP 1 and VIP 2 on first load, once', async () => {
    const [first] = await Promise.all([loadSeating(testPrisma), loadSeating(testPrisma)]);
    expect(first.state.center).toEqual({ x: 500, y: 380 });
    expect(first.state.tables.map((t) => [t.kind, t.number, t.name, t.seats, t.x, t.y])).toEqual([
      ['VIP', 1, 'VIP 1', 16, null, null],
      ['VIP', 2, 'VIP 2', 16, null, null],
    ]);
    expect(await testPrisma.seatingTable.count()).toBe(2);
    expect(await testPrisma.seatingRoom.count()).toBe(1);
  });

  it('lists each attending, unarchived guest once', async () => {
    await attend([guestIds[0], guestIds[1]]);
    await attend([guestIds[2]], 'NOT_ATTENDING');
    const { guests } = await loadSeating(testPrisma);
    const mine = guests.filter((g) => guestIds.includes(g.id)).map((g) => g.id);
    expect(mine.sort()).toEqual([guestIds[0], guestIds[1]].sort());
  });

  it('saves a move and reads it back', async () => {
    await attend([guestIds[0]]);
    const tableId = await vip1Id();
    await seatAt(guestIds[0], tableId, 3);
    const { state } = await loadSeating(testPrisma);
    expect(state.assignments).toEqual([{ guestId: guestIds[0], tableId, seat: 3 }]);
  });

  it('rejects two guests in one chair at the database level', async () => {
    await attend([guestIds[0], guestIds[1]]);
    const tableId = await vip1Id();
    await seatAt(guestIds[0], tableId, 3);
    await expect(testPrisma.seatAssignment.create({ data: { tableId, seat: 3, guestId: guestIds[1] } })).rejects.toThrow();
  });

  it('frees the seat when the guest answers Not attending', async () => {
    await attend(guestIds);
    const tableId = await vip1Id();
    await seatAt(guestIds[0], tableId, 1);
    await seatAt(guestIds[1], tableId, 2);
    await submitRsvp(testPrisma, {
      clientSubmissionId: randomUUID(),
      partyId,
      submittedByGuestId: guestIds[0],
      responses: [{ guestId: guestIds[0], status: 'NOT_ATTENDING' }],
      message: null,
      ipHash: null,
      notification: { recipient: 'test@example.com', partyLabel: 'Test household', submitterName: 'Test Guest', answers: [] },
    });
    const rows = await testPrisma.seatAssignment.findMany();
    expect(rows.map((r) => r.guestId)).toEqual([guestIds[1]]);
  });

  it('drops stale assignments on load (archived guest)', async () => {
    await attend([guestIds[0], guestIds[1]]);
    const tableId = await vip1Id();
    await seatAt(guestIds[0], tableId, 1);
    await seatAt(guestIds[1], tableId, 2);
    await testPrisma.guest.update({ where: { id: guestIds[0] }, data: { archivedAt: new Date() } });
    const { state } = await loadSeating(testPrisma);
    expect(state.assignments.map((a) => a.guestId)).toEqual([guestIds[1]]);
    expect(await testPrisma.seatAssignment.count()).toBe(1);
  });

  it('writes only the tables that changed, and the room only when the center moves', async () => {
    await attend([guestIds[0]]);
    const tableId = await vip1Id();
    const stamps = async () => ({
      tables: new Map((await testPrisma.seatingTable.findMany()).map((t) => [t.id, t.updatedAt.getTime()])),
      room: (await testPrisma.seatingRoom.findUniqueOrThrow({ where: { id: 1 } })).updatedAt.getTime(),
    });
    const before = await stamps();
    await seatAt(guestIds[0], tableId, 1);
    expect(await stamps()).toEqual(before);

    await saveSeatingChange(testPrisma, (state) => ({
      state: { ...state, tables: state.tables.map((t) => (t.id === tableId ? { ...t, name: 'Family' } : t)) },
    }));
    const renamed = await stamps();
    expect(renamed.room).toBe(before.room);
    for (const [id, stamp] of renamed.tables) {
      if (id === tableId) expect(stamp).toBeGreaterThan(before.tables.get(id)!);
      else expect(stamp).toBe(before.tables.get(id));
    }
    const { state } = await loadSeating(testPrisma);
    expect(state.tables.find((t) => t.id === tableId)!.name).toBe('Family');

    await saveSeatingChange(testPrisma, (state) => ({ state: { ...state, center: { x: 520, y: 400 } } }));
    expect((await loadSeating(testPrisma)).state.center).toEqual({ x: 520, y: 400 });
  });

  it('one of two concurrent moves for the same chair fails cleanly', async () => {
    await attend([guestIds[0], guestIds[1]]);
    const tableId = await vip1Id();
    // Both moves read the plan before either writes, so each sees chair 5 empty.
    let reads = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => (release = resolve));
    const move = (guestId: string) =>
      saveSeatingChange(testPrisma, async (state) => {
        if (++reads === 2) release();
        await bothRead;
        return { state: applyMove(state, { kind: 'seat', guestId, tableId, seat: 5 }).state };
      });
    const results = await Promise.allSettled([move(guestIds[0]), move(guestIds[1])]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(SeatingConflictError);
    expect(await testPrisma.seatAssignment.count({ where: { tableId, seat: 5 } })).toBe(1);
  });
});
