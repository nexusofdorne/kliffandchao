// Camera maths for the dive into the monitor (gate 01 -> terminal 02),
// ported from prototype-v3/app.js go12(). Pure so the numbers can be unit
// tested without a browser; the gate applies them as GSAP transforms.
//
// Everything is in "% of the stage". Both stages use transform-origin 0 0,
// so a point p maps to  translate + scale * p.

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface CameraFrame {
  /** Scale applied to the outer scene (the meadow and the monitor). */
  readonly scale: number;
  /** translate(), in % of the stage. */
  readonly x: number;
  readonly y: number;
  /** Blur to put on the scaled layer so it reads as `blurOnScreen` px. */
  readonly blur: number;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * The outer scene during the dive. `origin` is the centre of the monitor's
 * screen in the gate scene, `target` is where the terminal's screen centre sits
 * when the dive ends, and `finalScale` is the total magnification (the inverse
 * of how much smaller the monitor screen is than the terminal screen).
 *
 * The scale grows geometrically, so the dolly feels constant-speed, while the
 * eased `t` gives it a soft start and stop. `maxBlur` is the depth-of-field
 * blur (in on-screen px) the meadow reaches; it starts after 10% of the move.
 */
export function zoomFrame(
  t: number,
  origin: Point,
  target: Point,
  finalScale: number,
  maxBlur = 16,
): CameraFrame {
  const e = easeInOutCubic(clamp01(t));
  const scale = Math.pow(finalScale, e);
  const k = finalScale === 1 ? 0 : (scale - 1) / (finalScale - 1);
  const blurOnScreen = maxBlur * clamp01((e - 0.1) / 0.45);
  return {
    scale,
    x: origin.x * (1 - scale) + k * (target.x - origin.x),
    y: origin.y * (1 - scale) + k * (target.y - origin.y),
    blur: blurOnScreen / scale,
  };
}

/**
 * The terminal scene, which rides along inside the monitor's screen so both
 * scenes move as one camera. `ratio` is the monitor screen's width divided by
 * the terminal screen's width (`1 / finalScale`). It starts drawn inside the
 * small monitor and ends filling the stage at scale 1.
 */
export function ridingFrame(
  t: number,
  origin: Point,
  target: Point,
  ratio: number,
): CameraFrame {
  const finalScale = 1 / ratio;
  const outer = zoomFrame(t, origin, target, finalScale, 0);
  const k = finalScale === 1 ? 0 : (outer.scale - 1) / (finalScale - 1);
  return {
    scale: ratio * outer.scale,
    x:
      origin.x * (1 - outer.scale) +
      (origin.x - target.x * ratio) * outer.scale +
      k * (target.x - origin.x),
    y:
      origin.y * (1 - outer.scale) +
      (origin.y - target.y * ratio) * outer.scale +
      k * (target.y - origin.y),
    blur: 0,
  };
}

/** Where a stage point ends up under a frame (transform-origin 0 0). */
export function project(frame: CameraFrame, p: Point): Point {
  return { x: frame.x + frame.scale * p.x, y: frame.y + frame.scale * p.y };
}

/** CSS for a frame, ready to hand to GSAP or a style attribute. */
export function frameTransform(frame: CameraFrame): string {
  return `translate(${frame.x}%, ${frame.y}%) scale(${frame.scale})`;
}
