// How a journey chapter's photos fill the space beside its film. The photos sit in
// justified rows (every row spans the full width, each photo keeps its own shape, the
// rows keep the photos' order), drawn in CSS with flex-wrap: each photo grows in
// proportion to its aspect ratio from a basis of `aspect x rowHeight`, so a full row
// ends up (width - gaps) / sum(aspects) tall and the last row stays at `rowHeight`.
// This module picks the row height whose rows fill the space best, so a chapter with three
// photos gets big ones and a chapter with nine gets more rows, and where the words go among
// the photos (planGallery).
// Pure: sizes are plain numbers in any one unit.

export type MediaItem = {
  readonly src: string;
  /** The file's pixel size, [width, height]. */
  readonly px: readonly [number, number];
};

export type JourneyMedia = {
  readonly film: MediaItem | null;
  readonly photos: readonly MediaItem[];
};

export const aspectOf = (item: MediaItem) => item.px[0] / item.px[1];

/** Row heights the flex-wrap layout produces, for photos of these aspects at a basis row height. */
export function justifiedRows(
  aspects: readonly number[],
  width: number,
  rowHeight: number,
  gap: number,
): number[] {
  const rows: number[] = [];
  let sum = 0;
  let count = 0;
  for (const aspect of aspects) {
    const basis = aspect * rowHeight;
    const used = sum * rowHeight + gap * count;
    if (count > 0 && used + basis > width) {
      rows.push((width - gap * (count - 1)) / sum);
      sum = 0;
      count = 0;
    }
    sum += aspect;
    count += 1;
  }
  if (count > 0)
    rows.push(Math.min(rowHeight, (width - gap * (count - 1)) / sum));
  return rows;
}

/** How much space the photos cover in those rows (each photo is aspect x height²). */
export function justifiedArea(
  aspects: readonly number[],
  width: number,
  rowHeight: number,
  gap: number,
): number {
  const heights = justifiedRows(aspects, width, rowHeight, gap);
  let row = 0;
  let sum = 0;
  let count = 0;
  let area = 0;
  for (const aspect of aspects) {
    const used = sum * rowHeight + gap * count;
    if (count > 0 && used + aspect * rowHeight > width) {
      area += sum * heights[row] ** 2;
      row += 1;
      sum = 0;
      count = 0;
    }
    sum += aspect;
    count += 1;
  }
  return area + sum * (heights[row] ?? 0) ** 2;
}

/** The total height of those rows, gaps included. */
export function justifiedHeight(
  aspects: readonly number[],
  width: number,
  rowHeight: number,
  gap: number,
): number {
  const rows = justifiedRows(aspects, width, rowHeight, gap);
  return (
    rows.reduce((total, h) => total + h, 0) + gap * Math.max(0, rows.length - 1)
  );
}

/**
 * The tallest basis row height (at most `maxRowHeight`) whose rows fit in `width` x `height`.
 * Taller rows mean fewer photos per row and more rows, so the fit is found by bisection.
 */
export function fitRowHeight(
  aspects: readonly number[],
  box: { width: number; height: number },
  gap: number,
  maxRowHeight = box.height,
): number {
  if (aspects.length === 0 || box.width <= 0 || box.height <= 0) return 0;
  const fits = (h: number) =>
    justifiedHeight(aspects, box.width, h, gap) <= box.height + 0.5;
  if (fits(maxRowHeight)) return maxRowHeight;
  let lo = 1;
  let hi = maxRowHeight;
  if (!fits(lo)) return lo;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The basis row height whose rows fit `box` and cover the most of it with photos. */
export function bestRows(
  aspects: readonly number[],
  box: { width: number; height: number },
  gap: number,
): { rowHeight: number; area: number } {
  let best = { rowHeight: 0, area: 0 };
  if (aspects.length === 0 || box.width <= 0 || box.height <= 0) return best;
  for (let h = Math.floor(box.height); h >= 40; h -= 4) {
    if (justifiedHeight(aspects, box.width, h, gap) > box.height + 0.5)
      continue;
    const area = justifiedArea(aspects, box.width, h, gap);
    if (area > best.area) best = { rowHeight: h, area };
  }
  return best;
}

/**
 * Where a chapter's words go among its photos, as in the 3.0 designs:
 * - `column`: a narrow column of words, then the photos in rows beside it;
 * - `row`: the photos in rows, then a last row of the words with the last `tail` photo(s)
 *   beside them (the words take what the tail photos leave of the width).
 */
export type GalleryPlan =
  | { kind: 'column'; textWidth: number; rowHeight: number; area: number }
  | {
      kind: 'row';
      tail: number;
      tailHeight: number;
      textWidth: number;
      rowHeight: number;
      area: number;
    };

/**
 * Tries both arrangements at a range of sizes and keeps the one whose photos cover the most
 * of the space, with the words fitting where they are put. `textHeight(w)` is how tall the
 * words are at width `w`.
 */
export function planGallery({
  aspects,
  width,
  height,
  gap,
  textHeight,
  textColumns,
  minTextWidth,
}: {
  aspects: readonly number[];
  width: number;
  height: number;
  gap: number;
  textHeight: (width: number) => number;
  /** The widths a column of words may take. */
  textColumns: readonly number[];
  /** The narrowest the words may get beside the tail photos. */
  minTextWidth: number;
}): GalleryPlan {
  const n = aspects.length;
  let best: GalleryPlan = {
    kind: 'column',
    textWidth: textColumns[textColumns.length - 1] ?? width,
    rowHeight: 0,
    area: -1,
  };
  for (const textWidth of textColumns) {
    if (textHeight(textWidth) > height) continue;
    const rows = bestRows(
      aspects,
      { width: width - textWidth - gap, height },
      gap,
    );
    if (rows.area > best.area) best = { kind: 'column', textWidth, ...rows };
  }
  for (let tail = 1; tail <= Math.min(2, n); tail++) {
    const tailAspect = aspects.slice(n - tail).reduce((a, b) => a + b, 0);
    const rest = aspects.slice(0, n - tail);
    for (let tailHeight = 100; tailHeight <= height; tailHeight += 6) {
      const textWidth = width - tailAspect * tailHeight - gap * tail;
      if (textWidth < minTextWidth || textHeight(textWidth) > tailHeight)
        continue;
      const rows = bestRows(
        rest,
        { width, height: height - tailHeight - gap },
        gap,
      );
      if (rest.length > 0 && rows.rowHeight === 0) continue;
      const area = rows.area + tailAspect * tailHeight ** 2;
      if (area > best.area)
        best = {
          kind: 'row',
          tail,
          tailHeight,
          textWidth,
          rowHeight: rows.rowHeight,
          area,
        };
    }
  }
  return best;
}

/** A rough height for paragraphs of text set in `width`, for sharing space with the photos. */
export function estimateTextHeight(
  paragraphs: readonly string[],
  width: number,
  type: { charWidth: number; lineHeight: number; paragraphGap: number },
): number {
  const perLine = Math.max(1, Math.floor(width / type.charWidth));
  const lines = paragraphs.reduce(
    (total, p) => total + Math.max(1, Math.ceil(p.length / perLine)),
    0,
  );
  return (
    lines * type.lineHeight +
    type.paragraphGap * Math.max(0, paragraphs.length - 1)
  );
}
