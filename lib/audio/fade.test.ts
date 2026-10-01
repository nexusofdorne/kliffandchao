import { describe, expect, it } from 'vitest';
import { computeFadeVolume } from './fade';

describe('computeFadeVolume', () => {
  it('is 0 at the start', () => {
    expect(computeFadeVolume(0, 1500, 0.55)).toBe(0);
  });

  it('reaches the target volume once the duration elapses', () => {
    expect(computeFadeVolume(1500, 1500, 0.55)).toBeCloseTo(0.55);
  });

  it('clamps to the target volume past the duration', () => {
    expect(computeFadeVolume(3000, 1500, 0.55)).toBeCloseTo(0.55);
  });

  it('is linear: halfway through time is halfway through volume', () => {
    expect(computeFadeVolume(750, 1500, 0.55)).toBeCloseTo(0.275);
  });
});
