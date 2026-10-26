import { describe, expect, it } from 'vitest';
import {
  computeActiveSection,
  computeNavIndicatorPosition,
  computeParallaxOffset,
} from './progress';

describe('computeActiveSection', () => {
  it('is intro (0) while sliding toward the journey', () => {
    expect(computeActiveSection(0.4)).toBe(0);
  });

  it('is journey (1) once parked', () => {
    expect(computeActiveSection(1)).toBe(1);
  });

  it('is wedding (2) once past the midpoint of the final slide', () => {
    expect(computeActiveSection(1.6)).toBe(2);
  });
});

describe('computeParallaxOffset', () => {
  it('is 0 when the panel is centred on its own layer', () => {
    expect(computeParallaxOffset(1, 1, 1280, 0.18)).toBe(0);
  });

  it('trails by a fraction of the viewport width otherwise', () => {
    expect(computeParallaxOffset(0.5, 1, 1000, 0.18)).toBeCloseTo(-90);
  });
});

describe('computeNavIndicatorPosition', () => {
  it('sits at the left edge for the intro section', () => {
    const { x } = computeNavIndicatorPosition(0, 300);
    expect(x).toBe(0);
  });

  it('sits at the right edge for the wedding section', () => {
    const { x, width } = computeNavIndicatorPosition(2, 300);
    expect(x).toBeCloseTo(300 - 6 - width);
  });

  it('sits in the middle third for the journey section', () => {
    const { x, width } = computeNavIndicatorPosition(1, 300);
    expect(x).toBeCloseTo(width);
  });
});
