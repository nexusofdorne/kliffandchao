# Seating Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin-only Seating page where the couple arrange the reception room on a floor plan, seat attending guests chair by chair (with auto-fill for VIP roles), and export a JPG of the plan and an .xlsx of who sits where.

**Architecture:** All seating rules live in pure functions (`lib/seating/*`) that work on an in-memory `SeatingState`; the client applies them optimistically for instant feedback and the server re-applies the same functions inside a transaction against the current database state (the server is the source of truth). The floor plan is one SVG built from pure geometry functions, so the JPG export is that SVG drawn onto a canvas. Roles come from the Guests sheet's optional `Role` column through the existing sync.

**Tech Stack:** Next.js 16 app router, React 19, TypeScript, Tailwind, Prisma 7 + `@prisma/adapter-pg` (Supabase Postgres), Vitest; new dependency `write-excel-file` (browser entry) for .xlsx.

**Spec:** `docs/superpowers/specs/2026-10-30-seating-planner-design.md` (read it first; this plan argues from it).

## Global Constraints

- Admin only: every page/action/route calls `requireAdmin()` (`lib/auth/require-admin.ts`) itself. Server actions are public endpoints.
- Every new table: `ALTER TABLE "<name>" ENABLE ROW LEVEL SECURITY;` in its migration, no policies.
- Migrations are tested on the separate test database only (`npm run db:prepare-test`, `npm run test:db`). Never run `db:deploy` against production in this plan; production is migrated later with the owner's explicit OK, before the deploy.
- The working tree already holds uncommitted work (admin guest table, site settings, migration `20261030000000_site_settings`). Each commit in this plan stages **only the files its task lists**. Never push.
- Admin look: plain dashboard style (`bg-background`, `border-border`, `text-foreground`, `text-muted-foreground`, `rounded-md border border-input px-3 py-1.5 text-sm` buttons), as in `components/admin/*`. Not the wedding site's glass design.
- Names fixed by the spec: "Centerstage"; "VIP 1" (left half of the ring), "VIP 2" (right half); round tables default "Table N"; role values "Parents", "Principal Sponsor"; sheet header `Role` (any case).
- Only guests with current RSVP **ATTENDING** and `archivedAt = null` can hold a seat. One guest per chair, one chair per guest (database unique constraints).
- Round table numbers never change once created; the round-table count adds/removes at the end (highest numbers).
- Desktop/laptop only; the page must not break below 768 px but needs no phone layout. Mouse and trackpad drag required.
- Run `npm run verify` (lint, typecheck, unit tests) before each commit; run `npm run test:db` for tasks that touch the database.

## Review Focus

1. **A household bigger than a table's free chairs** is dropped on it: the first members fill consecutive free chairs, the rest stay unseated, and a message says how many didn't fit. (Test in Task 3.)
2. **Seats reduced below the people sitting there** (round or VIP): after confirmation the guests in the removed, highest-numbered chairs go back to "not seated"; nobody else moves. (Test in Task 3.)
3. **A seated guest changes to Not attending, or is archived by "Sync now"**: their chair frees, they're absent from both exports, and they don't come back to the old chair if they later attend again. (Tests in Tasks 4 and 5.)
4. **Role spelled differently in the sheet** (`Role`, ` role `, `PARENTS`, `Parent`, `Principal Sponsors`, blank, or no Role column at all): VIP detection still works and the sync never fails because of it. (Tests in Task 1.)
5. **Two edits racing for the same chair** (two computers): one wins, the other fails cleanly and the page reloads the plan; never two people in one chair. Also dropping a guest on the chair they already occupy is a no-op. (Tests in Tasks 3 and 4.)

---

### Task 1: Role from the Guests sheet

**Files:**
- Modify: `prisma/schema.prisma` (Guest: `role String?`)
- Create: `prisma/migrations/20261031000000_seating/migration.sql` (this task adds only the `role` column; Task 4 appends the seating tables to the same file before it is first applied — apply nothing to the test database until Task 4)
- Modify: `lib/guests/parse-rows.ts`, `lib/guests/upsert.ts`
- Create: `lib/seating/roles.ts`
- Test: `lib/guests/parse-rows.test.ts`, `lib/seating/roles.test.ts`

**Interfaces:**
- Produces: `GuestSeed.role: string | null`; `isVipRole(role: string | null): boolean`; `type VipRole = 'PARENTS' | 'PRINCIPAL_SPONSOR'`; `vipRoleOf(role: string | null): VipRole | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/seating/roles.test.ts
it('recognises the two VIP roles in any case and spacing', () => {
  expect(vipRoleOf('Parents')).toBe('PARENTS');
  expect(vipRoleOf(' parent ')).toBe('PARENTS');
  expect(vipRoleOf('PRINCIPAL SPONSOR')).toBe('PRINCIPAL_SPONSOR');
  expect(vipRoleOf('Principal Sponsors')).toBe('PRINCIPAL_SPONSOR');
  expect(vipRoleOf('Groomsman')).toBeNull();
  expect(vipRoleOf('')).toBeNull();
  expect(vipRoleOf(null)).toBeNull();
  expect(isVipRole('Parents')).toBe(true);
});

// lib/guests/parse-rows.test.ts (baseRow has no Role key)
it('reads the Role column by header in any case, trimmed, empty as null', () => {
  expect(parseGuestRows([{ ...baseRow, Role: ' Parents ' }]).guests[0].role).toBe('Parents');
  expect(parseGuestRows([{ ...baseRow, role: 'Principal Sponsor' }]).guests[0].role).toBe('Principal Sponsor');
  expect(parseGuestRows([{ ...baseRow, Role: '' }]).guests[0].role).toBeNull();
});
it('still parses a sheet without a Role column', () => {
  expect(parseGuestRows([baseRow]).guests[0].role).toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail**
Run: `npx vitest run lib/seating/roles.test.ts lib/guests/parse-rows.test.ts` — Expected: FAIL (module not found / `role` undefined).

- [ ] **Step 3: Implement**
`vipRoleOf` in `lib/seating/roles.ts`: lowercase, trim, collapse spaces; `parent`/`parents` → PARENTS, `principal sponsor`/`principal sponsors` → PRINCIPAL_SPONSOR. In `parseGuestRows`, find the row key whose `trim().toLowerCase() === 'role'` (not added to `REQUIRED_HEADERS`) and set `role` (trimmed, empty → null). In `upsertGuestRows`, write `role` in both `create` and `update`. Schema: `role String?` on `Guest`; migration starts with `ALTER TABLE "Guest" ADD COLUMN "role" TEXT;`. Run `npx prisma generate`.

- [ ] **Step 4: Run the tests** — `npm run verify` — Expected: all pass.

- [ ] **Step 5: Commit** — `git add prisma/schema.prisma prisma/migrations/20261031000000_seating lib/guests lib/seating/roles.ts lib/seating/roles.test.ts` (`generated/` is not tracked) — `git commit -m "feat(seating): read guests' Role from the sheet"`

---

### Task 2: Room geometry

**Files:**
- Create: `lib/seating/geometry.ts`
- Test: `lib/seating/geometry.test.ts`

**Interfaces:**
- Produces (all coordinates in room units; the room is `ROOM = { width: 1000, height: 760 }`):
  - `type Point = { x: number; y: number }`
  - `type ChairSpot = Point & { seat: number; angle: number }` (seat is 1-based; angle in radians, for rotating the chair)
  - `const RING = { radius: 150, band: 34, gapHalfAngle: 0.22 }` (VIP ring around Centerstage; openings at top and bottom)
  - `roundChairSpots(center: Point, seats: number): ChairSpot[]` — clockwise from the top, radius `ROUND_TABLE_RADIUS + 14` with `ROUND_TABLE_RADIUS = 36`
  - `vipChairSpots(center: Point, half: 1 | 2, seats: number): ChairSpot[]` — on the outside of the ring (radius `RING.radius + RING.band / 2 + 14`), evenly spread over the half's arc; seat 1 next to the **top** opening, numbering down that half (VIP 1 runs down the left side, VIP 2 down the right side)
  - `vipArc(half: 1 | 2): { start: number; end: number }` — arc angles, excluding the openings
  - `defaultRoundTablePositions(count: number, center: Point): Point[]` — evenly on an ellipse around the center (radii 400 × 300), first at the top, clockwise
  - `nextRoundTablePosition(existing: Point[], center: Point): Point` — the default slot for the next table number that is farthest from every existing table, clamped inside the room

- [ ] **Step 1: Write the failing tests**

```ts
it('numbers round-table chairs clockwise from the top', () => {
  const spots = roundChairSpots({ x: 0, y: 0 }, 4);
  expect(spots.map((s) => s.seat)).toEqual([1, 2, 3, 4]);
  expect(spots[0].y).toBeLessThan(0);            // top
  expect(spots[1].x).toBeGreaterThan(0);         // then right
});
it('puts VIP 1 on the left half and VIP 2 on the right, seat 1 by the top opening', () => {
  const c = { x: 500, y: 380 };
  const v1 = vipChairSpots(c, 1, 10);
  const v2 = vipChairSpots(c, 2, 10);
  expect(v1.every((s) => s.x < c.x)).toBe(true);
  expect(v2.every((s) => s.x > c.x)).toBe(true);
  expect(v1[0].y).toBeLessThan(v1[9].y);
  expect(v2[0].y).toBeLessThan(v2[9].y);
});
it('leaves the openings free of chairs', () => {
  const c = { x: 0, y: 0 };
  for (const s of [...vipChairSpots(c, 1, 30), ...vipChairSpots(c, 2, 30)]) {
    expect(Math.abs(s.x)).toBeGreaterThan(20);   // nothing straight above or below the centre
  }
});
it('returns exactly as many spots as seats, and none for zero', () => {
  expect(roundChairSpots({ x: 0, y: 0 }, 12)).toHaveLength(12);
  expect(vipChairSpots({ x: 0, y: 0 }, 1, 0)).toEqual([]);
});
it('spreads default round tables around the middle, first at the top', () => {
  const ps = defaultRoundTablePositions(8, { x: 500, y: 380 });
  expect(ps).toHaveLength(8);
  expect(ps[0].y).toBeLessThan(380);
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run lib/seating/geometry.test.ts` — FAIL.
- [ ] **Step 3: Implement** the functions above in `lib/seating/geometry.ts` (angles: 0 = right, −π/2 = top, clockwise = increasing angle in screen coordinates).
- [ ] **Step 4: Run** — `npm run verify` — PASS.
- [ ] **Step 5: Commit** — `git add lib/seating/geometry.ts lib/seating/geometry.test.ts` — `git commit -m "feat(seating): room geometry"`

---

### Task 3: Seating rules (pure)

**Files:**
- Create: `lib/seating/rules.ts`
- Test: `lib/seating/rules.test.ts`

**Interfaces:**
- Consumes: `vipRoleOf` (Task 1).
- Produces:
  ```ts
  type TableKind = 'ROUND' | 'VIP';
  type SeatingTable = { id: string; kind: TableKind; number: number; name: string; seats: number; x: number | null; y: number | null };
  // VIP tables: number 1 or 2, x/y null (they sit on the ring around the room's center)
  type Assignment = { guestId: string; tableId: string; seat: number };
  type SeatableGuest = { id: string; partyId: string; partyLabel: string; firstName: string; lastName: string; side: 'KLIFF' | 'CHAO' | 'BOTH'; role: string | null };
  type SeatingState = { center: { x: number; y: number }; tables: SeatingTable[]; assignments: Assignment[] };
  type Move =
    | { kind: 'seat'; guestId: string; tableId: string; seat?: number }   // seat omitted = first free chair
    | { kind: 'household'; guestIds: string[]; tableId: string }
    | { kind: 'unseat'; guestId: string };
  type MoveResult = { state: SeatingState; bumped: string[]; notSeated: string[]; error?: 'TABLE_FULL' | 'UNKNOWN_TABLE' | 'BAD_SEAT' };
  firstFreeSeat(state: SeatingState, tableId: string): number | null;
  applyMove(state: SeatingState, move: Move): MoveResult;
  autoFillVip(state: SeatingState, guests: SeatableGuest[]): { state: SeatingState; seated: string[]; notSeated: string[] };
  setTableSeats(state: SeatingState, tableId: string, seats: number): { state: SeatingState; unseated: string[] };
  setRoundTableCount(state: SeatingState, count: number, defaultSeats: number, newId: () => string, positionFor: (existing: SeatingTable[]) => { x: number; y: number }): { state: SeatingState; unseated: string[]; removedTableIds: string[] };
  defaultTableName(kind: TableKind, number: number): string;   // "Table 3" | "VIP 1"
  ```
  Rules (from the spec): `seat` with a `seat` number on a taken chair → if the moving guest is already seated elsewhere, **swap**; if not seated, the newcomer takes the chair and the occupant is **bumped** (in `bumped`). `seat` onto the chair the guest already holds → unchanged state, no error. `seat` without a number on a full table → `error: 'TABLE_FULL'`, state unchanged. `household` → the not-yet-seated members (in the given order) fill the table's free chairs in ascending seat order; members already seated stay where they are; overflow in `notSeated`. `autoFillVip` → unseated guests with `vipRoleOf` ≠ null: KLIFF → VIP 1, CHAO → VIP 2, BOTH → VIP 1 if it has a free chair else VIP 2; first free chairs; never touches existing assignments; overflow in `notSeated`; guests ordered by `partyLabel` then `lastName`, `firstName` so a household stays together. `setTableSeats` below occupancy → guests in chairs > seats are unseated (returned). `setRoundTableCount` → removes highest-numbered round tables (unseating their guests) or appends `Table N+1…` with `defaultSeats` at `positionFor(...)`. Seats are clamped to 0…60.

- [ ] **Step 1: Write the failing tests** (a `state()` helper builds VIP 1, VIP 2 and two round tables of 4)

```ts
it('seats a guest in the first free chair when no chair is given', () => { /* expect seat 1, then 2 */ });
it('swaps two seated guests when one is dropped on the other', () => { /* a@T1s1, b@T2s3 -> a@T2s3, b@T1s1 */ });
it('bumps the occupant when an unseated guest takes a taken chair', () => {
  const r = applyMove(withAt('a', 'T1', 1), { kind: 'seat', guestId: 'n', tableId: 'T1', seat: 1 });
  expect(r.bumped).toEqual(['a']);
  expect(seatOf(r.state, 'n')).toEqual({ tableId: 'T1', seat: 1 });
  expect(seatOf(r.state, 'a')).toBeNull();
});
it('ignores a drop on the chair the guest already holds', () => { /* state unchanged, no error */ });
it('refuses a first-free-chair drop on a full table', () => { /* error TABLE_FULL, state unchanged */ });
it('seats a household in free chairs and reports who did not fit', () => {
  // T1 has 4 seats, chair 2 taken; household of 5
  expect(r.notSeated).toHaveLength(2);
  expect(seatsAt(r.state, 'T1')).toEqual([1, 2, 3, 4]);
});
it('auto-fills VIPs by side without moving anyone', () => {
  // KLIFF parent -> VIP 1, CHAO sponsor -> VIP 2, BOTH -> VIP 1 while free; a guest already at T1 stays
});
it('auto-fill flags VIPs that do not fit and is idempotent', () => {
  // VIP 1 has 1 seat, two KLIFF parents -> one in notSeated; running again seats nobody new
});
it('frees the highest chairs when seats are reduced', () => {
  // T1 seats 4 with chairs 1..4 taken -> setTableSeats(T1, 2) unseats chairs 3 and 4 only
});
it('removes round tables from the end and keeps numbers stable', () => {
  // tables 1..3, count -> 2 removes table 3 (and unseats its guests); count -> 4 adds "Table 3", "Table 4" with new ids
});
it('never puts two guests in one chair or one guest in two chairs', () => {
  // apply a random sequence of 200 moves (seeded) and check both invariants after each
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run lib/seating/rules.test.ts` — FAIL.
- [ ] **Step 3: Implement** in `lib/seating/rules.ts`. Pure: never mutate the input state.
- [ ] **Step 4: Run** — `npm run verify` — PASS.
- [ ] **Step 5: Commit** — `git add lib/seating/rules.ts lib/seating/rules.test.ts` — `git commit -m "feat(seating): seating rules"`

---

### Task 4: Database model and store

**Files:**
- Modify: `prisma/schema.prisma`; append to `prisma/migrations/20261031000000_seating/migration.sql`
- Create: `lib/seating/store.ts` (relative imports, like the rest of `lib/`; the DB test config has no `@/` alias)
- Modify: `lib/rsvp/submit.ts` (free seats in the same transaction), `app/api/admin/sync/route.ts` (free seats of archived guests)
- Test: `tests/db/seating.test.ts`

**Interfaces:**
- Consumes: Task 3 types and functions.
- Produces:
  - Prisma models: `enum SeatingTableKind { ROUND VIP }`; `SeatingTable { id cuid, kind, number Int, name String, seats Int, x Float?, y Float?, assignments, createdAt, updatedAt; @@unique([kind, number]) }`; `SeatAssignment { id cuid, tableId → SeatingTable onDelete Cascade, seat Int, guestId String @unique → Guest onDelete Cascade, updatedAt; @@unique([tableId, seat]) }`; `SeatingRoom { id Int @id @default(1), centerX Float, centerY Float, updatedAt }`; `Guest.seat SeatAssignment?`. RLS enabled on all three tables.
  - `loadSeating(prisma: PrismaClient): Promise<{ state: SeatingState; guests: SeatableGuest[] }>` — creates the room (center 500, 380) and VIP 1 / VIP 2 (16 seats each, x/y null) on first use; **deletes stale assignments** (guest archived or current status ≠ ATTENDING) before returning; `guests` = attending, unarchived guests.
  - `releaseSeats(tx: Prisma.TransactionClient, guestIds: string[]): Promise<void>`.
  - `saveSeatingChange(prisma: PrismaClient, change: (state: SeatingState, guests: SeatableGuest[]) => { state: SeatingState }): Promise<{ state: SeatingState }>` — in one `$transaction` (isolation `Serializable`): load the current state, run `change`, write the difference (delete removed/changed assignments first, then create; upsert/delete tables; update room). Throws `SeatingConflictError` on a unique-constraint (P2002) or serialization (P2034) failure.

- [ ] **Step 1: Write the failing DB tests** (use the seeded test households; clean up seating tables in `afterEach`)

```ts
it('creates VIP 1 and VIP 2 on first load', async () => { /* names, kind VIP, seats 16 */ });
it('saves a move and reads it back', async () => { /* seat an ATTENDING seeded guest at VIP 1 chair 3 */ });
it('rejects two guests in one chair at the database level', async () => {
  await expect(testPrisma.seatAssignment.create({ data: { tableId, seat: 3, guestId: other } })).rejects.toThrow();
});
it('frees the seat when the guest answers Not attending', async () => {
  // submitRsvp with NOT_ATTENDING for a seated guest -> no SeatAssignment for them
});
it('drops stale assignments on load (archived guest)', async () => {
  // archive a seated guest directly -> loadSeating returns state without them and the row is gone
});
it('one of two concurrent moves for the same chair fails cleanly', async () => {
  const results = await Promise.allSettled([moveA(), moveB()]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  // and the chair holds exactly one guest
});
```

- [ ] **Step 2: Apply the migration to the test database and run** — `npm run db:prepare-test` then `npm run test:db` — Expected: the new tests FAIL (functions missing).
- [ ] **Step 3: Implement** the models, migration SQL (enum, three tables, constraints, FKs with `ON DELETE CASCADE`, three `ENABLE ROW LEVEL SECURITY` lines), `lib/seating/store.ts` (`import 'server-only'`), `releaseSeats` inside `submitRsvp`'s transaction for responses with status `NOT_ATTENDING`, and in the full sync route delete assignments of the guests it archives.
- [ ] **Step 4: Run** — `npm run db:prepare-test && npm run test:db && npm run verify` — PASS (existing DB tests still pass: guest deletes cascade to assignments).
- [ ] **Step 5: Commit** — `git add prisma lib/seating/store.ts lib/rsvp/submit.ts app/api/admin/sync/route.ts tests/db/seating.test.ts` — `git commit -m "feat(seating): tables, seats and store"`

---

### Task 5: Server actions

**Files:**
- Create: `app/admin/seating/actions.ts`
- Modify: `vitest.config.db.ts` (add the alias `'@': fileURLToPath(new URL('./', import.meta.url))` next to `server-only`, since the action imports `@/…` paths)
- Test: `tests/db/seating-actions.test.ts` (imports the actions directly; `vi.mock` `@/lib/auth/require-admin` to resolve to `'admin@test'` or throw, and `next/cache` so `revalidatePath` is a no-op)

**Interfaces:**
- Consumes: Tasks 3–4.
- Produces (all `'use server'`, each starts with `await requireAdmin()`, each returns `SeatingActionResult = { ok: true; state: SeatingState; guests: SeatableGuest[]; message?: string } | { ok: false; reason: 'conflict' | 'invalid'; message: string }`, and calls `revalidatePath('/admin/seating')`):
  - `moveGuests(move: Move)` — message lists bumped / not-fitted guests by name ("Ana Cruz went back to not seated").
  - `autoFillVipSeats()` — message "Seated N VIPs" plus "M didn't fit" when overflowing.
  - `setSeats(tableId: string, seats: number)`; `setRoundTables(count: number, defaultSeats: number)` — positions from `nextRoundTablePosition`.
  - `renameTable(tableId: string, name: string)` — trimmed, max 40 chars, empty → `defaultTableName`.
  - `moveTable(tableId: string, x: number, y: number)`; `moveCenter(x: number, y: number)` — clamped inside `ROOM`.
  - Input validated with zod (ids are strings, seats/count integers 0…60/0…80).
  - A `SeatingConflictError` becomes `{ ok: false, reason: 'conflict', message: 'Someone else changed the plan just now. Showing the latest.' }`.

- [ ] **Step 1: Write the failing tests** — unauthorised call rejects (mock `requireAdmin` to throw a redirect); `moveGuests` on a not-attending guest returns `invalid`; `renameTable(id, '   ')` stores "Table N"; `setRoundTables(3, 10)` then `(2, 10)` leaves tables 1 and 2 with their ids unchanged.
- [ ] **Step 2: Run** — `npm run test:db` — FAIL.
- [ ] **Step 3: Implement** `app/admin/seating/actions.ts`.
- [ ] **Step 4: Run** — `npm run test:db && npm run verify` — PASS.
- [ ] **Step 5: Commit** — `git add app/admin/seating/actions.ts vitest.config.db.ts tests/db/seating-actions.test.ts` — `git commit -m "feat(seating): admin actions"`

---

### Task 6: The Seating page (floor plan, list, drag and drop)

**Files:**
- Create: `app/admin/seating/page.tsx` (server: `requireAdmin()`, `loadSeating(prisma)`, renders the planner)
- Create: `components/admin/seating/SeatingPlanner.tsx` (client: holds `state`, applies `rules` optimistically, calls actions, on `ok: false` replaces state with the returned/refreshed plan and shows the message)
- Create: `components/admin/seating/FloorPlan.tsx` (SVG `viewBox="0 0 1000 760"`, `forwardRef<SVGSVGElement>` so Task 7 can export it)
- Create: `components/admin/seating/UnseatedList.tsx`, `components/admin/seating/TablePanel.tsx`, `components/admin/seating/RoomControls.tsx`
- Create: `lib/seating/drag.ts` (pure hit-testing helpers) and `lib/seating/drag.test.ts`
- Modify: `app/admin/page.tsx` (a "Seating plan" link next to "Sync now")

**Interfaces:**
- Consumes: Tasks 2, 3, 5.
- Produces: `FloorPlan` props `{ state: SeatingState; guestsById: Map<string, SeatableGuest>; highlightTableId?: string; onPointerDownTable(id, e); onPointerDownChair(tableId, seat, e); onPointerDownCenter(e) }`; DOM drop targets marked `data-drop-table="<id>"` (table body) and `data-drop-seat="<tableId>:<seat>"` (chair); the list's area `data-drop-unseat`. `resolveDropTarget(el: Element | null): { kind: 'chair'; tableId: string; seat: number } | { kind: 'table'; tableId: string } | { kind: 'unseat' } | null` in `lib/seating/drag.ts`.

What the page shows (spec "The room" and "Seating people"; the v4 mockup is the visual reference):
- Header: "Seating plan", counts "X of Y attending seated", buttons **Auto-fill VIP**, **Export JPG**, **Export spreadsheet** (Task 7 wires the two exports), link back to `/admin`.
- Left: `UnseatedList` — search box; households (party label, member count) with each attending unseated member; VIP-role guests marked "VIP"; guests auto-fill couldn't fit marked "VIP not seated". Drag a name (one guest) or the household header (`household` move).
- Right: `FloorPlan` — Centerstage (floral circle, label "Centerstage") at `state.center`; the VIP ring as two arcs (VIP 1 left, VIP 2 right) from `vipArc`, chairs from `vipChairSpots`; round tables at their x/y with chairs from `roundChairSpots`; each table labelled with its name and `filled/seats`, red dashed outline when over-full (only possible transiently); taken chairs darker (`#c9b98f`), free paler (`#efe9da`). Hovering a chair shows the guest's name (`<title>`).
- Dragging: pointer events (no library). Drag a round table body → `moveTable` on release; drag the Centerstage or VIP ring → `moveCenter`; drag a guest (from list or a taken chair) → a floating name tag follows the pointer, release resolves the target with `document.elementFromPoint` + `resolveDropTarget` → `moveGuests` (`seat` with/without chair, or `unseat`). A small move threshold (4 px) separates click from drag.
- Click a table → `TablePanel`: rename (input, saves on blur/Enter), seats (number input; when lowering below occupancy, `window.confirm` naming how many guests go back first), its guests by seat with a remove button.
- `RoomControls`: "Round tables" count and "Seats per new table" (default 10); lowering the count confirms first when the removed tables have guests.
- Messages from actions appear in a dismissible line under the header.

- [ ] **Step 1: Write the failing test** for `resolveDropTarget` (chair element, table element, nested child of a chair, unseat area, unrelated element → null).
- [ ] **Step 2: Run** — `npx vitest run lib/seating/drag.test.ts` — FAIL.
- [ ] **Step 3: Implement** the page and components.
- [ ] **Step 4: Run** — `npm run verify` — PASS. Then the browser check: start the dev server on the **test database** (launch config `kliffandchao-testdb`), sign in at `/admin/login` (the owner signs in; never enter credentials yourself), open `/admin/seating`: set 8 round tables, auto-fill VIP (seed some test guests with roles and ATTENDING first via the RSVP form or a test-only script on the test DB), drag a guest to a chair, swap two guests, drop a household, move a table and the ring, reload — the plan is unchanged.
- [ ] **Step 5: Commit** — `git add app/admin/seating/page.tsx app/admin/page.tsx components/admin/seating lib/seating/drag.ts lib/seating/drag.test.ts` — `git commit -m "feat(seating): the seating page"`

---

### Task 7: Exports (JPG and spreadsheet)

**Files:**
- Create: `lib/seating/export-rows.ts` (pure) and `lib/seating/export-rows.test.ts`
- Create: `lib/seating/export-files.ts` (browser: JPG via canvas, .xlsx via `write-excel-file/browser`)
- Modify: `components/admin/seating/SeatingPlanner.tsx` (wire the two buttons), `package.json` (add `write-excel-file`, exact version pinned)

**Interfaces:**
- Consumes: Tasks 3, 6 (`FloorPlan` ref).
- Produces:
  - `seatingRows(state, guestsById): { table: number | string; tableName: string; seat: number; guest: string; household: string; side: string; role: string }[]` — sorted VIP 1, VIP 2, then round tables by number, then seat; `table` is "VIP 1"/"VIP 2" for VIPs and the number for round tables; side as "Kliff"/"Chao"/"Both".
  - `tableRows(state): { table; tableName; seats; filled; free }[]` (same order).
  - `notSeatedRows(state, guests): { guest; household; side; role }[]`.
  - `exportJpg(svg: SVGSVGElement, fileName = 'kliff-chao-seating-plan.jpg'): Promise<void>` — serialize the SVG (inline styles only; no external fonts or images), draw at 3000 px wide on a white canvas, `toBlob('image/jpeg', 0.92)`, download. **No guest names** in the picture: chair `<title>` elements are removed from the clone before drawing.
  - `exportXlsx(rows, fileName = 'kliff-chao-seating.xlsx')` — sheets "Seating", "Tables", "Not seated" with the column headers `Table, Table name, Seat, Guest, Household, Side, Role` / `Table, Table name, Seats, Filled, Free` / `Guest, Household, Side, Role`.

- [ ] **Step 1: Write the failing tests** for the three pure row builders: VIP 1 and VIP 2 rows sort before round tables, then by number and seat; `seatingRows` skips any assignment whose guest isn't in `guestsById` (so a guest who stopped attending never reaches the file); `notSeatedRows` lists attending guests without an assignment; an empty plan gives empty arrays.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**; `npm install write-excel-file@<current version> --save-exact`.
- [ ] **Step 4: Run** — `npm run verify` — PASS. Browser check on the test-DB dev server: both downloads open (the .xlsx in Excel or Google Sheets with three tabs; the JPG shows the room with chair dots and no names).
- [ ] **Step 5: Commit** — `git add lib/seating/export-rows.ts lib/seating/export-rows.test.ts lib/seating/export-files.ts components/admin/seating/SeatingPlanner.tsx package.json package-lock.json` — `git commit -m "feat(seating): JPG and spreadsheet export"`

---

### Task 8: Docs and handover

**Files:**
- Modify: `HANDOFF.md` (a dated section: what was built, that migration `20261031000000_seating` must be applied to production with the owner's OK **after** `20261030000000_site_settings` and **before** the deploy, that the sheet's `Role` column feeds auto-fill), `README.md` (one paragraph under the admin section on the Seating page and the Role column).

- [ ] **Step 1:** Write the two doc updates.
- [ ] **Step 2:** `npm run verify && npm run test:db && npx next build` — all pass.
- [ ] **Step 3: Commit** — `git add HANDOFF.md README.md` — `git commit -m "docs: seating planner handover"`
