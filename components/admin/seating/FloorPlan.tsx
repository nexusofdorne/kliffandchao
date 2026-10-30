'use client';

import { forwardRef, type PointerEvent } from 'react';
import {
  RING,
  ROOM,
  VIP_CHAIR_SIZE,
  ROUND_TABLE_RADIUS,
  roundChairSpots,
  vipArc,
  vipChairSpots,
  type ChairSpot,
  type Point,
} from '@/lib/seating/geometry';
import type { Assignment, SeatableGuest, SeatingState, SeatingTable } from '@/lib/seating/rules';

type FloorPlanProps = {
  state: SeatingState;
  guestsById: Map<string, SeatableGuest>;
  highlightTableId?: string;
  onPointerDownTable(id: string, e: PointerEvent): void;
  onPointerDownChair(tableId: string, seat: number, e: PointerEvent): void;
  onPointerDownCenter(e: PointerEvent): void;
};

const COLORS = {
  room: '#f6f4ee',
  chairTaken: '#c9b98f',
  chairFree: '#efe9da',
  chairStroke: '#b49a5a',
  ring: '#d9c9a0',
  ringText: '#6b5a2b',
  table: '#fff',
  tableStroke: '#999',
  tableFull: '#4f7a3a',
  over: '#c0392b',
  highlight: '#2f6fdf',
  leaf: '#e8efe0',
  leafStroke: '#8aa36a',
  stage: '#f4f7ef',
  stageText: '#55693c',
};

const ROUND_CHAIR = 12;
const NAME_LENGTH = 12;

function shortName(name: string): string {
  return name.length > NAME_LENGTH ? `${name.slice(0, NAME_LENGTH - 1)}…` : name;
}

function arcPath(center: Point, radius: number, start: number, end: number): string {
  const at = (a: number) => `${center.x + radius * Math.cos(a)} ${center.y + radius * Math.sin(a)}`;
  const large = Math.abs(end - start) > Math.PI ? 1 : 0;
  const sweep = end > start ? 1 : 0;
  return `M ${at(start)} A ${radius} ${radius} 0 ${large} ${sweep} ${at(end)}`;
}

// Chairs to draw: one per seat, plus any taken chair past the end (only while a change is saving).
function chairCount(table: SeatingTable, seated: Assignment[]): number {
  return Math.max(table.seats, ...seated.map((a) => a.seat));
}

// The room as SVG in floor-plan units (ROOM). Drop targets are marked for lib/seating/drag:
// data-drop-table on a table body or VIP arc, data-drop-seat on a chair.
export const FloorPlan = forwardRef<SVGSVGElement, FloorPlanProps>(function FloorPlan(
  { state, guestsById, highlightTableId, onPointerDownTable, onPointerDownChair, onPointerDownCenter },
  ref,
) {
  const seatedAt = (tableId: string) => state.assignments.filter((a) => a.tableId === tableId);

  function chairs(table: SeatingTable, spots: ChairSpot[], size: number, seated: Assignment[]) {
    return spots.map((spot) => {
      const guest = seated.find((a) => a.seat === spot.seat);
      const person = guest && guestsById.get(guest.guestId);
      return (
        <rect
          key={spot.seat}
          data-drop-seat={`${table.id}:${spot.seat}`}
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          rx={size / 3}
          transform={`translate(${spot.x},${spot.y}) rotate(${(spot.angle * 180) / Math.PI + 90})`}
          fill={guest ? COLORS.chairTaken : COLORS.chairFree}
          stroke={COLORS.chairStroke}
          strokeWidth={0.8}
          style={{ cursor: guest ? 'grab' : 'pointer' }}
          onPointerDown={(e) => onPointerDownChair(table.id, spot.seat, e)}
        >
          <title>{`${person ? `${person.firstName} ${person.lastName}` : guest ? 'Guest' : `Seat ${spot.seat}`} · ${table.name}`}</title>
        </rect>
      );
    });
  }

  const vipTables = ([1, 2] as const).map((half) => ({
    half,
    table: state.tables.find((t) => t.kind === 'VIP' && t.number === half),
  }));
  const roundTables = state.tables.filter((t) => t.kind === 'ROUND' && t.x != null && t.y != null);
  const c = state.center;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${ROOM.width} ${ROOM.height}`}
      width="100%"
      className="rounded-lg"
      style={{ background: COLORS.room, touchAction: 'none', userSelect: 'none' }}
      fontFamily="system-ui, sans-serif"
    >
      <rect x={0} y={0} width={ROOM.width} height={ROOM.height} fill={COLORS.room} />

      {roundTables.map((table) => {
        const seated = seatedAt(table.id);
        const at = { x: table.x!, y: table.y! };
        const over = seated.length > table.seats;
        const full = !over && table.seats > 0 && seated.length === table.seats;
        const highlighted = table.id === highlightTableId;
        return (
          <g key={table.id}>
            {chairs(table, roundChairSpots(at, chairCount(table, seated)), ROUND_CHAIR, seated)}
            <g
              data-drop-table={table.id}
              style={{ cursor: 'grab' }}
              onPointerDown={(e) => onPointerDownTable(table.id, e)}
            >
              <title>{table.name}</title>
              <circle
                cx={at.x}
                cy={at.y}
                r={ROUND_TABLE_RADIUS}
                fill={COLORS.table}
                stroke={highlighted ? COLORS.highlight : over ? COLORS.over : full ? COLORS.tableFull : COLORS.tableStroke}
                strokeWidth={highlighted ? 3 : 2}
                strokeDasharray={over ? '5 3' : undefined}
              />
              <text x={at.x} y={at.y - 2} textAnchor="middle" fontSize={12} fontWeight={600} fill="#333">
                {shortName(table.name)}
              </text>
              <text x={at.x} y={at.y + 13} textAnchor="middle" fontSize={11} fill={over ? COLORS.over : '#666'}>
                {seated.length}/{table.seats}
              </text>
            </g>
          </g>
        );
      })}

      {vipTables.map(({ half, table }) => {
        if (!table) return null;
        const seated = seatedAt(table.id);
        const { start, end } = vipArc(half);
        const path = arcPath(c, RING.radius, start, end);
        const over = seated.length > table.seats;
        const highlighted = table.id === highlightTableId;
        const labelX = c.x + (half === 1 ? -RING.radius : RING.radius);
        return (
          <g key={table.id}>
            {chairs(table, vipChairSpots(c, half, chairCount(table, seated)), VIP_CHAIR_SIZE, seated)}
            <g
              data-drop-table={table.id}
              style={{ cursor: 'grab' }}
              onPointerDown={(e) => onPointerDownTable(table.id, e)}
            >
              <title>{table.name}</title>
              <path d={path} fill="none" stroke={COLORS.ring} strokeWidth={RING.band} strokeLinecap="round" />
              <path
                d={path}
                fill="none"
                stroke={highlighted ? COLORS.highlight : over ? COLORS.over : COLORS.chairStroke}
                strokeWidth={highlighted ? 2.5 : 1.2}
                strokeDasharray={over ? '5 3' : undefined}
              />
              <text x={labelX} y={c.y - 3} textAnchor="middle" fontSize={14} fontWeight={600} fill={COLORS.ringText}>
                {shortName(table.name)}
              </text>
              <text x={labelX} y={c.y + 13} textAnchor="middle" fontSize={12} fill={over ? COLORS.over : COLORS.ringText}>
                {seated.length}/{table.seats}
              </text>
            </g>
          </g>
        );
      })}

      <g style={{ cursor: 'grab' }} onPointerDown={onPointerDownCenter}>
        <title>Centerstage</title>
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <circle
              key={i}
              cx={c.x + Math.cos(a) * 49}
              cy={c.y + Math.sin(a) * 49}
              r={21}
              fill={COLORS.leaf}
              stroke={COLORS.leafStroke}
              strokeWidth={1}
            />
          );
        })}
        <circle cx={c.x} cy={c.y} r={33} fill={COLORS.stage} stroke={COLORS.leafStroke} strokeWidth={1} />
        <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize={12} fill={COLORS.stageText}>
          Centerstage
        </text>
      </g>
    </svg>
  );
});
