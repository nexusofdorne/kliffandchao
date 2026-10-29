// The two glass windows (the journey's and the wedding's), drawn in CSS by
// components/site/scene/GlassWindow.tsx. Every number is a pixel of the 1920 x
// 1080 mockup, measured on `04 - journey 0.jpg` and the 3.0 wedding references,
// so they stay in proportion at any screen size.

export type Span = readonly [number, number];

export type GlassWindowSpec = {
  /** The box the window's content is laid out in. */
  box: { x: number; y: number; w: number; h: number };
  /** The frosted body under the tabs. */
  body: { x0: number; x1: number; y0: number; y1: number };
  /** How far the inset plate sits in from the body's edge. */
  inset: number;
  /** The traffic-light segment, the tabs, and the empty segment after them, if any (left to right). */
  lights: Span;
  tabs: readonly Span[];
  trail?: Span;
  /** Where a tab's top edge is when it is raised ("on") and when it is not ("idle"). */
  tabTop: { on: number; idle: number };
};

// measured on the 3.0 journey references (3.0/reference screenshots/03 - journey 1.png)
export const journeyWindow: GlassWindowSpec = {
  box: { x: 348, y: 249, w: 1218, h: 530 },
  body: { x0: 348, x1: 1566, y0: 312, y1: 778 },
  inset: 13,
  lights: [348, 458],
  tabs: [
    [462, 636],
    [640, 806],
    [810, 977],
    [981, 1142],
    [1146, 1306],
  ],
  trail: [1310, 1566],
  tabTop: { on: 249, idle: 263 },
};

// six tabs, the last running to the body's right edge (3.0 "04 - wedding 1.png")
export const weddingWindow: GlassWindowSpec = {
  box: { x: 304, y: 250, w: 1312, h: 595 },
  body: { x0: 304, x1: 1616, y0: 314, y1: 842 },
  inset: 13,
  lights: [304, 420],
  tabs: [
    [424, 602],
    [606, 780],
    [784, 964],
    [968, 1144],
    [1148, 1324],
    [1328, 1616],
  ],
  tabTop: { on: 250, idle: 262 },
};

/** The window's box as % of the stage. */
export function stageBox(spec: GlassWindowSpec) {
  return {
    x: (spec.box.x / 1920) * 100,
    y: (spec.box.y / 1080) * 100,
    w: (spec.box.w / 1920) * 100,
    h: (spec.box.h / 1080) * 100,
  };
}

/** The inset plate as % of the window's box (where a tab's content goes). */
export function plateBox(spec: GlassWindowSpec) {
  const { box, body, inset } = spec;
  return {
    x: ((body.x0 + inset - box.x) / box.w) * 100,
    y: ((body.y0 + inset - box.y) / box.h) * 100,
    w: ((body.x1 - body.x0 - inset * 2) / box.w) * 100,
    h: ((body.y1 - body.y0 - inset * 2) / box.h) * 100,
  };
}
