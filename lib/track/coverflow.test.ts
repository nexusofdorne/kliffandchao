import { describe, expect, it } from 'vitest';
import { computeCardTransform, computeStepTarget } from './coverflow';

describe('computeCardTransform', () => {
  const cardWidth = 400;
  const stride = cardWidth * 1.18;

  it('centres the active card at full scale and opacity', () => {
    const t = computeCardTransform(0, cardWidth);
    expect(t.translateX).toBe(0);
    expect(t.scale).toBe(1);
    expect(t.opacity).toBe(1);
    expect(t.isActive).toBe(true);
  });

  it('offsets ±1 sit one stride away, scaled and dimmed', () => {
    const right = computeCardTransform(1, cardWidth);
    const left = computeCardTransform(-1, cardWidth);
    expect(right.translateX).toBeCloseTo(stride);
    expect(left.translateX).toBeCloseTo(-stride);
    expect(right.scale).toBeCloseTo(0.84);
    expect(left.scale).toBeCloseTo(0.84);
    expect(right.opacity).toBeCloseTo(0.62);
    expect(right.isActive).toBe(false);
  });

  it('offset ±3 is the dimmest and smallest card still individually positioned', () => {
    const t = computeCardTransform(3, cardWidth);
    expect(t.translateX).toBeCloseTo(stride * 3);
    expect(t.scale).toBeCloseTo(0.72);
    expect(t.opacity).toBeCloseTo(0.26);
  });

  it('beyond ±3 is parked off-stage at zero opacity', () => {
    const t = computeCardTransform(4, cardWidth);
    expect(t.translateX).toBeCloseTo(stride * 3);
    expect(t.scale).toBe(0.7);
    expect(t.opacity).toBe(0);
    expect(t.zIndex).toBe(0);

    const farLeft = computeCardTransform(-9, cardWidth);
    expect(farLeft.translateX).toBeCloseTo(-stride * 3);
    expect(farLeft.opacity).toBe(0);
  });

  it('z-index decreases with distance from the active card', () => {
    expect(computeCardTransform(0, cardWidth).zIndex).toBe(50);
    expect(computeCardTransform(1, cardWidth).zIndex).toBe(49);
    expect(computeCardTransform(-2, cardWidth).zIndex).toBe(48);
  });
});

describe('computeStepTarget', () => {
  it('clamps at the first story', () => {
    expect(computeStepTarget(0, -1, 5)).toBe(0);
  });

  it('clamps at the last story', () => {
    expect(computeStepTarget(4, 1, 5)).toBe(4);
  });

  it('steps by one otherwise', () => {
    expect(computeStepTarget(2, 1, 5)).toBe(3);
    expect(computeStepTarget(2, -1, 5)).toBe(1);
  });
});
