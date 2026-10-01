import { describe, expect, it } from 'vitest';
import {
  computeActiveSection,
  computeActiveStoryIndex,
  computeNavIndicatorPosition,
  computeParallaxOffset,
  computePanel,
  computeScrollBudget,
  computeSectionScrollTarget,
  computeSnapTarget,
  computeStoryScrollTarget,
} from './progress';

describe('computeScrollBudget', () => {
  it('budgets one screen to slide in, one per story, one screen to slide out', () => {
    const budget = computeScrollBudget(5); // 4 wheel screens + 2 slide screens = 6 total
    expect(budget.totalScreens).toBe(6);
    expect(budget.p1).toBeCloseTo(1 / 6);
    expect(budget.p2).toBeCloseTo(5 / 6);
  });
});

describe('computePanel', () => {
  const { p1, p2 } = computeScrollBudget(5);

  it('is 0 at the very start', () => {
    expect(computePanel(0, p1, p2)).toBe(0);
  });

  it('is exactly 1 at both phase boundaries (parked on journey)', () => {
    expect(computePanel(p1, p1, p2)).toBeCloseTo(1);
    expect(computePanel(p2, p1, p2)).toBeCloseTo(1);
  });

  it('stays at 1 throughout the story stretch', () => {
    expect(computePanel((p1 + p2) / 2, p1, p2)).toBe(1);
  });

  it('is 2 at the very end', () => {
    expect(computePanel(1, p1, p2)).toBeCloseTo(2);
  });

  it('is between 0 and 1 while sliding intro -> journey', () => {
    expect(computePanel(p1 / 2, p1, p2)).toBeCloseTo(0.5);
  });

  it('is between 1 and 2 while sliding journey -> wedding', () => {
    const mid = p2 + (1 - p2) / 2;
    expect(computePanel(mid, p1, p2)).toBeCloseTo(1.5);
  });
});

describe('computeSnapTarget', () => {
  const { p1, p2 } = computeScrollBudget(5);

  it('snaps to 0 just after the start', () => {
    expect(computeSnapTarget(p1 * 0.1, p1, p2)).toBe(0);
  });

  it('snaps to P1 just before the journey', () => {
    expect(computeSnapTarget(p1 * 0.9, p1, p2)).toBe(p1);
  });

  it('never snaps inside the story stretch — returns progress unchanged', () => {
    const mid = (p1 + p2) / 2;
    expect(computeSnapTarget(mid, p1, p2)).toBe(mid);
  });

  it('snaps to P2 just after the story stretch ends', () => {
    expect(computeSnapTarget(p2 + (1 - p2) * 0.1, p1, p2)).toBe(p2);
  });

  it('snaps to 1 just before the end', () => {
    expect(computeSnapTarget(p2 + (1 - p2) * 0.9, p1, p2)).toBe(1);
  });
});

describe('computeActiveStoryIndex', () => {
  const { p1, p2 } = computeScrollBudget(5);

  it('is story 0 at P1 (the journey just arrived)', () => {
    expect(computeActiveStoryIndex(p1, p1, p2, 5)).toBe(0);
  });

  it('is the last story at P2 (about to slide to wedding)', () => {
    expect(computeActiveStoryIndex(p2, p1, p2, 5)).toBe(4);
  });

  it('is clamped to 0 before P1 and to the last story after P2', () => {
    expect(computeActiveStoryIndex(0, p1, p2, 5)).toBe(0);
    expect(computeActiveStoryIndex(1, p1, p2, 5)).toBe(4);
  });
});

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

describe('computeSectionScrollTarget', () => {
  const { p1, p2 } = computeScrollBudget(5);
  const start = 100;
  const end = 2000;

  it('jumps to the track start for intro', () => {
    expect(computeSectionScrollTarget(0, p1, p2, start, end)).toBe(start);
  });

  it('jumps into the middle of the story stretch for journey, not its edge', () => {
    const span = end - start;
    expect(computeSectionScrollTarget(1, p1, p2, start, end)).toBeCloseTo(start + span * ((p1 + p2) / 2));
  });

  it('jumps just short of the track end for wedding', () => {
    expect(computeSectionScrollTarget(2, p1, p2, start, end)).toBe(end - 2);
  });
});

describe('computeStoryScrollTarget', () => {
  const { p1, p2 } = computeScrollBudget(5);
  const start = 100;
  const end = 2000;

  it('jumps to the start of the story stretch for story 0', () => {
    expect(computeStoryScrollTarget(0, 5, p1, p2, start, end)).toBeCloseTo(start + (end - start) * p1);
  });

  it('jumps to the end of the story stretch for the last story', () => {
    expect(computeStoryScrollTarget(4, 5, p1, p2, start, end)).toBeCloseTo(start + (end - start) * p2);
  });

  it('jumps to the midpoint of the story stretch for the middle story', () => {
    expect(computeStoryScrollTarget(2, 5, p1, p2, start, end)).toBeCloseTo(start + (end - start) * ((p1 + p2) / 2));
  });
});
