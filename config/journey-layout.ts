// Where each journey chapter's words and film sit inside the glass window.
// Measured on the v3 mockups; every number is a % of the window (the 04 frame),
// so it follows the window at any size. Photos come from the generated scene
// manifest (config/scene-layers.generated.ts); the words from content/chapters.ts.
export type WindowBox = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

// the window is 1522 x 718 px in the 1920 x 1080 mockup, at (194, 244)
const px = (x: number, y: number, w: number, h: number): WindowBox => ({
  x: ((x - 194) / 1522) * 100,
  y: ((y - 244) / 718) * 100,
  w: (w / 1522) * 100,
  h: (h / 718) * 100,
});

export type ChapterLayout = {
  /** Where the chapter's paragraphs go. */
  readonly text: WindowBox;
  /** Where the (optional) film plays. Its left edge and height are the same on every tab. */
  readonly video: WindowBox;
};

const video = (right: number) => px(256, 384, right - 256, 492);

export const chapterLayouts: readonly ChapterLayout[] = [
  { text: px(885, 680, 475, 155), video: video(845) },
  { text: px(730, 700, 560, 190), video: video(697) },
  { text: px(875, 410, 200, 430), video: video(844) },
  { text: px(680, 785, 750, 90), video: video(658) },
  { text: px(770, 465, 300, 325), video: video(725) },
];

/** The five tab labels' horizontal extent, in the 1920px mockup (x0, x1). */
export const tabSpans: readonly (readonly [number, number])[] = [
  [325, 515],
  [520, 725],
  [730, 935],
  [940, 1145],
  [1150, 1345],
];
