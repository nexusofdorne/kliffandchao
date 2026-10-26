import { describe, expect, it } from 'vitest';
import { phoneStoryUrl, resolveStoryLayout } from './layout';

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

describe('phone story address', () => {
  it('is the published phone page, with the scene or the next page as a query', () => {
    expect(phoneStoryUrl()).toBe('/m/index.html');
    expect(phoneStoryUrl({ scene: '3' })).toBe('/m/index.html?scene=3');
    expect(phoneStoryUrl({ next: '/rsvp' })).toBe('/m/index.html?next=%2Frsvp');
  });
});
