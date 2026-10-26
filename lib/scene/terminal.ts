// The terminal's progress bar (screen 02). It loads like a real loader:
// monotonic with a few stalls, climbing to HOLD_PERCENT while the intro video
// buffers, then finishing once it can play (or once the wait times out).

export const HOLD_PERCENT = 90;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 0..1 of the main ramp -> 0..HOLD_PERCENT, with stalls. Integer, monotonic. */
export function rampPercent(t: number): number {
  const x = clamp01(t);
  const curve = x - Math.sin(x * Math.PI * 6) / (Math.PI * 6);
  return Math.round(clamp01(curve) * HOLD_PERCENT);
}

/** 0..1 of the final stretch -> HOLD_PERCENT..100. */
export function finishPercent(t: number): number {
  return Math.round(HOLD_PERCENT + clamp01(t) * (100 - HOLD_PERCENT));
}

/** The first `count` characters, counting by code point so emoji aren't split. */
export function typedPrefix(text: string, count: number): string {
  return Array.from(text).slice(0, Math.max(0, count)).join('');
}
