import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testPrisma } from './client';

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin }));

import * as actions from '../../app/admin/seating/actions';
import { loadSeatingPlan, moveCenter, moveGuests, renameTable, setRoundTables } from '../../app/admin/seating/actions';
import { clampCenterToRoom, RING } from '../../lib/seating/geometry';
import { loadSeating } from '../../lib/seating/store';

// Sy Household (external id p03: g07-g09), as in seating.test.ts.
let guestIds: string[];

async function vip1Id() {
  const { state } = await loadSeating(testPrisma);
  return state.tables.find((t) => t.kind === 'VIP' && t.number === 1)!.id;
}

// The test database is remote and each case makes a dozen round trips.
describe('seating actions', { timeout: 30_000 }, () => {
  beforeAll(async () => {
    const guests = await testPrisma.guest.findMany({ where: { externalId: { in: ['g07', 'g08', 'g09'] } } });
    guestIds = guests.map((g) => g.id);
  });

  // Every case starts from an empty plan, even after a run that left one behind (or local use of
  // the test database).
  async function reset() {
    await testPrisma.seatAssignment.deleteMany({});
    await testPrisma.seatingTable.deleteMany({});
    await testPrisma.seatingRoom.deleteMany({});
    await testPrisma.guestRsvp.deleteMany({ where: { guestId: { in: guestIds } } });
  }
  beforeAll(reset);
  beforeEach(reset);
  afterEach(async () => {
    requireAdmin.mockReset();
    await reset();
  });

  it('rejects every action when the caller is not an admin, before touching the database', async () => {
    requireAdmin.mockRejectedValue(new Error('NEXT_REDIRECT'));
    const exported = Object.entries(actions).filter(([, value]) => typeof value === 'function');
    expect(exported.map(([name]) => name)).toContain('loadSeatingPlan');
    for (const [name, action] of exported) {
      const call = (action as (...args: unknown[]) => Promise<unknown>)('x', 1, 2);
      await expect(call, name).rejects.toThrow('NEXT_REDIRECT');
    }
    expect(requireAdmin).toHaveBeenCalledTimes(exported.length);
    // Any load or save would have created the room row.
    expect(await testPrisma.seatingRoom.count()).toBe(0);
    expect(await testPrisma.seatingTable.count()).toBe(0);
  });

  it('loads the latest plan without guests who stopped attending', async () => {
    requireAdmin.mockResolvedValue('admin@test');
    for (const guestId of [guestIds[0], guestIds[1]]) {
      await testPrisma.guestRsvp.create({
        data: { guestId, status: 'ATTENDING', respondedAt: new Date(), respondedByGuestId: guestId, lastSubmissionId: 'seating-actions-test' },
      });
    }
    const tableId = await vip1Id();
    await moveGuests({ kind: 'seat', guestId: guestIds[0], tableId, seat: 1 });
    await moveGuests({ kind: 'seat', guestId: guestIds[1], tableId, seat: 2 });
    await testPrisma.guestRsvp.update({ where: { guestId: guestIds[0] }, data: { status: 'NOT_ATTENDING' } });

    const result = await loadSeatingPlan();
    expect(result.ok && result.state.assignments).toEqual([{ guestId: guestIds[1], tableId, seat: 2 }]);
    expect(result.ok && result.guests.map((g) => g.id)).not.toContain(guestIds[0]);
  });

  it('refuses to seat a guest who is not attending', async () => {
    requireAdmin.mockResolvedValue('admin@test');
    const tableId = await vip1Id();
    const result = await moveGuests({ kind: 'seat', guestId: guestIds[0], tableId });
    expect(result).toEqual({ ok: false, reason: 'invalid', message: 'Only guests who are attending can be seated.' });
    expect(await testPrisma.seatAssignment.count()).toBe(0);
  });

  it('seats an attending guest', async () => {
    requireAdmin.mockResolvedValue('admin@test');
    await testPrisma.guestRsvp.create({
      data: { guestId: guestIds[0], status: 'ATTENDING', respondedAt: new Date(), respondedByGuestId: guestIds[0], lastSubmissionId: 'seating-actions-test' },
    });
    const tableId = await vip1Id();
    const result = await moveGuests({ kind: 'seat', guestId: guestIds[0], tableId, seat: 2 });
    expect(result.ok && result.state.assignments).toEqual([{ guestId: guestIds[0], tableId, seat: 2 }]);
  });

  it('stores the default name when the new name is blank', async () => {
    requireAdmin.mockResolvedValue('admin@test');
    const created = await setRoundTables(1, 8);
    const table = created.ok ? created.state.tables.find((t) => t.kind === 'ROUND')! : null;
    expect(table).not.toBeNull();
    const renamed = await renameTable(table!.id, 'Family');
    expect(renamed.ok && renamed.state.tables.find((t) => t.id === table!.id)!.name).toBe('Family');
    const blank = await renameTable(table!.id, '   ');
    expect(blank.ok && blank.state.tables.find((t) => t.id === table!.id)!.name).toBe('Table 1');
  });

  it('keeps tables 1 and 2 (same ids) when going from 3 to 2 tables', async () => {
    requireAdmin.mockResolvedValue('admin@test');
    const three = await setRoundTables(3, 10);
    const ids = three.ok ? three.state.tables.filter((t) => t.kind === 'ROUND').map((t) => t.id) : [];
    expect(ids).toHaveLength(3);
    const two = await setRoundTables(2, 10);
    const after = two.ok ? two.state.tables.filter((t) => t.kind === 'ROUND').map((t) => t.id) : [];
    expect(after).toEqual(ids.slice(0, 2));
  });

  it('clamps the room center so the VIP ring stays inside the room', async () => {
    requireAdmin.mockResolvedValue('admin@test');
    const result = await moveCenter(99999, -50);
    expect(result.ok && result.state.center).toEqual(clampCenterToRoom({ x: 99999, y: -50 }));
    expect(result.ok && result.state.center.x).toBeLessThan(1000 - RING.radius);
    expect(result.ok && result.state.center.y).toBeGreaterThan(RING.radius);
  });
});
