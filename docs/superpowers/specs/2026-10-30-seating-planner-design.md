# Seating planner — design

Date: 30 October 2026. Status: agreed with the owner in conversation; builder check done (answers folded in); ready for a plan.

## Why

Kliff and Chao will sit down together the week before the wedding (5 March 2027, Jpark Island
Resort) to decide where every attending guest sits. They want to do it on a picture of the
room rather than in a spreadsheet, change their minds freely, and then send the result to
their coordinator (The Centerpiece) as a picture of the floor plan and a spreadsheet of who sits
where. Today the admin dashboard (`/admin`) has a guest list and RSVP counts but nothing for
seating.

A "find your table" page for guests on the main site is wanted later and is **not** part of
this build. Keep the data model friendly to it (a guest's table and seat are easy to look up),
but build nothing guest-facing.

## Goals

- A **Seating** page inside the admin area, only for signed-in admins (same guard as `/admin`:
  `requireAdmin()` on the page, `requireAdmin()`/`requireAdminApi()` on every action or route).
- A **floor plan** of the room that both of them can arrange and seat people on.
- **Auto-fill** of the VIP tables with attending parents and principal sponsors.
- **Exports:** a JPG of the floor plan and an Excel spreadsheet of who sits where.

## Non-goals

- The guest-facing table finder (later build).
- Real-time co-editing (two cursors at once). Two people at one computer is the expected use;
  if both edit from different computers, last write wins per change (see Saving).
- Meal choices, dietary notes, place cards, printing name cards.
- Anything on the phone design (`prototype-mobile/`, `public/m/`). Desktop/laptop only; the page
  only needs to not break on a small screen.

## Anti-goals (would make it a failure even if it "works")

- Losing a seating arrangement: an accidental refresh, a sync from the sheet, or a guest
  changing their RSVP must never wipe or scramble the plan (only the affected guest moves).
- Auto-fill undoing manual work.
- Seating someone who isn't attending, or two people in one chair.
- Touching guest data in the Google Sheet (the site only reads the Guests tab; it already writes
  the separate `RSVP_Log` tab, which stays as is).

## The room (as agreed on mockups)

The owner chose a **floor plan** over table cards, then refined it over four mockups (kept in
`.superpowers/brainstorm/…/content/planner-layout-v4.html`, git-ignored). The final picture:

- **Centerstage** in the very middle of the room (a floral circle; label "Centerstage").
- **VIP 1 and VIP 2** are the two halves of **one ring-shaped table** around the Centerstage:
  VIP 1 the left half, VIP 2 the right half, with a **small opening at the top and the bottom**.
  Chairs sit on the **outside of the ring only** (reference photo: a long curved table with
  guests on the outer side and the couple/flowers in the middle).
- **Round tables** encircle the middle. They start evenly spaced on a ring around it.
- Each table shows its name and fill (e.g. `9/10`); an over-full table is outlined in red.
- **Chair dots**: every seat is drawn as a small chair around its table; a taken chair is darker,
  a free one pale. The number of chairs drawn always equals the table's seat count.

### Configuring tables

- The admins set **how many round tables** there are and **how many seats each round table has**
  (a default for all, changeable per table).
- The admins set the **number of seats for VIP 1 and VIP 2** separately.
- Round tables are numbered 1…N, and the **number never changes** once a table exists.
  *(Builder-check answer, the designer's call.)* Changing the count adds or removes tables **at the
  end** (the highest numbers); there is no removing a table from the middle. So a spreadsheet already
  sent to the coordinator stays correct. New tables are placed on free space around the ring.
  Removing a table with people at it asks first and sends them back to "not seated".
- **Table names are customizable** (owner's answer). Every table, round and VIP, has a name the
  admins can edit; the default is its number for round tables ("Table 3") and "VIP 1" / "VIP 2" for
  the VIP halves. The name is what the floor plan, the JPG and the spreadsheet show. The number
  stays as the table's fixed position in the order (used for sorting), and the spreadsheet shows
  both.
- **Reducing seats** below the number of people seated: confirm first, then the guests in the
  removed chairs (the highest-numbered ones) go back to "not seated". Never squeeze them in.

### Arranging the room

- Drag a **round table** to move it.
- The **VIP ring and the Centerstage move together** as one piece.
- Positions are saved, so the plan looks the same next time.

## Seating people

- The left side lists **attending guests who aren't seated**, grouped by household (party), with
  a count. Search box to find a name.
- Only guests whose current RSVP is **Attending** can be seated. Pending and Not attending guests
  are not in the list.
- **Chair-level seating:**
  - Drop a guest **on a chair** to seat them in exactly that chair. If someone is already sitting
    there, the newcomer takes the chair and the previous occupant goes back to "not seated", with a
    message saying who was moved. *(Builder-check answer, the designer's call.)*
  - Drop a guest **on a table** (not a chair) to seat them in its first free chair.
  - Drag a whole **household** onto a table to seat them in consecutive free chairs (as many as
    fit; the rest stay unseated, with a message).
  - Drag a seated guest **from one chair to another** (same or different table); dropping onto a
    taken chair **swaps** the two.
  - Drag a seated guest back to the list (or a "remove" action) to unseat them.
  - Hovering a chair shows who sits there; clicking a table shows its guest list.
- **Chair numbering:** clockwise from the top of each round table, starting at 1. For VIP 1 and
  VIP 2, numbered along their half (VIP 1 from the top opening down the left side; VIP 2 from
  the top opening down the right side). The numbers appear in the spreadsheet.

### When guest data changes

- A seated guest who changes to **Not attending**, or is **archived** (removed from the sheet by
  the full sync), loses their seat automatically; the chair frees up. Nobody else moves.
- A guest who becomes Attending appears in the "not seated" list.
- Guests who are seated but no longer attending must never be shown in a chair, even
  momentarily, in the exports.

## Roles and auto-fill VIP

- The Guests tab of the couple's Google Sheet has a column headed **`Role`** (owner's answer; it is
  column H, but the sync reads it **by header name** like every other column and never by letter).
  Match the header case-insensitively and trimmed (`Role`, `role`). The existing columns use
  lowercase keys such as `guest_id`; this one is title case in the real sheet. Values used:
  **"Parents"** and **"Principal Sponsor"**. Match case-insensitively and trimmed; treat "Parent" and "Principal
  Sponsors" as the same. Any other value, or empty, means no VIP role.
- The column is **optional** for the sync: a sheet without it still syncs (everyone has no role).
  Missing it must not break the existing full sync or the per-row webhook sync.
- The role is stored on the guest and updated by both syncs (`/api/admin/sync` full pull and
  `/api/sync` webhook), the same way the other guest fields are.
- **Auto-fill VIP** (one button):
  - Takes attending guests with a VIP role who are **not seated yet**.
  - Kliff's side → VIP 1; Chao's side → VIP 2; "Both" → whichever VIP half has free chairs
    (VIP 1 first).
  - Fills the **first free chairs**. Never moves or removes anyone already seated (anywhere).
  - If there are more VIPs than free chairs, the rest stay unseated and are **flagged** (e.g. a
    "VIP not seated" marker in the list and a message after the run).
  - Running it again only fills what's still empty.
- After auto-fill everything is manual: the admins can move anyone anywhere, including between
  VIP 1 and VIP 2 or off the VIP tables.

## Saving

- **Every change saves on its own** (no Save button). There is **one seating plan**.
- Both partners use their own admin logins (the existing Supabase admin accounts in
  `ADMIN_EMAILS`) and see the same plan.
- Every move is sent to the server as an intent ("put guest G in chair C of table T", "swap these
  two", "unseat G") and applied **against the current state** there, inside a transaction, by the
  same rules as on screen. So when both admins edit from different computers, the later move wins
  (e.g. it takes the chair, and whoever was there goes back to "not seated"). The database still
  guarantees **one guest per chair and one chair per guest** (unique constraints); a move that
  loses a genuine race fails cleanly and the page reloads the current plan rather than corrupting it.

## Exports

- **JPG:** the floor plan picture exactly as arranged — Centerstage, VIP ring, round tables,
  table labels and fills, chair dots (taken/free). **No guest names** on the picture. High
  resolution (suitable to print on A4/A3). File name like `kliff-chao-seating-plan.jpg`.
- **Spreadsheet (.xlsx):** opens in Excel and Google Sheets.
  - Tab "Seating": one row per seated guest — Table (number), Table name, Seat, Guest (first + last
    name), Household, Side, Role. Sorted by table (VIP 1, VIP 2, then 1…N) and seat.
  - Tab "Tables": one row per table — Table, Table name, Seats, Filled, Free.
  - Optional third tab "Not seated": attending guests without a seat (so the coordinator can see
    gaps). Builder's call whether to include; recommended.

## Constraints (from the existing project)

- Next.js 16 app router, React 19, TypeScript, Tailwind; Prisma 7 with the `@prisma/adapter-pg`
  adapter on Supabase Postgres. See `CLAUDE.md` and `docs/BUILD_PLAN.md`.
- **Every new table gets Row Level Security enabled with no policies** (the pattern in
  `prisma/migrations/*`): Supabase's Data API must see nothing; Prisma, as owner, is unaffected.
- **Migrations:** test first on the separate test database (`npm run db:prepare-test`,
  `npm run test:db`); production is migrated only with the owner's explicit OK, and before the
  deploy that needs it.
- Server actions and routes are public endpoints: each one checks `requireAdmin()` itself.
- The admin area's look is the plain dashboard style (`components/admin/*`, `bg-background`,
  `border-border`, `text-muted-foreground`), not the wedding site's glass design.
- Adding a dependency for .xlsx writing and for drag-and-drop is acceptable; keep them small and
  well-maintained. The JPG can be rendered from the floor plan's SVG via a canvas, no server
  rendering needed.
- `content/entourage.ts` is unrelated (the public Entourage tab) and is not the source of roles.

## Left to the builder

- Data model details (e.g. a `SeatingTable` with kind ROUND/VIP, label, seats, x/y; a
  `SeatAssignment` with table, seat number, guest — unique on (table, seat) and on guest; a stored
  room layout), and how Centerstage/VIP ring position is stored.
- Drag-and-drop implementation (library or pointer events), as long as it works with a mouse and
  trackpad; touch is a nice-to-have.
- Where the Seating page sits in the admin navigation (a link from `/admin`, e.g. `/admin/seating`).
- How the not-seated list is ordered (household label is a sensible default).
- Exact visual styling of the floor plan beyond the agreed shapes (the v4 mockup is the
  reference).
- Default positions for new tables and for the first load.
