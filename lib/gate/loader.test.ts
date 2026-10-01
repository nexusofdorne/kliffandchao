import { describe, expect, it } from 'vitest';
import { computeLoaderPercent } from './loader';

describe('computeLoaderPercent', () => {
  it('is 0 at the start', () => {
    expect(computeLoaderPercent(0, 2000)).toBe(0);
  });

  it('is 100 once the duration elapses', () => {
    expect(computeLoaderPercent(2000, 2000)).toBe(100);
  });

  it('clamps to 100 past the duration, never exceeding it', () => {
    expect(computeLoaderPercent(5000, 2000)).toBe(100);
  });

  it('clamps to 0 for a negative elapsed time', () => {
    expect(computeLoaderPercent(-100, 2000)).toBe(0);
  });

  it('decelerates into 100 — past the midpoint already, not at 50%', () => {
    const atHalfTime = computeLoaderPercent(1000, 2000);
    expect(atHalfTime).toBeGreaterThan(50);
    expect(atHalfTime).toBeLessThan(100);
  });
});
