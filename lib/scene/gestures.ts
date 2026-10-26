// One scroll gesture = one scene step, however long a trackpad keeps coasting.
// Ported from prototype-v3/app.js: wheel deltas accumulate until they pass a
// threshold, which fires a step, then every event is swallowed until the
// stream goes quiet. Time is passed in, so this is testable without a browser.

export const WHEEL_THRESHOLD = 40;
export const WHEEL_QUIET_MS = 220;
export const SWIPE_THRESHOLD = 45;

export type Direction = 1 | -1;

export interface WheelGate {
  /** Feed one wheel event; returns the step it triggers, if any. */
  push(deltaY: number, now: number): Direction | null;
  /** Forget what has accumulated (a transition started or ended). */
  reset(): void;
}

export function createWheelGate(
  threshold: number = WHEEL_THRESHOLD,
  quietMs: number = WHEEL_QUIET_MS,
): WheelGate {
  let acc = 0;
  let last = Number.NEGATIVE_INFINITY;
  let swallowing = false;

  return {
    push(deltaY, now) {
      const gap = now - last;
      last = now;
      if (swallowing) {
        if (gap < quietMs) return null;
        swallowing = false;
      }
      acc += deltaY;
      if (Math.abs(acc) <= threshold) return null;
      const dir: Direction = acc > 0 ? 1 : -1;
      acc = 0;
      swallowing = true;
      return dir;
    },
    reset() {
      acc = 0;
    },
  };
}

/** A finger drag from y0 to y1: swiping up (y1 < y0) goes further in. */
export function swipeDirection(
  y0: number,
  y1: number,
  threshold: number = SWIPE_THRESHOLD,
): Direction | null {
  const dy = y0 - y1;
  if (Math.abs(dy) <= threshold) return null;
  return dy > 0 ? 1 : -1;
}

/**
 * A scrolling pane inside a scene (the wedding window's body) keeps wheel and
 * arrow keys for itself until it reaches an edge; only then does the gesture
 * count as a step. True when it cannot move any further in `dir`.
 */
export function atScrollEdge(
  el: { scrollTop: number; clientHeight: number; scrollHeight: number },
  dir: Direction,
): boolean {
  if (el.scrollHeight <= el.clientHeight + 1) return true;
  return dir > 0
    ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    : el.scrollTop <= 0;
}

const FORWARD = new Set(['ArrowDown', 'PageDown', ' ']);
const BACK = new Set(['ArrowUp', 'PageUp']);

/** Which step a key press asks for. Modified presses are left to the browser. */
export function keyDirection(
  key: string,
  mods: { ctrl?: boolean; meta?: boolean; alt?: boolean } = {},
): Direction | null {
  if (mods.ctrl || mods.meta || mods.alt) return null;
  if (FORWARD.has(key)) return 1;
  if (BACK.has(key)) return -1;
  return null;
}
