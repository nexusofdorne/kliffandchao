import { describe, expect, it } from 'vitest';
import { easeInOutCubic, project, ridingFrame, zoomFrame } from './camera';

// Measured on the mockups (see config/scene-layers.generated.ts): the monitor
// screen centre on 01, the terminal screen centre on 02, and the size ratio.
const origin = { x: 48.63, y: 36.97 };
const target = { x: 50, y: 50 };
const ratio = 5.17 / 90.54;
const finalScale = 1 / ratio;

describe('easeInOutCubic', () => {
  it('is 0 at the start, 1 at the end and symmetric around the middle', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1);
  });
});

describe('zoomFrame', () => {
  it('starts as the identity with no blur', () => {
    const f = zoomFrame(0, origin, target, finalScale);
    expect(f).toEqual({ scale: 1, x: 0, y: 0, blur: 0 });
  });

  it('ends with the monitor screen centre on the target and the full scale', () => {
    const f = zoomFrame(1, origin, target, finalScale);
    expect(f.scale).toBeCloseTo(finalScale);
    const p = project(f, origin);
    expect(p.x).toBeCloseTo(target.x);
    expect(p.y).toBeCloseTo(target.y);
  });

  it('keeps the monitor centre on the straight line from origin to target', () => {
    for (const t of [0.2, 0.5, 0.8]) {
      const f = zoomFrame(t, origin, target, finalScale);
      const p = project(f, origin);
      // (p - origin) is parallel to (target - origin)
      const cross =
        (p.x - origin.x) * (target.y - origin.y) -
        (p.y - origin.y) * (target.x - origin.x);
      expect(Math.abs(cross)).toBeLessThan(1e-9);
    }
  });

  it('grows the scale monotonically', () => {
    let last = 0;
    for (let i = 0; i <= 30; i++) {
      const { scale } = zoomFrame(i / 30, origin, target, finalScale);
      expect(scale).toBeGreaterThanOrEqual(last);
      last = scale;
    }
  });

  it('delays the blur and divides it by the scale so it reads as maxBlur on screen', () => {
    expect(zoomFrame(0.05, origin, target, finalScale).blur).toBe(0);
    const f = zoomFrame(0.6, origin, target, finalScale, 16);
    expect(f.blur * f.scale).toBeLessThanOrEqual(16 + 1e-9);
    expect(f.blur).toBeGreaterThan(0);
  });

  it('clamps t outside 0..1', () => {
    expect(zoomFrame(-1, origin, target, finalScale)).toEqual(
      zoomFrame(0, origin, target, finalScale),
    );
    expect(zoomFrame(2, origin, target, finalScale).scale).toBeCloseTo(
      finalScale,
    );
  });
});

describe('ridingFrame', () => {
  it('starts with the terminal centre sitting on the monitor screen centre, shrunk to its size', () => {
    const f = ridingFrame(0, origin, target, ratio);
    expect(f.scale).toBeCloseTo(ratio);
    const p = project(f, target);
    expect(p.x).toBeCloseTo(origin.x);
    expect(p.y).toBeCloseTo(origin.y);
  });

  it('ends as the identity, filling the stage', () => {
    const f = ridingFrame(1, origin, target, ratio);
    expect(f.scale).toBeCloseTo(1);
    expect(f.x).toBeCloseTo(0);
    expect(f.y).toBeCloseTo(0);
  });

  it('stays locked to the monitor screen centre as the outer scene moves', () => {
    for (const t of [0.1, 0.4, 0.7, 0.9]) {
      const outer = project(zoomFrame(t, origin, target, finalScale), origin);
      const inner = project(ridingFrame(t, origin, target, ratio), target);
      expect(inner.x).toBeCloseTo(outer.x);
      expect(inner.y).toBeCloseTo(outer.y);
    }
  });
});
