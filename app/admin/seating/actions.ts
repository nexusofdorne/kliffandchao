'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import { clampCenterToRoom, clampToRoom, nextRoundTablePosition } from '@/lib/seating/geometry';
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
import { loadSeating, saveSeatingChange, SeatingConflictError } from '@/lib/seating/store';

export type SeatingActionResult =
  | { ok: true; state: SeatingState; guests: SeatableGuest[]; message?: string }
  | { ok: false; reason: 'conflict' | 'invalid'; message: string; state?: SeatingState; guests?: SeatableGuest[] };

const CONFLICT_MESSAGE = 'Someone else changed the plan just now. Showing the latest.';
const MAX_NAME_LENGTH = 40;

const id = z.string().min(1);
const seatsSchema = z.number().int().min(0).max(60);
const coordinate = z.number().finite();

const moveSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('seat'), guestId: id, tableId: id, seat: z.number().int().optional() }),
  z.object({ kind: z.literal('household'), guestIds: z.array(id).min(1), tableId: id }),
  z.object({ kind: z.literal('unseat'), guestId: id }),
]);

const MOVE_ERRORS = {
  TABLE_FULL: 'That table is full.',
  BAD_SEAT: "That chair doesn't exist.",
  UNKNOWN_TABLE: "That table doesn't exist.",
} as const;

// Thrown inside a change to abandon the write and report a plain sentence.
class Invalid extends Error {}

function invalid(message: string): SeatingActionResult {
  return { ok: false, reason: 'invalid', message };
}

function fullName(guests: SeatableGuest[], guestId: string): string {
  const g = guests.find((x) => x.id === guestId);
  return g ? `${g.firstName} ${g.lastName}` : 'A guest';
}

function wentBack(guests: SeatableGuest[], ids: string[]): string | undefined {
  if (ids.length === 0) return undefined;
  return ids.map((x) => `${fullName(guests, x)} went back to not seated.`).join(' ');
}

// Runs one change against the stored plan. `change` returns the next state and, optionally, a message
// built from what it saw.
async function run(
  change: (state: SeatingState, guests: SeatableGuest[]) => { state: SeatingState; message?: string },
): Promise<SeatingActionResult> {
  let message: string | undefined;
  let guests: SeatableGuest[] = [];
  try {
    const { state } = await saveSeatingChange(prisma, (current, attending) => {
      guests = attending;
      const next = change(current, attending);
      message = next.message;
      return { state: next.state };
    });
    revalidatePath('/admin/seating');
    return { ok: true, state, guests, ...(message ? { message } : {}) };
  } catch (error) {
    if (error instanceof Invalid) return invalid(error.message);
    if (error instanceof SeatingConflictError) {
      const latest = await loadSeating(prisma);
      return { ok: false, reason: 'conflict', message: CONFLICT_MESSAGE, state: latest.state, guests: latest.guests };
    }
    throw error;
  }
}

export async function moveGuests(input: Move): Promise<SeatingActionResult> {
  await requireAdmin();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return invalid('That move is not valid.');
  const move = parsed.data as Move;

  return run((state, guests) => {
    const attending = new Set(guests.map((g) => g.id));
    const ids = move.kind === 'household' ? move.guestIds : [move.guestId];
    if (move.kind !== 'unseat' && !ids.every((x) => attending.has(x))) {
      throw new Invalid('Only guests who are attending can be seated.');
    }
    const result = applyMove(state, move);
    if (result.error) throw new Invalid(MOVE_ERRORS[result.error]);

    const parts: string[] = [];
    const back = wentBack(guests, result.bumped);
    if (back) parts.push(back);
    if (result.notSeated.length) {
      const label = guests.find((g) => g.id === ids[0])?.partyLabel ?? 'household';
      parts.push(`${result.notSeated.length} of the ${label} didn't fit.`);
    }
    return { state: result.state, message: parts.join(' ') || undefined };
  });
}

export async function autoFillVipSeats(): Promise<SeatingActionResult> {
  await requireAdmin();
  return run((state, guests) => {
    const result = autoFillVip(state, guests);
    if (result.seated.length === 0 && result.notSeated.length === 0) {
      return { state: result.state, message: 'No VIPs left to seat.' };
    }
    let message = `Seated ${result.seated.length} ${result.seated.length === 1 ? 'VIP' : 'VIPs'}.`;
    if (result.notSeated.length) message += ` ${result.notSeated.length} didn't fit.`;
    return { state: result.state, message };
  });
}

export async function setSeats(tableId: string, seats: number): Promise<SeatingActionResult> {
  await requireAdmin();
  const parsed = z.object({ tableId: id, seats: seatsSchema }).safeParse({ tableId, seats });
  if (!parsed.success) return invalid('Seats must be a whole number from 0 to 60.');

  return run((state, guests) => {
    if (!state.tables.some((t) => t.id === parsed.data.tableId)) throw new Invalid(MOVE_ERRORS.UNKNOWN_TABLE);
    const result = setTableSeats(state, parsed.data.tableId, parsed.data.seats);
    return { state: result.state, message: wentBack(guests, result.unseated) };
  });
}

export async function setRoundTables(count: number, defaultSeats: number): Promise<SeatingActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ count: z.number().int().min(0).max(80), defaultSeats: seatsSchema })
    .safeParse({ count, defaultSeats });
  if (!parsed.success) return invalid('Tables must be 0 to 80, with 0 to 60 seats each.');

  return run((state, guests) => {
    const result = setRoundTableCount(
      state,
      parsed.data.count,
      parsed.data.defaultSeats,
      () => crypto.randomUUID(),
      (tablesSoFar) =>
        nextRoundTablePosition(
          tablesSoFar.filter((t) => t.kind === 'ROUND' && t.x != null).map((t) => ({ x: t.x!, y: t.y! })),
          state.center,
        ),
    );
    return { state: result.state, message: wentBack(guests, result.unseated) };
  });
}

export async function renameTable(tableId: string, name: string): Promise<SeatingActionResult> {
  await requireAdmin();
  const parsed = z.object({ tableId: id, name: z.string() }).safeParse({ tableId, name });
  if (!parsed.success) return invalid('That name is not valid.');
  const trimmed = parsed.data.name.trim().slice(0, MAX_NAME_LENGTH).trim();

  return run((state) => {
    const table = state.tables.find((t) => t.id === parsed.data.tableId);
    if (!table) throw new Invalid(MOVE_ERRORS.UNKNOWN_TABLE);
    const next = trimmed || defaultTableName(table.kind, table.number);
    return { state: { ...state, tables: state.tables.map((t) => (t === table ? { ...t, name: next } : t)) } };
  });
}

export async function moveTable(tableId: string, x: number, y: number): Promise<SeatingActionResult> {
  await requireAdmin();
  const parsed = z.object({ tableId: id, x: coordinate, y: coordinate }).safeParse({ tableId, x, y });
  if (!parsed.success) return invalid('That position is not valid.');

  return run((state) => {
    const table = state.tables.find((t) => t.id === parsed.data.tableId);
    if (!table) throw new Invalid(MOVE_ERRORS.UNKNOWN_TABLE);
    if (table.kind !== 'ROUND') throw new Invalid('VIP tables stay on the ring.');
    const at = clampToRoom({ x: parsed.data.x, y: parsed.data.y });
    return { state: { ...state, tables: state.tables.map((t) => (t === table ? { ...t, x: at.x, y: at.y } : t)) } };
  });
}

export async function moveCenter(x: number, y: number): Promise<SeatingActionResult> {
  await requireAdmin();
  const parsed = z.object({ x: coordinate, y: coordinate }).safeParse({ x, y });
  if (!parsed.success) return invalid('That position is not valid.');
  return run((state) => ({ state: { ...state, center: clampCenterToRoom(parsed.data) } }));
}
