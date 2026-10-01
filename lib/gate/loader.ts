// The 0-100 counter shown after a correct password, extracted from
// prototype/index.html's runLoader(). Eases out near the end so it doesn't
// feel mechanical — docs/PLAN.md "The 0-100 loader".
export const LOADER_DURATION_MS = 2000;
export const LOADER_REVEAL_DELAY_MS = 340; // let 100% land before revealing
export const LOADER_BACKGROUND_TAB_GUARD_MS = LOADER_DURATION_MS + 700;
const EASE_EXPONENT = 2.2;

export function computeLoaderPercent(elapsedMs: number, durationMs: number = LOADER_DURATION_MS): number {
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return Math.round((1 - Math.pow(1 - t, EASE_EXPONENT)) * 100);
}
