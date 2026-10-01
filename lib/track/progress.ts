// Scroll maths for HorizontalTrack, extracted from prototype/index.html
// (the "One pinned ScrollTrigger" comment block). These are pure so the
// numbers can be unit tested without a browser or GSAP — the component
// just applies them.

export const PANEL_COUNT = 3; // intro, journey, wedding
export const TRACK_SEGMENT_PERCENT = 100 / PANEL_COUNT; // one panel of a 300vw track
export const DEFAULT_PARALLAX_FACTOR = 0.18;

export type ScrollBudget = { p1: number; p2: number; totalScreens: number };

// One screen to slide intro -> journey, one screen per story through the
// journey, one screen to slide journey -> wedding.
export function computeScrollBudget(storyCount: number): ScrollBudget {
  const wheelScreens = storyCount - 1;
  const totalScreens = 1 + wheelScreens + 1;
  return {
    p1: 1 / totalScreens,
    p2: (1 + wheelScreens) / totalScreens,
    totalScreens,
  };
}

// p <= P1: sliding intro -> journey. P1 < p <= P2: parked on journey, the
// wheel/coverflow turns instead. p > P2: sliding journey -> wedding.
export function computePanel(progress: number, p1: number, p2: number): number {
  if (progress <= p1) return progress / p1;
  if (progress <= p2) return 1;
  return 1 + (progress - p2) / (1 - p2);
}

// Locks only the two slide phases, so scroll can never rest half-way
// between panels — the story stretch in between returns its input
// unchanged (free-scrolling), or every flick would yank to the next story.
export function computeSnapTarget(progress: number, p1: number, p2: number): number {
  if (progress < p1) return progress < p1 / 2 ? 0 : p1;
  if (progress > p2) return progress < p2 + (1 - p2) / 2 ? p2 : 1;
  return progress;
}

// Which story is active, derived from how far through the P1-P2 stretch
// progress has travelled.
export function computeActiveStoryIndex(progress: number, p1: number, p2: number, storyCount: number): number {
  const storyProgress = Math.min(1, Math.max(0, (progress - p1) / (p2 - p1)));
  return Math.round(storyProgress * (storyCount - 1));
}

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

// Where TopBar's section buttons jump the scroll position to, given the
// pinned ScrollTrigger's measured start/end. Journey lands mid-story-stretch
// rather than at its very start, so the guest arrives on a story instead of
// the blank instant the slide-in finishes.
export function computeSectionScrollTarget(
  section: 0 | 1 | 2,
  p1: number,
  p2: number,
  start: number,
  end: number,
): number {
  if (section === 0) return start;
  const span = end - start;
  if (section === 1) return start + span * ((p1 + p2) / 2);
  return end - 2;
}

// Where the coverflow's chapter dots, prev/next arrows and card clicks jump
// the scroll position to, given a target STORY index (as opposed to
// computeSectionScrollTarget's whole-panel jumps).
export function computeStoryScrollTarget(
  storyIndex: number,
  storyCount: number,
  p1: number,
  p2: number,
  start: number,
  end: number,
): number {
  const progress = p1 + (p2 - p1) * (storyIndex / (storyCount - 1));
  return start + (end - start) * progress;
}
