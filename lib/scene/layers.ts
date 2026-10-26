/**
 * Shapes for the desktop scenes' layer manifest. The data itself is generated
 * by scripts/design/prepare_assets.py into config/scene-layers.generated.ts.
 *
 * Positions are percentages of the 16:9 stage (not the viewport), so layers
 * stay locked to each other at any window size. `px` is the image's own pixel
 * size, for next/image.
 */

export interface SceneBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** An image placed on the stage. */
export interface SceneLayer extends SceneBox {
  readonly src: string;
  readonly px: readonly [number, number];
}

/** A full-stage image with no placement of its own. */
export interface SceneImage {
  readonly src: string;
  readonly px: readonly [number, number];
}

/** A point (and optional size) on the stage, for text and discs. */
export interface SceneAnchor {
  readonly cx: number;
  readonly cy: number;
  readonly size?: number;
  readonly d?: number;
}

export interface ScenePoint {
  readonly x: number;
  readonly y: number;
}

export interface SceneAssets {
  readonly [key: string]:
    | SceneLayer
    | SceneImage
    | SceneBox
    | SceneAnchor
    | ScenePoint
    | { readonly src: string }
    | { readonly [chapter: string]: readonly SceneLayer[] };
}

/** True when a box lies fully inside the stage. */
export function isInsideStage(box: SceneBox): boolean {
  return (
    box.x >= 0 && box.y >= 0 && box.x + box.w <= 100 && box.y + box.h <= 100
  );
}
