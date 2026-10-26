// The two glass windows (the journey's and the wedding's), drawn in CSS by
// components/site/scene/GlassWindow.tsx. Every number is a pixel of the 1920 x
// 1080 mockup, measured on `04 - journey 0.jpg` and the wedding window image
// (docs/review/), so they stay in proportion at any screen size.

export type Span = readonly [number, number];

export type GlassWindowSpec = {
  /** The box the window's content is laid out in. */
  box: { x: number; y: number; w: number; h: number };
  /** The frosted body under the tabs. */
  body: { x0: number; x1: number; y0: number; y1: number };
  /** How far the inset plate sits in from the body's edge. */
  inset: number;
  /** The traffic-light segment, the tabs, and the empty segment after them (left to right). */
  lights: Span;
  tabs: readonly Span[];
  trail: Span;
  /** Where a tab's top edge is when it is raised ("on") and when it is not ("idle"). */
  tabTop: { on: number; idle: number };
};

export const journeyWindow: GlassWindowSpec = {
  box: { x: 194, y: 244, w: 1522, h: 718 },
  body: { x0: 196, x1: 1710, y0: 325, y1: 953 },
  inset: 13,
  lights: [196, 322],
  tabs: [
    [325, 515],
    [520, 725],
    [730, 935],
    [940, 1145],
    [1150, 1345],
  ],
  trail: [1355, 1710],
  tabTop: { on: 254, idle: 267 },
};

export const weddingWindow: GlassWindowSpec = {
  box: { x: 285, y: 255, w: 1355, h: 655 },
  body: { x0: 285, x1: 1640, y0: 327, y1: 905 },
  inset: 13,
  lights: [285, 400],
  tabs: [
    [402, 578],
    [582, 765],
    [770, 958],
    [962, 1145],
    [1150, 1330],
  ],
  trail: [1335, 1640],
  tabTop: { on: 262, idle: 273 },
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
