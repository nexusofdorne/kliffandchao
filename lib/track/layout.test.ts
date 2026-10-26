import { describe, expect, it } from 'vitest';
import { resolveStoryLayout } from './layout';

describe('story layout preferences', () => {
  it.each([
    [false, false, 'scenes'],
    [false, true, 'scenes'],
    [true, false, 'mobile'],
    [true, true, 'reduced'],
  ] as const)(
    'mobile=%s reduced motion=%s -> %s (wide screens always get the scene engine)',
    (mobile, reduced, expected) => {
      expect(resolveStoryLayout(mobile, reduced)).toBe(expected);
    },
  );
});
