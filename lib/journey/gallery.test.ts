import { describe, expect, it } from 'vitest';
import {
  estimateTextHeight,
  fitRowHeight,
  justifiedArea,
  justifiedHeight,
  justifiedRows,
  planGallery,
} from './gallery';

describe('justifiedRows', () => {
  it('stretches a full row to the width and leaves the last row at the basis height', () => {
    // two 1:1 photos at 100 fill 210 of 300 with a 10 gap; the third does not fit
    const rows = justifiedRows([1, 1, 1], 300, 100, 10);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBeCloseTo(145); // (300 - 10) / 2
    expect(rows[1]).toBe(100);
  });

  it('shrinks a single photo wider than the space to fit it', () => {
    expect(justifiedRows([4], 200, 100, 10)).toEqual([50]);
  });
});

describe('fitRowHeight', () => {
  it('keeps the largest row height when everything already fits', () => {
    expect(
      fitRowHeight([1.5, 1.5], { width: 1000, height: 400 }, 10, 200),
    ).toBe(200);
  });

  it('finds a row height whose rows fit the box', () => {
    const aspects = [1.5, 0.8, 1.33, 1.5, 0.75, 1, 1.5, 1.33, 1.2];
    const box = { width: 900, height: 360 };
    const h = fitRowHeight(aspects, box, 12);
    expect(justifiedHeight(aspects, box.width, h, 12)).toBeLessThanOrEqual(
      box.height + 0.5,
    );
    expect(justifiedHeight(aspects, box.width, h + 4, 12)).toBeGreaterThan(
      box.height,
    );
  });

  it('returns 0 with no photos or no room', () => {
    expect(fitRowHeight([], { width: 100, height: 100 }, 8)).toBe(0);
    expect(fitRowHeight([1], { width: 0, height: 100 }, 8)).toBe(0);
  });
});

describe('planGallery', () => {
  const words = (w: number) => 2400 / w; // a block of text: narrower is taller

  it('puts the words beside the last photo when that covers more of the space', () => {
    const plan = planGallery({
      aspects: [1.5, 1.5, 1.33, 1.5, 0.75, 1, 1.5, 1.33, 1.2],
      width: 800,
      height: 380,
      gap: 12,
      textHeight: words,
      textColumns: [200],
      minTextWidth: 300,
    });
    expect(plan.area).toBeGreaterThan(0);
    if (plan.kind === 'row') {
      expect(words(plan.textWidth)).toBeLessThanOrEqual(plan.tailHeight);
      expect(plan.textWidth).toBeGreaterThanOrEqual(300);
    }
  });

  it('never chooses a column the words do not fit in', () => {
    const plan = planGallery({
      aspects: [0.75, 0.75],
      width: 800,
      height: 300,
      gap: 12,
      textHeight: (w) => (w < 250 ? 1000 : 200),
      textColumns: [200, 260],
      minTextWidth: 10000,
    });
    expect(plan).toMatchObject({ kind: 'column', textWidth: 260 });
  });
});

describe('justifiedArea', () => {
  it('adds up each photo as aspect x row height squared', () => {
    // one full row of two squares: (300 - 10) / 2 = 145 tall
    expect(justifiedArea([1, 1, 1], 300, 100, 10)).toBeCloseTo(
      2 * 145 ** 2 + 100 ** 2,
    );
  });
});

describe('estimateTextHeight', () => {
  it('counts wrapped lines per paragraph plus the gaps between them', () => {
    const type = { charWidth: 10, lineHeight: 20, paragraphGap: 5 };
    // 100 px wide = 10 chars a line: 25 chars -> 3 lines, 5 chars -> 1 line
    expect(estimateTextHeight(['x'.repeat(25), 'y'.repeat(5)], 100, type)).toBe(
      4 * 20 + 5,
    );
  });
});
