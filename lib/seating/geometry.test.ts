import { describe, expect, it } from 'vitest';
import {
  ROOM,
  RING,
  defaultRoundTablePositions,
  nextRoundTablePosition,
  roundChairSpots,
  vipArc,
  vipChairSpots,
} from './geometry';

describe('seating geometry', () => {
  it('numbers round-table chairs clockwise from the top', () => {
    const spots = roundChairSpots({ x: 0, y: 0 }, 4);
    expect(spots.map((s) => s.seat)).toEqual([1, 2, 3, 4]);
    expect(spots[0].y).toBeLessThan(0); // top
    expect(spots[1].x).toBeGreaterThan(0); // then right
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
      expect(Math.abs(s.x)).toBeGreaterThan(20); // nothing straight above or below the centre
    }
  });

  it('returns exactly as many spots as seats, and none for zero', () => {
    expect(roundChairSpots({ x: 0, y: 0 }, 12)).toHaveLength(12);
    expect(vipChairSpots({ x: 0, y: 0 }, 1, 0)).toEqual([]);
    expect(roundChairSpots({ x: 0, y: 0 }, 0)).toEqual([]);
  });

  it('numbers VIP seats from 1 and places chairs outside the ring', () => {
    const c = { x: 0, y: 0 };
    const spots = vipChairSpots(c, 2, 5);
    expect(spots.map((s) => s.seat)).toEqual([1, 2, 3, 4, 5]);
    for (const s of spots) {
      expect(Math.hypot(s.x, s.y)).toBeCloseTo(RING.radius + RING.band / 2 + 14);
    }
  });

  it('keeps each VIP arc clear of the top and bottom openings', () => {
    const a1 = vipArc(1);
    const a2 = vipArc(2);
    expect(a2.start).toBeCloseTo(-Math.PI / 2 + RING.gapHalfAngle);
    expect(a2.end).toBeCloseTo(Math.PI / 2 - RING.gapHalfAngle);
    expect(a1.start).toBeCloseTo(-Math.PI / 2 - RING.gapHalfAngle);
    expect(a1.end).toBeCloseTo(-(3 * Math.PI) / 2 + RING.gapHalfAngle);
  });

  it('spreads default round tables around the middle, first at the top', () => {
    const ps = defaultRoundTablePositions(8, { x: 500, y: 380 });
    expect(ps).toHaveLength(8);
    expect(ps[0].y).toBeLessThan(380);
    expect(ps[1].x).toBeGreaterThan(500); // clockwise
  });

  it('picks the next table slot farthest from the existing tables', () => {
    const center = { x: 500, y: 380 };
    expect(nextRoundTablePosition([], center)).toEqual(defaultRoundTablePositions(1, center)[0]);
    const existing = defaultRoundTablePositions(4, center);
    const next = nextRoundTablePosition(existing, center);
    const slots = defaultRoundTablePositions(5, center);
    const minDist = (p: { x: number; y: number }) =>
      Math.min(...existing.map((e) => Math.hypot(e.x - p.x, e.y - p.y)));
    expect(minDist(next)).toBeCloseTo(Math.max(...slots.map(minDist)));
  });

  it('keeps the next table inside the room', () => {
    const next = nextRoundTablePosition([], { x: 10, y: 10 });
    expect(next.x).toBeGreaterThan(0);
    expect(next.y).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(ROOM.width);
    expect(next.y).toBeLessThan(ROOM.height);
  });
});
