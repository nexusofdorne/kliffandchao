export const STORY_MOBILE_QUERY = '(max-width: 768px)';
export const STORY_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// 'scenes' is the desktop story (components/site/scene): triggered scenes, with
// reduced motion handled inside the engine as crossfades. Phones stack the
// three sections under native scroll; with reduced motion on a phone the same
// stack just stops animating its scroll.
export type StoryLayout = 'scenes' | 'mobile' | 'reduced';

export function resolveStoryLayout(
  isMobile: boolean,
  reducedMotion: boolean,
): StoryLayout {
  if (!isMobile) return 'scenes';
  return reducedMotion ? 'reduced' : 'mobile';
}
