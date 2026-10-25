import { describe, expect, it } from 'vitest';
import { resolveStoryLayout } from './layout';

describe('story layout preferences', () => {
  it.each([
    [false, false, 'horizontal'],
    [true, false, 'mobile'],
    [false, true, 'reduced'],
    [true, true, 'reduced'],
  ] as const)(
    'uses the correct layout for mobile=%s and reduced motion=%s',
    (mobile, reduced, expected) => {
      expect(resolveStoryLayout(mobile, reduced)).toBe(expected);
    },
  );
});
