// Helpers the top bar and the phone panels share. The pinned horizontal track
// that used to drive them was replaced by the scene engine (lib/scene).

export const PANEL_COUNT = 3; // intro, journey, wedding
export const DEFAULT_PARALLAX_FACTOR = 0.18;

// Scroll-spy: which of the 3 panels counts as "current" for nav highlighting.
export function computeActiveSection(panel: number): 0 | 1 | 2 {
  if (panel < 0.5) return 0;
  if (panel < 1.5) return 1;
  return 2;
}

// Applied to foreground content layers only, never the backgrounds (which
// fill their panels exactly and would expose a bare edge if shifted).
// layerIndex is the panel (0/1/2) the layer belongs to; the offset is 0
// exactly when that panel is centred.
export function computeParallaxOffset(
  panel: number,
  layerIndex: 0 | 1 | 2,
  viewportWidth: number,
  factor: number = DEFAULT_PARALLAX_FACTOR,
): number {
  return (panel - layerIndex) * viewportWidth * factor;
}

// The nav capsule's pixel position within its track, parameterized on the
// container's measured width rather than reading the DOM directly.
export function computeNavIndicatorPosition(
  panel: number,
  containerWidth: number,
  sectionCount: number = PANEL_COUNT,
): { x: number; width: number } {
  const t = panel / 2;
  const span = containerWidth - 6; // minus 3px padding each side
  const width = span / sectionCount;
  const x = Math.max(0, Math.min(1, t)) * (span - width);
  return { x, width };
}

