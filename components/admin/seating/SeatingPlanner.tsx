'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { clampToRoom } from '@/lib/seating/geometry';
import type { SeatableGuest, SeatingState } from '@/lib/seating/rules';
import { FloorPlan } from './FloorPlan';
import { RoomControls } from './RoomControls';
import { TablePanel } from './TablePanel';
import { UnseatedList } from './UnseatedList';
import { usePointerDrag, type ActiveDrag, type Gesture } from './usePointerDrag';
import { useSeatingPlan } from './useSeatingPlan';

type SeatingPlannerProps = { initialState: SeatingState; initialGuests: SeatableGuest[] };

const buttonClass = 'rounded-md border border-input px-3 py-1.5 text-sm text-foreground disabled:opacity-50';

function fullName(guest: SeatableGuest): string {
  return `${guest.firstName} ${guest.lastName}`;
}

// While a table or the center is being dragged, the plan shows it at the pointer.
function withDragPreview(state: SeatingState, drag: ActiveDrag | null): SeatingState {
  const gesture = drag?.gesture;
  if (!drag || !gesture) return state;
  const to = (origin: { x: number; y: number }) =>
    clampToRoom({ x: origin.x + drag.delta.x, y: origin.y + drag.delta.y });
  if (gesture.kind === 'center') return { ...state, center: to(gesture.origin) };
  if (gesture.kind === 'table') {
    const at = to(gesture.origin);
    return { ...state, tables: state.tables.map((t) => (t.id === gesture.tableId ? { ...t, ...at } : t)) };
  }
  return state;
}

export function SeatingPlanner({ initialState, initialGuests }: SeatingPlannerProps) {
  const seating = useSeatingPlan({ state: initialState, guests: initialGuests });
  const { state, guests } = seating.plan;
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const guestsById = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const seatedIds = useMemo(() => new Set(state.assignments.map((a) => a.guestId)), [state.assignments]);
  const unseated = useMemo(() => guests.filter((g) => !seatedIds.has(g.id)), [guests, seatedIds]);
  const seatedCount = guests.length - unseated.length;

  function finish(gesture: Gesture, drag: ActiveDrag | null) {
    if (!drag) {
      if (gesture.clickTableId) setSelectedId(gesture.clickTableId);
      return;
    }
    const to = (origin: { x: number; y: number }) => ({ x: origin.x + drag.delta.x, y: origin.y + drag.delta.y });
    if (gesture.kind === 'table') void seating.moveTable(gesture.tableId, to(gesture.origin));
    else if (gesture.kind === 'center') void seating.moveCenter(to(gesture.origin));
    else if (gesture.kind === 'guest') dropGuests(gesture, drag.target);
  }

  function dropGuests(gesture: Extract<Gesture, { kind: 'guest' }>, target: ActiveDrag['target']) {
    if (!target) return;
    const [guestId] = gesture.guestIds;
    if (gesture.household) {
      if (target.kind === 'unseat') return;
      void seating.move({ kind: 'household', guestIds: gesture.guestIds, tableId: target.tableId });
    } else if (target.kind === 'unseat') {
      if (seatedIds.has(guestId)) void seating.move({ kind: 'unseat', guestId });
    } else {
      void seating.move({
        kind: 'seat',
        guestId,
        tableId: target.tableId,
        ...(target.kind === 'chair' ? { seat: target.seat } : {}),
      });
    }
  }

  const drag = usePointerDrag(svgRef, finish);
  const shown = useMemo(() => withDragPreview(state, drag.active), [state, drag.active]);
  const dragTarget = drag.active?.gesture.kind === 'guest' ? drag.active.target : null;
  const highlightTableId = dragTarget && dragTarget.kind !== 'unseat' ? dragTarget.tableId : (selectedId ?? undefined);

  function onPointerDownTable(id: string, e: PointerEvent) {
    const table = state.tables.find((t) => t.id === id);
    if (!table) return;
    // The VIP tables are the ring: dragging either half moves the Centerstage with it.
    if (table.kind === 'VIP' || table.x == null || table.y == null) {
      drag.begin(e, { kind: 'center', origin: state.center, clickTableId: id });
    } else {
      drag.begin(e, { kind: 'table', tableId: id, origin: { x: table.x, y: table.y }, clickTableId: id });
    }
  }

  function onPointerDownChair(tableId: string, seat: number, e: PointerEvent) {
    const taken = state.assignments.find((a) => a.tableId === tableId && a.seat === seat);
    const guest = taken && guestsById.get(taken.guestId);
    if (!taken) return drag.begin(e, { kind: 'click', clickTableId: tableId });
    drag.begin(e, {
      kind: 'guest',
      guestIds: [taken.guestId],
      household: false,
      label: guest ? fullName(guest) : 'Guest',
      clickTableId: tableId,
    });
  }

  const selected = state.tables.find((t) => t.id === selectedId);
  const roundCount = state.tables.filter((t) => t.kind === 'ROUND').length;
  const tag = drag.active?.gesture.kind === 'guest' ? drag.active : null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-xs text-muted-foreground underline">
            ← Guest list
          </Link>
          <h1 className="text-xl font-semibold text-foreground">Seating plan</h1>
          <p className="text-sm text-muted-foreground">
            {seatedCount} of {guests.length} attending seated
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void seating.autoFill()} className={buttonClass}>
            Auto-fill VIP
          </button>
          <button type="button" disabled className={buttonClass}>
            Export JPG
          </button>
          <button type="button" disabled className={buttonClass}>
            Export spreadsheet
          </button>
        </div>
      </header>

      {seating.message && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm text-foreground">
          <span>{seating.message}</span>
          <button type="button" onClick={seating.dismissMessage} className="text-xs text-muted-foreground underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <UnseatedList
          guests={unseated}
          notFitted={seating.notFitted}
          onPointerDownGuest={(guest, e) =>
            drag.begin(e, { kind: 'guest', guestIds: [guest.id], household: false, label: fullName(guest) })
          }
          onPointerDownHousehold={(members, e) =>
            drag.begin(e, {
              kind: 'guest',
              guestIds: members.map((m) => m.id),
              household: true,
              label: `${members[0]?.partyLabel ?? 'Household'} · ${members.length}`,
            })
          }
        />
        <div className="space-y-3">
          <RoomControls key={roundCount} state={state} onSetRoundTables={(n, s) => void seating.setRoundTables(n, s)} />
          <div className="grid gap-3 xl:grid-cols-[1fr_16rem]">
            <FloorPlan
              ref={svgRef}
              state={shown}
              guestsById={guestsById}
              highlightTableId={highlightTableId}
              onPointerDownTable={onPointerDownTable}
              onPointerDownChair={onPointerDownChair}
              onPointerDownCenter={(e) => drag.begin(e, { kind: 'center', origin: state.center })}
            />
            {selected && (
              <TablePanel
                key={`${selected.id}:${selected.name}:${selected.seats}`}
                table={selected}
                seated={state.assignments.filter((a) => a.tableId === selected.id)}
                guestsById={guestsById}
                onRename={(name) => void seating.rename(selected.id, name)}
                onSeats={(seats) => void seating.setSeats(selected.id, seats)}
                onRemove={(guestId) => void seating.move({ kind: 'unseat', guestId })}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        </div>
      </div>

      {tag && (
        <div
          className="pointer-events-none fixed z-50 rounded-full bg-foreground px-3 py-1 text-xs text-background shadow"
          style={{ left: tag.client.x + 12, top: tag.client.y + 12 }}
        >
          {tag.gesture.kind === 'guest' ? tag.gesture.label : ''}
        </div>
      )}
    </div>
  );
}
