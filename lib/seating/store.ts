import 'server-only';
import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import {
  defaultTableName,
  type Assignment,
  type SeatableGuest,
  type SeatingState,
  type SeatingTable,
} from './rules';

type Db = PrismaClient | Prisma.TransactionClient;

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const WRITE_CONFLICT = 'P2034';

const ROOM_CENTER = { x: 500, y: 380 };
const VIP_SEATS = 16;

// Two admins changed the plan at once (a chair taken, or a serialization failure): the caller
// reports it and the admin reloads. The store never retries.
export class SeatingConflictError extends Error {
  constructor() {
    super('The seating plan changed while saving');
    this.name = 'SeatingConflictError';
  }
}

function isConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === UNIQUE_CONSTRAINT_VIOLATION || error.code === WRITE_CONFLICT)
  );
}

// The room row and the two VIP tables exist from first use. skipDuplicates (INSERT ... ON
// CONFLICT DO NOTHING) makes two racing first loads safe; an upsert is not atomic.
async function ensureRoom(db: Db): Promise<void> {
  await db.seatingRoom.createMany({
    data: [{ id: 1, centerX: ROOM_CENTER.x, centerY: ROOM_CENTER.y }],
    skipDuplicates: true,
  });
  await db.seatingTable.createMany({
    data: [1, 2].map((number) => ({
      kind: 'VIP' as const,
      number,
      name: defaultTableName('VIP', number),
      seats: VIP_SEATS,
    })),
    skipDuplicates: true,
  });
}

// Seats of guests who are no longer coming (archived, or not ATTENDING) are removed.
async function dropStaleAssignments(db: Db): Promise<void> {
  await db.seatAssignment.deleteMany({
    where: {
      guest: {
        OR: [
          { archivedAt: { not: null } },
          { current: { is: null } },
          { current: { is: { status: { not: 'ATTENDING' } } } },
        ],
      },
    },
  });
}

async function readSeating(db: Db): Promise<{ state: SeatingState; guests: SeatableGuest[] }> {
  await dropStaleAssignments(db);
  const room = await db.seatingRoom.findUniqueOrThrow({ where: { id: 1 } });
  const tables = await db.seatingTable.findMany({ orderBy: [{ kind: 'asc' }, { number: 'asc' }] });
  const assignments = await db.seatAssignment.findMany({ orderBy: [{ tableId: 'asc' }, { seat: 'asc' }] });
  // One row per guest: the guest id is the primary key, so each attending guest appears once.
  const guests = await db.guest.findMany({
    where: { archivedAt: null, current: { is: { status: 'ATTENDING' } } },
    include: { party: true },
    orderBy: [{ party: { label: 'asc' } }, { lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
  });
  return {
    state: {
      center: { x: room.centerX, y: room.centerY },
      tables: tables.map((t) => ({
        id: t.id,
        kind: t.kind,
        number: t.number,
        name: t.name,
        seats: t.seats,
        x: t.x,
        y: t.y,
      })),
      assignments: assignments.map((a) => ({ guestId: a.guestId, tableId: a.tableId, seat: a.seat })),
    },
    guests: guests.map((g) => ({
      id: g.id,
      partyId: g.partyId,
      partyLabel: g.party.label,
      firstName: g.firstName,
      lastName: g.lastName,
      side: g.side,
      role: g.role,
    })),
  };
}

export async function loadSeating(
  prisma: PrismaClient,
): Promise<{ state: SeatingState; guests: SeatableGuest[] }> {
  await ensureRoom(prisma);
  return readSeating(prisma);
}

// A guest who answers Not attending (or leaves the sheet) loses their chair.
export async function releaseSeats(db: Db, guestIds: string[]): Promise<void> {
  if (guestIds.length === 0) return;
  await db.seatAssignment.deleteMany({ where: { guestId: { in: guestIds } } });
}

function sameAssignment(a: Assignment, b: Assignment): boolean {
  return a.tableId === b.tableId && a.seat === b.seat;
}

function tableData(t: SeatingTable) {
  return { kind: t.kind, number: t.number, name: t.name, seats: t.seats, x: t.x, y: t.y };
}

function sameTable(a: SeatingTable, b: SeatingTable): boolean {
  const x = tableData(a);
  const y = tableData(b);
  return (Object.keys(x) as (keyof typeof x)[]).every((key) => x[key] === y[key]);
}

// Reads the plan, lets `change` produce the next one, and writes the difference, all in one
// serializable transaction.
export async function saveSeatingChange(
  prisma: PrismaClient,
  change: (
    state: SeatingState,
    guests: SeatableGuest[],
  ) => { state: SeatingState } | Promise<{ state: SeatingState }>,
): Promise<{ state: SeatingState }> {
  await ensureRoom(prisma);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const { state: current, guests } = await readSeating(tx);
        const { state: next } = await change(current, guests);

        const nextTableIds = new Set(next.tables.map((t) => t.id));
        const removedTableIds = current.tables.filter((t) => !nextTableIds.has(t.id)).map((t) => t.id);
        if (removedTableIds.length) await tx.seatingTable.deleteMany({ where: { id: { in: removedTableIds } } });

        const nextByGuest = new Map(next.assignments.map((a) => [a.guestId, a]));
        const currentByGuest = new Map(current.assignments.map((a) => [a.guestId, a]));
        const dropped = current.assignments.filter((a) => {
          const after = nextByGuest.get(a.guestId);
          return !after || !sameAssignment(a, after);
        });
        if (dropped.length) {
          await tx.seatAssignment.deleteMany({ where: { guestId: { in: dropped.map((a) => a.guestId) } } });
        }

        // Only new or changed tables are written, and the room only when its center moved.
        const currentTables = new Map(current.tables.map((t) => [t.id, t]));
        for (const table of next.tables) {
          const before = currentTables.get(table.id);
          if (before && sameTable(before, table)) continue;
          await tx.seatingTable.upsert({
            where: { id: table.id },
            create: { id: table.id, ...tableData(table) },
            update: tableData(table),
          });
        }
        if (next.center.x !== current.center.x || next.center.y !== current.center.y) {
          await tx.seatingRoom.update({ where: { id: 1 }, data: { centerX: next.center.x, centerY: next.center.y } });
        }

        const added = next.assignments.filter((a) => {
          const before = currentByGuest.get(a.guestId);
          return !before || !sameAssignment(before, a);
        });
        if (added.length) await tx.seatAssignment.createMany({ data: added });

        return { state: next };
      },
      { isolationLevel: 'Serializable', timeout: 15_000 },
    );
  } catch (error) {
    if (isConflict(error)) throw new SeatingConflictError();
    throw error;
  }
}
