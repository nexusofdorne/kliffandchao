import { describe, expect, it } from 'vitest';
import {
  ARRIVAL_BACK,
  NEARNESS,
  RIVER_LAG,
  WORLD_KINDS,
  arrivalCamera,
  crossingBackdrop,
  crossingCamera,
  crossingFront,
  perspectiveScale,
} from './world';

describe('perspectiveScale', () => {
  it('leaves every layer as painted at c = 0 and never moves the sky', () => {
    for (const kind of WORLD_KINDS) expect(perspectiveScale(NEARNESS[kind], 0)).toBe(1);
    expect(perspectiveScale(NEARNESS.sky, 1)).toBe(1);
    expect(perspectiveScale(NEARNESS.sky, -1)).toBe(1);
  });

  it('grows nearer layers faster going forward and shrinks them going back', () => {
    const forward = WORLD_KINDS.map((k) => perspectiveScale(NEARNESS[k], 0.8));
    expect([...forward].sort((a, b) => a - b)).toEqual(forward);
    expect(forward[forward.length - 1]).toBeGreaterThan(forward[0]);
    for (const kind of WORLD_KINDS.slice(1)) {
      expect(perspectiveScale(NEARNESS[kind], -0.3)).toBeLessThan(1);
    }
  });

  it('stays finite when a layer reaches the lens', () => {
    expect(Number.isFinite(perspectiveScale(0.9, 5))).toBe(true);
  });
});

describe('the cameras', () => {
  it('arrives from a little way back and rests at the painting', () => {
    expect(arrivalCamera(0)).toEqual({ journey: ARRIVAL_BACK, wedding: 0 });
    expect(arrivalCamera(1).journey).toBeCloseTo(0, 10);
    expect(arrivalCamera(0.5).journey).toBeCloseTo(ARRIVAL_BACK / 2, 10);
  });

  it('crosses from the meadow at rest to the river at rest, one move apart', () => {
    expect(crossingCamera(0)).toEqual({ journey: 0, wedding: -RIVER_LAG });
    expect(crossingCamera(1)).toEqual({ journey: 1, wedding: 0 });
    const mid = crossingCamera(0.5);
    expect(mid.wedding).toBeLessThan(0);
    expect(mid.wedding).toBeGreaterThan(-RIVER_LAG);
  });

  it('starts and ends with exactly one scene showing', () => {
    expect(crossingBackdrop(0)).toBe(1);
    expect(crossingFront(0)).toBe(0);
    expect(crossingBackdrop(1)).toBe(0);
    expect(crossingFront(1)).toBe(1);
  });

  it('turns the sky before the river plants appear', () => {
    for (const p of [0.2, 0.3, 0.4]) {
      expect(1 - crossingBackdrop(p)).toBeGreaterThanOrEqual(crossingFront(p));
    }
  });
});
