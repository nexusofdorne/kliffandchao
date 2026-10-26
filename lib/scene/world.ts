// The camera for the meadow and the river: both paintings are cut into depth
// layers (scripts/design/build_world.py) and the camera moves forward by scaling
// each layer about the vanishing point, the nearer ones faster. Pure, so the
// numbers can be unit tested; WorldScene applies them as transforms.

/** `glint` is the river's moving ripple highlights; the other five are depth layers. */
export type WorldKind = 'sky' | 'far' | 'mid' | 'near' | 'fore' | 'glint';
export type WorldSceneId = 'journey' | 'wedding';

/** The depth layers both paintings are cut into, far to near. */
export const WORLD_KINDS = ['sky', 'far', 'mid', 'near', 'fore'] as const satisfies readonly WorldKind[];

/** How close each layer is to the lens: 0 is the sky, 1 would be on the lens. */
export const NEARNESS: Record<WorldKind, number> = {
  sky: 0,
  far: 0.1,
  mid: 0.66,
  near: 0.8,
  fore: 0.9,
  glint: 0.5,
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/**
 * A layer's scale once the camera has moved forward by `c`. c = 0 is the
 * painting as drawn (scale 1), c > 0 is further in (nearer layers grow faster,
 * and a layer grows without limit as c approaches 1 / nearness), c < 0 is back
 * from where the painting was taken (everything shrinks, the nearer more).
 */
export function perspectiveScale(nearness: number, c: number): number {
  return 1 / Math.max(0.04, 1 - nearness * c);
}

/** How far back the meadow starts when we arrive from the monitor (c < 0). */
export const ARRIVAL_BACK = -0.22;

/** The camera, in each scene's own frame (0 = that scene's painting as drawn). */
export type Camera = { journey: number; wedding: number };

/** The meadow as we arrive from the monitor: p = 0 is just through the screen, 1 is at rest. */
export function arrivalCamera(p: number): Camera {
  return { journey: ARRIVAL_BACK * (1 - clamp01(p)), wedding: 0 };
}

/**
 * How far behind the meadow's camera the river's is, in the river's own units. A full
 * move (1) would start its layers small enough to show their edges while they come in,
 * so the river's layers start closer than that.
 */
export const RIVER_LAG = 0.55;

/**
 * The journey to the river: p = 0 is the meadow at rest, 1 is the river at rest.
 * The river's layers lie further along the same path, so its camera runs behind
 * the meadow's and catches up at the end.
 */
export function crossingCamera(p: number): Camera {
  const q = clamp01(p);
  return { journey: q, wedding: (q - 1) * RIVER_LAG };
}

/** The meadow's sky and far hills give way to the river's, behind the plants rushing past. */
export function crossingBackdrop(p: number): number {
  return 1 - smoothstep(0.12, 0.55, p);
}

/** The river's near layers come up out of the distance once the sky behind them has turned. */
export function crossingFront(p: number): number {
  return smoothstep(0.22, 0.62, p);
}
