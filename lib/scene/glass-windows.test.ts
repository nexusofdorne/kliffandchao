import { describe, expect, it } from 'vitest';
import {
  journeyWindow,
  plateBox,
  stageBox,
  weddingWindow,
  type GlassWindowSpec,
} from '../../config/glass-windows';
import { chapterLayouts } from '../../config/journey-layout';
import { journeyChapters } from '../../content/chapters';

const windows: [string, GlassWindowSpec][] = [
  ['journey', journeyWindow],
  ['wedding', weddingWindow],
];

describe.each(windows)('%s glass window', (_name, spec) => {
  it('lays the lights, five tabs and the empty segment left to right without overlapping', () => {
    const spans = [spec.lights, ...spec.tabs, spec.trail];
    expect(spec.tabs).toHaveLength(5);
    spans.forEach(([x0, x1], i) => {
      expect(x1).toBeGreaterThan(x0);
      if (i > 0) expect(x0).toBeGreaterThanOrEqual(spans[i - 1][1]);
    });
    expect(spans[0][0]).toBeGreaterThanOrEqual(spec.body.x0);
    expect(spans[spans.length - 1][1]).toBeLessThanOrEqual(spec.body.x1);
  });

  it('keeps the body inside the window box and the raised tab above the idle ones', () => {
    const { box, body, tabTop } = spec;
    expect(body.x0).toBeGreaterThanOrEqual(box.x);
    expect(body.x1).toBeLessThanOrEqual(box.x + box.w);
    expect(body.y0).toBeGreaterThan(box.y);
    expect(body.y1).toBeLessThanOrEqual(box.y + box.h);
    expect(tabTop.on).toBeLessThan(tabTop.idle);
    expect(tabTop.idle).toBeLessThan(body.y0);
    expect(tabTop.on).toBeGreaterThanOrEqual(box.y);
  });

  it('puts the plate inside the box, in percent', () => {
    const plate = plateBox(spec);
    expect(plate.x).toBeGreaterThan(0);
    expect(plate.y).toBeGreaterThan(0);
    expect(plate.x + plate.w).toBeLessThan(100);
    expect(plate.y + plate.h).toBeLessThanOrEqual(100);
  });

  it('keeps the window on the stage', () => {
    const box = stageBox(spec);
    expect(box.x).toBeGreaterThan(0);
    expect(box.y).toBeGreaterThan(0);
    expect(box.x + box.w).toBeLessThan(100);
    expect(box.y + box.h).toBeLessThan(100);
  });
});

describe('the journey window', () => {
  it('has a tab for every chapter, and is the box the chapters were laid out in', () => {
    expect(journeyWindow.tabs).toHaveLength(journeyChapters.length);
    expect(chapterLayouts).toHaveLength(journeyChapters.length);
    // config/journey-layout.ts measures every chapter against this 1522 x 718 box at (194, 244)
    expect(journeyWindow.box).toEqual({ x: 194, y: 244, w: 1522, h: 718 });
  });
});
