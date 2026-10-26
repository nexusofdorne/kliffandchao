export const STORY_MOBILE_QUERY = '(max-width: 768px)';
export const STORY_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// 'scenes' is the redesigned desktop story (docs/REDESIGN_PLAN.md): triggered
// scenes instead of the pinned track. It only ever applies to wide screens.
export type StoryLayout = 'horizontal' | 'mobile' | 'reduced' | 'scenes';

// A wide screen can still require native section/rail scrolling. Keeping
// this decision shared prevents the track and carousel choosing differently.
export function resolveStoryLayout(
  isMobile: boolean,
  reducedMotion: boolean,
  scenes: boolean = false,
): StoryLayout {
  // The scene engine handles reduced motion itself (crossfades), so on wide
  // screens it wins over the stacked 'reduced' layout.
  if (scenes && !isMobile) return 'scenes';
  if (reducedMotion) return 'reduced';
  return isMobile ? 'mobile' : 'horizontal';
}
