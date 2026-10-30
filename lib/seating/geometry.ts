// Room geometry for the seating planner. Pure functions, no UI.
// Screen coordinates: y grows downward, so clockwise = increasing angle, 0 = right, -PI/2 = top.

export type Point = { x: number; y: number };
// seat is 1-based; angle (radians) is the direction the chair sits from its table, for rotating it
export type ChairSpot = Point & { seat: number; angle: number };

export const ROOM = { width: 1000, height: 760 };

// VIP ring around the Centerstage, with openings at the top and bottom
export const RING = { radius: 150, band: 34, gapHalfAngle: 0.22 };

export const ROUND_TABLE_RADIUS = 36;
const CHAIR_OFFSET = 14;
const TABLE_RADII = { x: 400, y: 300 };
// keep a table (and its chairs) fully inside the room
const ROOM_MARGIN = ROUND_TABLE_RADIUS + CHAIR_OFFSET + 10;

const TOP = -Math.PI / 2;

function onCircle(center: Point, radius: number, angle: number): Point {
  return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
}

export function roundChairSpots(center: Point, seats: number): ChairSpot[] {
  const radius = ROUND_TABLE_RADIUS + CHAIR_OFFSET;
  return Array.from({ length: Math.max(0, seats) }, (_, i) => {
    const angle = TOP + (2 * Math.PI * i) / seats;
    return { ...onCircle(center, radius, angle), seat: i + 1, angle };
  });
}

// VIP 1 is the left half (top opening down the left side to the bottom opening, so its angles
// decrease); VIP 2 is the right half (angles increase). Seat 1 is next to the top opening.
export function vipArc(half: 1 | 2): { start: number; end: number } {
  const gap = RING.gapHalfAngle;
  return half === 2
    ? { start: TOP + gap, end: Math.PI / 2 - gap }
    : { start: TOP - gap, end: -(3 * Math.PI) / 2 + gap };
}

export function vipChairSpots(center: Point, half: 1 | 2, seats: number): ChairSpot[] {
  const radius = RING.radius + RING.band / 2 + CHAIR_OFFSET;
  const { start, end } = vipArc(half);
  return Array.from({ length: Math.max(0, seats) }, (_, i) => {
    const angle = start + ((end - start) * (i + 0.5)) / seats;
    return { ...onCircle(center, radius, angle), seat: i + 1, angle };
  });
}

export function defaultRoundTablePositions(count: number, center: Point): Point[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const angle = TOP + (2 * Math.PI * i) / count;
    return {
      x: center.x + TABLE_RADII.x * Math.cos(angle),
      y: center.y + TABLE_RADII.y * Math.sin(angle),
    };
  });
}

export function clampToRoom(p: Point): Point {
  return {
    x: Math.min(ROOM.width - ROOM_MARGIN, Math.max(ROOM_MARGIN, p.x)),
    y: Math.min(ROOM.height - ROOM_MARGIN, Math.max(ROOM_MARGIN, p.y)),
  };
}

// The default slot for the next table number that is farthest from every existing table
export function nextRoundTablePosition(existing: Point[], center: Point): Point {
  const slots = defaultRoundTablePositions(existing.length + 1, center).map(clampToRoom);
  let best = slots[0];
  let bestDistance = -Infinity;
  for (const slot of slots) {
    const nearest = Math.min(...existing.map((e) => Math.hypot(e.x - slot.x, e.y - slot.y)));
    if (nearest > bestDistance) {
      best = slot;
      bestDistance = nearest;
    }
  }
  return best;
}
