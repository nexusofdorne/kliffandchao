import { describe, expect, it } from 'vitest';
import {
  journeyWindow,
  plateBox,
  stageBox,
  weddingWindow,
  type GlassWindowSpec,
} from '../../config/glass-windows';
import { journeyMedia } from '../../config/journey-media.generated';
import { journeyChapters } from '../../content/chapters';

const windows: [string, GlassWindowSpec][] = [
  ['journey', journeyWindow],
  ['wedding', weddingWindow],
];

describe.each(windows)('%s glass window', (_name, spec) => {
  it('lays the lights, the tabs and any empty segment left to right without overlapping', () => {
    const spans = [
      spec.lights,
      ...spec.tabs,
      ...(spec.trail ? [spec.trail] : []),
    ];
    expect(spec.tabs.length).toBeGreaterThanOrEqual(5);
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
  it('has a tab and a set of media for every chapter', () => {
    expect(journeyWindow.tabs).toHaveLength(journeyChapters.length);
    expect(journeyMedia).toHaveLength(journeyChapters.length);
  });
});

describe('the wedding window', () => {
  it('has six tabs, the last one running to the edge', () => {
    expect(weddingWindow.tabs).toHaveLength(6);
    expect(weddingWindow.trail).toBeUndefined();
    expect(weddingWindow.tabs[5][1]).toBe(weddingWindow.body.x1);
  });
});
